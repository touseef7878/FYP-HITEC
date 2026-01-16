# 🔌 API Documentation

Complete API reference for the Marine Detection System backend.

## Base URL

```
http://localhost:8000
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## 🔐 Authentication Endpoints

### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "full_name": "string" (optional)
}
```

**Response:**
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "string",
    "email": "string",
    "role": "USER"
  }
}
```

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "string",
    "role": "USER"
  }
}
```

### Get Current User
```http
GET /api/auth/me
```

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": 1,
  "username": "string",
  "email": "string",
  "role": "USER",
  "created_at": "2024-01-01T00:00:00"
}
```

---

## 🎯 Detection Endpoints

### Detect Objects in Image
```http
POST /detect?confidence=0.25
```

**Headers:** `Authorization: Bearer <token>`

**Request:** `multipart/form-data`
- `file`: Image file (JPG, PNG, etc.)

**Query Parameters:**
- `confidence`: Detection threshold (0.01-1.0, default: 0.25)

**Response:**
```json
{
  "success": true,
  "filename": "image.jpg",
  "detections": [
    {
      "class": "plastic_bottle",
      "confidence": 0.85,
      "bbox": [x1, y1, x2, y2]
    }
  ],
  "annotated_image": "base64_encoded_image",
  "detection_id": 123
}
```

### Detect Objects in Video
```http
POST /detect-video?confidence=0.25
```

**Headers:** `Authorization: Bearer <token>`

**Request:** `multipart/form-data`
- `file`: Video file (MP4, AVI, MOV)

**Query Parameters:**
- `confidence`: Detection threshold (0.01-1.0, default: 0.25)

**Response:**
```json
{
  "success": true,
  "filename": "video.mp4",
  "totalDetections": 45,
  "totalFrames": 300,
  "framesWithDetections": 120,
  "detectionRate": 40.0,
  "annotatedVideoUrl": "/processed-video/processed_uuid.mp4",
  "videoId": "uuid"
}
```

---

## 📊 Analytics Endpoints

### Get User Analytics
```http
GET /api/analytics?days=30
```

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `days`: Number of days to analyze (default: 30)

**Response:**
```json
{
  "success": true,
  "analytics": {
    "stats": {
      "totalDetections": 150,
      "totalImages": 45,
      "totalVideos": 5,
      "avgConfidence": 0.78
    },
    "classDistribution": {
      "plastic_bottle": 45,
      "plastic_bag": 30
    },
    "timeline": [...]
  }
}
```

---

## 📚 History Endpoints

### Get Detection History
```http
GET /api/history?limit=50&offset=0
```

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": 123,
      "filename": "image.jpg",
      "detection_count": 5,
      "timestamp": "2024-01-01T00:00:00",
      "file_type": "image"
    }
  ],
  "total": 150
}
```

### Delete Detection
```http
DELETE /api/user/detections/{detection_id}
```

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Detection deleted successfully"
}
```

---

## 🔮 LSTM Prediction Endpoints

### Get Available Regions
```http
GET /api/data/regions
```

**Response:**
```json
{
  "success": true,
  "regions": [
    {
      "id": "pacific",
      "name": "Pacific Ocean",
      "dataset_cached": true
    }
  ]
}
```

### Fetch Environmental Data
```http
POST /api/data/fetch
```

**Request Body:**
```json
{
  "region": "pacific"
}
```

**Response:**
```json
{
  "success": true,
  "message": "data_fetched_successfully",
  "region": "pacific",
  "dataset_info": {
    "total_records": 730,
    "date_range": "2022-01-01 to 2024-01-01"
  }
}
```

### Train LSTM Model
```http
POST /api/train
```

**Request Body:**
```json
{
  "region": "pacific",
  "epochs": 50
}
```

**Response:**
```json
{
  "success": true,
  "message": "training_completed",
  "training_result": {
    "epochs_trained": 50,
    "validation_mae": 5.2,
    "training_time_seconds": 120
  }
}
```

### Generate Predictions
```http
POST /api/predict
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "region": "pacific",
  "days_ahead": 7
}
```

**Response:**
```json
{
  "success": true,
  "region": "pacific",
  "predictions": [
    {
      "date": "2024-01-08",
      "pollution_level": 65.5,
      "confidence": 0.92
    }
  ],
  "summary": {
    "current_level": 60.0,
    "predicted_level": 65.5,
    "trend_change_percent": 9.2,
    "risk_level": "Moderate"
  }
}
```

---

## 📄 Report Endpoints

### Generate Report
```http
POST /api/reports/generate
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Monthly Detection Report",
  "report_type": "detection",
  "date_range_days": 30
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "id": 456,
    "title": "Monthly Detection Report",
    "created_at": "2024-01-01T00:00:00",
    "data": {
      "detection_analytics": {...},
      "summary": {...}
    }
  }
}
```

### Get User Reports
```http
GET /api/reports
```

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "reports": [
    {
      "id": 456,
      "title": "Monthly Detection Report",
      "report_type": "detection",
      "created_at": "2024-01-01T00:00:00"
    }
  ]
}
```

---

## 👑 Admin Endpoints

### Get System Statistics
```http
GET /api/admin/stats
```

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_users": 50,
    "total_detections": 1500,
    "storage_used_mb": 250,
    "uptime_hours": 720
  }
}
```

### Get All Users
```http
GET /api/admin/users
```

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "user1",
      "email": "user1@example.com",
      "role": "USER",
      "is_active": true
    }
  ]
}
```

### System Maintenance
```http
POST /api/admin/system/{action}
```

**Headers:** `Authorization: Bearer <admin_token>`

**Actions:** `backup`, `clear_cache`, `optimize_db`

**Response:**
```json
{
  "success": true,
  "message": "Action completed successfully"
}
```

---

## 🏥 Health Check

### Server Health
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "yolo_model_loaded": true,
  "model_info": {
    "loaded": true,
    "num_classes": 22
  }
}
```

---

## Error Responses

All endpoints may return error responses in this format:

```json
{
  "detail": "Error message description"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

---

## Rate Limiting

Currently no rate limiting is implemented. For production deployment, consider implementing rate limiting based on your requirements.

## CORS

CORS is configured to allow requests from:
- `http://localhost:5173`
- `http://localhost:3000`
- `http://localhost:8080`

For production, update CORS settings in `backend/main.py`.
