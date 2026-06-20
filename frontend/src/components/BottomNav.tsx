import { Home, ListChecks, Store, Trophy, Users } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'tasks', label: '任务', icon: ListChecks },
  { id: 'mall', label: '商城', icon: Store },
  { id: 'growth', label: '成长', icon: Trophy },
  { id: 'family', label: '家庭', icon: Users },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 z-50">
      <div className="max-w-lg mx-auto flex justify-around items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'text-primary' 
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-primary/10' 
                  : ''
              }`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-primary' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
