"""
Enhanced LSTM Model for Environmental & Marine Time-Series Prediction
Uses ONLY cached data - NEVER calls external APIs during training
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
    Uses ONLY cached datasets - NEVER calls external APIs during training
    """
    
    def __init__(self, model_dir: str = "models"):
        self.model_dir = model_dir
        
        # Ensure model directory exists
        os.makedirs(model_dir, exist_ok=True)
        
        # Model components
        self.model = None
        self.feature_scaler = MinMaxScaler()
        self.target_scaler = MinMaxScaler()
        self.config = {
            'sequence_length': 30,  # 30 days of historical data
            'n_features': 10,       # Multiple environmental features
            'lstm_units': [64, 32], # Two LSTM layers
            'dropout_rate': 0.2,
            'learning_rate': 0.001,
            'batch_size': 32,
            'epochs': 100,
            'validation_split': 0.2,
            'feature_names': [
                'temperature', 'humidity', 'pressure', 'wind_speed',
                'aqi', 'pm25', 'ocean_temp', 'precipitation',
                'salinity', 'chlorophyll'
            ],
            'target_name': 'pollution_level',
            'created_at': None,
            'last_trained': None,
            'training_samples': 0,
            'validation_mae': None,
            'validation_rmse': None
        }
    
    def get_model_path(self, region: str) -> str:
        """Get model file path for specific region"""
        return os.path.join(self.model_dir, f"{region}_lstm.h5")
    
    def get_scaler_path(self, region: str, scaler_type: str) -> str:
        """Get scaler file path for specific region"""
        return os.path.join(self.model_dir, f"{region}_{scaler_type}_scaler.pkl")
    
    def get_config_path(self, region: str) -> str:
        """Get config file path for specific region"""
        return os.path.join(self.model_dir, f"{region}_config.json")
    
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
    
    def preprocess_cached_data(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Preprocess cached dataset for LSTM training
        
        Args:
            df: Cached DataFrame with all features
            
        Returns:
            X: Scaled feature sequences
            y: Scaled target values
        """
        logger.info("Preprocessing cached dataset...")
        
        # Ensure we have all required features
        required_features = self.config['feature_names']
        target_col = self.config['target_name']
        
        # Check if target column exists
        if target_col not in df.columns:
            raise ValueError(f"Target column '{target_col}' not found in cached dataset")
        
        # Handle missing features by filling with median values or defaults
        feature_data = {}
        for feature in required_features:
            if feature in df.columns:
                feature_data[feature] = df[feature].values
            else:
                logger.warning(f"Missing feature {feature}, using default values")
                # Provide reasonable defaults for missing features
                defaults = {
                    'temperature': 20.0,
                    'humidity': 60.0,
                    'pressure': 1013.25,
                    'wind_speed': 5.0,
                    'aqi': 50.0,
                    'pm25': 25.0,
                    'ocean_temp': 15.0,
                    'precipitation': 2.0,
                    'salinity': 35.0,
                    'chlorophyll': 1.0
                }
                default_value = defaults.get(feature, 0.0)
                feature_data[feature] = np.full(len(df), default_value)
        
        # Create feature matrix
        features = np.column_stack([feature_data[f] for f in required_features])
        target = df[target_col].values
        
        # Handle missing values
        features_df = pd.DataFrame(features, columns=required_features)
        features_df = features_df.ffill().bfill()
        
        # Replace any remaining NaN with reasonable defaults
        for col in features_df.columns:
            if features_df[col].isna().any():
                if 'temperature' in col.lower():
                    features_df[col] = features_df[col].fillna(20.0)
                elif 'humidity' in col.lower():
                    features_df[col] = features_df[col].fillna(60.0)
                elif 'pressure' in col.lower():
                    features_df[col] = features_df[col].fillna(1013.25)
                elif 'wind' in col.lower():
                    features_df[col] = features_df[col].fillna(5.0)
                elif 'aqi' in col.lower() or 'pm' in col.lower():
                    features_df[col] = features_df[col].fillna(50.0)
                elif 'ocean' in col.lower():
                    features_df[col] = features_df[col].fillna(15.0)
                elif 'precipitation' in col.lower():
                    features_df[col] = features_df[col].fillna(2.0)
                elif 'salinity' in col.lower():
                    features_df[col] = features_df[col].fillna(35.0)
                elif 'chlorophyll' in col.lower():
                    features_df[col] = features_df[col].fillna(1.0)
                else:
                    features_df[col] = features_df[col].fillna(0.0)
        
        features = features_df.values
        
        target = pd.Series(target).ffill().bfill()
        # Replace any remaining NaN in target
        target = target.fillna(50.0).values
        
        # Scale features and target
        features_scaled = self.feature_scaler.fit_transform(features)
        target_scaled = self.target_scaler.fit_transform(target.reshape(-1, 1)).flatten()
        
        # Final check for NaN values
        if np.isnan(features_scaled).any():
            logger.error("NaN values found in scaled features")
            # Replace NaN with zeros as last resort
            features_scaled = np.nan_to_num(features_scaled, nan=0.0)
        
        if np.isnan(target_scaled).any():
            logger.error("NaN values found in scaled target")
            # Replace NaN with median
            target_scaled = np.nan_to_num(target_scaled, nan=np.nanmedian(target_scaled))
        
        # Create sequences
        X, y = self.create_sequences(
            features_scaled, 
            target_scaled, 
            self.config['sequence_length']
        )
        
        logger.info(f"✅ Preprocessed cached data: {len(X)} sequences, {X.shape[2]} features")
        return X, y
    
    def train_from_cached_data(self, region: str, cached_df: pd.DataFrame, epochs: int = None) -> Dict:
        """
        Train LSTM model using ONLY cached dataset - NEVER calls external APIs
        
        Args:
            region: Region identifier (pacific, atlantic, etc.)
            cached_df: Pre-loaded cached dataset
            epochs: Number of training epochs
            
        Returns:
            Training history and metrics
        """
        logger.info(f"🚀 Training LSTM model for {region} using cached data ONLY...")
        
        if cached_df.empty:
            raise ValueError(f"Empty cached dataset provided for {region}")
        
        # Update config if provided
        if epochs:
            self.config['epochs'] = epochs
        
        # Preprocess cached data
        X, y = self.preprocess_cached_data(cached_df)
        
        if len(X) < self.config['sequence_length'] * 2:
            raise ValueError(f"Insufficient data for training. Need at least {self.config['sequence_length'] * 2} samples, got {len(X)}")
        
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
        logger.info(f"Training with {len(X)} samples, {self.config['epochs']} epochs...")
        history = self.model.fit(
            X, y,
            epochs=self.config['epochs'],
            batch_size=self.config['batch_size'],
            validation_split=self.config['validation_split'],
            callbacks=callbacks,
            verbose=1
        )
        
        # Calculate validation metrics
        val_split_idx = int(len(X) * (1 - self.config['validation_split']))
        val_predictions = self.model.predict(X[val_split_idx:])
        val_true = y[val_split_idx:]
        
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
            'validation_rmse': float(val_rmse),
            'region': region
        })
        
        # Save model and scalers for this region
        self.save_model(region)
        
        logger.info(f"✅ Training completed for {region}. Validation MAE: {val_mae:.4f}, RMSE: {val_rmse:.4f}")
        
        return {
            'success': True,
            'region': region,
            'epochs_trained': len(history.history['loss']),
            'final_loss': float(history.history['loss'][-1]),
            'final_val_loss': float(history.history['val_loss'][-1]),
            'validation_mae': val_mae,
            'validation_rmse': val_rmse,
            'training_samples': len(X),
            'data_source': 'cached_only'
        }
    
    def predict_from_cached_data(self, region: str, recent_df: pd.DataFrame, days_ahead: int = 7) -> Dict:
        """
        Generate predictions using cached data - NEVER calls external APIs
        
        Args:
            region: Region identifier
            recent_df: Recent cached data for prediction context
            days_ahead: Number of days to predict ahead
            
        Returns:
            Predictions with confidence intervals
        """
        # Load model for specific region
        if not self.load_model(region):
            raise ValueError(f"No trained model found for {region}. Please train model first.")
        
        logger.info(f"🔮 Generating {days_ahead} day predictions for {region} using cached data...")
        
        # Prepare input data from cached dataset
        required_features = self.config['feature_names']
        
        # Use last available data for prediction
        recent_data = recent_df[required_features].tail(self.config['sequence_length'])
        
        # Handle missing features with defaults
        for feature in required_features:
            if feature not in recent_data.columns:
                defaults = {
                    'temperature': 20.0, 'humidity': 60.0, 'pressure': 1013.25,
                    'wind_speed': 5.0, 'aqi': 50.0, 'pm25': 25.0,
                    'ocean_temp': 15.0, 'precipitation': 2.0,
                    'salinity': 35.0, 'chlorophyll': 1.0
                }
                recent_data[feature] = defaults.get(feature, 0.0)
        
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
            
            # Update sequence for next prediction
            next_features = current_sequence[-1].copy()
            next_features = np.append(next_features[1:], pred_scaled)
            current_sequence = np.vstack([current_sequence, next_features])
        
        # Generate prediction dates
        last_date = recent_df['date'].iloc[-1] if 'date' in recent_df.columns else datetime.now()
        if isinstance(last_date, str):
            last_date = pd.to_datetime(last_date)
        
        prediction_dates = [
            (last_date + timedelta(days=i+1)).strftime('%Y-%m-%d') 
            for i in range(days_ahead)
        ]
        
        # Calculate confidence (simplified approach)
        base_confidence = 0.85
        confidence_decay = 0.02
        confidences = [
            max(0.5, base_confidence - i * confidence_decay) 
            for i in range(days_ahead)
        ]
        
        return {
            'success': True,
            'region': region,
            'predictions': [
                {
                    'date': date,
                    'pollution_level': pred,
                    'confidence': conf
                }
                for date, pred, conf in zip(prediction_dates, predictions, confidences)
            ],
            'model_info': self.get_model_info(region),
            'prediction_horizon': days_ahead,
            'data_source': 'cached_only'
        }
    
    def save_model(self, region: str):
        """Save model, scalers, and configuration for specific region"""
        try:
            if self.model:
                model_path = self.get_model_path(region)
                # Save in Keras native format to avoid compatibility issues
                keras_path = model_path.replace('.h5', '.keras')
                self.model.save(keras_path)
                # Also save in h5 format for backward compatibility
                self.model.save(model_path)
            
            feature_scaler_path = self.get_scaler_path(region, 'feature')
            target_scaler_path = self.get_scaler_path(region, 'target')
            config_path = self.get_config_path(region)
            
            joblib.dump(self.feature_scaler, feature_scaler_path)
            joblib.dump(self.target_scaler, target_scaler_path)
            
            with open(config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
            
            logger.info(f"✅ Model saved for {region}")
            
        except Exception as e:
            logger.error(f"Error saving model for {region}: {e}")
    
    def load_model(self, region: str) -> bool:
        """Load model, scalers, and configuration for specific region"""
        try:
            model_path = self.get_model_path(region)
            feature_scaler_path = self.get_scaler_path(region, 'feature')
            target_scaler_path = self.get_scaler_path(region, 'target')
            config_path = self.get_config_path(region)
            
            # Try to load Keras native format first
            keras_path = model_path.replace('.h5', '.keras')
            if os.path.exists(keras_path):
                self.model = load_model(keras_path)
            elif os.path.exists(model_path):
                # Fallback to h5 format with custom objects
                self.model = load_model(model_path, compile=False)
                # Recompile with current metrics
                self.model.compile(
                    optimizer=Adam(learning_rate=self.config['learning_rate']),
                    loss='mean_squared_error',
                    metrics=['mean_absolute_error']
                )
                
            if os.path.exists(feature_scaler_path):
                self.feature_scaler = joblib.load(feature_scaler_path)
                
            if os.path.exists(target_scaler_path):
                self.target_scaler = joblib.load(target_scaler_path)
                
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    saved_config = json.load(f)
                    self.config.update(saved_config)
            
            if self.model:
                logger.info(f"✅ LSTM model loaded for {region}")
                return True
            else:
                logger.info(f"No saved model found for {region}")
                return False
                
        except Exception as e:
            logger.error(f"Error loading model for {region}: {e}")
            return False
    
    def get_model_info(self, region: str = None) -> Dict:
        """Get model information and status for specific region"""
        if region:
            model_path = self.get_model_path(region)
            model_exists = os.path.exists(model_path)
            model_size = round(os.path.getsize(model_path) / 1024 / 1024, 2) if model_exists else 0
        else:
            model_exists = self.model is not None
            model_size = 0
        
        return {
            'status': 'loaded' if self.model else 'not_loaded',
            'region': region,
            'model_exists': model_exists,
            'config': self.config.copy(),
            'model_size_mb': model_size,
            'data_source': 'cached_only'
        }

# Global instance
lstm_model = EnvironmentalLSTM()