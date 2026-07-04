import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils'

interface EmptyProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export default function Empty({ title = '暂无内容', description, icon, className }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
        {icon || <Inbox size={28} className="text-primary/30" />}
      </div>
      <p className="text-text-primary font-medium">{title}</p>
      {description && (
        <p className="text-text-tertiary text-sm mt-1.5 text-center max-w-[200px]">{description}</p>
      )}
    </div>
  );
}
