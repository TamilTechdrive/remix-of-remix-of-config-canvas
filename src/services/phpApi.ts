import axios from 'axios';

// PHP Backend API - query-param based routing
// All requests go to: index.php?rtype=xxx&action=yyy&id=zzz
const PHP_BASE_URL = import.meta.env.VITE_PHP_API_URL || 'http://localhost/phpbackend2';
const PHP_ENTRY = `${PHP_BASE_URL}/index.php`;

const phpApi = axios.create({
  baseURL: PHP_ENTRY,
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

// ===== HELPER: build query string =====
function qs(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const key in params) {
    if (params[key] !== undefined && params[key] !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key]!)}`);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

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
    const res = await phpApi.post(qs({ rtype: 'auth', action: 'login' }), data);
    if (res.data.success || res.data.accessToken) {
      const token = res.data.data?.accessToken || res.data.accessToken;
      setPhpAccessToken(token);
    }
    return res;
  },

  register: async (data: { email: string; username: string; password: string; displayName?: string }) => {
    const res = await phpApi.post(qs({ rtype: 'auth', action: 'register' }), data);
    if (res.data.success || res.data.accessToken) {
      const token = res.data.data?.accessToken || res.data.accessToken;
      setPhpAccessToken(token);
    }
    return res;
  },

  logout: async () => {
    const res = await phpApi.post(qs({ rtype: 'auth', action: 'logout' }));
    setPhpAccessToken(null);
    return res;
  },

  me: () => phpApi.get(qs({ rtype: 'auth', action: 'me' })),
};

// ===== PROJECT API =====
export const phpProjectApi = {
  list: () => phpApi.get(qs({ rtype: 'projects', action: 'list' })),

  get: (id: string) => phpApi.get(qs({ rtype: 'projects', action: 'get', id })),

  create: (data: { name: string; description?: string; tags?: string[] }) =>
    phpApi.post(qs({ rtype: 'projects', action: 'create' }), data),

  update: (id: string, data: { name?: string; description?: string; tags?: string[]; status?: string }) =>
    phpApi.post(qs({ rtype: 'projects', action: 'update', id }), data),

  delete: (id: string) =>
    phpApi.post(qs({ rtype: 'projects', action: 'delete', id })),

  // STB Models
  createSTBModel: (projectId: string, data: { name: string; description?: string; chipset?: string }) =>
    phpApi.post(qs({ rtype: 'stb', action: 'create', pid: projectId }), data),

  updateSTBModel: (modelId: string, data: { name?: string; description?: string; chipset?: string }) =>
    phpApi.post(qs({ rtype: 'stb', action: 'update', id: modelId }), data),

  deleteSTBModel: (modelId: string) =>
    phpApi.post(qs({ rtype: 'stb', action: 'delete', id: modelId })),

  // Builds
  createBuild: (modelId: string, data: { name: string; description?: string; version?: string }) =>
    phpApi.post(qs({ rtype: 'builds', action: 'create', pid: modelId }), data),

  updateBuild: (buildId: string, data: { name?: string; description?: string; version?: string; status?: string }) =>
    phpApi.post(qs({ rtype: 'builds', action: 'update', id: buildId }), data),

  deleteBuild: (buildId: string) =>
    phpApi.post(qs({ rtype: 'builds', action: 'delete', id: buildId })),
};

// ===== PARSER API =====
export const phpParserApi = {
  seed: (data?: { jsonData?: any; sessionName?: string }) =>
    phpApi.post(qs({ rtype: 'parser', action: 'seed' }), data || {}),

  listSessions: () => phpApi.get(qs({ rtype: 'parser', action: 'sessions' })),

  getSession: (id: string) => phpApi.get(qs({ rtype: 'parser', action: 'session_get', id })),

  deleteSession: (id: string) =>
    phpApi.post(qs({ rtype: 'parser', action: 'session_delete', id })),
};

// ===== FEATURES API =====
export const phpFeaturesApi = {
  list: (params?: { projectId?: string; buildId?: string; module?: string }) =>
    phpApi.get(qs({ rtype: 'features', action: 'list', ...params })),

  create: (data: { projectId?: string; buildId?: string; module?: string; name: string; enabled?: boolean; details?: Record<string, any> }) =>
    phpApi.post(qs({ rtype: 'features', action: 'create' }), data),

  update: (id: string, data: { name?: string; enabled?: boolean; details?: Record<string, any>; module?: string }) =>
    phpApi.post(qs({ rtype: 'features', action: 'update', id }), data),

  delete: (id: string) =>
    phpApi.post(qs({ rtype: 'features', action: 'delete', id })),
};

// ===== HEALTH API =====
export const phpHealthApi = {
  check: () => phpApi.get(qs({ rtype: 'health' })),
};

// ===== CSRF API =====
export const phpCsrfApi = {
  getToken: () => phpApi.get(qs({ rtype: 'csrf', action: 'token' })),
  verify: (token: string) => phpApi.post(qs({ rtype: 'csrf', action: 'verify' }), { token }),
};

export { extractData };
export default phpApi;
