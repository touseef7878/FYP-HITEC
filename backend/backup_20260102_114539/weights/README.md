# YOLO Model Weights

Place your trained YOLO model weights here.

## Required File
- `best.pt` - Your trained YOLO model weights

## How to Add Your Model

1. Copy your trained model file to this directory:
   ```bash
   cp /path/to/your/best.pt backend/weights/best.pt
   ```

2. The backend will automatically load the model on startup

## Supported Formats
- PyTorch (.pt) files from YOLOv8/YOLOv5 training
- The model should be trained for marine plastic detection

## Model Requirements
Your model should detect classes like:
- Plastic Bottle
- Plastic Bag  
- Fishing Net
- Styrofoam
- Plastic Cap
- Other marine debris types

## Troubleshooting
- Ensure the file is named exactly `best.pt`
- Check the backend logs for model loading status
- Verify your model was trained with Ultralytics YOLO format