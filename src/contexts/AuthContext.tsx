import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAccessToken, getAccessToken } from '../services/api';
import { setPhpAccessToken, getPhpAccessToken } from '../services/phpApi';
import { unifiedAuthApi } from '../services/unifiedApi';
import { isPhpBackend, isSecurityEnabled } from '../services/apiConfig';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => void;
  register: (email: string, username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (perm: string) => boolean;
  updateProfile: (updates: Partial<User>) => void;
}

const DEMO_USER: User = {
  id: 'demo-001',
  email: 'admin@configflow.dev',
  username: 'admin',
  displayName: 'Demo Admin',
  roles: ['admin', 'editor', 'viewer'],
  permissions: ['config:read', 'config:write', 'config:delete', 'user:manage', 'audit:read'],
  avatar: '',
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const res = await unifiedAuthApi.me();
      const d = res.data;
      setUser({
        id: d.id,
        email: d.email,
        username: d.username,
        displayName: d.displayName || d.display_name || d.username,
        roles: d.roles || [],
        permissions: d.permissions || [],
      });
    } catch {
      setUser(null);
      if (isPhpBackend()) setPhpAccessToken(null);
      else setAccessToken(null);
    }
  }, []);

  useEffect(() => {
    // Check demo mode first
    const demoFlag = localStorage.getItem('cf_demo');
    if (demoFlag === 'true') {
      setUser(DEMO_USER);
      setIsDemoMode(true);
      setIsLoading(false);
      return;
    }

    // If security is disabled, auto-login as local user
    if (!isSecurityEnabled()) {
      setUser({
        id: 'local',
        email: 'local@user',
        username: 'local',
        displayName: 'Local User',
        roles: ['admin'],
        permissions: ['config:read', 'config:write', 'config:delete', 'user:manage', 'audit:read'],
      });
      setIsLoading(false);
      return;
    }

    const token = isPhpBackend() ? getPhpAccessToken() : getAccessToken();
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await unifiedAuthApi.login({ email, password });
    const d = res.data;
    const token = d.accessToken;
    if (token && isSecurityEnabled()) {
      if (isPhpBackend()) setPhpAccessToken(token);
      else setAccessToken(token);
    }
    if (d.user) {
      setUser({
        id: d.user.id,
        email: d.user.email,
        username: d.user.username,
        displayName: d.user.displayName || d.user.username,
        roles: d.user.roles || [],
        permissions: [],
      });
    }
    setIsDemoMode(false);
    if (isSecurityEnabled()) {
      await refreshUser();
    }
  }, [refreshUser]);

  const loginDemo = useCallback(() => {
    localStorage.setItem('cf_demo', 'true');
    setUser(DEMO_USER);
    setIsDemoMode(true);
  }, []);

  const register = useCallback(async (email: string, username: string, password: string, displayName?: string) => {
    await unifiedAuthApi.register({ email, username, password, displayName });
  }, []);

  const logout = useCallback(async () => {
    if (!isDemoMode) {
      try { await unifiedAuthApi.logout(); } catch { /* ignore */ }
    }
    setAccessToken(null);
    setPhpAccessToken(null);
    localStorage.removeItem('cf_demo');
    setUser(null);
    setIsDemoMode(false);
  }, [isDemoMode]);

  const updateProfile = useCallback((updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const hasRole = useCallback((role: string) => user?.roles.includes(role) ?? false, [user]);
  const hasPermission = useCallback((perm: string) => user?.permissions.includes(perm) ?? false, [user]);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: !!user, isDemoMode,
      login, loginDemo, register, logout, refreshUser, hasRole, hasPermission, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
