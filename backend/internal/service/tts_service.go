package service

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	edgeTrustedToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
	edgeChromiumFull = "143.0.3650.75"
	edgeWSSBase      = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
	// 晓晓：接近豆包默认的年轻女声助手，自然清晰（Edge 通道不支持 mstts 风格，style 默认 none）
	defaultTTSVoice  = "zh-CN-XiaoxiaoNeural"
	defaultTTSRate   = "+0%"
	defaultTTSPitch  = "+0Hz"
	defaultTTSVolume = "+0%"
	defaultTTSStyle  = "none"
	maxTTSTextRunes  = 500
	winEpochSeconds  = 11644473600
)

// TTSService 使用微软 Edge 在线 TTS（无需 API Key）合成语音
type TTSService struct {
	voice  string
	rate   string
	pitch  string
	volume string
	style  string
}

func NewTTSService() *TTSService {
	voice := os.Getenv("TTS_VOICE")
	if voice == "" {
		voice = defaultTTSVoice
	}
	rate := os.Getenv("TTS_RATE")
	if rate == "" {
		rate = defaultTTSRate
	}
	pitch := os.Getenv("TTS_PITCH")
	if pitch == "" {
		pitch = defaultTTSPitch
	}
	volume := os.Getenv("TTS_VOLUME")
	if volume == "" {
		volume = defaultTTSVolume
	}
	style := os.Getenv("TTS_STYLE")
	if style == "" {
		style = defaultTTSStyle
	}
	return &TTSService{voice: voice, rate: rate, pitch: pitch, volume: volume, style: style}
}

// Synthesize 将文本合成为 MP3 字节
func (s *TTSService) Synthesize(text string) ([]byte, error) {
	text = strings.TrimSpace(cleanTTSText(text))
	if text == "" {
		return nil, errors.New("文本为空")
	}
	if utf8.RuneCountInString(text) > maxTTSTextRunes {
		runes := []rune(text)
		text = string(runes[:maxTTSTextRunes])
	}

	connID := strings.ReplaceAll(uuid.NewString(), "-", "")
	secMSGEC := generateSecMSGEC()
	u := fmt.Sprintf(
		"%s?TrustedClientToken=%s&ConnectionId=%s&Sec-MS-GEC=%s&Sec-MS-GEC-Version=%s",
		edgeWSSBase,
		url.QueryEscape(edgeTrustedToken),
		connID,
		secMSGEC,
		url.QueryEscape("1-"+edgeChromiumFull),
	)

	major := strings.Split(edgeChromiumFull, ".")[0]
	ua := fmt.Sprintf(
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s.0.0.0 Safari/537.36 Edg/%s.0.0.0",
		major, major,
	)
	header := http.Header{}
	header.Set("Pragma", "no-cache")
	header.Set("Cache-Control", "no-cache")
	header.Set("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
	header.Set("User-Agent", ua)
	header.Set("Accept-Encoding", "gzip, deflate, br, zstd")
	header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	header.Set("Cookie", "muid="+strings.ToUpper(strings.ReplaceAll(uuid.NewString(), "-", ""))+";")

	dialer := websocket.Dialer{
		HandshakeTimeout:  12 * time.Second,
		EnableCompression: true,
	}
	conn, resp, err := dialer.Dial(u, header)
	if err != nil {
		status := ""
		if resp != nil {
			status = resp.Status
		}
		return nil, fmt.Errorf("TTS 连接失败: %v %s", err, status)
	}
	defer conn.Close()
	_ = conn.SetReadDeadline(time.Now().Add(45 * time.Second))
	_ = conn.SetWriteDeadline(time.Now().Add(15 * time.Second))

	configMsg := fmt.Sprintf(
		"X-Timestamp:%s\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n"+
			`{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`+"\r\n",
		jsDateString(),
	)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(configMsg)); err != nil {
		return nil, fmt.Errorf("TTS 发送配置失败: %w", err)
	}

	ssml := buildSSML(s.voice, s.rate, s.pitch, s.volume, s.style, text)
	ssmlMsg := fmt.Sprintf(
		"X-RequestId:%s\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:%sZ\r\nPath:ssml\r\n\r\n%s",
		strings.ReplaceAll(uuid.NewString(), "-", ""),
		jsDateString(),
		ssml,
	)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(ssmlMsg)); err != nil {
		return nil, fmt.Errorf("TTS 发送文本失败: %w", err)
	}

	var audio bytes.Buffer
	gotAudio := false
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			if gotAudio {
				break
			}
			return nil, fmt.Errorf("TTS 读取失败: %w", err)
		}
		switch msgType {
		case websocket.TextMessage:
			path, _ := parseEdgeHeaders(data)
			if path == "turn.end" {
				goto DONE
			}
		case websocket.BinaryMessage:
			path, payload := splitEdgeBinary(data)
			if path != "audio" || len(payload) == 0 {
				continue
			}
			audio.Write(payload)
			gotAudio = true
		}
	}
DONE:
	if !gotAudio || audio.Len() == 0 {
		return nil, errors.New("未收到语音数据，请稍后重试")
	}
	return audio.Bytes(), nil
}

func generateSecMSGEC() string {
	ticks := float64(time.Now().UTC().Unix()) + winEpochSeconds
	ticks -= float64(int64(ticks) % 300)
	ticks *= 1e9 / 100 // 100-ns intervals
	strToHash := fmt.Sprintf("%.0f%s", ticks, edgeTrustedToken)
	sum := sha256.Sum256([]byte(strToHash))
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

func jsDateString() string {
	return time.Now().UTC().Format("Mon Jan 02 2006 15:04:05") + " GMT+0000 (Coordinated Universal Time)"
}

func buildSSML(voice, rate, pitch, volume, style, text string) string {
	esc := xmlEscape(text)
	prosody := fmt.Sprintf(
		"<prosody pitch='%s' rate='%s' volume='%s'>%s</prosody>",
		xmlEscape(pitch), xmlEscape(rate), xmlEscape(volume), esc,
	)
	inner := prosody
	// 晓晓等支持风格的音色：chat 更接近豆包默认助手口吻
	if style != "" && style != "none" {
		inner = fmt.Sprintf(
			"<mstts:express-as style='%s'>%s</mstts:express-as>",
			xmlEscape(style), prosody,
		)
	}
	return fmt.Sprintf(
		"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='zh-CN'>"+
			"<voice name='%s'>%s</voice></speak>",
		xmlEscape(voice), inner,
	)
}

func xmlEscape(s string) string {
	r := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		"'", "&apos;",
	)
	return r.Replace(s)
}

func cleanTTSText(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		code := r
		if (code >= 0 && code <= 8) || (code >= 11 && code <= 12) || (code >= 14 && code <= 31) {
			b.WriteRune(' ')
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func parseEdgeHeaders(data []byte) (path string, body []byte) {
	sep := bytes.Index(data, []byte("\r\n\r\n"))
	if sep < 0 {
		return "", data
	}
	headerPart := data[:sep]
	body = data[sep+4:]
	for _, line := range bytes.Split(headerPart, []byte("\r\n")) {
		parts := bytes.SplitN(line, []byte(":"), 2)
		if len(parts) != 2 {
			continue
		}
		if string(bytes.TrimSpace(parts[0])) == "Path" {
			path = string(bytes.TrimSpace(parts[1]))
		}
	}
	return path, body
}

func splitEdgeBinary(data []byte) (path string, payload []byte) {
	if len(data) < 2 {
		return "", nil
	}
	// 与 edge-tts 一致：前 2 字节为 header 长度（含这 2 字节自身的计数方式见下）
	// Python: headers=data[:headerLength], body=data[headerLength+2:]
	headerLength := int(binary.BigEndian.Uint16(data[:2]))
	if headerLength < 2 || headerLength+2 > len(data) {
		return "", nil
	}
	headerBytes := data[2:headerLength] // 跳过长度前缀
	payload = data[headerLength+2:]
	path, _ = parseEdgeHeaders(append(append([]byte{}, headerBytes...), []byte("\r\n\r\n")...))
	// 个别帧会多带 CRLF
	payload = bytes.TrimLeft(payload, "\r\n")
	return path, payload
}

// VoiceInfo 用于调试
func (s *TTSService) VoiceInfo() map[string]string {
	return map[string]string{
		"voice":  s.voice,
		"rate":   s.rate,
		"pitch":  s.pitch,
		"volume": s.volume,
		"style":  s.style,
	}
}