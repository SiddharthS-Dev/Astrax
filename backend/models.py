"""
AstraX EB1 Control Tower – SQLAlchemy ORM Models
=================================================
Defines Role, User (many-to-many via UserRole), Track, and Experiment tables.
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


# ── Enumerations ──────────────────────────────────────────────────────────
class ExperimentStatus(str, enum.Enum):
    NOT_STARTED = "Not Started"
    IN_PROGRESS = "In Progress"
    BLOCKED = "Blocked"
    COMPLETE = "Complete"


class RoleName(str, enum.Enum):
    SUPER_ADMIN = "Super Admin"
    EXECUTIVE = "Executive"
    MANAGER = "Manager"
    EMPLOYEE = "Employee"
    TECHNICIAN = "Technician"


# ── Association Table: User ↔ Role (Many-to-Many) ────────────────────────
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


# ── Role Model ────────────────────────────────────────────────────────────
class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(
        Enum(RoleName, name="rolename", create_constraint=True),
        unique=True,
        nullable=False,
    )

    # Back-reference to users
    users: Mapped[List["User"]] = relationship(
        "User",
        secondary=user_roles,
        back_populates="roles",
    )

    def __repr__(self) -> str:
        return f"<Role id={self.id} name={self.name!r}>"


# ── User Model ────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Self-referencing FK for org reporting tree
    manager_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    requires_password_change: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ────────────────────────────────────────────────────
    roles: Mapped[List[Role]] = relationship(
        "Role",
        secondary=user_roles,
        back_populates="users",
        lazy="selectin",  # eagerly load roles with every user query
    )

    # Manager / direct reports
    manager: Mapped[Optional["User"]] = relationship(
        "User",
        remote_side=[id],
        back_populates="direct_reports",
        lazy="selectin",
    )
    direct_reports: Mapped[List["User"]] = relationship(
        "User",
        back_populates="manager",
        lazy="selectin",
    )

    # Owned experiments
    experiments: Mapped[List["Experiment"]] = relationship(
        "Experiment",
        back_populates="owner",
        lazy="selectin",
    )

    # Tracks led by this user
    tracks_led: Mapped[List["Track"]] = relationship(
        "Track",
        back_populates="lead",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"

    @property
    def role_names(self) -> List[str]:
        """Convenience: list of role name strings for the user."""
        return [r.name.value if isinstance(r.name, RoleName) else r.name for r in self.roles]


# ── Track Model ───────────────────────────────────────────────────────────
class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    lead_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    lead: Mapped[Optional[User]] = relationship("User", back_populates="tracks_led")
    experiments: Mapped[List["Experiment"]] = relationship(
        "Experiment",
        back_populates="track",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Track id={self.id} name={self.name!r}>"


# ── Experiment Model ──────────────────────────────────────────────────────
class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    hypothesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    success_criteria: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ExperimentStatus] = mapped_column(
        Enum(ExperimentStatus, name="experimentstatus", create_constraint=True),
        default=ExperimentStatus.NOT_STARTED,
        nullable=False,
    )
    target_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    owner_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    track_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("tracks.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner: Mapped[User] = relationship("User", back_populates="experiments")
    track: Mapped[Optional[Track]] = relationship("Track", back_populates="experiments")

    def __repr__(self) -> str:
        return f"<Experiment id={self.id} title={self.title!r}>"
