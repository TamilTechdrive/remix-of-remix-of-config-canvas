/**
 * API Configuration & Backend Switcher
 *
 * Controls which backend is used for API calls:
 *   - 'node'   → Node.js / Express   (default)
 *   - 'php'    → phpbackend2 (legacy MSSQL/MySQL)
 *
 * The Python parser service is a *separate* compute layer used for huge
 * (multi-GB) JSON parsing. It is enabled independently via `pythonEnabled`
 * and used only by the Parser Data screen for heavy ingestion. Light CRUD
 * still goes through node/php.
 */

export type ApiBackend = 'node' | 'php';

interface ApiConfig {
  backend: ApiBackend;
  securityEnabled: boolean;
  phpBaseUrl: string;
  nodeBaseUrl: string;
  pythonEnabled: boolean;
  pythonBaseUrl: string;
  pythonWsUrl: string;
}

const STORAGE_KEY = 'cf_api_config';

const DEFAULT_CONFIG: ApiConfig = {
  backend: 'node',
  securityEnabled: true,
  phpBaseUrl: import.meta.env.VITE_PHP_API_URL || 'http://localhost/phpbackend2',
  nodeBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  pythonEnabled: false,
  pythonBaseUrl: import.meta.env.VITE_PY_API_URL || 'http://localhost:8800',
  pythonWsUrl: import.meta.env.VITE_PY_WS_URL || 'ws://localhost:8800',
};

function loadConfig(): ApiConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

let currentConfig: ApiConfig = loadConfig();

export function getApiConfig(): ApiConfig {
  return { ...currentConfig };
}

export function setApiBackend(backend: ApiBackend) {
  currentConfig.backend = backend;
  _persist();
}

export function setSecurityEnabled(enabled: boolean) {
  currentConfig.securityEnabled = enabled;
  _persist();
}

export function setPhpBaseUrl(url: string) {
  currentConfig.phpBaseUrl = url;
  _persist();
}

export function setNodeBaseUrl(url: string) {
  currentConfig.nodeBaseUrl = url;
  _persist();
}

export function setPythonEnabled(enabled: boolean) {
  currentConfig.pythonEnabled = enabled;
  _persist();
}

export function setPythonBaseUrl(url: string) {
  currentConfig.pythonBaseUrl = url;
  // Auto-derive ws URL from http URL when user only sets the http one.
  try {
    const u = new URL(url);
    currentConfig.pythonWsUrl = `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`;
  } catch { /* ignore */ }
  _persist();
}

export function isPhpBackend(): boolean {
  return currentConfig.backend === 'php';
}

export function isSecurityEnabled(): boolean {
  return currentConfig.securityEnabled;
}

export function isPythonEnabled(): boolean {
  return currentConfig.pythonEnabled;
}

function _persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
  } catch { /* ignore */ }
}
