import { afterEach, beforeEach, vi } from 'vitest';

// happy-dom 没有 localStorage，手动 polyfill
const localStorageData: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => localStorageData[k] ?? null,
    setItem: (k: string, v: string) => { localStorageData[k] = v; },
    removeItem: (k: string) => { delete localStorageData[k]; },
    clear: () => { Object.keys(localStorageData).forEach((k) => delete localStorageData[k]); },
    get length() { return Object.keys(localStorageData).length; },
    key: (i: number) => Object.keys(localStorageData)[i] ?? null,
  },
});

// HoF：返回工厂函数，使 vi.fn() 在 beforeEach 时执行（而非 mock 注册时）
export const mockRequestFn = () => vi.fn();
export const mockGetFn = () => vi.fn();
export const mockPostFn = () => vi.fn();
export const mockPutFn = () => vi.fn();
export const mockDeleteFn = () => vi.fn();
export const mockRequestInterceptorsUse = () => vi.fn((cb: Function) => cb);
export const mockResponseInterceptorsUse = () =>
  vi.fn((ok: Function, _err: Function) => [ok, _err]);

beforeEach(() => {
  vi.clearAllMocks();
  // 重置 localStorage
  Object.keys(localStorageData).forEach((k) => delete localStorageData[k]);
});

afterEach(() => {
  vi.restoreAllMocks();
});
