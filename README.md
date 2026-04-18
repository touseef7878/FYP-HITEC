# OceanGuard AI — Marine Plastic Detection Platform

> AI-powered platform for marine plastic pollution detection and environmental trend forecasting.
> Built with YOLOv11s object detection and LSTM neural networks.

**HITEC University Taxila — Final Year Project 2026**

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)
- [ML Models](#ml-models)
- [Data Pipeline](#data-pipeline)
- [Testing](#testing)
- [Security](#security)
- [Database Schema](#database-schema)
- [Troubleshooting](#troubleshooting)
- [Team](#team)

---

## Overview

OceanGuard AI is a full-stack web platform that combines computer vision and time-series forecasting to detect and predict marine plastic pollution. Users upload images or videos for real-time debris detection, generate multi-day pollution forecasts for four ocean regions, and export results as PDF reports or CSV files.

The system is designed as a research tool for environmental scientists and conservationists, with a clean role-based interface for both regular users and system administrators.

---

## Features

### Detection
- YOLOv11s object detection across 8 marine debris categories (70.3% mAP50)
- Image and video upload with drag-and-drop interface
- Frame-by-frame video analysis with per-frame annotation
- Adjustable confidence threshold (10–90%)
- Real-time progress tracking with estimated processing time
- HTTP range-request video streaming (no full-file preload)
- Before/after comparison view for annotated results
- Detection history with search, filter by type/date, and delete

### LSTM Forecasting
- 3-step pipeline per region: **Fetch Data → Train Model → Generate Forecast**
- Four ocean regions: Pacific, Atlantic, Indian Ocean, Mediterranean
- 7–90 day pollution forecasts with confidence intervals
- Three real data sources: Open-Meteo (free), WAQI, NOAA CDO
- High-quality 5-year synthetic fallback when APIs are unavailable
- Per-region independent training — each region has its own model weights
- Configurable training epochs (10–100)
- **Save Result** button — explicitly persists predictions to DB
- **Download CSV** — exports forecast table as a `.csv` file
- **Save as Report** — creates a named report entry from the forecast
- Saved predictions automatically feed the heatmap and report generation

### Heatmap
- Interactive Leaflet map with ocean/satellite/street tile layers
- Pollution intensity circles scaled by score and region
- "Current" mode: aggregated from saved predictions (last N days)
- "Predicted" mode: latest LSTM batch per region
- Baseline fallback for regions without predictions (research-based estimates)
- Fetch fresh environmental data directly from the heatmap page (1-hour cooldown)

### Reports
- PDF generation via jsPDF + jspdf-autotable
- Three report types: YOLO Detection, LSTM Prediction, Comprehensive (both)
- Configurable date range (7 / 30 / 90 / 365 days)
- Custom report title support
- Report history with view, download, and delete

### Admin Panel
- System statistics dashboard (active users, detections, DB size, sessions)
- User management: list, deactivate, delete all data
- System logs viewer with level filter and auto-refresh
- System settings page: database operations, server controls, feature toggles, security info
- Danger zone: cache clear, full data export

### UI / UX
- Smooth per-route fade transitions (opacity-only, no transform — sidebar unaffected)
- Fully responsive: mobile, tablet, laptop, desktop
- Dark / light theme with system preference detection
- Toast notifications at bottom of screen (never overlaps hamburger)
- Compact mobile-friendly cards and forms throughout
- Local video background on homepage (zero network latency)

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite + SWC | Build tool (fast HMR) |
| Tailwind CSS + shadcn/ui | Styling + Radix UI primitives |
| React Query v5 | Server state, 5-min stale time |
| Recharts | Charts and data visualization |
| Leaflet + react-leaflet | Interactive pollution map |
| Framer Motion | Page fade transitions |
| jsPDF + jspdf-autotable | PDF report generation |
| Vitest + Testing Library | Unit and integration tests |

### Backend
| Technology | Purpose |
|---|---|
| FastAPI | REST API framework |
| SQLite (WAL mode) | Database with connection pooling (10 connections) |
| Ultralytics YOLOv11s | Object detection inference |
| TensorFlow / Keras | LSTM model training and inference |
| OpenCV | Image and video processing |
| bcrypt / PBKDF2 | Password hashing |
| PyJWT (HS256) | Authentication tokens |
| GZip middleware | Response compression (3–5× smaller) |

### External Data Sources
| Source | Type | Key Required |
|---|---|---|
| Open-Meteo Archive API | Historical weather (3+ years, free) | No |
| WAQI (World Air Quality Index) | Real-time AQI from coastal cities | Yes |
| NOAA Climate Data Online (CDO) | Historical climate station data | Yes |

---

## Architecture

```
Browser (React SPA — port 8080)
         │
         │  HTTP/REST  ·  JWT Bearer token
         ▼
FastAPI Backend (port 8000)
  ├── YOLO Detection Pipeline
  │     Upload → OpenCV → YOLOv11s → annotate → SQLite + disk
  │
  ├── LSTM Forecasting Pipeline
  │     Open-Meteo + WAQI + NOAA → merge → CSV cache
  │     → MinMaxScale → 30-day sequences → train LSTM
  │     → predict N days → save to predictions table
  │     → feeds heatmap + reports
  │
  └── SQLite Database (WAL mode, 10-connection pool, 23 indexes)
```

### LSTM Data Flow

```
1. Fetch   Open-Meteo (real weather, free)  ─┐
           WAQI (real AQI, coastal cities)   ├─ merge on date → CSV cache
           NOAA CDO (climate stations)       ─┘

2. Compute pollution_level target (0–100) from AQI, temp, wind, seasonal factors

3. Train   30-day sliding window sequences → 2-layer LSTM → save .keras + scalers

4. Predict last 60 days as context → autoregressive N-day forecast
           → save to predictions table → heatmap + reports updated
```

---

## Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

### 1. Clone

```bash
git clone <repo-url>
cd oceanscan-ai-main
```

### 2. Backend

```bash
pip install -r backend/requirements.txt
```

Create `backend/.env`:

```env
# Required
JWT_SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(32))">
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173

# Optional — real data fetching (synthetic fallback used if missing)
NOAA_CDO_TOKEN=<your-noaa-token>
WAQI_TOKEN=<your-waqi-token>
```

Initialise the database:

```bash
python backend/init_db.py
```

Creates `marine_detection.db` with 10 tables, 23 indexes, WAL mode, and two default accounts:

| Account | Username | Password | Role |
|---|---|---|---|
| Admin | `admin` | `admin123` | ADMIN |
| Demo | `demo_user` | `user123` | USER |

> **Change default passwords before any public deployment.**

Place your YOLOv11s weights at `backend/weights/best.pt`.

### 3. Frontend

```bash
npm install
```

Optionally set `VITE_API_URL` in `.env` (defaults to `http://localhost:8000`):

```env
VITE_API_URL=http://localhost:8000
```

---

## Running the Application

Open two terminals:

**Terminal 1 — Backend:**
```bash
uvicorn backend.main:app --reload --port 8000
# or from inside backend/: uvicorn main:app --reload
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

Open: http://localhost:8080

### Production

```bash
# Frontend
npm run build && npm run preview

# Backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Project Structure

```
oceanscan-ai-main/
│
├── backend/
│   ├── core/
│   │   ├── database.py          # SQLite manager, connection pool, WAL, all DB methods
│   │   └── security.py          # JWT auth, session injection, bcrypt hashing
│   ├── models/
│   │   ├── lstm.py              # EnvironmentalLSTM (build, train, predict, save, load)
│   │   ├── {region}_lstm.keras  # Trained weights (Keras native — primary)
│   │   ├── {region}_lstm.h5     # Trained weights (h5 — fallback)
│   │   ├── {region}_feature_scaler.pkl
│   │   ├── {region}_target_scaler.pkl
│   │   └── {region}_config.json
│   ├── services/
│   │   ├── data_cache_service.py  # Per-region fetch pipeline (v2)
│   │   └── data_cache/
│   │       ├── {region}_dataset.csv
│   │       └── {region}_last_fetch.json  # Cooldown timestamps
│   ├── utils/
│   │   ├── noaa_api.py          # NOAA CDO API client
│   │   ├── waqi_api.py          # WAQI API client
│   │   └── open_meteo_api.py    # Open-Meteo archive client (free, no key)
│   ├── weights/
│   │   └── best.pt              # YOLOv11s custom weights (add manually)
│   ├── processed_videos/        # Uploaded + annotated video files
│   ├── backups/                 # Database backups
│   ├── init_db.py               # One-time database setup script
│   ├── main.py                  # FastAPI app + all endpoints (3400+ lines)
│   ├── test_lstm_pipeline.py    # Backend test suite (10 test groups)
│   └── requirements.txt
│
├── src/
│   ├── components/
│   │   ├── auth/                # LoginForm, RegisterForm
│   │   ├── common/              # ErrorBoundary, VideoPlayer, NavLink, ThemeToggle
│   │   ├── features/
│   │   │   ├── heatmap/         # InteractiveMap (Leaflet)
│   │   │   └── home/            # FishBackground (static SVG animation)
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx  # Admin sidebar + header + mobile nav
│   │   │   ├── MainLayout.tsx   # User sidebar wrapper
│   │   │   ├── PageTransition.tsx
│   │   │   └── Sidebar.tsx      # Collapsible sidebar (CSS transition, no reflow)
│   │   └── ui/                  # shadcn/ui components (20+)
│   ├── config/
│   │   └── env.ts               # Centralised env config (VITE_API_URL)
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state, login/logout, token refresh
│   ├── hooks/                   # useTheme, useSidebar, use-mobile, use-toast
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── Dashboard.tsx    # System stats, quick actions, activity feed
│   │   │   ├── Logs.tsx         # System log viewer with level filter
│   │   │   ├── Settings.tsx     # DB ops, server controls, feature toggles, security
│   │   │   └── Users.tsx        # User management (deactivate, delete data)
│   │   ├── user/
│   │   │   ├── Dashboard.tsx    # Analytics charts (trend, distribution, counts)
│   │   │   ├── Heatmap.tsx      # Pollution map with fetch/refresh controls
│   │   │   ├── History.tsx      # Detection history with search/filter/delete
│   │   │   ├── Predictions.tsx  # 3-step LSTM pipeline + save/CSV/report actions
│   │   │   ├── Reports.tsx      # PDF report generation and history
│   │   │   ├── Results.tsx      # Detection results with before/after comparison
│   │   │   ├── Settings.tsx     # Account, theme, data management (proper dialogs)
│   │   │   └── Upload.tsx       # File upload with drag-drop and video polling
│   │   ├── Auth.tsx
│   │   ├── Home.tsx             # Hero with local video background
│   │   ├── PrivacyPolicy.tsx
│   │   └── NotFound.tsx
│   ├── services/
│   │   ├── data.service.ts      # History/analytics with localStorage cache
│   │   └── database.service.ts  # Direct DB API calls
│   ├── tests/
│   │   ├── lstm-pipeline.test.ts  # 39 frontend tests (Vitest)
│   │   └── setup.ts
│   ├── utils/
│   │   ├── cn.ts
│   │   ├── debounce.ts
│   │   ├── generateReport.ts    # jsPDF report builder
│   │   └── logger.ts            # Production-safe logger (dev-only console)
│   └── App.tsx                  # Lazy routes + FadeLayer + route guards
│
├── public/
│   └── hero-ocean.mp4           # Local homepage background video
├── .env                         # Frontend env (VITE_API_URL)
└── vite.config.ts               # Vitest config included
```

---

## Usage Guide

### 1. Login / Register
Navigate to http://localhost:8080. Use the default accounts or register a new one.

### 2. Upload & Detect
1. Go to **Upload & Detect**
2. Drag-drop an image or video (PNG/JPG/MP4/AVI/MOV)
3. Optionally expand **Detection Settings** to adjust confidence threshold
4. Click **Start Detection**
5. For videos: processing runs in the background — progress is polled every 2 seconds
6. Auto-redirects to results on completion

### 3. View Results
- Before/after comparison tabs
- Per-class detection breakdown with confidence bars
- Video playback with annotated overlay
- Download annotated image or video

### 4. LSTM Predictions (3-step workflow)

Each region is independent. Steps must be completed in order.

**Step 1 — Fetch Data**
- Fetches weather from Open-Meteo (free, no key), AQI from WAQI, climate from NOAA
- Falls back to 5-year synthetic data if APIs are unavailable
- 1-hour cooldown per region (countdown shown on button)
- Cached as `{region}_dataset.csv`

**Step 2 — Train Model**
- Trains a 2-layer LSTM on the cached dataset
- Configure epochs with the slider (10–100)
- Training runs in a background thread — API stays responsive
- Saves per-region `.keras` weights and scalers

**Step 3 — Generate Forecast**
- Select forecast horizon (7 / 14 / 30 / 60 / 90 days)
- Generates predictions with confidence intervals
- Results shown as area chart + daily table with risk badges

**After predicting:**
- **Save Result** — persists predictions to DB (feeds heatmap + reports)
- **CSV** — downloads forecast as a `.csv` file
- **Save as Report** — creates a named report entry in the Reports page

### 5. Heatmap
- Switch between **Current** (aggregated from saved predictions) and **Predicted** (latest LSTM batch)
- Select time range: 1d / 7d / 30d / 90d
- Click **Fetch Data** to pull fresh environmental data for all regions
- Click a region circle to see detailed stats in the sidebar

### 6. Reports
1. Select report type: YOLO Detection / LSTM Prediction / Comprehensive
2. Select date range
3. Optionally enter a custom title
4. Click **Generate Report**
5. View (opens PDF in new tab) or Download

### 7. Admin Panel
Access at `/admin` (ADMIN role required).
- **Dashboard**: system stats, quick actions (backup, optimize DB, clear cache)
- **Users**: view all users, deactivate accounts, delete user data
- **Logs**: filter by level, auto-refresh every 10 seconds
- **Settings**: database operations, server controls, feature toggles, security info

---

## API Reference

Interactive docs: http://localhost:8000/docs

### Authentication

```
POST /api/auth/register          { username, email, password }
POST /api/auth/login             { username, password }
GET  /api/auth/me                → UserProfile
POST /api/auth/logout
```

### Detection

```
POST /detect                     multipart/form-data: file, confidence
POST /detect-video               multipart/form-data: file, confidence
GET  /api/detections/{id}/status → { status, progress, ... }
GET  /api/history                → [ HistoryItem ]
DELETE /api/user/detections/{id}
DELETE /api/user/history/clear
```

### LSTM Pipeline

```
GET  /api/data/regions           → [ { id, name, dataset_cached, dataset_info } ]
GET  /api/data/fetch-status      → { regions: { [region]: CooldownStatus } }
POST /api/data/fetch             { region } → { success, dataset_info, sources_used }
GET  /api/data/status/{region}   → { dataset_cached, model_trained }
GET  /api/data/api-health        → { apis: { open_meteo, waqi, noaa } }
POST /api/train                  { region, epochs } → { training_result }
GET  /api/train/status/{region}  → { ready_for_prediction, model_info }
POST /api/predict                { region, days_ahead } → { predictions, summary, saved_to_db }
POST /api/analyze                { region, historical_days } → { statistics, risk_assessment }
```

### Heatmap

```
GET  /api/heatmap                ?range=7d&mode=current → { hotspots }
```

### Reports

```
GET  /api/reports                → [ Report ]
POST /api/reports/generate       { report_type, title?, date_range_days }
GET  /api/reports/{id}           → Report
DELETE /api/user/reports/{id}
```

### Admin

```
GET  /api/admin/stats
GET  /api/admin/users
POST /api/admin/users/{id}/deactivate
DELETE /api/admin/users/{id}/data
GET  /api/admin/logs             ?limit=100&level=ERROR
GET  /api/admin/activity
POST /api/admin/system/{action}  action: backup | optimize-db | cache-clear | export-data | restart-services | maintenance
```

### Video Streaming

```
GET  /processed-video/{filename}  Range-request streaming (206 Partial Content)
```

---

## ML Models

### YOLOv11s — Object Detection

| Property | Value |
|---|---|
| Weights | `backend/weights/best.pt` |
| Framework | Ultralytics ≥ 8.4.0 |
| Architecture | YOLOv11s (Small) |
| Dataset | 17,429 images (13,043 train / 3,261 val) |
| Training | 100 epochs, SGD, Mosaic + Mixup augmentation |
| Overall mAP50 | 70.3% |
| Inference speed | ~25ms / image (Tesla T4) |

**Per-class mAP50:**

| Class | mAP50 |
|---|---|
| Fishing Net | 99.4% |
| Tyre | 89.1% |
| Glass Bottle | 74.7% |
| Metal Can | 70.3% |
| Cardboard | 68.5% |
| Plastic Bag | 61.2% |
| Other Debris | 62.1% |
| Plastic Bottle | 53.6% |

### LSTM — Pollution Trend Forecasting

| Property | Value |
|---|---|
| Framework | TensorFlow / Keras |
| Architecture | 2-layer stacked LSTM |
| Layer 1 | 64 units, return_sequences=True |
| Layer 2 | 32 units |
| Dropout | 0.2 after each LSTM layer |
| Output | Dense(1, linear) |
| Input shape | (30 days, 10 features) |
| Target | pollution_level (0–100) |
| Optimizer | Adam (lr=0.001) |
| Loss | Mean Squared Error |
| Callbacks | EarlyStopping (patience=15), ReduceLROnPlateau (patience=8) |
| Validation split | 20% |

**10 input features:**

| Feature | Primary Source | Fallback |
|---|---|---|
| temperature | Open-Meteo (TMAX+TMIN avg) | Synthetic seasonal |
| humidity | Derived from temperature | Synthetic |
| pressure | Open-Meteo (pressure_msl_mean) | Synthetic |
| wind_speed | Open-Meteo (windspeed_10m_max) | Synthetic |
| aqi | WAQI coastal cities | Synthetic |
| pm25 | WAQI coastal cities | Synthetic |
| ocean_temp | Derived (air temp × 0.85) | Synthetic |
| precipitation | Open-Meteo (precipitation_sum) | Synthetic |
| salinity | Synthetic (region-specific) | — |
| chlorophyll | Synthetic (log-normal) | — |

---

## Data Pipeline

### Version 2 — Per-Region Independent Pipeline

Each region (pacific, atlantic, indian, mediterranean) has its own independent data lifecycle:

```
Fetch (per region)
  ├── Open-Meteo archive  → 730 days real weather (free, no key)
  ├── WAQI API            → current AQI → extrapolated 730-day series
  └── NOAA CDO            → historical climate stations (optional)
        ↓
  Merge on date (left join, weather as base)
  Fill gaps (linear interpolation → ffill → bfill)
  Ensure all 10 LSTM features present (defaults if missing)
  Compute pollution_level target:
    base + seasonal + AQI_contrib + temp_contrib - wind_contrib - rain_contrib + noise
        ↓
  Save: {region}_dataset.csv  +  {region}_last_fetch.json (cooldown)

Train (per region, uses cached CSV)
  MinMaxScale features + target separately
  Create 30-day sliding window sequences
  Train 2-layer LSTM with early stopping
  Save: {region}_lstm.keras  +  {region}_feature_scaler.pkl  +  {region}_target_scaler.pkl

Predict (per region, uses cached CSV + trained model)
  Load last 60 rows as context
  Autoregressive N-day forecast (update AQI feature each step)
  Confidence: 0.85 → decays 0.02/day → min 0.50
  Confidence interval: margin = level × (1 - confidence) × 0.5
  Save all predictions to DB → feeds heatmap + reports
```

### Synthetic Fallback

When APIs are unavailable, a 5-year synthetic dataset is generated per region with:
- Realistic seasonal temperature cycles (sine wave, region-specific amplitude)
- Weekly AQI patterns (weekdays 6% higher than weekends)
- Inter-annual variability (~11-year cycle)
- Seeded per region for reproducibility
- All 10 LSTM features with region-specific baselines

### Pollution Level Formula

```
pollution = base_level
          + amplitude × sin(2π × (doy - peak_doy) / 365)   # seasonal
          + (aqi - 50) × 0.15                               # air quality
          + (temperature - 18) × 0.4                        # temperature
          - wind_speed × 0.6                                 # wind dispersal
          - precipitation × 0.3                              # rain washout
          + noise(0, 4)                                      # random variation
```

Regional baselines: Pacific 65, Atlantic 45, Indian 55, Mediterranean 40.

---

## Testing

### Frontend Tests (Vitest)

```bash
npm test                    # single run (39 tests)
npm run test:watch          # watch mode
npm run test:ui             # browser UI
```

**39 tests across 7 groups:**

| Group | Tests |
|---|---|
| API Response Contracts | 9 |
| Data Service Logic | 14 |
| Pipeline Step Sequencing | 5 |
| Report Generation | 3 |
| Prediction → DB → Heatmap → Report Chain | 5 |
| Heatmap Data | 1 |
| Auth Flow | 2 |

All tests use mocked `fetch()` — no backend required.

### Backend Tests (Python)

```bash
# Fast: APIs + data quality + synthetic (~25s, no training)
python backend/test_lstm_pipeline.py --fast --skip-fetch

# Single region
python backend/test_lstm_pipeline.py --fast --region pacific

# Full pipeline including training (5-epoch smoke test)
python backend/test_lstm_pipeline.py --region pacific

# With live backend (also tests all HTTP endpoints)
python backend/test_lstm_pipeline.py --fast --url http://localhost:8000

# All 4 regions, full pipeline
python backend/test_lstm_pipeline.py
```

**10 test groups:**

| # | Group | What it checks |
|---|---|---|
| 1 | Open-Meteo API | Live HTTP, 30+ days, no NaN |
| 2 | WAQI API | Live AQI, numeric, 0–500 range |
| 3 | NOAA CDO API | Live datasets list |
| 4 | DataCacheService fetch | Per-region fetch, cooldown logic |
| 5 | Dataset quality | 60+ rows, all 11 features, NaN < 5% |
| 6 | LSTM training | 5-epoch smoke test, MAE < 50 |
| 7 | LSTM prediction | 7-day forecast, values 0–100 |
| 8 | HTTP endpoints | 12 API routes, correct status codes |
| 9 | Synthetic data | 365+ rows, variance > 2, no NaN |
| 10 | Prediction → DB → Heatmap chain | Save, heatmap reads, CI validity |

---

## Security

| Feature | Implementation |
|---|---|
| Authentication | JWT HS256, 24h expiry, 32+ char secret required |
| Session tracking | Token hashes stored in DB — revocation supported |
| Password hashing | bcrypt (primary), PBKDF2-260k (fallback) |
| CORS | Explicit origin whitelist — no wildcard `*` |
| SQL injection | Parameterized queries throughout |
| Connection pooling | 10-connection pool prevents DB exhaustion |
| Response compression | GZip middleware (3–5× smaller payloads) |
| Role-based access | USER / ADMIN with route guards on frontend and backend |
| Input validation | Pydantic models on all POST bodies |

---

## Database Schema

SQLite with WAL mode, 10-connection pool, 23 performance indexes.

| Table | Purpose |
|---|---|
| `users` | Accounts, roles, bcrypt hashes, profile JSON |
| `sessions` | JWT token hashes + expiry (supports forced logout) |
| `detections` | Upload metadata, status, processing time, file paths |
| `detection_results` | Per-object bounding boxes + confidence scores |
| `images` | Image dimensions + base64 encoded annotated results |
| `videos` | Frame count, FPS, duration, resolution, file paths |
| `predictions` | LSTM forecast values, confidence intervals, model version |
| `reports` | Generated report metadata + embedded JSON data |
| `analytics_data` | Heatmap and trend data points |
| `logs` | System activity (DEBUG → CRITICAL) |

---

## Troubleshooting

**"JWT_SECRET_KEY required" on startup**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Add to backend/.env: JWT_SECRET_KEY=<output>
```

**CORS errors in browser**
```env
# backend/.env
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173
```

**"No such table" database errors**
```bash
python backend/init_db.py
```

**YOLO model not loading**
- Place `best.pt` at `backend/weights/best.pt`
- Ensure `ultralytics>=8.4.0`: `pip install "ultralytics>=8.4.0"`

**"No trained model found" on predict**
- Complete all 3 steps in the Predictions page for that region
- If NOAA/WAQI tokens are missing, synthetic data is used automatically

**Reports page blank / crash**
- Ensure `framer-motion` is imported in any file using `motion` components
- Check browser console for `ReferenceError: motion is not defined`

**Sidebar disappears during page transitions**
- The `FadeLayer` in `App.tsx` uses opacity-only animation (no `transform`)
- `transform` creates a stacking context that breaks `position: fixed` — do not add it

**Video not playing**
- Backend must be running for `/processed-video/{filename}` endpoint
- Check that `backend/processed_videos/` directory exists and is writable

**Predictions not appearing on heatmap**
- Click **Save Result** on the Predictions page after generating a forecast
- Heatmap queries the `predictions` table — data must be saved first
- Switch to "Current" mode and select a time range that covers the prediction dates

---

## Team

**HITEC University Taxila — Final Year Project 2026**

| Name | Role |
|---|---|
| Touseef Ur Rehman | ML Engineer — YOLOv11s training, LSTM architecture, data pipeline |
| Qasim Shahzad | Backend Engineer — FastAPI, SQLite, authentication, video processing |
| Zohaib Ashraf | Frontend Engineer — React, UI/UX, responsive design, PDF reports |

---

## License

Developed for academic research and marine conservation at HITEC University Taxila. Not licensed for commercial use.
