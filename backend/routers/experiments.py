"""
AstraX EB1 Control Tower – Experiments Router
==============================================
Full CRUD with RBAC-scoped listing and Executive read-only constraint.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import _has_any_role, get_current_active_user
from database import get_db
from models import Experiment, RoleName, User
from schemas import ExperimentCreate, ExperimentOut, ExperimentUpdate

router = APIRouter(prefix="/experiments", tags=["Experiments"])


# ── Helpers ───────────────────────────────────────────────────────────────
def _collect_subordinate_ids(user: User) -> List[int]:
    """Recursively collect IDs of all transitive direct reports."""
    ids: List[int] = []
    for dr in user.direct_reports:
        ids.append(dr.id)
        ids.extend(_collect_subordinate_ids(dr))
    return ids


async def _get_accessible_experiments(
    user: User,
    db: AsyncSession,
) -> List[Experiment]:
    """
    Return experiments scoped by the caller's role(s):
    - Super Admin / Executive  → ALL experiments
    - Manager                  → own + direct reports' experiments
    - Employee / Technician    → own experiments only
    """
    base_query = (
        select(Experiment)
        .options(
            selectinload(Experiment.owner).selectinload(User.roles),
            selectinload(Experiment.track),
        )
        .order_by(Experiment.id)
    )

    if _has_any_role(user, [RoleName.SUPER_ADMIN, RoleName.EXECUTIVE]):
        result = await db.execute(base_query)
        return list(result.scalars().all())

    if _has_any_role(user, [RoleName.MANAGER]):
        subordinate_ids = _collect_subordinate_ids(user)
        visible_ids = [user.id] + subordinate_ids
        result = await db.execute(
            base_query.where(Experiment.owner_id.in_(visible_ids))
        )
        return list(result.scalars().all())

    # Employee / Technician – own only
    result = await db.execute(
        base_query.where(Experiment.owner_id == user.id)
    )
    return list(result.scalars().all())


# ── List Experiments (RBAC-scoped) ────────────────────────────────────────
@router.get("/", response_model=List[ExperimentOut])
async def list_experiments(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List experiments filtered by the current user's role hierarchy."""
    experiments = await _get_accessible_experiments(current_user, db)
    return [ExperimentOut.model_validate(e) for e in experiments]


# ── Create Experiment ─────────────────────────────────────────────────────
@router.post("/", response_model=ExperimentOut, status_code=status.HTTP_201_CREATED)
async def create_experiment(
    body: ExperimentCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new experiment.

    **Executive constraint:** Executives may only create experiments where
    they are the `owner_id`.
    """
    # Executive write-guard
    if _has_any_role(current_user, [RoleName.EXECUTIVE]):
        if not _has_any_role(current_user, [RoleName.SUPER_ADMIN, RoleName.MANAGER]):
            if body.owner_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Executives may only create experiments they own.",
                )

    experiment = Experiment(**body.model_dump())
    db.add(experiment)
    await db.flush()
    await db.refresh(experiment)

    # Re-load with relationships
    result = await db.execute(
        select(Experiment)
        .options(
            selectinload(Experiment.owner),
            selectinload(Experiment.track),
        )
        .where(Experiment.id == experiment.id)
    )
    loaded = result.scalar_one()
    return ExperimentOut.model_validate(loaded)


# ── Update Experiment ─────────────────────────────────────────────────────
@router.patch("/{experiment_id}", response_model=ExperimentOut)
async def update_experiment(
    experiment_id: int,
    body: ExperimentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Patch-update an experiment.

    **Executive constraint:** Executives may only edit experiments where
    they are the current `owner_id`.
    """
    result = await db.execute(
        select(Experiment)
        .options(
            selectinload(Experiment.owner),
            selectinload(Experiment.track),
        )
        .where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment {experiment_id} not found.",
        )

    # Executive write-guard
    if _has_any_role(current_user, [RoleName.EXECUTIVE]):
        if not _has_any_role(current_user, [RoleName.SUPER_ADMIN, RoleName.MANAGER]):
            if experiment.owner_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Executives may only edit experiments they own.",
                )

    # Apply partial updates
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(experiment, field, value)

    await db.flush()
    await db.refresh(experiment)

    return ExperimentOut.model_validate(experiment)


# ── Get Single Experiment ─────────────────────────────────────────────────
@router.get("/{experiment_id}", response_model=ExperimentOut)
async def get_experiment(
    experiment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a single experiment by ID (access governed by RBAC)."""
    result = await db.execute(
        select(Experiment)
        .options(
            selectinload(Experiment.owner),
            selectinload(Experiment.track),
        )
        .where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment {experiment_id} not found.",
        )

    # Verify the caller can see this experiment
    accessible = await _get_accessible_experiments(current_user, db)
    if experiment.id not in {e.id for e in accessible}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this experiment.",
        )

    return ExperimentOut.model_validate(experiment)
