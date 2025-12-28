from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
from PIL import Image
import cv2
import numpy as np
import base64
import io
import os
import logging
from datetime import datetime
from typing import Optional, List
from dotenv import load_dotenv
import tempfile
import uuid

# Load environment variables
load_dotenv()

# Import LSTM components
from lstm_model import lstm_model
from environmental_data import environmental_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Marine Plastic Detection API")

# CORS - allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def load_model():
    global model
    if os.path.exists(WEIGHTS_PATH):
        model = YOLO(WEIGHTS_PATH)
        print(f"✅ YOLO Model loaded from {WEIGHTS_PATH}")
    else:
        print(f"⚠️ No YOLO weights found at {WEIGHTS_PATH}")
        print("Please place your YOLO weights file at: backend/weights/best.pt")

def load_lstm_model():
    """Load LSTM model for pollution prediction (no auto-training)"""
    try:
        if lstm_model.load_model():
            logger.info("✅ LSTM model loaded successfully")
        else:
            logger.info("⚠️ LSTM model not found. Use /lstm/retrain endpoint to train a new model.")
    except Exception as e:
        logger.error(f"Error with LSTM model: {e}")

@app.on_event("startup")
async def startup():
    load_model()
    load_lstm_model()

@app.get("/health")
async def health_check():
    lstm_info = lstm_model.get_model_info()
    return {
        "status": "healthy",
        "yolo_model_loaded": model is not None,
        "lstm_model_loaded": lstm_info['status'] == 'loaded',
        "weights_path": WEIGHTS_PATH,
        "lstm_info": lstm_info
    }

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

@app.post("/detect-video")
async def detect_video(file: UploadFile = File(...), confidence: float = 0.25, sample_rate: int = 1):
    """Process video file with frame-by-frame detection and return annotated video"""
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please place your weights at backend/weights/best.pt"
        )
    
    try:
        # Create unique temporary file paths
        unique_id = str(uuid.uuid4())
        temp_input_path = os.path.join(tempfile.gettempdir(), f"input_{unique_id}.mp4")
        temp_output_path = os.path.join(tempfile.gettempdir(), f"output_{unique_id}.mp4")
        
        # Create output directory for processed videos
        output_dir = os.path.join(os.path.dirname(__file__), "processed_videos")
        os.makedirs(output_dir, exist_ok=True)
        
        # Final output path for serving
        final_output_filename = f"processed_{unique_id}.mp4"
        final_output_path = os.path.join(output_dir, final_output_filename)
        
        # Save uploaded video
        contents = await file.read()
        with open(temp_input_path, "wb") as f:
            f.write(contents)
        
        # Open video capture
        cap = cv2.VideoCapture(temp_input_path)
        
        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Setup video writer for output
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_output_path, fourcc, fps, (width, height))
        
        all_detections = []
        frame_count = 0
        processed_frames = 0
        
        # Generate consistent colors for each class
        colors = {}
        
        logger.info(f"Processing video: {width}x{height}, {fps} FPS, {total_frames} frames")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process every frame (or sample based on sample_rate)
            if frame_count % sample_rate == 0:
                # Run YOLO inference on frame
                results = model(frame, conf=confidence)[0]
                
                # Create annotated frame
                annotated_frame = frame.copy()
                
                # Process detections for this frame
                frame_detections = []
                
                for box in results.boxes:
                    class_id = int(box.cls[0])
                    class_name = results.names[class_id]
                    conf = float(box.conf[0])
                    bbox = box.xyxy[0].tolist()
                    
                    # Store detection info
                    detection_info = {
                        "frame": frame_count,
                        "class": class_name,
                        "confidence": round(conf * 100, 1),
                        "bbox": {
                            "x1": int(bbox[0]),
                            "y1": int(bbox[1]),
                            "x2": int(bbox[2]),
                            "y2": int(bbox[3])
                        }
                    }
                    
                    all_detections.append(detection_info)
                    frame_detections.append(detection_info)
                    
                    # Generate consistent color for each class
                    if class_name not in colors:
                        hash_val = hash(class_name)
                        colors[class_name] = (
                            (hash_val & 0xFF),
                            ((hash_val >> 8) & 0xFF),
                            ((hash_val >> 16) & 0xFF)
                        )
                    
                    color = colors[class_name]
                    
                    # Draw bounding box
                    cv2.rectangle(
                        annotated_frame,
                        (detection_info["bbox"]["x1"], detection_info["bbox"]["y1"]),
                        (detection_info["bbox"]["x2"], detection_info["bbox"]["y2"]),
                        color,
                        2
                    )
                    
                    # Draw label background
                    label = f"{class_name} {detection_info['confidence']}%"
                    (label_w, label_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                    
                    cv2.rectangle(
                        annotated_frame,
                        (detection_info["bbox"]["x1"], detection_info["bbox"]["y1"] - label_h - 10),
                        (detection_info["bbox"]["x1"] + label_w + 10, detection_info["bbox"]["y1"]),
                        color,
                        -1
                    )
                    
                    # Draw label text
                    cv2.putText(
                        annotated_frame,
                        label,
                        (detection_info["bbox"]["x1"] + 5, detection_info["bbox"]["y1"] - 5),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (255, 255, 255),
                        2
                    )
                
                # Add frame info overlay
                frame_info = f"Frame: {frame_count}/{total_frames} | Detections: {len(frame_detections)}"
                cv2.putText(
                    annotated_frame,
                    frame_info,
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )
                
                processed_frames += 1
            else:
                # For non-processed frames, just copy the original
                annotated_frame = frame.copy()
            
            # Write frame to output video
            out.write(annotated_frame)
            frame_count += 1
        
        # Release resources
        cap.release()
        out.release()
        
        # Move processed video to final location
        import shutil
        shutil.move(temp_output_path, final_output_path)
        
        # Clean up temporary input file
        os.remove(temp_input_path)
        
        # Aggregate detection statistics
        class_counts = {}
        for det in all_detections:
            class_name = det["class"]
            if class_name not in class_counts:
                class_counts[class_name] = {"count": 0, "total_confidence": 0}
            class_counts[class_name]["count"] += 1
            class_counts[class_name]["total_confidence"] += det["confidence"]
        
        summary = []
        for class_name, data in class_counts.items():
            avg_conf = data["total_confidence"] / data["count"] if data["count"] > 0 else 0
            summary.append({
                "class": class_name,
                "count": data["count"],
                "avgConfidence": round(avg_conf, 1)
            })
        
        summary.sort(key=lambda x: x["count"], reverse=True)
        
        logger.info(f"Video processing complete: {processed_frames} frames processed, {len(all_detections)} detections")
        
        return JSONResponse({
            "success": True,
            "filename": file.filename,
            "totalFrames": total_frames,
            "processedFrames": processed_frames,
            "totalDetections": len(all_detections),
            "fps": fps,
            "duration": round(total_frames / fps, 2),
            "resolution": f"{width}x{height}",
            "detections": all_detections,
            "summary": summary,
            "annotatedVideoUrl": f"/processed-video/{final_output_filename}",
            "originalVideoUrl": None  # We don't store original for space reasons
        })
        
    except Exception as e:
        logger.error(f"Video processing error: {e}")
        # Clean up any remaining temp files
        try:
            if 'temp_input_path' in locals() and os.path.exists(temp_input_path):
                os.remove(temp_input_path)
            if 'temp_output_path' in locals() and os.path.exists(temp_output_path):
                os.remove(temp_output_path)
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))

# LSTM Prediction Endpoints

@app.get("/lstm/info")
async def get_lstm_info():
    """Get LSTM model information and status"""
    return lstm_model.get_model_info()

@app.post("/lstm/predict")
async def predict_pollution_trends(
    area: str,
    days_ahead: int = 30
):
    """
    Predict pollution trends for a specific marine area
    
    Args:
        area: Marine area ('pacific', 'atlantic', 'indian', 'mediterranean')
        days_ahead: Number of days to predict (default: 30)
    """
    try:
        if lstm_model.model is None:
            raise HTTPException(
                status_code=503,
                detail="LSTM model not loaded. Please wait for model initialization."
            )
        
        # Validate area
        valid_areas = ['pacific', 'atlantic', 'indian', 'mediterranean']
        if area not in valid_areas:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid area. Must be one of: {valid_areas}"
            )
        
        # Validate days_ahead
        if not 1 <= days_ahead <= 90:
            raise HTTPException(
                status_code=400,
                detail="days_ahead must be between 1 and 90"
            )
        
        # Get predictions
        predictions = lstm_model.predict_trends(area, days_ahead)
        
        return JSONResponse({
            "success": True,
            "area": area,
            "forecast_days": days_ahead,
            "predictions": predictions,
            "model_info": {
                "type": "LSTM",
                "confidence": predictions["confidence"],
                "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        })
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/lstm/areas")
async def get_supported_areas():
    """Get list of supported marine areas for prediction"""
    return {
        "areas": [
            {
                "id": "pacific",
                "name": "Pacific Ocean",
                "description": "North Pacific region including Great Pacific Garbage Patch"
            },
            {
                "id": "atlantic", 
                "name": "Atlantic Ocean",
                "description": "North Atlantic marine region"
            },
            {
                "id": "indian",
                "name": "Indian Ocean", 
                "description": "Indian Ocean marine region"
            },
            {
                "id": "mediterranean",
                "name": "Mediterranean Sea",
                "description": "Mediterranean marine region"
            }
        ]
    }

@app.post("/lstm/analyze")
async def analyze_area_pollution(
    area: str,
    historical_days: int = 365
):
    """
    Analyze historical pollution patterns for an area
    
    Args:
        area: Marine area to analyze
        historical_days: Days of historical data to analyze (default: 365)
    """
    try:
        if area not in ['pacific', 'atlantic', 'indian', 'mediterranean']:
            raise HTTPException(
                status_code=400,
                detail="Invalid area specified"
            )
        
        # Get historical environmental data
        historical_data = environmental_service.get_historical_pollution_data(area, historical_days)
        
        if historical_data.empty:
            raise HTTPException(
                status_code=500,
                detail="Unable to retrieve historical data"
            )
        
        # Calculate statistics
        avg_pollution = float(historical_data['pollution_density'].mean())
        max_pollution = float(historical_data['pollution_density'].max())
        min_pollution = float(historical_data['pollution_density'].min())
        trend_slope = float(np.polyfit(range(len(historical_data)), historical_data['pollution_density'], 1)[0])
        
        # Recent vs historical comparison (last 30 days vs rest)
        recent_data = historical_data.tail(30)
        historical_avg = float(historical_data.head(-30)['pollution_density'].mean()) if len(historical_data) > 30 else avg_pollution
        recent_avg = float(recent_data['pollution_density'].mean())
        change_percent = ((recent_avg - historical_avg) / historical_avg) * 100 if historical_avg > 0 else 0
        
        # Environmental correlations
        correlations = {}
        for feature in ['ocean_current_speed', 'water_temperature', 'wind_speed', 'precipitation']:
            if feature in historical_data.columns:
                corr = float(historical_data['pollution_density'].corr(historical_data[feature]))
                correlations[feature] = corr if not np.isnan(corr) else 0.0
        
        return JSONResponse({
            "success": True,
            "area": area,
            "analysis_period_days": historical_days,
            "statistics": {
                "average_pollution": round(avg_pollution, 2),
                "max_pollution": round(max_pollution, 2),
                "min_pollution": round(min_pollution, 2),
                "trend_slope": round(trend_slope, 4),
                "recent_change_percent": round(change_percent, 2)
            },
            "environmental_correlations": correlations,
            "risk_assessment": {
                "level": "high" if avg_pollution > 70 else "medium" if avg_pollution > 40 else "low",
                "trend": "increasing" if trend_slope > 0 else "decreasing",
                "recent_trend": "increasing" if change_percent > 5 else "decreasing" if change_percent < -5 else "stable"
            },
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
        
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/lstm/retrain")
async def retrain_lstm_model(
    epochs: int = 50,
    areas: Optional[List[str]] = None
):
    """
    Retrain the LSTM model with updated data
    
    Args:
        epochs: Number of training epochs (default: 50)
        areas: List of areas to train on (default: all areas)
    """
    try:
        if areas is None:
            areas = ['pacific', 'atlantic', 'indian', 'mediterranean']
        
        # Validate areas
        valid_areas = ['pacific', 'atlantic', 'indian', 'mediterranean']
        invalid_areas = [area for area in areas if area not in valid_areas]
        if invalid_areas:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid areas: {invalid_areas}. Valid areas: {valid_areas}"
            )
        
        # Validate epochs
        if not 10 <= epochs <= 200:
            raise HTTPException(
                status_code=400,
                detail="epochs must be between 10 and 200"
            )
        
        logger.info(f"Starting LSTM model retraining for areas: {areas}")
        
        # Retrain model
        metrics = lstm_model.train(areas=areas, epochs=epochs)
        
        return JSONResponse({
            "success": True,
            "message": "Model retrained successfully",
            "training_metrics": metrics,
            "retrained_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
        
    except Exception as e:
        logger.error(f"Retraining error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
