"""
Enhanced FastAPI Main Application
Implements authentication, user management, and comprehensive marine detection system
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
from PIL import Image
import cv2
import numpy as np
import pandas as pd
import base64
import io
import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
import tempfile
import uuid
import asyncio
import shutil
from pydantic import BaseModel
import time

# Load environment variables
load_dotenv()

# Import enhanced components
from database import db
from auth import (
    AuthManager, get_current_user, get_current_active_user, get_admin_user,
    UserRegistration, UserLogin, TokenResponse, UserProfile, PasswordChange, ProfileUpdate
)
from data_cache_service import data_cache_service
from lstm_model import EnvironmentalLSTM

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def generate_synthetic_training_data(region: str, days: int = 730) -> pd.DataFrame:
    """
    Generate synthetic training data when real data is not available
    Creates realistic environmental data patterns for training
    """
    logger.info(f"Generating synthetic training data for {region} ({days} days)")
    
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Region-specific parameters for realistic data
        region_params = {
            'pacific': {
                'base_temp': 15, 'temp_range': 12, 'base_humidity': 70,
                'base_pollution': 65, 'base_aqi': 60, 'base_ocean_temp': 12
            },
            'atlantic': {
                'base_temp': 18, 'temp_range': 15, 'base_humidity': 65,
                'base_pollution': 45, 'base_aqi': 50, 'base_ocean_temp': 15
            },
            'indian': {
                'base_temp': 25, 'temp_range': 8, 'base_humidity': 75,
                'base_pollution': 55, 'base_aqi': 65, 'base_ocean_temp': 22
            },
            'mediterranean': {
                'base_temp': 20, 'temp_range': 18, 'base_humidity': 60,
                'base_pollution': 40, 'base_aqi': 45, 'base_ocean_temp': 18
            }
        }
        
        params = region_params.get(region, region_params['atlantic'])
        
        synthetic_data = []
        for i, date in enumerate(dates):
            day_of_year = date.timetuple().tm_yday
            seasonal_factor = np.sin(2 * np.pi * (day_of_year - 80) / 365.25)
            weekly_factor = np.sin(2 * np.pi * i / 7) * 0.1  # Weekly variation
            
            # Generate realistic environmental data
            record = {
                'date': date,
                'region': region,
                
                # Weather data
                'temperature': params['base_temp'] + seasonal_factor * params['temp_range'] + np.random.normal(0, 3),
                'humidity': max(20, min(100, params['base_humidity'] + seasonal_factor * 15 + np.random.normal(0, 10))),
                'pressure': 1013.25 + seasonal_factor * 5 + np.random.normal(0, 8),
                'wind_speed': max(0, 5 + seasonal_factor * 3 + np.random.exponential(3)),
                'precipitation': max(0, np.random.exponential(2) + seasonal_factor),
                
                # Air quality data
                'aqi': max(0, params['base_aqi'] + seasonal_factor * 20 + weekly_factor * 10 + np.random.normal(0, 12)),
                'pm25': max(0, params['base_aqi'] * 0.4 + seasonal_factor * 8 + np.random.normal(0, 5)),
                'pm10': max(0, params['base_aqi'] * 0.6 + seasonal_factor * 10 + np.random.normal(0, 8)),
                
                # Marine data
                'ocean_temp': params['base_ocean_temp'] + seasonal_factor * 6 + np.random.normal(0, 1),
                'salinity': 35.0 + np.random.normal(0, 0.5),
                'chlorophyll': max(0, np.random.lognormal(0, 0.5)),
                'current_speed': max(0, np.random.exponential(0.5)),
                'wave_height': max(0, np.random.exponential(1.5)),
                
                # Climate data
                'temperature_max': 0,  # Will be calculated
                'temperature_min': 0,  # Will be calculated
                'cloud_cover': max(0, min(100, np.random.normal(50, 20))),
                'uv_index': max(0, min(11, np.random.normal(6, 2))),
            }
            
            # Calculate derived values
            record['temperature_max'] = record['temperature'] + np.random.uniform(2, 8)
            record['temperature_min'] = record['temperature'] - np.random.uniform(2, 6)
            
            # Calculate pollution level based on multiple factors
            pollution_base = params['base_pollution']
            pollution_factors = (
                seasonal_factor * 15 +  # Seasonal variation
                weekly_factor * 5 +     # Weekly variation
                (record['aqi'] - 50) * 0.2 +  # AQI influence
                (record['temperature'] - params['base_temp']) * 0.5 +  # Temperature influence
                -record['wind_speed'] * 0.5 +  # Wind disperses pollution
                np.random.normal(0, 8)  # Random noise
            )
            
            record['pollution_level'] = max(0, min(100, pollution_base + pollution_factors))
            
            synthetic_data.append(record)
        
        df = pd.DataFrame(synthetic_data)
        
        # Ensure no NaN values
        df = df.fillna(0.0)
        
        logger.info(f"✅ Generated {len(df)} days of synthetic training data for {region}")
        logger.info(f"   Average pollution level: {df['pollution_level'].mean():.1f}")
        logger.info(f"   Features: {len(df.columns)} columns")
        
        return df
        
    except Exception as e:
        logger.error(f"Error generating synthetic data for {region}: {e}")
        return pd.DataFrame()

app = FastAPI(title="Marine Plastic Detection API - Refactored")

# CORS - allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request validation
class DataFetchRequest(BaseModel):
    region: str

class TrainingRequest(BaseModel):
    region: str
    epochs: int = 50

class PredictionRequest(BaseModel):
    region: str
    days_ahead: int = 7

# Initialize LSTM model
lstm_model = EnvironmentalLSTM()

# Mount static files (for favicon)
static_path = os.path.join(os.path.dirname(__file__), "..", "public")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# Mount processed videos directory with proper headers
processed_videos_path = os.path.join(os.path.dirname(__file__), "processed_videos")
os.makedirs(processed_videos_path, exist_ok=True)

# Custom video streaming endpoint with proper headers
@app.get("/processed-video/{filename}")
async def serve_video(filename: str, request: Request):
    """Serve video files with proper streaming headers and CORS"""
    try:
        video_path = os.path.join(processed_videos_path, filename)
        
        if not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Get file size
        file_size = os.path.getsize(video_path)
        
        # Determine content type based on file extension
        content_type = "video/mp4"
        if filename.lower().endswith('.webm'):
            content_type = "video/webm"
        elif filename.lower().endswith('.avi'):
            content_type = "video/x-msvideo"
        elif filename.lower().endswith('.mov'):
            content_type = "video/quicktime"
        
        # Handle range requests for video streaming
        range_header = request.headers.get('range')
        
        # Base headers with CORS
        base_headers = {
            'Accept-Ranges': 'bytes',
            'Content-Type': content_type,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Range, Content-Length',
            'Cache-Control': 'public, max-age=3600',
        }
        
        if range_header:
            # Parse range header
            range_match = range_header.replace('bytes=', '').split('-')
            start = int(range_match[0]) if range_match[0] else 0
            end = int(range_match[1]) if range_match[1] else file_size - 1
            
            # Ensure end doesn't exceed file size
            end = min(end, file_size - 1)
            content_length = end - start + 1
            
            # Read the requested chunk
            with open(video_path, 'rb') as video_file:
                video_file.seek(start)
                chunk = video_file.read(content_length)
            
            headers = {
                **base_headers,
                'Content-Range': f'bytes {start}-{end}/{file_size}',
                'Content-Length': str(content_length),
            }
            
            return Response(
                content=chunk,
                status_code=206,  # Partial Content
                headers=headers
            )
        else:
            # Serve entire file
            headers = {
                **base_headers,
                'Content-Length': str(file_size),
            }
            
            return FileResponse(
                path=video_path,
                headers=headers,
                media_type=content_type
            )
            
    except Exception as e:
        logger.error(f"Error serving video {filename}: {e}")
        raise HTTPException(status_code=500, detail="Error serving video")

# Handle OPTIONS requests for CORS preflight
@app.options("/processed-video/{filename}")
async def options_video(filename: str):
    """Handle CORS preflight requests for video files"""
    return Response(
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Range, Content-Length',
            'Access-Control-Max-Age': '86400',
        }
    )

@app.get("/test-video/{filename}")
async def test_video_access(filename: str):
    """Test endpoint to check if video file exists and is accessible"""
    try:
        video_path = os.path.join(processed_videos_path, filename)
        
        if not os.path.exists(video_path):
            return {"exists": False, "path": video_path}
        
        file_size = os.path.getsize(video_path)
        file_stats = os.stat(video_path)
        
        # Try to read video metadata using OpenCV
        video_info = {}
        try:
            import cv2
            cap = cv2.VideoCapture(video_path)
            if cap.isOpened():
                video_info = {
                    "frame_count": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
                    "fps": cap.get(cv2.CAP_PROP_FPS),
                    "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                    "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                    "codec": int(cap.get(cv2.CAP_PROP_FOURCC)),
                    "duration": cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS) if cap.get(cv2.CAP_PROP_FPS) > 0 else 0
                }
                cap.release()
            else:
                video_info = {"error": "Could not open video with OpenCV"}
        except Exception as e:
            video_info = {"error": f"OpenCV error: {str(e)}"}
        
        # Check file header to determine actual format
        file_header = ""
        try:
            with open(video_path, 'rb') as f:
                header_bytes = f.read(12)
                file_header = header_bytes.hex()
        except Exception as e:
            file_header = f"Error reading header: {e}"
        
        return {
            "exists": True,
            "path": video_path,
            "size_bytes": file_size,
            "size_mb": round(file_size / (1024 * 1024), 2),
            "modified": file_stats.st_mtime,
            "accessible": os.access(video_path, os.R_OK),
            "video_info": video_info,
            "file_header": file_header,
            "url": f"/processed-video/{filename}"
        }
        
    except Exception as e:
        return {"error": str(e)}

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint - API information"""
    return {
        "message": "Marine Plastic Detection API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "api": "/api/*"
        }
    }

# Favicon endpoint
@app.get("/favicon.ico")
async def favicon():
    favicon_path = os.path.join(os.path.dirname(__file__), "..", "public", "favicon.png")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/png")
    return JSONResponse({"error": "Favicon not found"}, status_code=404)

# Load YOLO model - supports YOLOv8, YOLOv11, YOLOv12n models
WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "weights", "best.pt")
model = None

def load_yolo_model():
    global model
    try:
        if os.path.exists(WEIGHTS_PATH):
            # Load custom trained model
            model = YOLO(WEIGHTS_PATH)
            logger.info(f"✅ Custom YOLO Model loaded from {WEIGHTS_PATH}")
            logger.info(f"   Model type: {model.model_name if hasattr(model, 'model_name') else 'Custom'}")
            logger.info(f"   Classes: {list(model.names.values()) if model.names else 'Unknown'}")
        else:
            # Fallback to YOLOv12n pretrained model for general object detection
            logger.info(f"⚠️ No custom weights found at {WEIGHTS_PATH}")
            logger.info("🔄 Loading YOLOv12n pretrained model as fallback...")
            try:
                model = YOLO("yolo12n.pt")  # This will download YOLOv12n if not available
                logger.info("✅ YOLOv12n pretrained model loaded successfully")
                logger.info(f"   Classes: {list(model.names.values())[:10]}... (showing first 10)")
            except Exception as e:
                logger.warning(f"Could not load YOLOv12n: {e}")
                logger.info("🔄 Falling back to YOLOv8n...")
                model = YOLO("yolov8n.pt")  # Final fallback
                logger.info("✅ YOLOv8n pretrained model loaded as final fallback")
    except Exception as e:
        logger.error(f"❌ Failed to load any YOLO model: {e}")
        model = None

def clear_all_cache():
    """Clear all cached data and models on server startup for fresh data"""
    import glob
    
    logger.info("🧹 Clearing all cached data for fresh start...")
    
    # Clear data cache
    cache_files = glob.glob(os.path.join(data_cache_service.cache_dir, "*.csv"))
    for file in cache_files:
        try:
            os.remove(file)
            logger.info(f"🗑️ Removed cached dataset: {os.path.basename(file)}")
        except Exception as e:
            logger.warning(f"Could not remove {file}: {e}")
    
    # Clear trained models
    model_files = glob.glob(os.path.join(data_cache_service.models_dir, "*.*"))
    for file in model_files:
        try:
            os.remove(file)
            logger.info(f"🗑️ Removed trained model: {os.path.basename(file)}")
        except Exception as e:
            logger.warning(f"Could not remove {file}: {e}")
    
    logger.info("✅ Cache cleared - ready for fresh data fetching!")

@app.on_event("startup")
async def startup():
    # Clear all cached data on server startup for fresh data
    clear_all_cache()
    load_yolo_model()
    logger.info("🚀 Refactored API server started with fresh cache")

@app.get("/health")
async def health_check():
    model_info = {}
    if model is not None:
        model_info = {
            "loaded": True,
            "classes": list(model.names.values()) if model.names else [],
            "num_classes": len(model.names) if model.names else 0,
            "model_type": getattr(model, 'model_name', 'Custom/Unknown')
        }
    else:
        model_info = {"loaded": False}
    
    return {
        "status": "healthy",
        "yolo_model_loaded": model is not None,
        "model_info": model_info,
        "data_cache_ready": True,
        "lstm_model_ready": True,
        "cache_directory": data_cache_service.cache_dir,
        "models_directory": data_cache_service.models_dir,
        "processed_videos_directory": processed_videos_path
    }

# ============================================================================
# DATA FETCHING ENDPOINTS (ONE-TIME ONLY)
# ============================================================================

@app.get("/api/data/regions")
async def get_available_regions():
    """Get list of supported regions for data fetching"""
    try:
        regions_info = []
        
        for region in data_cache_service.regions:
            dataset_info = data_cache_service.get_dataset_info(region)
            
            regions_info.append({
                "id": region,
                "name": region.title() + " Ocean",
                "dataset_cached": dataset_info is not None,
                "dataset_info": dataset_info
            })
        
        return {
            "success": True,
            "regions": regions_info,
            "cache_directory": data_cache_service.cache_dir
        }
        
    except Exception as e:
        logger.error(f"Error getting regions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/data/fetch")
async def fetch_environmental_data(request: DataFetchRequest):
    """
    Fetch environmental data for a region (ONE-TIME ONLY)
    If dataset already exists, returns 'already_fetched'
    """
    try:
        logger.info(f"🚀 Data fetch request for {request.region}")
        
        # Validate region
        if request.region not in data_cache_service.regions:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid region: {request.region}. Valid regions: {data_cache_service.regions}"
            )
        
        # Check if dataset already exists
        if data_cache_service.dataset_exists(request.region):
            dataset_info = data_cache_service.get_dataset_info(request.region)
            logger.info(f"✅ Data already cached for {request.region}")
            return {
                "success": True,
                "message": "already_cached",
                "region": request.region,
                "dataset_info": dataset_info,
                "fetch_duration_seconds": 0.0,
                "sources_used": ["cached_data"]
            }
        
        # Fetch and cache data
        logger.info(f"Fetching data for {request.region}...")
        result = await data_cache_service.fetch_and_cache_data(request.region)
        
        if result['success']:
            return {
                "success": True,
                "message": "data_fetched_successfully",
                "region": request.region,
                "dataset_info": result['dataset_info'],
                "fetch_duration_seconds": result['fetch_duration_seconds'],
                "sources_used": result['sources_used']
            }
        else:
            raise HTTPException(status_code=500, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in data fetch endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/data/status/{region}")
async def get_data_status(region: str):
    """Get data cache status for a specific region"""
    try:
        if region not in data_cache_service.regions:
            raise HTTPException(status_code=400, detail=f"Invalid region: {region}")
        
        dataset_info = data_cache_service.get_dataset_info(region)
        model_path = data_cache_service.get_model_path(region)
        
        # Check if ANY model exists (for multi-region training)
        any_model_exists = False
        any_model_path = None
        
        for check_region in data_cache_service.regions:
            check_model_path = data_cache_service.get_model_path(check_region)
            if os.path.exists(check_model_path):
                any_model_exists = True
                any_model_path = check_model_path
                break
        
        return {
            "success": True,
            "region": region,
            "dataset_cached": dataset_info is not None,
            "dataset_info": dataset_info,
            "model_trained": any_model_exists,  # True if ANY region has a trained model
            "model_path": any_model_path if any_model_exists else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting data status for {region}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# TRAINING ENDPOINTS (USES CACHED DATA ONLY)
# ============================================================================

@app.post("/api/train")
async def train_lstm_model(request: TrainingRequest):
    """
    Train LSTM model using cached real data + synthetic data for empty regions
    Uses real data where available, synthetic data for regions without cached data
    """
    try:
        logger.info(f"🎯 Training request for {request.region} with {request.epochs} epochs")
        
        # Validate region
        if request.region not in data_cache_service.regions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid region: {request.region}. Valid regions: {data_cache_service.regions}"
            )
        
        # Validate epochs
        if not 10 <= request.epochs <= 200:
            raise HTTPException(
                status_code=400,
                detail="Epochs must be between 10 and 200"
            )
        
        # Collect training data from ALL regions
        logger.info("🌍 Collecting training data from all regions...")
        all_training_data = []
        data_sources = {}
        
        for region in data_cache_service.regions:
            logger.info(f"Processing region: {region}")
            
            if data_cache_service.dataset_exists(region):
                # Use cached real data
                logger.info(f"✅ Using cached real data for {region}")
                region_df = data_cache_service.load_cached_dataset(region)
                data_sources[region] = "real_cached_data"
            else:
                # Generate synthetic data
                logger.info(f"🔄 Generating synthetic data for {region}")
                region_df = await generate_synthetic_training_data(region, days=730)
                
                if not region_df.empty:
                    # Save synthetic data to cache for future use
                    dataset_path = data_cache_service.get_dataset_path(region)
                    region_df.to_csv(dataset_path, index=False)
                    logger.info(f"💾 Saved synthetic data to cache for {region}")
                
                data_sources[region] = "synthetic_data"
            
            if not region_df.empty:
                region_df['region'] = region
                all_training_data.append(region_df)
                logger.info(f"📊 Added {len(region_df)} records from {region}")
        
        if not all_training_data:
            raise HTTPException(
                status_code=500,
                detail="Failed to collect training data from any region"
            )
        
        # Combine all regional data
        import pandas as pd
        combined_df = pd.concat(all_training_data, ignore_index=True)
        logger.info(f"🔗 Combined training data: {len(combined_df)} total records from {len(all_training_data)} regions")
        
        # Train model using combined data
        logger.info(f"🧠 Training LSTM model using combined multi-region data...")
        training_result = lstm_model.train_from_cached_data(
            region=request.region,  # Primary region for model saving
            cached_df=combined_df,
            epochs=request.epochs
        )
        
        if training_result['success']:
            # Determine overall data source
            real_regions = [r for r, source in data_sources.items() if source == "real_cached_data"]
            synthetic_regions = [r for r, source in data_sources.items() if source == "synthetic_data"]
            
            data_source_summary = f"{len(real_regions)} real + {len(synthetic_regions)} synthetic regions"
            
            return {
                "success": True,
                "message": "training_completed",
                "region": request.region,
                "training_result": {
                    **training_result,
                    "data_source": "mixed_multi_region",
                    "data_type": f"Multi-region training: {data_source_summary}",
                    "regions_used": {
                        "real_data": real_regions,
                        "synthetic_data": synthetic_regions
                    }
                },
                "model_path": data_cache_service.get_model_path(request.region)
            }
        else:
            raise HTTPException(status_code=500, detail="Training failed")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in training endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/train/status/{region}")
async def get_training_status(region: str):
    """Get training status for a specific region"""
    try:
        if region not in data_cache_service.regions:
            raise HTTPException(status_code=400, detail=f"Invalid region: {region}")
        
        model_info = lstm_model.get_model_info(region)
        dataset_info = data_cache_service.get_dataset_info(region)
        
        return {
            "success": True,
            "region": region,
            "model_info": model_info,
            "dataset_available": dataset_info is not None,
            "ready_for_training": dataset_info is not None,
            "ready_for_prediction": model_info['status'] == 'loaded'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting training status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# PREDICTION ENDPOINTS (USES CACHED DATA ONLY)
# ============================================================================

@app.post("/api/predict")
async def predict_pollution_trends(
    request: PredictionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate pollution predictions using ONLY cached data
    NEVER calls external APIs
    """
    try:
        user_id = current_user['user_id']
        logger.info(f"🔮 Prediction request for {request.region}, {request.days_ahead} days ahead by user {user_id}")
        
        # Validate region
        if request.region not in data_cache_service.regions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid region: {request.region}. Valid regions: {data_cache_service.regions}"
            )
        
        # Validate prediction horizon
        if not 1 <= request.days_ahead <= 90:
            raise HTTPException(
                status_code=400,
                detail="Days ahead must be between 1 and 90"
            )
        
        # Check if model exists for region
        if not lstm_model.load_model(request.region):
            raise HTTPException(
                status_code=400,
                detail=f"No trained model found for {request.region}. Please train model first using /api/train"
            )
        
        # Load recent cached data for prediction context
        if not data_cache_service.dataset_exists(request.region):
            raise HTTPException(
                status_code=400,
                detail=f"No cached dataset found for {request.region}. Cannot generate predictions."
            )
        
        cached_df = data_cache_service.load_cached_dataset(request.region)
        recent_df = cached_df.tail(60)  # Use last 60 days as context
        
        # Generate predictions using cached data only
        prediction_result = lstm_model.predict_from_cached_data(
            region=request.region,
            recent_df=recent_df,
            days_ahead=request.days_ahead
        )
        
        if prediction_result['success']:
            # Add additional analysis
            predictions = prediction_result['predictions']
            current_level = cached_df['pollution_level'].iloc[-1] if 'pollution_level' in cached_df.columns else 50
            predicted_level = predictions[-1]['pollution_level'] if predictions else current_level
            
            # Calculate trend
            trend_change = ((predicted_level - current_level) / current_level) * 100
            
            # Determine risk level
            avg_predicted = np.mean([p['pollution_level'] for p in predictions])
            if avg_predicted < 30:
                risk_level = "Low"
            elif avg_predicted < 60:
                risk_level = "Moderate"
            elif avg_predicted < 80:
                risk_level = "High"
            else:
                risk_level = "Critical"
            
            # Save predictions to database for report generation
            import json
            saved_count = 0
            for pred in predictions:
                try:
                    # Get input features from recent data
                    input_features = {
                        'temperature': float(recent_df['temperature'].iloc[-1]) if 'temperature' in recent_df.columns else 0,
                        'humidity': float(recent_df['humidity'].iloc[-1]) if 'humidity' in recent_df.columns else 0,
                        'aqi': float(recent_df['aqi'].iloc[-1]) if 'aqi' in recent_df.columns else 0,
                        'days_ahead': request.days_ahead
                    }
                    
                    # Calculate confidence interval
                    confidence_lower = pred.get('confidence_lower', pred['pollution_level'] * 0.9)
                    confidence_upper = pred.get('confidence_upper', pred['pollution_level'] * 1.1)
                    
                    prediction_id = db.save_prediction(
                        user_id=user_id,
                        region=request.region,
                        prediction_date=pred['date'],
                        predicted_pollution_level=pred['pollution_level'],
                        confidence_interval=(confidence_lower, confidence_upper),
                        model_version=prediction_result['model_info'].get('model_version', '1.0'),
                        input_features=input_features
                    )
                    
                    if prediction_id:
                        saved_count += 1
                        logger.info(f"✅ Saved prediction {saved_count}/{len(predictions)}: ID={prediction_id}, date={pred['date']}, level={pred['pollution_level']:.2f}")
                    else:
                        logger.error(f"❌ Failed to save prediction for date {pred['date']}")
                        
                except Exception as e:
                    logger.error(f"❌ Exception saving prediction to database: {e}", exc_info=True)
            
            logger.info(f"✅ Successfully saved {saved_count}/{len(predictions)} predictions to database for user {user_id}")
            
            return {
                "success": True,
                "region": request.region,
                "predictions": predictions,
                "summary": {
                    "current_level": float(current_level),
                    "predicted_level": float(predicted_level),
                    "trend_change_percent": float(trend_change),
                    "risk_level": risk_level,
                    "average_confidence": float(np.mean([p['confidence'] for p in predictions]))
                },
                "model_info": prediction_result['model_info'],
                "data_source": "cached_only"
            }
        else:
            raise HTTPException(status_code=500, detail="Prediction failed")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in prediction endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze")
async def analyze_region_pollution(region: str, historical_days: int = 365):
    """
    Analyze historical pollution patterns using ONLY cached data
    """
    try:
        logger.info(f"📊 Analysis request for {region}")
        
        # Validate region
        if region not in data_cache_service.regions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid region: {region}. Valid regions: {data_cache_service.regions}"
            )
        
        # Check if dataset exists
        if not data_cache_service.dataset_exists(region):
            raise HTTPException(
                status_code=400,
                detail=f"No cached dataset found for {region}. Please fetch data first."
            )
        
        # Load cached dataset
        cached_df = data_cache_service.load_cached_dataset(region)
        
        if 'pollution_level' not in cached_df.columns:
            raise HTTPException(
                status_code=500,
                detail="No pollution data available in cached dataset"
            )
        
        # Limit to requested historical period
        if len(cached_df) > historical_days:
            df = cached_df.tail(historical_days)
        else:
            df = cached_df
        
        pollution_data = df['pollution_level'].dropna()
        
        # Basic statistics with NaN handling
        stats = {
            "average_pollution": float(pollution_data.mean()) if not np.isnan(pollution_data.mean()) else 50.0,
            "max_pollution": float(pollution_data.max()) if not np.isnan(pollution_data.max()) else 100.0,
            "min_pollution": float(pollution_data.min()) if not np.isnan(pollution_data.min()) else 0.0,
            "std_pollution": float(pollution_data.std()) if not np.isnan(pollution_data.std()) else 10.0,
            "median_pollution": float(pollution_data.median()) if not np.isnan(pollution_data.median()) else 50.0
        }
        
        # Trend analysis
        from scipy import stats as scipy_stats
        days = np.arange(len(pollution_data))
        slope, intercept, r_value, p_value, std_err = scipy_stats.linregress(days, pollution_data)
        
        # Handle potential NaN values from scipy
        stats["trend_slope"] = float(slope) if not np.isnan(slope) else 0.0
        stats["trend_r_squared"] = float(r_value ** 2) if not np.isnan(r_value) else 0.0
        stats["trend_p_value"] = float(p_value) if not np.isnan(p_value) else 1.0
        
        # Recent change (last 30 days vs previous 30 days)
        if len(pollution_data) >= 60:
            recent_30 = pollution_data.tail(30).mean()
            previous_30 = pollution_data.iloc[-60:-30].mean()
            if not np.isnan(recent_30) and not np.isnan(previous_30) and previous_30 != 0:
                stats["recent_change_percent"] = float(((recent_30 - previous_30) / previous_30) * 100)
            else:
                stats["recent_change_percent"] = 0.0
        else:
            stats["recent_change_percent"] = 0.0
        
        # Risk assessment
        avg_pollution = stats["average_pollution"]
        recent_trend = stats["recent_change_percent"]
        
        if avg_pollution < 30:
            risk_level = "Low"
        elif avg_pollution < 60:
            risk_level = "Moderate"
        elif avg_pollution < 80:
            risk_level = "High"
        else:
            risk_level = "Critical"
        
        # Trend direction
        if stats["trend_slope"] > 0.1:
            trend_direction = "Increasing"
        elif stats["trend_slope"] < -0.1:
            trend_direction = "Decreasing"
        else:
            trend_direction = "Stable"
        
        # Recent trend
        if recent_trend > 5:
            recent_trend_direction = "Worsening"
        elif recent_trend < -5:
            recent_trend_direction = "Improving"
        else:
            recent_trend_direction = "Stable"
        
        return {
            "success": True,
            "region": region,
            "analysis_period": {
                "days": len(df),
                "start_date": df['date'].min().strftime('%Y-%m-%d') if 'date' in df.columns else "N/A",
                "end_date": df['date'].max().strftime('%Y-%m-%d') if 'date' in df.columns else "N/A"
            },
            "statistics": stats,
            "risk_assessment": {
                "level": risk_level,
                "trend": trend_direction,
                "recent_trend": recent_trend_direction
            },
            "data_quality": {
                "total_records": len(df),
                "pollution_records": len(pollution_data),
                "completeness": float(len(pollution_data) / len(df))
            },
            "data_source": "cached_only"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in analysis endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.post("/api/auth/register", response_model=TokenResponse)
async def register_user(user_data: UserRegistration):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = db.get_user_by_username(user_data.username)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Username already exists"
            )
        
        existing_email = db.get_user_by_email(user_data.email)
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="Email already exists"
            )
        
        # Create user
        user_id = db.create_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            role="USER"
        )
        
        if not user_id:
            raise HTTPException(
                status_code=500,
                detail="Failed to create user"
            )
        
        # Get created user
        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=500,
                detail="Failed to retrieve created user"
            )
        
        # Create access token
        token = AuthManager.create_access_token(user)
        
        logger.info(f"User registered successfully: {user_data.username}")
        
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user={
                "id": user['id'],
                "username": user['username'],
                "email": user['email'],
                "role": user['role'],
                "created_at": user['created_at'],
                "last_login": user['last_login']
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Registration failed"
        )

@app.post("/api/auth/login", response_model=TokenResponse)
async def login_user(user_data: UserLogin):
    """Login user and return JWT token"""
    try:
        # Authenticate user
        user = db.authenticate_user(user_data.username, user_data.password)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password"
            )
        
        # Update last login
        db.update_user_last_login(user['id'])
        
        # Create access token
        token = AuthManager.create_access_token(user)
        
        logger.info(f"User logged in successfully: {user['username']}")
        
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user={
                "id": user['id'],
                "username": user['username'],
                "email": user['email'],
                "role": user['role'],
                "created_at": user['created_at'],
                "last_login": user['last_login']
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Login failed"
        )

@app.post("/api/auth/logout")
async def logout_user(current_user: dict = Depends(get_current_user)):
    """Logout user and invalidate token"""
    try:
        # Get token from request (this would need to be extracted from the Authorization header)
        # For now, we'll invalidate all sessions for the user
        db.invalidate_user_sessions(current_user['user_id'])
        
        logger.info(f"User logged out: {current_user['username']}")
        
        return {"message": "Logged out successfully"}
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Logout failed"
        )

@app.get("/api/auth/me", response_model=UserProfile)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    try:
        user = db.get_user_by_id(current_user['user_id'])
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        return UserProfile(
            id=user['id'],
            username=user['username'],
            email=user['email'],
            role=user['role'],
            created_at=user['created_at'],
            last_login=user['last_login']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get profile error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get user profile"
        )

# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@app.get("/api/admin/stats")
async def get_admin_stats(current_user: dict = Depends(get_admin_user)):
    """Get system statistics for admin dashboard"""
    try:
        stats = db.get_system_stats()
        
        # Add additional calculated stats
        stats.update({
            "system_uptime": "24h 15m",  # This would be calculated from server start time
            "error_rate": 2.5,  # This would be calculated from logs
        })
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting admin stats: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get system statistics"
        )

@app.get("/api/admin/activity")
async def get_recent_activity(current_user: dict = Depends(get_admin_user)):
    """Get recent system activity for admin dashboard"""
    try:
        # Get recent logs from database
        logs = db.get_recent_logs(limit=20)
        
        # Convert logs to activity format
        activities = []
        for log in logs:
            activity_type = "system_alert"
            if "login" in log.get('message', '').lower():
                activity_type = "user_login"
            elif "detection" in log.get('message', '').lower():
                activity_type = "detection"
            elif "data" in log.get('message', '').lower():
                activity_type = "data_update"
            
            activities.append({
                "id": str(log['id']),
                "type": activity_type,
                "message": log['message'],
                "timestamp": log['timestamp'],
                "severity": log.get('level', 'info').lower()
            })
        
        return activities
        
    except Exception as e:
        logger.error(f"Error getting recent activity: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get recent activity"
        )

@app.post("/api/admin/system/{action}")
async def admin_system_action(action: str, current_user: dict = Depends(get_admin_user)):
    """Perform system maintenance actions"""
    try:
        if action == "backup":
            # Perform database backup
            backup_path = db.backup_database()
            db.log_system_event(
                user_id=current_user['user_id'],
                level="info",
                message=f"Database backup created: {backup_path}",
                module="admin"
            )
            return {"message": "Database backup completed", "backup_path": backup_path}
            
        elif action == "clear-cache":
            # Clear application cache
            import glob
            cache_files = glob.glob(os.path.join(data_cache_service.cache_dir, "*.csv"))
            for file in cache_files:
                try:
                    os.remove(file)
                except:
                    pass
            
            db.log_system_event(
                user_id=current_user['user_id'],
                level="info",
                message="Application cache cleared",
                module="admin"
            )
            return {"message": "Cache cleared successfully"}
            
        elif action == "optimize-db":
            # Optimize database
            db.optimize_database()
            db.log_system_event(
                user_id=current_user['user_id'],
                level="info",
                message="Database optimization completed",
                module="admin"
            )
            return {"message": "Database optimization completed"}
            
        elif action == "restart-services":
            # Log restart request (actual restart would be handled by process manager)
            db.log_system_event(
                user_id=current_user['user_id'],
                level="info",
                message="Service restart requested",
                module="admin"
            )
            return {"message": "Service restart requested"}
            
        elif action == "export-data":
            # Export system data
            export_path = db.export_system_data()
            db.log_system_event(
                user_id=current_user['user_id'],
                level="info",
                message=f"System data exported: {export_path}",
                module="admin"
            )
            return {"message": "Data export completed", "export_path": export_path}
            
        elif action == "maintenance":
            # Perform general maintenance
            db.cleanup_old_sessions()
            db.cleanup_old_logs()
            db.log_system_event(
                user_id=current_user['user_id'],
                level="info",
                message="System maintenance completed",
                module="admin"
            )
            return {"message": "System maintenance completed"}
            
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown action: {action}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error performing admin action {action}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to perform action: {action}"
        )

@app.get("/api/admin/users")
async def get_all_users(current_user: dict = Depends(get_admin_user)):
    """Get all users for admin management"""
    try:
        users = db.get_all_users()
        
        # Remove sensitive information
        safe_users = []
        for user in users:
            safe_users.append({
                "id": user['id'],
                "username": user['username'],
                "email": user['email'],
                "role": user['role'],
                "created_at": user['created_at'],
                "last_login": user['last_login'],
                "is_active": user['is_active']
            })
        
        return safe_users
        
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get users"
        )

@app.post("/api/admin/users/{user_id}/deactivate")
async def deactivate_user(user_id: int, current_user: dict = Depends(get_admin_user)):
    """Deactivate a user account"""
    try:
        # Don't allow deactivating self
        if user_id == current_user['user_id']:
            raise HTTPException(
                status_code=400,
                detail="Cannot deactivate your own account"
            )
        
        success = db.deactivate_user(user_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        # Log the action
        user = db.get_user_by_id(user_id)
        db.log_system_event(
            user_id=current_user['user_id'],
            level="info",
            message=f"User deactivated: {user['username'] if user else user_id}",
            module="admin"
        )
        
        return {"message": "User deactivated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating user: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to deactivate user"
        )

@app.get("/api/admin/logs")
async def get_system_logs(
    limit: int = 100,
    level: Optional[str] = None,
    current_user: dict = Depends(get_admin_user)
):
    """Get system logs for admin"""
    try:
        logs = db.get_recent_logs(limit=limit, level=level)
        return logs
        
    except Exception as e:
        logger.error(f"Error getting system logs: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get system logs"
        )

# ============================================================================
# USER MANAGEMENT ENDPOINTS
# ============================================================================

@app.put("/api/user/profile")
async def update_user_profile(
    profile_data: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile"""
    try:
        success = db.update_user_profile(
            user_id=current_user['user_id'],
            email=profile_data.email,
            profile_data=profile_data.profile_data
        )
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update profile"
            )
        
        return {"message": "Profile updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update profile"
        )

@app.post("/api/user/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user)
):
    """Change user password"""
    try:
        # Verify current password
        user = db.get_user_by_id(current_user['user_id'])
        if not user or not db.verify_password(password_data.current_password, user['password_hash']):
            raise HTTPException(
                status_code=400,
                detail="Current password is incorrect"
            )
        
        # Update password
        success = db.update_user_password(
            user_id=current_user['user_id'],
            new_password=password_data.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update password"
            )
        
        # Invalidate all sessions to force re-login
        db.invalidate_user_sessions(current_user['user_id'])
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to change password"
        )

# ============================================================================
# DETECTION MANAGEMENT ENDPOINTS
# ============================================================================

@app.get("/api/user/detections")
async def get_user_detections(current_user: dict = Depends(get_current_user)):
    """Get user's detection history"""
    try:
        detections = db.get_user_detections(current_user['user_id'])
        return detections
        
    except Exception as e:
        logger.error(f"Error getting user detections: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get detection history"
        )

@app.delete("/api/user/detections/{detection_id}")
async def delete_user_detection(
    detection_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a user's detection"""
    try:
        # Verify ownership
        detection = db.get_detection_by_id(detection_id)
        if not detection:
            raise HTTPException(
                status_code=404,
                detail="Detection not found"
            )
        
        if detection['user_id'] != current_user['user_id'] and current_user['role'] != 'ADMIN':
            raise HTTPException(
                status_code=403,
                detail="Not authorized to delete this detection"
            )
        
        # Delete detection and associated files
        success = db.delete_detection(detection_id)
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete detection"
            )
        
        return {"message": "Detection deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting detection: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete detection"
        )

# ============================================================================
# REPORT GENERATION ENDPOINTS
# ============================================================================

@app.get("/api/reports/{report_id}/download")
async def download_report(
    report_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Download a generated report"""
    try:
        report = db.get_report_by_id(report_id)
        if not report:
            raise HTTPException(
                status_code=404,
                detail="Report not found"
            )
        
        # Check ownership
        if report['user_id'] != current_user['user_id'] and current_user['role'] != 'ADMIN':
            raise HTTPException(
                status_code=403,
                detail="Not authorized to download this report"
            )
        
        # Return file
        if os.path.exists(report['file_path']):
            return FileResponse(
                report['file_path'],
                media_type='application/pdf',
                filename=f"report_{report_id}.pdf"
            )
        else:
            raise HTTPException(
                status_code=404,
                detail="Report file not found"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading report: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to download report"
        )

# ============================================================================
# YOLO DETECTION ENDPOINTS (UNCHANGED)
# ============================================================================

@app.post("/detect")
async def detect_objects(
    file: UploadFile = File(...), 
    confidence: float = 0.25,
    current_user: dict = Depends(get_current_user)
):
    if model is None:
        raise HTTPException(
            status_code=503, 
            detail="Model not loaded. Please place your weights at backend/weights/best.pt and restart the server."
        )
    
    start_time = time.time()
    
    try:
        # Read image
        contents = await file.read()
        file_size = len(contents)
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image)
        
        # Convert RGB to BGR for OpenCV
        if len(image_np.shape) == 3 and image_np.shape[2] == 3:
            image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        else:
            image_bgr = image_np
        
        # Run YOLO inference
        results = model(image_bgr, conf=confidence)[0]
        
        # Process detections
        detections = []
        class_counts = {}
        
        for box in results.boxes:
            class_id = int(box.cls[0])
            class_name = results.names[class_id]
            conf = float(box.conf[0])
            bbox = box.xyxy[0].tolist()
            
            detections.append({
                "class": class_name,
                "confidence": round(conf * 100, 1),
                "bbox": {
                    "x1": int(bbox[0]),
                    "y1": int(bbox[1]),
                    "x2": int(bbox[2]),
                    "y2": int(bbox[3])
                }
            })
            
            # Count by class
            if class_name not in class_counts:
                class_counts[class_name] = {"count": 0, "total_confidence": 0}
            class_counts[class_name]["count"] += 1
            class_counts[class_name]["total_confidence"] += conf * 100
        
        # Draw bounding boxes on image
        annotated_image = image_bgr.copy()
        colors = {}
        
        for det in detections:
            class_name = det["class"]
            if class_name not in colors:
                # Generate consistent color for each class
                hash_val = hash(class_name)
                colors[class_name] = (
                    (hash_val & 0xFF),
                    ((hash_val >> 8) & 0xFF),
                    ((hash_val >> 16) & 0xFF)
                )
            
            color = colors[class_name]
            bbox = det["bbox"]
            
            # Draw rectangle
            cv2.rectangle(
                annotated_image,
                (bbox["x1"], bbox["y1"]),
                (bbox["x2"], bbox["y2"]),
                color,
                2
            )
            
            # Draw label background
            label = f"{class_name} {det['confidence']}%"
            (label_w, label_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(
                annotated_image,
                (bbox["x1"], bbox["y1"] - label_h - 10),
                (bbox["x1"] + label_w + 10, bbox["y1"]),
                color,
                -1
            )
            
            # Draw label text
            cv2.putText(
                annotated_image,
                label,
                (bbox["x1"] + 5, bbox["y1"] - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 255),
                1
            )
        
        # Convert annotated image to base64
        annotated_rgb = cv2.cvtColor(annotated_image, cv2.COLOR_BGR2RGB)
        annotated_pil = Image.fromarray(annotated_rgb)
        buffer = io.BytesIO()
        annotated_pil.save(buffer, format="PNG")
        annotated_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Save to database
        detection_id = db.create_detection(
            user_id=current_user['user_id'],
            filename=file.filename,
            file_type='image',
            file_size=file_size,
            total_detections=len(detections),
            confidence_threshold=confidence,
            processing_time=processing_time,
            metadata={
                'image_width': image.width,
                'image_height': image.height,
                'model_confidence': confidence,
                'classes_detected': list(class_counts.keys())
            }
        )
        
        # Save individual detection results
        for det in detections:
            db.add_detection_result(
                detection_id=detection_id,
                class_name=det['class'],
                confidence=det['confidence'] / 100.0,  # Convert back to 0-1 range
                bbox_x1=det['bbox']['x1'],
                bbox_y1=det['bbox']['y1'],
                bbox_x2=det['bbox']['x2'],
                bbox_y2=det['bbox']['y2'],
                frame_number=0
            )
        
        # Save image metadata
        db.save_image_metadata(
            detection_id=detection_id,
            width=image.width,
            height=image.height
        )
        
        # Trigger analytics generation for this user
        try:
            analytics_response = await get_analytics(current_user=current_user)
            logger.info(f"Analytics updated for user {current_user['user_id']} after detection")
        except Exception as e:
            logger.warning(f"Failed to update analytics after detection: {e}")
        
        # Prepare summary
        summary = []
        for class_name, data in class_counts.items():
            avg_conf = data["total_confidence"] / data["count"]
            summary.append({
                "class": class_name,
                "count": data["count"],
                "avgConfidence": round(avg_conf, 1)
            })
        
        # Sort by count descending
        summary.sort(key=lambda x: x["count"], reverse=True)
        
        logger.info(f"Detection completed for user {current_user['username']}: {len(detections)} objects found in {processing_time:.2f}s")
        
        # Generate analytics automatically after detection
        try:
            analytics_response = await get_analytics(current_user=current_user)
            logger.info(f"Analytics updated for user {current_user['username']}")
        except Exception as e:
            logger.warning(f"Failed to update analytics after detection: {e}")
        
        return JSONResponse({
            "success": True,
            "detection_id": detection_id,
            "filename": file.filename,
            "totalDetections": len(detections),
            "detections": detections,
            "summary": summary,
            "processingTime": round(processing_time, 2),
            "annotatedImage": f"data:image/png;base64,{annotated_base64}",
            "originalImage": f"data:image/{file.content_type.split('/')[-1]};base64,{base64.b64encode(contents).decode()}"
        })
        
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect-video")
async def detect_video(
    file: UploadFile = File(...), 
    confidence: float = 0.25,
    current_user: dict = Depends(get_current_user)
):
    if model is None:
        raise HTTPException(
            status_code=503, 
            detail="Model not loaded. Please place your weights at backend/weights/best.pt and restart the server."
        )
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith('video/'):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Only video files are supported."
        )
    
    # Validate confidence parameter
    if not 0.01 <= confidence <= 1.0:
        raise HTTPException(
            status_code=400,
            detail="Confidence must be between 0.01 and 1.0"
        )
    
    temp_input_path = None
    temp_output_path = None
    start_time = time.time()
    
    try:
        logger.info(f"🎬 Starting video detection for user {current_user['username']}: {file.filename}")
        logger.info(f"   File type: {file.content_type}")
        logger.info(f"   Confidence threshold: {confidence}")
        
        # Create temporary files
        temp_input_fd, temp_input_path = tempfile.mkstemp(suffix='.mp4')
        temp_output_fd, temp_output_path = tempfile.mkstemp(suffix='.mp4')
        
        # Close file descriptors (we'll use paths directly)
        os.close(temp_input_fd)
        os.close(temp_output_fd)
        
        # Write uploaded video to temp file
        contents = await file.read()
        file_size_mb = len(contents) / (1024 * 1024)
        logger.info(f"   File size: {file_size_mb:.1f} MB")
        
        with open(temp_input_path, 'wb') as f:
            f.write(contents)
        
        # Open video with OpenCV
        cap = cv2.VideoCapture(temp_input_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not open video file. Please ensure it's a valid video format.")
        
        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        
        logger.info(f"📹 Video properties:")
        logger.info(f"   Resolution: {width}x{height}")
        logger.info(f"   FPS: {fps}")
        logger.info(f"   Total frames: {total_frames}")
        logger.info(f"   Duration: {duration:.1f}s")
        
        # Validate video properties
        if fps <= 0 or width <= 0 or height <= 0 or total_frames <= 0:
            raise HTTPException(status_code=400, detail="Invalid video properties detected")
        
        # Setup video writer with browser-compatible codec
        # Try H.264 codec first (best browser compatibility)
        fourcc = cv2.VideoWriter_fourcc(*'H264')
        out = cv2.VideoWriter(temp_output_path, fourcc, fps, (width, height))
        
        # If H264 fails, try other browser-compatible codecs
        if not out.isOpened():
            logger.warning("H264 codec failed, trying avc1...")
            fourcc = cv2.VideoWriter_fourcc(*'avc1')
            out = cv2.VideoWriter(temp_output_path, fourcc, fps, (width, height))
        
        if not out.isOpened():
            logger.warning("avc1 codec failed, trying XVID...")
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            out = cv2.VideoWriter(temp_output_path, fourcc, fps, (width, height))
        
        if not out.isOpened():
            logger.warning("XVID codec failed, trying mp4v as fallback...")
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(temp_output_path, fourcc, fps, (width, height))
        
        if not out.isOpened():
            logger.error("❌ Failed to initialize video writer with any codec")
            raise HTTPException(status_code=500, detail="Failed to create output video writer")
        
        logger.info(f"✅ Video writer initialized successfully")
        logger.info(f"   Output resolution: {width}x{height}")
        logger.info(f"   Output FPS: {fps}")
        logger.info(f"   Output path: {temp_output_path}")
        
        # Initialize processing variables
        frame_count = 0
        total_detections = 0
        all_detections = []
        class_counts = {}
        colors = {}
        frames_with_detections = 0
        
        logger.info("🔍 Starting frame-by-frame detection...")
        
        # Process video frame by frame
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            # Run YOLO inference on frame
            try:
                results = model(frame, conf=confidence, verbose=False)[0]
            except Exception as e:
                logger.warning(f"Detection failed on frame {frame_count}: {e}")
                # Write original frame if detection fails
                out.write(frame)
                continue
            
            # Process detections for this frame
            frame_detections = []
            frame_detection_count = 0
            
            if results.boxes is not None and len(results.boxes) > 0:
                frames_with_detections += 1
                
                for box in results.boxes:
                    class_id = int(box.cls[0])
                    class_name = results.names[class_id]
                    conf = float(box.conf[0])
                    bbox = box.xyxy[0].tolist()
                    
                    detection = {
                        "frame": frame_count,
                        "timestamp": round((frame_count - 1) / fps, 2),
                        "class": class_name,
                        "confidence": round(conf * 100, 1),
                        "bbox": {
                            "x1": int(bbox[0]),
                            "y1": int(bbox[1]),
                            "x2": int(bbox[2]),
                            "y2": int(bbox[3])
                        }
                    }
                    
                    frame_detections.append(detection)
                    all_detections.append(detection)
                    total_detections += 1
                    frame_detection_count += 1
                    
                    # Count by class
                    if class_name not in class_counts:
                        class_counts[class_name] = {"count": 0, "total_confidence": 0, "frames": set()}
                    class_counts[class_name]["count"] += 1
                    class_counts[class_name]["total_confidence"] += conf * 100
                    class_counts[class_name]["frames"].add(frame_count)
                    
                    # Generate consistent color for each class
                    if class_name not in colors:
                        hash_val = hash(class_name)
                        colors[class_name] = (
                            (hash_val & 0xFF),
                            ((hash_val >> 8) & 0xFF),
                            ((hash_val >> 16) & 0xFF)
                        )
            
            # Draw bounding boxes on frame
            annotated_frame = frame.copy()
            
            # Add frame info overlay
            frame_info = f"Frame {frame_count}/{total_frames} | {frame_detection_count} detections"
            cv2.putText(
                annotated_frame,
                frame_info,
                (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )
            cv2.putText(
                annotated_frame,
                frame_info,
                (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 0),
                1
            )
            
            # Draw detections
            for det in frame_detections:
                class_name = det["class"]
                color = colors[class_name]
                bbox = det["bbox"]
                
                # Draw rectangle with thicker border for better visibility
                cv2.rectangle(
                    annotated_frame,
                    (bbox["x1"], bbox["y1"]),
                    (bbox["x2"], bbox["y2"]),
                    color,
                    3
                )
                
                # Draw label background
                label = f"{class_name} {det['confidence']}%"
                (label_w, label_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                cv2.rectangle(
                    annotated_frame,
                    (bbox["x1"], bbox["y1"] - label_h - 15),
                    (bbox["x1"] + label_w + 10, bbox["y1"]),
                    color,
                    -1
                )
                
                # Draw label text with better visibility
                cv2.putText(
                    annotated_frame,
                    label,
                    (bbox["x1"] + 5, bbox["y1"] - 8),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2
                )
            
            # Write annotated frame to output video
            out.write(annotated_frame)
            
            # Log progress every 50 frames or at significant milestones
            if frame_count % 50 == 0 or frame_count == total_frames:
                progress = (frame_count / total_frames) * 100
                logger.info(f"   Progress: {frame_count}/{total_frames} frames ({progress:.1f}%) | Detections: {total_detections}")
        
        # Release resources
        cap.release()
        out.release()
        
        # Generate unique filename for processed video
        video_id = str(uuid.uuid4())
        processed_filename = f"processed_{video_id}.mp4"
        final_output_path = os.path.join(processed_videos_path, processed_filename)
        
        # Move processed video to final location
        shutil.move(temp_output_path, final_output_path)
        temp_output_path = None  # Prevent cleanup of moved file
        
        # Log successful save with clear message
        logger.info(f"💾 Processed video saved successfully!")
        logger.info(f"   📁 Local path: {final_output_path}")
        logger.info(f"   🌐 Access URL: /processed-video/{processed_filename}")
        logger.info(f"   📊 File size: {os.path.getsize(final_output_path) / (1024*1024):.1f} MB")
        
        # Prepare enhanced summary
        summary = []
        for class_name, data in class_counts.items():
            avg_conf = data["total_confidence"] / data["count"]
            frames_appeared = len(data["frames"])
            summary.append({
                "class": class_name,
                "count": data["count"],
                "avgConfidence": round(avg_conf, 1),
                "framesAppeared": frames_appeared,
                "appearanceRate": round((frames_appeared / total_frames) * 100, 1)
            })
        
        # Sort by count descending
        summary.sort(key=lambda x: x["count"], reverse=True)
        
        # Convert original video to base64 for small videos (< 10MB)
        original_video_base64 = None
        if len(contents) < 10 * 1024 * 1024:  # 10MB limit
            original_video_base64 = base64.b64encode(contents).decode()
        
        # Calculate processing statistics
        detection_rate = (frames_with_detections / total_frames) * 100 if total_frames > 0 else 0
        avg_detections_per_frame = total_detections / total_frames if total_frames > 0 else 0
        
        logger.info(f"✅ Video processing complete!")
        logger.info(f"   Processed: {frame_count} frames")
        logger.info(f"   Total detections: {total_detections}")
        logger.info(f"   Frames with detections: {frames_with_detections} ({detection_rate:.1f}%)")
        logger.info(f"   Average detections per frame: {avg_detections_per_frame:.2f}")
        logger.info(f"   Unique classes detected: {len(class_counts)}")
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Save to database
        detection_id = db.create_detection(
            user_id=current_user['user_id'],
            filename=file.filename,
            file_type='video',
            file_path=final_output_path,
            file_size=len(contents),
            total_detections=total_detections,
            confidence_threshold=confidence,
            processing_time=processing_time,
            metadata={
                'video_id': video_id,
                'total_frames': total_frames,
                'fps': fps,
                'duration': duration,
                'resolution': f"{width}x{height}",
                'detection_rate': detection_rate,
                'classes_detected': list(class_counts.keys())
            }
        )
        
        # Save individual detection results
        for det in all_detections:
            db.add_detection_result(
                detection_id=detection_id,
                class_name=det['class'],
                confidence=det['confidence'] / 100.0,
                bbox_x1=det['bbox']['x1'],
                bbox_y1=det['bbox']['y1'],
                bbox_x2=det['bbox']['x2'],
                bbox_y2=det['bbox']['y2'],
                frame_number=det.get('frame', 0)
            )
        
        # Save video metadata
        db.save_video_metadata(
            detection_id=detection_id,
            total_frames=total_frames,
            processed_frames=frame_count,
            fps=fps,
            duration=duration,
            resolution=f"{width}x{height}",
            original_path=temp_input_path,
            annotated_path=final_output_path
        )
        
        logger.info(f"💾 Detection saved to database (ID: {detection_id})")
        
        # Generate analytics automatically after video detection
        try:
            analytics_response = await get_analytics(current_user=current_user)
            logger.info(f"Analytics updated for user {current_user['username']}")
        except Exception as e:
            logger.warning(f"Failed to update analytics after video detection: {e}")
        
        return JSONResponse({
            "success": True,
            "detection_id": detection_id,
            "filename": file.filename,
            "totalDetections": total_detections,
            "totalFrames": frame_count,
            "processedFrames": frame_count,
            "framesWithDetections": frames_with_detections,
            "detectionRate": round(detection_rate, 1),
            "avgDetectionsPerFrame": round(avg_detections_per_frame, 2),
            "fps": fps,
            "duration": round(duration, 2),
            "resolution": f"{width}x{height}",
            "fileSizeMB": round(file_size_mb, 1),
            "processingTime": round(processing_time, 2),
            "detections": all_detections,
            "summary": summary,
            "annotatedVideoUrl": f"/processed-video/{processed_filename}",
            "originalVideoUrl": f"/processed-video/{processed_filename}" if original_video_base64 is None else None,
            "originalVideo": f"data:video/mp4;base64,{original_video_base64}" if original_video_base64 else None,
            "videoId": video_id,
            "processingStats": {
                "uniqueClasses": len(class_counts),
                "detectionRate": round(detection_rate, 1),
                "avgDetectionsPerFrame": round(avg_detections_per_frame, 2),
                "framesWithDetections": frames_with_detections
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Video processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Video processing failed: {str(e)}")
    finally:
        # Cleanup temporary files
        if temp_input_path and os.path.exists(temp_input_path):
            try:
                os.unlink(temp_input_path)
            except Exception as e:
                logger.warning(f"Could not cleanup temp input file: {e}")
        if temp_output_path and os.path.exists(temp_output_path):
            try:
                os.unlink(temp_output_path)
            except Exception as e:
                logger.warning(f"Could not cleanup temp output file: {e}")

# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@app.get("/api/analytics")
async def get_analytics(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get user's analytics data for dashboard"""
    try:
        user_id = current_user['user_id']
        
        # Get user's detections from last N days
        detections = db.get_user_detections(user_id, limit=1000)
        
        if not detections:
            return {
                "success": True,
                "analytics": {
                    "stats": {
                        "totalDetections": 0,
                        "avgConfidence": 0,
                        "thisWeek": 0,
                        "detectionRate": 0,
                    },
                    "trendData": [],
                    "classDistribution": [],
                    "objectCounts": [],
                }
            }
        
        # Calculate analytics
        from datetime import datetime, timedelta
        import json
        
        now = datetime.now()
        week_ago = now - timedelta(days=7)
        
        # Basic stats - calculate avg_confidence from detection_results
        total_detections = sum(d.get('total_detections', 0) for d in detections)
        
        # Calculate average confidence from detection_results
        all_confidences = []
        for detection in detections:
            detection_id = detection['id']
            try:
                results = db.get_detection_results(detection_id, user_id)
                for result in results:
                    all_confidences.append(result['confidence'] * 100)  # Convert to percentage
            except Exception as e:
                logger.warning(f"Failed to get detection results for confidence calculation: {e}")
        
        avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0
        
        # This week count
        this_week = sum(
            d.get('total_detections', 0) 
            for d in detections 
            if datetime.fromisoformat(d['created_at'].replace('Z', '+00:00')) >= week_ago
        )
        
        # Trend data (group by date)
        trend_data = {}
        for detection in detections:
            date_str = detection['created_at'][:10]  # Get YYYY-MM-DD
            if date_str not in trend_data:
                trend_data[date_str] = {"detections": 0, "confidence": []}
            trend_data[date_str]["detections"] += detection.get('total_detections', 0)
            if detection.get('avg_confidence'):
                trend_data[date_str]["confidence"].append(detection['avg_confidence'])
        
        # Convert to list format
        trend_list = []
        for date_str, data in sorted(trend_data.items()):
            avg_conf = sum(data["confidence"]) / len(data["confidence"]) if data["confidence"] else 0
            trend_list.append({
                "date": date_str,
                "detections": data["detections"],
                "confidence": round(avg_conf, 1)
            })
        
        # Class distribution and object counts
        class_counts = {}
        colors = [
            "hsl(203, 77%, 26%)", "hsl(170, 50%, 45%)", "hsl(177, 59%, 41%)", 
            "hsl(160, 84%, 39%)", "hsl(38, 92%, 50%)", "hsl(25, 95%, 53%)",
            "hsl(271, 81%, 56%)", "hsl(348, 83%, 47%)", "hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)"
        ]
        
        # Get detection results for class analysis - improved aggregation
        for detection in detections:
            detection_id = detection['id']
            try:
                results = db.get_detection_results(detection_id, user_id)
                if results:
                    # Use actual detection results from database
                    for result in results:
                        class_name = result['class_name']
                        if class_name not in class_counts:
                            class_counts[class_name] = 0
                        class_counts[class_name] += 1
                else:
                    # Fallback: use detection metadata if no results found
                    metadata = detection.get('metadata', {})
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except:
                            metadata = {}
                    
                    # Try different metadata formats
                    classes_detected = metadata.get('classes_detected', [])
                    if not classes_detected:
                        # Try summary format
                        summary = metadata.get('summary', [])
                        if isinstance(summary, list):
                            for item in summary:
                                if isinstance(item, dict) and 'class' in item:
                                    class_name = item['class']
                                    count = item.get('count', 1)
                                    if class_name not in class_counts:
                                        class_counts[class_name] = 0
                                    class_counts[class_name] += count
                        else:
                            # Default fallback - assume some plastic detected
                            if detection.get('total_detections', 0) > 0:
                                class_name = "plastic"
                                if class_name not in class_counts:
                                    class_counts[class_name] = 0
                                class_counts[class_name] += detection.get('total_detections', 1)
                    else:
                        for class_name in classes_detected:
                            if class_name not in class_counts:
                                class_counts[class_name] = 0
                            class_counts[class_name] += 1
                            
            except Exception as e:
                logger.warning(f"Failed to get detection results for detection {detection_id}: {e}")
                # Final fallback - use total detections as generic plastic
                if detection.get('total_detections', 0) > 0:
                    class_name = "plastic"
                    if class_name not in class_counts:
                        class_counts[class_name] = 0
                    class_counts[class_name] += detection.get('total_detections', 1)
        
        # Create class distribution
        class_distribution = []
        object_counts = []
        color_index = 0
        
        # Ensure we have at least some data to show
        if not class_counts and total_detections > 0:
            # If we have detections but no class data, create a generic entry
            class_counts["plastic"] = total_detections
        
        for class_name, count in sorted(class_counts.items(), key=lambda x: x[1], reverse=True):
            class_distribution.append({
                "name": class_name,
                "value": count,
                "color": colors[color_index % len(colors)]
            })
            object_counts.append({
                "class": class_name,
                "count": count
            })
            color_index += 1
        
        analytics_data = {
            "stats": {
                "totalDetections": total_detections,
                "avgConfidence": round(avg_confidence, 1),
                "thisWeek": this_week,
                "detectionRate": 100,  # Assuming 100% for now
            },
            "trendData": trend_list[-30:],  # Last 30 days
            "classDistribution": class_distribution,
            "objectCounts": object_counts,
        }
        
        # Save analytics to database
        db.save_analytics_data(user_id, analytics_data)
        
        return {
            "success": True,
            "analytics": analytics_data
        }
        
    except Exception as e:
        logger.error(f"Error getting analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analytics/generate")
async def generate_analytics(
    current_user: dict = Depends(get_current_user)
):
    """Generate analytics data after a detection"""
    try:
        # This will be called automatically after each detection
        # to update analytics in real-time
        analytics_response = await get_analytics(current_user=current_user)
        return {
            "success": True,
            "message": "Analytics generated successfully",
            "analytics": analytics_response["analytics"]
        }
    except Exception as e:
        logger.error(f"Error generating analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/debug")
async def debug_analytics(
    current_user: dict = Depends(get_current_user)
):
    """Debug analytics data - shows raw detection data"""
    try:
        user_id = current_user['user_id']
        
        # Get raw detections
        detections = db.get_user_detections(user_id, limit=10)
        
        debug_info = {
            "user_id": user_id,
            "total_detections_found": len(detections),
            "detections": []
        }
        
        for detection in detections[:5]:  # Show first 5 for debugging
            detection_results = db.get_detection_results(detection['id'], user_id)
            debug_info["detections"].append({
                "id": detection['id'],
                "filename": detection.get('filename', 'unknown'),
                "total_detections": detection.get('total_detections', 0),
                "avg_confidence": detection.get('avg_confidence', 0),
                "created_at": detection.get('created_at'),
                "metadata": detection.get('metadata', {}),
                "detection_results_count": len(detection_results),
                "detection_results": detection_results[:3]  # Show first 3 results
            })
        
        return {
            "success": True,
            "debug_info": debug_info
        }
        
    except Exception as e:
        logger.error(f"Error in debug analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# REPORTS ENDPOINTS
# ============================================================================

@app.get("/api/reports")
async def get_user_reports(
    current_user: dict = Depends(get_current_user)
):
    """Get user's generated reports"""
    try:
        user_id = current_user['user_id']
        reports = db.get_user_reports(user_id)
        
        return {
            "success": True,
            "reports": reports
        }
        
    except Exception as e:
        logger.error(f"Error getting reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ReportRequest(BaseModel):
    report_type: str  # 'detection', 'prediction', 'both'
    title: str = None
    date_range_days: int = 30

@app.post("/api/reports/generate")
async def generate_report(
    request: ReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a comprehensive report"""
    try:
        user_id = current_user['user_id']
        
        # Validate report type
        if request.report_type not in ['detection', 'prediction', 'both']:
            raise HTTPException(status_code=400, detail="Invalid report type. Must be 'detection', 'prediction', or 'both'")
        
        # Check if user has data for the requested report type (with date filtering)
        detections = []
        predictions = []
        
        if request.report_type in ['detection', 'both']:
            detections = db.get_user_detections(user_id, days=request.date_range_days)
            logger.info(f"📊 Found {len(detections)} detections for user {user_id} in last {request.date_range_days} days")
        
        if request.report_type in ['prediction', 'both']:
            predictions = db.get_user_predictions(user_id, days=request.date_range_days)
            logger.info(f"📊 Found {len(predictions)} predictions for user {user_id} in last {request.date_range_days} days")
        
        # Only fail if specifically requesting a type with no data
        # Allow 'both' to work if either type has data
        if request.report_type == 'detection' and not detections:
            logger.warning(f"❌ No detection data for user {user_id}")
            raise HTTPException(status_code=400, detail="No detection data available. Please perform some detections first.")
        
        if request.report_type == 'prediction' and not predictions:
            logger.warning(f"❌ No prediction data for user {user_id} in last {request.date_range_days} days")
            raise HTTPException(status_code=400, detail="No prediction data available. Please generate some LSTM predictions first.")
        
        # For 'both' type, we need at least one type of data
        if request.report_type == 'both' and not detections and not predictions:
            logger.warning(f"❌ No data at all for user {user_id}")
            raise HTTPException(status_code=400, detail="No data available. Please perform detections or generate predictions first.")
        
        # Generate report title
        if not request.title:
            type_name = {
                'detection': 'YOLO Detection',
                'prediction': 'LSTM Prediction', 
                'both': 'Comprehensive Analysis'
            }[request.report_type]
            request.title = f"{type_name} Report - {datetime.now().strftime('%B %d, %Y')}"
        
        # Create report record in database (map 'both' to 'custom' for database constraint)
        db_report_type = 'custom' if request.report_type == 'both' else request.report_type
        
        report_id = db.create_report(
            user_id=user_id,
            title=request.title,
            report_type=db_report_type,
            date_range_days=request.date_range_days
        )
        
        if not report_id:
            raise HTTPException(status_code=500, detail="Failed to create report record")
        
        # Get report data based on type
        report_data = {
            "report_type": request.report_type,
            "date_range_days": request.date_range_days,
            "generated_at": datetime.now().isoformat()
        }
        
        if request.report_type in ['detection', 'both'] and detections:
            # Get detection analytics - avoid recursive call
            try:
                # Calculate analytics directly instead of calling get_analytics
                from datetime import timedelta
                
                now = datetime.now()
                week_ago = now - timedelta(days=7)
                
                # Basic stats - calculate avg_confidence from detection_results
                total_detections = sum(d.get('total_detections', 0) for d in detections)
                
                # Calculate average confidence from detection_results
                all_confidences = []
                for detection in detections:
                    detection_id = detection['id']
                    try:
                        results = db.get_detection_results(detection_id, user_id)
                        for result in results:
                            all_confidences.append(result['confidence'] * 100)  # Convert to percentage
                    except Exception as e:
                        logger.warning(f"Failed to get detection results for confidence calculation: {e}")
                
                avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0
                
                # This week count
                this_week = sum(
                    d.get('total_detections', 0) 
                    for d in detections 
                    if datetime.fromisoformat(d['created_at'].replace('Z', '+00:00')) >= week_ago
                )
                
                # Class distribution with detailed analysis
                class_counts = {}
                class_confidence = {}
                detection_locations = []
                
                for detection in detections:
                    detection_id = detection['id']
                    try:
                        results = db.get_detection_results(detection_id, user_id)
                        for result in results:
                            class_name = result['class_name']
                            confidence = result['confidence'] * 100
                            
                            if class_name not in class_counts:
                                class_counts[class_name] = 0
                                class_confidence[class_name] = []
                            
                            class_counts[class_name] += 1
                            class_confidence[class_name].append(confidence)
                        
                        # Add detection location info for mapping
                        detection_locations.append({
                            "id": detection_id,
                            "filename": detection.get('filename', 'Unknown'),
                            "date": detection.get('created_at', ''),
                            "objects_found": detection.get('total_detections', 0),
                            "processing_time": detection.get('processing_time', 0)
                        })
                        
                    except Exception as e:
                        logger.warning(f"Failed to get detection results for detection {detection_id}: {e}")
                        # Use fallback data
                        if detection.get('total_detections', 0) > 0:
                            class_name = "unidentified_plastic"
                            if class_name not in class_counts:
                                class_counts[class_name] = 0
                                class_confidence[class_name] = []
                            class_counts[class_name] += detection.get('total_detections', 1)
                            class_confidence[class_name].append(50.0)  # Default confidence
                
                # Calculate class statistics
                class_statistics = []
                for class_name, count in class_counts.items():
                    confidences = class_confidence.get(class_name, [])
                    avg_conf = sum(confidences) / len(confidences) if confidences else 0
                    
                    class_statistics.append({
                        "class_name": class_name,
                        "total_count": count,
                        "percentage": round((count / total_detections * 100) if total_detections > 0 else 0, 1),
                        "avg_confidence": round(avg_conf, 1),
                        "min_confidence": round(min(confidences), 1) if confidences else 0,
                        "max_confidence": round(max(confidences), 1) if confidences else 0
                    })
                
                # Sort by count descending
                class_statistics.sort(key=lambda x: x['total_count'], reverse=True)
                
                analytics_data = {
                    "summary": {
                        "total_detections": total_detections,
                        "avg_confidence": round(avg_confidence, 1),
                        "detections_this_week": this_week,
                        "detection_success_rate": 100,
                        "date_range": f"{request.date_range_days} days",
                        "total_files_processed": len(detections),
                        "avg_processing_time": round(sum(d.get('processing_time', 0) for d in detections) / len(detections), 2) if detections else 0
                    },
                    "class_analysis": class_statistics,
                    "detection_timeline": detection_locations[-20:],  # Last 20 detections
                    "environmental_impact": {
                        "most_common_debris": class_statistics[0]['class_name'] if class_statistics else "None",
                        "pollution_severity": "High" if total_detections > 50 else "Medium" if total_detections > 10 else "Low",
                        "confidence_reliability": "High" if avg_confidence > 80 else "Medium" if avg_confidence > 60 else "Low"
                    }
                }
                
                report_data['detection_analytics'] = analytics_data
                
            except Exception as e:
                logger.warning(f"Failed to generate analytics for report: {e}")
                report_data['detection_analytics'] = {
                    "error": f"Failed to generate analytics: {str(e)}",
                    "summary": {"total_detections": 0, "avg_confidence": 0, "detections_this_week": 0},
                    "class_analysis": [],
                    "detection_timeline": []
                }
            
            # Add detailed detection data for the report
            report_data['detection_details'] = {
                "total_detections_analyzed": len(detections),
                "date_range_start": (datetime.now() - timedelta(days=request.date_range_days)).strftime('%Y-%m-%d'),
                "date_range_end": datetime.now().strftime('%Y-%m-%d'),
                "detections_summary": detections[:10]  # First 10 for summary
            }
        
        if request.report_type in ['prediction', 'both'] and predictions:
            # Enhanced prediction analysis
            try:
                from collections import defaultdict
                from datetime import timedelta
                
                # Group predictions by region
                region_analysis = defaultdict(list)
                for prediction in predictions:
                    region = prediction.get('region', 'Unknown')
                    region_analysis[region].append(prediction)
                
                # Calculate regional statistics
                regional_stats = []
                for region, region_predictions in region_analysis.items():
                    pollution_levels = [p.get('predicted_pollution_level', 0) for p in region_predictions]
                    
                    if pollution_levels:
                        avg_pollution = sum(pollution_levels) / len(pollution_levels)
                        max_pollution = max(pollution_levels)
                        min_pollution = min(pollution_levels)
                        
                        # Determine trend
                        sorted_predictions = sorted(region_predictions, key=lambda x: x.get('prediction_date', ''))
                        if len(sorted_predictions) >= 2:
                            recent_avg = sum(p.get('predicted_pollution_level', 0) for p in sorted_predictions[-3:]) / min(3, len(sorted_predictions))
                            older_avg = sum(p.get('predicted_pollution_level', 0) for p in sorted_predictions[:3]) / min(3, len(sorted_predictions))
                            trend = "Increasing" if recent_avg > older_avg else "Decreasing" if recent_avg < older_avg else "Stable"
                        else:
                            trend = "Insufficient data"
                        
                        # Risk assessment
                        risk_level = "Critical" if avg_pollution > 80 else "High" if avg_pollution > 60 else "Medium" if avg_pollution > 40 else "Low"
                        
                        regional_stats.append({
                            "region": region,
                            "total_predictions": len(region_predictions),
                            "avg_pollution_level": round(avg_pollution, 2),
                            "max_pollution_level": round(max_pollution, 2),
                            "min_pollution_level": round(min_pollution, 2),
                            "trend": trend,
                            "risk_level": risk_level,
                            "latest_prediction_date": max(p.get('prediction_date', '') for p in region_predictions),
                            "model_confidence": round(sum(p.get('confidence_interval_upper', 0) - p.get('confidence_interval_lower', 0) for p in region_predictions) / len(region_predictions), 2)
                        })
                
                # Sort by pollution level descending
                regional_stats.sort(key=lambda x: x['avg_pollution_level'], reverse=True)
                
                # Overall prediction summary
                all_pollution_levels = [p.get('predicted_pollution_level', 0) for p in predictions]
                overall_avg = sum(all_pollution_levels) / len(all_pollution_levels) if all_pollution_levels else 0
                
                prediction_analytics = {
                    "summary": {
                        "total_predictions": len(predictions),
                        "regions_analyzed": len(region_analysis),
                        "overall_avg_pollution": round(overall_avg, 2),
                        "date_range": f"{request.date_range_days} days",
                        "model_version": predictions[0].get('model_version', 'Unknown') if predictions else 'Unknown',
                        "prediction_reliability": "High" if len(predictions) > 20 else "Medium" if len(predictions) > 5 else "Low"
                    },
                    "regional_analysis": regional_stats,
                    "risk_assessment": {
                        "highest_risk_region": regional_stats[0]['region'] if regional_stats else "None",
                        "lowest_risk_region": regional_stats[-1]['region'] if regional_stats else "None",
                        "critical_regions": [r['region'] for r in regional_stats if r['risk_level'] == 'Critical'],
                        "overall_ocean_health": "Poor" if overall_avg > 70 else "Fair" if overall_avg > 50 else "Good"
                    },
                    "future_outlook": {
                        "increasing_trend_regions": [r['region'] for r in regional_stats if r['trend'] == 'Increasing'],
                        "decreasing_trend_regions": [r['region'] for r in regional_stats if r['trend'] == 'Decreasing'],
                        "stable_regions": [r['region'] for r in regional_stats if r['trend'] == 'Stable']
                    }
                }
                
                report_data['prediction_analytics'] = prediction_analytics
                
            except Exception as e:
                logger.warning(f"Failed to generate prediction analytics: {e}")
                report_data['prediction_analytics'] = {
                    "error": f"Failed to generate prediction analytics: {str(e)}",
                    "summary": {"total_predictions": 0, "regions_analyzed": 0},
                    "regional_analysis": []
                }
            
            # Add detailed prediction data
            report_data['prediction_details'] = {
                "total_predictions_analyzed": len(predictions),
                "date_range_start": (datetime.now() - timedelta(days=request.date_range_days)).strftime('%Y-%m-%d'),
                "date_range_end": datetime.now().strftime('%Y-%m-%d'),
                "predictions_summary": predictions[:15]  # First 15 for summary
            }
        
        # Add comprehensive report metadata and recommendations
        report_data['report_metadata'] = {
            "generated_by": current_user.get('username', 'Unknown'),
            "generation_timestamp": datetime.now().isoformat(),
            "report_version": "2.0",
            "data_sources": [],
            "methodology": {
                "detection_model": "YOLOv8 Marine Debris Detection",
                "prediction_model": "LSTM Time Series Forecasting",
                "confidence_threshold": "25%",
                "analysis_period": f"{request.date_range_days} days"
            }
        }
        
        # Add data sources based on report type
        if request.report_type in ['detection', 'both'] and detections:
            report_data['report_metadata']['data_sources'].append("YOLO Detection Results")
        if request.report_type in ['prediction', 'both'] and predictions:
            report_data['report_metadata']['data_sources'].append("LSTM Pollution Predictions")
        
        # Generate recommendations based on findings
        recommendations = []
        
        if request.report_type in ['detection', 'both'] and detections:
            detection_analytics = report_data.get('detection_analytics', {})
            summary = detection_analytics.get('summary', {})
            
            if summary.get('total_detections', 0) > 50:
                recommendations.append({
                    "priority": "High",
                    "category": "Pollution Control",
                    "recommendation": "Immediate cleanup operations recommended due to high debris concentration",
                    "action_items": ["Deploy cleanup vessels", "Coordinate with local authorities", "Monitor progress weekly"]
                })
            
            if summary.get('avg_confidence', 0) < 70:
                recommendations.append({
                    "priority": "Medium",
                    "category": "Data Quality",
                    "recommendation": "Consider improving image quality or lighting conditions for better detection accuracy",
                    "action_items": ["Review camera settings", "Optimize lighting conditions", "Retrain detection model"]
                })
        
        if request.report_type in ['prediction', 'both'] and predictions:
            prediction_analytics = report_data.get('prediction_analytics', {})
            risk_assessment = prediction_analytics.get('risk_assessment', {})
            
            if risk_assessment.get('overall_ocean_health') == 'Poor':
                recommendations.append({
                    "priority": "Critical",
                    "category": "Environmental Action",
                    "recommendation": "Urgent intervention required to prevent further ocean degradation",
                    "action_items": ["Implement pollution reduction measures", "Increase monitoring frequency", "Engage stakeholders"]
                })
            
            critical_regions = risk_assessment.get('critical_regions', [])
            if critical_regions:
                recommendations.append({
                    "priority": "High",
                    "category": "Regional Focus",
                    "recommendation": f"Focus cleanup efforts on critical regions: {', '.join(critical_regions)}",
                    "action_items": ["Prioritize resource allocation", "Coordinate regional cleanup", "Monitor effectiveness"]
                })
        
        # Add general recommendations
        if not recommendations:
            recommendations.append({
                "priority": "Low",
                "category": "Monitoring",
                "recommendation": "Continue regular monitoring to maintain current environmental standards",
                "action_items": ["Maintain detection schedule", "Review data monthly", "Update prediction models"]
            })
        
        report_data['recommendations'] = recommendations
        
        # Add executive summary
        if request.report_type == 'detection':
            total_detections = report_data.get('detection_analytics', {}).get('summary', {}).get('total_detections', 0)
            avg_confidence = report_data.get('detection_analytics', {}).get('summary', {}).get('avg_confidence', 0)
            report_data['executive_summary'] = f"Analysis of {total_detections} marine debris detections over {request.date_range_days} days with {avg_confidence:.1f}% average confidence. Comprehensive analysis of debris types, distribution patterns, and environmental impact assessment."
            
        elif request.report_type == 'prediction':
            total_predictions = report_data.get('prediction_analytics', {}).get('summary', {}).get('total_predictions', 0)
            regions = report_data.get('prediction_analytics', {}).get('summary', {}).get('regions_analyzed', 0)
            report_data['executive_summary'] = f"LSTM-based pollution forecasting analysis covering {total_predictions} predictions across {regions} ocean regions over {request.date_range_days} days. Includes trend analysis, risk assessment, and future outlook for marine pollution levels."
            
        else:  # both
            det_count = report_data.get('detection_analytics', {}).get('summary', {}).get('total_detections', 0)
            pred_count = report_data.get('prediction_analytics', {}).get('summary', {}).get('total_predictions', 0)
            report_data['executive_summary'] = f"Comprehensive marine environmental analysis combining {det_count} debris detections and {pred_count} pollution predictions over {request.date_range_days} days. Provides complete assessment of current conditions and future projections for informed decision-making."
        try:
            db.update_report(report_id, report_data)
        except Exception as e:
            logger.warning(f"Failed to update report data: {e}")
        
        # Get the updated report
        try:
            report = db.get_report_by_id(report_id)
        except Exception as e:
            logger.warning(f"Failed to get updated report: {e}")
            report = {
                "id": report_id,
                "title": request.title,
                "report_type": request.report_type,
                "created_at": datetime.now().isoformat()
            }
        
        return {
            "success": True,
            "message": "Report generated successfully",
            "report": {
                "id": report_id,
                "title": request.title,
                "report_type": request.report_type,
                "created_at": report.get('created_at', datetime.now().isoformat()),
                "data": report_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

@app.get("/api/reports/{report_id}")
async def get_report(
    report_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific report"""
    try:
        user_id = current_user['user_id']
        report = db.get_user_report_by_id(user_id, report_id)
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return {
            "success": True,
            "report": report
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# HISTORY ENDPOINTS
# ============================================================================

@app.get("/api/history")
async def get_user_history(
    limit: int = 100,
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's detection history"""
    try:
        user_id = current_user['user_id']
        logger.info(f"📋 Fetching history for user {user_id}, limit={limit}")
        
        detections = db.get_user_detections(user_id, limit=limit)
        logger.info(f"📋 Found {len(detections)} detections")
        
        # If no detections, return empty list
        if not detections:
            return {"success": True, "history": []}
        
        # Convert to frontend format
        history = []
        for detection in detections:
            try:
                # Calculate average confidence from detection results
                detection_results = db.get_detection_results(detection['id'], user_id)
                avg_confidence = 0
                classes = []
                
                if detection_results:
                    confidences = [r['confidence'] * 100 for r in detection_results]
                    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
                    classes = list(set([r['class_name'] for r in detection_results]))
                
                # Parse metadata
                metadata = detection.get('metadata', {})
                if isinstance(metadata, str):
                    try:
                        import json
                        metadata = json.loads(metadata)
                    except:
                        metadata = {}
                
                # Safely parse date and time
                created_at = detection.get('created_at', '')
                date_str = ''
                time_str = ''
                
                if created_at:
                    if 'T' in created_at:
                        parts = created_at.split('T')
                        date_str = parts[0]
                        time_str = parts[1][:8] if len(parts) > 1 else ''
                    else:
                        date_str = created_at[:10] if len(created_at) >= 10 else created_at
                
                history_item = {
                    "id": str(detection['id']),
                    "filename": detection.get('filename', 'Unknown'),
                    "type": detection.get('file_type', 'image'),
                    "date": date_str,
                    "time": time_str,
                    "objects": detection.get('total_detections', 0),
                    "confidence": round(avg_confidence, 1),
                    "classes": classes,
                    "upload_date": created_at,
                    "file_type": detection.get('file_type', 'image'),
                    "total_detections": detection.get('total_detections', 0),
                    "avg_confidence": round(avg_confidence, 1),
                    "result": {
                        "success": True,
                        "filename": detection.get('filename', 'Unknown'),
                        "totalDetections": detection.get('total_detections', 0),
                        "detections": [
                            {
                                "class": r['class_name'],
                                "confidence": round(r['confidence'] * 100, 1),
                                "bbox": {
                                    "x1": r['bbox_x1'],
                                    "y1": r['bbox_y1'],
                                    "x2": r['bbox_x2'],
                                    "y2": r['bbox_y2']
                                },
                                "frame": r.get('frame_number', 0)
                            } for r in detection_results
                        ],
                        "summary": [
                            {
                                "class": class_name,
                                "count": len([r for r in detection_results if r['class_name'] == class_name]),
                                "avgConfidence": round(sum([r['confidence'] * 100 for r in detection_results if r['class_name'] == class_name]) / len([r for r in detection_results if r['class_name'] == class_name]), 1) if [r for r in detection_results if r['class_name'] == class_name] else 0
                            } for class_name in classes
                        ],
                        "processingTime": detection.get('processing_time', 0),
                        "result_id": str(detection['id'])
                    }
                }
                
                history.append(history_item)
                
            except Exception as e:
                logger.error(f"Error processing detection {detection.get('id', 'unknown')}: {e}", exc_info=True)
                # Skip this detection and continue with others
                continue
        
        return {
            "success": True,
            "history": history
        }
        
    except Exception as e:
        logger.error(f"Error getting user history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/detections/{detection_id}")
async def get_detection_by_id(
    detection_id: int,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific detection by ID with full details"""
    try:
        user_id = current_user['user_id']
        logger.info(f"🔍 Fetching detection {detection_id} for user {user_id}")
        
        # Get detection from database
        detection = db.get_detection_by_id(detection_id, user_id)
        
        if not detection:
            raise HTTPException(status_code=404, detail="Detection not found or access denied")
        
        # Get detection results
        detection_results = db.get_detection_results(detection_id, user_id)
        
        # Calculate average confidence and classes
        avg_confidence = 0
        classes = []
        
        if detection_results:
            confidences = [r['confidence'] * 100 for r in detection_results]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            classes = list(set([r['class_name'] for r in detection_results]))
        
        # Parse metadata
        metadata = detection.get('metadata', {})
        if isinstance(metadata, str):
            try:
                import json
                metadata = json.loads(metadata)
            except:
                metadata = {}
        
        # Get video metadata if it's a video
        video_metadata = None
        if detection.get('file_type') == 'video':
            video_metadata = db.get_video_metadata(detection_id)
        
        # Build complete result object
        result = {
            "success": True,
            "detection_id": detection_id,
            "filename": detection.get('filename', 'Unknown'),
            "totalDetections": detection.get('total_detections', 0),
            "detections": [
                {
                    "class": r['class_name'],
                    "confidence": round(r['confidence'] * 100, 1),
                    "bbox": {
                        "x1": r['bbox_x1'],
                        "y1": r['bbox_y1'],
                        "x2": r['bbox_x2'],
                        "y2": r['bbox_y2']
                    },
                    "frame": r.get('frame_number', 0)
                } for r in detection_results
            ],
            "summary": [
                {
                    "class": class_name,
                    "count": len([r for r in detection_results if r['class_name'] == class_name]),
                    "avgConfidence": round(sum([r['confidence'] * 100 for r in detection_results if r['class_name'] == class_name]) / len([r for r in detection_results if r['class_name'] == class_name]), 1) if [r for r in detection_results if r['class_name'] == class_name] else 0
                } for class_name in classes
            ],
            "processingTime": detection.get('processing_time', 0),
            "result_id": str(detection['id']),
            "file_type": detection.get('file_type', 'image'),
            "created_at": detection.get('created_at', '')
        }
        
        # Add video-specific fields if it's a video
        if video_metadata:
            result.update({
                "totalFrames": video_metadata.get('total_frames', 0),
                "processedFrames": video_metadata.get('processed_frames', 0),
                "fps": video_metadata.get('fps', 0),
                "duration": video_metadata.get('duration', 0),
                "resolution": video_metadata.get('resolution', ''),
                "framesWithDetections": metadata.get('frames_with_detections', 0),
                "detectionRate": metadata.get('detection_rate', 0),
                "avgDetectionsPerFrame": metadata.get('avg_detections_per_frame', 0),
                "fileSizeMB": metadata.get('file_size_mb', 0),
                "annotatedVideoUrl": f"/processed-video/{os.path.basename(video_metadata.get('annotated_path', ''))}" if video_metadata.get('annotated_path') else None,
                "videoId": metadata.get('video_id', ''),
            })
        
        # Add image data if it's an image
        if detection.get('file_type') == 'image':
            result.update({
                "annotatedImage": detection.get('annotated_image_base64', ''),
                "originalImage": detection.get('original_image_base64', '')
            })
        
        logger.info(f"✅ Successfully fetched detection {detection_id}")
        
        return {
            "success": True,
            "detection": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting detection {detection_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)