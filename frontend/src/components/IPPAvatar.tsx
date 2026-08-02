import { useEffect, useMemo, useRef, useState } from 'react';

// —— 思路 C（单一固定形态 × 表情/配饰 APNG 动态）——
// 移除 V3.1 临时用的 Lottie JSON 方案，改为直接渲染 /src/assets/apng 下的 APNG：
//   · 单一角色「SPROUTY 黑种子」+ 表情/姿势/配饰动画
//   · APNG 透明背景、512×512、浏览器原生支持无限循环，无需第三方渲染库
//   · 每个 APNG 都有同名 PNG 静态首帧，prefers-reduced-motion / 加载期 / APNG 加载失败时自动 fallback

// 表情枚举（8 组语义）：6 个基础表情 + 2 个场景专属
export type IPAnimationName =
  | 'happy'
  | 'encourage'
  | 'think'
  | 'surprise'
  | 'comfort'
  | 'proud'
  | 'welcome' // 场景：助手首屏欢迎、Onboarding Step1 C 位
  | 'loading'; // 场景：AI 打字中、成长故事生成 Loading

// 兼容别名：之前老调用处 expression prop 用了 "surprised"（带 d），内部规范化为 surprise
type DeprecatedExpression =
  | 'happy'
  | 'encourage'
  | 'think'
  | 'surprised' // 旧拼写 → 内部规范化为 'surprise'
  | 'comfort'
  | 'proud';

export interface IPPAvatarProps {
  /** 动画语义名（映射到 /assets/apng 下的 APNG 文件名）*/
  animationName?: IPAnimationName;
  /**
   * 旧接口兼容：expression（之前老调用处的 prop 名）
   * 运行时规范化到 animationName。新代码推荐使用 animationName。
   */
  expression?: DeprecatedExpression;
  /** 像素尺寸（宽高等比）*/
  size?: number;
  /** 无障碍标签（默认按动画名自动生成）*/
  alt?: string;
}

// —— APNG 资源（动态图）：8 个语义 → 11 个素材文件（README.md 定义：seed-* 系列 + chin-question/hug/crown-proud/welcome-wave/ai-thinking）
import apng_happy from '../assets/apng/seed-happy.apng';
import apng_cheer from '../assets/apng/seed-cheer.apng';
import apng_chin_question from '../assets/apng/chin-question.apng';
import apng_surprised from '../assets/apng/seed-surprised.apng';
import apng_hug from '../assets/apng/hug.apng';
import apng_crown_proud from '../assets/apng/crown-proud.apng';
import apng_welcome_wave from '../assets/apng/welcome-wave.apng';
import apng_ai_thinking from '../assets/apng/ai-thinking.apng';

// —— 静态 PNG fallback（每个 APNG 都有同名首帧 PNG，APNG 加载失败或 prefers-reduced-motion 时用它）
import png_happy from '../assets/apng/seed-happy.png';
import png_cheer from '../assets/apng/seed-cheer.png';
import png_chin_question from '../assets/apng/chin-question.png';
import png_surprised from '../assets/apng/seed-surprised.png';
import png_hug from '../assets/apng/hug.png';
import png_crown_proud from '../assets/apng/crown-proud.png';
import png_welcome_wave from '../assets/apng/welcome-wave.png';
import png_ai_thinking from '../assets/apng/ai-thinking.png';

// 8 个语义 → 具体素材的映射（语义和素材名不是 1:1，中间语义退化层）
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

// 静态 fallback PNG：8 个语义都有独立静态图，不再退化到 happy/think
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

/**
 * IPPAvatar — 思路 C 单一固定形态（SPROUTY 黑种子）× APNG 原生动画。
 *
 * 渲染策略：
 *   ① 默认渲染 APNG（浏览器原生播放，无第三方依赖）
 *   ② 如果 APNG 加载失败（onerror） → 自动降级到同语义的 PNG 静态首帧
 *   ③ 若系统开启「减弱动态效果」prefers-reduced-motion=true → 直接渲染静态 PNG
 *   ④ 同层渲染 + 透明度切换，避免切表情时闪烁抖动
 */
export function IPPAvatar(props: IPPAvatarProps) {
  const { size = 48, alt } = props;

  const animationName = normalizeAnimationName(props);
  const label = alt ?? ANIMATION_LABEL[animationName];

  const [prefersReduced, setPrefersReduced] = useState(false);
  const [apngOk, setApngOk] = useState(true); // APNG 是否成功加载（未触发 onerror）
  const mountedRef = useRef(true);

  // 监听 prefers-reduced-motion：系统减弱动画 → 直接用静态 PNG
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReduced(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  // 切换 animationName 时重置 apngOk 为 true（新图开始时都假设能成功，onerror 才置 false）
  useEffect(() => {
    setApngOk(true);
  }, [animationName]);

  // 保持组件挂载/卸载标记（未来可扩展取消请求）
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

  // 是否应该播放动态图
  const playAnimated = !prefersReduced && apngOk;

  // 当前展示的图片 src + 是否是 APNG（用于 aria-live/decoding 提示）
  const src = playAnimated ? APNG_SRC[animationName] : PNG_SRC[animationName];
  const staticSrc = PNG_SRC[animationName];

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={label}
      style={commonStyle}
    >
      {/* 底层始终渲染静态 PNG：APNG 加载失败 / 减弱动画 / APNG 首帧加载前都由它兜底，避免空白闪烁 */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
        style={{ opacity: playAnimated ? 0 : 1 }}
      >
        <img
          src={staticSrc}
          alt=""
          aria-hidden="true"
          className="object-contain select-none"
          style={commonStyle}
          draggable={false}
          decoding="async"
        />
      </div>

      {/* APNG 层：可播放时覆盖显示 */}
      {playAnimated && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            apngOk ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
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
              // APNG 加载失败（如打包漏资源、CDN 404）→ 退化为静态 PNG
              setApngOk(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default IPPAvatar;
