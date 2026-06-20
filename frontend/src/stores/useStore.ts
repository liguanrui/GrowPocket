import { create } from 'zustand';
import type { Family, Member, Task, Reward, Message, Badge, PointsRecord } from '../types';

interface AppState {
  // 当前用户
  currentUser: Member | null;
  setCurrentUser: (user: Member | null) => void;
  
  // 当前家庭
  currentFamily: Family | null;
  setCurrentFamily: (family: Family | null) => void;
  
  // 家庭成员列表
  familyMembers: Member[];
  setFamilyMembers: (members: Member[]) => void;
  
  // 任务列表
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  
  // 商品列表
  rewards: Reward[];
  setRewards: (rewards: Reward[]) => void;
  
  // 消息列表
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  
  // 徽章列表
  badges: Badge[];
  setBadges: (badges: Badge[]) => void;
  
  // 积分记录
  pointsRecords: PointsRecord[];
  setPointsRecords: (records: PointsRecord[]) => void;
  
  // 用户视角切换
  viewMode: 'parent' | 'child';
  setViewMode: (mode: 'parent' | 'child') => void;
  
  // 选中的孩子（用于多孩切换）
  selectedChildId: string | null;
  setSelectedChildId: (id: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  
  currentFamily: null,
  setCurrentFamily: (family) => set({ currentFamily: family }),
  
  familyMembers: [],
  setFamilyMembers: (members) => set({ familyMembers: members }),
  
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t)
  })),
  
  rewards: [],
  setRewards: (rewards) => set({ rewards }),
  
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [message, ...state.messages] })),
  
  badges: [],
  setBadges: (badges) => set({ badges }),
  
  pointsRecords: [],
  setPointsRecords: (records) => set({ pointsRecords: records }),
  
  viewMode: 'parent',
  setViewMode: (mode) => set({ viewMode: mode }),
  
  selectedChildId: null,
  setSelectedChildId: (id) => set({ selectedChildId: id }),
}));
