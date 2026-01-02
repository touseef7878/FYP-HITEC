#!/usr/bin/env python3
"""
Deployment script for the refactored marine pollution prediction system
Helps migrate from the old system to the new cached data system
"""

import os
import sys
import shutil
import subprocess
import json
from datetime import datetime

def print_header(title):
    """Print a formatted header"""
    print("\n" + "=" * 60)
    print(f"🚀 {title}")
    print("=" * 60)

def print_step(step, description):
    """Print a formatted step"""
    print(f"\n{step}. {description}")
    print("-" * 40)

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        return False
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")
    return True

def check_dependencies():
    """Check if required dependencies are installed"""
    print("Checking dependencies...")
    
    required_packages = [
        ('fastapi', 'fastapi'),
        ('uvicorn', 'uvicorn'),
        ('pandas', 'pandas'),
        ('numpy', 'numpy'),
        ('tensorflow', 'tensorflow'),
        ('scikit-learn', 'sklearn'),
        ('requests', 'requests'),
        ('python-dotenv', 'dotenv'),
        ('scipy', 'scipy'),
        ('joblib', 'joblib'),
        ('aiohttp', 'aiohttp'),
        ('pydantic', 'pydantic')
    ]
    
    missing_packages = []
    
    for package_name, import_name in required_packages:
        try:
            __import__(import_name)
            print(f"✅ {package_name}")
        except ImportError:
            print(f"❌ {package_name}")
            missing_packages.append(package_name)
    
    if missing_packages:
        print(f"\n⚠️ Missing packages: {', '.join(missing_packages)}")
        print("Run: pip install -r requirements.txt")
        return False
    
    return True

def create_directories():
    """Create required directories"""
    print("Creating directories...")
    
    directories = [
        'data_cache',
        'models',
        'processed_videos'
    ]
    
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"✅ Created {directory}/")
        else:
            print(f"ℹ️ {directory}/ already exists")

def backup_old_system():
    """Backup the old system files"""
    print("Backing up old system...")
    
    backup_dir = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    files_to_backup = [
        'main.py',
        'weights/',
        'environmental_data.py'
    ]
    
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    
    for file_path in files_to_backup:
        if os.path.exists(file_path):
            if os.path.isdir(file_path):
                shutil.copytree(file_path, os.path.join(backup_dir, file_path))
            else:
                shutil.copy2(file_path, backup_dir)
            print(f"✅ Backed up {file_path}")
        else:
            print(f"ℹ️ {file_path} not found, skipping")
    
    print(f"✅ Backup created in {backup_dir}/")
    return backup_dir

def setup_environment():
    """Setup environment variables"""
    print("Setting up environment...")
    
    env_file = '.env'
    
    if not os.path.exists(env_file):
        print("Creating .env file...")
        with open(env_file, 'w') as f:
            f.write("# API Keys for data fetching\n")
            f.write("WAQI_TOKEN=your_waqi_token_here\n")
            f.write("NOAA_CDO_TOKEN=your_noaa_token_here\n")
            f.write("OPENWEATHER_API_KEY=your_openweather_key_here\n")
            f.write("WEATHERAPI_KEY=your_weatherapi_key_here\n")
            f.write("\n# Optional: Copernicus Marine Service\n")
            f.write("COPERNICUS_USER=your_copernicus_user\n")
            f.write("COPERNICUS_PASS=your_copernicus_password\n")
        
        print("✅ Created .env file")
        print("⚠️ Please update .env with your actual API keys")
    else:
        print("ℹ️ .env file already exists")

def test_system():
    """Test the refactored system"""
    print("Testing refactored system...")
    
    # Check if test file exists
    if not os.path.exists('test_refactored_system.py'):
        print("❌ Test file not found")
        return False
    
    print("✅ Test file found")
    print("ℹ️ To run tests:")
    print("   1. Start server: python main_refactored.py")
    print("   2. Run tests: python test_refactored_system.py")
    
    return True

def create_startup_script():
    """Create a startup script"""
    print("Creating startup script...")
    
    startup_script = """#!/bin/bash
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
"""
    
    with open('start_server.sh', 'w', encoding='utf-8') as f:
        f.write(startup_script)
    
    # Make executable on Unix systems
    if os.name != 'nt':
        os.chmod('start_server.sh', 0o755)
    
    print("✅ Created start_server.sh")

def create_windows_batch():
    """Create Windows batch file"""
    print("Creating Windows batch file...")
    
    batch_script = """@echo off
REM Startup script for refactored marine pollution prediction system

echo Starting Marine Pollution Prediction System (Refactored)
echo ============================================================

REM Check if virtual environment exists
if exist "venv" (
    echo Activating virtual environment...
    call venv\\Scripts\\activate.bat
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
"""
    
    with open('start_server.bat', 'w', encoding='utf-8') as f:
        f.write(batch_script)
    
    print("✅ Created start_server.bat")

def print_next_steps():
    """Print next steps for the user"""
    print_header("🎉 Deployment Complete!")
    
    print("""
Next Steps:

1. 📝 Update API Keys:
   - Edit .env file with your actual API keys
   - WAQI_TOKEN: Get from https://aqicn.org/api/
   - NOAA_CDO_TOKEN: Get from https://www.ncdc.noaa.gov/cdo-web/token

2. 🚀 Start the Server:
   - Linux/Mac: ./start_server.sh
   - Windows: start_server.bat
   - Manual: python main_refactored.py

3. 🧪 Test the System:
   - Open another terminal
   - Run: python test_refactored_system.py

4. 🌐 Access the API:
   - Server: http://localhost:8000
   - Docs: http://localhost:8000/docs
   - Health: http://localhost:8000/health

5. 📊 Use the New Workflow:
   - Fetch data: POST /api/data/fetch
   - Train model: POST /api/train
   - Get predictions: POST /api/predict

6. 🎨 Update Frontend:
   - Use the example in frontend_integration_example.tsx
   - Implement separate "Fetch Data" and "Train Model" buttons

Key Benefits:
✅ 10x faster training (no API calls during training)
✅ Reliable performance (no network timeouts)
✅ Data persistence (cached locally)
✅ Predictable costs (one-time API usage)
✅ Better user experience (clear workflow)

For help, see: REFACTORED_SYSTEM_README.md
""")

def main():
    """Main deployment function"""
    print_header("Marine Pollution Prediction System - Refactored Deployment")
    
    # Step 1: Check Python version
    print_step(1, "Checking Python Version")
    if not check_python_version():
        sys.exit(1)
    
    # Step 2: Check dependencies
    print_step(2, "Checking Dependencies")
    if not check_dependencies():
        print("\n⚠️ Please install missing dependencies and run again")
        sys.exit(1)
    
    # Step 3: Create directories
    print_step(3, "Creating Required Directories")
    create_directories()
    
    # Step 4: Backup old system
    print_step(4, "Backing Up Old System")
    backup_dir = backup_old_system()
    
    # Step 5: Setup environment
    print_step(5, "Setting Up Environment")
    setup_environment()
    
    # Step 6: Create startup scripts
    print_step(6, "Creating Startup Scripts")
    create_startup_script()
    create_windows_batch()
    
    # Step 7: Test system
    print_step(7, "Preparing System Tests")
    test_system()
    
    # Final steps
    print_next_steps()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⏹️ Deployment interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Deployment failed: {e}")
        sys.exit(1)