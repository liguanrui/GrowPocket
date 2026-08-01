import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { lang = 'zh-CN', continuous = false, interimResults = true } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      if (finalText) {
        setTranscript((prev) => prev + finalText);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: any) => {
      const code: string = event.error || 'unknown';
      const map: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许',
        'service-not-allowed': '当前浏览器不支持语音识别',
        'no-speech': '未检测到语音，请再试一次',
        'audio-capture': '未检测到麦克风设备',
        network: '网络错误，请检查网络连接',
        aborted: '录音已取消',
      };
      setError(map[code] || `语音识别错误：${code}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    };
  }, [lang, continuous, interimResults]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || isListening) return;
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    try {
      rec.start();
      setIsListening(true);
    } catch {
      /* ignore duplicate start */
    }
  }, [isListening]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || !isListening) return;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
  }, [isListening]);

  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
