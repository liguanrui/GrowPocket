import { Flame, Trophy, Star, Award } from 'lucide-react';
import type { Badge } from '../types';

interface BadgeCardProps {
  badge: Badge;
  size?: 'small' | 'medium';
}

const iconMap: Record<string, React.ElementType> = {
  flame: Flame,
  trophy: Trophy,
  star: Star,
  award: Award,
};

export function BadgeCard({ badge, size = 'medium' }: BadgeCardProps) {
  const Icon = iconMap[badge.icon] || Star;
  const isEarned = !!badge.earnedAt;

  const sizeClasses = {
    small: {
      container: 'w-16 h-16',
      icon: 20,
      text: 'text-xs',
    },
    medium: {
      container: 'w-24 h-24',
      icon: 32,
      text: 'text-sm',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center gap-2 ${!isEarned ? 'opacity-40 grayscale' : ''}`}>
      <div className={`${sizes.container} rounded-2xl bg-gradient-to-br from-purple/20 to-primary/20 flex items-center justify-center relative`}>
        <Icon size={sizes.icon} className="text-primary" />
        {isEarned && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-success rounded-full flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
        )}
      </div>
      <div className="text-center">
        <div className={`font-semibold text-text-primary ${sizes.text}`}>{badge.name}</div>
        <div className="text-xs text-text-tertiary">{badge.description}</div>
      </div>
    </div>
  );
}
