# OceanScan AI - Project Structure

## Overview
This project consists of a React frontend with TypeScript and a FastAPI backend with LSTM-based environmental prediction capabilities.

## Directory Structure

```
oceanscan-ai/
├── backend/                    # Python FastAPI backend
│   ├── tests/                  # Test files
│   │   ├── test_*.py          # Various test scripts
│   │   └── test_lstm_system.py # Main system test
│   ├── weights/               # Model weights and configs
│   │   ├── best.pt           # YOLO model weights
│   │   ├── lstm_*.h5         # LSTM model files
│   │   ├── *_scaler.pkl      # Data scalers
│   │   └── model_config.json # Model configuration
│   ├── processed_videos/      # Processed video outputs
│   ├── main.py               # FastAPI application entry point
│   ├── lstm_model.py         # LSTM model implementation
│   ├── environmental_data.py # Environmental data service
│   ├── noaa_cdo_api.py      # NOAA Climate Data API client
│   ├── waqi_api.py          # World Air Quality Index API client
│   ├── requirements.txt      # Python dependencies
│   ├── .env                 # Environment variables (not in git)
│   └── .env.example         # Environment variables template
│
├── src/                       # React frontend source
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Layout components (Sidebar, MainLayout)
│   │   ├── home/            # Home page specific components
│   │   └── loading/         # Loading components
│   ├── pages/               # Page components
│   │   ├── HomePage.tsx
│   │   ├── UploadPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── PredictionsPage.tsx  # LSTM prediction interface
│   │   ├── HeatmapPage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── ResultsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── NotFound.tsx
│   ├── hooks/               # Custom React hooks
│   │   ├── useTheme.tsx
│   │   ├── useSidebar.tsx
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── lib/                 # Utility libraries
│   │   ├── utils.ts
│   │   └── generateReport.ts
│   ├── assets/              # Static assets
│   │   └── marine-logo.png
│   ├── App.tsx              # Main App component
│   ├── main.tsx             # React entry point
│   └── index.css            # Global styles with theme variables
│
├── public/                   # Static public files
├── dist/                    # Build output (generated)
├── node_modules/            # Node.js dependencies (generated)
├── package.json             # Node.js dependencies and scripts
├── vite.config.ts          # Vite configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── README.md               # Project documentation
```

## Key Features

### Backend (FastAPI + Python)
- **YOLO Object Detection**: Marine plastic detection in images/videos
- **LSTM Prediction System**: Environmental trend forecasting
- **Multi-API Integration**: NOAA, WAQI, OpenWeather, Copernicus
- **Real-time Processing**: Async data fetching and processing
- **Professional ML Pipeline**: Data preprocessing, training, prediction

### Frontend (React + TypeScript)
- **Modern UI**: Ocean-themed design with glassmorphism effects
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Interactive Charts**: Recharts for data visualization
- **Real-time Updates**: Live prediction updates and training progress
- **Professional UX**: Loading states, error handling, toast notifications

## API Endpoints

### Core Detection
- `POST /detect` - Image object detection
- `POST /detect-video` - Video frame analysis

### LSTM Prediction System
- `GET /api/prediction/areas` - Available marine areas
- `POST /api/prediction/data-fetch` - Fetch environmental data
- `POST /api/prediction/train` - Train LSTM model
- `POST /api/prediction/predict` - Generate predictions
- `POST /api/prediction/analyze` - Historical analysis
- `GET /api/prediction/model-info` - Model status

### System
- `GET /health` - System health check

## Environment Setup

### Backend
1. Install Python dependencies: `pip install -r backend/requirements.txt`
2. Copy `backend/.env.example` to `backend/.env`
3. Add your API keys to `.env` file
4. Run: `python backend/main.py`

### Frontend
1. Install Node.js dependencies: `npm install`
2. Run development server: `npm run dev`
3. Build for production: `npm run build`

## Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **TensorFlow/Keras**: LSTM model implementation
- **Pandas**: Data manipulation and analysis
- **Scikit-learn**: Data preprocessing and metrics
- **Ultralytics YOLO**: Object detection
- **Aiohttp**: Async HTTP client for API calls

### Frontend
- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality UI components
- **Framer Motion**: Smooth animations
- **Recharts**: Data visualization
- **React Router**: Client-side routing

## Data Sources
- **NOAA Climate Data Online**: Historical weather and climate data
- **World Air Quality Index**: Real-time air quality measurements
- **OpenWeather API**: Current weather conditions
- **WeatherAPI**: Alternative weather data source
- **Copernicus Marine Service**: Satellite and marine observations

## Model Architecture
- **LSTM Layers**: 2 layers (64, 32 units) with dropout
- **Input Features**: 8 environmental parameters
- **Sequence Length**: 30 days of historical data
- **Output**: Multi-step pollution level predictions
- **Training**: Adam optimizer with early stopping

## Development Guidelines
- Follow TypeScript strict mode
- Use ESLint for code quality
- Implement proper error handling
- Add loading states for async operations
- Use semantic commit messages
- Test API endpoints before frontend integration