"""
AstraX EB1 Control Tower – Pydantic V2 Schemas
===============================================
Request / response models for all API routes.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from models import ExperimentStatus, RoleName


# ═══════════════════════════════════════════════════════════════════════════
#  Auth Schemas
# ═══════════════════════════════════════════════════════════════════════════
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, description="New password (min 8 characters)")


# ═══════════════════════════════════════════════════════════════════════════
#  Role Schemas
# ═══════════════════════════════════════════════════════════════════════════
class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: RoleName


# ═══════════════════════════════════════════════════════════════════════════
#  User Schemas
# ═══════════════════════════════════════════════════════════════════════════
class UserBrief(BaseModel):
    """Lightweight user reference (e.g., inside experiment responses)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    manager_id: Optional[int] = None
    is_active: bool
    requires_password_change: bool
    roles: List[RoleOut] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TeamResponse(BaseModel):
    """Current user plus their direct reports."""
    me: UserOut
    direct_reports: List[UserOut] = []


class AssignManagerRequest(BaseModel):
    manager_id: Optional[int] = Field(
        None,
        description="ID of the new manager. Pass null to remove manager assignment.",
    )


# ═══════════════════════════════════════════════════════════════════════════
#  Track Schemas
# ═══════════════════════════════════════════════════════════════════════════
class TrackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    lead_id: Optional[int] = None


# ═══════════════════════════════════════════════════════════════════════════
#  Experiment Schemas
# ═══════════════════════════════════════════════════════════════════════════
class ExperimentCreate(BaseModel):
    title: str = Field(..., max_length=500)
    hypothesis: Optional[str] = None
    success_criteria: Optional[str] = None
    status: ExperimentStatus = ExperimentStatus.NOT_STARTED
    target_end_date: Optional[date] = None
    outcome: Optional[str] = None
    next_action: Optional[str] = None
    owner_id: int
    track_id: Optional[int] = None


class ExperimentUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    hypothesis: Optional[str] = None
    success_criteria: Optional[str] = None
    status: Optional[ExperimentStatus] = None
    target_end_date: Optional[date] = None
    outcome: Optional[str] = None
    next_action: Optional[str] = None
    owner_id: Optional[int] = None
    track_id: Optional[int] = None


class ExperimentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    hypothesis: Optional[str] = None
    success_criteria: Optional[str] = None
    status: ExperimentStatus
    target_end_date: Optional[date] = None
    outcome: Optional[str] = None
    next_action: Optional[str] = None
    owner_id: int
    track_id: Optional[int] = None
    owner: Optional[UserBrief] = None
    track: Optional[TrackOut] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
