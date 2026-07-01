"""
AstraX EB1 Control Tower – Database Seed Script
=================================================
Populates the PostgreSQL database with:
  • 5 roles (Super Admin, Executive, Manager, Employee, Technician)
  • 14 users with correct role mappings and reporting structure
  • 6 tracks (T1-T6)
  • Sample experiments seeded across tracks and owners

All users are seeded with password "Astra@123" and requires_password_change = True.

Usage:
    python seed.py
"""

from __future__ import annotations

import asyncio
import sys
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import hash_password
from database import Base, async_session_factory, engine
from models import Experiment, ExperimentStatus, Role, RoleName, Track, User, user_roles


# ═══════════════════════════════════════════════════════════════════════════
#  Seed Data Definitions
# ═══════════════════════════════════════════════════════════════════════════

DEFAULT_PASSWORD = "Astra@123"

ROLE_NAMES = [
    RoleName.SUPER_ADMIN,
    RoleName.EXECUTIVE,
    RoleName.MANAGER,
    RoleName.EMPLOYEE,
    RoleName.TECHNICIAN,
]

# Users: (full_name, email, [roles], manager_email_or_None)
USER_DEFS: list[tuple[str, str, list[RoleName], str | None]] = [
    # ── Super Admins ──────────────────────────────────────────────────
    (
        "Vijay Chilakapati",
        "vijay.chilakapati@astraanalytical.com",
        [RoleName.SUPER_ADMIN, RoleName.MANAGER],  # dual role
        None,
    ),
    (
        "Senthil Kumaran",
        "senthil.kumaran@astraanalytical.com",
        [RoleName.SUPER_ADMIN],
        None,
    ),
    # ── Executive ─────────────────────────────────────────────────────
    (
        "Brian Cross",
        "brian.cross@astraanalytical.com",
        [RoleName.EXECUTIVE],
        None,  # unassigned manager
    ),
    # ── Managers ──────────────────────────────────────────────────────
    (
        "Steve Drake",
        "steve.drake@astraanalytical.com",
        [RoleName.MANAGER],
        None,
    ),
    (
        "Ramakrishna Madhava",
        "ramakrishna.madhava@astraanalytical.com",
        [RoleName.MANAGER],
        None,
    ),
    (
        "Vasu Rao",
        "vasu@astraanalytical.com",
        [RoleName.MANAGER],
        None,
    ),
    # ── Employees (reporting to Steve Drake) ──────────────────────────
    (
        "Ravi Emani",
        "ravi.emani@astraanalytical.com",
        [RoleName.EMPLOYEE],
        "steve.drake@astraanalytical.com",
    ),
    (
        "Gopinath Kandasamy",
        "gopinath.kandasamy@astraanalytical.com",
        [RoleName.EMPLOYEE],
        "steve.drake@astraanalytical.com",
    ),
    (
        "Aditya Kontheti",
        "aditya.kontheti@astraanalytical.com",
        [RoleName.EMPLOYEE],
        "steve.drake@astraanalytical.com",
    ),
    # ── Employees (reporting to Vijay Chilakapati) ────────────────────
    (
        "Abhilash Kothapalli",
        "abhilash.kothapalli@astraanalytical.com",
        [RoleName.EMPLOYEE],
        "vijay.chilakapati@astraanalytical.com",
    ),
    (
        "Sreekar Chilakapati",
        "sreekar.chilakapati@astraanalytical.com",
        [RoleName.EMPLOYEE],
        "vijay.chilakapati@astraanalytical.com",
    ),
    # ── Employees (reporting to Vasu Rao) ─────────────────────────────
    (
        "Rajendra Polavarapu",
        "rajendra.polavarapu@astraanalytical.com",
        [RoleName.EMPLOYEE],
        "vasu@astraanalytical.com",
    ),
    # ── Technicians (unassigned manager) ──────────────────────────────
    (
        "Sudalaimuthu",
        "Sudalaimuthu.dev@outlook.com",
        [RoleName.TECHNICIAN],
        None,
    ),
    (
        "Siddharth S",
        "siddharths.dev@outlook.com",
        [RoleName.TECHNICIAN],
        None,
    ),
]

TRACK_DEFS = [
    ("T1 Device", "vijay.chilakapati@astraanalytical.com"),
    ("T2 Cloud & AI", "ramakrishna.madhava@astraanalytical.com"),
    ("T3 Firmware", "steve.drake@astraanalytical.com"),
    ("T4 Supply Chain", "vasu@astraanalytical.com"),
    ("T5 Quality", "senthil.kumaran@astraanalytical.com"),
    ("T6 Documentation", "vijay.chilakapati@astraanalytical.com"),
]

# Sample experiments: (title, hypothesis, success_criteria, status, owner_email, track_name, days_offset)
EXPERIMENT_DEFS = [
    (
        "XRF Detector Linearity Validation",
        "The SDD detector maintains <2% linearity error across 1-40 keV range",
        "Linearity error < 2% at all calibration points",
        ExperimentStatus.IN_PROGRESS,
        "ravi.emani@astraanalytical.com",
        "T1 Device",
        30,
    ),
    (
        "Battery Thermal Runaway Prevention",
        "Firmware watchdog can detect thermal anomaly within 500ms and cut power",
        "100% detection rate in 50 simulated thermal events",
        ExperimentStatus.IN_PROGRESS,
        "gopinath.kandasamy@astraanalytical.com",
        "T3 Firmware",
        21,
    ),
    (
        "Cloud Inference Latency Benchmark",
        "Edge-to-cloud round-trip inference completes in under 200ms on 4G",
        "p95 latency < 200ms over 1000 API calls",
        ExperimentStatus.NOT_STARTED,
        "abhilash.kothapalli@astraanalytical.com",
        "T2 Cloud & AI",
        45,
    ),
    (
        "IP54 Enclosure Seal Test",
        "Updated gasket design passes IP54 water ingress test per IEC 60529",
        "Zero water ingress in 3-minute spray test at all angles",
        ExperimentStatus.COMPLETE,
        "aditya.kontheti@astraanalytical.com",
        "T5 Quality",
        -10,
    ),
    (
        "Faulhaber Motor MTBF Stress Test",
        "Motor exceeds 10,000 hours MTBF under continuous operation at 40°C",
        "No failures in 2000-hour accelerated life test",
        ExperimentStatus.BLOCKED,
        "rajendra.polavarapu@astraanalytical.com",
        "T4 Supply Chain",
        60,
    ),
    (
        "OLED Display Sunlight Readability",
        "The 2.8-inch OLED achieves >500 nits in high-ambient mode",
        "Luminance measurement >500 nits with sunlight simulation at 80klux",
        ExperimentStatus.NOT_STARTED,
        "sreekar.chilakapati@astraanalytical.com",
        "T1 Device",
        35,
    ),
    (
        "EMC Pre-Compliance Scan",
        "EB1 prototype passes conducted emissions within FCC Part 15B limits",
        "All frequencies below FCC limits with 6dB margin",
        ExperimentStatus.IN_PROGRESS,
        "ravi.emani@astraanalytical.com",
        "T5 Quality",
        14,
    ),
    (
        "OTA Firmware Update Reliability",
        "OTA update mechanism recovers gracefully from interrupted transfers",
        "100% recovery rate across 100 simulated interruptions",
        ExperimentStatus.NOT_STARTED,
        "gopinath.kandasamy@astraanalytical.com",
        "T3 Firmware",
        50,
    ),
]


# ═══════════════════════════════════════════════════════════════════════════
#  Seed Execution
# ═══════════════════════════════════════════════════════════════════════════
async def seed():
    """Main seeding coroutine."""
    print("🚀 AstraX EB1 Control Tower – Database Seeder")
    print("=" * 55)

    # ── 1. Create tables ──────────────────────────────────────────────────
    print("\n📦 Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("   ✅ Tables created.")

    async with async_session_factory() as session:
        async with session.begin():
            # ── 2. Seed Roles ─────────────────────────────────────────────
            print("\n🏷️  Seeding roles...")
            role_map: dict[RoleName, Role] = {}
            for role_name in ROLE_NAMES:
                result = await session.execute(
                    select(Role).where(Role.name == role_name)
                )
                existing = result.scalar_one_or_none()
                if existing:
                    role_map[role_name] = existing
                    print(f"   ⏭️  Role '{role_name.value}' already exists.")
                else:
                    role = Role(name=role_name)
                    session.add(role)
                    await session.flush()
                    role_map[role_name] = role
                    print(f"   ✅ Created role '{role_name.value}'")

            # ── 3. Seed Users (first pass: create without manager_id) ────
            print("\n👤 Seeding users...")
            hashed_pw = hash_password(DEFAULT_PASSWORD)
            email_to_user: dict[str, User] = {}

            for full_name, email, roles, _ in USER_DEFS:
                result = await session.execute(
                    select(User).where(User.email == email)
                )
                existing = result.scalar_one_or_none()
                if existing:
                    email_to_user[email] = existing
                    print(f"   ⏭️  User '{full_name}' ({email}) already exists.")
                    continue

                user = User(
                    email=email,
                    hashed_password=hashed_pw,
                    full_name=full_name,
                    is_active=True,
                    requires_password_change=True,
                    roles=[role_map[role_name] for role_name in roles],
                )
                session.add(user)
                await session.flush()

                email_to_user[email] = user
                role_labels = ", ".join(r.value for r in roles)
                print(f"   ✅ Created '{full_name}' ({email}) → [{role_labels}]")

            # ── 4. Second pass: assign manager_id ─────────────────────────
            print("\n🔗 Assigning reporting structure...")
            for full_name, email, _, manager_email in USER_DEFS:
                if manager_email is not None:
                    user = email_to_user[email]
                    manager = email_to_user.get(manager_email)
                    if manager:
                        user.manager_id = manager.id
                        print(f"   ✅ {full_name} → reports to {manager.full_name}")
                    else:
                        print(f"   ⚠️  Manager '{manager_email}' not found for {full_name}")

            await session.flush()

            # ── 5. Seed Tracks ────────────────────────────────────────────
            print("\n📋 Seeding tracks...")
            track_map: dict[str, Track] = {}
            for track_name, lead_email in TRACK_DEFS:
                result = await session.execute(
                    select(Track).where(Track.name == track_name)
                )
                existing = result.scalar_one_or_none()
                if existing:
                    track_map[track_name] = existing
                    print(f"   ⏭️  Track '{track_name}' already exists.")
                    continue

                lead = email_to_user.get(lead_email)
                track = Track(
                    name=track_name,
                    lead_id=lead.id if lead else None,
                )
                session.add(track)
                await session.flush()
                track_map[track_name] = track
                lead_name = lead.full_name if lead else "unassigned"
                print(f"   ✅ Created track '{track_name}' (lead: {lead_name})")

            # ── 6. Seed Experiments ───────────────────────────────────────
            print("\n🧪 Seeding experiments...")
            today = date.today()
            for (
                title,
                hypothesis,
                criteria,
                exp_status,
                owner_email,
                track_name,
                days_offset,
            ) in EXPERIMENT_DEFS:
                result = await session.execute(
                    select(Experiment).where(Experiment.title == title)
                )
                if result.scalar_one_or_none():
                    print(f"   ⏭️  Experiment '{title[:50]}...' already exists.")
                    continue

                owner = email_to_user.get(owner_email)
                track = track_map.get(track_name)

                experiment = Experiment(
                    title=title,
                    hypothesis=hypothesis,
                    success_criteria=criteria,
                    status=exp_status,
                    target_end_date=today + timedelta(days=days_offset),
                    outcome="Passed – meets all acceptance criteria" if exp_status == ExperimentStatus.COMPLETE else None,
                    next_action=(
                        "Awaiting vendor component delivery"
                        if exp_status == ExperimentStatus.BLOCKED
                        else None
                    ),
                    owner_id=owner.id if owner else 1,
                    track_id=track.id if track else None,
                )
                session.add(experiment)
                print(
                    f"   ✅ Created experiment: '{title[:50]}' "
                    f"[{exp_status.value}] → {owner.full_name if owner else 'N/A'}"
                )

            await session.flush()

    print("\n" + "=" * 55)
    print("🎉 Database seeding complete!")
    print(f"   Default password for all users: {DEFAULT_PASSWORD}")
    print("   All users require password change on first login.")
    print("=" * 55)


# ── Entrypoint ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        asyncio.run(seed())
    except KeyboardInterrupt:
        print("\n⛔ Seeding cancelled.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Seeding failed: {e}")
        raise
