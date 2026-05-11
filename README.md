# OceanGuard AI — Marine Plastic Detection & Forecasting Platform

> AI-powered full-stack research platform combining YOLOv26s computer vision and LSTM time-series forecasting for marine plastic pollution detection and prediction.

**HITEC University Taxila — Final Year Project 2026**

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Features](#features)
4. [Tech Stack](#tech-stack)
5. [ML Models](#ml-models)
6. [Installation](#installation)
7. [Running the Application](#running-the-application)
8. [Project Structure](#project-structure)
9. [Usage Guide](#usage-guide)
10. [API Reference](#api-reference)
11. [Database Schema](#database-schema)
12. [Security](#security)
13. [Testing](#testing)
14. [Performance](#performance)
15. [Troubleshooting](#troubleshooting)
16. [Team](#team)

---

## Overview

OceanGuard AI is a production-ready, full-stack research platform that addresses marine plastic pollution through two complementary AI systems:

- **YOLOv26s Object Detection** — Real-time identification of 8 marine debris classes in images and videos with up to 99.4% per-class accuracy
- **LSTM Pollution Forecasting** — Multi-region time-series prediction of ocean pollution levels up to 90 days ahead, trained on real environmental data from Open-Meteo, WAQI, and NOAA

The platform provides a complete workflow: upload media → detect debris → fetch environmental data → train forecasting model → generate predictions → visualise on interactive heatmap → export PDF reports.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     FRONTEND  (React 18 + TypeScript)                │
│                                                                      │
│  Home → Auth → Upload → Results → Dashboard → History               │
│                       → Heatmap → Predictions → Reports → Settings  │
│                       → Admin (Dashboard / Users / Logs / Settings)  │
│                                                                      │
│  State: React Query v5 · AuthContext · ThemeContext                  │
│  Charts: Recharts (Area, Bar, Pie) · Leaflet (interactive map)       │
│  Animations: Framer Motion · Tailwind CSS                            │
│  AI Chat: OceanAssistant (Gemini 2.0 Flash)                          │
└──────────────────────────────────────────────────────────────────────┘
                                  │  REST API (JSON)
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     BACKEND  (FastAPI + Python)                      │
│                                                                      │
│  /detect          → YOLOv26s image inference                        │
│  /detect-video    → YOLOv26s async video processing                 │
│  /api/data/fetch  → Environmental data pipeline                      │
│  /api/train       → LSTM training (non-blocking, thread pool)        │
│  /api/predict     → LSTM multi-day forecast                          │
│  /api/heatmap     → Aggregated pollution map data                    │
│  /api/reports/*   → PDF report generation                            │
│  /api/auth/*      → JWT authentication                               │
│  /api/admin/*     → Admin management endpoints                       │
│                                                                      │
│  Middleware: GZip compression · CORS whitelist · JWT guard           │
└──────────────────────────────────────────────────────────────────────┘
          │                    │                      │
          ▼                    ▼                      ▼
┌──────────────┐   ┌─────────────────────┐  ┌──────────────────────┐
│  SQLite DB   │   │   YOLOv26s Model    │  │   LSTM Models (×4)   │
│  (WAL mode)  │   │   best.pt           │  │   pacific_lstm.keras  │
│  10 tables   │   │   640×640 input     │  │   atlantic_lstm.keras │
│  23 indexes  │   │   8 debris classes  │  │   indian_lstm.keras   │
│  pool: 10    │   │   71% mAP50 overall │  │   mediterranean_lstm  │
└──────────────┘   └─────────────────────┘  └──────────────────────┘
                                                        │
                                             ┌──────────────────────┐
                                             │  Data Cache Service  │
                                             │  {region}_dataset.csv│
                                             │  730 rows / 2 years  │
                                             └──────────────────────┘
                                                        │
                                             ┌──────────────────────┐
                                             │  External APIs       │
                                             │  1. Open-Meteo (free)│
                                             │  2. WAQI (AQI)       │
                                             │  3. NOAA CDO         │
                                             │  4. Synthetic fallbk │
                                             └──────────────────────┘
```

---

## Features

| Module | Capabilities |
|---|---|
| **Detection** | YOLOv26s · 8 debris classes · 71% mAP50 · image + video · drag-drop UI · confidence threshold slider · before/after comparison · async video polling |
| **Forecasting** | 3-step LSTM pipeline · 4 ocean regions · 7–90 day forecasts · confidence intervals · lag features · data augmentation · R² up to 0.93 |
| **Heatmap** | Leaflet interactive map · current + predicted modes · time range selector (1d/7d/30d/90d) · 1-hour fetch cooldown · fallback static hotspots |
| **Reports** | PDF generation (jsPDF) · YOLO / LSTM / Comprehensive types · configurable date range · custom title · view + download + delete |
| **Dashboard** | Real-time analytics · detection trend (area chart) · class distribution (pie) · object counts (bar) · auto-refresh on detection |
| **History** | Paginated detection log · date filter · thumbnail preview · bulk delete · CSV export |
| **Admin** | System stats · user management (deactivate/delete) · system logs · DB backup/optimize · feature toggles · maintenance mode |
| **AI Assistant** | Floating chat widget · Gemini 2.0 Flash · platform Q&A + marine science knowledge |
| **Auth** | JWT HS256 · bcrypt passwords · session management · role-based access (USER / ADMIN) |
| **UI/UX** | Fully responsive · dark/light theme · Framer Motion page transitions · mobile-first · lazy-loaded routes |

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool |
| Tailwind CSS | 3 | Styling |
| shadcn/ui | latest | Component library |
| React Query | v5 | Server state, caching |
| Recharts | 2 | Analytics charts |
| Leaflet | 1.9 | Interactive map |
| Framer Motion | 11 | Animations |
| jsPDF | 2 | PDF report generation |
| @google/genai | latest | Gemini AI assistant |
| Vitest | 1 | Unit testing |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.115 | REST API framework |
| Python | 3.10+ | Runtime |
| Ultralytics | 8.4+ | YOLOv26s inference |
| TensorFlow/Keras | 2.18 | LSTM training |
| OpenCV | 4.10 | Video processing |
| SQLite | 3 | Database (WAL mode) |
| bcrypt | 4 | Password hashing |
| PyJWT | 2.9 | JWT tokens |
| scikit-learn | 1.5 | Scalers, metrics |
| pandas / numpy | latest | Data processing |
| joblib | 1.4 | Scaler persistence |

### Data Sources
| Source | Type | Key Required |
|---|---|---|
| Open-Meteo Archive | Weather history (3+ years) | No |
| WAQI | Real-time AQI from coastal cities | Yes (free) |
| NOAA CDO | Historical climate station data | Yes (free) |
| Synthetic fallback | Seeded per-region data | No |

---

## ML Models

### YOLOv26s — Marine Debris Detection

Custom-trained YOLOv26s on ~16,500 marine debris images across 8 classes, sourced from 7 Roboflow datasets merged with a label-harmonization pipeline. Trained on Kaggle NVIDIA T4 GPU.

| Class | mAP50 | Performance |
|---|---|---|
| Fishing Net | 99.4% | Exceptional |
| Tyre | 89.1% | Excellent |
| Glass Container | 74.7% | Strong |
| Metal Can | 70.3% | Good |
| Other Debris | 62.1% | Moderate |
| Plastic Bag | 61.2% | Moderate |
| Plastic Bottle | 53.6% | Moderate |
| Plastic Fragments | 21.0% | Developing |

**Overall**: mAP50 = 71% · mAP50-95 = 52% · Precision = 83% · Recall = 67% · ~25ms inference

Training: 100 epochs · batch=16 · Kaggle T4 GPU · patience=20 · augment=True · 640×640 input · 7 Roboflow datasets merged

> See [YOLO_TECHNICAL.md](YOLO_TECHNICAL.md) for full architecture, training methodology, and per-class analysis.

### LSTM — Pollution Level Forecasting

2-layer stacked LSTM with lag features and data augmentation:

| Region | R² Score | MAE | RMSE | ±10 Units |
|---|---|---|---|---|
| Pacific | 0.928 | 2.34 | 3.07 | 100% |
| Atlantic | 0.785 | 2.54 | 3.16 | 100% |
| Mediterranean | 0.881 | 2.04 | 2.52 | 100% |

Architecture: 64 → 32 LSTM units · 30-day sequences · 13 features (10 env + 3 lag) · Huber loss · RobustScaler · EarlyStopping (patience=12)

> See [LSTM_TECHNICAL.md](LSTM_TECHNICAL.md) for full architecture, training pipeline, and accuracy analysis.

---

## Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm 9+

### 1. Clone Repository
```bash
git clone <repo-url>
cd oceanscan-ai-main
```

### 2. Backend Setup
```bash
pip install -r backend/requirements.txt
```

Create `backend/.env`:
```env
# Required
JWT_SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(32))">
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173

# Optional — enables real environmental data (synthetic fallback used if omitted)
NOAA_CDO_TOKEN=your_noaa_token_here
WAQI_TOKEN=your_waqi_token_here
```

Initialise the database:
```bash
python backend/init_db.py
```

This creates `backend/marine_detection.db` with 10 tables, 23 indexes, and a default admin account:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | ADMIN |

> **Change the admin password immediately before any deployment.**

Place YOLOv26s weights at `backend/weights/best.pt`.

### 3. Frontend Setup
```bash
npm install
```

Create `.env` in the project root:
```env
VITE_API_URL=http://localhost:8000

# Optional — AI assistant (free key at aistudio.google.com/app/apikey)
VITE_GEMINI_API_KEY=your_gemini_api_key
```

---

## Running the Application

### Development
```bash
# Terminal 1 — Backend
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
npm run dev
```

Open: **http://localhost:8080**

### Production
```bash
# Build frontend
npm run build && npm run preview

# Start backend with multiple workers
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Project Structure

```
oceanscan-ai-main/
│
├── backend/
│   ├── core/
│   │   ├── database.py            # SQLite manager, WAL mode, connection pool (10 conns)
│   │   └── security.py            # JWT HS256, bcrypt, session management, RBAC
│   │
│   ├── models/
│   │   ├── lstm.py                # EnvironmentalLSTM — architecture, train, predict, save/load
│   │   ├── {region}_lstm.keras    # Per-region trained weights (4 regions)
│   │   ├── {region}_config.json   # Per-region config + accuracy metrics
│   │   └── {region}_*_scaler.pkl  # Feature + target RobustScalers
│   │
│   ├── services/
│   │   ├── data_cache_service.py  # Per-region fetch pipeline (Open-Meteo + WAQI + NOAA)
│   │   └── data_cache/
│   │       ├── {region}_dataset.csv       # 730-row cached datasets
│   │       └── {region}_last_fetch.json   # Cooldown timestamps
│   │
│   ├── utils/
│   │   ├── open_meteo_api.py      # Free weather archive (no API key)
│   │   ├── waqi_api.py            # Air quality index API
│   │   └── noaa_api.py            # NOAA CDO climate station data
│   │
│   ├── weights/
│   │   └── best.pt                # YOLOv26s custom-trained weights (add manually)
│   │
│   ├── processed_videos/          # UUID-named original + annotated video files
│   ├── backups/                   # Automatic DB backups
│   ├── main.py                    # FastAPI app — all 40+ endpoints
│   ├── init_db.py                 # One-time database initialisation
│   ├── test_lstm_pipeline.py      # Backend test suite (10 test groups)
│   └── requirements.txt
│
└── src/
    ├── components/
    │   ├── auth/
    │   │   ├── LoginForm.tsx       # JWT login with validation
    │   │   └── RegisterForm.tsx    # Registration with email validation
    │   ├── common/
    │   │   ├── ErrorBoundary.tsx   # React error boundary
    │   │   ├── ThemeToggle.tsx     # Dark/light mode switch
    │   │   └── VideoPlayer.tsx     # Custom video player with controls
    │   ├── features/
    │   │   ├── assistant/
    │   │   │   └── OceanAssistant.tsx   # Gemini 2.0 Flash chat widget
    │   │   └── heatmap/
    │   │       └── InteractiveMap.tsx   # Leaflet map with pollution circles
    │   └── layout/
    │       ├── MainLayout.tsx      # User layout with sidebar
    │       ├── AdminLayout.tsx     # Admin layout
    │       ├── Sidebar.tsx         # Navigation sidebar
    │       └── PageTransition.tsx  # Framer Motion fade transitions
    │
    ├── pages/
    │   ├── Home.tsx                # Landing page with hero video
    │   ├── Auth.tsx                # Login / Register page
    │   ├── PrivacyPolicy.tsx       # Legal compliance
    │   ├── user/
    │   │   ├── Upload.tsx          # Drag-drop detection with progress
    │   │   ├── Results.tsx         # Before/after comparison + download
    │   │   ├── Dashboard.tsx       # Analytics charts (Area, Pie, Bar)
    │   │   ├── History.tsx         # Paginated detection history
    │   │   ├── Heatmap.tsx         # Interactive Leaflet pollution map
    │   │   ├── Predictions.tsx     # 3-step LSTM pipeline UI
    │   │   ├── Reports.tsx         # PDF report generation + history
    │   │   └── Settings.tsx        # Profile, password, theme
    │   └── admin/
    │       ├── Dashboard.tsx       # System stats + activity
    │       ├── Users.tsx           # User management
    │       ├── Logs.tsx            # System logs with filtering
    │       └── Settings.tsx        # Feature toggles + maintenance
    │
    ├── services/
    │   ├── data.service.ts         # Analytics + history with local cache
    │   └── database.service.ts     # Direct API call wrappers
    │
    ├── contexts/
    │   └── AuthContext.tsx         # JWT auth state + role management
    │
    ├── utils/
    │   ├── generateReport.ts       # jsPDF report builder
    │   ├── logger.ts               # Production-safe console logger
    │   └── cn.ts                   # Tailwind class merging utility
    │
    ├── tests/
    │   └── lstm-pipeline.test.ts   # 39 Vitest tests
    │
    └── App.tsx                     # Lazy routes + route guards + transitions
```

---

## Usage Guide

### Detection Workflow
1. Navigate to **Upload & Detect**
2. Drag-drop an image (JPG/PNG) or video (MP4/WebM/AVI)
3. Adjust confidence threshold with the slider (default 25%, range 10–90%)
4. Click **Start Detection**
   - Images: results appear immediately
   - Videos: async processing with 2-second polling; progress bar shows completion
5. **Results** page shows:
   - Before/after image comparison
   - Per-class detection breakdown with confidence scores
   - Annotated video player with frame navigation
   - Download annotated media button

### LSTM Prediction Workflow
Each ocean region runs independently through 3 sequential steps:

**Step 1 — Fetch Data**
- Select a region (Pacific / Atlantic / Indian / Mediterranean)
- Click **Fetch Data** — pulls 2 years of environmental data from Open-Meteo + WAQI + NOAA
- 1-hour cooldown per region prevents API quota exhaustion
- Synthetic fallback activates automatically if APIs are unavailable

**Step 2 — Train Model**
- Configure epochs (10–100) with the slider
- Click **Train Model** — non-blocking; backend trains in a thread pool
- Training uses EarlyStopping (patience=12) — typically completes in 20–45 epochs
- Metrics displayed: MAE, RMSE, R², directional accuracy

**Step 3 — Generate Forecast**
- Select forecast horizon (7–90 days)
- Click **Predict** — generates daily pollution level forecasts with confidence intervals
- Area chart shows forecast curve with confidence band
- Daily risk table shows date, level, confidence, and risk category (Low/Moderate/High/Critical)

**After predicting:**
- **Save Result** — persists to database (feeds heatmap + reports)
- **CSV** — downloads the forecast table
- **Save as Report** — creates a PDF report entry

### Heatmap
- Switch between **Current** (aggregated from saved predictions) and **Predicted** (latest LSTM batch)
- Select time range: 1d / 7d / 30d / 90d
- Click any region circle for detailed statistics
- Click **Fetch Fresh Data** to update a region (1-hour cooldown)

### Reports
1. Select report type: **Detection** (YOLO results) / **Prediction** (LSTM forecasts) / **Comprehensive** (both)
2. Set date range (7 / 30 / 90 / 365 days)
3. Enter optional custom title
4. Click **Generate Report** → PDF created and saved to history
5. **View** opens PDF in browser · **Download** saves locally · **Delete** removes from history

### AI Assistant
- Click the **OceanGuard Assistant** button (bottom-right corner, visible on all pages)
- Ask about platform features, marine pollution science, or model performance
- Requires `VITE_GEMINI_API_KEY` in `.env`

---

## API Reference

Interactive Swagger docs: **http://localhost:8000/docs**

### Authentication
```
POST /api/auth/register     Register new user
POST /api/auth/login        Login → returns JWT token
GET  /api/auth/me           Get current user profile
POST /api/auth/logout       Revoke session token
```

### Detection
```
POST /detect                        Image detection (multipart/form-data)
POST /detect-video                  Video detection (async)
GET  /api/detections/{id}/status    Video processing status
GET  /api/detections/{id}           Full detection result
GET  /api/history                   Paginated detection history
DELETE /api/user/detections/{id}    Delete single detection
DELETE /api/user/history/clear      Clear all user history
```

### LSTM Pipeline
```
GET  /api/data/regions              Available regions list
GET  /api/data/fetch-status         Cooldown status per region
GET  /api/data/api-health           External API health check
POST /api/data/fetch                Fetch + cache environmental data
GET  /api/data/status/{region}      Dataset + model status
POST /api/train                     Train LSTM model (body: {region, epochs})
GET  /api/train/status/{region}     Training status + metrics
POST /api/predict                   Generate forecast (body: {region, days_ahead})
POST /api/analyze                   Historical analysis
```

### Heatmap & Reports
```
GET  /api/heatmap                   Heatmap data (query: mode, days)
GET  /api/reports                   User reports list
POST /api/reports/generate          Generate PDF report
DELETE /api/user/reports/{id}       Delete report
```

### Admin (requires ADMIN role)
```
GET  /api/admin/stats               System statistics
GET  /api/admin/activity            Recent activity log
GET  /api/admin/users               All users list
POST /api/admin/users/{id}/deactivate   Deactivate user
DELETE /api/admin/users/{id}/data   Delete all user data
GET  /api/admin/logs                System logs (filterable)
POST /api/admin/system/{action}     System actions:
                                    backup | optimize-db | cache-clear |
                                    export-data | maintenance
```

### Streaming
```
GET  /processed-video/{filename}    Video streaming with HTTP range requests
```

---

## Database Schema

SQLite database with WAL mode and a 10-connection pool.

| Table | Key Columns | Purpose |
|---|---|---|
| `users` | id, username, email, password_hash, role, is_active | User accounts |
| `sessions` | user_id, token_hash, expires_at, is_active | JWT session tracking |
| `detections` | user_id, filename, file_type, total_detections, confidence_threshold, processing_time, status | Detection jobs |
| `detection_results` | detection_id, class_name, confidence, bbox_x1/y1/x2/y2, frame_number | Per-object results |
| `images` | detection_id, width, height, original_base64, annotated_base64 | Image storage |
| `videos` | detection_id, total_frames, fps, duration, resolution, original_path, annotated_path | Video metadata |
| `predictions` | user_id, region, prediction_date, predicted_pollution_level, confidence_interval_lower/upper, model_version | LSTM forecasts |
| `analytics_data` | user_id, data_type, region, date_recorded, value | Time-series analytics |
| `logs` | user_id, level, message, module, timestamp | System audit log |
| `reports` | user_id, title, report_type, status, file_path | Generated reports |

**23 indexes** on foreign keys, (user_id, created_at), (region, prediction_date), and detection filenames.

---

## Security

| Layer | Implementation |
|---|---|
| Authentication | JWT HS256, 24-hour expiry, 32+ char secret enforced at startup |
| Passwords | bcrypt (primary), PBKDF2 (fallback) |
| Sessions | Token hash stored in DB; forced logout supported |
| CORS | Explicit origin whitelist — no wildcard `*` |
| SQL Injection | Parameterized queries throughout — zero raw string interpolation |
| Role-Based Access | USER / ADMIN enforced on both frontend routes and backend endpoints |
| File Isolation | Videos stored with UUID names in isolated directory |
| Rate Limiting | 1-hour data fetch cooldown per region |

---

## Testing

### Frontend (Vitest)
```bash
npm test              # Run all 39 tests
npm run test:coverage # With coverage report
```

Tests cover: components, hooks, services, API mocking — no backend required.

### Backend
```bash
# Fast mode (~25 seconds, skips training)
python backend/test_lstm_pipeline.py --fast

# Single region only
python backend/test_lstm_pipeline.py --region pacific

# Full pipeline with live server
python backend/test_lstm_pipeline.py --url http://localhost:8000
```

**10 test groups:** Open-Meteo API · WAQI API · NOAA API · DataCacheService · Dataset quality · LSTM training · LSTM prediction · HTTP endpoints · Synthetic data generation · Prediction→DB→Heatmap chain

### Accuracy Evaluation
```bash
# Train all regions and print full accuracy report
python backend/run_lstm_accuracy.py
```

---

## Performance

### Backend Optimisations
- **GZip Middleware** — 3–5× smaller API responses
- **Connection Pool** — 10 pre-created SQLite connections with thread safety
- **WAL Mode** — concurrent reads during writes
- **Thread Pool** — 2–4 workers for video processing (non-blocking API)
- **Async Training** — LSTM training runs in executor, never blocks the event loop
- **Analytics Cache** — 5-minute TTL prevents redundant DB queries

### Frontend Optimisations
- **Code Splitting** — all pages lazy-loaded with Suspense
- **React Query** — stale-time 5 min, gc-time 10 min, no refetch on window focus
- **Memoisation** — FileItem component wrapped in `memo()` to prevent re-renders
- **Tailwind CSS** — utility-first, minimal bundle size

### Database Optimisations
- **23 Indexes** — on all frequently queried columns
- **Prepared Statements** — prevent SQL injection and improve query planning
- **Pagination** — history and reports limited to 50 items per page

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `JWT_SECRET_KEY required` | Run `python -c "import secrets; print(secrets.token_urlsafe(32))"` and add to `backend/.env` |
| CORS errors in browser | Add your frontend URL to `ALLOWED_ORIGINS` in `backend/.env` |
| `no such table` error | Run `python backend/init_db.py` |
| YOLO model not loading | Place `best.pt` at `backend/weights/best.pt` and ensure `ultralytics>=8.4.0` is installed |
| Predictions page shows "no model" | Complete all 3 steps (Fetch → Train → Predict) for that region |
| Heatmap shows no data | Click **Save Result** after predicting — heatmap reads from the predictions table |
| Indian region has zero variance | Re-fetch Indian data; the cached dataset may have a constant pollution_level |
| AI assistant quota error | Daily free-tier exhausted — generate a new key at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Video not playing in browser | Ensure `processed_videos/` directory exists and the backend is running |
| Sidebar animation glitch | `FadeLayer` must use opacity-only transitions — never add `transform` to it |

---

## Team

**HITEC University Taxila — Final Year Project 2026**

| Name | Role |
|---|---|
| Touseef Ur Rehman | ML Engineer — YOLOv26s, LSTM v2, data pipeline, accuracy optimisation |
| Qasim Shahzad | Backend Engineer — FastAPI, SQLite, authentication, connection pooling |
| Zohaib Ashraf | Frontend Engineer — React, UI/UX, PDF reports, Leaflet heatmap |

---

*Developed for academic research and marine conservation purposes. Not licensed for commercial use.*
