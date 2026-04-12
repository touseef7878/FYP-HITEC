# 🌊 Marine Detection System

AI-powered platform for marine plastic pollution detection and environmental trend analysis using YOLOv11s and LSTM neural networks.

**HITEC University Taxila - Final Year Project 2026**

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Installation](#-installation)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [Usage Guide](#-usage-guide)
- [API Documentation](#-api-documentation)
- [ML Models](#-ml-models)
- [Security](#-security-features)
- [Troubleshooting](#-troubleshooting)
- [Team](#-team)

---

## ✨ Features

### Core Features
- **YOLOv11s Object Detection** - Real-time detection of marine debris across 8 categories (70.3% mAP50)
- **LSTM Predictions** - Forecast pollution trends for 7-90 days ahead across 4 marine regions
- **User Authentication** - JWT-based auth with USER/ADMIN roles and session tracking
- **Interactive Heatmaps** - Visualize pollution density across marine regions
- **PDF Reports** - Auto-generated detection and analysis reports
- **Admin Dashboard** - System management and user administration
- **Dark/Light Theme** - Responsive design for all devices

### Detection Capabilities
- Image and video upload with drag-drop interface
- Frame-by-frame video analysis
- Adjustable confidence threshold (10-90%)
- Real-time progress tracking with time estimation
- Detection history with search/filter/delete
- Before/after comparison slider
- Lazy video loading (0MB preload vs 50-200MB)
- HTTP range request support for video streaming

### LSTM Prediction System
- Multi-region support: Pacific, Atlantic, Indian Ocean, Mediterranean
- 10 environmental features: temperature, humidity, pressure, wind speed, AQI, PM2.5, ocean temp, precipitation, salinity, chlorophyll
- 7-90 day predictions with confidence intervals
- Model training with configurable epochs (10-200)
- Synthetic data fallback when real data is unavailable
- 1-hour cooldown per region to prevent API throttling

---

## 🛠️ Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool with SWC)
- Tailwind CSS + shadcn/ui (Radix UI primitives)
- React Query v5 (caching, stale-time 5min)
- Recharts (data visualization)
- Leaflet + react-leaflet (interactive maps)
- Framer Motion (animations and page transitions)
- jsPDF + jspdf-autotable (PDF report generation)
- All pages lazy-loaded via `React.lazy`

### Backend
- FastAPI (Python web framework)
- SQLite with WAL mode + connection pooling (10 connections)
- YOLOv11s via Ultralytics (object detection)
- TensorFlow/Keras (LSTM time-series models)
- OpenCV (image/video processing)
- bcrypt (password hashing)
- JWT authentication (HS256, 24h expiry)
- GZip compression middleware (3-5x smaller responses)
- 23 database performance indexes across 10 tables

### External Data Sources
- NOAA Climate Data Online (CDO) API — weather station data (PRCP, TMAX, TMIN, AWND, PRES)
- World Air Quality Index (WAQI) API — coastal city AQI, PM2.5, PM10, NO2, SO2, CO, O3

### Configuration
- All API URLs centralized in `src/config/env.ts` via `VITE_API_URL`
- No hardcoded `localhost:8000` in any frontend file

---

## 🏗️ Architecture Overview

```
Browser (React SPA)
       │
       │ HTTP/REST (JWT Bearer)
       ▼
FastAPI Backend (port 8000)
  ├── YOLO Detection Pipeline
  │     Upload → OpenCV preprocess → YOLOv11s inference → annotate → store
  ├── LSTM Forecasting Pipeline
  │     Fetch (NOAA+WAQI) → cache CSV → preprocess → train → predict
  └── SQLite Database (WAL mode, connection pool)
```

**Data flow for LSTM:**
1. Fetch environmental data from NOAA CDO + WAQI APIs (or generate synthetic)
2. Merge by date, calculate pollution level, cache as `{region}_dataset.csv`
3. Train 2-layer LSTM on combined multi-region data (all 4 regions)
4. Save per-region model weights (`.keras` + `.h5`) and scalers (`.pkl`)
5. Predict using last 60 days of cached data as autoregressive context

---

## 📦 Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Step 1: Clone Repository
```bash
git clone <your-repo-url>
cd marine-detection-system
```

### Step 2: Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Configure environment variables:
```bash
# Generate a secure JWT secret key
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Edit `backend/.env`:
```env
JWT_SECRET_KEY=<paste-the-generated-key-here>
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173

# Optional — required only for real data fetching
NOAA_CDO_TOKEN=<your-noaa-token>
WAQI_TOKEN=<your-waqi-token>
```

Initialize the database:
```bash
python init_db.py
```

This creates `marine_detection.db` with 10 tables, 23 performance indexes, WAL mode, connection pooling, and default accounts:
- Admin: `admin` / `admin123`
- Demo user: `demo_user` / `user123`

> ⚠️ Change default passwords before deploying to production.

Add YOLO weights: place `best.pt` in `backend/weights/`.

### Step 3: Frontend Setup

```bash
cd ..
npm install
```

Optionally configure `VITE_API_URL` in `.env` (defaults to `http://localhost:8000`):
```env
VITE_API_URL=http://localhost:8000
```

---

## 🚀 Running the Application

Open two terminals:

**Terminal 1 - Backend:**
```bash
cd backend
python main.py
```
Runs at: http://localhost:8000

**Terminal 2 - Frontend:**
```bash
npm run dev
```
Runs at: http://localhost:8080

### Production Build
```bash
# Frontend
npm run build && npm run preview

# Backend
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 📁 Project Structure

```
marine-detection-system/
├── backend/
│   ├── core/
│   │   ├── database.py          # SQLite manager with connection pooling + WAL mode
│   │   └── security.py          # JWT auth, session management, bcrypt hashing
│   ├── models/
│   │   ├── lstm.py              # EnvironmentalLSTM class (train + predict)
│   │   ├── {region}_lstm.keras  # Trained model weights (Keras native format)
│   │   ├── {region}_lstm.h5     # Trained model weights (h5 fallback)
│   │   ├── {region}_feature_scaler.pkl
│   │   ├── {region}_target_scaler.pkl
│   │   └── {region}_config.json
│   ├── services/
│   │   ├── data_cache_service.py        # NOAA/WAQI fetching + CSV caching
│   │   └── data_cache/                  # Cached datasets per region
│   │       └── {region}_dataset.csv
│   ├── utils/
│   │   ├── noaa_api.py          # NOAA CDO API client
│   │   └── waqi_api.py          # WAQI API client
│   ├── weights/
│   │   └── best.pt              # YOLOv11s custom weights (add this)
│   ├── processed_videos/        # Uploaded + annotated video files
│   ├── init_db.py               # One-time database setup
│   ├── main.py                  # FastAPI app + all endpoints
│   ├── requirements.txt
│   └── marine_detection.db      # Auto-created by init_db.py
│
└── src/
    ├── components/
    │   ├── auth/                # LoginForm, RegisterForm
    │   ├── common/              # ErrorBoundary, VideoPlayer, NavLink, ThemeToggle
    │   ├── features/            # InteractiveMap, FishBackground
    │   ├── layout/              # MainLayout, AdminLayout, PageTransition
    │   └── ui/                  # shadcn/ui components (20+ components)
    ├── config/
    │   └── env.ts               # Centralized env config (VITE_API_URL)
    ├── contexts/
    │   └── AuthContext.tsx      # Auth state, login/logout, token refresh
    ├── hooks/                   # useTheme, useSidebar, use-mobile, use-toast
    ├── pages/
    │   ├── admin/               # Dashboard, Logs, Users
    │   ├── user/                # Upload, Results, Dashboard, History,
    │   │                        # Heatmap, Predictions, Reports, Settings
    │   ├── Auth.tsx
    │   ├── Home.tsx
    │   ├── PrivacyPolicy.tsx
    │   └── NotFound.tsx
    ├── utils/
    │   ├── cn.ts
    │   ├── generateReport.ts    # jsPDF report generation
    │   └── logger.ts            # Production-safe logger
    └── App.tsx                  # Lazy-loaded routes + ProtectedRoute guards
```

---

## 📖 Usage Guide

### 1. Login
Open http://localhost:8080 and log in with the credentials above.

### 2. Upload & Detect
1. Go to **Upload**
2. Drag-drop an image or video
3. Adjust confidence threshold (default 25%)
4. Click **Start Detection**
5. Auto-redirects to results after processing

### 3. View History
Go to **History** to browse, filter, and delete past detections.

### 4. Generate Predictions (3-step workflow)
1. Go to **Predictions**
2. Select a region (Pacific, Atlantic, Indian Ocean, Mediterranean)
3. **Step 1 — Fetch Data**: Downloads NOAA + WAQI data and caches it locally (1-hour cooldown per region; synthetic data used if APIs unavailable)
4. **Step 2 — Train Model**: Trains the LSTM on combined multi-region data (configure epochs 10-200)
5. **Step 3 — Predict**: Generate 7-90 day pollution forecasts with confidence intervals

### 5. Generate Reports
Go to **Reports**, select date range, click **Generate Report**, download PDF.

### 6. Admin Panel (Admin Only)
- View system stats, manage users, review activity logs

---

## 🔗 API Documentation

Interactive docs when backend is running:
- Swagger UI: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### Key Endpoints

```
# Auth
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout

# Detection
POST /detect                          # Image detection
POST /detect-video                    # Video detection
GET  /api/history                     # User detection history
DELETE /api/history/{id}              # Delete detection

# Data & Training
GET  /api/data/regions                # Available regions + cache status
POST /api/data/fetch                  # Fetch NOAA + WAQI data (1hr cooldown)
GET  /api/data/fetch-status           # Cooldown status for all regions
GET  /api/data/status/{region}        # Dataset + model status for region
POST /api/train                       # Train LSTM (body: {region, epochs})
GET  /api/train/status/{region}       # Training status

# Predictions (requires auth)
POST /api/predict                     # Generate forecasts (body: {region, days_ahead})

# Video Streaming
GET  /processed-video/{filename}      # Range-request video streaming

# Admin
GET  /api/admin/stats
GET  /api/admin/users
GET  /api/admin/logs
```

---

## 🧠 ML Models

### YOLOv11s — Object Detection

- **Weights**: `backend/weights/best.pt` (custom trained on marine debris)
- **Framework**: Ultralytics (requires `ultralytics>=8.4.0`)
- **Architecture**: YOLOv11s (Small) — optimized for real-time embedded deployment (Jetson Nano / ROV)
- **Dataset**: 17,429 images (13,043 train / 3,261 validation), 8 debris classes
- **Training**: 100 epochs, SGD with linear LR decay, Mosaic + Mixup augmentation, transfer learning from YOLOv11s pretrained weights
- **Overall mAP50**: 70.3%
- **Inference speed**: ~25ms per image on Tesla T4 GPU (~30-40 FPS, real-time ready)

**Per-class performance:**

| Class | mAP50 | Status |
|---|---|---|
| Fishing Net | 99.4% | Exceptional |
| Tyre | 89.1% | Excellent |
| Glass Bottle | 74.7% | Strong |
| Plastic Bag | 61.2% | Moderate |
| Plastic Bottle | 53.6% | Moderate |

Fishing nets score highest due to their distinct repeating texture patterns. Plastic bags score lowest because they are translucent, deformable, and visually similar to jellyfish or sandy backgrounds.

**Image pipeline:**
```
Upload → PIL/OpenCV load → YOLOv11s inference → confidence filter → bbox extraction → annotate → base64 encode → store
```

**Video pipeline:**
```
Upload → frame extraction (OpenCV) → YOLOv11s per frame → aggregate results → annotate frames → FFmpeg encode MP4 → stream
```

### LSTM — Pollution Trend Forecasting

- **Framework**: TensorFlow/Keras
- **Architecture**: 2-layer stacked LSTM
  - Layer 1: 64 LSTM units, `return_sequences=True`
  - Dropout: 0.2
  - Layer 2: 32 LSTM units
  - Dropout: 0.2
  - Output: Dense(1, activation='linear')
- **Input**: 30-day sequences × 10 environmental features
- **Target**: `pollution_level` (0-100 scale)
- **Optimizer**: Adam (lr=0.001)
- **Loss**: Mean Squared Error
- **Callbacks**: EarlyStopping (patience=15), ReduceLROnPlateau (patience=8, factor=0.5)
- **Validation split**: 20%

**10 Input Features:**

| Feature | Source |
|---|---|
| temperature | NOAA CDO (TMAX/TMIN) |
| humidity | Derived / synthetic |
| pressure | NOAA CDO (PRES) |
| wind_speed | NOAA CDO (AWND) |
| aqi | WAQI API |
| pm25 | WAQI API |
| ocean_temp | Derived / synthetic |
| precipitation | NOAA CDO (PRCP) |
| salinity | Synthetic |
| chlorophyll | Synthetic |

**Regions and base pollution levels:**

| Region | Base Pollution | Base AQI | Base Ocean Temp |
|---|---|---|---|
| Pacific | 65 | 60 | 12°C |
| Atlantic | 45 | 50 | 15°C |
| Indian Ocean | 55 | 65 | 22°C |
| Mediterranean | 40 | 45 | 18°C |

**Training flow:**
1. Collect data from all 4 regions (real cached CSV or synthetic 730-day generation)
2. Combine into single multi-region dataset
3. MinMaxScaler on features and target separately
4. Create 30-day sliding window sequences
5. Train with early stopping
6. Save per-region: `.keras` (primary), `.h5` (fallback), `_feature_scaler.pkl`, `_target_scaler.pkl`, `_config.json`

**Inference (autoregressive):**
1. Load last 60 days of cached data as context
2. Scale with saved feature scaler
3. Predict next day → update AQI feature → repeat for N days
4. Confidence: starts at 0.85, decays by 0.02/day (min 0.50)

---

## 🔒 Security Features

- JWT authentication (HS256, 24h expiry, 32+ char secret key required)
- Session tracking in database — token revocation supported
- CORS with explicit origin whitelist (no wildcard `*`)
- Password hashing with bcrypt (primary) / PBKDF2-260k (fallback)
- SQL injection protection via parameterized queries
- Connection pooling prevents database exhaustion
- GZip compression reduces bandwidth exposure
- Role-based access control (USER / ADMIN)

---

## 🗄️ Database Schema

10 tables with WAL mode and connection pooling:

| Table | Purpose |
|---|---|
| `users` | Accounts, roles, profile data |
| `sessions` | JWT token hashes + expiry tracking |
| `detections` | Upload metadata, status, processing time |
| `detection_results` | Per-object bounding boxes + confidence |
| `images` | Image dimensions + base64 encoded results |
| `videos` | Frame count, FPS, duration, resolution |
| `predictions` | LSTM forecast values + confidence intervals |
| `reports` | Generated PDF metadata |
| `analytics_data` | Heatmap and trend data points |
| `logs` | System activity logs (DEBUG → CRITICAL) |

---

## 🐛 Troubleshooting

**Backend won't start** — "JWT_SECRET_KEY required"
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Add output to backend/.env as JWT_SECRET_KEY=...
```

**CORS errors**
```env
# backend/.env
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173
```

**Database errors** — "No such table"
```bash
cd backend
rm marine_detection.db
python init_db.py
```

**YOLO model not loading**
- Ensure `backend/weights/best.pt` exists (YOLOv11s weights)
- Ensure `ultralytics>=8.4.0` is installed: `pip install "ultralytics>=8.4.0"`

**LSTM predictions fail** — "No trained model found"
- Complete the 3-step workflow in the Predictions page: Fetch Data → Train → Predict
- If NOAA/WAQI tokens are missing, synthetic data will be used automatically

**Module not found**
```bash
pip install -r backend/requirements.txt
npm install
```

---

## 👥 Team

**HITEC University Taxila - Final Year Project 2026**

- **Touseef Ur Rehman** - ML Engineer (YOLOv11s & LSTM)
- **Qasim Shahzad** - Backend Engineer (FastAPI & Database)
- **Zohaib Ashraf** - Frontend Engineer (React & UI/UX)

---

## 📄 License

Developed for academic research and marine conservation at HITEC University Taxila.
