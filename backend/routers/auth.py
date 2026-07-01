"""
AstraX EB1 Control Tower – Auth Router
=======================================
Handles login, token issuance, and the mandatory first-time password change.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from database import get_db
from models import User
from schemas import ChangePasswordRequest, LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Login ─────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with email + password and receive a JWT access token."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.email == body.email)
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    token = create_access_token(
        user_id=user.id,
        roles=user.role_names,
        requires_password_change=user.requires_password_change,
    )
    return TokenResponse(access_token=token)


# ── Change Initial Password ──────────────────────────────────────────────
@router.post("/change-initial-password", response_model=TokenResponse)
async def change_initial_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),  # NOTE: uses get_current_user, NOT get_current_active_user
    db: AsyncSession = Depends(get_db),
):
    """
    Update the user's password on first login, clear the
    `requires_password_change` flag, and issue a fresh JWT.

    This is the **only** protected endpoint accessible when
    `requires_password_change` is True.
    """
    if not user.requires_password_change:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password has already been changed. Use a standard password-reset flow.",
        )

    user.hashed_password = hash_password(body.new_password)
    user.requires_password_change = False
    await db.flush()

    token = create_access_token(
        user_id=user.id,
        roles=user.role_names,
        requires_password_change=False,
    )
    return TokenResponse(access_token=token)
