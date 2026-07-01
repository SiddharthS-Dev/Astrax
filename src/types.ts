/**
 * AstraX EB1 Control Tower – TypeScript Interfaces
 * =================================================
 * Mirrors the backend Pydantic schemas for type-safe API communication.
 */

// ── Enums ────────────────────────────────────────────────────────────────
export type ExperimentStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Complete';
export type RoleName = 'Super Admin' | 'Executive' | 'Manager' | 'Employee' | 'Technician';

// ── Auth ─────────────────────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  new_password: string;
}

// ── Role ─────────────────────────────────────────────────────────────────
export interface Role {
  id: number;
  name: RoleName;
}

// ── User ─────────────────────────────────────────────────────────────────
export interface UserBrief {
  id: number;
  email: string;
  full_name: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  manager_id: number | null;
  is_active: boolean;
  requires_password_change: boolean;
  roles: Role[];
  created_at: string | null;
  updated_at: string | null;
}

export interface TeamResponse {
  me: User;
  direct_reports: User[];
}

export interface AssignManagerRequest {
  manager_id: number | null;
}

// ── Track ────────────────────────────────────────────────────────────────
export interface Track {
  id: number;
  name: string;
  lead_id: number | null;
}

// ── Experiment ───────────────────────────────────────────────────────────
export interface Experiment {
  id: number;
  title: string;
  hypothesis: string | null;
  success_criteria: string | null;
  status: ExperimentStatus;
  target_end_date: string | null;
  outcome: string | null;
  next_action: string | null;
  owner_id: number;
  track_id: number | null;
  owner: UserBrief | null;
  track: Track | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ExperimentCreate {
  title: string;
  hypothesis?: string;
  success_criteria?: string;
  status?: ExperimentStatus;
  target_end_date?: string;
  outcome?: string;
  next_action?: string;
  owner_id: number;
  track_id?: number;
}

export interface ExperimentUpdate {
  title?: string;
  hypothesis?: string;
  success_criteria?: string;
  status?: ExperimentStatus;
  target_end_date?: string;
  outcome?: string;
  next_action?: string;
  owner_id?: number;
  track_id?: number;
}

// ── JWT Payload (decoded) ────────────────────────────────────────────────
export interface JWTPayload {
  sub: string;
  roles: string[];
  requires_password_change: boolean;
  exp: number;
}
