#!/usr/bin/env python3
"""
Training script for LSTM Marine Pollution Prediction Model
Run this to train the initial LSTM model
"""

import sys
import os
import logging
from lstm_model import lstm_model
from environmental_data import environmental_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Train the LSTM model for marine pollution prediction"""
    
    print("🌊 Marine Pollution LSTM Model Training")
    print("=" * 50)
    
    try:
        # Check if model already exists
        if lstm_model.load_model():
            print("✅ Existing LSTM model found")
            response = input("Do you want to retrain the model? (y/N): ").lower().strip()
            if response != 'y':
                print("Using existing model. Training cancelled.")
                return
        
        print("🔄 Starting LSTM model training...")
        print("This may take several minutes...")
        
        # Train the model
        areas = ['pacific', 'atlantic', 'indian', 'mediterranean']
        epochs = 50
        
        print(f"Training areas: {areas}")
        print(f"Training epochs: {epochs}")
        
        metrics = lstm_model.train(areas=areas, epochs=epochs)
        
        print("\n🎉 Training completed successfully!")
        print(f"Training Metrics:")
        print(f"  - Validation MSE: {metrics['val_mse']:.4f}")
        print(f"  - Validation MAE: {metrics['val_mae']:.4f}")
        print(f"  - Model Accuracy: {metrics['accuracy']:.2%}")
        print(f"  - Areas Trained: {', '.join(metrics['areas_trained'])}")
        
        # Test predictions
        print("\n🧪 Testing predictions...")
        for area in areas[:2]:  # Test first 2 areas
            try:
                prediction = lstm_model.predict_trends(area, days_ahead=7)
                print(f"  - {area.title()}: {prediction['trend_change_percent']:+.1f}% trend, "
                      f"{prediction['risk_level']} risk")
            except Exception as e:
                print(f"  - {area.title()}: Error testing - {e}")
        
        print(f"\n✅ LSTM model ready for use!")
        print(f"Model files saved to:")
        print(f"  - {lstm_model.model_path}")
        print(f"  - {lstm_model.scaler_path}")
        
    except KeyboardInterrupt:
        print("\n⚠️ Training interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        logger.error(f"Training error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()