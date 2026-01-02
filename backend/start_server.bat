@echo off
REM Startup script for refactored marine pollution prediction system

echo Starting Marine Pollution Prediction System (Refactored)
echo ============================================================

REM Check if virtual environment exists
if exist "venv" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
)

REM Install/update dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Create directories
echo Creating directories...
if not exist "data_cache" mkdir data_cache
if not exist "models" mkdir models
if not exist "processed_videos" mkdir processed_videos

REM Start the server
echo Starting FastAPI server...
echo Server will be available at: http://localhost:8000
echo API documentation: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

python main.py
pause
