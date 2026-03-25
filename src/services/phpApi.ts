import axios from 'axios';
import { getApiConfig, isSecurityEnabled } from './apiConfig';

// PHP Backend API - query-param based routing
// All requests go to: index.php?rtype=xxx&action=yyy&id=zzz

function getPhpEntry() {
  return `${getApiConfig().phpBaseUrl}/index.php`;
}

const phpAxios = axios.create({
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
phpAxios.interceptors.request.use((config) => {
  // Set baseURL dynamically
  config.baseURL = getPhpEntry();
  
  // Only attach token if security is enabled
  if (isSecurityEnabled()) {
    const token = getPhpAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ===== RESPONSE INTERCEPTOR =====
phpAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && isSecurityEnabled()) {
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

// ===== HELPER: extract data from PHP response =====
// PHP returns: { success: true, data: {...} } or { success: true, accessToken: "...", user: {...} }
export function extractPhpData<T = any>(response: { data: any }): T {
  const d = response.data;
  // If response has { success, data } wrapper
  if (d && typeof d === 'object' && 'success' in d) {
    if (!d.success) throw new Error(d.error || 'Request failed');
    if ('data' in d && d.data !== undefined) return d.data as T;
    // Some endpoints return data at top level (e.g. register returns accessToken at top)
    return d as T;
  }
  return d as T;
}

// ===== AUTH API =====
export const phpAuthApi = {
  login: async (data: { email: string; password: string }) => {
    const res = await phpAxios.post(qs({ rtype: 'auth', action: 'login' }), data);
    const d = res.data;
    // Token could be at d.data.accessToken or d.accessToken
    const token = d?.data?.accessToken || d?.accessToken;
    if (token && isSecurityEnabled()) {
      setPhpAccessToken(token);
    }
    // Normalize response to match node format: { accessToken, user }
    const user = d?.data?.user || d?.user;
    return { data: { accessToken: token, user } };
  },

  register: async (data: { email: string; username: string; password: string; displayName?: string }) => {
    const res = await phpAxios.post(qs({ rtype: 'auth', action: 'register' }), data);
    const d = res.data;
    const token = d?.data?.accessToken || d?.accessToken;
    if (token && isSecurityEnabled()) {
      setPhpAccessToken(token);
    }
    const user = d?.data?.user || d?.user;
    return { data: { accessToken: token, user } };
  },

  logout: async () => {
    const res = await phpAxios.post(qs({ rtype: 'auth', action: 'logout' }));
    setPhpAccessToken(null);
    return res;
  },

  me: async () => {
    const res = await phpAxios.get(qs({ rtype: 'auth', action: 'me' }));
    // Normalize: node returns data at res.data directly, PHP wraps in { success, data }
    const d = extractPhpData(res);
    return { data: d };
  },
};

// ===== PROJECT API =====
export const phpProjectApi = {
  list: async () => {
    const res = await phpAxios.get(qs({ rtype: 'projects', action: 'list' }));
    return { data: extractPhpData(res) };
  },
  get: async (id: string) => {
    const res = await phpAxios.get(qs({ rtype: 'projects', action: 'get', id }));
    return { data: extractPhpData(res) };
  },
  create: async (data: { name: string; description?: string; tags?: string[] }) => {
    const res = await phpAxios.post(qs({ rtype: 'projects', action: 'create' }), data);
    return { data: extractPhpData(res) };
  },
  update: async (id: string, data: { name?: string; description?: string; tags?: string[]; status?: string }) => {
    const res = await phpAxios.post(qs({ rtype: 'projects', action: 'update', id }), data);
    return { data: extractPhpData(res) };
  },
  delete: async (id: string) => {
    const res = await phpAxios.post(qs({ rtype: 'projects', action: 'delete', id }));
    return { data: extractPhpData(res) };
  },

  // STB Models
  listSTBModels: async (projectId: string) => {
    const res = await phpAxios.get(qs({ rtype: 'stb', action: 'list', pid: projectId }));
    return { data: extractPhpData(res) };
  },
  createSTBModel: async (projectId: string, data: { name: string; description?: string; chipset?: string }) => {
    const res = await phpAxios.post(qs({ rtype: 'stb', action: 'create', pid: projectId }), data);
    return { data: extractPhpData(res) };
  },
  updateSTBModel: async (modelId: string, data: { name?: string; description?: string; chipset?: string }) => {
    const res = await phpAxios.post(qs({ rtype: 'stb', action: 'update', id: modelId }), data);
    return { data: extractPhpData(res) };
  },
  deleteSTBModel: async (modelId: string) => {
    const res = await phpAxios.post(qs({ rtype: 'stb', action: 'delete', id: modelId }));
    return { data: extractPhpData(res) };
  },

  // Builds
  listBuilds: async (modelId: string) => {
    const res = await phpAxios.get(qs({ rtype: 'builds', action: 'list', pid: modelId }));
    return { data: extractPhpData(res) };
  },
  createBuild: async (modelId: string, data: { name: string; description?: string; version?: string }) => {
    const res = await phpAxios.post(qs({ rtype: 'builds', action: 'create', pid: modelId }), data);
    return { data: extractPhpData(res) };
  },
  updateBuild: async (buildId: string, data: { name?: string; description?: string; version?: string; status?: string }) => {
    const res = await phpAxios.post(qs({ rtype: 'builds', action: 'update', id: buildId }), data);
    return { data: extractPhpData(res) };
  },
  deleteBuild: async (buildId: string) => {
    const res = await phpAxios.post(qs({ rtype: 'builds', action: 'delete', id: buildId }));
    return { data: extractPhpData(res) };
  },

  // Parser config
  saveParserConfig: async (buildId: string, data: { parserSessionId?: string; configName: string; nodes: any[]; edges: any[] }) => {
    const res = await phpAxios.post(qs({ rtype: 'projects', action: 'save_parser_config', id: buildId }), data);
    return { data: extractPhpData(res) };
  },
  loadConfig: async (configId: string) => {
    const res = await phpAxios.get(qs({ rtype: 'projects', action: 'load_config', id: configId }));
    return { data: extractPhpData(res) };
  },
  listBuildConfigs: async (buildId: string) => {
    const res = await phpAxios.get(qs({ rtype: 'projects', action: 'list_configs', id: buildId }));
    return { data: extractPhpData(res) };
  },
};

// ===== PARSER API =====
export const phpParserApi = {
  seed: async (data?: { jsonData?: any; sessionName?: string; projectId?: string; buildId?: string; moduleId?: string }) => {
    const res = await phpAxios.post(qs({ rtype: 'parser', action: 'seed' }), data || {});
    return { data: extractPhpData(res) };
  },
  listSessions: async () => {
    const res = await phpAxios.get(qs({ rtype: 'parser', action: 'sessions' }));
    return { data: extractPhpData(res) };
  },
  getSession: async (id: string) => {
    const res = await phpAxios.get(qs({ rtype: 'parser', action: 'session_get', id }));
    return { data: extractPhpData(res) };
  },
  deleteSession: async (id: string) => {
    const res = await phpAxios.post(qs({ rtype: 'parser', action: 'session_delete', id }));
    return { data: extractPhpData(res) };
  },
  exportCSV: async (id: string, sheet: string) => {
    const res = await phpAxios.get(qs({ rtype: 'parser', action: 'export', id, sheet }), { responseType: 'blob' });
    return res;
  },
};

// ===== FEATURES API =====
export const phpFeaturesApi = {
  list: async (params?: { projectId?: string; buildId?: string; module?: string }) => {
    const res = await phpAxios.get(qs({ rtype: 'features', action: 'list', ...params }));
    return { data: extractPhpData(res) };
  },
  create: async (data: { projectId?: string; buildId?: string; module?: string; name: string; enabled?: boolean; details?: Record<string, any> }) => {
    const res = await phpAxios.post(qs({ rtype: 'features', action: 'create' }), data);
    return { data: extractPhpData(res) };
  },
  update: async (id: string, data: { name?: string; enabled?: boolean; details?: Record<string, any>; module?: string }) => {
    const res = await phpAxios.post(qs({ rtype: 'features', action: 'update', id }), data);
    return { data: extractPhpData(res) };
  },
  delete: async (id: string) => {
    const res = await phpAxios.post(qs({ rtype: 'features', action: 'delete', id }));
    return { data: extractPhpData(res) };
  },
};

// ===== CONFIG API =====
export const phpConfigApi = {
  list: async (params?: { status?: string; page?: number; limit?: number }) => {
    const p: Record<string, string | undefined> = { rtype: 'configurations', action: 'list' };
    if (params?.status) p.status = params.status;
    if (params?.page) p.page = String(params.page);
    if (params?.limit) p.limit = String(params.limit);
    const res = await phpAxios.get(qs(p));
    return { data: extractPhpData(res) };
  },
  get: async (id: string) => {
    const res = await phpAxios.get(qs({ rtype: 'configurations', action: 'get', id }));
    return { data: extractPhpData(res) };
  },
  create: async (data: { name: string; description?: string; configData: Record<string, unknown> }) => {
    const res = await phpAxios.post(qs({ rtype: 'configurations', action: 'create' }), data);
    return { data: extractPhpData(res) };
  },
  update: async (id: string, data: Partial<{ name: string; description: string; configData: Record<string, unknown>; status: string }>) => {
    const res = await phpAxios.post(qs({ rtype: 'configurations', action: 'update', id }), data);
    return { data: extractPhpData(res) };
  },
  delete: async (id: string) => {
    const res = await phpAxios.post(qs({ rtype: 'configurations', action: 'delete', id }));
    return { data: extractPhpData(res) };
  },
};

// ===== CONFIG DATA API =====
export const phpConfigDataApi = {
  saveFull: async (id: string, data: { nodes: any[]; edges: any[] }) => {
    const res = await phpAxios.post(qs({ rtype: 'config_data', action: 'save_full', id }), data);
    return { data: extractPhpData(res) };
  },
  loadFull: async (id: string) => {
    const res = await phpAxios.get(qs({ rtype: 'config_data', action: 'load_full', id }));
    return { data: extractPhpData(res) };
  },
  createSnapshot: async (id: string, data: { name?: string; description?: string }) => {
    const res = await phpAxios.post(qs({ rtype: 'config_data', action: 'create_snapshot', id }), data);
    return { data: extractPhpData(res) };
  },
  listSnapshots: async (id: string) => {
    const res = await phpAxios.get(qs({ rtype: 'config_data', action: 'list_snapshots', id }));
    return { data: extractPhpData(res) };
  },
  restoreSnapshot: async (configId: string, snapshotId: string) => {
    const res = await phpAxios.post(qs({ rtype: 'config_data', action: 'restore_snapshot', id: configId, sid: snapshotId }));
    return { data: extractPhpData(res) };
  },
};

// ===== USER API =====
export const phpUserApi = {
  list: async () => {
    const res = await phpAxios.get(qs({ rtype: 'users', action: 'list' }));
    return { data: extractPhpData(res) };
  },
  get: async (id: string) => {
    const res = await phpAxios.get(qs({ rtype: 'users', action: 'get', id }));
    return { data: extractPhpData(res) };
  },
  update: async (id: string, data: { displayName?: string; isActive?: boolean }) => {
    const res = await phpAxios.post(qs({ rtype: 'users', action: 'update', id }), data);
    return { data: extractPhpData(res) };
  },
  assignRole: async (id: string, roleName: string) => {
    const res = await phpAxios.post(qs({ rtype: 'users', action: 'assign_role', id }), { roleName });
    return { data: extractPhpData(res) };
  },
  removeRole: async (id: string, roleName: string) => {
    const res = await phpAxios.post(qs({ rtype: 'users', action: 'remove_role', id }), { roleName });
    return { data: extractPhpData(res) };
  },
  unlock: async (id: string) => {
    const res = await phpAxios.post(qs({ rtype: 'users', action: 'unlock', id }));
    return { data: extractPhpData(res) };
  },
  devices: async (id: string) => {
    const res = await phpAxios.get(qs({ rtype: 'users', action: 'devices', id }));
    return { data: extractPhpData(res) };
  },
};

// ===== AUDIT API =====
export const phpAuditApi = {
  list: async (params?: { event?: string; severity?: string; page?: number; limit?: number }) => {
    const p: Record<string, string | undefined> = { rtype: 'audit', action: 'list' };
    if (params?.event) p.event = params.event;
    if (params?.severity) p.severity = params.severity;
    if (params?.page) p.page = String(params.page);
    if (params?.limit) p.limit = String(params.limit);
    const res = await phpAxios.get(qs(p));
    return { data: extractPhpData(res) };
  },
  dashboard: async () => {
    const res = await phpAxios.get(qs({ rtype: 'audit', action: 'dashboard' }));
    return { data: extractPhpData(res) };
  },
};

// ===== HEALTH API =====
export const phpHealthApi = {
  check: async () => {
    const res = await phpAxios.get(qs({ rtype: 'health' }));
    return { data: extractPhpData(res) };
  },
};

export default phpAxios;
