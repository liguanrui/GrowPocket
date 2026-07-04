import { Gift, Clock } from 'lucide-react';
import type { Reward } from '../types';

interface RewardCardProps {
  reward: Reward;
  onClick?: () => void;
  onExchange?: () => void;
  disabled?: boolean;
}

export function RewardCard({ reward, onClick, onExchange, disabled }: RewardCardProps) {
  const getCategoryColor = (category: Reward['category']) => {
    switch (category) {
      case 'physical':
        return 'bg-primary/10 text-primary';
      case 'experience':
        return 'bg-success/10 text-success';
      case 'privilege':
        return 'bg-purple/10 text-purple';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  const getCategoryText = (category: Reward['category']) => {
    switch (category) {
      case 'physical':
        return '物质奖励';
      case 'experience':
        return '体验奖励';
      case 'privilege':
        return '特权奖励';
      default:
        return category;
    }
  };

  return (
    <div 
      onClick={onClick}
      className="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border border-gray-50"
    >
      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
        <img 
          src={reward.image} 
          alt={reward.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(reward.category)}`}>
            {getCategoryText(reward.category)}
          </span>
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 text-white px-2 py-1 rounded-lg text-xs">
          <Gift size={12} />
          <span>剩余 {reward.stock} 件</span>
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-text-primary mb-1 truncate">{reward.title}</h3>
        <p className="text-xs text-text-tertiary line-clamp-2 mb-3">{reward.description}</p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-warm-dark bg-clip-text text-transparent">{reward.pointsRequired}</span>
            <span className="text-xs text-text-tertiary">积分</span>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onExchange?.(); }}
            disabled={disabled}
            className={`py-1.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
              disabled 
                ? 'bg-gray-100 text-text-tertiary cursor-not-allowed' 
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            兑换
          </button>
        </div>
      </div>
    </div>
  );
}
