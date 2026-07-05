import { create } from 'zustand';

interface UIState {
  newTaskId: number | null;
  highlightTaskId: number | null;
  scoreAnimation: { childId: number; amount: number; type: 'add' | 'deduct' } | null;
  previousBalance: number | null;
  needRefreshTasks: boolean;
  needRefreshScore: boolean;
  needRefreshTemplates: boolean;
  needRefreshAchievements: boolean;
  needRefreshItems: boolean;

  setNewTaskId: (id: number | null) => void;
  setHighlightTaskId: (id: number | null) => void;
  triggerScoreAnimation: (childId: number, amount: number, type: 'add' | 'deduct') => void;
  clearScoreAnimation: () => void;
  setPreviousBalance: (balance: number | null) => void;
  setNeedRefreshTasks: (need: boolean) => void;
  setNeedRefreshScore: (need: boolean) => void;
  setNeedRefreshTemplates: (need: boolean) => void;
  setNeedRefreshAchievements: (need: boolean) => void;
  setNeedRefreshItems: (need: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  newTaskId: null,
  highlightTaskId: null,
  scoreAnimation: null,
  previousBalance: null,
  needRefreshTasks: false,
  needRefreshScore: false,
  needRefreshTemplates: false,
  needRefreshAchievements: false,
  needRefreshItems: false,

  setNewTaskId: (id) => set({ newTaskId: id, highlightTaskId: id }),
  setHighlightTaskId: (id) => set({ highlightTaskId: id }),
  triggerScoreAnimation: (childId, amount, type) => set({ scoreAnimation: { childId, amount, type } }),
  clearScoreAnimation: () => set({ scoreAnimation: null }),
  setPreviousBalance: (balance) => set({ previousBalance: balance }),
  setNeedRefreshTasks: (need) => set({ needRefreshTasks: need }),
  setNeedRefreshScore: (need) => set({ needRefreshScore: need }),
  setNeedRefreshTemplates: (need) => set({ needRefreshTemplates: need }),
  setNeedRefreshAchievements: (need) => set({ needRefreshAchievements: need }),
  setNeedRefreshItems: (need) => set({ needRefreshItems: need }),
}));
