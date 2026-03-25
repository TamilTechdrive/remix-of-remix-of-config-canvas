/**
 * API Configuration & Backend Switcher
 * 
 * Controls which backend (Node.js or PHP) is used for all API calls.
 * Also controls whether security features (JWT auth) are enabled.
 */

export type ApiBackend = 'node' | 'php';

interface ApiConfig {
  backend: ApiBackend;
  securityEnabled: boolean;
  phpBaseUrl: string;
  nodeBaseUrl: string;
}

const STORAGE_KEY = 'cf_api_config';

const DEFAULT_CONFIG: ApiConfig = {
  backend: 'node',
  securityEnabled: true,
  phpBaseUrl: import.meta.env.VITE_PHP_API_URL || 'http://localhost/phpbackend2',
  nodeBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
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

export function isPhpBackend(): boolean {
  return currentConfig.backend === 'php';
}

export function isSecurityEnabled(): boolean {
  return currentConfig.securityEnabled;
}

function _persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
  } catch { /* ignore */ }
}
