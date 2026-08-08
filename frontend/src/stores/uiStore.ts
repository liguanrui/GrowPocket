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
  /** 任务看板待切换的状态 Tab：1进行中 2待验收 3已完成 4已拒绝，'all' 全部 */
  pendingTaskStatus: 'all' | 1 | 2 | 3 | 4 | null;

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
  setPendingTaskStatus: (status: 'all' | 1 | 2 | 3 | 4 | null) => void;
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
  pendingTaskStatus: null,

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
  setPendingTaskStatus: (status) => set({ pendingTaskStatus: status }),
}));
