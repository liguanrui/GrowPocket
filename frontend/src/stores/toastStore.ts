import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => number;
  removeToast: (id: number) => void;
  success: (message: string, duration?: number) => number;
  error: (message: string, duration?: number) => number;
  info: (message: string, duration?: number) => number;
  warning: (message: string, duration?: number) => number;
}

let toastIdCounter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = ++toastIdCounter;
    const newToast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    
    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
    
    return id;
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  success: (message, duration) => {
    return get().addToast({ type: 'success', message, duration });
  },

  error: (message, duration) => {
    return get().addToast({ type: 'error', message, duration });
  },

  info: (message, duration) => {
    return get().addToast({ type: 'info', message, duration });
  },

  warning: (message, duration) => {
    return get().addToast({ type: 'warning', message, duration });
  },
}));
