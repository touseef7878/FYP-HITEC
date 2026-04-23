# OceanGuard AI — Marine Plastic Detection Platform

> AI-powered platform for detecting and forecasting marine plastic pollution using YOLOv26s and LSTM neural networks.

**HITEC University Taxila — Final Year Project 2026**

---

## Overview

OceanGuard AI is a full-stack research platform that combines computer vision and time-series forecasting to detect and predict marine plastic pollution. Users upload images or videos for real-time debris detection, generate multi-day pollution forecasts for four ocean regions, and export results as PDF reports or CSV files. A built-in AI assistant answers questions about the platform and marine science.

---

## Features

| Area | Highlights |
|---|---|
| **Detection** | YOLOv26s · 9 debris classes · 71% mAP50 · image + video · drag-drop · before/after comparison |
| **Forecasting** | 3-step LSTM pipeline · 4 ocean regions · 7–90 day forecasts · confidence intervals · CSV export |
| **Heatmap** | Leaflet map · current + predicted modes · real-time data fetch · 1-hour cooldown |
| **Reports** | PDF generation · YOLO / LSTM / Comprehensive types · configurable date range |
| **Admin** | System stats · user management · logs · DB operations · feature toggles |
| **AI Assistant** | Floating chat widget · Gemini 2.0 Flash · platform + marine science Q&A |
| **UI/UX** | Fully responsive · dark/light theme · smooth page transitions · mobile-first |

---

## Tech Stack

**Frontend** — React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui, React Query v5, Recharts, Leaflet, Framer Motion, jsPDF, `@google/genai`, Vitest

**Backend** — FastAPI, SQLite (WAL + connection pool), Ultralytics YOLOv26s, TensorFlow/Keras, OpenCV, bcrypt, PyJWT

**Data Sources** — Open-Meteo (free, no key) · WAQI (AQI) · NOAA CDO (climate)

---

## Installation

### Prerequisites
- Python 3.10+ · Node.js 18+ · npm

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
JWT_SECRET_KEY=<run: python -c "import secrets; print(secrets.token_urlsafe(32))">
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173

# Optional — real environmental data (synthetic fallback used if omitted)
NOAA_CDO_TOKEN=your_noaa_token
WAQI_TOKEN=your_waqi_token
```

Initialise the database:
```bash
python backend/init_db.py
```

This creates `marine_detection.db` with 10 tables, 23 indexes, and one default account:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | ADMIN |

> **Change the admin password before any public deployment.**

Place YOLOv26s weights at `backend/weights/best.pt`.

### 3. Frontend
```bash
npm install
```

Create `.env`:
```env
VITE_API_URL=http://localhost:8000

# AI Assistant (free — get key at aistudio.google.com/app/apikey)
VITE_GEMINI_API_KEY=your_gemini_api_key
```

---

## Running

```bash
# Terminal 1 — Backend
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
npm run dev
```

Open: **http://localhost:8080**

**Production:**
```bash
npm run build && npm run preview
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Project Structure

```
oceanscan-ai-main/
├── backend/
│   ├── core/
│   │   ├── database.py            # SQLite manager, WAL, connection pool
│   │   └── security.py            # JWT auth, bcrypt, session management
│   ├── models/
│   │   ├── lstm.py                # EnvironmentalLSTM — train, predict, save, load
│   │   └── {region}_lstm.keras    # Per-region trained weights
│   ├── services/
│   │   ├── data_cache_service.py  # Per-region fetch pipeline (v2)
│   │   └── data_cache/            # Cached CSVs + cooldown timestamps
│   ├── utils/
│   │   ├── open_meteo_api.py      # Free weather archive (no key)
│   │   ├── waqi_api.py            # Air quality API
│   │   └── noaa_api.py            # Climate station data
│   ├── weights/best.pt            # YOLOv26s weights (add manually)
│   ├── main.py                    # FastAPI app — all endpoints
│   ├── init_db.py                 # One-time DB setup
│   ├── test_lstm_pipeline.py      # Backend test suite (10 groups)
│   └── requirements.txt
│
└── src/
    ├── components/
    │   ├── features/
    │   │   ├── assistant/         # OceanAssistant — Gemini AI chat widget
    │   │   └── heatmap/           # InteractiveMap (Leaflet)
    │   └── layout/                # Sidebar, AdminLayout, PageTransition
    ├── pages/
    │   ├── admin/                 # Dashboard, Logs, Users, Settings
    │   └── user/                  # Upload, Results, Dashboard, History,
    │                              # Heatmap, Predictions, Reports, Settings
    ├── services/
    │   ├── data.service.ts        # History + analytics with local cache
    │   └── database.service.ts    # Direct API calls
    ├── tests/
    │   └── lstm-pipeline.test.ts  # 39 Vitest tests
    └── App.tsx                    # Lazy routes + fade transitions + guards
```

---

## Usage Guide

### Detection
1. Go to **Upload & Detect** → drag-drop an image or video
2. Adjust confidence threshold if needed (default 25%)
3. Click **Start Detection** — videos poll for progress every 2 seconds
4. Results page shows before/after comparison, per-class breakdown, and download/share options

### LSTM Predictions
Each region runs independently through 3 steps:

1. **Fetch Data** — pulls Open-Meteo + WAQI + NOAA data (1-hour cooldown per region; synthetic fallback if APIs unavailable)
2. **Train Model** — trains a 2-layer LSTM on the cached dataset (configure epochs 10–100)
3. **Generate Forecast** — select 7–90 day horizon → area chart + daily risk table

After predicting: **Save Result** persists to DB (feeds heatmap + reports) · **CSV** downloads the table · **Save as Report** creates a PDF report entry.

### Heatmap
Switch between **Current** (aggregated from saved predictions) and **Predicted** (latest LSTM batch). Click any region circle for detailed stats.

### Reports
Select type (YOLO / LSTM / Comprehensive), date range, optional title → **Generate Report** → View PDF or Download.

### AI Assistant
Click the **OceanGuard Assistant** button (bottom-right, every page). Ask anything about marine pollution, platform features, or the science behind it. Requires `VITE_GEMINI_API_KEY`.

---

## API Reference

Interactive docs: **http://localhost:8000/docs**

```
# Auth
POST /api/auth/register · POST /api/auth/login · GET /api/auth/me · POST /api/auth/logout

# Detection
POST /detect · POST /detect-video
GET  /api/history · GET /api/detections/{id} · GET /api/detections/{id}/status
DELETE /api/user/detections/{id} · DELETE /api/user/history/clear

# LSTM Pipeline
GET  /api/data/regions · GET /api/data/fetch-status · GET /api/data/api-health
POST /api/data/fetch · GET /api/data/status/{region}
POST /api/train · GET /api/train/status/{region}
POST /api/predict · POST /api/analyze

# Heatmap & Reports
GET  /api/heatmap
GET  /api/reports · POST /api/reports/generate · DELETE /api/user/reports/{id}

# Admin
GET  /api/admin/stats · GET /api/admin/users · GET /api/admin/logs · GET /api/admin/activity
POST /api/admin/users/{id}/deactivate · DELETE /api/admin/users/{id}/data
POST /api/admin/system/{action}   # backup | optimize-db | cache-clear | export-data | maintenance
```

---

## ML Models

### YOLOv26s — Object Detection

Trained on ~16,500 marine debris images across 9 classes:

| Class | mAP50 | Class | mAP50 |
|---|---|---|---|
| Fishing Net | 99.4% | Metal Can | 70.3% |
| Tyre | 89.1% | Other Debris | 62.1% |
| Glass Container | 74.7% | Plastic Bag | 61.2% |
| Plastic Bottle | 53.6% | Plastic Fragments | 21.0% |

**Overall mAP50: 70.3%** · ~25ms inference · 100 epochs · SGD + Mosaic/Mixup augmentation

### LSTM — Pollution Forecasting

2-layer stacked LSTM (64 → 32 units) · 30-day input sequences · 10 environmental features · Adam optimizer · EarlyStopping + ReduceLROnPlateau

**Data sources per feature:**

| Feature | Source |
|---|---|
| temperature, wind_speed, precipitation, pressure | Open-Meteo archive (free) |
| aqi, pm25 | WAQI coastal cities |
| ocean_temp, humidity | Derived from weather |
| salinity, chlorophyll | Synthetic (region-specific) |

**Pollution level formula:**
```
pollution = base + seasonal_amplitude × sin(2π(doy − peak)/365)
          + (aqi − 50) × 0.15 + (temp − 18) × 0.4
          − wind × 0.6 − rain × 0.3 + noise(0, 4)
```

Regional baselines: Pacific 65 · Atlantic 45 · Indian 55 · Mediterranean 40

---

## Testing

```bash
# Frontend — 39 Vitest tests (no backend needed)
npm test

# Backend — fast mode (~25s, skips training)
python backend/test_lstm_pipeline.py --fast --skip-fetch

# Backend — full pipeline with live server
python backend/test_lstm_pipeline.py --url http://localhost:8000
```

**Backend test groups:** Open-Meteo API · WAQI API · NOAA API · DataCacheService · Dataset quality · LSTM training · LSTM prediction · HTTP endpoints · Synthetic data · Prediction→DB→Heatmap chain

---

## Security

- JWT HS256 · 24h expiry · 32+ char secret enforced at startup
- bcrypt password hashing (PBKDF2 fallback)
- Session tokens stored in DB — forced logout supported
- CORS explicit origin whitelist — no wildcard `*`
- Parameterized queries throughout — no SQL injection surface
- Role-based access: USER / ADMIN on both frontend and backend

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `JWT_SECRET_KEY required` | `python -c "import secrets; print(secrets.token_urlsafe(32))"` → add to `backend/.env` |
| CORS errors | Add `http://localhost:8080` to `ALLOWED_ORIGINS` in `backend/.env` |
| `No such table` | Run `python backend/init_db.py` |
| YOLO model not loading | Place `best.pt` at `backend/weights/best.pt` · ensure `ultralytics>=8.4.0` |
| No trained model on predict | Complete all 3 steps in Predictions page for that region |
| Heatmap shows no data | Click **Save Result** after predicting — heatmap reads from the predictions table |
| AI assistant quota error | Daily free-tier exhausted — generate a new key at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Sidebar breaks during transitions | `FadeLayer` must use opacity-only — never add `transform` to it |

---

## Team

**HITEC University Taxila — Final Year Project 2026**

| Name | Role |
|---|---|
| Touseef Ur Rehman | ML Engineer — YOLOv26s, LSTM, data pipeline |
| Qasim Shahzad | Backend Engineer — FastAPI, SQLite, authentication |
| Zohaib Ashraf | Frontend Engineer — React, UI/UX, PDF reports |

---

*Developed for academic research and marine conservation. Not licensed for commercial use.*
