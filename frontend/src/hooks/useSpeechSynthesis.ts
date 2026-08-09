import { useState, useCallback, useEffect, useRef } from 'react';
import { preprocessForSpeech } from '../lib/utils';
import { synthesizeSpeech } from '../services/tts';

interface UseSpeechSynthesisOptions {
  lang?: string;
  rate?: number;   // 浏览器回退语速
  pitch?: number;  // 浏览器回退音调
  volume?: number;
  preprocess?: boolean;
  /** 优先走云端助手女声（默认 true） */
  preferCloud?: boolean;
}

interface UseSpeechSynthesisReturn {
  isSpeaking: boolean;
  isSupported: boolean;
  currentVoiceName: string;
  speak: (rawText: string) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * 儿童产品友好的中文语音包加权优先级（仅浏览器回退时使用）。
 */
const VOICE_PRIORITY_KEYWORDS: [string, number][] = [
  ['xiaoxiao', 100],
  ['yaoyao', 98],
  ['huihui', 96],
  ['xiaoyi', 95],
  ['xiaoxuan', 94],
  ['tingting', 93],
  ['meijia', 92],
  ['yunxia', 88],
  ['girl', 85],
  ['female', 80],
  ['child', 85],
  ['google 普通话', 70],
  ['mandarin', 50],
  ['yunxi', -40],
  ['yunjian', -50],
  ['male', -60],
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = (v.name || '').toLowerCase();
  const lang = (v.lang || '').toLowerCase();
  let score = 0;
  const isZh =
    lang.startsWith('zh') ||
    lang.includes('cn') ||
    lang.includes('hans') ||
    lang.includes('hant');
  if (!isZh) return -1;
  if (lang.includes('zh-cn') || lang.includes('zh_hans') || lang === 'zh') score += 40;
  else if (lang.includes('zh-tw') || lang.includes('zh_hant')) score += 10;
  else if (lang.startsWith('zh')) score += 25;

  for (const [kw, bonus] of VOICE_PRIORITY_KEYWORDS) {
    if (name.includes(kw)) {
      score += bonus;
      break;
    }
  }
  if (v.localService) score += 6;
  if (name.includes('female') || name.includes('girl')) score += 12;
  if (name.includes('male') || name.includes('man')) score -= 50;
  return score;
}

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;
  const zhVoices = voices
    .map((v) => ({ v, s: scoreVoice(v) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  return zhVoices[0]?.v;
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisReturn {
  const {
    lang = 'zh-CN',
    rate = 1.0,
    pitch = 1.05,
    volume = 1,
    preprocess = true,
    preferCloud = true,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [currentVoiceName, setCurrentVoiceName] = useState('晓晓·智能助手');

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const pickedVoiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const speakGenRef = useRef(0);
  const browserSupportedRef = useRef(false);

  const updatePickedVoice = useCallback(() => {
    const best = pickBestVoice(voicesRef.current);
    pickedVoiceRef.current = best;
  }, []);

  useEffect(() => {
    const hasAudio = typeof Audio !== 'undefined';
    const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
    browserSupportedRef.current = hasSpeech;
    setIsSupported(hasAudio || hasSpeech);
    if (!hasSpeech) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      updatePickedVoice();
    };
    loadVoices();
    const w = window as any;
    if (w.speechSynthesis && typeof w.speechSynthesis.onvoiceschanged !== 'undefined') {
      w.speechSynthesis.onvoiceschanged = loadVoices;
    }
    const t = setTimeout(loadVoices, 800);
    return () => clearTimeout(t);
  }, [updatePickedVoice]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {
        /* ignore */
      }
      objectUrlRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    speakGenRef.current += 1;
    stopAudio();
    if (browserSupportedRef.current) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    setIsSpeaking(false);
  }, [stopAudio]);

  const speakBrowser = useCallback(
    (text: string) => {
      if (!browserSupportedRef.current) {
        setIsSpeaking(false);
        return;
      }
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
      const voice = pickedVoiceRef.current;
      if (voice) {
        try {
          utterance.voice = voice;
          setCurrentVoiceName(voice.name || '系统语音');
        } catch {
          /* ignore */
        }
      } else {
        setCurrentVoiceName('系统语音');
      }
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    [lang, rate, pitch, volume],
  );

  const speak = useCallback(
    (rawText: string) => {
      if (!rawText) return;
      const text = preprocess ? preprocessForSpeech(rawText) : rawText;
      if (!text) return;

      const gen = ++speakGenRef.current;
      stopAudio();
      if (browserSupportedRef.current) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
      }

      if (!preferCloud) {
        speakBrowser(text);
        return;
      }

      setIsSpeaking(true);
      setCurrentVoiceName('晓晓·智能助手');

      (async () => {
        try {
          const blob = await synthesizeSpeech(text);
          if (gen !== speakGenRef.current) return;
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            if (gen === speakGenRef.current) setIsSpeaking(false);
          };
          audio.onerror = () => {
            if (gen !== speakGenRef.current) return;
            stopAudio();
            speakBrowser(text);
          };
          await audio.play();
        } catch {
          if (gen !== speakGenRef.current) return;
          speakBrowser(text);
        }
      })();
    },
    [preprocess, preferCloud, speakBrowser, stopAudio],
  );

  const pause = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    if (!browserSupportedRef.current) return;
    try {
      window.speechSynthesis.pause();
    } catch {
      /* ignore */
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      void audioRef.current.play().catch(() => undefined);
      return;
    }
    if (!browserSupportedRef.current) return;
    try {
      window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }
  }, []);

  return { isSpeaking, isSupported, currentVoiceName, speak, cancel, pause, resume };
}
