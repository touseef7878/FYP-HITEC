# 🏗️ Professional Project Structure

## Overview
This document describes the new, professionally organized structure of the Marine Detection System.

## Directory Structure

```
marine-detection-system/
├── 📂 backend/                          # Backend Application
│   ├── 📂 api/                          # API Routes (Future: Split endpoints)
│   │   └── __init__.py
│   ├── 📂 core/                         # Core Business Logic
│   │   ├── __init__.py
│   │   ├── database.py                  # Database manager
│   │   └── security.py                  # Authentication & security
│   ├── 📂 models/                       # ML Models & Data Schemas
│   │   ├── __init__.py
│   │   └── lstm.py                      # LSTM model implementation
│   ├── 📂 services/                     # Business Logic Services
│   │   ├── __init__.py
│   │   ├── data_cache.service.py        # Data caching service
│   │   └── environmental_data.service.py # Environmental data fetching
│   ├── 📂 utils/                        # Utility Functions
│   │   ├── __init__.py
│   │   ├── noaa_api.py                  # NOAA API client
│   │   └── waqi_api.py                  # WAQI API client
│   ├── 📂 data/                         # Data Storage
│   │   ├── cache/                       # Cached datasets
│   │   ├── uploads/                     # User uploads
│   │   └── processed/                   # Processed videos
│   ├── 📂 weights/                      # Model Weights
│   │   ├── best.pt                      # YOLO weights
│   │   ├── *.h5                         # LSTM weights
│   │   └── *.pkl                        # Scalers
│   ├── 📂 migrations/                   # Database Migrations
│   ├── .env.example                     # Environment template
│   ├── .env                             # Environment variables (gitignored)
│   ├── main.py                          # Application entry point
│   ├── init_db.py                       # Database initialization
│   ├── requirements.txt                 # Python dependencies
│   ├── marine_detection.db              # SQLite database
│   └── README.md                        # Backend documentation
│
├── 📂 src/                              # Frontend Application
│   ├── 📂 assets/                       # Static Assets
│   │   └── images/
│   │       └── marine-logo.png
│   ├── 📂 components/                   # React Components
│   │   ├── 📂 common/                   # Shared Components
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── NavLink.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── VideoPlayer.tsx
│   │   ├── 📂 auth/                     # Authentication Components
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── 📂 layout/                   # Layout Components
│   │   │   ├── MainLayout.tsx
│   │   │   ├── AdminLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── PageTransition.tsx
│   │   ├── 📂 features/                 # Feature-Specific Components
│   │   │   ├── heatmap/
│   │   │   │   └── InteractiveMap.tsx
│   │   │   └── home/
│   │   │       └── FishBackground.tsx
│   │   └── 📂 ui/                       # shadcn/ui Components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── ... (30+ UI components)
│   ├── 📂 pages/                        # Page Components
│   │   ├── 📂 admin/                    # Admin Pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Logs.tsx
│   │   │   └── Users.tsx
│   │   ├── 📂 user/                     # User Pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Upload.tsx
│   │   │   ├── Results.tsx
│   │   │   ├── History.tsx
│   │   │   ├── Heatmap.tsx
│   │   │   ├── Predictions.tsx
│   │   │   ├── Reports.tsx
│   │   │   └── Settings.tsx
│   │   ├── Home.tsx
│   │   ├── Auth.tsx
│   │   ├── PrivacyPolicy.tsx
│   │   └── NotFound.tsx
│   ├── 📂 services/                     # API Services
│   │   ├── data.service.ts              # Data management service
│   │   └── database.service.ts          # Database service
│   ├── 📂 hooks/                        # Custom React Hooks
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   ├── useTheme.tsx
│   │   └── useSidebar.tsx
│   ├── 📂 contexts/                     # React Contexts
│   │   └── AuthContext.tsx
│   ├── 📂 utils/                        # Utility Functions
│   │   ├── logger.ts                    # Production-safe logger
│   │   ├── debounce.ts                  # Debounce/throttle utilities
│   │   ├── generateReport.ts            # Report generation
│   │   └── cn.ts                        # Class name utility
│   ├── 📂 config/                       # Configuration
│   │   └── env.ts                       # Environment configuration
│   ├── 📂 styles/                       # Global Styles
│   │   ├── index.css                    # Global styles
│   │   └── App.css                      # App-specific styles
│   ├── 📂 tests/                        # Frontend Tests
│   │   ├── comprehensive.test.tsx
│   │   ├── setup.ts
│   │   └── README.md
│   ├── App.tsx                          # Main App component
│   ├── main.tsx                         # Entry point
│   └── vite-env.d.ts                    # Vite types
│
├── 📂 public/                           # Public Static Files
│   ├── favicon.png
│   ├── placeholder.svg
│   └── robots.txt
│
├── 📂 docs/                             # Documentation
│   ├── 📂 api/                          # API Documentation
│   │   └── API_DOCUMENTATION.md
│   ├── 📂 guides/                       # User Guides
│   │   ├── INSTALLATION.md
│   │   ├── DEPLOYMENT.md
│   │   ├── ENVIRONMENT_SETUP.md
│   │   └── VIDEO_DETECTION_GUIDE.md
│   ├── INDEX.md
│   └── CRITICAL_FIXES.md
│
├── 📂 scripts/                          # Utility Scripts
│   └── (future: setup.sh, deploy.sh, etc.)
│
├── 📂 .vscode/                          # VS Code Settings
├── 📂 .kiro/                            # Kiro IDE Settings
├── 📂 node_modules/                     # Node Dependencies (gitignored)
├── 📂 dist/                             # Build Output (gitignored)
│
├── .env.example                         # Frontend env template
├── .env                                 # Frontend env (gitignored)
├── .gitignore                           # Git ignore rules
├── .npmrc                               # npm configuration
├── components.json                      # shadcn/ui config
├── eslint.config.js                     # ESLint configuration
├── index.html                           # HTML entry point
├── package.json                         # Node dependencies
├── package-lock.json                    # Locked dependencies
├── postcss.config.js                    # PostCSS config
├── tailwind.config.ts                   # Tailwind config
├── tsconfig.json                        # TypeScript config
├── tsconfig.app.json                    # App TypeScript config
├── tsconfig.node.json                   # Node TypeScript config
├── vite.config.ts                       # Vite configuration
├── README.md                            # Main documentation
├── CHANGELOG.md                         # Version history
├── SECURITY_AND_OPTIMIZATION_REPORT.md  # Security audit
├── OPTIMIZATION_IMPLEMENTATION_GUIDE.md # Implementation guide
└── IMPLEMENTATION_SUMMARY.md            # Summary of changes
```

## Key Improvements

### ✅ Backend Organization
- **api/**: Future home for split API routes
- **core/**: Core business logic (database, security)
- **models/**: ML models and data schemas
- **services/**: Business logic services
- **utils/**: Utility functions and API clients
- **data/**: Organized data storage (cache, uploads, processed)

### ✅ Frontend Organization
- **components/common/**: Shared components used across the app
- **components/features/**: Feature-specific components
- **pages/admin/**: Admin-only pages
- **pages/user/**: User-specific pages
- **services/**: API service layer
- **utils/**: Utility functions
- **styles/**: Global styles in dedicated folder

### ✅ Documentation Organization
- **docs/api/**: API documentation
- **docs/guides/**: User and developer guides
- Root docs: Only essential files (README, CHANGELOG)

### ✅ Removed Files
- ❌ `src/lib/backgroundTaskService.ts` (unused)
- ❌ `src/lib/taskPersistence.ts` (unused)
- ❌ `src/App.lazy.tsx` (redundant with proper lazy loading)

### ✅ Recreated Files
- ✅ `src/hooks/useSidebar.tsx` (initially marked as unused but required by Sidebar and MainLayout)

## Benefits

### 🎯 Clear Separation of Concerns
- Backend: api → services → core → database
- Frontend: pages → components → services → utils

### 📁 Easy Navigation
- Related files grouped together
- Intuitive folder names
- Consistent naming conventions

### 🔧 Maintainability
- Easy to find and modify code
- Clear dependencies
- Scalable structure

### 👥 Team Collaboration
- Clear ownership of modules
- Easy onboarding for new developers
- Reduced merge conflicts

### 🚀 Scalability
- Easy to add new features
- Can split into microservices if needed
- Supports monorepo structure

## Naming Conventions

### Files
- **Components**: PascalCase (e.g., `Dashboard.tsx`)
- **Services**: camelCase with .service suffix (e.g., `data.service.ts`)
- **Utils**: camelCase (e.g., `logger.ts`, `debounce.ts`)
- **Config**: camelCase (e.g., `env.ts`)
- **Styles**: kebab-case or camelCase (e.g., `index.css`, `App.css`)

### Folders
- **Lowercase with hyphens**: For multi-word folders (e.g., `data-cache/`)
- **Lowercase**: For single-word folders (e.g., `api/`, `utils/`)
- **PascalCase**: Not used for folders

## Import Paths

### Using Path Aliases
```typescript
// ✅ Good - Using @ alias
import { logger } from '@/utils/logger';
import { Button } from '@/components/ui/button';
import HomePage from '@/pages/Home';

// ❌ Avoid - Relative paths
import { logger } from '../../utils/logger';
import { Button } from '../../../components/ui/button';
```

### Backend Imports
```python
# ✅ Good - Absolute imports
from core.database import db
from services.data_cache.service import data_cache_service
from models.lstm import EnvironmentalLSTM

# ❌ Avoid - Relative imports
from ..core.database import db
from .services.data_cache import data_cache_service
```

## Migration Notes

### All imports automatically updated by smartRelocate
- ✅ Frontend imports updated
- ✅ Backend imports updated
- ✅ No manual changes needed

### What Changed
1. Pages organized by role (admin/, user/)
2. Components organized by type (common/, features/)
3. Services extracted from lib/
4. Utils extracted from lib/
5. Styles moved to dedicated folder
6. Backend organized into layers
7. Documentation organized by category

## Next Steps

### Optional Future Improvements
1. Split backend/main.py into separate route files in api/
2. Create types/ folder for TypeScript interfaces
3. Add integration tests in tests/
4. Create deployment scripts in scripts/
5. Add Docker configuration

---

**Structure Version:** 2.0  
**Last Updated:** February 21, 2026  
**Status:** ✅ Complete and Production Ready
