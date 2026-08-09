import { useEffect, useMemo, useRef, useState } from 'react';

// —— 思路 C（单一固定形态 × 表情/配饰 APNG 动态）——
// 单一角色「SPROUTY 黑种子」+ APNG；静态 PNG 作降级兜底。
// 注意：切表情时只用单层 APNG，禁止双图叠化（会重影）。

export type IPAnimationName =
  | 'happy'
  | 'encourage'
  | 'think'
  | 'surprise'
  | 'comfort'
  | 'proud'
  | 'welcome'
  | 'loading';

type DeprecatedExpression =
  | 'happy'
  | 'encourage'
  | 'think'
  | 'surprised'
  | 'comfort'
  | 'proud';

export interface IPPAvatarProps {
  animationName?: IPAnimationName;
  expression?: DeprecatedExpression;
  size?: number;
  alt?: string;
  /** 表情轮播列表；有值时在列表内循环切换 */
  playlist?: IPAnimationName[];
  /** 轮播间隔（ms），默认 3000 */
  playlistIntervalMs?: number;
  /** 轻微上下浮动 */
  float?: boolean;
}

import apng_happy from '../assets/apng/seed-happy.apng';
import apng_cheer from '../assets/apng/seed-cheer.apng';
import apng_chin_question from '../assets/apng/chin-question.apng';
import apng_surprised from '../assets/apng/seed-surprised.apng';
import apng_hug from '../assets/apng/hug.apng';
import apng_crown_proud from '../assets/apng/crown-proud.apng';
import apng_welcome_wave from '../assets/apng/welcome-wave.apng';
import apng_ai_thinking from '../assets/apng/ai-thinking.apng';

import png_happy from '../assets/apng/seed-happy.png';
import png_cheer from '../assets/apng/seed-cheer.png';
import png_chin_question from '../assets/apng/chin-question.png';
import png_surprised from '../assets/apng/seed-surprised.png';
import png_hug from '../assets/apng/hug.png';
import png_crown_proud from '../assets/apng/crown-proud.png';
import png_welcome_wave from '../assets/apng/welcome-wave.png';
import png_ai_thinking from '../assets/apng/ai-thinking.png';

const APNG_SRC: Record<IPAnimationName, string> = {
  happy: apng_happy,
  encourage: apng_cheer,
  think: apng_chin_question,
  surprise: apng_surprised,
  comfort: apng_hug,
  proud: apng_crown_proud,
  welcome: apng_welcome_wave,
  loading: apng_ai_thinking,
};

const PNG_SRC: Record<IPAnimationName, string> = {
  happy: png_happy,
  encourage: png_cheer,
  think: png_chin_question,
  surprise: png_surprised,
  comfort: png_hug,
  proud: png_crown_proud,
  welcome: png_welcome_wave,
  loading: png_ai_thinking,
};

/** 回顾讲述场景：围绕主情绪的动作序列 */
export const STORY_PLAYLISTS: Record<IPAnimationName, IPAnimationName[]> = {
  welcome: ['welcome', 'happy', 'encourage', 'welcome'],
  encourage: ['encourage', 'happy', 'proud', 'encourage'],
  think: ['think', 'surprise', 'think', 'happy'],
  happy: ['happy', 'encourage', 'surprise', 'happy'],
  surprise: ['surprise', 'happy', 'proud', 'surprise'],
  proud: ['proud', 'encourage', 'happy', 'proud'],
  comfort: ['comfort', 'happy', 'welcome', 'comfort'],
  loading: ['loading', 'think', 'loading'],
};

function normalizeAnimationName(props: IPPAvatarProps): IPAnimationName {
  if (props.animationName) return props.animationName;
  if (props.expression) {
    if (props.expression === 'surprised') return 'surprise';
    return props.expression as IPAnimationName;
  }
  return 'happy';
}

const ANIMATION_LABEL: Record<IPAnimationName, string> = {
  happy: '小萌芽，开心的表情',
  encourage: '小萌芽，加油鼓励',
  think: '小萌芽，摸下巴思考',
  surprise: '小萌芽，惊讶的表情',
  comfort: '小萌芽，温柔的拥抱',
  proud: '小萌芽，戴皇冠的骄傲表情',
  welcome: '小萌芽，挥手欢迎',
  loading: '小萌芽，AI 思考中',
};

/** 预加载全部 APNG，减少回顾滑动切表情时的卡顿 */
export function preloadIPAvatars(): void {
  if (typeof window === 'undefined') return;
  Object.values(APNG_SRC).forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}

/**
 * IPPAvatar — 单层 APNG 渲染，切表情直接替换（不叠双图，避免重影）。
 */
export function IPPAvatar(props: IPPAvatarProps) {
  const {
    size = 48,
    alt,
    playlist,
    playlistIntervalMs = 3000,
    float = false,
  } = props;

  const baseName = normalizeAnimationName(props);
  const sequence = useMemo(() => {
    if (playlist && playlist.length > 0) return playlist;
    return [baseName];
  }, [playlist, baseName]);

  const [seqIndex, setSeqIndex] = useState(0);
  const animationName = sequence[Math.min(seqIndex, sequence.length - 1)] ?? baseName;
  const label = alt ?? ANIMATION_LABEL[animationName];

  const [prefersReduced, setPrefersReduced] = useState(false);
  const [apngOk, setApngOk] = useState(true);
  const mountedRef = useRef(true);
  const seqKey = sequence.join('|');

  useEffect(() => {
    setSeqIndex(0);
  }, [seqKey]);

  useEffect(() => {
    if (sequence.length <= 1 || prefersReduced) return;
    const id = window.setInterval(() => {
      setSeqIndex((i) => (i + 1) % sequence.length);
    }, Math.max(1600, playlistIntervalMs));
    return () => window.clearInterval(id);
  }, [seqKey, sequence.length, playlistIntervalMs, prefersReduced]);

  useEffect(() => {
    setApngOk(true);
  }, [animationName]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReduced(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const commonStyle = useMemo(
    () =>
      ({
        width: size,
        height: size,
      }) as const,
    [size],
  );

  const playAnimated = !prefersReduced && apngOk;
  const src = playAnimated ? APNG_SRC[animationName] : PNG_SRC[animationName];
  const staticSrc = PNG_SRC[animationName];
  const floatClass = float && !prefersReduced ? 'ip-avatar-float' : '';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${floatClass}`}
      role="img"
      aria-label={label}
      style={commonStyle}
    >
      <style>{`
        @keyframes ip-avatar-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .ip-avatar-float {
          animation: ip-avatar-float 2.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ip-avatar-float { animation: none; }
        }
      `}</style>

      {/* 静态兜底：仅在不播放 APNG 时可见，避免与动态层叠加重影 */}
      {!playAnimated && (
        <img
          src={staticSrc}
          alt=""
          aria-hidden="true"
          className="object-contain select-none"
          style={commonStyle}
          draggable={false}
          decoding="async"
        />
      )}

      {playAnimated && (
        <img
          key={animationName}
          src={src}
          alt={label}
          className="object-contain select-none"
          style={commonStyle}
          draggable={false}
          decoding="async"
          loading="eager"
          onError={() => {
            if (!mountedRef.current) return;
            setApngOk(false);
          }}
        />
      )}
    </div>
  );
}

export default IPPAvatar;
