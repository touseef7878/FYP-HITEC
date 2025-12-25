# OceanScan - Setup Guide

This guide will help you set up the complete YOLO model integration with your marine plastic detection application.

## Prerequisites

- Python 3.8+ installed
- Node.js 16+ installed
- Your trained YOLO model weights file (`best.pt`)

## Step 1: Add Your YOLO Model

1. **Create weights folder and add your model:**
   ```bash
   mkdir backend/weights
   cp /path/to/your/best.pt backend/weights/best.pt
   ```

   **Important:** The file must be named exactly `best.pt` and placed in `backend/weights/`

## Step 2: Install Python Dependencies & Run Backend

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the backend server:**
   ```bash
   python main.py
   ```

   The backend will start on `http://localhost:8000`

   **Expected output:**
   ```
   ✅ Model loaded from backend/weights/best.pt
   INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

## Step 3: Run Frontend (in another terminal)

1. **Open a new terminal and navigate to project root**

2. **Install frontend dependencies (if not already done):**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

   The frontend will start on `http://localhost:5173`

## Step 4: Test the Integration

1. **Open your browser and go to:** `http://localhost:5173`

2. **Navigate to the Upload page**

3. **Test backend connection:**
   - Click "Detection Settings" 
   - Click "Test Backend Connection"
   - You should see "✓ Backend connected, model loaded"

4. **Upload an image:**
   - Drag & drop or select an image file
   - Click "Start Detection"
   - View results on the Results page with bounding boxes

## API Endpoints

The backend provides these endpoints:

- `GET /health` - Check backend and model status
- `POST /detect` - Detect objects in images
- `POST /detect-video` - Process video files (samples frames)

## Frontend Features

- **Upload Page:** Connects to `http://localhost:8000`
- **Real-time Processing:** Shows upload progress and logs
- **Results Page:** Displays detection results with bounding boxes
- **Confidence Settings:** Adjustable detection threshold (10-90%)

## Troubleshooting

### Backend Issues

**Model not loading:**
- Ensure `best.pt` is in `backend/weights/` directory
- Check file permissions
- Verify the model was trained with Ultralytics YOLO

**Dependencies missing:**
```bash
cd backend
pip install --upgrade ultralytics fastapi uvicorn python-multipart pillow opencv-python
```

### Frontend Issues

**Backend connection failed:**
- Ensure backend is running on port 8000
- Check firewall settings
- Verify CORS settings in `main.py`

**Upload not working:**
- Check browser console for errors
- Ensure file types are supported (images: PNG, JPG, JPEG; videos: MP4, AVI, MOV)

### Common Error Messages

**"Model not loaded":**
- Add your `best.pt` file to `backend/weights/`
- Restart the backend server

**"Backend not reachable":**
- Start backend with: `cd backend && python main.py`
- Check if port 8000 is available

## Model Requirements

Your YOLO model should:
- Be trained for marine plastic detection
- Output classes like: Plastic Bottle, Plastic Bag, Fishing Net, Styrofoam, etc.
- Be in PyTorch (.pt) format from YOLOv8/YOLOv5 training

## Performance Tips

- **Images:** Optimal size 640x640 pixels
- **Videos:** Use sample_rate parameter to process every Nth frame
- **Confidence:** Start with 25% threshold, adjust based on results
- **Batch Processing:** Upload multiple files for efficient processing

## Next Steps

Once everything is working:
1. Test with your marine plastic images
2. Adjust confidence thresholds for optimal results
3. Use the History page to track detection results
4. Generate reports from the Reports page

## Support

If you encounter issues:
1. Check the backend logs in the terminal
2. Use browser developer tools to check for frontend errors
3. Verify all file paths and permissions
4. Ensure all dependencies are correctly installed