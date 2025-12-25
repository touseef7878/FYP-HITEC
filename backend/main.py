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
        print(f"✅ Model loaded from {WEIGHTS_PATH}")
    else:
        print(f"⚠️ No weights found at {WEIGHTS_PATH}")
        print("Please place your YOLO weights file at: backend/weights/best.pt")

@app.on_event("startup")
async def startup():
    load_model()

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "weights_path": WEIGHTS_PATH
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
async def detect_video(file: UploadFile = File(...), confidence: float = 0.25, sample_rate: int = 30):
    """Process video file - samples every N frames"""
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please place your weights at backend/weights/best.pt"
        )
    
    try:
        # Save uploaded video temporarily
        temp_path = f"/tmp/{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(await file.read())
        
        cap = cv2.VideoCapture(temp_path)
        all_detections = []
        frame_count = 0
        processed_frames = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Sample every N frames
            if frame_count % sample_rate == 0:
                results = model(frame, conf=confidence)[0]
                
                for box in results.boxes:
                    class_id = int(box.cls[0])
                    class_name = results.names[class_id]
                    conf = float(box.conf[0])
                    
                    all_detections.append({
                        "frame": frame_count,
                        "class": class_name,
                        "confidence": round(conf * 100, 1)
                    })
                
                processed_frames += 1
            
            frame_count += 1
        
        cap.release()
        os.remove(temp_path)
        
        # Aggregate results
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
        
        return JSONResponse({
            "success": True,
            "filename": file.filename,
            "totalFrames": frame_count,
            "processedFrames": processed_frames,
            "totalDetections": len(all_detections),
            "summary": summary
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
