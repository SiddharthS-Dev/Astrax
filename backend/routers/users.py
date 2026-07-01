"""
AstraX EB1 Control Tower – Users Router
========================================
Team tree retrieval and Super-Admin-only manager assignment.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_active_user, require_super_admin
from database import get_db
from models import User
from schemas import AssignManagerRequest, TeamResponse, UserOut

router = APIRouter(prefix="/users", tags=["Users & Organisation"])


# ── My Team ───────────────────────────────────────────────────────────────
@router.get("/me/team", response_model=TeamResponse)
async def get_my_team(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the authenticated user and their direct reports.
    Direct reports are eagerly loaded via the `selectin` strategy defined
    on the model relationship.
    """
    # Re-load with fresh eager loads to guarantee direct_reports are present
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.roles),
            selectinload(User.direct_reports).selectinload(User.roles),
        )
        .where(User.id == current_user.id)
    )
    user = result.scalar_one()

    return TeamResponse(
        me=UserOut.model_validate(user),
        direct_reports=[UserOut.model_validate(dr) for dr in user.direct_reports],
    )


# ── Assign Manager (Super Admin Only) ────────────────────────────────────
@router.patch(
    "/{user_id}/assign-manager",
    response_model=UserOut,
    dependencies=[Depends(require_super_admin)],
)
async def assign_manager(
    user_id: int,
    body: AssignManagerRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Update the reporting manager of any user.

    **Restricted to Super Admin.**
    Prevents a user from being assigned as their own manager.
    """
    # Locate target user
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    target_user = result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found.",
        )

    # Validate new manager exists (if provided)
    if body.manager_id is not None:
        if body.manager_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user cannot be their own manager.",
            )
        mgr_result = await db.execute(
            select(User).where(User.id == body.manager_id)
        )
        if mgr_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Manager {body.manager_id} not found.",
            )

    target_user.manager_id = body.manager_id
    await db.flush()
    await db.refresh(target_user)

    return UserOut.model_validate(target_user)
