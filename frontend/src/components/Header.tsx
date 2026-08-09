import { Bell, ChevronRight, Users, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { children as mockChildren, currentFamily } from '../data/mockData';
import type { Child } from '../types';

interface FamilySwitcherProps {
  familyName: string;
  memberCount: number;
  onSelectFamily?: () => void;
}

export function FamilySwitcher({ familyName, memberCount, onSelectFamily }: FamilySwitcherProps) {
  return (
    <button
      onClick={onSelectFamily}
      className="flex items-center justify-between w-full bg-white/15 backdrop-blur rounded-2xl px-4 py-3 text-left hover:bg-white/20 transition-colors"
    >
      <div>
        <div className="text-white/80 text-xs">家庭</div>
        <div className="text-white font-semibold text-lg">{familyName}</div>
        <div className="text-white/60 text-xs mt-0.5">{memberCount} 位成员</div>
      </div>
      <ChevronRight size={18} className="text-white/60" />
    </button>
  );
}

// 孩子切换 Tab —— 核心组件
interface ChildSwitcherProps {
  selectedChildId: string;
  onSelect: (child: Child) => void;
  onAdd?: () => void;
  compact?: boolean;
}

export function ChildSwitcher({ selectedChildId, onSelect, onAdd, compact }: ChildSwitcherProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1.5">
      {mockChildren.map((child) => {
        const isActive = child.id === selectedChildId;
        return (
          <button
            key={child.id}
            onClick={() => onSelect(child)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl whitespace-nowrap transition-all flex-shrink-0 ${
              isActive
                ? 'bg-primary text-white shadow-md shadow-primary/30'
                : compact
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'bg-card text-text-secondary hover:bg-white'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full overflow-hidden flex-shrink-0 ${
                isActive ? 'bg-white/20' : 'bg-gray-100'
              }`}
            >
              {child.avatar ? (
                <img src={child.avatar} alt={child.nickname} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">
                  {child.nickname.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="font-medium text-sm">{child.nickname}</span>
              <span className={`text-xs ${isActive ? 'text-white/80' : 'text-text-tertiary'}`}>
                {child.balance ?? 0} 积分
              </span>
            </div>
          </button>
        );
      })}
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-dashed border-gray-300 text-text-tertiary hover:border-primary hover:text-primary transition-colors flex-shrink-0"
        >
          <Users size={16} />
          <span className="text-sm font-medium">添加孩子</span>
        </button>
      )}
    </div>
  );
}

// 顶部通知入口
export function NotificationHeader({ unreadCount }: { unreadCount: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Bell size={20} className="text-white" />
        </div>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-danger text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
    </div>
  );
}

// 复用：首页顶部欢迎
function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary">{title}</h1>
      {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
    </div>
  );
}

export function BackHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary to-amber-500 pt-3 pb-4 px-4 rounded-b-2xl">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            aria-label="返回"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-bold text-white truncate">{title}</h1>
        </div>
      </div>
    </div>
  );
}

export default Header;
