# 🌊 Marine Detection System

AI-powered platform for marine plastic pollution detection and environmental trend analysis using YOLOv12n and LSTM neural networks.

**HITEC University Taxila - Final Year Project 2026**

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [Usage Guide](#-usage-guide)
- [API Documentation](#-api-documentation)
- [Security](#-security-features)
- [Troubleshooting](#-troubleshooting)
- [Team](#-team)

---

## ✨ Features

### Core Features
- **YOLOv12n Object Detection** - Real-time detection of marine plastic in images and videos
- **LSTM Predictions** - Forecast pollution trends for 7-90 days ahead across 4 marine regions
- **User Authentication** - JWT-based auth with USER/ADMIN roles
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

### LSTM Prediction System
- Multi-region support: Pacific, Atlantic, Indian Ocean, Mediterranean
- Environmental data integration (temperature, humidity, wind, AQI, ocean temp)
- 7-90 day predictions with confidence intervals
- Model training with configurable epochs (10-100)
- Synthetic data fallback when real data is unavailable

---

## 🛠️ Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool with SWC)
- Tailwind CSS + shadcn/ui
- React Query (caching, stale-time 5min)
- Recharts (data visualization)
- Leaflet (interactive maps)
- Framer Motion (animations)
- All pages lazy-loaded via `React.lazy`

### Backend
- FastAPI (Python web framework)
- SQLite with connection pooling (10 connections)
- YOLOv12n (object detection)
- TensorFlow/Keras (LSTM models)
- OpenCV (image/video processing)
- JWT authentication
- GZip compression middleware (3-5x smaller responses)
- 28 database performance indexes

### Configuration
- All API URLs centralized in `src/config/env.ts` via `VITE_API_URL`
- No hardcoded `localhost:8000` in any frontend file

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
```

Initialize the database:
```bash
python init_db.py
```

This creates `marine_detection.db` with 10 tables, 28 performance indexes, connection pooling, and default accounts:
- Admin: `admin` / `admin123`
- Demo user: `demo_user` / `user123`

Add YOLO weights: place `best.pt` in `backend/weights/`.

### Step 3: Frontend Setup

```bash
cd ..
npm install
```

Optionally configure `VITE_API_URL` in `.env` (defaults to `http://localhost:8000`).

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
npm run build && npm run preview
# Backend:
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 📁 Project Structure

```
marine-detection-system/
├── backend/
│   ├── core/
│   │   ├── database.py          # SQLite manager with connection pooling
│   │   └── security.py          # JWT auth
│   ├── models/
│   │   └── lstm.py              # LSTM implementation
│   ├── services/
│   │   ├── data_cache_service.py        # NOAA/WAQI data caching
│   │   └── environmental_data_service.py
│   ├── utils/
│   │   ├── noaa_api.py
│   │   └── waqi_api.py
│   ├── weights/
│   │   └── best.pt              # YOLO weights (add this)
│   ├── init_db.py
│   ├── main.py
│   ├── requirements.txt
│   └── marine_detection.db      # Auto-created
│
└── src/
    ├── components/
    │   ├── auth/                # LoginForm, RegisterForm
    │   ├── common/              # ErrorBoundary, VideoPlayer, NavLink, ThemeToggle
    │   ├── features/            # InteractiveMap, FishBackground
    │   ├── layout/              # MainLayout, AdminLayout, PageTransition
    │   └── ui/                  # shadcn/ui components
    ├── config/
    │   └── env.ts               # Centralized env config (VITE_API_URL)
    ├── contexts/
    │   └── AuthContext.tsx
    ├── hooks/
    ├── pages/
    │   ├── admin/               # Dashboard, Logs, Users
    │   ├── user/                # Upload, Results, Dashboard, History,
    │   │                        # Heatmap, Predictions, Reports, Settings
    │   ├── Auth.tsx
    │   ├── Home.tsx
    │   └── NotFound.tsx
    ├── services/
    │   ├── data.service.ts      # Analytics, history, hotspots
    │   └── database.service.ts  # Backend API wrapper
    ├── utils/
    │   ├── cn.ts
    │   ├── generateReport.ts
    │   └── logger.ts            # Production-safe logger
    └── App.tsx                  # Lazy-loaded routes
```

---

## 📖 Usage Guide

### 1. Login
Open http://localhost:8080 and log in with the credentials above.

### 2. Upload & Detect
1. Go to **Upload**
2. Drag-drop an image or video
3. Adjust confidence threshold
4. Click **Start Detection**
5. Auto-redirects to results after processing

### 3. View History
Go to **History** to browse, filter, and delete past detections.

### 4. Generate Predictions
1. Go to **Predictions**
2. Select a region
3. **Step 1**: Fetch Data (one-time per region)
4. **Step 2**: Train Model (configure epochs)
5. **Step 3**: Generate Predictions (7-90 days)

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

# Detection
POST /detect
POST /detect-video
GET  /api/history

# Predictions
GET  /api/data/regions
POST /api/data/fetch
POST /api/train
POST /api/predict

# Admin
GET  /api/admin/stats
GET  /api/admin/users
GET  /api/admin/logs
```

---

## 🔒 Security Features

- JWT authentication (32+ char secret key required)
- CORS with explicit origin whitelist
- Password hashing (SHA-256 + salt)
- SQL injection protection (parameterized queries)
- Connection pooling prevents exhaustion attacks
- GZip compression reduces bandwidth

---

## 🐛 Troubleshooting

**Backend won't start** - "JWT_SECRET_KEY required"
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Add output to backend/.env as JWT_SECRET_KEY=...
```

**CORS errors**
```env
# backend/.env
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173
```

**Database errors** - "No such table"
```bash
cd backend
rm marine_detection.db
python init_db.py
```

**Module not found**
```bash
pip install -r backend/requirements.txt
npm install
```

---

## 👥 Team

**HITEC University Taxila - Final Year Project 2026**

- **Touseef Ur Rehman** - ML Engineer (YOLOv12n & LSTM)
- **Qasim Shahzad** - Backend Engineer (FastAPI & Database)
- **Zohaib Ashraf** - Frontend Engineer (React & UI/UX)

---

## 📄 License

Developed for academic research and marine conservation at HITEC University Taxila.
