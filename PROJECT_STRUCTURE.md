# 📁 Project Structure

## Overview

This document describes the professional folder structure of the Marine Detection System - a production-ready full-stack application for marine plastic pollution detection.

```
marine-detection-system/
├── 📂 backend/                    # Python FastAPI Backend
│   ├── 📂 backups/               # Database backups
│   ├── 📂 data_cache/            # Cached environmental data
│   ├── 📂 models/                # LSTM model files (region-specific)
│   ├── 📂 models_trained/        # Pre-trained LSTM models
│   ├── 📂 processed_videos/      # Processed video outputs
│   ├── 📂 weights/               # YOLO model weights
│   ├── 📄 .env                   # Environment variables
│   ├── 📄 admin_menu.py          # Admin CLI interface
│   ├── 📄 auth.py                # Authentication logic
│   ├── 📄 database.py            # Database operations
│   ├── 📄 data_cache_service.py  # Data caching service
│   ├── 📄 environmental_data.py  # Environmental data fetching
│   ├── 📄 init_db.py             # Database initialization
│   ├── 📄 lstm_model.py          # LSTM model implementation
│   ├── 📄 main.py                # FastAPI application
│   ├── 📄 marine_detection.db    # SQLite database
│   ├── 📄 noaa_cdo_api.py        # NOAA API integration
│   ├── 📄 README.md              # Backend documentation
│   ├── 📄 requirements.txt       # Python dependencies
│   ├── 📄 run_admin_menu.bat     # Windows admin script
│   ├── 📄 run_admin_menu.sh      # Unix admin script
│   ├── 📄 start_server.bat       # Windows server start
│   ├── 📄 start_server.sh        # Unix server start
│   └── 📄 waqi_api.py            # Air quality API integration
│
├── 📂 docs/                       # Documentation
│   ├── 📄 API_DOCUMENTATION.md   # Complete API reference
│   ├── 📄 BEFORE_AFTER_COMPARISON.md # Before/after comparison
│   ├── 📄 CRITICAL_FIXES.md      # Critical fixes summary
│   ├── 📄 DEPLOYMENT.md          # Deployment guide
│   ├── 📄 INDEX.md               # Documentation index
│   ├── � INSTALLATION.md        # Installation guide
│   └── 📄 VIDEO_DETECTION_GUIDE.md # Video detection guide
│
├── 📂 public/                     # Static assets
│   ├── 📄 favicon.ico
│   ├── 📄 favicon.png
│   ├── 📄 placeholder.svg
│   └── 📄 robots.txt
│
├── 📂 src/                        # React Frontend Source
│   ├── � assets/                # Images and media
│   │   └── 📄 marine-logo.png
│   │
│   ├── � components/            # React components
│   │   ├── 📂 auth/             # Authentication components
│   │   ├── 📂 database/         # Database components
│   │   ├── � heatmap/          # Heatmap visualization
│   │   ├── 📂 home/             # Home page components
│   │   ├── 📂 layout/           # Layout components
│   │   ├── 📂 loading/          # Loading states
│   │   ├── 📂 ui/               # shadcn/ui components
│   │   ├── 📄 ErrorBoundary.tsx
│   │   └── 📄 NavLink.tsx
│   │
│   ├── 📂 contexts/              # React contexts
│   │   └── 📄 AuthContext.tsx   # Authentication context
│   │
│   ├── 📂 hooks/                 # Custom React hooks
│   │   ├── 📄 use-mobile.tsx
│   │   ├── 📄 use-toast.ts
│   │   ├── 📄 useSidebar.tsx
│   │   └── 📄 useTheme.tsx
│   │
│   ├── � lib/                   # Utility libraries
│   │   ├── 📄 databaseService.ts # Database service
│   │   ├── 📄 dataService.ts    # Data fetching service
│   │   ├── 📄 generateReport.ts # Report generation
│   │   └── 📄 utils.ts          # Utility functions
│   │
│   ├── 📂 pages/                 # Page components
│   │   ├── 📄 AdminDashboard.tsx
│   │   ├── 📄 AuthPage.tsx
│   │   ├── 📄 DashboardPage.tsx
│   │   ├── 📄 HeatmapPage.tsx
│   │   ├── 📄 HistoryPage.tsx
│   │   ├── 📄 HomePage.tsx
│   │   ├── 📄 NotFound.tsx
│   │   ├── 📄 PredictionsPage.tsx
│   │   ├── 📄 ReportsPage.tsx
│   │   ├── 📄 ResultsPage.tsx
│   │   ├── 📄 SettingsPage.tsx
│   │   └── 📄 UploadPage.tsx
│   │
│   ├── 📂 tests/                 # Frontend tests
│   │   ├── 📄 comprehensive.test.tsx
│   │   ├── 📄 README.md
│   │   └── 📄 setup.ts
│   │
│   ├── 📄 App.css               # App styles
│   ├── 📄 App.tsx               # Main App component
│   ├── 📄 index.css             # Global styles
│   ├── 📄 main.tsx              # Entry point
│   └── 📄 vite-env.d.ts         # Vite types
│
├── 📂 .vscode/                    # VS Code settings
├── 📂 dist/                       # Production build output
├── � node_modules/               # Node dependencies
│
├── � .gitignore                  # Git idgnore rules
├── 📄 .npmrc                      # npm configuration
├── 📄 components.json             # shadcn/ui config
├── 📄 eslint.config.js            # ESLint configuration
├── 📄 index.html                  # HTML entry point
├── 📄 package.json                # Node dependencies
├── 📄 package-lock.json           # Locked dependencies
├── 📄 postcss.config.js           # PostCSS config
├── 📄 PROJECT_STRUCTURE.md        # This file
├── 📄 QUICK_START.md              # Quick start guide
├── 📄 README.md                   # Main documentation
├── 📄 REORGANIZATION_SUMMARY.md   # Reorganization summary
├── 📄 tailwind.config.ts          # Tailwind config
├── 📄 tsconfig.json               # TypeScript config
├── 📄 tsconfig.app.json           # App TypeScript config
├── 📄 tsconfig.node.json          # Node TypeScript config
└── 📄 vite.config.ts              # Vite configuration

```

## 📋 Directory Descriptions

### Backend (`/backend`)
Contains the Python FastAPI backend server with all ML models, database, and API endpoints.

**Key Files:**
- `main.py`: FastAPI application with all endpoints
- `database.py`: SQLite database operations
- `lstm_model.py`: LSTM pollution prediction model
- `auth.py`: JWT authentication system
- `init_db.py`: Database initialization script

**Key Directories:**
- `weights/`: YOLO model weights (best.pt)
- `models/`: LSTM trained model files
- `data_cache/`: Cached environmental datasets
- `processed_videos/`: Video detection outputs
- `backups/`: Database backup files

### Documentation (`/docs`)
Comprehensive project documentation for developers and users.

**Files:**
- `API_DOCUMENTATION.md`: Complete API reference
- `INSTALLATION.md`: Step-by-step installation guide
- `VIDEO_DETECTION_GUIDE.md`: Video processing guide
- `CRITICAL_FIXES.md`: Important fixes and updates
- `DEPLOYMENT.md`: Production deployment guide
- `INDEX.md`: Documentation index

### Frontend Source (`/src`)
React + TypeScript frontend application with modern UI/UX.

**Structure:**
- `components/`: Reusable React components
- `pages/`: Page-level components
- `contexts/`: React context providers
- `hooks/`: Custom React hooks
- `lib/`: Utility functions and services
- `tests/`: Frontend test suites

### Public Assets (`/public`)
Static files served directly by the web server.

**Contents:**
- Favicon files
- robots.txt
- Placeholder images

## 🎯 Key Features by Directory

### Backend Features
- ✅ YOLO object detection (images & videos)
- ✅ LSTM pollution prediction
- ✅ JWT authentication
- ✅ User management
- ✅ Admin dashboard
- ✅ Report generation
- ✅ Database management

### Frontend Features
- ✅ Responsive UI with dark/light themes
- ✅ Real-time detection visualization
- ✅ Interactive analytics dashboards
- ✅ Pollution heatmaps
- ✅ User authentication
- ✅ Admin panel
- ✅ Report generation & export

## 🔧 Configuration Files

### Root Level
- `package.json`: Node.js dependencies and scripts
- `tsconfig.json`: TypeScript compiler options
- `vite.config.ts`: Vite build configuration
- `tailwind.config.ts`: Tailwind CSS customization
- `eslint.config.js`: Code linting rules
- `components.json`: shadcn/ui component config

### Backend
- `requirements.txt`: Python dependencies
- `.env`: Environment variables (API keys, secrets)
- `marine_detection.db`: SQLite database file

## 📦 Build Outputs

### Development
- `node_modules/`: Installed npm packages
- `backend/__pycache__/`: Python bytecode cache

### Production
- `dist/`: Frontend production build
- `backend/processed_videos/`: Processed video files
- `backend/backups/`: Database backups

## 🚀 Quick Navigation

**Start Development:**
```bash
# Backend
cd backend && python main.py

# Frontend
npm run dev
```

**Test Application:**
```bash
# Health check
curl http://localhost:8000/health

# Interactive API testing
# Visit http://localhost:8000/docs
```

**Build for Production:**
```bash
npm run build
```

## 📝 Notes

### Ignored Files (.gitignore)
- `node_modules/`: npm packages
- `dist/`: Build outputs
- `*.db`: Database files
- `*.pt`, `*.h5`: Model weights
- `.env`: Environment variables
- `__pycache__/`: Python cache
- `processed_videos/`: Large video files

### Important Paths
- **YOLO Weights**: `backend/weights/best.pt`
- **Database**: `backend/marine_detection.db`
- **LSTM Models**: `backend/models/` or `backend/models_trained/`
- **Frontend Build**: `dist/`
- **API Docs**: `http://localhost:8000/docs`

## 🎓 For New Developers

1. **Start Here**: Read `README.md` for project overview
2. **Quick Start**: Follow `QUICK_START.md` for 5-minute setup
3. **Installation**: Follow `docs/INSTALLATION.md` for detailed setup
4. **API Reference**: Check `docs/API_DOCUMENTATION.md`
5. **Frontend**: Explore `src/` for React components
6. **Backend**: Check `backend/` for API logic

## 🔄 Maintenance

### Regular Tasks
- Database backups: Use admin dashboard
- Clear cache: `backend/data_cache/`
- Update dependencies: `npm update` and `pip install --upgrade`
- Check logs: Backend console output

### Cleanup Commands
```bash
# Clear node modules
rm -rf node_modules && npm install

# Clear Python cache
find . -type d -name __pycache__ -exec rm -rf {} +

# Clear build
rm -rf dist
```

---

**This structure follows industry best practices for full-stack web applications with clear separation of concerns, maintainability, and scalability.**
