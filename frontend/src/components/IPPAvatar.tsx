interface IPPAvatarProps {
  growthIndex?: number; // 0-100，决定阶段
  expression?: 'happy' | 'encourage' | 'think' | 'surprised' | 'comfort' | 'proud';
  size?: number; // 像素尺寸
  animated?: boolean; // 是否播放动画
}

type Stage = 'seed' | 'sprout' | 'seedling' | 'tree' | 'bigtree';
type ExpressionType = 'happy' | 'encourage' | 'think' | 'surprised' | 'comfort' | 'proud';

function getStage(index: number): Stage {
  if (index < 20) return 'seed';
  if (index < 40) return 'sprout';
  if (index < 60) return 'seedling';
  if (index < 80) return 'tree';
  return 'bigtree';
}

export function IPPAvatar({ growthIndex = 0, expression = 'happy', size = 48, animated = false }: IPPAvatarProps) {
  const stage = getStage(growthIndex);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${animated ? 'animate-bounce' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {/* 土壤 */}
        <ellipse cx="50" cy="85" rx="30" ry="6" fill="#8B6F47" opacity="0.3" />

        {/* 根据阶段渲染不同形态 */}
        {stage === 'seed' && <SeedShape />}
        {stage === 'sprout' && <SproutShape />}
        {stage === 'seedling' && <SeedlingShape />}
        {stage === 'tree' && <TreeShape />}
        {stage === 'bigtree' && <BigTreeShape />}

        {/* 表情 */}
        <Expression type={expression} />
      </svg>
    </div>
  );
}

// 种子形态
function SeedShape() {
  return (
    <g>
      <ellipse cx="50" cy="70" rx="18" ry="22" fill="#8B6F47" />
      <ellipse cx="50" cy="68" rx="15" ry="19" fill="#A0825A" />
    </g>
  );
}

// 萌芽形态
function SproutShape() {
  return (
    <g>
      <ellipse cx="50" cy="75" rx="14" ry="16" fill="#8B6F47" />
      <path d="M50 60 Q50 45 50 35" stroke="#7EC850" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="45" cy="38" rx="6" ry="4" fill="#7EC850" transform="rotate(-30 45 38)" />
      <ellipse cx="55" cy="38" rx="6" ry="4" fill="#7EC850" transform="rotate(30 55 38)" />
    </g>
  );
}

// 小苗形态
function SeedlingShape() {
  return (
    <g>
      <path d="M50 85 L50 40" stroke="#5A9F3C" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="40" cy="50" rx="12" ry="8" fill="#7EC850" transform="rotate(-20 40 50)" />
      <ellipse cx="60" cy="50" rx="12" ry="8" fill="#7EC850" transform="rotate(20 60 50)" />
      <ellipse cx="50" cy="35" rx="10" ry="7" fill="#7EC850" />
    </g>
  );
}

// 小树形态
function TreeShape() {
  return (
    <g>
      <rect x="47" y="50" width="6" height="35" fill="#8B6F47" rx="2" />
      <circle cx="50" cy="40" r="22" fill="#7EC850" />
      <circle cx="38" cy="35" r="12" fill="#8ED460" />
      <circle cx="62" cy="35" r="12" fill="#8ED460" />
      <circle cx="50" cy="25" r="10" fill="#9FE070" />
    </g>
  );
}

// 大树形态（带皇冠）
function BigTreeShape() {
  return (
    <g>
      <rect x="46" y="45" width="8" height="40" fill="#8B6F47" rx="2" />
      <circle cx="50" cy="35" r="28" fill="#7EC850" />
      <circle cx="35" cy="30" r="15" fill="#8ED460" />
      <circle cx="65" cy="30" r="15" fill="#8ED460" />
      <circle cx="50" cy="18" r="12" fill="#9FE070" />
      {/* 小皇冠 */}
      <path d="M40 8 L45 3 L50 8 L55 3 L60 8 L60 12 L40 12 Z" fill="#FFD54F" stroke="#FF9500" strokeWidth="1" />
    </g>
  );
}

// 表情
function Expression({ type }: { type: ExpressionType }) {
  const eyeY = 45;
  const mouthY = 55;
  switch (type) {
    case 'happy':
      return (
        <g>
          <circle cx="42" cy={eyeY} r="2.5" fill="#333" />
          <circle cx="58" cy={eyeY} r="2.5" fill="#333" />
          <path d={`M44 ${mouthY} Q50 ${mouthY + 4} 56 ${mouthY}`} stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'encourage':
      return (
        <g>
          <path d="M39 44 Q42 42 45 44" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M55 44 Q58 42 61 44" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d={`M44 ${mouthY} Q50 ${mouthY + 5} 56 ${mouthY}`} stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'think':
      return (
        <g>
          <circle cx="42" cy={eyeY} r="2.5" fill="#333" />
          <circle cx="58" cy={eyeY} r="2.5" fill="#333" />
          <path d={`M46 ${mouthY + 2} L54 ${mouthY + 2}`} stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'surprised':
      return (
        <g>
          <circle cx="42" cy={eyeY} r="3.5" fill="#333" />
          <circle cx="58" cy={eyeY} r="3.5" fill="#333" />
          <circle cx="50" cy={mouthY + 1} r="3" fill="none" stroke="#333" strokeWidth="2" />
        </g>
      );
    case 'comfort':
      return (
        <g>
          <path d="M39 45 Q42 43 45 45" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M55 45 Q58 43 61 45" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d={`M46 ${mouthY + 1} Q50 ${mouthY - 1} 54 ${mouthY + 1}`} stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'proud':
      return (
        <g>
          <path d="M39 43 L45 46" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M55 46 L61 43" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d={`M44 ${mouthY} Q50 ${mouthY + 6} 56 ${mouthY}`} stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
    default:
      return <Expression type="happy" />;
  }
}

export default IPPAvatar;
