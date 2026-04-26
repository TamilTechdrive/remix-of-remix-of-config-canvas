/**
 * Python parser service client.
 *
 * Used for ingesting *huge* (multi-GB) parser JSON files via the FastAPI
 * service in `pyparser/`. Communicates over plain HTTP for control and a
 * WebSocket for live progress updates.
 *
 * Light CRUD (projects, builds, configs, users) still goes through node/php
 * via `unifiedApi`. This module is intentionally narrow.
 */

import { getApiConfig } from './apiConfig';

export interface PyJobCreate {
  filePath: string;
  sessionName?: string;
  projectId?: string;
  buildId?: string;
  moduleId?: string;
  storeMode?: 'db' | 'shards' | 'both';
}

export interface PyJobStatus {
  jobId: string;
  state: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  stage: string;
  progress: number;
  bytesRead: number;
  bytesTotal: number;
  rows: Record<string, number>;
  error?: string | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  summary?: Record<string, unknown> | null;
  sessionId?: string | null;
}

export interface PyProgressEvent {
  jobId: string;
  stage: string;
  progress: number;
  bytesRead?: number;
  bytesTotal?: number;
  rows?: Record<string, number>;
  message?: string | null;
  state?: PyJobStatus['state'];
  error?: string;
}

function base(): string {
  return getApiConfig().pythonBaseUrl.replace(/\/$/, '');
}

function wsBase(): string {
  return getApiConfig().pythonWsUrl.replace(/\/$/, '');
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`pyparser ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const pythonApi = {
  health: () => req<{ ok: boolean; service: string }>('/health'),

  submit: (payload: PyJobCreate) =>
    req<{ jobId: string; state: string }>('/jobs', {
      method: 'POST',
      body: JSON.stringify({ storeMode: 'both', ...payload }),
    }),

  list: () => req<PyJobStatus[]>('/jobs'),
  get: (jobId: string) => req<PyJobStatus>(`/jobs/${jobId}`),
  cancel: (jobId: string) => req<{ cancelled: boolean }>(`/jobs/${jobId}`, { method: 'DELETE' }),
  summary: (jobId: string) => req<{ jobId: string; rows: Record<string, number>; summary: any }>(`/jobs/${jobId}/summary`),
  shards: (jobId: string) => req<{ jobId: string; dir: string; files: { name: string; size: number }[] }>(`/jobs/${jobId}/shards`),

  exportCsvUrl: (jobId: string, sheet: string) => `${base()}/export/${jobId}/${sheet}.csv`,

  /**
   * Open a WebSocket that streams live progress for a job.
   * Returns a `close()` function. The `onEvent` handler also receives the
   * terminal "completed" / "error" / "cancelled" event before the socket
   * closes itself.
   */
  watch(jobId: string, onEvent: (ev: PyProgressEvent) => void, onError?: (err: Event) => void): () => void {
    const ws = new WebSocket(`${wsBase()}/ws/${jobId}`);
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as PyProgressEvent;
        onEvent(ev);
      } catch { /* ignore */ }
    };
    if (onError) ws.onerror = onError;
    return () => {
      try { ws.close(); } catch { /* ignore */ }
    };
  },
};
