import axios from 'axios';

// PHP Backend API - separate from Node.js API (api.ts)
const PHP_BASE_URL = import.meta.env.VITE_PHP_API_URL || 'http://localhost/phpbackend2';

const phpApi = axios.create({
  baseURL: PHP_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ===== TOKEN MANAGEMENT =====
let phpAccessToken: string | null = null;

export function setPhpAccessToken(token: string | null) {
  phpAccessToken = token;
  if (token) localStorage.setItem('php_cf_token', token);
  else localStorage.removeItem('php_cf_token');
}

export function getPhpAccessToken(): string | null {
  if (!phpAccessToken) phpAccessToken = localStorage.getItem('php_cf_token');
  return phpAccessToken;
}

// ===== REQUEST INTERCEPTOR =====
phpApi.interceptors.request.use((config) => {
  const token = getPhpAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ===== RESPONSE INTERCEPTOR =====
phpApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setPhpAccessToken(null);
    }
    return Promise.reject(error);
  }
);

// ===== HELPER: extract data from PHP response wrapper =====
function extractData<T = any>(response: { data: { success: boolean; data?: T; error?: string } }): T {
  if (!response.data.success) {
    throw new Error(response.data.error || 'Request failed');
  }
  return response.data.data as T;
}

// ===== AUTH API =====
export const phpAuthApi = {
  login: async (data: { email: string; password: string }) => {
    const res = await phpApi.post('/api/auth/login', data);
    if (res.data.success || res.data.accessToken) {
      const token = res.data.data?.accessToken || res.data.accessToken;
      setPhpAccessToken(token);
    }
    return res;
  },

  register: async (data: { email: string; username: string; password: string; displayName?: string }) => {
    const res = await phpApi.post('/api/auth/register', data);
    if (res.data.success || res.data.accessToken) {
      const token = res.data.data?.accessToken || res.data.accessToken;
      setPhpAccessToken(token);
    }
    return res;
  },

  logout: async () => {
    const res = await phpApi.post('/api/auth/logout');
    setPhpAccessToken(null);
    return res;
  },

  me: () => phpApi.get('/api/auth/me'),
};

// ===== PROJECT API =====
export const phpProjectApi = {
  list: () => phpApi.get('/api/projects'),
  get: (id: string) => phpApi.get(`/api/projects/${id}`),
  create: (data: { name: string; description?: string; tags?: string[] }) =>
    phpApi.post('/api/projects', data),
  update: (id: string, data: { name?: string; description?: string; tags?: string[]; status?: string }) =>
    phpApi.put(`/api/projects/${id}`, data),
  delete: (id: string) => phpApi.delete(`/api/projects/${id}`),

  // STB Models
  createSTBModel: (projectId: string, data: { name: string; description?: string; chipset?: string }) =>
    phpApi.post(`/api/projects/${projectId}/stb-models`, data),
  updateSTBModel: (modelId: string, data: { name?: string; description?: string; chipset?: string }) =>
    phpApi.put(`/api/projects/stb-models/${modelId}`, data),
  deleteSTBModel: (modelId: string) =>
    phpApi.delete(`/api/projects/stb-models/${modelId}`),

  // Builds
  createBuild: (modelId: string, data: { name: string; description?: string; version?: string }) =>
    phpApi.post(`/api/projects/stb-models/${modelId}/builds`, data),
  updateBuild: (buildId: string, data: { name?: string; description?: string; version?: string; status?: string }) =>
    phpApi.put(`/api/projects/builds/${buildId}`, data),
  deleteBuild: (buildId: string) =>
    phpApi.delete(`/api/projects/builds/${buildId}`),
};

// ===== PARSER API =====
export const phpParserApi = {
  seed: (data?: { jsonData?: any; sessionName?: string }) =>
    phpApi.post('/api/parser/seed', data || {}),
  listSessions: () => phpApi.get('/api/parser/sessions'),
  getSession: (id: string) => phpApi.get(`/api/parser/sessions/${id}`),
  deleteSession: (id: string) => phpApi.delete(`/api/parser/sessions/${id}`),
};

// ===== FEATURES API =====
export const phpFeaturesApi = {
  list: (params?: { projectId?: string; buildId?: string; module?: string }) =>
    phpApi.get('/api/features', { params }),
  create: (data: { projectId?: string; buildId?: string; module?: string; name: string; enabled?: boolean; details?: Record<string, any> }) =>
    phpApi.post('/api/features', data),
  update: (id: string, data: { name?: string; enabled?: boolean; details?: Record<string, any>; module?: string }) =>
    phpApi.put(`/api/features/${id}`, data),
};

// ===== HEALTH API =====
export const phpHealthApi = {
  check: () => phpApi.get('/health'),
};

export { extractData };
export default phpApi;
