#!/usr/bin/env python3
"""
LSTM Setup Script for OceanScan Marine Pollution Prediction
Installs dependencies and trains the initial LSTM model
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    version = sys.version_info
    if version.major == 3 and version.minor >= 8:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro} (compatible)")
        return True
    else:
        print(f"❌ Python {version.major}.{version.minor} (requires Python 3.8+)")
        return False

def main():
    print("🌊 OceanScan LSTM Setup")
    print("=" * 40)
    
    # Check Python version
    if not check_python_version():
        print("Please upgrade to Python 3.8 or higher")
        sys.exit(1)
    
    # Check if we're in the right directory
    if not os.path.exists("backend/main.py"):
        print("❌ Please run this script from the project root directory")
        sys.exit(1)
    
    print("\n📦 Installing Python dependencies...")
    
    # Install backend dependencies
    if not run_command("cd backend && pip install -r requirements.txt", "Installing backend dependencies"):
        print("Failed to install dependencies. Try running manually:")
        print("cd backend && pip install -r requirements.txt")
        sys.exit(1)
    
    print("\n🧠 Training LSTM model...")
    
    # Train LSTM model
    if not run_command("cd backend && python train_lstm.py", "Training LSTM model"):
        print("LSTM training failed. You can try training manually:")
        print("cd backend && python train_lstm.py")
        sys.exit(1)
    
    print("\n🎉 Setup completed successfully!")
    print("\nNext steps:")
    print("1. Start the backend server:")
    print("   cd backend && python main.py")
    print("\n2. In another terminal, start the frontend:")
    print("   npm install && npm run dev")
    print("\n3. Open http://localhost:5173 and navigate to Predictions page")
    print("\n📊 The LSTM model is now ready for marine pollution prediction!")

if __name__ == "__main__":
    main()