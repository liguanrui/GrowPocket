import { create } from 'zustand';
import * as authService from '../services/auth';

interface AuthUser {
  id: number;
  nickname: string;
  role: 'parent' | 'child';
}

interface AuthFamily {
  id: number;
  name: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  family: AuthFamily | null;
  isLoggedIn: boolean;
  login: (nickname: string, password: string) => Promise<void>;
  register: (nickname: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
}

function loadFromStorage() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('currentUser');
  const familyStr = localStorage.getItem('currentFamily');
  return {
    token,
    user: userStr ? (JSON.parse(userStr) as AuthUser) : null,
    family: familyStr ? (JSON.parse(familyStr) as AuthFamily) : null,
  };
}

export const useAuthStore = create<AuthState>((set) => {
  const initial = loadFromStorage();
  return {
    token: initial.token,
    user: initial.user,
    family: initial.family,
    isLoggedIn: !!initial.token,

    async login(nickname: string, password: string) {
      const result = await authService.login(nickname, password);
      localStorage.setItem('token', result.token);
      localStorage.setItem('currentUser', JSON.stringify(result.user));
      localStorage.setItem('currentFamily', JSON.stringify(result.family));
      set({
        token: result.token,
        user: result.user,
        family: result.family,
        isLoggedIn: true,
      });
    },

    async register(nickname: string, password: string) {
      const result = await authService.register(nickname, password);
      localStorage.setItem('token', result.token);
      localStorage.setItem('currentUser', JSON.stringify(result.user));
      localStorage.setItem('currentFamily', JSON.stringify(result.family));
      set({
        token: result.token,
        user: result.user,
        family: result.family,
        isLoggedIn: true,
      });
    },

    logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentFamily');
      localStorage.removeItem('currentChildId');
      set({ token: null, user: null, family: null, isLoggedIn: false });
    },

    setUser(user: AuthUser) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      set({ user });
    },
  };
});
