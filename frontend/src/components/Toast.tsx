import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type Toast } from '../stores/toastStore';
import { cn } from '../lib/utils';

const TOAST_ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const TOAST_STYLES = {
  success: 'bg-white/80 backdrop-blur-md text-success border border-success/20',
  error: 'bg-white/80 backdrop-blur-md text-danger border border-danger/20',
  info: 'bg-white/80 backdrop-blur-md text-primary border border-primary/20',
  warning: 'bg-white/80 backdrop-blur-md text-yellow-600 border border-yellow-500/20',
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((state) => state.removeToast);
  const Icon = TOAST_ICONS[toast.type];

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[280px] max-w-[90vw] animate-[slideIn_0.3s_ease-out]',
        TOAST_STYLES[toast.type]
      )}
      style={{
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <Icon size={20} className="flex-shrink-0" />
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 hover:bg-black/5 rounded-full p-0.5 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default ToastContainer;
