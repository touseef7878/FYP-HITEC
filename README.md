# OceanScan - Marine Plastic Detection & Pollution Analysis System

A comprehensive web-based system for marine plastic pollution detection and trend analysis. Uses YOLOv12n for object detection and LSTM for pollution trend prediction in specific marine areas. Built as a Final Year Project for HITEC University Taxila.

## 📋 Project Overview

This system consists of two main modules:

1. **Object Detection Module**: Uses YOLOv12n computer vision model to identify and classify plastic debris in marine images and videos
2. **Pollution Analysis Module**: Employs LSTM neural networks to analyze pollution trends and predict future pollution levels in specific marine areas

The application provides real-time detection results with bounding boxes, confidence scores, and comprehensive pollution trend analysis for environmental monitoring.

## 🛠️ Technologies Used

### Frontend
- **React 18** with TypeScript
- **Vite** for development and building
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Framer Motion** for animations
- **React Router** for navigation
- **Recharts** for data visualization

### Backend
- **FastAPI** Python web framework
- **YOLOv12n** for object detection
- **LSTM** for pollution trend analysis
- **OpenCV** for image processing
- **PIL (Pillow)** for image handling
- **TensorFlow/PyTorch** for deep learning
- **Uvicorn** ASGI server

## ✨ Features

### Detection Module
- Upload images and videos for plastic detection
- Real-time object detection with YOLOv12n
- Interactive results with bounding boxes
- Confidence threshold adjustment
- Batch file processing
- Detection statistics and analytics
- Export annotated images

### Analysis Module
- Pollution trend analysis using LSTM
- Area-specific pollution monitoring
- Historical data visualization
- Future pollution predictions
- Heatmap generation for pollution hotspots
- Comprehensive reporting system

## 🚀 How to Run

### Prerequisites
- Python 3.8+
- Node.js 16+
- Trained YOLOv12n model weights file (`best.pt`)
- LSTM model for trend analysis

### Setup Instructions

1. **Add your models:**
   ```bash
   mkdir backend/weights
   cp /path/to/your/best.pt backend/weights/best.pt
   # Add LSTM model files as needed
   ```

2. **Install and run backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

3. **Install and run frontend (new terminal):**
   ```bash
   npm install
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:8000

## 📊 Model Requirements

### YOLOv12n Detection Model
The system expects YOLOv12n models trained to detect marine plastic debris classes such as:
- Plastic bottles
- Plastic bags
- Fishing nets
- Styrofoam containers
- Plastic caps and lids
- Other marine debris types

### LSTM Analysis Model
The LSTM model analyzes temporal patterns for:
- Pollution density trends
- Seasonal variations
- Area-specific pollution patterns
- Future pollution predictions

## 👥 Development Team

**Final Year Project - HITEC University Taxila (2022)**

- **Touseef Ur Rehman** - ML Engineer & Yollov12n Implementation
- **Qasim Shahzad** - Backend Engineer & LSTM Implementation
- **Zohaib Ashraf** - Frontend Engineer & Data Visualization

## 🎯 Project Purpose

This dual-module system was developed to provide comprehensive marine plastic pollution monitoring through:

### Detection Module
- Automated identification of plastic debris
- Real-time pollution assessment
- Documentation and cataloging of marine waste

### Analysis Module
- Long-term pollution trend monitoring
- Predictive analysis for environmental planning
- Area-specific pollution hotspot identification
- Data-driven environmental decision making

The system serves marine researchers, environmental agencies, and conservation organizations in their efforts to monitor and combat marine plastic pollution.

## 📄 License

This project is developed for academic purposes and marine conservation research at HITEC University Taxila.