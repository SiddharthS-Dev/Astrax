"""
AstraX EB1 Control Tower – Authentication & RBAC
=================================================
JWT creation / verification, password hashing, OAuth2 dependency,
first-time-login blocker, and role-based access-control checkers.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings
from database import get_db
from models import RoleName, User

# ── Password Hashing ─────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT Helpers ───────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def create_access_token(
    user_id: int,
    roles: List[str],
    requires_password_change: bool = False,
) -> str:
    """Create a signed JWT embedding user id, roles, and password-change flag."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "roles": roles,
        "requires_password_change": requires_password_change,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT, raising 401 on failure."""
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )


# ── Current-User Dependencies ────────────────────────────────────────────
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the JWT to a User ORM object (with roles eagerly loaded)."""
    payload = decode_access_token(token)
    user_id = int(payload["sub"])
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )
    return user


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    """
    Blocks every standard API route when the user still needs to change
    their initial password (HTTP 403).
    The **only** endpoint that should bypass this is `/auth/change-initial-password`.
    """
    if user.requires_password_change:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must change your initial password before accessing the system. "
            "POST /auth/change-initial-password",
        )
    return user


# ── Role-Based Access Checkers ────────────────────────────────────────────
def _has_any_role(user: User, allowed: List[RoleName]) -> bool:
    """Return True if the user holds at least one of the given roles."""
    user_role_set = {
        (r.name if isinstance(r.name, RoleName) else RoleName(r.name))
        for r in user.roles
    }
    return bool(user_role_set & set(allowed))


def require_roles(*allowed_roles: RoleName):
    """
    Factory that returns a FastAPI dependency enforcing that the current
    user holds **at least one** of the listed roles.

    Usage::

        @router.get("/admin-only", dependencies=[Depends(require_roles(RoleName.SUPER_ADMIN))])
    """

    async def _checker(user: User = Depends(get_current_active_user)) -> User:
        if not _has_any_role(user, list(allowed_roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient role. Required one of: "
                f"{[r.value for r in allowed_roles]}",
            )
        return user

    return _checker


# ── Convenience shortcuts ─────────────────────────────────────────────────
require_super_admin = require_roles(RoleName.SUPER_ADMIN)
require_executive_or_manager = require_roles(RoleName.EXECUTIVE, RoleName.MANAGER)
require_report_access = require_roles(
    RoleName.SUPER_ADMIN, RoleName.EXECUTIVE, RoleName.MANAGER
)
