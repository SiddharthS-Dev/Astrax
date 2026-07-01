# AstraX EB1 Web Dashboard Construction Spec

## Purpose
A single CEO + Program Manager control tower for AstraX EB1 covering Engineering, Program, Documentation, Supply Chain and Quality Excellence.

## Recommended Modules
1. CEO Cockpit: milestone completion, blocked items, certification risk, cash/BOM watch, distributor readiness.
2. PM Control Register: track/month/owner/status/dependency/notes with filters and escalation.
3. Engineering Excellence: EB1 bring-up, XRF quality, firmware battery/safety, cloud + AI agent value, reliability hours.
4. Documentation Excellence: IEEE-style MRS, PRS, SyRS, HRS, HW/ME/FW/SW LLD, test plans, traceability and release notes.
5. Supply Chain Excellence: Amptek/Variscite/STM/Faulhaber/Kingtech/vendor commitment, CM selection, RFQ status, DFM/DFT.
6. Quality Excellence: EB1/EB2/PB1 gates, incoming QC, pre-cert, IP54/drop/EMC/radiation compliance, defect/RMA readiness.
7. Experiment Backlog: hypothesis, success criteria, owner, target date, outcome and next action.

## Data Model
- Track: T1-T6 or functional workstream.
- Milestone: track, month, owner, status, due date, dependency, notes/risks.
- Experiment: owner, hypothesis, design, success criteria, target end date, outcome, next action.
- Gate: entry criteria, exit criteria, evidence artifact, approver, decision.
- Vendor: part/service, quote status, lead time, risk, decision, next action.
- Document: artifact type, owner, version, review status, approval evidence.

## Governance Cadence
- Daily engineering standup: blockers, experiments, commits.
- Twice-weekly PMO review: dependencies, owners, dates, documentation gaps.
- Weekly CEO control review: risk burndown, vendor decisions, certification, cash/BOM, distributor path.
- Monthly gate review: EB1 → EB2 readiness evidence and decisions.

## Next Engineering Step
Use the HTML prototype as an offline-first MVP. Then connect live data through Google Sheets, Airtable, Jira, GitHub Issues, or a lightweight FastAPI backend.
