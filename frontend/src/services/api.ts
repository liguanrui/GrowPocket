import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface ApiResponse<T = any> {
  code: number; // 0 = success, other = error
  message: string;
  data: T;
}

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加 JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    if (!config.headers) config.headers = {} as any;
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一处理错误
api.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse<any>;
    // 后端返回 code != 0 视为业务错误
    if (typeof data === 'object' && data !== null && 'code' in data && data.code !== 0) {
      return Promise.reject(new Error(data.message || '请求失败'));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 未授权：清除本地 token，跳转到登录页
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    const message =
      error.response?.data?.message || error.message || '网络请求失败，请稍后重试';
    return Promise.reject(new Error(message));
  },
);

// 统一的请求工具函数
export async function request<T = any>(config: AxiosRequestConfig): Promise<T> {
  const response = await api.request<ApiResponse<T>>(config);
  return (response.data.data as T) ?? ({} as T);
}

export default api;
