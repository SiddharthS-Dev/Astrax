# Product Requirement Specification (PRS)

**Product:** AstraX XRF Analyzer — Benchtop Engineering Build & Handheld Product  
**Version:** v0.2  
**Status:** Living Document  
**Last Updated:** 2026-04-24  

---

## Table of Contents

1. [Product Overview & Vision](#1-product-overview--vision)
2. [System Architecture](#2-system-architecture)
3. [Analytical / XRF Requirements](#3-analytical--xrf-requirements)
4. [Test & Measurement Workflows](#4-test--measurement-workflows)
5. [Hardware Control Requirements](#5-hardware-control-requirements)
6. [Results & Data Management](#6-results--data-management)
7. [Factory & Calibration Requirements](#7-factory--calibration-requirements)
8. [Grade Matching Requirements](#8-grade-matching-requirements)
9. [Connectivity & I/O](#9-connectivity--io)
10. [Safety Requirements](#10-safety-requirements)
11. [API / Protocol Requirements](#11-api--protocol-requirements)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Compliance & Certifications](#13-compliance--certifications)
14. [UI / UX Requirements](#14-ui--ux-requirements)
15. [Pending & Future Features](#15-pending--future-features)
16. [Implementation Status Summary](#16-implementation-status-summary)
17. [Release Versioning & CI](#17-release-versioning--ci)

---

## 1. Product Overview & Vision

AstraX is a lightweight, high-performance, rugged, and ergonomic X-ray Fluorescence (XRF) analyzer designed for **metal recycling** and **Positive Material Identification (PMI)** applications. It combines advanced XRF detection capabilities with user-friendly design, connectivity, and global compliance standards.

The **AstraX BT (Benchtop)** is an engineering evaluation platform and the architectural basis for the production handheld product. Its software architecture — three-tier layering, WebSocket-JSON API, component state machines, driver abstraction — is designed to transfer directly to the handheld platform.

### 1.1 Theory of Operation

When the operator initiates a scan, the X-ray tube emits a controlled primary X-ray beam at the sample surface. Incident X-rays excite atoms within the sample, causing emission of secondary (fluorescent) X-rays characteristic of the elements present. The Silicon Drift Detector (SDD) captures these photons; the Digital Pulse Processor (DPP) digitizes the spectrum. The middleware processes the spectrum to:

- Generate an energy-dispersive spectrum (eV/channel calibrated).
- Identify elements based on characteristic energy peaks.
- Quantify elemental concentrations using calibration curves (TFR/MTF) and Fundamental Parameters algorithms.
- Match measured chemistry against a preloaded alloy grade library for PMI and recycling.

Results — elemental composition, grade identification, and spectrum — are delivered over WebSocket to the UI in **≤ 1.5 seconds**.

### 1.2 Application Scope

| Use Case | Description |
|---|---|
| Metal Recycling | Alloy identification at scrap yards and sorting facilities |
| PMI (Positive Material Identification) | Verify alloy grade on incoming/outgoing material |
| Engineering Evaluation | Validate XRF frontend, calibration, and quantification pipeline |
| Factory Calibration | Acquire multi-standard spectra and run instrument calibration |

---

## 2. System Architecture

### 2.1 Three-Tier Architecture

```
UI (Kotlin/QML, Windows/Android)
        │  WebSocket-JSON (port 8765)
        ▼
Middleware (C++17, IMX8Plus Linux)
    ├── xrfapiManager  — WebSocket-JSON API gateway
    ├── testManager    — XRF test state machine orchestrator
    ├── calcManager    — XRS spectrum quantification (wraps XRS library)
    ├── resultManager  — SQLite results database
    ├── factoryManager — Calibration method management
    ├── gradeManager   — Alloy grade library matching
    └── xrfHwManager   — Hardware abstraction layer
        │
        ▼
Driver Layer (C++, Linux)
    ├── DPPDriver       — Amptek DP5 via USB (VID 0x10C4 / PID 0x842A)
    ├── TubeDriver      — Generic X-ray tube (USB)
    ├── ScorpiusDriver  — Amptek Scorpius via USB CDC/ACM SCPI
    ├── FilterWheelDriver — Faulhaber motor/encoder via STM32G431 SPI
    └── STM32DFUDriver  — STM32G431 firmware upgrade via USB DFU
```

### 2.2 Key Architectural Constraints

- **Strict layering** — no layer skipping; UI cannot call drivers directly.
- **Single entry point** — xrfapiManager is the only external-facing API; all commands are routed through it.
- **Controller/Observer model** — exactly one client holds the controller slot; all others are read-only observers.
- **Thread safety** — all cross-thread communication via Qt signal-slot with `QMutex`/`QMutexLocker`; no lock-free code without review.
- **Qt6 LGPL v3** — dynamically linked; static linking prohibited.
- **C++17 GCC** — RAII for all resources; no exceptions across module boundaries.

---

## 3. Analytical / XRF Requirements

| ID | Requirement |
|---|---|
| XRF-01 | Support detection and quantification for elements **Mg (Z=12) through Pb (Z=82)**. |
| XRF-02 | Live chemistry results delivered to UI in **≤ 1.0 seconds** from spectrum acquisition. |
| XRF-03 | Final test results (spectrum + chemistry + grade) delivered in **≤ 1.5 seconds**. |
| XRF-04 | Energy resolution **≤ 130 eV FWHM at Mn Kα (5.9 keV)**. |
| XRF-05 | Trace element detection at **≤ 100 ppm** in metal alloys. |
| XRF-06 | Programmable filter wheel with Al and Cu filters to modulate tube output. |
| XRF-07 | Support metal alloy grade detection via onboard grade library. |
| XRF-08 | Factory calibration and reference validation using SS316 reference coin. |
| XRF-09 | Support for **metal recycling and PMI** application modes. |
| XRF-10 | Spectrum must include: num_channels, channel_data[], live_time, real_time, dead_time_percent, total_counts, ev_per_channel, timestamp. |
| XRF-11 | Energy calibration: linear model with offset (eV) and gain (eV/channel) derived from two known peaks. |
| XRF-12 | Quantification pipeline: energy calibration → smoothing → escape/sum peak removal → background subtraction → Gaussian deconvolution (LXGauss) → Fundamental Parameters (FP32). |
| XRF-13 | Single-beam and multi-beam test modes supported. |

---

## 4. Test & Measurement Workflows

### 4.1 XRF Test State Machine

States: **IDLE → SETUP → ACQUIRING → PROCESSING → STORING → STOPPING → IDLE**  
Error path: any state → **ERROR** (requires explicit reset to return to IDLE).

| ID | Requirement |
|---|---|
| TM-01 | Every state change must emit a `test.stateChanged` event to all connected clients. |
| TM-02 | Invalid state transitions must be rejected with an error response — never silently ignored. |
| TM-03 | ERROR state requires explicit reset (`test.stopXRFTest`) to return to IDLE; it cannot be bypassed. |
| TM-04 | SETUP phase: verify DPP temperature within range, clear spectrum, move filter wheel to target position, verify filter position before enabling tube. |
| TM-05 | ACQUIRING phase: enable tube, enable MCA, poll spectrum/status at `LOOP_INTERVAL_MS` (3 s) intervals for the configured acquisition duration. |
| TM-12 | SETUP phase: program DPP livetime preset via `PRET=<duration_sec>` using `dppWriteConfig` before enabling the tube. Acquisition duration is always livetime; realtime mode is not supported. |
| TM-06 | PROCESSING phase: invoke calcManager quantification on the acquired spectrum. |
| TM-07 | STORING phase: persist measurement to resultManager SQLite database. |
| TM-08 | STOPPING phase: disable tube, disable MCA — always reached on stop or error after tube was enabled. |
| TM-09 | `test.testProgress` event emitted each polling interval with interim spectrum, DPP status, chemistry, and grade result. |
| TM-10 | `test.testComplete` event emitted on completion with success flag, final spectrum ID, chemistry, and grade result. |
| TM-11 | Stop request (`test.stopXRFTest`) must be honoured within one polling interval (≤ `LOOP_INTERVAL_MS`). |

### 4.2 Calibration Check (CalCheck)

| ID | Requirement |
|---|---|
| CC-01 | CalCheck performs energy calibration using a timed acquisition against a reference sample (default: SS316, Fe Kα 6.404 keV, Mo Kα 17.443 keV). |
| CC-02 | CalCheck acquisition duration controlled by `kCalCheckAcquisitionPresetSec`; loop iteration count = `(presetSec × 1000) / LOOP_INTERVAL_MS`. |
| CC-03 | Pass 1: DPP gain tuning loop (up to `kCalCheckMaxDppGainTuneIterations` = 8 iterations) to achieve `kCalCheckTargetEvPerChannel` = 20.0 eV/ch ± 0.5%. |
| CC-04 | Pass 2: Post-gain-tune timed acquisition (same duration) to collect final calibration spectrum. |
| CC-05 | CalCheck derives offset and gain from the two configured peak energies. |
| CC-06 | `test.calCheckComplete` event payload includes: success, message, offset, gain, mn_equiv_fwhm_ev, filter_position, acquisition_preset_sec, spectrum, dpp_status, tube. |
| CC-07 | `test.saveCalCheckFactoryReference` stores reference to `factoryData/cal_check_factory_reference.json` via atomic write (QSaveFile). |
| CC-08 | `test.getCalCheckFactoryReference` returns the stored reference JSON object including `saved_at` (RFC3339 UTC). |
| CC-09 | CalCheck must not be startable while an XRF test is in progress (state ≠ IDLE). |

---

## 5. Hardware Control Requirements

### 5.1 DPP (Digital Pulse Processor — Amptek DP5)

| ID | Requirement |
|---|---|
| HW-DPP-01 | Support `hw.dpp.getConfig` — retrieve full DP5 configuration key-value pairs. |
| HW-DPP-02 | Support `hw.dpp.writeConfig` — write configuration parameters to DP5, with optional flash save. |
| HW-DPP-03 | Support `hw.dpp.enableMCA` / `hw.dpp.disableMCA` — start/stop MCA accumulation. |
| HW-DPP-04 | Support `hw.dpp.clearSpectrum` — reset channel counts to zero. |
| HW-DPP-05 | Support `hw.dpp.getSpectrum` — retrieve current 4096-channel spectrum with live_time, real_time, dead_time, total_counts, ev_per_channel. |
| HW-DPP-06 | Support `hw.dpp.getStatus` — retrieve DPP status including mca_enabled, hv, fast_count, slow_count, acc_time, real_time, detector_temp, board_temp. |
| HW-DPP-07 | Support `hw.dpp.acquireSpectrum(duration_sec)` — 10 s live-time diagnostic acquisition with progress polling. |
| HW-DPP-08 | Support `hw.dpp.exportSpectrum` — export last acquired spectrum to Amptek `.mca` ASCII file (atomic write via `.tmp` → rename). Server caches last acquired spectrum JSON to avoid re-acquisition. |
| HW-DPP-09 | DPP temperature must be within `[DPP_TEMP_MIN, DPP_TEMP_MAX]` before a test begins; CalCheck and XRF test both verify this in SETUP. |

### 5.2 X-ray Tube

| ID | Requirement |
|---|---|
| HW-TUBE-01 | Support Amptek Scorpius controller via USB CDC/ACM (SCPI command set) and generic tube driver. |
| HW-TUBE-02 | Support `hw.tube.turnOn(voltage_kv, current_ua)` — validates against configurable voltage/current limits before enabling. |
| HW-TUBE-03 | Support `hw.tube.turnOff` — always succeeds; logged with timestamp and reason. |
| HW-TUBE-04 | Support `hw.tube.getStatus` — returns voltage, current, tube temperature, fault codes. |
| HW-TUBE-05 | **Tube ON requires:** interlock satisfied, filter position valid (1–6), DPP rate limits OK, warmup complete. |
| HW-TUBE-06 | **Any** error, timeout, or client disconnect → tube OFF immediately, acquisition stops, hardware enters safe state. |
| HW-TUBE-07 | Every tube ON/OFF event logged at INFO level with timestamp and reason. Safety violations logged at FATAL level. |

### 5.3 Filter Wheel

| ID | Requirement |
|---|---|
| HW-FW-01 | Support `hw.fw.goToPosition(position)` — moves to filter position 1–6. |
| HW-FW-02 | Support `hw.fw.getPosition` — returns current encoder position and filter index. |
| HW-FW-03 | Support `hw.fw.home` — drives filter to mechanical stop (home = position ZERO). |
| HW-FW-04 | Support `hw.fw.getStatus` — returns current position, target, and motion state. |
| HW-FW-05 | Filter positions: 1 = Home (open), 2 = Al 100 µm, 3 = Cu 100 µm; positions 4–6 application-defined. |
| HW-FW-06 | Filter position must be verified before tube turn-on; mismatch is a hard error. |

### 5.4 STM32G431 Firmware Upgrade

| ID | Requirement |
|---|---|
| HW-MCU-01 | STM32DFUDriver supports DFU firmware upgrade over USB using libgpiod v2 GPIO control. |
| HW-MCU-02 | No external GPIO bundle dependency; GPIO toggled inline via libgpiod. |

---

## 6. Results & Data Management

| ID | Requirement |
|---|---|
| RS-01 | All measurements stored in SQLite with atomic transactions. |
| RS-02 | Measurements table: spectrum_id (PK), sample_id, crm_id, tube settings, filter_position, calibration_id, suggested_grade, grade_confidence, timestamps. |
| RS-03 | Element results table: spectrum_id (FK), atomic_number, symbol, concentration, concentration_error, intensity, units. |
| RS-04 | Spectrum table: spectrum_id (FK), num_channels, channel_data (BLOB of int64 counts), live_time, real_time, dead_time_percent, total_counts, ev_per_channel, timestamp. |
| RS-05 | Energy calibration stored with: low_channel, low_energy_ev, high_channel, high_energy_ev. |
| RS-06 | Support `results.getList` — returns list of spectrum_ids with summary metadata. Each entry carries `{spectrum_id, test_id, test_id_seq, date_time, calibration_id}` so the UI Results-list cards can render captions without an N+1 `results.getInfo` hop. |
| RS-07 | Support `results.getInfo(spectrum_id)` — returns measurement summary. |
| RS-08 | Support `results.getMeasurement(spectrum_id)` — returns full measurement including spectrum, chemistry, calibration, grade. |
| RS-09 | Support `results.store` — explicitly persist a result (also called automatically at end of XRF test). |
| RS-10 | Support `results.export(spectrum_ids[], format, output_path)` — export in MCA, CSV, or JSON format. |
| RS-11 | Support `results.delete(spectrum_id)` — remove measurement from database. |
| RS-12 | Export files use **atomic write** (write to `.tmp` in same directory, then `rename()`). Never write directly to final path. |
| RS-13 | Export formats: **MCA** (Amptek ASCII with metadata + calibration + DP5 config), **CSV** (UTF-8, tabular element results), **JSON** (structured with full measurement object). |
| RS-14 | Database daily backups; retain 7 days of backups. |
| RS-15 | DPP configuration captured and stored alongside each spectrum for reproducibility. |
| RS-16 | Compare CRM: results view supports displaying measured vs certified concentrations from a method standard. |
| RS-17 | A-vs-B spectrum overlay: results view supports overlaying a second stored result's spectrum on the currently selected one, with a Subtract B from A toggle for difference inspection. |
| RS-18 | Compare calibration: results view supports overlaying the calibration reference spectrum used for the selected result. `factory.calibration.getReferenceSpectra(calib_id)` returns all acquired standard spectra from the calibration run. When the calibration has multiple standards a picker dialog is shown; single-standard calibrations load immediately. Reference data is keyed by the `<calibId>.calref.json` index written atomically at `factory.calibration.run` completion. |

---

## 7. Factory & Calibration Requirements

| ID | Requirement |
|---|---|
| FC-01 | Factory Manager supports create, list, get, delete of **calibration method files** (JSON, stored under `{methodsDir}/{methodId}.json`). |
| FC-02 | Method file schema: id, name, elements[], default_beam, standards[] with concentrations per element. |
| FC-03 | Support `factory.calibration.acquire(method_id, standard_index)` — acquire one spectrum for a given standard with optional beam override. |
| FC-04 | Acquired spectra persisted to `{methodId}.acquired.json`; updated after each successful acquisition. |
| FC-05 | Support `factory.calibration.acquisitionStatus(method_id)` — returns per-standard acquisition state (pending / acquired / failed). |
| FC-06 | Support `factory.calibration.run(method_id, calib_id, cal_mode)` — run multistandard calibration with 120 s timeout; outputs `MTF_Calibration_{calib_id}.csv` and binary calibration data. |
| FC-07 | Support `factory.calibration.list(calib_dir)` — list calibrated methods from TFR filenames and MTF CSV entries. |
| FC-08 | Support `factory.calibration.load(calib_id, method_id?)` — load calibration into calcManager for live test/quantification. |
| FC-09 | TFR format supports both TFR-based (legacy) and CSV-based (multistandard) load paths. |
| FC-10 | Factory data (baselines, references, golden spectra) stored under `factoryData/` (default: `QStandardPaths::GenericDataLocation/astrax_bt/factoryData`). |
| FC-11 | Support `factory.spectrum.process(spectrum, calibration_id)` — offline quantification of a provided spectrum. |
| FC-12 | Support `factory.tfr.parse` and `factory.tfr.settingsSave` for TFR file management. |
| FC-13 | Support `factory.fp.settingsSave` / `factory.fp.settingsLoad` — persist Fundamental Parameters settings (lowest Z, FP iterations, convergence, FWHM). |
| FC-14 | Support `factory.calibration.loadOffline` and `factory.calibration.getSpectrum` for offline calibration workflows. |
| FC-15 | Support `factory.mtf.get` — retrieve current MTF calibration table. |
| FC-16 | FP settings refreshed on System Settings tab switch in UI. |
| FC-17 | **Tube Startup Test** — `factory.tube.startupTest(target_kv, target_ua, num_tries, tube_duration_ms)` executes repeated on/off cycles on the factory worker thread, sampling `tubeGetStatus` every 10 ms, and measures the elapsed time until V and I are within ±2 % of target. Events emitted over WebSocket: `factory.tube.testBatch` (100 ms batches of `{elapsed_ms, voltage_kv, current_ua, within_spec}` per try), `factory.tube.testTryComplete` (`try_index`, `startup_ms`, `stabilized`), and `factory.tube.testComplete` (`success`, `avg_startup_ms`, `try_results[]`, `message`). `factory.tube.stopStartupTest` terminates the loop early. UI exposed as "Tube Test" tab in HW Setup with target kV/µA, number of tries, on-duration SpinBoxes, Run/Stop buttons, and a dual-axis V/I time-series chart. |

---

## 8. Grade Matching Requirements

| ID | Requirement |
|---|---|
| GM-01 | GradeManager matches measured chemistry against certified composition limits in a JSON grade library. |
| GM-02 | Grade matching invoked on every chemistry update (interim `testProgress` events and final result). |
| GM-03 | Final grade result (suggested_grade, grade_confidence) stored in the results database alongside chemistry. |
| GM-04 | Grade library format: `factoryData/{library_id}.grades.json` with schema_version, standards_body, source, application_type, grades[]. |
| GM-05 | Per-grade schema: id, name, aliases[], note, elements[] with symbol, min, max, balance flag. |
| GM-06 | **Element matching rules:** balance elements always pass if measured; null min/max allows open-ended constraints; unmeasurable elements (C, P, S, Si, Al with Be window) silently skipped. |
| GM-07 | Per-element delta: signed deviation from nearest violated limit (0.0 if in-spec; null if skipped). |
| GM-08 | Confidence score: fraction of evaluable (measurable, spec-defined) elements that pass. |
| GM-09 | Best match: highest-confidence all-pass grade; if none passes outright, highest confidence overall. |
| GM-10 | Near matches: grades failing on ≥ 1 element but otherwise close, returned alongside best match. |
| GM-11 | UI color coding — Green: within inner 70% of range; Orange: outer 15% of range; Red: outside min/max; Grey: no spec or unmeasurable. |
| GM-12 | Shipped libraries (read-only): `astm_stainless` (ASTM-304, 304L, 316, 316L, 310, 410), `ni_superalloys` (Inconel 625, 718, 825, Waspaloy, Hastelloy C276), `pure_metals` (PURE-CU, PURE-NI, PURE-FE), `scrt_alloy_library` (SCRT CRM grades including steels, Al alloys, brass). |
| GM-13 | `grade.listLibraries` returns: library_id, name, standards_body, source, grade_count. |
| GM-14 | `grade.match(library_id, chemistry[])` returns: best_match, matches[] with grade_id, overall_pass, confidence, elements with delta and color. |
| GM-15 | Libraries are independent of calibration method; user selects library at test time. |

---

## 9. Connectivity & I/O

### 9.1 Network

| ID | Requirement |
|---|---|
| CONN-01 | WebSocket server on port 8765 (default); configurable at startup. |
| CONN-02 | mDNS (Avahi) service advertisement: `AstraX-{serial}._astrax._tcp.local` for zero-configuration device discovery on the local subnet. |
| CONN-03 | Wi-Fi: adapter enable/disable, network scan, connect/disconnect, saved network management (My Networks / Other Networks). |
| CONN-04 | Wi-Fi: 30 s authentication failure watchdog; emits `connectivity.wifi.authFailure` event if connection does not reach `active` state within 30 s. |
| CONN-05 | Wi-Fi: inline "Forget This Network" on connected network card. |
| CONN-06 | Bluetooth: adapter enumeration, device scan with RSSI-descending sort, link state tracking (pending → active). |
| CONN-07 | Bluetooth: BT tab visible but disabled until full BT flow is wired. |

### 9.2 Physical I/O (Handheld Product)

| ID | Requirement |
|---|---|
| IO-01 | 2× USB 3.0: one for power, one for external mass storage or PC. |
| IO-02 | Inline camera facing the sample. |
| IO-03 | 2.4-inch capacitive color touchscreen, QVGA minimum, sunlight-readable, ALS for auto brightness. |
| IO-04 | Power On/Off button with LED feedback. |
| IO-05 | Prominent radiation LED (highly visible) active during tube operation. |
| IO-06 | Manual trigger button for scan initiation and abort. |
| IO-07 | 2-way + OK NAV control for glove-compatible navigation. |
| IO-08 | Basic speaker for audio alerts during X-ray emission. |

### 9.3 Cloud Sync (syncManager)

Pushes device test results to the astraX cloud per the contract at `syncManager/docs/syncmanager-cloud-knowledge-graph.json`. **Stateless on-device** — the cloud's `GET /api/devices/{id}/last-event` is the single source of truth for "what has been synced"; no local outbox or sync-state DB.

| ID | Requirement |
|---|---|
| SYNC-01 | Outbound HTTPS POST to `/api/test-result`, signed with HMAC-SHA256 over the canonical string `POST\n/api/test-result\n<X-Timestamp>\n<SHA256_HEX(body_bytes)>`. Headers: `X-Device-ID`, `X-Timestamp` (ISO 8601 UTC), `X-Signature` (lowercase hex). |
| SYNC-02 | Idempotency key is `(device_id, test_id)`; cloud returns `201 stored` for new results and `200 duplicate` for re-pushes. Both are treated as success. |
| SYNC-03 | `test_id` field on the wire is `str(test_id_seq)` from resultManager (per-DB 1-based monotonic counter). **Known limitation:** wiping the local DB resets `test_id_seq` and may collide with prior cloud records — factory-reset workflows must rotate `device_id` or coordinate cloud-side purge. |
| SYNC-04 | Body shape mirrors `astrax_results_export_chemistry`: chemistry-only by default, opt-in spectrum (base64-encoded channel data) via config flag `include_spectrum`. Top-level `device_id` MUST NOT appear in body. |
| SYNC-05 | HMAC body bytes are computed once (`QJsonDocument::Compact`) and reused for hashing AND posting; never re-serialized. |
| SYNC-06 | Triggers (all call `attemptSync` via `Qt::QueuedConnection`): `ResultsManager::measurementStored`, `PlatformManager::internetConnectivityChanged == "internetOnline"`, manual WS `sync.push`. Manual is the primary UX. **No periodic timer.** |
| SYNC-07 | Cycle: `GET /api/status` (clock-skew detect from `Date:` header — fail if drift >60s) → `GET /api/devices/{id}/last-event` → `resultManager.getList(date_from=cursor)` → per-row push, oldest-first. |
| SYNC-08 | Per-cycle cap: 100 rows (configurable, range [1, 1000]). On cap-hit success, syncManager self-rearms one more `attemptSync` to drain the backlog without operator intervention. |
| SYNC-09 | **Stop on any non-2xx.** `400` (poison body), `401` (auth), `403` (device not active), `409` (timestamp conflict), `5xx` (transient), and timeouts all stop the cycle and transition to `Error`. Forward progress requires manual operator intervention to remove the offending row. |
| SYNC-10 | Configuration at `/etc/astrax/sync.json` (mode `0600`, root-owned). Required: `device_id` (UUID), `secret` (string ≥32 chars; used as **raw UTF-8 bytes** for the HMAC key per cloud KG `hmac-signing.notes` "do not hash/derive the secret before HMAC signing"), `base_url` (https only). Hot reload via WS `sync.reloadConfig`. |
| SYNC-11 | Secrets handling: never log the secret; INFO log emits a SHA256 fingerprint on load so reloads can be verified. TPM, encryption-at-rest, and rotation are deferred. |
| SYNC-12 | WS API surface: methods `sync.push`, `sync.status`, `sync.reloadConfig`, `sync.cancel`, `sync.setAutoSync`; events `sync.stateChanged`, `sync.progress`, `sync.complete`, `sync.cancelled`, `sync.error`. State machine: `notConfigured` → `idle` ↔ `syncing` ↔ `error`. `sync.cancel` is a hard abort — it calls `QNetworkReply::abort()` on the in-flight request and the cycle exits at its next yield point. The terminal event is `sync.cancelled{count, durationMs}` with `count` = rows that finished POST before the abort; state ends `idle` (NOT `error` — cancel is a user action). `sync.cancel` returns `{accepted: false, reason: "not in flight"}` when no cycle is running. |
| SYNC-18 | **Auto-sync is opt-in.** `sync.json` exposes a single `auto_sync` boolean (default `false`). When `true`, all three auto-triggers in `xrfapi_server.cpp` (`measurementStored`, `internetConnectivityChanged → "internetOnline"`, `wifiLinkConnected`) queue a sync push; when `false`, they log at DEBUG and return without pushing. Manual `sync.push` (the SYNC NOW button) is unaffected. Toggleable from the Settings page via WS method `sync.setAutoSync({enabled: bool})` which atomically rewrites `sync.json` (QSaveFile temp+rename, preserving all other fields and file permissions) and reloads via the existing `reloadConfig` flow synchronously before returning. The toggle is exposed in `sync.status` as `autoSync: bool`. |
| SYNC-13 | Error code range `-400..-499` (extends after HWManager's `-300..-399`). Error categories: `transient`, `auth`, `deviceNotActive`, `deviceNotRegistered`, `poison`, `clockSkew`, `timestampConflict`, `configInvalid`. |
| SYNC-14 | Shutdown order: API → TestManager → **syncManager** → ResultsManager → FactoryManager → CalcManager → HWManager. |
| SYNC-15 | **Cursor 404 stops the cycle.** Per cloud KG `sync_sequence` step 3, a 404 on `GET /api/devices/{id}/last-event` means the device is not registered cloud-side. syncManager surfaces this as category `deviceNotRegistered` (code `-422`) and emits zero `/api/test-result` POSTs that cycle. Earlier behavior treated 404 as "epoch start" and produced ~`maxPerCycle` wasted POSTs that all 401'd. |
| SYNC-16 | **HTTP 409 timestamp conflict.** `409` from `/api/test-result` maps to category `timestampConflict` (code `-413`); operator action is to inspect the snapshot timestamp / cursor handling for the offending row, not to retry blindly. |
| SYNC-17 | `sync.status.pendingCount` is **`-1` when the cloud cursor is unknown** (cold start before any successful cycle). Returning the unfiltered local row count would mislead the operator into thinking nothing has been synced. The cursor is populated on the first successful cycle (manual `sync.push` or the connectivity-online auto-trigger), after which `pendingCount` reports the true backlog. |

WS schemas: `proto/sync.{push,status,reloadConfig}.{request,response}.schema.json` and `proto/sync.{stateChanged,progress,complete,error}.event.schema.json`.

---

## 10. Safety Requirements

| ID | Requirement | Priority |
|---|---|---|
| SAF-01 | Tube ON requires: interlock satisfied, explicit command, bounded session, validated filter position (1–6), DPP rate limits OK, warmup complete. | Critical |
| SAF-02 | Any error, timeout, or client disconnect → tube OFF immediately, acquisition stops, hardware enters safe state. | Critical |
| SAF-03 | Exactly one controller client at a time; X-ray emission forbidden without an active controller. | Critical |
| SAF-04 | Controller disconnection triggers immediate safe shutdown with FATAL-level logging. | Critical |
| SAF-05 | Safety violations logged at FATAL level; every tube ON/OFF logged with timestamp and reason. | Critical |
| SAF-06 | Thermal management: automatic safe shutdown at detector temperature > 50 °C. | Critical |
| SAF-07 | Radiation LED active whenever tube is on; must be visible from front and sides of device. | High |
| SAF-08 | Audio feedback (speaker) while X-rays are active. | High |
| SAF-09 | Trigger interlock — X-ray cannot be enabled when trigger is not engaged. | High |
| SAF-10 | Prominent radiation warning label on device body. | High |
| SAF-11 | X-ray emissions compliant with AERB (India), IEC, ANSI N43.3. | High |
| SAF-12 | **AirShot detection** — detect when the device is triggered without a sample present; suppress or warn. *(Pending)* | High |
| SAF-13 | **RAD LED control** — dedicated radiation LED commanded by middleware on tube state changes. *(Pending)* | High |
| SAF-14 | Observer clients receive state events but cannot issue any hardware command. | Medium |

---

## 11. API / Protocol Requirements

### 11.1 WebSocket Envelope

All messages use the mandatory envelope:

```json
{
  "v":      "1.0",
  "type":   "Request | Response | Event",
  "id":     "<UUID-v4 | null for events>",
  "ts":     "<RFC3339 UTC>",
  "method": "<component.function>",
  "params": {},
  "result": {},
  "error":  { "code": -1, "message": "..." }
}
```

### 11.2 Method Naming

`{component}.{function}` — e.g., `test.doXRFTest`, `hw.dpp.getStatus`, `grade.match`.

### 11.3 Complete API Method Inventory

| Component | Methods |
|---|---|
| **test** | `doXRFTest`, `stopXRFTest`, `doCalCheck`, `saveCalCheckFactoryReference`, `getCalCheckFactoryReference`, `getLastCalCheckResult`, `getStatus` |
| **hw.dpp** | `getConfig`, `writeConfig`, `enableMCA`, `disableMCA`, `clearSpectrum`, `getSpectrum`, `getStatus`, `acquireSpectrum`, `exportSpectrum` |
| **hw.tube** | `getStatus`, `turnOn`, `turnOff` |
| **hw.fw** | `getStatus`, `goToPosition`, `getPosition`, `home` |
| **results** | `getList`, `getInfo`, `getMeasurement`, `store`, `export`, `delete` |
| **factory.method** | `list`, `get`, `create`, `delete` |
| **factory.calibration** | `acquire`, `acquireAll`, `acquisitionStatus`, `run`, `load`, `list`, `loadOffline`, `getSpectrum` |
| **factory.spectrum** | `process` |
| **factory.tfr** | `parse`, `settingsSave` |
| **factory.fp** | `settingsSave`, `settingsLoad` |
| **factory.mtf** | `get` |
| **factory.tube** | `startupTest`, `stopStartupTest` |
| **grade** | `listLibraries`, `match` |
| **connectivity.wifi** | `listAdapters`, `listNetworks`, `connect`, `disconnect`, `enable`, `disable`, `forgetNetwork` |
| **connectivity.bt** | `listDevices`, `pair`, `unpair` |
| **connectivity.adapter** | `enable`, `disable` |
| **log** | `setLevel`, `clearOverride`, `listCategories` (per-category runtime log-level control; allowed for both controller and observer roles. Four levels — `debug < info < warn < error`, default `warn`. Levels persist to `/var/lib/astrax/log_levels.json`. Schemas in `/proto/log-*.{request,response}.schema.json`.) |
| **system** | `version` — returns the server's compile-time version surface: `{version: "X.Y.Z" \| "X.Y.Z-bN", build_sha: "<short SHA>", build_type: "Debug \| Release \| ...", build_number: <int>}`. Production builds (built from `main` at a `v*` tagged commit) report clean `X.Y.Z`; all other builds carry a `-bN` build-number suffix (CI: `GITHUB_RUN_NUMBER`; local: `git rev-list --count HEAD`). Allowed for both controller and observer roles — read-only, no side effects. The UI fetches this automatically on connect and surfaces both client + server values in the About panel. Same data is also available via the binaries' `--version` flag (`xrfapi_server --version`, `xrf_qml_client --version`). |

### 11.4 Error Code Ranges

| Range | Component |
|---|---|
| -1 … -99 | Generic API errors |
| -100 … -199 | TestManager |
| -200 … -299 | ResultManager |
| -300 … -399 | HardwareManager |

### 11.5 Common Error Codes

| Code | Meaning |
|---|---|
| -1 | Invalid request |
| -2 | Method not found |
| -3 | Invalid parameters |
| -4 | Component not initialized |
| -5 | Operation failed |
| -6 | Timeout |
| -7 | Resource busy |

### 11.6 Server-Push Events

| Event | Trigger |
|---|---|
| `test.stateChanged` | Test state machine transition |
| `test.testProgress` | Interim spectrum + chemistry update |
| `test.testComplete` | Test finished (success or failure) |
| `test.testError` | Unrecoverable test error |
| `test.calCheckComplete` | CalCheck finished |
| `session.controllerSlotTaken` | Second controller attempts connection |
| `session.controllerSlotAvailable` | Controller disconnects |
| `connectivity.wifi.*` | Wi-Fi state change events |
| `connectivity.bt.*` | Bluetooth state change events |
| `log.levelChanged` | Successful `log.setLevel` or `log.clearOverride` (broadcast to all clients) |

---

## 12. Non-Functional Requirements

### 12.1 Performance

| ID | Requirement |
|---|---|
| NFR-01 | Chemistry result delivered to UI **≤ 1.0 s** after spectrum is ready. |
| NFR-02 | Test start to first result **≤ 1.5 s** (excluding hardware setup time). |
| NFR-03 | Boot to Test Ready screen **≤ 40 s**. |
| NFR-04 | MTBF **≥ 5000 scans/tests**. |
| NFR-05 | WebSocket server handles multiple concurrent clients; only one controller. |
| NFR-06 | Spectrum UI throttled to ≤ 30 FPS for rendering efficiency. |

### 12.2 Hardware / Physical

| ID | Requirement |
|---|---|
| NFR-07 | Operating temperature: **−10 °C to +50 °C**. |
| NFR-08 | Total weight with battery: **< 3 lbs (1.36 kg)**. |
| NFR-09 | Battery: Li-Ion, **≥ 8 hours** continuous operation at 30% active scan cycle. |
| NFR-10 | Ruggedization: **IP54** (dust and splash resistant). |
| NFR-11 | Drop resistance: **1 m drop on concrete**. |
| NFR-12 | External detector window: Prolene or Kapton. |
| NFR-13 | Battery swappable in the field. |

### 12.3 Software Quality

| ID | Requirement |
|---|---|
| NFR-14 | C++17, GCC; Qt6 dynamically linked (LGPL v3). |
| NFR-15 | RAII for all resources; no exceptions across module boundaries. |
| NFR-16 | All middleware cross-thread communication via Qt signal-slot; `QMutex`/`QMutexLocker` for shared state. |
| NFR-17 | No `std::cout`/`std::cerr` in Qt code — use `qDebug`/`qInfo`/`qWarning`/`qCritical`. |
| NFR-18 | Structured logging: `[RFC3339] [LEVEL] [COMPONENT] [SESSION_ID] MESSAGE [DATA]`. |
| NFR-19 | No raw stack traces in API error responses. |
| NFR-20 | aarch64 cross-compile clean; all warnings treated as errors (`-Werror`). |
| NFR-21 | Atomic file writes (`.tmp` → `rename()`) for all persistent data files. |

### 12.4 Power Modes

| Mode | Description |
|---|---|
| Performance Mode | Maximum responsiveness; full CPU/hardware clock speeds. |
| Battery Saver Mode | Reduced power consumption; extended operation time. |

---

## 13. Compliance & Certifications

| Category | Standard / Body |
|---|---|
| Radiation Safety | AERB (India), IEC, ANSI N43.3 |
| Electrical Safety | IEC 61010 |
| EMC | CE, FCC, BIS (India) |
| Battery Safety | UN 38.3, UL 2054 |
| Environmental | RoHS, WEEE |
| OTA Update | Secure code signing required for SW/FW/OS updates |

---

## 14. UI / UX Requirements

### 14.1 General

| ID | Requirement |
|---|---|
| UI-01 | Simple, intuitive UI optimized for glove use. |
| UI-02 | Home screen defaults to Test Ready Mode. |
| UI-03 | Glove-friendly navigation: 2-way + OK NAV control. |
| UI-04 | Token-driven theming via the `AstraX.Theme` QML singleton. Default light palette (GitHub Primer-derived: accent `#0969da`, success `#1a7f37`, error `#cf222e`); operator-selectable dark variant (accent `#2f81f7`, success `#3fb950`, error `#f85149`). All text/background pairs meet WCAG AA contrast (≥ 4.5:1 for body text). |
| UI-05 | Real-time display of: spectrum chart, chemistry table, detected alloy grade, sample image. |
| UI-06 | Support custom USER fields on measurements. |
| UI-07 | Benchtop UI (QML/Kotlin) runs on Windows PC. |
| UI-08 | Settings page exposes a Light / Dark / System theme toggle. The selection persists across launches via `QSettings` (key `ui/theme/mode`). The "System" mode follows the operating system's colour scheme via `QStyleHints::colorScheme` and updates live when the OS toggles. Default on first launch: Light. |

### 14.2 Navigation Structure

1. **Summary Dashboard** — hardware status cards (tube, DPP, filter wheel, temperatures), connectivity status.
2. **Live Measurement** — test control, spectrum chart, real-time chemistry table, grade badge.
3. **Results & Export** — result list with checkboxes, result detail (metadata, spectrum, chemistry, grade), batch export.
4. **Hardware Setup (HW Setup)** — DPP config/status, tube status, filter wheel position, DPP spectrum view with Export MCA.
5. **Calibration View** — method list, acquire standards, run calibration, load calibration, MTF table.
6. **Connectivity** — Wi-Fi (adapter toggle, scan, saved networks), Bluetooth (device list, pair).
7. **Settings** — DPP Setup, Tube Setup, Filter Wheel Setup, chart options, export paths.

### 14.3 Key Screen Requirements

**Live Measurement:**
- Control pane: Tube kV/µA, filter position selector, acquisition time, Start/Stop button.
- Spectrum pane: energy/channel X-axis toggle, linear/log Y-axis toggle, zoom/pan, cursor readout.
- Result pane: element table (symbol, concentration, error, status), detected grade badge with confidence and color-coded deltas.

**HW Setup — DPP Status:**
- DPP status fields: MCA Enabled, HV, Fast Count, Slow Count, Acc Time, Real Time, Det Temp, Board Temp.
- "Refresh (10s Live)" button: triggers 10 s live diagnostic acquisition.
- "Export MCA" button (left of Refresh): exports current spectrum to `.mca` file; disabled while acquiring or no spectrum loaded.
- DPP spectrum chart with SpectrumChartToolbar (Y mode, X energy toggle).

**Results View:**
- Grade badge: grade name, PASS/FAIL, confidence %, near-match dropdown.
- Chemistry table: Element / Meas% / Spec / Δ columns with color-coded bars.
- Compare CRM panel: measured vs certified concentrations from method standard.
- Compare spectrum: overlay another stored result on the current one; Subtract B from A toggle for difference inspection.
- Compare calibration: overlay the calibration reference spectrum used for the selected result. Button enabled when `calibrationId` is non-empty; opens a standard picker (auto-selects when calibration has one standard). Reference spectrum fetched via `factory.calibration.getReferenceSpectra(calib_id)`, which reads the `<calibId>.calref.json` index written at calibration run time.

**Calibration View:**
- Method list with green dot (calibrated) and LOADED badge (active).
- Per-method panel: name, application, standards acquired/total, acquire/run/load actions.
- Calibration run with Calib ID input; load calibration dropdown.

---

## 15. Pending & Future Features

The following features are defined in the product roadmap but not yet implemented.

### 15.1 Pending (Engineering Build Scope)

| Feature | Description | Priority |
|---|---|---|
| **SOM I/O** | Display control, USB host enumeration, Wi-Fi management, Bluetooth management via SOM GPIO/peripheral layer. | High |
| **SW / FW Upgrade (OTA)** | Over-the-air updates for application software, DPP firmware, and OS image; secure code signing. | High |
| **Battery Management** | Battery state-of-charge monitoring, low-battery warnings, battery swap detection, Performance/Saver mode switching. | High |
| **Trigger Integration** | Physical trigger button: press to start test, release/hold to stop; trigger interlock enforced in safety layer. | High |
| **Safety — AirShot Detection** | Detect test fired without sample present (by spectral signature or count-rate threshold); warn or suppress result. | High |
| **Safety — RAD LED Control** | Dedicated radiation LED commanded by middleware on every tube ON/OFF transition; fail-safe default ON. | High |
| **Grade Library CRUD** | `grade.library.clone`, `grade.library.update`, `grade.library.delete` API for user-editable custom libraries (shipped libraries read-only). | Medium |
| **Near-Match Threshold Setting** | Configurable confidence threshold for near-match reporting (default 0.6); persisted in device config. | Medium |
| **304/304L / 316/316L Disambiguation** | Warning when best match is ambiguous due to unmeasured C content. | Medium |
| **Additional Grade Libraries** | EN 10088, JIS, IS 6911, ASME stainless; Ti-6Al-4V and titanium alloys; cobalt-base alloys (Stellite, Haynes). | Medium |

### 15.2 Future (Post-Engineering Build)

| Feature | Description |
|---|---|
| **AI-Driven Chemistry Predictions** | ML-assisted element concentration prediction for complex or overlapping alloy families. |
| **Result Averaging** | Average N consecutive measurements to improve precision. |
| **Pseudo Elements** | Virtual element grouping (e.g., Fe-balance, combined light elements). |
| **PDF Certificate Export** | One-page test certificate with grade ID, chemistry table, spectrum thumbnail, and device serial. |
| **AI / Fuzzy Grade Matching** | Fuzzy grade identification for ambiguous or novel alloy compositions. |
| **Cross-Subnet Discovery** | mDNS proxy or push-to-discovery-server for devices not on the same subnet. |
| **Cloud Sync — UI surface + live-cloud validation** | syncManager skeleton + cycle algorithm + WS API are implemented (see §9.3). Remaining: in-product UI for `sync.push` / `sync.status`, end-to-end validation against the staging cloud, and secrets-rotation/TPM integration. |
| **Secure User Login** | User account management with role-based access (operator / engineer / admin). |
| **Hardware Accessories** | Charging dock, carry holster, external battery pack ecosystem. |

---

## 16. Implementation Status Summary

| Area | Implemented | Pending / Partial |
|---|---|---|
| XRF Test State Machine | ✅ All states, events, stop, error | — |
| CalCheck | ✅ Gain tuning, factory reference save/get | ⚠️ Loop timing bug (use `presetSec × 1000 / LOOP_INTERVAL_MS`) |
| DPP API | ✅ All 9 methods including exportSpectrum | — |
| Tube API | ✅ turnOn, turnOff, getStatus | — |
| Scorpius Driver | ✅ SCPI over USB CDC/ACM | — |
| Filter Wheel API | ✅ All 4 methods | — |
| STM32 DFU | ✅ libgpiod v2, no external bundle | — |
| Spectrum Quantification | ✅ FP32, LXGauss, energy cal | — |
| Multistandard Calibration | ✅ Method CRUD, acquire, run, load | — |
| Tube Startup Test | ✅ FC-17: 10 ms poll loop, batch events, V/I chart, average startup time | — |
| Grade Matching | ✅ JSON library, match API, UI badge | ⚠️ Library CRUD (clone/edit) pending |
| Results Storage | ✅ SQLite, all CRUD + export | — |
| Export Formats | ✅ MCA, CSV, JSON | — |
| Cloud Sync (syncManager) | ✅ HMAC-SHA256 POST, stateless cycle, 3 triggers, WS API | ⚠️ Live-cloud integration testing pending; secrets management (TPM/rotation) deferred |
| Wi-Fi | ✅ Scan, connect, saved networks, auth watchdog | — |
| Bluetooth | ✅ Scan, RSSI sort, link state | ⚠️ BT tab disabled (full flow pending) |
| mDNS Discovery | ✅ Avahi `_astrax._tcp` | — |
| Controller/Observer Security | ✅ Exclusive controller slot | — |
| Safety (tube interlock) | ✅ Disconnect → tube off, state machine guard | — |
| Runtime Log-Level Config | ✅ Per-category routing, `log.setLevel/clearOverride/listCategories`, sticky overrides, persistence at `/var/lib/astrax/log_levels.json`, broadcast `log.levelChanged` event, default level `warn`. QML UI under Settings → Log levels (default-tier panel + sectioned table, server-authoritative model, severity-dotted dropdowns). Drivers using vendor printf/cout (DPP/Tube/FilterWheel/Scorpius) not yet on Qt categories. | ⚠️ Vendor-driver migration pending |
| Theming (UI-04, UI-08) | ✅ `AstraX.Theme` QML singleton with Light + Dark palettes (Primer-derived, WCAG-AA contrast), 30 colour tokens + typography / spacing / radius / control-size scales. C++ `ThemeManager` persists `mode` ∈ {Light, Dark, System} via `QSettings` and watches `QStyleHints::colorSchemeChanged`. Settings page exposes the segmented toggle and is reachable offline. 11 control wrappers under `qml/controls/` (AppButton with primary/secondary/destructive/success/ghost variants, AppToggleButton, AppTextField, AppComboBox, AppLabel role × tone, AppCard, AppStatusPill, AppDivider, AppIconButton, AppCheckBox, AppScrollBar). 243 Label sites + 57 Button sites + 18 CheckBox sites + 44 TextField sites + 10 ComboBox sites + 10 ListView scrollbars converted to wrappers. 6 Canvas elements repaint on theme change. | — |
| SOM I/O | ❌ Not started | Pending |
| OTA SW/FW Upgrade | ❌ Not started | Pending |
| Battery Management | ❌ Not started | Pending |
| Trigger Integration | ❌ Not started | Pending |
| AirShot Detection | ❌ Not started | Pending |
| RAD LED Control | ❌ Not started | Pending |
| Grade Library CRUD | ❌ Not started | Pending |
| Release Versioning & Version Surface | ✅ Policy ratified — root SemVer in `CMakeLists.txt`, prod string `X.Y.Z`, dev string `X.Y.Z-b<N>` (see `Docs/RELEASE-AND-CI.md` and top-level `CHANGELOG.md`). Generated `common/include/astrax_version.h` from CMake `project(astraX_BT VERSION ...)`. `--version` CLI flag on `xrfapi_server` and `xrf_qml_client` (clean `X.Y.Z` on tagged builds, `X.Y.Z-bN` otherwise; build number from `GITHUB_RUN_NUMBER` env or `git rev-list --count HEAD`). WS method `system.version` returning `{version, build_sha, build_type, build_number}` (allowed for controller + observer roles). UI: `XRFTestClient.clientVersion` (CONSTANT, compile-time) + `XRFTestClient.serverVersion` (hydrated via auto-`system.version` on connect); AboutView under footer-nav next to Settings displays both. CTest coverage in `xrfapi_server_version`, `xrf_qml_client_version`, and `test_xrfapi_protocol`. | — |

---

## 17. Release Versioning & CI

astraX_BT follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) at the root project level. The full convention — bump rules, version-string formats (`X.Y.Z` for production builds from `main`, `X.Y.Z-b<N>` for dev builds), build-number sourcing (GitHub Actions `run_number` with `git rev-list --count HEAD` fallback), release & hotfix workflows, CHANGELOG mechanics, and CI flow expectations — is documented in **[`Docs/RELEASE-AND-CI.md`](../../Docs/RELEASE-AND-CI.md)**, which is the authoritative source.

This section exists so the PRS records the existence of the policy and the surfaces it produces: the WS method `system.version`, the startup log line, and the annotated git tag `vX.Y.Z` on `main`. Behavioural changes to those surfaces require a PRS update under this section.

---

*This document is generated from project architecture docs, component specifications, and git commit history. Sources: `Docs/XRF-Benchtop-App-Overall-Spec-Latest.md`, `testManager/docs/CalCheck-Spec.md`, `factoryManager/docs/CALIBRATION-FEATURE-SPEC.md`, `gradeManager/docs/ARCHITECTURE.md`, `xrfapiManager/docs/ARCHITECTURE.md`, `xrfHwManager/docs/ARCHITECTURE.md`, `resultManager/docs/ARCHITECTURE.md`, `calcManager/docs/ARCHITECTURE.md`, `benchtopUI/docs/ARCHITECTURE.md`, `Docs/SERVICE_DISCOVERY.md`, `Docs/RELEASE-AND-CI.md`, git log.*
