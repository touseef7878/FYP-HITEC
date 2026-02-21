# 🚀 Quick Start Guide

Get the Marine Detection System running in 5 minutes.

---

## Prerequisites

- Python 3.8+
- Node.js 16+
- Git

---

## Installation Steps

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd marine-detection-system
```

### 2. Backend Setup

```bash
# Navigate to backend folder
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Generate secure JWT secret
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Edit `backend/.env`** and paste the generated key:
```env
JWT_SECRET_KEY=<paste-your-generated-key-here>
ALLOWED_ORIGINS=http://localhost:8080
```

```bash
# Initialize database
python init_db.py
```

**Add YOLO weights**: Place `best.pt` file in `backend/weights/` folder

### 3. Frontend Setup

```bash
# Go back to root directory
cd ..

# Install Node dependencies
npm install
```

---

## Running the Application

### Terminal 1 - Backend
```bash
cd backend
python main.py
```
✅ Backend running at: http://localhost:8000

### Terminal 2 - Frontend
```bash
npm run dev
```
✅ Frontend running at: http://localhost:8080

---

## Default Login Credentials

### Admin Account
- Username: `admin`
- Password: `admin123`

### Demo User
- Username: `demo_user`
- Password: `user123`

---

## Quick Links

- **Application**: http://localhost:8080
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

---

## File Locations Reference

### Backend Files
```
backend/
├── main.py              # Start backend: python main.py
├── init_db.py           # Initialize DB: python init_db.py
├── .env                 # Configuration (create from .env.example)
├── requirements.txt     # Python dependencies
└── weights/best.pt      # YOLO model (add this file)
```

### Frontend Files
```
Root directory/
├── package.json         # Node dependencies
├── .env                 # Frontend config (optional)
└── vite.config.ts       # Vite configuration
```

---

## Common Commands

### Development
```bash
# Backend (from backend/ folder)
python main.py

# Frontend (from root folder)
npm run dev
```

### Build
```bash
# Build frontend
npm run build

# Preview production build
npm run preview
```

### Database
```bash
# Initialize database (from backend/ folder)
python init_db.py

# Reset database (deletes all data)
rm marine_detection.db
python init_db.py
```

---

## Troubleshooting

### Backend won't start
**Error**: "JWT_SECRET_KEY environment variable is required"

**Fix**:
```bash
cd backend
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy output to backend/.env as JWT_SECRET_KEY
```

### Database errors
**Error**: "No such table"

**Fix**:
```bash
cd backend
python init_db.py
```

### CORS errors
**Error**: "CORS policy blocked"

**Fix**: Add your URL to `ALLOWED_ORIGINS` in `backend/.env`

---

## Next Steps

1. ✅ Application running
2. 📖 Read full [README.md](README.md) for detailed features
3. 🔍 Explore [API Documentation](http://localhost:8000/docs)
4. 📚 Check [docs/guides/](docs/guides/) for detailed guides

---

**Need help?** See [README.md](README.md) for complete documentation.
