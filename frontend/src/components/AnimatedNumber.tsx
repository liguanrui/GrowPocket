import { useState, useEffect, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  startFrom?: number | null;
  className?: string;
  duration?: number;
  onComplete?: () => void;
}

export function AnimatedNumberComponent({ value, startFrom, className, duration = 1200, onComplete }: AnimatedNumberProps) {
  const initialValue = startFrom != null ? startFrom : value;
  const [displayValue, setDisplayValue] = useState(initialValue);
  const rafRef = useRef<number | null>(null);
  const animatingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (displayValue === value) {
      onCompleteRef.current?.();
      return;
    }
    if (animatingRef.current) return;

    animatingRef.current = true;
    const startValue = displayValue;
    const endValue = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(startValue + (endValue - startValue) * easeOutQuart);
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        animatingRef.current = false;
        onCompleteRef.current?.();
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      animatingRef.current = false;
    };
  }, [value, duration]);

  return <span className={className}>{displayValue.toLocaleString()}</span>;
}

export default AnimatedNumberComponent;