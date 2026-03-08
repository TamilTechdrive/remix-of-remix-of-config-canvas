import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setAccessToken, getAccessToken } from '../services/api';

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
      const res = await authApi.me();
      setUser({
        id: res.data.id,
        email: res.data.email,
        username: res.data.username,
        displayName: res.data.display_name || res.data.username,
        roles: res.data.roles || [],
        permissions: res.data.permissions || [],
      });
    } catch {
      setUser(null);
      setAccessToken(null);
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
    const token = getAccessToken();
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setAccessToken(res.data.accessToken);
    setUser({
      id: res.data.user.id,
      email: res.data.user.email,
      username: res.data.user.username,
      displayName: res.data.user.displayName || res.data.user.username,
      roles: res.data.user.roles || [],
      permissions: [],
    });
    setIsDemoMode(false);
    await refreshUser();
  }, [refreshUser]);

  const loginDemo = useCallback(() => {
    localStorage.setItem('cf_demo', 'true');
    setUser(DEMO_USER);
    setIsDemoMode(true);
  }, []);

  const register = useCallback(async (email: string, username: string, password: string, displayName?: string) => {
    await authApi.register({ email, username, password, displayName });
  }, []);

  const logout = useCallback(async () => {
    if (!isDemoMode) {
      try { await authApi.logout(); } catch { /* ignore */ }
    }
    setAccessToken(null);
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
