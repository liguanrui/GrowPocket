import { Bot, ListTodo, Trophy, Globe, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: 'assistant', label: '助手', icon: Bot },
  { id: 'home', label: '任务', icon: ListTodo },
  { id: 'growth', label: '成长', icon: Trophy },
  { id: 'community', label: '社区', icon: Globe },
  { id: 'settings', label: '设置', icon: Settings },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md shadow-[0_-1px_12px_rgba(0,0,0,0.08)] px-4 py-2 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex justify-around items-center relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-200 active:scale-95 transition-transform ${
                isActive
                  ? 'text-primary'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary/10 scale-110'
                  : 'scale-100'
              }`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-primary' : ''}`}>
                {item.label}
              </span>
              <div
                className={`h-[2px] rounded-full bg-primary transition-all duration-300 ease-out ${
                  isActive ? 'w-5 opacity-100' : 'w-0 opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
