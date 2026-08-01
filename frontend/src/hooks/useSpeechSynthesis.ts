import { useState, useCallback, useEffect, useRef } from 'react';
import { preprocessForSpeech } from '../lib/utils';

interface UseSpeechSynthesisOptions {
  lang?: string;
  rate?: number;   // 语速 0.1 - 10，儿童友好 1.0 ~ 1.05
  pitch?: number;  // 音调 0 - 2，儿童友好 1.1（稍高一点像小萌芽的声音）
  volume?: number; // 音量 0 - 1
  preprocess?: boolean; // 是否清洗 Markdown / emoji 后再朗读（默认开）
}

interface UseSpeechSynthesisReturn {
  isSpeaking: boolean;
  isSupported: boolean;
  /** 当前选到的语音名称（调试/展示用），没选中时为空 */
  currentVoiceName: string;
  /**
   * 朗读文案。调用时自动：
   *  - 若 preprocess=true，先清洗 Markdown/emoji/链接
   *  - 停止上一条正在朗读的内容（避免叠加）
   *  - 优先选"儿童/女声/中国大陆中文"语音包
   */
  speak: (rawText: string) => void;
  /** 停止朗读 */
  cancel: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * 儿童产品友好的中文语音包加权优先级。
 * key：语音名/厂商关键字的小写；value：权重分，越大越优先。
 * 覆盖常见桌面 / 移动端系统：
 *  - macOS：Tingting（小雅 / 婷婷）最常见默认中文女声 → 99 分
 *  - iOS：Tingting / Meijia（美嘉）/ Sinji
 *  - Windows：Microsoft Huihui（晓晓 / 惠惠）/ Xiaoxiao / Yaoyao
 *  - Android：Google 普通话（中国大陆）
 */
const VOICE_PRIORITY_KEYWORDS: [string, number][] = [
  ['tingting', 99],     // macOS/iOS 小雅（最常用儿童向）
  ['meijia', 95],       // iOS 美嘉
  ['huihui', 90],       // Windows 惠惠
  ['xiaoxiao', 90],     // Windows 晓晓
  ['yaoyao', 88],       // Android 耀耀 / 遥遥
  ['yunxi', 85],        // 云希（Azure TTS 常见）
  ['yunjian', 85],      // 云健
  ['xiaoxuan', 85],     // 小璇
  ['xiaoyi', 85],       // 小艺
  ['sinji', 70],        // Sinji（粤语/香港腔，降分但仍属中文）
  ['google 普通话', 60],// Android 默认中文
  ['google pinyin', 60],
  ['mandarin', 50],     // 通用普通话
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = (v.name || '').toLowerCase();
  const lang = (v.lang || '').toLowerCase();

  let score = 0;

  // 1) 语言维度：必须是中文
  const isZh =
    lang.startsWith('zh') ||
    lang.includes('cn') ||
    lang.includes('hans') ||
    lang.includes('hant');
  if (!isZh) return -1; // 非中文直接排除

  // 中国大陆简体优先（高于台湾/香港腔）
  if (lang.includes('zh-cn') || lang.includes('zh_hans')) score += 40;
  else if (lang.includes('zh-tw') || lang.includes('zh_hant')) score += 10;
  else if (lang.startsWith('zh')) score += 25; // 一般中文

  // 2) 语音名关键字：匹配儿童/女声得分
  for (const [kw, bonus] of VOICE_PRIORITY_KEYWORDS) {
    if (name.includes(kw.toLowerCase())) {
      score += bonus;
      break;
    }
  }

  // 3) 偏好默认 / 本地语音（离线可用），降权远程语音
  if (v.default) score += 8;
  if (v.localService) score += 6;

  // 4) 性别信号（不是所有系统都暴露，但 name 里常见 female / male）
  if (name.includes('female')) score += 4;
  if (name.includes('male') && score > 0) score -= 6;

  return score;
}

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;
  const zhVoices = voices
    .map((v) => ({ v, s: scoreVoice(v) }))
    .filter((x) => x.s >= 0)        // 去掉非中文
    .sort((a, b) => b.s - a.s);    // 高分在前
  return zhVoices[0]?.v;
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisReturn {
  const {
    lang = 'zh-CN',
    rate = 1.05,
    pitch = 1.1,
    volume = 1,
    preprocess = true,
  } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [currentVoiceName, setCurrentVoiceName] = useState('');
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const pickedVoiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);

  // 选好中文语音后缓存一次（避免每次 speak 都重算）
  const updatePickedVoice = useCallback(() => {
    const best = pickBestVoice(voicesRef.current);
    pickedVoiceRef.current = best;
    setCurrentVoiceName(best?.name || '');
  }, []);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    setIsSupported(supported);
    if (!supported) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      updatePickedVoice();
    };

    loadVoices();

    // voices 在很多浏览器上是异步加载的
    const w = window as any;
    if (w.speechSynthesis && typeof w.speechSynthesis.onvoiceschanged !== 'undefined') {
      w.speechSynthesis.onvoiceschanged = loadVoices;
    }
    // macOS Safari 有时不会触发 onvoiceschanged，做个兜底延迟重查
    const t = setTimeout(loadVoices, 800);
    return () => clearTimeout(t);
  }, [updatePickedVoice]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (rawText: string) => {
      if (!isSupported || !rawText) return;

      const text = preprocess ? preprocessForSpeech(rawText) : rawText;
      if (!text) return;

      // 先取消任何正在朗读的（避免两条叠在一起）
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // 使用加权挑出的最佳中文语音
      const voice = pickedVoiceRef.current;
      if (voice) {
        try {
          utterance.voice = voice;
        } catch {
          /* 某些浏览器禁止手动赋值 voice，忽略即可 */
        }
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      utterance.onpause = () => setIsSpeaking(false);
      utterance.onresume = () => setIsSpeaking(true);

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }

      // 兜底：有些系统在一条长句朗读中途，`isSpeaking` 会被置为 false，
      // 用 150ms 后再次确认一下（不影响体验）
      setTimeout(() => {
        try {
          setIsSpeaking(window.speechSynthesis.speaking);
        } catch {
          /* ignore */
        }
      }, 150);
    },
    [lang, rate, pitch, volume, preprocess, isSupported],
  );

  const pause = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.pause();
    } catch {
      /* ignore */
    }
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }
  }, [isSupported]);

  return { isSpeaking, isSupported, currentVoiceName, speak, cancel, pause, resume };
}
