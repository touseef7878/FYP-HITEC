# 🎬 Video Detection Guide

## Overview

The Marine Plastic Detection platform now supports **frame-by-frame video detection** using YOLOv12n model. This feature processes videos to detect marine plastic debris and other objects in real-time, providing detailed analytics and annotated output videos.

## ✨ Features

### 🎯 Real-time Frame Processing
- **Frame-by-frame detection**: Each video frame is processed individually
- **Real-time annotations**: Bounding boxes and labels are drawn on each frame
- **Progress tracking**: Live progress updates during processing
- **Error handling**: Robust error handling for corrupted frames

### 📊 Enhanced Analytics
- **Detection statistics**: Total detections, frames with detections, detection rate
- **Class distribution**: Count and confidence for each detected class
- **Temporal analysis**: Frame-by-frame detection timeline
- **Performance metrics**: Processing speed, file size, resolution info

### 🎥 Video Output
- **Annotated videos**: Output videos with bounding boxes and labels
- **Frame overlays**: Frame numbers and detection counts on each frame
- **High-quality output**: Maintains original video quality and framerate
- **Multiple formats**: Supports MP4, AVI, MOV input formats

## 🚀 How to Use

### 1. Start the Backend Server
```bash
cd backend
python main.py
```

### 2. Upload Video via Frontend
1. Navigate to the Upload page
2. Drag & drop or select video files
3. Adjust confidence threshold (10-90%)
4. Click "Start Detection"

### 3. Monitor Processing
- Real-time progress updates
- Processing logs with detailed information
- Estimated completion time
- Frame-by-frame processing status

### 4. View Results
- Annotated video with detections
- Detailed statistics and analytics
- Frame-by-frame detection data
- Download processed videos

## 🔧 Technical Details

### Supported Video Formats
- **Input**: MP4, AVI, MOV, WMV, FLV
- **Output**: MP4 (H.264 codec)
- **Max file size**: No hard limit (memory dependent)
- **Resolution**: Any resolution supported by OpenCV

### Detection Classes
The model detects 22 marine-specific classes:
- **Animals**: crab, eel, fish, shells, starfish
- **Plants**: marine vegetation
- **Trash**: bags, bottles, containers, nets, ropes, etc.
- **Equipment**: ROV (Remotely Operated Vehicle)

### Processing Pipeline
1. **Video Upload**: Secure file upload with validation
2. **Frame Extraction**: OpenCV-based frame extraction
3. **YOLO Inference**: YOLOv12n model inference on each frame
4. **Annotation**: Bounding box and label drawing
5. **Video Assembly**: Reassemble frames into output video
6. **Result Generation**: Comprehensive analytics and metadata

## 📈 Performance Metrics

### Processing Speed
- **Typical speed**: 2-5 seconds per video second
- **Factors affecting speed**: Resolution, frame rate, detection density
- **Hardware dependent**: GPU acceleration recommended

### Memory Usage
- **RAM requirement**: ~2-4GB for typical videos
- **Temporary storage**: 2x video file size during processing
- **Output size**: Similar to input size (slightly larger due to annotations)

## 🛠️ API Endpoints

### POST `/detect-video`
Process video for object detection

**Parameters:**
- `file`: Video file (multipart/form-data)
- `confidence`: Detection confidence threshold (0.01-1.0)

**Response:**
```json
{
  "success": true,
  "filename": "video.mp4",
  "totalDetections": 45,
  "totalFrames": 300,
  "processedFrames": 300,
  "framesWithDetections": 120,
  "detectionRate": 40.0,
  "avgDetectionsPerFrame": 0.15,
  "fps": 30,
  "duration": 10.0,
  "resolution": "1920x1080",
  "fileSizeMB": 25.6,
  "detections": [...],
  "summary": [...],
  "annotatedVideoUrl": "/processed-video/processed_uuid.mp4",
  "videoId": "uuid",
  "processingStats": {...}
}
```

### GET `/processed-video/{filename}`
Download processed video files

## 🔍 Troubleshooting

### Common Issues

#### 1. "Model not loaded" Error
**Solution**: Ensure YOLO weights are in `backend/weights/best.pt`

#### 2. "Could not open video file" Error
**Solutions**:
- Check video format compatibility
- Ensure file is not corrupted
- Try converting to MP4 format

#### 3. Processing Takes Too Long
**Solutions**:
- Reduce video resolution
- Lower frame rate
- Increase confidence threshold
- Use shorter video clips for testing

#### 4. Out of Memory Error
**Solutions**:
- Close other applications
- Use smaller video files
- Reduce video resolution
- Restart the backend server

### Performance Optimization

#### For Better Speed:
- Use GPU acceleration (CUDA)
- Reduce video resolution
- Increase confidence threshold
- Use shorter video segments

#### For Better Accuracy:
- Use higher resolution videos
- Lower confidence threshold
- Ensure good lighting in videos
- Use stable camera footage

## 📝 Example Usage

### Python API Client
```python
import requests

# Upload and process video
with open('marine_video.mp4', 'rb') as video_file:
    files = {'file': ('marine_video.mp4', video_file, 'video/mp4')}
    params = {'confidence': 0.25}
    
    response = requests.post(
        'http://localhost:8000/detect-video',
        files=files,
        params=params
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"Detected {result['totalDetections']} objects")
        print(f"Processed {result['totalFrames']} frames")
        print(f"Detection rate: {result['detectionRate']}%")
    else:
        print(f"Error: {response.text}")
```

### JavaScript/Frontend
```javascript
const formData = new FormData();
formData.append('file', videoFile);

const response = await fetch(
  'http://localhost:8000/detect-video?confidence=0.25',
  {
    method: 'POST',
    body: formData
  }
);

const result = await response.json();
console.log('Detection results:', result);
```

## 🎯 Best Practices

### Video Quality
- **Resolution**: 720p or higher recommended
- **Frame rate**: 15-30 FPS optimal
- **Lighting**: Good lighting conditions
- **Stability**: Stable camera footage preferred

### Detection Settings
- **Confidence**: Start with 0.25, adjust based on results
- **File size**: Keep under 100MB for faster processing
- **Duration**: 10-60 seconds for testing, longer for production

### Workflow
1. Test with short clips first
2. Adjust confidence threshold based on results
3. Process longer videos once settings are optimized
4. Review results and download annotated videos
5. Use analytics for insights and reporting

## 🔮 Future Enhancements

- **Real-time streaming**: Live video stream processing
- **Batch processing**: Multiple video processing
- **Custom models**: Support for custom YOLO models
- **Cloud processing**: Distributed video processing
- **Advanced analytics**: Temporal tracking, object trajectories
- **Export formats**: Multiple output video formats

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend logs for detailed error messages
3. Ensure all dependencies are installed correctly
4. Test with sample videos first

---

**Note**: This feature requires a properly trained YOLO model with marine-specific classes. The provided `best.pt` model is optimized for marine plastic detection scenarios.