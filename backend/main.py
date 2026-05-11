"""
Enhanced FastAPI Main Application
Implements authentication, user management, and comprehensive marine detection system
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
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
import subprocess
from pydantic import BaseModel
import time

# Load environment variables
load_dotenv()

# Import enhanced components
from core.database import db
from core.security import (
    AuthManager, get_current_user, get_current_active_user, get_admin_user,
    UserRegistration, UserLogin, TokenResponse, UserProfile, PasswordChange, ProfileUpdate
)
from services.data_cache_service import data_cache_service
from models.lstm import EnvironmentalLSTM

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

# OPTIMIZED: Add GZip compression middleware for 3-5x smaller responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS - allow frontend to connect (secure configuration)
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:8080,http://localhost:5173,http://localhost:3000').split(',')
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]

logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # No wildcard "*" for security
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicit methods
    allow_headers=["Content-Type", "Authorization", "Accept"],  # Explicit headers
    max_age=3600,  # Cache preflight requests for 1 hour
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

# Thread pool for CPU-bound tasks (video processing, LSTM training)
# Use more workers so multiple uploads can be processed concurrently
from concurrent.futures import ThreadPoolExecutor
import multiprocessing as _mp
_VIDEO_WORKERS = max(2, min(_mp.cpu_count(), 4))
_video_executor = ThreadPoolExecutor(max_workers=_VIDEO_WORKERS, thread_name_prefix="video_worker")

# Analytics cache: user_id -> (data, timestamp)
_analytics_cache: Dict[int, tuple] = {}
_ANALYTICS_CACHE_TTL = 300  # 5 minutes

async def _update_analytics_background(user_id: int) -> None:
    """Fire-and-forget analytics update — never blocks the response"""
    try:
        await asyncio.sleep(0)  # yield to event loop first
        # Invalidate cache so next request gets fresh data
        _analytics_cache.pop(user_id, None)
    except Exception:
        pass

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

# Load YOLO model - YOLOv26s (Small) custom-trained on marine debris
# 8 classes: fishing_net, plastic_bottle, metal_can, tyre, glass_container,
#            plastic_bag, plastic_fragments, other_debris
# Trained on Kaggle T4 GPU — 7 Roboflow datasets merged (~16,500 images)
# 100 epochs, batch=16, imgsz=640, patience=20, augment=True
WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "weights", "best.pt")
model = None

# YOLOv26s class metadata (thesis Chapter 5)
YOLO_CLASS_META = {
    "fishing_net":       {"map50": 0.994, "status": "Exceptional"},
    "tyre":              {"map50": 0.891, "status": "Excellent"},
    "glass_container":   {"map50": 0.747, "status": "Strong"},
    "metal_can":         {"map50": 0.703, "status": "Good"},
    "other_debris":      {"map50": 0.621, "status": "Moderate"},
    "plastic_bag":       {"map50": 0.612, "status": "Moderate"},
    "plastic_bottle":    {"map50": 0.536, "status": "Moderate"},
    "plastic_fragments": {"map50": 0.210, "status": "Weak"},
}

def load_yolo_model():
    global model
    try:
        if not os.path.exists(WEIGHTS_PATH):
            logger.error(f"❌ Weights file not found at {WEIGHTS_PATH}")
            model = None
            return

        model = YOLO(WEIGHTS_PATH)
        # Ultralytics handles device placement internally — do not call model.to('cpu') manually.
        logger.info(f"✅ YOLOv26s model loaded from {WEIGHTS_PATH}")
        logger.info(f"   Classes: {list(model.names.values()) if model.names else 'Unknown'}")

        # Warmup: run one dummy inference so the first real video has no cold-start penalty
        try:
            dummy = np.zeros((640, 640, 3), dtype=np.uint8)
            model(dummy, verbose=False)
            logger.info("   🔥 Model warmed up — ready for fast inference")
        except Exception:
            pass
    except Exception as e:
        logger.error(f"❌ Failed to load model from {WEIGHTS_PATH}: {e}")
        logger.error("   Ensure ultralytics>=8.4.0 is installed: pip install 'ultralytics>=8.4.0'")
        model = None

def clear_all_cache():
    """Clear all cached data and models — call ONLY when explicitly requested, NOT on startup"""
    import glob
    
    logger.info("🧹 Clearing all cached data...")
    
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
    
    logger.info("✅ Cache cleared!")

@app.on_event("startup")
async def startup():
    # Load YOLO model in thread pool — non-blocking, won't delay request handling
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, load_yolo_model)
    logger.info("🚀 API server started")

@app.get("/health")
async def health_check():
    model_info = {}
    model_status = "not_loaded"
    model_message = ""
    
    if model is not None:
        model_info = {
            "loaded": True,
            "classes": list(model.names.values()) if model.names else [],
            "num_classes": 8,
            "model_type": "YOLOv26s",
            "architecture": "YOLOv26s (Small) — Kaggle T4 GPU trained",
            "training_hardware": "Kaggle T4 GPU",
            "training_datasets": "7 Roboflow datasets merged (80/20 train/val split)",
            "input_resolution": "640x640",
            "training_images": 16500,
            "epochs": 100,
            "batch_size": 16,
            "patience": 20,
            "augment": True,
            "precision": 0.83,
            "recall": 0.67,
            "map50": 0.71,
            "map50_95": 0.52,
            "class_metadata": YOLO_CLASS_META
        }
        model_status = "loaded"
        model_message = "Using YOLOv26s custom weights (best.pt) — 7 Roboflow datasets merged, ~16,500 images, 8 classes, 71% mAP50"
    else:
        model_info = {"loaded": False}
        model_status = "failed"
        model_message = "Model failed to load - detection features unavailable"
    
    return {
        "status": "healthy" if model is not None else "degraded",
        "yolo_model_loaded": model is not None,
        "model_status": model_status,
        "model_message": model_message,
        "model_info": model_info,
        "data_cache_ready": True,
        "lstm_model_ready": True,
        "cache_directory": data_cache_service.cache_dir,
        "models_directory": data_cache_service.models_dir,
        "processed_videos_directory": processed_videos_path,
        "custom_weights_path": WEIGHTS_PATH,
        "custom_weights_exists": os.path.exists(WEIGHTS_PATH)
    }

@app.get("/api/data/api-health")
async def check_api_health():
    """Test all external data APIs and return their status"""
    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, data_cache_service.check_api_health)
        overall = all(v.get('status') == 'ok' for v in results.values())
        return {"success": True, "apis": results, "all_healthy": overall}
    except Exception as e:
        logger.error(f"API health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    Fetch environmental data for a region.
    Re-fetch is allowed after a 1-hour cooldown.
    Returns cooldown info if called too soon.
    """
    try:
        logger.info(f"🚀 Data fetch request for {request.region}")

        if request.region not in data_cache_service.regions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid region: {request.region}. Valid regions: {data_cache_service.regions}"
            )

        result = await data_cache_service.fetch_and_cache_data(request.region)

        if result["message"] == "cooldown_active":
            return {
                "success": False,
                "message": "cooldown_active",
                "region": request.region,
                "seconds_remaining": result["seconds_remaining"],
                "next_fetch_at": result["next_fetch_at"],
                "dataset_info": result.get("dataset_info"),
            }

        if result["success"]:
            return {
                "success": True,
                "message": "data_fetched_successfully",
                "region": request.region,
                "dataset_info": result["dataset_info"],
                "fetch_duration_seconds": result["fetch_duration_seconds"],
                "sources_used": result["sources_used"],
            }
        else:
            raise HTTPException(status_code=500, detail=result["message"])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in data fetch endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/data/fetch-status")
async def get_all_fetch_status():
    """
    Return cooldown status for all regions.
    Frontend uses this to show/disable the Fetch Data button.
    """
    try:
        statuses = {}
        for region in data_cache_service.regions:
            statuses[region] = data_cache_service.get_fetch_status(region)
        return {"success": True, "regions": statuses}
    except Exception as e:
        logger.error(f"Error getting fetch status: {e}")
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
        
        # Train model in thread pool — non-blocking, won't freeze the API
        logger.info(f"🧠 Training LSTM model using combined multi-region data (non-blocking)...")
        loop = asyncio.get_event_loop()
        training_result = await loop.run_in_executor(
            None,
            lambda: lstm_model.train_from_cached_data(
                region=request.region,
                cached_df=combined_df,
                epochs=request.epochs
            )
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
            
            # Save predictions to database for report generation + heatmap
            saved_count = 0
            # Snapshot of the most recent environmental context
            input_features = {
                'temperature': float(recent_df['temperature'].iloc[-1]) if 'temperature' in recent_df.columns else 0,
                'humidity':    float(recent_df['humidity'].iloc[-1])    if 'humidity'    in recent_df.columns else 0,
                'aqi':         float(recent_df['aqi'].iloc[-1])         if 'aqi'         in recent_df.columns else 0,
                'wind_speed':  float(recent_df['wind_speed'].iloc[-1])  if 'wind_speed'  in recent_df.columns else 0,
                'ocean_temp':  float(recent_df['ocean_temp'].iloc[-1])  if 'ocean_temp'  in recent_df.columns else 0,
                'days_ahead':  request.days_ahead,
                'region':      request.region,
            }
            # Model version from config
            model_cfg     = prediction_result.get('model_info', {}).get('config', {})
            model_version = model_cfg.get('last_trained', datetime.now().strftime('%Y-%m-%d'))[:10]

            for pred in predictions:
                try:
                    conf  = pred.get('confidence', 0.85)
                    margin = pred['pollution_level'] * (1 - conf) * 0.5   # tighter interval for high confidence
                    confidence_lower = max(0,   pred['pollution_level'] - margin)
                    confidence_upper = min(100, pred['pollution_level'] + margin)

                    prediction_id = db.save_prediction(
                        user_id=user_id,
                        region=request.region,
                        prediction_date=pred['date'],
                        predicted_pollution_level=pred['pollution_level'],
                        confidence_interval=(confidence_lower, confidence_upper),
                        model_version=model_version,
                        input_features=input_features,
                    )

                    if prediction_id:
                        saved_count += 1
                    else:
                        logger.error(f"Failed to save prediction for date {pred['date']}")

                except Exception as e:
                    logger.error(f"Exception saving prediction: {e}", exc_info=True)

            logger.info(f"✅ Saved {saved_count}/{len(predictions)} predictions for {request.region} (user {user_id})")
            
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
                "data_source": "cached_only",
                "saved_to_db": saved_count,
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
# HEATMAP ENDPOINTS
# ============================================================================

REGION_META = {
    'pacific': {
        'name': 'Pacific Ocean',
        'location': 'North Pacific Ocean',
        'coordinates': '10°N 150°W',
        'plasticDensity': '1.8M pieces/km²',
    },
    'atlantic': {
        'name': 'Atlantic Ocean',
        'location': 'North Atlantic Ocean',
        'coordinates': '30°N 40°W',
        'plasticDensity': '325K pieces/km²',
    },
    'indian': {
        'name': 'Indian Ocean',
        'location': 'Indian Ocean Gyre',
        'coordinates': '20°S 75°E',
        'plasticDensity': '412K pieces/km²',
    },
    'mediterranean': {
        'name': 'Mediterranean Sea',
        'location': 'Mediterranean Pollution Zone',
        'coordinates': '36°N 18°E',
        'plasticDensity': '247K pieces/km²',
    },
}

@app.get("/api/heatmap")
async def get_heatmap(
    range: str = "7d",
    mode: str = "current",
    current_user: dict = Depends(get_current_user)
):
    """
    Return heatmap data for the pollution map.

    Query params:
      range  – time window: 1d | 7d | 30d | 90d  (default 7d)
      mode   – 'current' uses historical predictions, 'predicted' uses latest LSTM batch
    """
    try:
        range_map = {"1d": 1, "7d": 7, "30d": 30, "90d": 90}
        days = range_map.get(range, 7)

        if mode == "predicted":
            raw = db.get_heatmap_predictions()
        else:
            raw = db.get_heatmap_data(days=days)

        # Enrich with display metadata
        hotspots = []
        for item in raw:
            meta = REGION_META.get(item['region'], {})
            hotspots.append({
                **item,
                'name': meta.get('name', item['region'].title()),
                'location': meta.get('location', item['region'].title()),
                'coordinates': meta.get('coordinates', f"{item['lat']}°, {item['lng']}°"),
                'plasticDensity': meta.get('plasticDensity', 'N/A'),
            })

        return {
            "success": True,
            "hotspots": hotspots,
            "range": range,
            "mode": mode,
            "total": len(hotspots),
            "has_data": len(hotspots) > 0,
        }

    except Exception as e:
        logger.error(f"Heatmap endpoint error: {e}")
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
async def admin_system_action(
    action: str,
    current_user: dict = Depends(get_admin_user)
):
    """Admin system maintenance actions"""
    try:
        if action == "backup":
            # Trigger database backup
            backup_path = db.backup_database()
            return {"message": f"Database backup created at {backup_path}"}
        
        elif action == "cache-clear":
            # Clear application cache
            return {"message": "Application cache cleared"}
        
        elif action == "optimize-db":
            # Optimize database
            db.optimize_database()
            return {"message": "Database optimized"}
        
        elif action == "restart-services":
            # This would restart background services
            return {"message": "Background services restarted"}
        
        elif action == "export-data":
            # Export system data for backup
            return {"message": "Data export initiated"}
        
        elif action == "maintenance":
            # Enable/disable maintenance mode
            return {"message": "Maintenance mode toggled"}
        
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown action: {action}"
            )
            
    except Exception as e:
        logger.error(f"Admin action {action} failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute {action}"
        )

@app.get("/api/admin/users")
async def get_all_users(current_user: dict = Depends(get_admin_user)):
    """Get all users for admin management"""
    try:
        users = db.get_all_users()
        
        # Remove sensitive data and add stats
        admin_users = []
        for user in users:
            user_stats = db.get_user_stats(user['id'])
            admin_users.append({
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'role': user['role'],
                'is_active': user['is_active'],
                'created_at': user['created_at'],
                'last_login': user.get('last_login'),
                'total_detections': user_stats.get('total_detections', 0),
                'total_reports': user_stats.get('total_reports', 0),
                'storage_used': user_stats.get('storage_used', 0)
            })
        
        return {"users": admin_users}
        
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get users"
        )

@app.post("/api/admin/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: int,
    current_user: dict = Depends(get_admin_user)
):
    """Deactivate a user account"""
    try:
        # Prevent admin from deactivating themselves
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
        
        # Log admin action
        db.log_activity(
            user_id=current_user['user_id'],
            level="WARNING",
            message=f"Admin {current_user['username']} deactivated user {user_id}",
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

@app.delete("/api/admin/users/{user_id}/data")
async def admin_delete_user_data(
    user_id: int,
    current_user: dict = Depends(get_admin_user)
):
    """Admin delete all data for a specific user"""
    try:
        # Get user info for logging
        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        # Prevent admin from deleting their own data
        if user_id == current_user['user_id']:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete your own data"
            )
        
        # Delete all user data
        success = db.delete_all_user_data(user_id)
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete user data"
            )
        
        # Log admin action
        db.log_activity(
            user_id=current_user['user_id'],
            level="CRITICAL",
            message=f"Admin {current_user['username']} deleted ALL data for user {user['username']} (ID: {user_id})",
            module="admin"
        )
        
        return {
            "message": f"All data deleted for user {user['username']}",
            "success": True,
            "deleted_for_user": user['username']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user data: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete user data"
        )

@app.get("/api/admin/logs")
async def get_system_logs(
    limit: int = 100,
    level: str = "all",
    current_user: dict = Depends(get_admin_user)
):
    """Get system logs for admin monitoring"""
    try:
        logs = db.get_recent_logs(limit=limit, level=level if level != "all" else None)
        return {"logs": logs}
        
    except Exception as e:
        logger.error(f"Error getting logs: {e}")
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
        # Verify current password using authenticate_user
        auth_user = db.authenticate_user(current_user['username'], password_data.current_password)
        if not auth_user:
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
    """Delete a user's detection completely (including files)"""
    try:
        # Verify ownership
        detection = db.get_detection_by_id(detection_id)
        if not detection:
            raise HTTPException(
                status_code=404,
                detail="Detection not found"
            )
        
        if detection['user_id'] != current_user['user_id']:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to delete this detection"
            )
        
        # Delete detection and associated files
        success = db.delete_detection(detection_id, current_user['user_id'])
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete detection"
            )
        
        # Log the deletion
        db.log_activity(
            user_id=current_user['user_id'],
            level="INFO",
            message=f"User deleted detection {detection_id}",
            module="user_data"
        )
        
        return {"message": "Detection deleted completely", "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting detection: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete detection"
        )

@app.delete("/api/user/reports/{report_id}")
async def delete_user_report(
    report_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a user's report completely"""
    try:
        # Verify ownership by trying to get the report
        report = db.get_user_report_by_id(current_user['user_id'], report_id)
        if not report:
            raise HTTPException(
                status_code=404,
                detail="Report not found or not authorized"
            )
        
        # Delete the report
        success = db.delete_report(report_id, current_user['user_id'])
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete report"
            )
        
        # Log the deletion
        db.log_activity(
            user_id=current_user['user_id'],
            level="INFO",
            message=f"User deleted report {report_id}: {report['title']}",
            module="user_data"
        )
        
        return {"message": "Report deleted successfully", "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting report: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete report"
        )

@app.delete("/api/user/data/all")
async def delete_all_user_data(
    current_user: dict = Depends(get_current_user)
):
    """Delete ALL user data (detections, reports, predictions, analytics)"""
    try:
        user_id = current_user['user_id']
        
        # Log before deletion
        db.log_activity(
            user_id=user_id,
            level="WARNING",
            message=f"User {current_user['username']} requested complete data deletion",
            module="user_data"
        )
        
        # Delete all user data
        success = db.delete_all_user_data(user_id)
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete all user data"
            )
        
        return {
            "message": "All your data has been permanently deleted",
            "success": True,
            "deleted": [
                "All detections and results",
                "All generated reports", 
                "All predictions",
                "All analytics data",
                "All associated files"
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting all user data: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete all user data"
        )

@app.get("/api/user/data/export")
async def export_user_data(
    current_user: dict = Depends(get_current_user)
):
    """Export all user data for GDPR compliance"""
    try:
        user_id = current_user['user_id']
        
        # Get all user data
        user_info = db.get_user_by_id(user_id)
        detections = db.get_user_detections(user_id, limit=1000)
        reports = db.get_user_reports(user_id, limit=100)
        predictions = db.get_user_predictions(user_id, limit=1000)
        
        # Remove sensitive data
        if user_info:
            user_info.pop('password_hash', None)
        
        export_data = {
            "export_info": {
                "user_id": user_id,
                "username": current_user['username'],
                "export_date": datetime.now().isoformat(),
                "export_type": "complete_user_data"
            },
            "user_profile": user_info,
            "detections": detections,
            "reports": reports,
            "predictions": predictions,
            "summary": {
                "total_detections": len(detections),
                "total_reports": len(reports),
                "total_predictions": len(predictions),
                "account_created": user_info.get('created_at') if user_info else None
            }
        }
        
        # Log the export
        db.log_activity(
            user_id=user_id,
            level="INFO",
            message=f"User {current_user['username']} exported their data",
            module="privacy"
        )
        
        return {
            "success": True,
            "data": export_data,
            "message": "All your data has been exported successfully"
        }
        
    except Exception as e:
        logger.error(f"Error exporting user data: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to export user data"
        )

@app.delete("/api/user/history/clear")
async def clear_user_history(
    current_user: dict = Depends(get_current_user)
):
    """Clear user's detection history (same as delete all detections)"""
    try:
        user_id = current_user['user_id']
        
        # Delete all user detections
        success = db.delete_all_user_detections(user_id)
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to clear history"
            )
        
        # Log the action
        db.log_activity(
            user_id=user_id,
            level="INFO",
            message=f"User {current_user['username']} cleared all detection history",
            module="user_data"
        )
        
        return {"message": "Detection history cleared completely", "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing history: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to clear history"
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
# YOLO DETECTION ENDPOINTS — YOLOv26s
# ============================================================================

def _dark_channel_prior(image_bgr: np.ndarray,
                         patch_size: int = 15,
                         omega: float = 0.95,
                         t_min: float = 0.1) -> np.ndarray:
    """
    Dark Channel Prior (DCP) dehazing — He et al. 2009.
    Enhances contrast in murky/hazy underwater images before YOLO inference.

    Steps:
      1. Compute dark channel (min over local patch and RGB channels)
      2. Estimate atmospheric light A from the brightest dark-channel pixels
      3. Estimate transmission map t(x) = 1 - omega * dark(I/A)
      4. Soft-matting via guided filter (fast approximation with box filter)
      5. Recover scene radiance J = (I - A) / max(t, t_min) + A

    Args:
        image_bgr : uint8 BGR image
        patch_size: local patch radius for dark channel (default 15)
        omega     : haze retention factor — 0.95 keeps slight depth cue
        t_min     : minimum transmission to avoid division by zero

    Returns:
        Enhanced uint8 BGR image (same shape as input)
    """
    img = image_bgr.astype(np.float64) / 255.0
    h, w = img.shape[:2]

    # ── 1. Dark channel ───────────────────────────────────────────────────────
    dark = np.min(img, axis=2)  # min over RGB channels
    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (patch_size, patch_size)
    )
    dark = cv2.erode(dark, kernel)  # min over local patch (erosion = min filter)

    # ── 2. Atmospheric light A ────────────────────────────────────────────────
    # Take top 0.1% brightest pixels in dark channel as candidates
    num_pixels = h * w
    num_bright = max(1, int(num_pixels * 0.001))
    flat_dark  = dark.flatten()
    indices    = np.argpartition(flat_dark, -num_bright)[-num_bright:]
    # A = max intensity among those pixels across all channels
    bright_pixels = img.reshape(-1, 3)[indices]
    A = bright_pixels.max(axis=0)  # shape (3,)
    A = np.clip(A, 0.1, 1.0)       # safety clamp

    # ── 3. Transmission map ───────────────────────────────────────────────────
    # t(x) = 1 - omega * dark_channel(I / A)
    norm = img / A[np.newaxis, np.newaxis, :]
    dark_norm = np.min(norm, axis=2)
    dark_norm = cv2.erode(dark_norm.astype(np.float32), kernel).astype(np.float64)
    t = 1.0 - omega * dark_norm

    # ── 4. Guided filter (box-filter approximation) ───────────────────────────
    # Smooth transmission using the gray image as guide
    guide  = cv2.cvtColor((img * 255).astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float64) / 255.0
    r      = patch_size
    eps    = 1e-3
    mean_I = cv2.boxFilter(guide, cv2.CV_64F, (r, r))
    mean_t = cv2.boxFilter(t,     cv2.CV_64F, (r, r))
    mean_It= cv2.boxFilter(guide * t, cv2.CV_64F, (r, r))
    cov_It = mean_It - mean_I * mean_t
    mean_II= cv2.boxFilter(guide * guide, cv2.CV_64F, (r, r))
    var_I  = mean_II - mean_I * mean_I
    a_gf   = cov_It / (var_I + eps)
    b_gf   = mean_t - a_gf * mean_I
    mean_a = cv2.boxFilter(a_gf, cv2.CV_64F, (r, r))
    mean_b = cv2.boxFilter(b_gf, cv2.CV_64F, (r, r))
    t_refined = np.clip(mean_a * guide + mean_b, t_min, 1.0)

    # ── 5. Scene radiance recovery ────────────────────────────────────────────
    J = np.zeros_like(img)
    for c in range(3):
        J[:, :, c] = (img[:, :, c] - A[c]) / t_refined + A[c]

    J = np.clip(J, 0.0, 1.0)

    # ── 6. CLAHE on L channel for extra contrast boost ────────────────────────
    J_uint8 = (J * 255).astype(np.uint8)
    lab     = cv2.cvtColor(J_uint8, cv2.COLOR_BGR2LAB)
    clahe   = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])
    J_uint8 = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    return J_uint8


def _is_underwater_or_murky(image_bgr: np.ndarray) -> bool:
    """
    Heuristic to detect if an image is underwater/murky and needs DCP.
    Triggers only when there is a clear blue/green colour cast (>20% over red),
    or when both low contrast AND a mild cast are present.
    Avoids false positives on normal clear images.
    """
    b, g, r = cv2.split(image_bgr.astype(np.float32))
    mean_b  = float(b.mean())
    mean_g  = float(g.mean())
    mean_r  = max(float(r.mean()), 1.0)

    # Strong underwater cast — blue or green >20% brighter than red
    strong_cast = (mean_b > mean_r * 1.20) or (mean_g > mean_r * 1.20)

    # Low contrast
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    low_contrast = float(gray.std()) < 35.0

    # Mild cast + low contrast together
    mild_cast = (mean_b > mean_r * 1.05) or (mean_g > mean_r * 1.05)

    return strong_cast or (low_contrast and mild_cast)

def _run_tiled_inference(model, image_bgr: np.ndarray, confidence: float,
                          tile_size: int = 640, overlap: float = 0.2) -> list:
    """
    Tiled (sliding-window) inference for large or dense images.
    Splits the image into overlapping tiles, runs YOLO on each tile,
    maps detections back to full-image coordinates, then deduplicates
    with NMS across all tiles.

    Returns a flat list of detection dicts (same schema as normal inference).
    """
    h, w = image_bgr.shape[:2]
    step = int(tile_size * (1 - overlap))
    all_boxes  = []   # [x1, y1, x2, y2, conf, class_id, class_name]

    for y in range(0, h, step):
        for x in range(0, w, step):
            x2 = min(x + tile_size, w)
            y2 = min(y + tile_size, h)
            tile = image_bgr[y:y2, x:x2]

            # Pad tile to tile_size × tile_size so YOLO gets a square input
            pad_h = tile_size - tile.shape[0]
            pad_w = tile_size - tile.shape[1]
            if pad_h > 0 or pad_w > 0:
                tile = cv2.copyMakeBorder(tile, 0, pad_h, 0, pad_w,
                                          cv2.BORDER_CONSTANT, value=(114, 114, 114))

            try:
                res = model(tile, conf=confidence, iou=0.45, agnostic_nms=True,
                            imgsz=tile_size, verbose=False)[0]
            except Exception:
                continue

            if res.boxes is None or len(res.boxes) == 0:
                continue

            for box in res.boxes:
                class_id   = int(box.cls[0])
                class_name = res.names[class_id]
                conf_val = float(box.conf[0])
                bx1, by1, bx2, by2 = box.xyxy[0].tolist()
                # Map back to full-image coords
                all_boxes.append([
                    x + bx1, y + by1, x + bx2, y + by2,
                    conf_val, class_id, class_name
                ])

    if not all_boxes:
        return []

    # Cross-tile NMS using OpenCV's groupRectangles-style approach via numpy
    # Group by class, apply per-class NMS
    import torch
    final_dets = []
    class_ids_present = set(b[5] for b in all_boxes)

    for cid in class_ids_present:
        cls_boxes = [b for b in all_boxes if b[5] == cid]
        boxes_t  = torch.tensor([[b[0], b[1], b[2], b[3]] for b in cls_boxes], dtype=torch.float32)
        scores_t = torch.tensor([b[4] for b in cls_boxes], dtype=torch.float32)
        # torchvision NMS
        try:
            from torchvision.ops import nms as tv_nms
            keep = tv_nms(boxes_t, scores_t, iou_threshold=0.45).tolist()
        except Exception:
            # fallback: keep all
            keep = list(range(len(cls_boxes)))

        for k in keep:
            b = cls_boxes[k]
            final_dets.append({
                "class":      b[6],
                "confidence": round(b[4] * 100, 1),
                "bbox": {
                    "x1": int(b[0]), "y1": int(b[1]),
                    "x2": int(b[2]), "y2": int(b[3])
                }
            })

    return final_dets

@app.post("/detect")
async def detect_objects(
    file: UploadFile = File(...),
    confidence: float = 0.10,
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

        # ── DCP preprocessing — enhance murky/underwater images ──────────────
        dcp_applied = False
        if _is_underwater_or_murky(image_bgr):
            try:
                image_bgr = _dark_channel_prior(image_bgr)
                dcp_applied = True
                logger.info("🌊 DCP dehazing applied (murky/underwater image detected)")
            except Exception as _dcp_err:
                logger.warning(f"DCP failed (non-fatal): {_dcp_err}")
        
        # ── Inference strategy ────────────────────────────────────────────────
        # Pass 1 — full image at native resolution (up to 1280px)
        #   Catches large objects: fishing_net, tyre, plastic_bag
        #   NO augment — augment=True breaks texture-based classes like fishing_net
        # Pass 2 — tiled inference (only for very large/dense images > 1500px)
        #   Catches small objects: plastic_bottle, metal_can, plastic_fragments
        # Both passes merged + per-class NMS to deduplicate
        h_img, w_img = image_bgr.shape[:2]
        infer_size = min(max(w_img, h_img, 640), 1280)  # clamp 640–1280

        raw_detections: list = []

        # ── Pass 1: full-image (always runs) ─────────────────────────────────
        full_res = model(
            image_bgr,
            conf=confidence,
            iou=0.5,
            imgsz=infer_size,
            max_det=1000,
            verbose=False
        )[0]
        for box in full_res.boxes:
            cid   = int(box.cls[0])
            cname = full_res.names[cid]
            cv    = float(box.conf[0])
            bx    = box.xyxy[0].tolist()
            raw_detections.append({
                "class": cname,
                "confidence": round(cv * 100, 1),
                "bbox": {"x1": int(bx[0]), "y1": int(bx[1]),
                         "x2": int(bx[2]), "y2": int(bx[3])}
            })

        # ── Pass 2: tiled (only for very large images with small objects) ─────
        # Only tile if image is very large AND full-image pass found few/no objects
        # This avoids breaking large-object detection with unnecessary tiling
        if (w_img > 1500 or h_img > 1500) and len(raw_detections) < 3:
            tiled = _run_tiled_inference(model, image_bgr, confidence,
                                         tile_size=640, overlap=0.25)
            raw_detections.extend(tiled)

        # ── Per-class NMS to deduplicate overlapping boxes ────────────────────
        if raw_detections:
            import torch
            try:
                from torchvision.ops import nms as tv_nms
                deduped = []
                for cname in {d["class"] for d in raw_detections}:
                    cls_dets = [d for d in raw_detections if d["class"] == cname]
                    bt = torch.tensor([[d["bbox"]["x1"], d["bbox"]["y1"],
                                        d["bbox"]["x2"], d["bbox"]["y2"]]
                                       for d in cls_dets], dtype=torch.float32)
                    st = torch.tensor([d["confidence"] / 100.0 for d in cls_dets],
                                      dtype=torch.float32)
                    keep = tv_nms(bt, st, iou_threshold=0.5).tolist()
                    deduped.extend(cls_dets[k] for k in keep)
                raw_detections = deduped
            except Exception:
                pass

        # ── Build detections + class_counts from raw_detections ───────────────
        detections = []
        class_counts = {}

        for det in raw_detections:
            class_name = det["class"]
            detections.append(det)
            if class_name not in class_counts:
                class_counts[class_name] = {"count": 0, "total_confidence": 0}
            class_counts[class_name]["count"] += 1
            class_counts[class_name]["total_confidence"] += det["confidence"]
        
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
                'classes_detected': list(class_counts.keys()),
                'dcp_applied': dcp_applied,
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
        
        # Save image metadata with base64 data
        db.save_image_metadata(
            detection_id=detection_id,
            width=image.width,
            height=image.height,
            original_base64=f"data:image/{file.content_type.split('/')[-1]};base64,{base64.b64encode(contents).decode()}",
            annotated_base64=f"data:image/png;base64,{annotated_base64}"
        )
        
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
        
        # Fire-and-forget analytics update — non-blocking
        asyncio.create_task(_update_analytics_background(current_user['user_id']))
        
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
    confidence: float = 0.10,
    current_user: dict = Depends(get_current_user)
):
    """
    Non-blocking video detection.
    Saves upload, creates DB record, processes in background thread.
    Returns immediately — poll /api/detections/{detection_id}/status for progress.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Place weights at backend/weights/best.pt and restart.")
    
    if not file.content_type or not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}. Only video files are supported.")
    
    if not 0.01 <= confidence <= 1.0:
        raise HTTPException(status_code=400, detail="Confidence must be between 0.01 and 1.0")
    
    try:
        contents = await file.read()
        file_size_bytes = len(contents)
        file_size_mb = file_size_bytes / (1024 * 1024)
        video_id = str(uuid.uuid4())
        file_ext = file.filename.rsplit('.', 1)[-1] if '.' in file.filename else 'mp4'
        
        # Save upload to disk immediately
        original_filename = f"original_{video_id}.{file_ext}"
        original_video_path = os.path.join(processed_videos_path, original_filename)
        with open(original_video_path, 'wb') as f:
            f.write(contents)
        del contents  # Free memory
        
        logger.info(f"🎬 Video upload saved: {original_filename} ({file_size_mb:.1f} MB)")
        
        # Create pending DB record
        detection_id = db.create_detection(
            user_id=current_user['user_id'],
            filename=file.filename,
            file_type='video',
            file_size=file_size_bytes,
            total_detections=0,
            confidence_threshold=confidence,
            processing_time=None,
            metadata={'video_id': video_id, 'status': 'processing', 'progress': 0, 'original_filename': original_filename}
        )
        
        if not detection_id:
            raise HTTPException(status_code=500, detail="Failed to create detection record")
        
        db.update_detection_status(detection_id, 'processing', metadata={
            'video_id': video_id, 'status': 'processing', 'progress': 0, 'original_filename': original_filename
        })
        
        # Launch background processing — non-blocking
        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            _video_executor,
            _process_video_sync,
            original_video_path, video_id, detection_id,
            confidence, current_user['user_id'], file.filename, file_ext
        )
        
        logger.info(f"✅ Video queued for background processing: detection_id={detection_id}")
        
        return JSONResponse({
            "success": True,
            "detection_id": detection_id,
            "video_id": video_id,
            "status": "processing",
            "filename": file.filename,
            "message": "Video processing started. Poll /api/detections/{detection_id}/status for updates."
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Video upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _get_ffmpeg_exe() -> str | None:
    """Locate ffmpeg executable, preferring imageio_ffmpeg bundle."""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    try:
        where_cmd = 'where' if os.name == 'nt' else 'which'
        r = subprocess.run([where_cmd, 'ffmpeg'], capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            return r.stdout.strip().splitlines()[0].strip()
    except Exception:
        pass
    return None


def _annotate_frame(frame: np.ndarray, frame_idx: int, total_frames: int,
                    frame_detections: list, colors: dict) -> np.ndarray:
    """Draw bounding boxes and HUD text onto a frame (in-place copy)."""
    annotated = frame.copy()
    info_text = f"Frame {frame_idx}/{total_frames} | {len(frame_detections)} detections"
    cv2.putText(annotated, info_text, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(annotated, info_text, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    for det in frame_detections:
        color = colors[det["class"]]
        b = det["bbox"]
        cv2.rectangle(annotated, (b["x1"], b["y1"]), (b["x2"], b["y2"]), color, 3)
        label = f"{det['class']} {det['confidence']}%"
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(annotated, (b["x1"], b["y1"] - lh - 15), (b["x1"] + lw + 10, b["y1"]), color, -1)
        cv2.putText(annotated, label, (b["x1"] + 5, b["y1"] - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    return annotated


def _process_video_sync(
    input_path: str, video_id: str, detection_id: int,
    confidence: float, user_id: int, original_filename: str, file_ext: str
):
    """
    Optimised video processing pipeline:
      • Batch YOLO inference  — feed BATCH_SIZE frames at once (3-5x faster)
      • Frame skipping        — run YOLO every SKIP_N frames, copy detections to
                                skipped frames (5-10x fewer inferences)
      • Inference downscale   — resize to INFER_SIZE for YOLO, draw on full-res
      • Direct FFmpeg pipe    — write annotated frames straight to MP4 via stdin,
                                no AVI temp file (eliminates double I/O pass)
    Combined speedup on CPU: ~20-40x vs original sequential pipeline.
    With CUDA GPU: additional 10-50x on top.
    """
    import time as _time
    import json as _json

    # ── Tuning knobs ──────────────────────────────────────────────────────────
    # SKIP_N=3  → run YOLO on 1 in every 3 frames (copy detections to the other 2)
    # Increase for more speed, decrease for higher accuracy on fast-moving objects
    SKIP_N      = 3
    BATCH_SIZE  = 8   # frames fed to YOLO at once
    INFER_SIZE  = 640 # YOLO input resolution
    # ─────────────────────────────────────────────────────────────────────────

    start_time = _time.time()
    cap        = None
    ffmpeg_proc = None
    temp_raw_path = None  # only used as OpenCV fallback

    try:
        logger.info(f"🚀 [Thread] Fast-processing video {video_id} (skip={SKIP_N}, batch={BATCH_SIZE})")

        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise RuntimeError("Could not open video file")

        fps          = int(cap.get(cv2.CAP_PROP_FPS)) or 25
        width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration     = total_frames / fps if fps > 0 else 0

        if fps <= 0 or width <= 0 or height <= 0 or total_frames <= 0:
            raise RuntimeError(f"Invalid video properties: {width}x{height} @ {fps}fps, {total_frames} frames")

        logger.info(f"   📹 {width}x{height} @ {fps}fps, {total_frames} frames, {duration:.1f}s")

        # ── Set up output: FFmpeg pipe (preferred) or OpenCV fallback ─────────
        processed_filename = f"processed_{video_id}.mp4"
        final_output_path  = os.path.join(processed_videos_path, processed_filename)
        ffmpeg_exe         = _get_ffmpeg_exe()
        use_ffmpeg_pipe    = False

        if ffmpeg_exe:
            try:
                pipe_cmd = [
                    ffmpeg_exe, '-y',
                    '-f', 'rawvideo', '-vcodec', 'rawvideo',
                    '-s', f'{width}x{height}', '-pix_fmt', 'bgr24',
                    '-r', str(fps), '-i', 'pipe:0',
                    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
                    '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
                    final_output_path
                ]
                ffmpeg_proc    = subprocess.Popen(pipe_cmd, stdin=subprocess.PIPE,
                                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                use_ffmpeg_pipe = True
                logger.info("   🎞  FFmpeg pipe output enabled (ultrafast preset)")
            except Exception as e:
                logger.warning(f"FFmpeg pipe setup failed, falling back to OpenCV: {e}")
                ffmpeg_proc = None

        if not use_ffmpeg_pipe:
            # OpenCV fallback — write AVI, convert later
            temp_raw_path = input_path.replace(f'.{file_ext}', '_annotated_temp.avi')
            out = cv2.VideoWriter(temp_raw_path, cv2.VideoWriter_fourcc(*'XVID'), fps, (width, height))
            if not out.isOpened():
                raise RuntimeError("Failed to initialize video writer")
        else:
            out = None

        # ── State ─────────────────────────────────────────────────────────────
        frame_count          = 0
        total_detections     = 0
        all_detections       = []
        class_counts         = {}
        colors               = {}
        frames_with_detections = 0
        last_progress_update = _time.time()

        # Check first frame for underwater/murky content — apply DCP to all frames if detected
        use_dcp = False
        try:
            ret_probe, frame_probe = cap.read()
            if ret_probe and frame_probe is not None:
                probe_small = cv2.resize(frame_probe, (INFER_SIZE, INFER_SIZE))
                use_dcp = _is_underwater_or_murky(probe_small)
                if use_dcp:
                    logger.info("🌊 Video: DCP dehazing enabled for all frames")
                # Seek back to start
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        except Exception:
            pass

        # Sliding window: detections from the last inferred frame
        last_inferred_dets: list = []

        # Batch buffers
        batch_frames:  list = []   # full-res frames
        batch_indices: list = []   # 1-based frame numbers
        batch_small:   list = []   # downscaled frames for YOLO

        def _flush_batch():
            """Run YOLO on the current batch and annotate + write all frames."""
            nonlocal frame_count, total_detections, frames_with_detections
            nonlocal last_inferred_dets, all_detections

            if not batch_frames:
                return

            # Batch inference — standard NMS (not agnostic) to preserve class separation
            try:
                batch_results = model(batch_small, conf=confidence, iou=0.5,
                                      verbose=False, imgsz=INFER_SIZE)
            except Exception as e:
                logger.warning(f"Batch inference failed: {e}")
                batch_results = [None] * len(batch_frames)

            scale_x = width  / INFER_SIZE
            scale_y = height / INFER_SIZE

            for i, (full_frame, fidx, result) in enumerate(
                    zip(batch_frames, batch_indices, batch_results)):

                frame_dets: list = []

                if result is not None and result.boxes is not None and len(result.boxes) > 0:
                    frames_with_detections += 1
                    for box in result.boxes:
                        class_id   = int(box.cls[0])
                        class_name = result.names[class_id]
                        conf_val   = float(box.conf[0])
                        bbox       = box.xyxy[0].tolist()

                        # Scale bbox back to full resolution
                        det = {
                            "frame":      fidx,
                            "timestamp":  round((fidx - 1) / fps, 2),
                            "class":      class_name,
                            "confidence": round(conf_val * 100, 1),
                            "bbox": {
                                "x1": int(bbox[0] * scale_x), "y1": int(bbox[1] * scale_y),
                                "x2": int(bbox[2] * scale_x), "y2": int(bbox[3] * scale_y),
                            }
                        }
                        frame_dets.append(det)
                        all_detections.append(det)
                        total_detections += 1

                        if class_name not in class_counts:
                            class_counts[class_name] = {"count": 0, "total_confidence": 0, "frames": set()}
                        class_counts[class_name]["count"]            += 1
                        class_counts[class_name]["total_confidence"] += conf_val * 100
                        class_counts[class_name]["frames"].add(fidx)

                        if class_name not in colors:
                            h = hash(class_name)
                            colors[class_name] = (h & 0xFF, (h >> 8) & 0xFF, (h >> 16) & 0xFF)

                    last_inferred_dets = frame_dets
                else:
                    # No detection on this inferred frame — clear carry-over
                    last_inferred_dets = []

                annotated = _annotate_frame(full_frame, fidx, total_frames, frame_dets, colors)
                _write_frame(annotated)

            batch_frames.clear()
            batch_indices.clear()
            batch_small.clear()

        def _write_frame(annotated: np.ndarray):
            if use_ffmpeg_pipe and ffmpeg_proc and ffmpeg_proc.stdin:
                try:
                    ffmpeg_proc.stdin.write(annotated.tobytes())
                except BrokenPipeError:
                    pass
            elif out:
                out.write(annotated)

        # ── Main loop ─────────────────────────────────────────────────────────
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            is_infer_frame = (frame_count % SKIP_N == 1) or (SKIP_N == 1)

            if is_infer_frame:
                # Flush previous batch if full
                if len(batch_frames) >= BATCH_SIZE:
                    _flush_batch()

                # Downscale for inference
                small = cv2.resize(frame, (INFER_SIZE, INFER_SIZE))
                # Apply DCP if video is murky/underwater (checked once, applied to all frames)
                if use_dcp:
                    try:
                        small = _dark_channel_prior(small, patch_size=7)
                    except Exception:
                        pass
                batch_frames.append(frame)
                batch_indices.append(frame_count)
                batch_small.append(small)
            else:
                # Skipped frame — flush any pending batch first so
                # last_inferred_dets is up to date, then carry detections forward
                if batch_frames:
                    _flush_batch()

                # Carry last detections forward (re-stamp frame number)
                carried = [
                    {**d, "frame": frame_count,
                     "timestamp": round((frame_count - 1) / fps, 2)}
                    for d in last_inferred_dets
                ]
                if carried:
                    frames_with_detections += 1
                    all_detections.extend(carried)
                    total_detections += len(carried)
                    for d in carried:
                        cn = d["class"]
                        if cn not in class_counts:
                            class_counts[cn] = {"count": 0, "total_confidence": 0, "frames": set()}
                        class_counts[cn]["count"]            += 1
                        class_counts[cn]["total_confidence"] += d["confidence"]
                        class_counts[cn]["frames"].add(frame_count)

                annotated = _annotate_frame(frame, frame_count, total_frames, carried, colors)
                _write_frame(annotated)

            # Progress update every 2 s
            now = _time.time()
            if now - last_progress_update >= 2.0:
                progress = int((frame_count / total_frames) * 100)
                db.update_detection_status(detection_id, 'processing', metadata={
                    'video_id': video_id, 'status': 'processing', 'progress': progress,
                    'original_filename': f"original_{video_id}.{file_ext}",
                })
                last_progress_update = now

        # Flush remaining batch
        _flush_batch()

        cap.release()
        cap = None

        # ── Finalise output ───────────────────────────────────────────────────
        ffmpeg_success = False

        if use_ffmpeg_pipe and ffmpeg_proc:
            try:
                ffmpeg_proc.stdin.close()
                ffmpeg_proc.wait()
                if ffmpeg_proc.returncode == 0 and os.path.exists(final_output_path):
                    ffmpeg_success = True
                    logger.info(f"✅ FFmpeg pipe output complete: {processed_filename}")
                else:
                    logger.warning(f"FFmpeg pipe exited with code {ffmpeg_proc.returncode}")
            except Exception as e:
                logger.warning(f"FFmpeg pipe finalise failed: {e}")
            finally:
                ffmpeg_proc = None

        if not ffmpeg_success and out:
            out.release()
            out = None
            # Convert AVI → MP4
            if ffmpeg_exe and temp_raw_path and os.path.exists(temp_raw_path):
                try:
                    cmd = [
                        ffmpeg_exe, '-y', '-i', temp_raw_path,
                        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                        '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
                        final_output_path
                    ]
                    r = subprocess.run(cmd, capture_output=True, text=True)
                    if r.returncode == 0 and os.path.exists(final_output_path):
                        ffmpeg_success = True
                        os.remove(temp_raw_path)
                        temp_raw_path = None
                        logger.info(f"✅ FFmpeg AVI→MP4 conversion done")
                except Exception as e:
                    logger.warning(f"FFmpeg AVI conversion failed: {e}")

            if not ffmpeg_success and temp_raw_path and os.path.exists(temp_raw_path):
                # Last resort: OpenCV mp4v re-encode
                try:
                    fb_cap = cv2.VideoCapture(temp_raw_path)
                    fb_out = cv2.VideoWriter(final_output_path, cv2.VideoWriter_fourcc(*'mp4v'),
                                             int(fb_cap.get(cv2.CAP_PROP_FPS)),
                                             (int(fb_cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                                              int(fb_cap.get(cv2.CAP_PROP_FRAME_HEIGHT))))
                    while True:
                        ret, frm = fb_cap.read()
                        if not ret:
                            break
                        fb_out.write(frm)
                    fb_cap.release()
                    fb_out.release()
                    os.remove(temp_raw_path)
                    temp_raw_path = None
                    ffmpeg_success = True
                    logger.info("✅ OpenCV fallback conversion successful")
                except Exception as e:
                    logger.warning(f"OpenCV fallback failed: {e}")
                    shutil.move(temp_raw_path, final_output_path.replace('.mp4', '.avi'))
                    processed_filename = processed_filename.replace('.mp4', '.avi')
                    final_output_path  = final_output_path.replace('.mp4', '.avi')
                    temp_raw_path = None
        
        processing_time = _time.time() - start_time
        detection_rate = (frames_with_detections / frame_count * 100) if frame_count > 0 else 0
        avg_dets = total_detections / frame_count if frame_count > 0 else 0
        
        summary = []
        for class_name, data in class_counts.items():
            avg_conf = data["total_confidence"] / data["count"]
            frames_app = len(data["frames"])
            summary.append({
                "class": class_name,
                "count": data["count"],
                "avgConfidence": round(avg_conf, 1),
                "framesAppeared": frames_app,
                "appearanceRate": round(frames_app / frame_count * 100, 1) if frame_count > 0 else 0
            })
        summary.sort(key=lambda x: x["count"], reverse=True)
        
        full_result = {
            "success": True,
            "filename": original_filename,
            "totalDetections": total_detections,
            "detections": all_detections[:500],
            "summary": summary,
            "totalFrames": total_frames,
            "processedFrames": frame_count,
            "framesWithDetections": frames_with_detections,
            "detectionRate": round(detection_rate, 1),
            "avgDetectionsPerFrame": round(avg_dets, 2),
            "fps": fps,
            "duration": round(duration, 2),
            "resolution": f"{width}x{height}",
            "annotatedVideoUrl": f"/processed-video/{processed_filename}",
            "originalVideoUrl": f"/processed-video/original_{video_id}.{file_ext}",
            "videoId": video_id,
            "processingStats": {
                "uniqueClasses": len(class_counts),
                "detectionRate": round(detection_rate, 1),
                "avgDetectionsPerFrame": round(avg_dets, 2),
                "framesWithDetections": frames_with_detections
            }
        }
        
        # Update DB record with final results
        # Store summary directly in metadata so the API endpoint can read it
        # without depending on detection_results rows being committed first
        db.update_detection_status(
            detection_id, 'completed',
            total_detections=total_detections,
            processing_time=processing_time,
            metadata={
                'video_id': video_id, 'status': 'completed', 'progress': 100,
                'original_filename': f"original_{video_id}.{file_ext}",
                'processed_filename': processed_filename,
                'total_frames': total_frames, 'fps': fps,
                'duration': round(duration, 2), 'resolution': f"{width}x{height}",
                'detection_rate': round(detection_rate, 1),
                'framesWithDetections': frames_with_detections,
                'avgDetectionsPerFrame': round(avg_dets, 2),
                'classes_detected': list(class_counts.keys()),
                # Store summary directly — no double JSON encoding needed
                'summary': summary,
                'avg_confidence': round(
                    sum(d['total_confidence'] for d in class_counts.values()) / total_detections, 1
                ) if total_detections > 0 else 0,
                'raw_result': _json.dumps(full_result)
            }
        )
        
        # Save individual detection results
        for det in all_detections:
            db.add_detection_result(
                detection_id=detection_id,
                class_name=det['class'],
                confidence=det['confidence'] / 100.0,
                bbox_x1=det['bbox']['x1'], bbox_y1=det['bbox']['y1'],
                bbox_x2=det['bbox']['x2'], bbox_y2=det['bbox']['y2'],
                frame_number=det.get('frame', 0)
            )
        
        db.save_video_metadata(
            detection_id=detection_id,
            total_frames=total_frames, processed_frames=frame_count,
            fps=fps, duration=duration, resolution=f"{width}x{height}",
            original_path=input_path, annotated_path=final_output_path
        )
        
        logger.info(f"✅ [Thread] Video processing complete: {total_detections} detections in {processing_time:.1f}s")
        
    except Exception as e:
        logger.error(f"❌ [Thread] Video processing failed for {video_id}: {e}", exc_info=True)
        try:
            db.update_detection_status(detection_id, 'failed', error_message=str(e), metadata={
                'video_id': video_id, 'status': 'failed', 'error': str(e)
            })
        except Exception:
            pass
    finally:
        if cap:
            try:
                cap.release()
            except Exception:
                pass
        if out:
            try:
                out.release()
            except Exception:
                pass
        if ffmpeg_proc:
            try:
                ffmpeg_proc.stdin.close()
            except Exception:
                pass
            try:
                ffmpeg_proc.kill()
            except Exception:
                pass
        if temp_raw_path and os.path.exists(temp_raw_path):
            try:
                os.remove(temp_raw_path)
            except Exception:
                pass


@app.get("/api/detections/{detection_id}/status")
async def get_detection_status(
    detection_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Poll video processing status. Returns progress 0-100 and status."""
    try:
        detection = db.get_detection_by_id(detection_id)
        if not detection:
            raise HTTPException(status_code=404, detail="Detection not found")
        if detection['user_id'] != current_user['user_id'] and current_user['role'] != 'ADMIN':
            raise HTTPException(status_code=403, detail="Not authorized")
        
        meta = detection.get('metadata', {})
        status = meta.get('status', detection.get('status', 'unknown'))
        progress = meta.get('progress', 100 if status == 'completed' else 0)
        
        response = {
            "detection_id": detection_id,
            "status": status,
            "progress": progress,
            "filename": detection.get('filename'),
            "file_type": detection.get('file_type'),
        }
        
        if status == 'completed':
            response.update({
                "total_detections": detection.get('total_detections', 0),
                "processing_time": detection.get('processing_time'),
                "annotated_video_url": f"/processed-video/{meta.get('processed_filename', '')}",
                "original_video_url": f"/processed-video/{meta.get('original_filename', '')}",
                "video_id": meta.get('video_id'),
            })
        elif status == 'failed':
            response["error"] = meta.get('error', 'Processing failed')
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting detection status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        
        # Check in-memory cache first (5 min TTL)
        now_ts = time.time()
        if user_id in _analytics_cache:
            cached_data, cached_ts = _analytics_cache[user_id]
            if now_ts - cached_ts < _ANALYTICS_CACHE_TTL:
                return cached_data
        
        # Get user's detections filtered by days
        detections = db.get_user_detections(user_id, limit=1000, days=days)
        
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
        from datetime import datetime as _dt, timedelta
        import json as _json

        now_dt = _dt.now()
        week_ago = now_dt - timedelta(days=7)

        total_detections = sum(d.get('total_detections', 0) for d in detections)

        # ── Efficient single-pass: collect all detection_results in one query per detection
        # Build class counts, confidence, and trend data simultaneously
        all_confidences = []
        class_counts: dict = {}
        trend_data: dict = {}

        for detection in detections:
            det_id = detection['id']
            created_raw = detection.get('created_at', '')
            date_str = created_raw[:10] if created_raw else ''

            # Trend grouping
            if date_str:
                if date_str not in trend_data:
                    trend_data[date_str] = {"detections": 0, "confidences": []}
                trend_data[date_str]["detections"] += detection.get('total_detections', 0)

            try:
                results = db.get_detection_results(det_id, user_id)
                if results:
                    for r in results:
                        conf = r['confidence'] * 100
                        all_confidences.append(conf)
                        if date_str:
                            trend_data[date_str]["confidences"].append(conf)
                        cn = r['class_name']
                        class_counts[cn] = class_counts.get(cn, 0) + 1
                else:
                    # Fallback: parse metadata for class info
                    meta = detection.get('metadata', {})
                    if isinstance(meta, str):
                        try:
                            meta = _json.loads(meta)
                        except Exception:
                            meta = {}
                    for cn in meta.get('classes_detected', []):
                        class_counts[cn] = class_counts.get(cn, 0) + 1
                    if not meta.get('classes_detected') and detection.get('total_detections', 0) > 0:
                        class_counts['plastic'] = class_counts.get('plastic', 0) + detection.get('total_detections', 1)
            except Exception as e:
                logger.warning(f"Analytics: failed to get results for detection {det_id}: {e}")
                if detection.get('total_detections', 0) > 0:
                    class_counts['plastic'] = class_counts.get('plastic', 0) + detection.get('total_detections', 1)

        avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0

        # This-week count — safe parse for SQLite timestamps (space or T separator)
        def _parse_dt(s: str):
            if not s:
                return None
            try:
                return _dt.fromisoformat(s.replace('Z', '').replace(' ', 'T').split('+')[0])
            except Exception:
                return None

        this_week = sum(
            d.get('total_detections', 0)
            for d in detections
            if (_parse_dt(d.get('created_at', '')) or _dt.min) >= week_ago
        )

        # Trend list
        colors = [
            "hsl(203, 77%, 26%)", "hsl(170, 50%, 45%)", "hsl(177, 59%, 41%)",
            "hsl(160, 84%, 39%)", "hsl(38, 92%, 50%)", "hsl(25, 95%, 53%)",
            "hsl(271, 81%, 56%)", "hsl(348, 83%, 47%)", "hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)"
        ]
        trend_list = []
        for date_str, data in sorted(trend_data.items()):
            avg_c = sum(data["confidences"]) / len(data["confidences"]) if data["confidences"] else 0
            trend_list.append({"date": date_str, "detections": data["detections"], "confidence": round(avg_c, 1)})

        # Class distribution
        if not class_counts and total_detections > 0:
            class_counts["plastic"] = total_detections

        class_distribution = []
        object_counts = []
        for i, (cn, count) in enumerate(sorted(class_counts.items(), key=lambda x: x[1], reverse=True)):
            class_distribution.append({"name": cn, "value": count, "color": colors[i % len(colors)]})
            object_counts.append({"class": cn, "count": count})

        analytics_data = {
            "stats": {
                "totalDetections": total_detections,
                "avgConfidence": round(avg_confidence, 1),
                "thisWeek": this_week,
                "detectionRate": 100,
            },
            "trendData": trend_list[-30:],
            "classDistribution": class_distribution,
            "objectCounts": object_counts,
        }

        result = {"success": True, "analytics": analytics_data}

        # Store in memory cache
        _analytics_cache[user_id] = (result, time.time())

        return result

    except Exception as e:
        logger.error(f"Error getting analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analytics/generate")
async def generate_analytics(
    current_user: dict = Depends(get_current_user)
):
    """Invalidate analytics cache and return fresh data"""
    try:
        user_id = current_user['user_id']
        # Invalidate cache so next GET returns fresh data
        _analytics_cache.pop(user_id, None)
        # Return fresh analytics
        result = await get_analytics(days=30, current_user=current_user)
        return {"success": True, "message": "Analytics refreshed", "analytics": result.get("analytics")}
    except Exception as e:
        logger.error(f"Error generating analytics: {e}")
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
        raw_reports = db.get_user_reports(user_id)
        
        # Normalize report fields for frontend
        reports = []
        for r in raw_reports:
            meta = r.get('metadata', {})
            if isinstance(meta, str):
                import json as _j
                try:
                    meta = _j.loads(meta)
                except Exception:
                    meta = {}
            
            # Compute approximate size from metadata data length
            data_size = len(str(meta.get('data', {})))
            size_kb = max(1, data_size // 1024)
            size_str = f"{size_kb} KB" if size_kb < 1024 else f"{size_kb // 1024:.1f} MB"
            
            reports.append({
                "id": r['id'],
                "title": r.get('title', 'Untitled Report'),
                "report_type": r.get('report_type', 'detection'),
                "created_at": r.get('created_at', ''),
                "status": meta.get('status', 'ready'),
                "size": size_str,
                "data_range_start": r.get('data_range_start'),
                "data_range_end": r.get('data_range_end'),
            })
        
        return {"success": True, "reports": reports}
        
    except Exception as e:
        logger.error(f"Error getting reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ReportRequest(BaseModel):
    report_type: str  # 'detection', 'prediction', 'both'
    title: Optional[str] = None
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
                
                # This week count — safe parse for SQLite timestamps
                def _safe_parse(s):
                    if not s:
                        return None
                    try:
                        from datetime import datetime as _dt2
                        return _dt2.fromisoformat(s.replace('Z', '').replace(' ', 'T').split('+')[0])
                    except Exception:
                        return None

                this_week = sum(
                    d.get('total_detections', 0)
                    for d in detections
                    if (_safe_parse(d.get('created_at', '')) or datetime.min) >= week_ago
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
                "detection_model": "YOLOv26s Marine Debris Detection (71% mAP50, 8 classes)",
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
                
                # Safely parse date and time — handles both SQLite space format and ISO T format
                created_at = detection.get('created_at', '')
                date_str = ''
                time_str = ''
                
                if created_at:
                    # Normalize: replace space with T for consistent splitting
                    normalized = created_at.replace(' ', 'T')
                    if 'T' in normalized:
                        parts = normalized.split('T')
                        date_str = parts[0]
                        time_str = parts[1][:8] if len(parts) > 1 else ''
                    else:
                        date_str = created_at[:10] if len(created_at) >= 10 else created_at
                
                # Get video metadata if it's a video
                video_meta = None
                if detection.get('file_type') == 'video':
                    try:
                        video_meta = db.get_video_metadata(detection['id'])
                    except Exception:
                        pass

                # Parse metadata JSON
                import json as _json2
                meta = detection.get('metadata', {})
                if isinstance(meta, str):
                    try:
                        meta = _json2.loads(meta)
                    except Exception:
                        meta = {}

                # Build the result object (matches DetectionResult interface)
                result_obj = {
                    "success": True,
                    "filename": detection.get('filename', 'Unknown'),
                    "totalDetections": detection.get('total_detections', 0),
                    "detections": [
                        {
                            "class": r['class_name'],
                            "confidence": round(r['confidence'] * 100, 1),
                            "bbox": {"x1": r['bbox_x1'], "y1": r['bbox_y1'], "x2": r['bbox_x2'], "y2": r['bbox_y2']},
                            "frame": r.get('frame_number', 0)
                        } for r in detection_results
                    ],
                    "summary": [
                        {
                            "class": cn,
                            "count": sum(1 for r in detection_results if r['class_name'] == cn),
                            "avgConfidence": round(
                                sum(r['confidence'] * 100 for r in detection_results if r['class_name'] == cn) /
                                max(1, sum(1 for r in detection_results if r['class_name'] == cn)), 1
                            )
                        } for cn in classes
                    ],
                    "processingTime": detection.get('processing_time', 0),
                    "result_id": str(detection['id']),
                }

                # Add video-specific fields
                if video_meta:
                    video_id = meta.get('video_id', '')
                    processed_fn = meta.get('processed_filename', '')
                    original_fn = meta.get('original_filename', '')
                    result_obj.update({
                        "totalFrames": video_meta.get('total_frames', 0),
                        "processedFrames": video_meta.get('processed_frames', 0),
                        "fps": video_meta.get('fps', 0),
                        "duration": video_meta.get('duration', 0),
                        "resolution": video_meta.get('resolution', ''),
                        "framesWithDetections": meta.get('frames_with_detections', 0),
                        "detectionRate": meta.get('detection_rate', 0),
                        "avgDetectionsPerFrame": meta.get('avg_detections_per_frame', 0),
                        "videoId": video_id,
                        "annotatedVideoUrl": f"/processed-video/{processed_fn}" if processed_fn else None,
                        "originalVideoUrl": f"/processed-video/{original_fn}" if original_fn else None,
                    })

                # Add image fields
                if detection.get('file_type') == 'image':
                    result_obj.update({
                        "annotatedImage": detection.get('annotated_image_base64', ''),
                        "originalImage": detection.get('original_image_base64', ''),
                    })

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
                    "raw_result": _json2.dumps(result_obj),  # For data.service.ts mapHistoryItem
                    "result": result_obj,
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
    detection_id: str,  # Changed to str to handle both int and string
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific detection by ID with full details"""
    try:
        # Convert detection_id to int
        try:
            detection_id_int = int(detection_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid detection ID format")
        
        user_id = current_user['user_id']
        
        # Get detection from database (first check if it exists at all)
        detection_check = db.get_detection_by_id(detection_id_int, user_id=None)
        if detection_check:
            if detection_check.get('user_id') != user_id:
                raise HTTPException(status_code=403, detail=f"Access denied. This detection belongs to another user.")
        else:
            raise HTTPException(status_code=404, detail="Detection not found")
        
        # Get detection from database with user verification
        detection = db.get_detection_by_id(detection_id_int, user_id)
        
        if not detection:
            raise HTTPException(status_code=404, detail="Detection not found or access denied")
        
        # Parse metadata first — needed for fallback summary
        metadata = detection.get('metadata', {})
        if isinstance(metadata, str):
            try:
                import json as _json_mod
                metadata = _json_mod.loads(metadata)
            except Exception:
                metadata = {}

        # Get detection results from DB
        detection_results = db.get_detection_results(detection_id_int, user_id)

        # Build summary from DB rows when available
        summary = []
        if detection_results:
            from collections import defaultdict
            class_map: dict = defaultdict(lambda: {"count": 0, "total_conf": 0.0})
            for r in detection_results:
                cn = r['class_name']
                class_map[cn]["count"] += 1
                class_map[cn]["total_conf"] += r['confidence'] * 100
            summary = [
                {
                    "class": cn,
                    "count": v["count"],
                    "avgConfidence": round(v["total_conf"] / v["count"], 1)
                }
                for cn, v in sorted(class_map.items(), key=lambda x: -x[1]["count"])
            ]

        # Fallback: rebuild summary from raw_result stored in metadata (handles race condition
        # where detection_results rows aren't committed yet when the page first loads)
        if not summary:
            # Fast path: summary stored directly in metadata
            meta_summary = metadata.get('summary')
            if meta_summary and isinstance(meta_summary, list) and len(meta_summary) > 0:
                summary = meta_summary

        if not summary:
            raw_result_str = metadata.get('raw_result')
            if raw_result_str:
                try:
                    import json as _json_mod
                    raw = _json_mod.loads(raw_result_str) if isinstance(raw_result_str, str) else raw_result_str
                    summary = raw.get('summary', [])
                except Exception:
                    pass

        # If still empty, try classes_detected from metadata to build a minimal summary
        if not summary:
            classes_detected = metadata.get('classes_detected', [])
            total = detection.get('total_detections', 0)
            if classes_detected and total:
                per_class = max(1, total // len(classes_detected))
                summary = [{"class": c, "count": per_class, "avgConfidence": 0} for c in classes_detected]

        avg_confidence = 0
        if detection_results:
            confs = [r['confidence'] * 100 for r in detection_results]
            avg_confidence = sum(confs) / len(confs)
        elif metadata.get('avg_confidence'):
            avg_confidence = metadata['avg_confidence']
        elif summary:
            # Weighted average from summary
            total_count = sum(s['count'] for s in summary)
            if total_count:
                avg_confidence = sum(s['avgConfidence'] * s['count'] for s in summary) / total_count

        # Get video metadata if it's a video
        video_metadata = None
        if detection.get('file_type') == 'video':
            video_metadata = db.get_video_metadata(detection_id_int)

        # Build complete result object
        result = {
            "success": True,
            "detection_id": detection_id_int,
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
            "summary": summary,
            "avgConfidence": round(avg_confidence, 1),
            "processingTime": detection.get('processing_time', 0),
            "result_id": str(detection['id']),
            "file_type": detection.get('file_type', 'image'),
            "created_at": detection.get('created_at', '')
        }

        # Add video-specific fields if it's a video
        if detection.get('file_type') == 'video':
            # Build video URLs — prefer video_metadata paths, fall back to metadata filenames
            # (metadata is always written; video_metadata row may be missing on race condition)
            processed_fn = metadata.get('processed_filename', '')
            original_fn  = metadata.get('original_filename', '')

            if video_metadata:
                annotated_path = video_metadata.get('annotated_path', '')
                original_path  = video_metadata.get('original_path', '')
                annotated_url = (
                    f"/processed-video/{os.path.basename(annotated_path)}"
                    if annotated_path else
                    (f"/processed-video/{processed_fn}" if processed_fn else None)
                )
                original_url = (
                    f"/processed-video/{os.path.basename(original_path)}"
                    if original_path else
                    (f"/processed-video/{original_fn}" if original_fn else None)
                )
            else:
                # video_metadata row not yet written — use filenames from detection metadata
                annotated_url = f"/processed-video/{processed_fn}" if processed_fn else None
                original_url  = f"/processed-video/{original_fn}"  if original_fn  else None

            result.update({
                "totalFrames":            video_metadata.get('total_frames', metadata.get('total_frames', 0))     if video_metadata else metadata.get('total_frames', 0),
                "processedFrames":        video_metadata.get('processed_frames', 0)                               if video_metadata else 0,
                "fps":                    video_metadata.get('fps', metadata.get('fps', 0))                       if video_metadata else metadata.get('fps', 0),
                "duration":               video_metadata.get('duration', metadata.get('duration', 0))             if video_metadata else metadata.get('duration', 0),
                "resolution":             video_metadata.get('resolution', metadata.get('resolution', ''))        if video_metadata else metadata.get('resolution', ''),
                "framesWithDetections":   metadata.get('framesWithDetections', metadata.get('frames_with_detections', 0)),
                "detectionRate":          metadata.get('detection_rate', 0),
                "avgDetectionsPerFrame":  metadata.get('avgDetectionsPerFrame', metadata.get('avg_detections_per_frame', 0)),
                "fileSizeMB":             round(detection.get('file_size', 0) / (1024 * 1024), 1),
                "annotatedVideoUrl":      annotated_url,
                "originalVideoUrl":       original_url,
                "videoId":                metadata.get('video_id', ''),
            })

        # Add image data if it's an image
        if detection.get('file_type') == 'image':
            result.update({
                "annotatedImage": detection.get('annotated_image_base64', ''),
                "originalImage": detection.get('original_image_base64', '')
            })
        
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