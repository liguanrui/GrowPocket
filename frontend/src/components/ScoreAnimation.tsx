import { useEffect, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

interface ScoreAnimationProps {
  amount: number;
  type: 'add' | 'deduct';
  onComplete?: () => void;
  className?: string;
}

export function ScoreAnimation({ amount, type, onComplete, className }: ScoreAnimationProps) {
  const [visible, setVisible] = useState(false);
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer1 = setTimeout(() => setFloating(true), 50);
    const timer2 = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  if (!visible && !floating) return null;

  const isAdd = type === 'add';

  return (
    <div
      className={cn(
        'fixed inset-0 pointer-events-none flex items-center justify-center z-50 transition-opacity duration-500',
        visible ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 px-6 py-4 rounded-2xl font-bold text-3xl shadow-2xl transition-transform duration-1000 ease-out',
          isAdd ? 'bg-success text-white' : 'bg-danger text-white',
          floating ? '-translate-y-20 scale-110' : 'translate-y-0 scale-100'
        )}
        style={{
          animation: 'scorePop 0.5s ease-out',
        }}
      >
        {isAdd ? <Plus size={32} /> : <Minus size={32} />}
        <span>{amount}</span>
        <span className="text-lg opacity-80">积分</span>
      </div>
      <style>{`
        @keyframes scorePop {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default ScoreAnimation;
