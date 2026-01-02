#!/bin/bash
# Startup script for refactored marine pollution prediction system

echo "Starting Marine Pollution Prediction System (Refactored)"
echo "============================================================"

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Install/update dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create directories
echo "Creating directories..."
mkdir -p data_cache models processed_videos

# Start the server
echo "Starting FastAPI server..."
echo "Server will be available at: http://localhost:8000"
echo "API documentation: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python main.py
