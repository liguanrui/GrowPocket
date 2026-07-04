import { Sparkles, TrendingUp, Flame } from 'lucide-react';

interface PointsDisplayProps {
  points: number;
  showTrend?: boolean;
  trend?: number;
  size?: 'small' | 'medium' | 'large';
}

export function PointsDisplay({ points, showTrend, trend = 0, size = 'medium' }: PointsDisplayProps) {
  const sizeClasses = {
    small: 'text-xl',
    medium: 'text-3xl',
    large: 'text-5xl',
  };

  const iconSizes = {
    small: 16,
    medium: 24,
    large: 32,
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 ${sizeClasses[size]} font-bold bg-gradient-to-r from-primary to-warm-light bg-clip-text text-transparent`}>
        <Sparkles size={iconSizes[size]} className="fill-primary" />
        <span>{points.toLocaleString()}</span>
        <span className="text-sm text-text-tertiary font-normal">积分</span>
      </div>
      
      {showTrend && trend !== 0 && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
          trend > 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
        }`}>
          {trend > 0 ? <TrendingUp size={14} /> : <Flame size={14} />}
          <span>{trend > 0 ? '+' : ''}{trend}</span>
        </div>
      )}
    </div>
  );
}
