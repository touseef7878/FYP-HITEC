"""
Refactored FastAPI Main Application
Implements data caching with separate fetch and train endpoints
NEVER re-fetches data during training - uses cached datasets only
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
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
from typing import Optional, List
from dotenv import load_dotenv
import tempfile
import uuid
import asyncio
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Import refactored components
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

# Mount processed videos directory
processed_videos_path = os.path.join(os.path.dirname(__file__), "processed_videos")
os.makedirs(processed_videos_path, exist_ok=True)
app.mount("/processed-video", StaticFiles(directory=processed_videos_path), name="processed_videos")

# Favicon endpoint
@app.get("/favicon.ico")
async def favicon():
    favicon_path = os.path.join(os.path.dirname(__file__), "..", "public", "favicon.png")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/png")
    return JSONResponse({"error": "Favicon not found"}, status_code=404)

# Load YOLO model - place your weights in backend/weights/best.pt
WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "weights", "best.pt")
model = None

def load_yolo_model():
    global model
    if os.path.exists(WEIGHTS_PATH):
        model = YOLO(WEIGHTS_PATH)
        logger.info(f"✅ YOLO Model loaded from {WEIGHTS_PATH}")
    else:
        logger.info(f"⚠️ No YOLO weights found at {WEIGHTS_PATH}")

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
    return {
        "status": "healthy",
        "yolo_model_loaded": model is not None,
        "data_cache_ready": True,
        "lstm_model_ready": True,
        "cache_directory": data_cache_service.cache_dir,
        "models_directory": data_cache_service.models_dir
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
async def predict_pollution_trends(request: PredictionRequest):
    """
    Generate pollution predictions using ONLY cached data
    NEVER calls external APIs
    """
    try:
        logger.info(f"🔮 Prediction request for {request.region}, {request.days_ahead} days ahead")
        
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
# YOLO DETECTION ENDPOINTS (UNCHANGED)
# ============================================================================

@app.post("/detect")
async def detect_objects(file: UploadFile = File(...), confidence: float = 0.25):
    if model is None:
        raise HTTPException(
            status_code=503, 
            detail="Model not loaded. Please place your weights at backend/weights/best.pt and restart the server."
        )
    
    try:
        # Read image
        contents = await file.read()
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
        
        return JSONResponse({
            "success": True,
            "filename": file.filename,
            "totalDetections": len(detections),
            "detections": detections,
            "summary": summary,
            "annotatedImage": f"data:image/png;base64,{annotated_base64}",
            "originalImage": f"data:image/{file.content_type.split('/')[-1]};base64,{base64.b64encode(contents).decode()}"
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)