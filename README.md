# OceanScan AI

Marine plastic detection and ocean pollution forecasting platform built as a full-stack Final Year Project for HITEC University Taxila.

OceanScan AI combines computer vision, time-series forecasting, authenticated user workflows, admin operations, and report generation in one website. The backend now uses Supabase as the only database backend. There is no local database setup or fallback.

## What The Website Includes

- Public pages: home, authentication, email verification, privacy policy, and not-found handling.
- User workspace: upload detection, results, dashboard, history, heatmap, predictions, reports, and settings.
- Admin workspace: system dashboard, user management, logs, and settings.
- AI assistant: floating Gemini-powered helper for authenticated users.
- Authentication: JWT sessions, bcrypt passwords, role-based routing, email verification, and admin auto-seeding.
- Detection: YOLOv26s image and video inference with annotated outputs and stored history.
- Forecasting: LSTM and GRU training/prediction for Pacific, Atlantic, Indian, and Mediterranean regions.
- Heatmap: Leaflet map with current and predicted pollution signals.
- Reports: saved report history and PDF-oriented report data generation.

## Architecture

```text
React 18 + TypeScript + Vite
  pages, layouts, auth context, React Query, Recharts, Leaflet, Gemini assistant
        |
        | REST JSON + multipart uploads
        v
FastAPI backend
  JWT auth, YOLO inference, LSTM/GRU pipeline, reports, admin endpoints
        |
        | Supabase PostgREST over HTTPS
        v
Supabase Postgres
  users, sessions, detections, detection_results, images, videos,
  predictions, analytics_data, logs, reports
```

Supabase is accessed from the backend with the service-role key through `httpx` and PostgREST. Frontend code talks only to the FastAPI API.

## Tech Stack

Frontend:

- React 18, TypeScript, Vite
- Tailwind CSS and shadcn/ui components
- React Query v5
- Recharts, Leaflet, Framer Motion
- jsPDF and jspdf-autotable
- Google Gemini via `@google/genai`

Backend:

- Python 3.10+
- FastAPI, Uvicorn
- Supabase REST via `httpx`
- Ultralytics YOLO
- TensorFlow/Keras LSTM and GRU
- OpenCV, Pillow, pandas, NumPy, scikit-learn
- bcrypt, PyJWT, aiosmtplib

External data sources:

- Open-Meteo archive
- WAQI
- NOAA CDO
- Synthetic fallback data when API data is unavailable

## Environment Setup

### Backend

Create `backend/.env` from `backend/.env.example`:

```env
JWT_SECRET_KEY=generate_a_32_plus_character_secret
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your.gmail@gmail.com
EMAIL_HOST_PASSWORD=your_gmail_app_password
EMAIL_FROM_NAME=OceanGuard AI

NOAA_CDO_TOKEN=optional_noaa_token
WAQI_TOKEN=optional_waqi_token
```

Generate a JWT secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

Place the YOLO weights at:

```text
backend/weights/best.pt
```

### Frontend

Create `.env` from `.env.example`:

```env
VITE_API_URL=http://localhost:8000
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Install dependencies:

```bash
npm install
```

## Running Locally

Run the backend:

```bash
uvicorn backend.main:app --reload --port 8000
```

Run the frontend:

```bash
npm run dev
```

Open the site at the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

API docs are available at:

```text
http://localhost:8000/docs
```

## Supabase Tables

The backend expects these tables in Supabase:

| Table | Purpose |
|---|---|
| `users` | Accounts, roles, profile data, email verification |
| `sessions` | JWT token hashes, expiry, forced logout state |
| `detections` | Image/video detection jobs and metadata |
| `detection_results` | Per-object classes, confidence, bounding boxes, frame numbers |
| `images` | Image dimensions and base64 originals/annotations |
| `videos` | Video frame counts, FPS, duration, resolution, processed paths |
| `predictions` | LSTM/GRU forecast rows and confidence intervals |
| `analytics_data` | Optional saved analytics points |
| `logs` | System and user activity logs |
| `reports` | Generated report records and report payload metadata |

Backups, point-in-time recovery, and exports are handled in Supabase, not by a local backend script.

## Admin Account

On backend startup, `_ensure_admin()` guarantees this admin account exists:

| Username | Email | Password |
|---|---|---|
| `Admin` | `admin@oceanscan.ai` | `@admin787898` |

Change these values in `backend/main.py` before production deployment.

## Main API Areas

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/auth/verify-email`
- `POST /api/auth/resend-verification`

Detection:

- `POST /detect`
- `POST /detect-video`
- `GET /api/detections/{id}/status`
- `GET /api/detections/{id}`
- `GET /api/history`
- `DELETE /api/user/detections/{id}`
- `DELETE /api/user/history/clear`

Forecasting and heatmap:

- `GET /api/data/regions`
- `GET /api/data/fetch-status`
- `POST /api/data/fetch`
- `POST /api/train`
- `GET /api/train/status/{region}`
- `POST /api/predict`
- `POST /api/analyze`
- `GET /api/heatmap`

Reports and admin:

- `GET /api/reports`
- `POST /api/reports/generate`
- `GET /api/reports/{id}`
- `DELETE /api/user/reports/{id}`
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/logs`
- `POST /api/admin/system/{action}`

## Tests And Checks

Frontend:

```bash
npm test
npm run lint
npm run build
```

Backend quick syntax check:

```bash
python -m py_compile backend/core/database.py backend/core/security.py backend/main.py
```

Backend LSTM pipeline:

```bash
python backend/test_lstm_pipeline.py --fast
```

Live API smoke test, with the backend running:

```bash
python backend/test_live_api.py
```

## Deployment Notes

Frontend deploys as a Vite static site, configured by `vercel.json`.

Backend deployment uses `backend/render.yaml`. Required secrets in Render:

- `JWT_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- optional `NOAA_CDO_TOKEN`
- optional `WAQI_TOKEN`

Set `ALLOWED_ORIGINS` and `FRONTEND_URL` to the deployed frontend domain.

## Troubleshooting

| Problem | Fix |
|---|---|
| `SUPABASE_SERVICE_KEY environment variable is required` | Add `SUPABASE_SERVICE_KEY` to `backend/.env` or hosting secrets |
| Login returns unverified | Verify email through the link or set `email_verified` in Supabase for test accounts |
| CORS error | Add the frontend URL to `ALLOWED_ORIGINS` |
| YOLO unavailable | Place weights at `backend/weights/best.pt` |
| Prediction says no model | Fetch data, train a model, then run prediction |
| Heatmap only shows baseline data | Save prediction results so rows exist in `predictions` |
| AI assistant does not answer | Set `VITE_GEMINI_API_KEY` and restart the frontend dev server |

## Team

| Name | Role |
|---|---|
| Touseef Ur Rehman | ML Engineer: YOLOv26s, LSTM/GRU, data pipeline |
| Qasim Shahzad | Backend Engineer: FastAPI, Supabase, authentication |
| Zohaib Ashraf | Frontend Engineer: React, UI/UX, reports, heatmap |

Developed for academic research and marine conservation purposes.
