/**
 * AstraX EB1 Control Tower – API Service
 * =======================================
 * Typed fetch wrapper with JWT injection for all backend endpoints.
 */

import type {
  TokenResponse,
  User,
  TeamResponse,
  Experiment,
  ExperimentCreate,
  ExperimentUpdate,
  AssignManagerRequest,
} from '../types';

const API_BASE = 'http://localhost:8000';

// ── Helpers ──────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem('astrax_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new APIError(res.status, body.detail || 'Request failed');
  }

  return res.json() as Promise<T>;
}

export class APIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'APIError';
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<TokenResponse> {
  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function changeInitialPassword(newPassword: string): Promise<TokenResponse> {
  return request<TokenResponse>('/auth/change-initial-password', {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  });
}

// ── Users ────────────────────────────────────────────────────────────────

export async function getMyTeam(): Promise<TeamResponse> {
  return request<TeamResponse>('/users/me/team');
}

export async function assignManager(
  userId: number,
  body: AssignManagerRequest,
): Promise<User> {
  return request<User>(`/users/${userId}/assign-manager`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ── Experiments ──────────────────────────────────────────────────────────

export async function getExperiments(): Promise<Experiment[]> {
  return request<Experiment[]>('/experiments/');
}

export async function getExperiment(id: number): Promise<Experiment> {
  return request<Experiment>(`/experiments/${id}`);
}

export async function createExperiment(data: ExperimentCreate): Promise<Experiment> {
  return request<Experiment>('/experiments/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExperiment(
  id: number,
  data: ExperimentUpdate,
): Promise<Experiment> {
  return request<Experiment>(`/experiments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ── Reports ──────────────────────────────────────────────────────────────

export async function exportReport(format: 'excel' | 'pdf'): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/reports/experiments/export?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new APIError(res.status, body.detail || 'Export failed');
  }

  return res.blob();
}

// ── Health ───────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ status: string; service: string }> {
  return request('/health');
}
