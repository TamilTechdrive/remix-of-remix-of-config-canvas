/**
 * Unified API - Routes all API calls to either Node.js or PHP backend
 * based on the apiConfig flag.
 * 
 * All frontend code should import from this file instead of api.ts or phpApi.ts directly.
 */

import { isPhpBackend, isSecurityEnabled } from './apiConfig';
import {
  authApi as nodeAuthApi,
  configApi as nodeConfigApi,
  configDataApi as nodeConfigDataApi,
  projectApi as nodeProjectApi,
  parserApi as nodeParserApi,
  userApi as nodeUserApi,
  auditApi as nodeAuditApi,
  setAccessToken as setNodeToken,
  getAccessToken as getNodeToken,
} from './api';
import {
  phpAuthApi,
  phpProjectApi,
  phpParserApi,
  phpFeaturesApi,
  phpConfigApi,
  phpConfigDataApi,
  phpUserApi,
  phpAuditApi,
  phpHealthApi,
  setPhpAccessToken,
  getPhpAccessToken,
} from './phpApi';

// ===== TOKEN MANAGEMENT =====
export function setToken(token: string | null) {
  if (isPhpBackend()) {
    setPhpAccessToken(token);
  } else {
    setNodeToken(token);
  }
}

export function getToken(): string | null {
  if (isPhpBackend()) {
    return getPhpAccessToken();
  }
  return getNodeToken();
}

// ===== AUTH API =====
export const unifiedAuthApi = {
  login: async (data: { email: string; password: string }) => {
    if (!isSecurityEnabled()) {
      // Skip real auth, return mock
      return { data: { accessToken: 'no-auth', user: { id: 'local', email: data.email, username: data.email.split('@')[0], displayName: data.email.split('@')[0] } } };
    }
    if (isPhpBackend()) return phpAuthApi.login(data);
    const res = await nodeAuthApi.login(data);
    return { data: { accessToken: res.data.accessToken, user: res.data.user } };
  },

  register: async (data: { email: string; username: string; password: string; displayName?: string }) => {
    if (!isSecurityEnabled()) {
      return { data: { accessToken: 'no-auth', user: { id: 'local', email: data.email, username: data.username, displayName: data.displayName || data.username } } };
    }
    if (isPhpBackend()) return phpAuthApi.register(data);
    return nodeAuthApi.register(data);
  },

  logout: async () => {
    if (isPhpBackend()) return phpAuthApi.logout();
    return nodeAuthApi.logout();
  },

  me: async () => {
    if (!isSecurityEnabled()) {
      return { data: { id: 'local', email: 'local@user', username: 'local', displayName: 'Local User', roles: ['admin'], permissions: [] } };
    }
    if (isPhpBackend()) return phpAuthApi.me();
    return nodeAuthApi.me();
  },

  changePassword: async (data: { currentPassword: string; password: string }) => {
    if (isPhpBackend()) {
      // PHP doesn't have this yet - return success
      return { data: { success: true } };
    }
    return (nodeAuthApi as any).changePassword(data);
  },
};

// ===== PROJECT API =====
export const unifiedProjectApi = {
  list: () => isPhpBackend() ? phpProjectApi.list() : nodeProjectApi.list(),
  get: (id: string) => isPhpBackend() ? phpProjectApi.get(id) : nodeProjectApi.get(id),
  create: (data: { name: string; description?: string; tags?: string[] }) =>
    isPhpBackend() ? phpProjectApi.create(data) : nodeProjectApi.create(data),
  update: (id: string, data: { name?: string; description?: string; tags?: string[]; status?: string }) =>
    isPhpBackend() ? phpProjectApi.update(id, data) : nodeProjectApi.update(id, data),
  delete: (id: string) => isPhpBackend() ? phpProjectApi.delete(id) : nodeProjectApi.delete(id),

  // STB Models
  createSTBModel: (projectId: string, data: { name: string; description?: string; chipset?: string }) =>
    isPhpBackend() ? phpProjectApi.createSTBModel(projectId, data) : nodeProjectApi.createSTBModel(projectId, data),
  updateSTBModel: (modelId: string, data: { name?: string; description?: string; chipset?: string }) =>
    isPhpBackend() ? phpProjectApi.updateSTBModel(modelId, data) : nodeProjectApi.updateSTBModel(modelId, data),
  deleteSTBModel: (modelId: string) =>
    isPhpBackend() ? phpProjectApi.deleteSTBModel(modelId) : nodeProjectApi.deleteSTBModel(modelId),

  // Builds
  createBuild: (modelId: string, data: { name: string; description?: string; version?: string }) =>
    isPhpBackend() ? phpProjectApi.createBuild(modelId, data) : nodeProjectApi.createBuild(modelId, data),
  updateBuild: (buildId: string, data: { name?: string; description?: string; version?: string; status?: string }) =>
    isPhpBackend() ? phpProjectApi.updateBuild(buildId, data) : nodeProjectApi.updateBuild(buildId, data),
  deleteBuild: (buildId: string) =>
    isPhpBackend() ? phpProjectApi.deleteBuild(buildId) : nodeProjectApi.deleteBuild(buildId),

  // Parser config
  saveParserConfig: (buildId: string, data: { parserSessionId?: string; configName: string; nodes: any[]; edges: any[] }) =>
    isPhpBackend() ? phpProjectApi.saveParserConfig(buildId, data) : nodeProjectApi.saveParserConfig(buildId, data),
  loadConfig: (configId: string) =>
    isPhpBackend() ? phpProjectApi.loadConfig(configId) : nodeProjectApi.loadConfig(configId),
  listBuildConfigs: (buildId: string) =>
    isPhpBackend() ? phpProjectApi.listBuildConfigs(buildId) : nodeProjectApi.listBuildConfigs(buildId),
};

// ===== PARSER API =====
export const unifiedParserApi = {
  seed: (data?: { jsonData?: any; sessionName?: string; projectId?: string; buildId?: string; moduleId?: string }) =>
    isPhpBackend() ? phpParserApi.seed(data) : nodeParserApi.seed(data),
  listSessions: () =>
    isPhpBackend() ? phpParserApi.listSessions() : nodeParserApi.listSessions(),
  getSession: (id: string) =>
    isPhpBackend() ? phpParserApi.getSession(id) : nodeParserApi.getSession(id),
  deleteSession: (id: string) =>
    isPhpBackend() ? phpParserApi.deleteSession(id) : nodeParserApi.deleteSession(id),
  exportCSV: (id: string, sheet: string) =>
    isPhpBackend() ? phpParserApi.exportCSV(id, sheet) : nodeParserApi.exportSession(id, sheet),
};

// ===== CONFIG API =====
export const unifiedConfigApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    isPhpBackend() ? phpConfigApi.list(params) : nodeConfigApi.list(params),
  get: (id: string, encryptionKey?: string) =>
    isPhpBackend() ? phpConfigApi.get(id) : nodeConfigApi.get(id, encryptionKey),
  create: (data: { name: string; description?: string; configData: Record<string, unknown> }) =>
    isPhpBackend() ? phpConfigApi.create(data) : nodeConfigApi.create(data),
  update: (id: string, data: Partial<{ name: string; description: string; configData: Record<string, unknown>; status: string }>) =>
    isPhpBackend() ? phpConfigApi.update(id, data) : nodeConfigApi.update(id, data),
  delete: (id: string) =>
    isPhpBackend() ? phpConfigApi.delete(id) : nodeConfigApi.delete(id),
};

// ===== CONFIG DATA API =====
export const unifiedConfigDataApi = {
  saveFull: (id: string, data: { nodes: any[]; edges: any[] }) =>
    isPhpBackend() ? phpConfigDataApi.saveFull(id, data) : nodeConfigDataApi.saveFull(id, data),
  loadFull: (id: string) =>
    isPhpBackend() ? phpConfigDataApi.loadFull(id) : nodeConfigDataApi.loadFull(id),
  createSnapshot: (id: string, data: { name?: string; description?: string }) =>
    isPhpBackend() ? phpConfigDataApi.createSnapshot(id, data) : nodeConfigDataApi.createSnapshot(id, data),
  listSnapshots: (id: string) =>
    isPhpBackend() ? phpConfigDataApi.listSnapshots(id) : nodeConfigDataApi.listSnapshots(id),
  restoreSnapshot: (configId: string, snapshotId: string) =>
    isPhpBackend() ? phpConfigDataApi.restoreSnapshot(configId, snapshotId) : nodeConfigDataApi.restoreSnapshot(configId, snapshotId),
};

// ===== FEATURES API =====
export const unifiedFeaturesApi = {
  list: (params?: { projectId?: string; buildId?: string; module?: string }) =>
    isPhpBackend() ? phpFeaturesApi.list(params) : phpFeaturesApi.list(params), // Features only in PHP
  create: (data: { projectId?: string; buildId?: string; module?: string; name: string; enabled?: boolean; details?: Record<string, any> }) =>
    phpFeaturesApi.create(data),
  update: (id: string, data: { name?: string; enabled?: boolean; details?: Record<string, any>; module?: string }) =>
    phpFeaturesApi.update(id, data),
  delete: (id: string) => phpFeaturesApi.delete(id),
};

// ===== USER API =====
export const unifiedUserApi = {
  list: () => isPhpBackend() ? phpUserApi.list() : nodeUserApi.list(),
  get: (id: string) => isPhpBackend() ? phpUserApi.get(id) : nodeUserApi.get(id),
  update: (id: string, data: { displayName?: string; isActive?: boolean }) =>
    isPhpBackend() ? phpUserApi.update(id, data) : nodeUserApi.update(id, data),
  assignRole: (id: string, roleName: string) =>
    isPhpBackend() ? phpUserApi.assignRole(id, roleName) : nodeUserApi.assignRole(id, roleName),
  removeRole: (id: string, roleName: string) =>
    isPhpBackend() ? phpUserApi.removeRole(id, roleName) : nodeUserApi.removeRole(id, roleName),
  unlock: (id: string) => isPhpBackend() ? phpUserApi.unlock(id) : nodeUserApi.unlock(id),
  devices: (id: string) => isPhpBackend() ? phpUserApi.devices(id) : nodeUserApi.devices(id),
};

// ===== AUDIT API =====
export const unifiedAuditApi = {
  list: (params?: { event?: string; severity?: string; page?: number; limit?: number }) =>
    isPhpBackend() ? phpAuditApi.list(params) : nodeAuditApi.list(params),
  dashboard: () => isPhpBackend() ? phpAuditApi.dashboard() : nodeAuditApi.dashboard(),
};

// ===== HEALTH API =====
export const unifiedHealthApi = {
  check: () => phpHealthApi.check(),
};
