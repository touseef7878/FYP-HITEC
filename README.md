# 🌊 Marine Detection System - AI-Powered Ocean Protection Platform

A comprehensive, production-ready full-stack web application for marine plastic pollution detection and environmental trend analysis. Features advanced YOLOv12n object detection, LSTM-based pollution prediction, and a complete user management system with admin dashboard.

## 🎯 System Overview

**Scale**: Designed for 1-5 concurrent users  
**Deployment**: Local/cloud deployment with no external dependencies  
**Database**: SQLite with complete data persistence  
**Authentication**: JWT-based with role-based access control (USER/ADMIN)  
**Tech Stack**: React 18 + TypeScript + FastAPI + TensorFlow + YOLOv12n  

### Core Modules

1. **🔍 Real-time Detection**: YOLOv12n-powered object detection for images and videos
2. **📈 Pollution Prediction**: LSTM neural networks for environmental trend forecasting  
3. **👥 User Management**: Complete authentication system with USER/ADMIN roles
4. **📊 Analytics Dashboard**: Comprehensive data visualization and reporting
5. **🗺️ Spatial Analysis**: Interactive heatmaps and geographical pollution mapping

## ✨ Complete Feature Set

### 🔐 Authentication & User Management
- **User Registration & Login** with email validation
- **JWT Authentication** with secure session management
- **Role-Based Access Control** (USER/ADMIN)
- **Password Management** with secure hashing
- **Profile Management** with customizable settings
- **Session Management** with automatic cleanup

### 🎯 Detection Features
- **Image Upload & Detection** with drag-drop interface
- **Video Processing** with frame-by-frame analysis
- **Real-time Progress Tracking** with animated progress bars
- **Confidence Threshold Control** (adjustable 0.01-1.0)
- **Batch Processing** for multiple files
- **Detection History** per user with search/filter
- **Annotated Results** with bounding boxes and labels
- **Before/After Comparison** slider for visual analysis

### 📊 Analytics & Visualization
- **Interactive Charts** using Recharts library
- **Pollution Heatmaps** with Leaflet mapping
- **Statistical Dashboards** with key metrics
- **Trend Analysis** with historical data
- **Confidence Analytics** and model performance metrics
- **Export Capabilities** for data and reports

### 🤖 LSTM Prediction System
- **Multi-Region Support** (Pacific, Atlantic, Indian, Mediterranean)
- **Environmental Data Integration** (temperature, humidity, wind, AQI)
- **7-90 Day Predictions** with confidence intervals
- **Synthetic Data Generation** for training enhancement
- **Model Training Interface** with epoch control
- **Prediction Accuracy Tracking** with validation metrics

### 📋 Reporting System
- **Auto-Generated PDF Reports** with detection summaries
- **Custom Report Builder** with date range selection
- **Data Export** in multiple formats (CSV, JSON, PDF)
- **Report History** with download management
- **Scheduled Reports** (admin feature)

### 🛡️ Admin Dashboard
- **System Statistics** (users, detections, storage, uptime)
- **User Management** (view, deactivate, role management)
- **System Maintenance** (backup, cache clear, DB optimization)
- **Activity Monitoring** with real-time logs
- **Storage Analytics** with usage tracking
- **Data Management** (export, cleanup, archival)

### 🎨 User Experience
- **Responsive Design** (mobile + desktop optimized)
- **Dark/Light Theme** with system preference detection
- **Smooth Animations** using Framer Motion
- **Loading States** and progress indicators
- **Error Handling** with user-friendly messages
- **Accessibility Compliant** interface

## 🏗️ Technical Architecture

### Frontend Stack
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for consistent component library
- **Framer Motion** for smooth animations
- **React Router** for client-side routing
- **Recharts** for data visualization
- **Leaflet** for interactive maps
- **React Query** for server state management

### Backend Stack
- **FastAPI** with automatic API documentation
- **SQLite** database with 10 optimized tables
- **JWT Authentication** with secure token management
- **YOLOv12n** for state-of-the-art object detection
- **TensorFlow/Keras** for LSTM model training
- **OpenCV** for advanced image processing
- **Pandas/NumPy** for data analysis
- **Uvicorn** ASGI server for production deployment

### Database Schema
```sql
-- 10 Comprehensive Tables
users, detections, detection_results, videos, images, 
predictions, reports, analytics_data, logs, sessions

-- 13 Performance Indexes
-- Automatic cleanup and optimization
-- Full ACID compliance
```

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** with pip
- **Node.js 16+** with npm
- **YOLOv12n model weights** (`best.pt` file)

### Installation (5 minutes)

```bash
# 1. Clone repository
git clone <your-repo-url>
cd marine-detection-system

# 2. Backend setup
cd backend
pip install -r requirements.txt
python init_db.py
# Place your best.pt file in backend/weights/

# 3. Frontend setup
cd ..
npm install

# 4. Start servers (use 2 terminals)
# Terminal 1:
cd backend && python main.py

# Terminal 2:
npm run dev
```

### Access Application
- **Frontend**: http://localhost:8080
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Default Credentials
- **Admin**: `admin` / `admin123`
- **Demo User**: `demo_user` / `user123`

📖 **Detailed Installation**: See [`docs/INSTALLATION.md`](docs/INSTALLATION.md)

## 📖 Usage Guide

### 👤 For Regular Users

**1. Authentication**
- Register new account or login at `/auth`
- Access protected features after authentication

**2. Detection**
- Upload images/videos on Upload page
- Adjust confidence threshold (10-90%)
- View real-time processing with progress tracking
- Analyze results with interactive visualizations

**3. History & Analytics**
- View past detections with filtering
- Track detection trends over time
- Export data and download annotated results

**4. LSTM Predictions**
- Select marine region (Pacific, Atlantic, Indian, Mediterranean)
- Generate 7-90 day pollution forecasts
- View trend analysis with confidence intervals

**5. Reports**
- Generate PDF reports with custom date ranges
- Download comprehensive detection summaries

### 👑 For Administrators

**Admin Dashboard** (`/admin`)
- System statistics and monitoring
- User management (view, deactivate, roles)
- System maintenance (backup, cache, optimization)
- Activity logs and storage analytics

📖 **Detailed Guides**: See [`docs/`](docs/) directory

## � API Endpoints

### Core Endpoints
- **Authentication**: `/api/auth/*` - Register, login, profile
- **Detection**: `/detect`, `/detect-video` - Image/video processing
- **History**: `/api/history` - Detection history
- **Analytics**: `/api/analytics` - User statistics
- **LSTM**: `/api/data/*`, `/api/train`, `/api/predict` - Predictions
- **Reports**: `/api/reports/*` - Report generation
- **Admin**: `/api/admin/*` - System management

📖 **Complete API Reference**: See [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)

## 📊 System Specifications

### Performance
- **Concurrent Users**: 1-5 users
- **Detection Speed**: 2-5 seconds per image
- **Video Processing**: Real-time frame analysis
- **Memory Usage**: 500MB-1GB (model dependent)

### Security
- **Password Hashing**: SHA-256 with salt
- **JWT Tokens**: 24-hour expiration
- **Session Management**: Automatic cleanup
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries

### Database Schema
- **10 Optimized Tables**: users, detections, detection_results, videos, images, predictions, reports, analytics_data, logs, sessions
- **13 Performance Indexes**: Automatic cleanup and optimization
- **ACID Compliance**: Full transaction support

## 🧪 Testing

The application includes comprehensive testing capabilities through the admin dashboard and API health checks.

**Health Check**: http://localhost:8000/health

**API Documentation**: http://localhost:8000/docs (includes interactive testing)

## � Project Structure

```
marine-detection-system/
├── 📂 backend/           # FastAPI backend + ML models
├── 📂 docs/              # Complete documentation
├── 📂 public/            # Static assets
├── 📂 scripts/           # Testing & utility scripts
├── 📂 src/               # React frontend source
├── 📄 README.md          # This file
└── 📄 PROJECT_STRUCTURE.md  # Detailed structure guide
```

📖 **Detailed Structure**: See [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md)

## 🤝 Development Team

**HITEC University Taxila - Final Year Project (2022)**

- **Touseef Ur Rehman** - ML Engineer & YOLOv12n Implementation
- **Qasim Shahzad** - Backend Engineer & LSTM Implementation  
- **Zohaib Ashraf** - Frontend Engineer & Data Visualization

## 📄 License

This project is developed for academic research and marine conservation purposes at HITEC University Taxila. The system is designed to support environmental monitoring and ocean protection initiatives.

---

## 🌟 Key Features

✅ Complete full-stack application with authentication  
✅ Production-ready database with 10 optimized tables  
✅ Advanced ML integration (YOLO + LSTM)  
✅ Responsive UI/UX with dark/light themes  
✅ Comprehensive admin panel  
✅ Real-time processing with progress tracking  
✅ Multi-format export capabilities  
✅ Scalable architecture  

**Ready for deployment and real-world marine conservation use! 🌊**

## 🎯 AI Models

### YOLOv12n Object Detection
- **22 Marine Classes**: Animals (crab, eel, fish, shells, starfish), Plants (marine vegetation), Equipment (ROV), Trash (bags, bottles, containers, nets, ropes, etc.)
- **Detection Speed**: Real-time processing
- **Confidence Threshold**: Adjustable 0.01-1.0

### LSTM Pollution Prediction
- **Input Features**: 10 environmental parameters
- **Sequence Length**: 30 days historical data
- **Regions**: Pacific, Atlantic, Indian, Mediterranean
- **Accuracy**: 94%+ validation accuracy
- **Prediction Range**: 7-90 days ahead