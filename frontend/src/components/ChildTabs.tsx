import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Child } from '../stores/childStore';

export function ChildTabs({
  children,
  selectedId,
  onSelect,
}: {
  children: Child[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative">
      {children.length > 4 && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children.map((child) => {
          const isActive = child.id === selectedId;
          return (
            <button
              key={child.id}
              onClick={() => onSelect(child.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isActive ? 'bg-white text-primary shadow-lg' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive ? 'bg-primary/10 text-primary' : 'bg-white/20 text-white'
                }`}
              >
                {child.nickname.charAt(0)}
              </div>
              <span>{child.nickname}</span>
            </button>
          );
        })}
      </div>
      {children.length > 4 && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}
