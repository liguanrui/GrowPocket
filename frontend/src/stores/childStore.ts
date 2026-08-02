import { create } from 'zustand';
import * as childrenService from '../services/children';

export interface Child {
  id: number;
  family_id: number;
  familyId?: number;
  role: 'child';
  nickname: string;
  avatar?: string;
  gender?: 0 | 1;
  birthday?: string | null;
  grade?: number | null; // 1-6 年级（手动覆盖值，展示时优先 derived_grade）
  grade_overridden?: boolean;
  age?: number | null;
  hobbies?: string; // JSON 数组字符串
  balance: number;
  created_at?: string;
  updated_at?: string;
  // 后端派生字段（Birthday 为主驱动，滚动计算）
  derived_age?: number;
  derived_grade?: number;
  is_birthday_today?: boolean;
}

interface ChildState {
  children: Child[];
  currentChildId: number | null;
  loading: boolean;
  fetchChildren: () => Promise<void>;
  addChild: (input: {
    nickname: string;
    gender?: 0 | 1;
    birthday?: string;
    grade?: number;
    grade_overridden?: boolean;
    age?: number;
    hobbies?: string;
  }) => Promise<Child>;
  updateChild: (
    id: number,
    input: Partial<{
      nickname: string;
      gender?: 0 | 1;
      birthday?: string;
      avatar?: string;
      grade?: number;
      grade_overridden?: boolean;
      age?: number;
      hobbies?: string;
    }>,
  ) => Promise<void>;
  removeChild: (id: number) => Promise<void>;
  setCurrentChildId: (id: number | null) => void;
  getCurrentChild: () => Child | null;
  updateBalance: (childId: number, newBalance: number) => void;
  /** 内部并发锁：同一时刻只允许一个 fetchChildren 飞行中 */
  _fetchingPromise: Promise<void> | null;
}

function getInitialChildId(): number | null {
  const raw = localStorage.getItem('currentChildId');
  if (raw) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) return n;
  }
  return null;
}

export const useChildStore = create<ChildState>((set, get) => ({
  children: [],
  currentChildId: getInitialChildId(),
  loading: false,
  _fetchingPromise: null,

  async fetchChildren() {
    // 并发锁：调用方多次触发 fetchChildren 时，只真正发一次网络请求
    // （防止 GrowthStoryPage/GrowthPage 等多组件同时 children.length===0 时并发多次 setState 引发无限重渲染）
    const state0 = get();
    if (state0.loading || state0._fetchingPromise) {
      return state0._fetchingPromise || Promise.resolve();
    }
    set({ loading: true });
    const promise = (async () => {
      try {
        const list = await childrenService.getChildren();
        const state = get();
        const selectedExists =
          state.currentChildId !== null && list.some((c) => c.id === state.currentChildId);
        // 原子更新：children / loading / currentChildId 一次 set，避免多次触发组件 rerender
        const next: Partial<ChildState> = { children: list, loading: false };
        if (!selectedExists && list.length > 0 && state.currentChildId !== list[0].id) {
          next.currentChildId = list[0].id;
          localStorage.setItem('currentChildId', String(list[0].id));
        }
        set(next as ChildState);
      } catch (e) {
        set({ loading: false });
        throw e;
      } finally {
        // 调用链结束前必须清除并发锁
        const st = get();
        if (st._fetchingPromise === promise) {
          set({ _fetchingPromise: null } as Partial<ChildState> as ChildState);
        }
      }
    })();
    set({ _fetchingPromise: promise } as Partial<ChildState> as ChildState);
    return promise;
  },

  async addChild(input) {
    const child = await childrenService.addChild(input);
    set((state) => ({ children: [...state.children, child] }));
    if (get().currentChildId === null) {
      get().setCurrentChildId(child.id);
    }
    return child;
  },

  async updateChild(id, input) {
    await childrenService.updateChild(id, input);
    set((state) => ({
      children: state.children.map((c) => (c.id === id ? { ...c, ...input } : c)),
    }));
  },

  async removeChild(id) {
    await childrenService.deleteChild(id);
    set((state) => ({ children: state.children.filter((c) => c.id !== id) }));
    if (get().currentChildId === id) {
      const remaining = get().children;
      get().setCurrentChildId(remaining.length > 0 ? remaining[0].id : null);
    }
  },

  setCurrentChildId(id) {
    if (id !== null) {
      localStorage.setItem('currentChildId', String(id));
    } else {
      localStorage.removeItem('currentChildId');
    }
    set({ currentChildId: id });
  },

  getCurrentChild() {
    const state = get();
    return state.children.find((c) => c.id === state.currentChildId) || state.children[0] || null;
  },

  updateBalance(childId, newBalance) {
    set((state) => ({
      children: state.children.map((c) => (c.id === childId ? { ...c, balance: newBalance } : c)),
    }));
  },
}));
