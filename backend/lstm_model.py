"""
Enhanced LSTM Model for Environmental & Marine Time-Series Prediction
Integrates multiple data sources for comprehensive forecasting
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EnvironmentalLSTM:
    """
    Professional LSTM implementation for environmental time-series forecasting
    Supports multi-feature input and multi-step prediction
    """
    
    def __init__(self, model_dir: str = "weights"):
        self.model_dir = model_dir
        self.model_path = os.path.join(model_dir, "lstm_environmental.h5")
        self.scaler_path = os.path.join(model_dir, "feature_scaler.pkl")
        self.target_scaler_path = os.path.join(model_dir, "target_scaler.pkl")
        self.config_path = os.path.join(model_dir, "model_config.json")
        
        # Ensure model directory exists
        os.makedirs(model_dir, exist_ok=True)
        
        # Model components
        self.model = None
        self.feature_scaler = MinMaxScaler()
        self.target_scaler = MinMaxScaler()
        self.config = {
            'sequence_length': 30,  # 30 days of historical data
            'n_features': 8,        # Multiple environmental features
            'lstm_units': [64, 32], # Two LSTM layers
            'dropout_rate': 0.2,
            'learning_rate': 0.001,
            'batch_size': 32,
            'epochs': 100,
            'validation_split': 0.2,
            'feature_names': [
                'temperature', 'humidity', 'pressure', 'wind_speed',
                'aqi', 'pm25', 'ocean_temp', 'pollution_index'
            ],
            'target_name': 'pollution_level',
            'created_at': None,
            'last_trained': None,
            'training_samples': 0,
            'validation_mae': None,
            'validation_rmse': None
        }
        
        # Load existing model if available
        self.load_model()
    
    def create_sequences(self, data: np.ndarray, target: np.ndarray, 
                        sequence_length: int) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create time-series sequences for LSTM training
        
        Args:
            data: Feature data (samples, features)
            target: Target values (samples,)
            sequence_length: Length of input sequences
            
        Returns:
            X: Input sequences (samples, sequence_length, features)
            y: Target values (samples,)
        """
        X, y = [], []
        
        for i in range(sequence_length, len(data)):
            X.append(data[i-sequence_length:i])
            y.append(target[i])
        
        return np.array(X), np.array(y)
    
    def build_model(self) -> Sequential:
        """
        Build LSTM model architecture with best practices
        
        Returns:
            Compiled Keras model
        """
        model = Sequential([
            # First LSTM layer with return sequences
            LSTM(
                self.config['lstm_units'][0],
                return_sequences=True,
                input_shape=(self.config['sequence_length'], self.config['n_features'])
            ),
            Dropout(self.config['dropout_rate']),
            
            # Second LSTM layer
            LSTM(self.config['lstm_units'][1]),
            Dropout(self.config['dropout_rate']),
            
            # Dense output layer
            Dense(1, activation='linear')
        ])
        
        # Compile with Adam optimizer and standard metrics
        model.compile(
            optimizer=Adam(learning_rate=self.config['learning_rate']),
            loss='mean_squared_error',  # Use string instead of function
            metrics=['mean_absolute_error']  # Use string instead of function
        )
        
        return model
    
    def preprocess_data(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Preprocess data for LSTM training
        
        Args:
            df: DataFrame with datetime index and feature columns
            
        Returns:
            X: Scaled feature sequences
            y: Scaled target values
        """
        # Ensure we have all required features
        required_features = self.config['feature_names']
        target_col = self.config['target_name']
        
        # Handle missing features by filling with median values
        for feature in required_features:
            if feature not in df.columns:
                logger.warning(f"Missing feature {feature}, filling with median")
                df[feature] = df[required_features].median().median()
        
        # Extract features and target
        features = df[required_features].values
        target = df[target_col].values
        
        # Handle missing values
        features = pd.DataFrame(features).ffill().bfill().values
        target = pd.Series(target).ffill().bfill().values
        
        # Scale features and target
        features_scaled = self.feature_scaler.fit_transform(features)
        target_scaled = self.target_scaler.fit_transform(target.reshape(-1, 1)).flatten()
        
        # Create sequences
        X, y = self.create_sequences(
            features_scaled, 
            target_scaled, 
            self.config['sequence_length']
        )
        
        return X, y
    
    def train(self, df: pd.DataFrame, epochs: int = None, 
              validation_split: float = None) -> Dict:
        """
        Train LSTM model on environmental data
        
        Args:
            df: Training data with datetime index
            epochs: Number of training epochs
            validation_split: Validation data split ratio
            
        Returns:
            Training history and metrics
        """
        logger.info("Starting LSTM model training...")
        
        # Update config if provided
        if epochs:
            self.config['epochs'] = epochs
        if validation_split:
            self.config['validation_split'] = validation_split
        
        # Preprocess data
        X, y = self.preprocess_data(df)
        
        if len(X) < self.config['sequence_length'] * 2:
            raise ValueError(f"Insufficient data for training. Need at least {self.config['sequence_length'] * 2} samples")
        
        # Build model
        self.model = self.build_model()
        
        # Training callbacks
        callbacks = [
            EarlyStopping(
                monitor='val_loss',
                patience=15,
                restore_best_weights=True,
                verbose=1
            ),
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=8,
                min_lr=1e-6,
                verbose=1
            )
        ]
        
        # Train model
        history = self.model.fit(
            X, y,
            epochs=self.config['epochs'],
            batch_size=self.config['batch_size'],
            validation_split=self.config['validation_split'],
            callbacks=callbacks,
            verbose=1
        )
        
        # Calculate validation metrics
        val_predictions = self.model.predict(X[-int(len(X) * self.config['validation_split']):])
        val_true = y[-int(len(y) * self.config['validation_split']):]
        
        # Inverse transform for metric calculation
        val_pred_original = self.target_scaler.inverse_transform(val_predictions.reshape(-1, 1)).flatten()
        val_true_original = self.target_scaler.inverse_transform(val_true.reshape(-1, 1)).flatten()
        
        val_mae = mean_absolute_error(val_true_original, val_pred_original)
        val_rmse = np.sqrt(mean_squared_error(val_true_original, val_pred_original))
        
        # Update config
        self.config.update({
            'last_trained': datetime.now().isoformat(),
            'training_samples': len(X),
            'validation_mae': float(val_mae),
            'validation_rmse': float(val_rmse)
        })
        
        # Save model and scalers
        self.save_model()
        
        logger.info(f"Training completed. Validation MAE: {val_mae:.4f}, RMSE: {val_rmse:.4f}")
        
        return {
            'success': True,
            'epochs_trained': len(history.history['loss']),
            'final_loss': float(history.history['loss'][-1]),
            'final_val_loss': float(history.history['val_loss'][-1]),
            'validation_mae': val_mae,
            'validation_rmse': val_rmse,
            'training_samples': len(X)
        }
    
    def predict(self, df: pd.DataFrame, days_ahead: int = 7) -> Dict:
        """
        Generate predictions for future time periods
        
        Args:
            df: Recent data for prediction context
            days_ahead: Number of days to predict ahead
            
        Returns:
            Predictions with confidence intervals
        """
        if self.model is None:
            raise ValueError("Model not loaded. Please train or load a model first.")
        
        logger.info(f"Generating {days_ahead} day predictions...")
        
        # Prepare input data
        required_features = self.config['feature_names']
        
        # Use last available data for prediction
        recent_data = df[required_features].tail(self.config['sequence_length'])
        
        # Handle missing features
        for feature in required_features:
            if feature not in recent_data.columns:
                recent_data[feature] = recent_data.median().median()
        
        # Scale features
        features_scaled = self.feature_scaler.transform(recent_data.values)
        
        # Generate predictions
        predictions = []
        current_sequence = features_scaled.copy()
        
        for _ in range(days_ahead):
            # Predict next value
            X_pred = current_sequence[-self.config['sequence_length']:].reshape(1, self.config['sequence_length'], -1)
            pred_scaled = self.model.predict(X_pred, verbose=0)[0, 0]
            
            # Inverse transform prediction
            pred_original = self.target_scaler.inverse_transform([[pred_scaled]])[0, 0]
            predictions.append(float(pred_original))
            
            # Update sequence for next prediction (simple approach)
            # In practice, you'd want to update with actual environmental forecasts
            next_features = current_sequence[-1].copy()
            next_features = np.append(next_features[1:], pred_scaled)  # Shift and append
            current_sequence = np.vstack([current_sequence, next_features])
        
        # Generate prediction dates
        last_date = df.index[-1] if hasattr(df.index, 'date') else datetime.now()
        if isinstance(last_date, str):
            last_date = pd.to_datetime(last_date)
        
        prediction_dates = [
            (last_date + timedelta(days=i+1)).strftime('%Y-%m-%d') 
            for i in range(days_ahead)
        ]
        
        # Calculate confidence (simplified approach)
        # In practice, you'd use prediction intervals or ensemble methods
        base_confidence = 0.85
        confidence_decay = 0.02  # Confidence decreases with prediction horizon
        confidences = [
            max(0.5, base_confidence - i * confidence_decay) 
            for i in range(days_ahead)
        ]
        
        return {
            'success': True,
            'predictions': [
                {
                    'date': date,
                    'pollution_level': pred,
                    'confidence': conf
                }
                for date, pred, conf in zip(prediction_dates, predictions, confidences)
            ],
            'model_info': self.get_model_info(),
            'prediction_horizon': days_ahead
        }
    
    def save_model(self):
        """Save model, scalers, and configuration"""
        try:
            if self.model:
                # Save in Keras native format to avoid compatibility issues
                keras_path = self.model_path.replace('.h5', '.keras')
                self.model.save(keras_path)
                # Also save in h5 format for backward compatibility
                self.model.save(self.model_path)
            
            joblib.dump(self.feature_scaler, self.scaler_path)
            joblib.dump(self.target_scaler, self.target_scaler_path)
            
            with open(self.config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
            
            logger.info(f"Model saved to {self.model_path}")
            
        except Exception as e:
            logger.error(f"Error saving model: {e}")
    
    def load_model(self) -> bool:
        """Load model, scalers, and configuration"""
        try:
            # Try to load Keras native format first
            keras_path = self.model_path.replace('.h5', '.keras')
            if os.path.exists(keras_path):
                self.model = load_model(keras_path)
            elif os.path.exists(self.model_path):
                # Fallback to h5 format with custom objects
                self.model = load_model(self.model_path, compile=False)
                # Recompile with current metrics
                self.model.compile(
                    optimizer=Adam(learning_rate=self.config['learning_rate']),
                    loss='mean_squared_error',
                    metrics=['mean_absolute_error']
                )
                
            if os.path.exists(self.scaler_path):
                self.feature_scaler = joblib.load(self.scaler_path)
                
            if os.path.exists(self.target_scaler_path):
                self.target_scaler = joblib.load(self.target_scaler_path)
                
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    saved_config = json.load(f)
                    self.config.update(saved_config)
            
            if self.model:
                logger.info("LSTM model loaded successfully")
                return True
            else:
                logger.info("No saved model found")
                return False
                
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False
    
    def get_model_info(self) -> Dict:
        """Get model information and status"""
        return {
            'status': 'loaded' if self.model else 'not_loaded',
            'model_exists': os.path.exists(self.model_path),
            'config': self.config.copy(),
            'model_size_mb': round(os.path.getsize(self.model_path) / 1024 / 1024, 2) if os.path.exists(self.model_path) else 0
        }

# Global instance
lstm_model = EnvironmentalLSTM()