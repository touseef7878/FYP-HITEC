# Marine Plastic Detection Backend

## Quick Setup

### 1. Install Python dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Add your YOLO weights
Place your trained model weights at:
```
backend/weights/best.pt
```

### 3. Run the server
```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and whether model is loaded.

### Detect Objects in Image
```
POST /detect
Content-Type: multipart/form-data
Body: file (image)
Query: confidence (optional, default 0.25)
```

### Detect Objects in Video
```
POST /detect-video
Content-Type: multipart/form-data
Body: file (video)
Query: confidence (optional, default 0.25), sample_rate (optional, default 30)
```

## Directory Structure
```
backend/
├── main.py           # FastAPI server
├── requirements.txt  # Python dependencies
├── README.md         # This file
└── weights/
    └── best.pt       # Your YOLO weights (add this!)
```
