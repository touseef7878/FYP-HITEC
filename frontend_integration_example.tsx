/**
 * Frontend Integration Example for Refactored System
 * Shows how to implement separate "Fetch Data" and "Train Model" buttons
 */

import React, { useState, useEffect } from 'react';

interface Region {
  id: string;
  name: string;
  dataset_cached: boolean;
  dataset_info?: {
    total_records: number;
    date_range: {
      start: string;
      end: string;
    };
  };
}

interface DataStatus {
  dataset_cached: boolean;
  model_trained: boolean;
  dataset_info?: any;
}

const PollutionPredictionPanel: React.FC = () => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('pacific');
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [loading, setLoading] = useState<string>(''); // 'fetching', 'training', 'predicting'
  const [predictions, setPredictions] = useState<any>(null);

  // Load regions on component mount
  useEffect(() => {
    loadRegions();
  }, []);

  // Load data status when region changes
  useEffect(() => {
    if (selectedRegion) {
      loadDataStatus(selectedRegion);
    }
  }, [selectedRegion]);

  const loadRegions = async () => {
    try {
      const response = await fetch('/api/data/regions');
      const data = await response.json();
      if (data.success) {
        setRegions(data.regions);
      }
    } catch (error) {
      console.error('Failed to load regions:', error);
    }
  };

  const loadDataStatus = async (region: string) => {
    try {
      const response = await fetch(`/api/data/status/${region}`);
      const data = await response.json();
      if (data.success) {
        setDataStatus(data);
      }
    } catch (error) {
      console.error('Failed to load data status:', error);
    }
  };

  const handleFetchData = async () => {
    if (!selectedRegion) return;

    setLoading('fetching');
    try {
      const response = await fetch('/api/data/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ region: selectedRegion }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ Data fetched successfully for ${selectedRegion}!\n` +
              `Records: ${result.dataset_info.total_records}\n` +
              `Duration: ${result.fetch_duration_seconds.toFixed(1)}s`);
        
        // Reload data status
        await loadDataStatus(selectedRegion);
      } else if (result.message === 'already_fetched') {
        alert(`ℹ️ Data already cached for ${selectedRegion}`);
      } else {
        alert(`❌ Failed to fetch data: ${result.message}`);
      }
    } catch (error) {
      console.error('Fetch data error:', error);
      alert('❌ Failed to fetch data. Please try again.');
    } finally {
      setLoading('');
    }
  };

  const handleTrainModel = async () => {
    if (!selectedRegion) return;

    // Check if data is cached first
    if (!dataStatus?.dataset_cached) {
      alert('⚠️ No cached dataset found. Please fetch data first.');
      return;
    }

    setLoading('training');
    try {
      const response = await fetch('/api/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          region: selectedRegion, 
          epochs: 50 
        }),
      });

      const result = await response.json();

      if (result.success) {
        const training = result.training_result;
        alert(`✅ Model trained successfully for ${selectedRegion}!\n` +
              `Epochs: ${training.epochs_trained}\n` +
              `Samples: ${training.training_samples}\n` +
              `Validation MAE: ${training.validation_mae.toFixed(4)}\n` +
              `Data Source: ${training.data_source}`);
        
        // Reload data status
        await loadDataStatus(selectedRegion);
      } else {
        alert(`❌ Training failed: ${result.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Training error:', error);
      alert('❌ Training failed. Please try again.');
    } finally {
      setLoading('');
    }
  };

  const handlePredict = async () => {
    if (!selectedRegion) return;

    // Check if model is trained
    if (!dataStatus?.model_trained) {
      alert('⚠️ No trained model found. Please train the model first.');
      return;
    }

    setLoading('predicting');
    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          region: selectedRegion, 
          days_ahead: 7 
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPredictions(result);
        alert(`✅ Predictions generated for ${selectedRegion}!\n` +
              `Current Level: ${result.summary.current_level.toFixed(1)}\n` +
              `Predicted Level: ${result.summary.predicted_level.toFixed(1)}\n` +
              `Risk Level: ${result.summary.risk_level}\n` +
              `Data Source: ${result.data_source}`);
      } else {
        alert(`❌ Prediction failed: ${result.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Prediction error:', error);
      alert('❌ Prediction failed. Please try again.');
    } finally {
      setLoading('');
    }
  };

  const getButtonStyle = (condition: boolean, loadingState: string) => ({
    padding: '12px 24px',
    margin: '8px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: condition ? 'pointer' : 'not-allowed',
    backgroundColor: condition ? '#007bff' : '#6c757d',
    color: 'white',
    opacity: loading === loadingState ? 0.7 : 1,
  });

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🌊 Marine Pollution Prediction - Refactored System</h2>
      
      {/* Region Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="region-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Select Region:
        </label>
        <select
          id="region-select"
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          style={{ padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name} {region.dataset_cached ? '✅' : '⏳'}
            </option>
          ))}
        </select>
      </div>

      {/* Data Status Display */}
      {dataStatus && (
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '16px', 
          borderRadius: '6px', 
          marginBottom: '20px',
          border: '1px solid #dee2e6'
        }}>
          <h4>📊 Data Status for {selectedRegion}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <strong>Dataset Cached:</strong> {dataStatus.dataset_cached ? '✅ Yes' : '❌ No'}
              {dataStatus.dataset_info && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Records: {dataStatus.dataset_info.total_records}<br/>
                  Range: {dataStatus.dataset_info.date_range?.start} to {dataStatus.dataset_info.date_range?.end}
                </div>
              )}
            </div>
            <div>
              <strong>Model Trained:</strong> {dataStatus.model_trained ? '✅ Yes' : '❌ No'}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <h4>🎯 Actions</h4>
        
        {/* Step 1: Fetch Data */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={handleFetchData}
            disabled={loading === 'fetching'}
            style={getButtonStyle(true, 'fetching')}
          >
            {loading === 'fetching' ? '⏳ Fetching Data...' : '📥 Fetch Data'}
          </button>
          <span style={{ marginLeft: '12px', fontSize: '14px', color: '#666' }}>
            {dataStatus?.dataset_cached ? 
              '✅ Data already cached' : 
              '⚠️ Fetch environmental data (one-time only)'
            }
          </span>
        </div>

        {/* Step 2: Train Model */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={handleTrainModel}
            disabled={!dataStatus?.dataset_cached || loading === 'training'}
            style={getButtonStyle(dataStatus?.dataset_cached || false, 'training')}
          >
            {loading === 'training' ? '⏳ Training Model...' : '🎯 Train Model'}
          </button>
          <span style={{ marginLeft: '12px', fontSize: '14px', color: '#666' }}>
            {!dataStatus?.dataset_cached ? 
              '⚠️ Fetch data first' :
              dataStatus?.model_trained ?
                '✅ Model already trained' :
                '🎯 Train LSTM using cached data'
            }
          </span>
        </div>

        {/* Step 3: Generate Predictions */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={handlePredict}
            disabled={!dataStatus?.model_trained || loading === 'predicting'}
            style={getButtonStyle(dataStatus?.model_trained || false, 'predicting')}
          >
            {loading === 'predicting' ? '⏳ Generating Predictions...' : '🔮 Predict Trends'}
          </button>
          <span style={{ marginLeft: '12px', fontSize: '14px', color: '#666' }}>
            {!dataStatus?.model_trained ? 
              '⚠️ Train model first' : 
              '🔮 Generate 7-day pollution predictions'
            }
          </span>
        </div>
      </div>

      {/* Predictions Display */}
      {predictions && (
        <div style={{ 
          backgroundColor: '#e8f5e8', 
          padding: '16px', 
          borderRadius: '6px', 
          border: '1px solid #28a745'
        }}>
          <h4>🔮 Predictions for {predictions.region}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <strong>Current Level:</strong> {predictions.summary.current_level.toFixed(1)}
            </div>
            <div>
              <strong>Predicted Level:</strong> {predictions.summary.predicted_level.toFixed(1)}
            </div>
            <div>
              <strong>Trend Change:</strong> {predictions.summary.trend_change_percent.toFixed(1)}%
            </div>
            <div>
              <strong>Risk Level:</strong> 
              <span style={{ 
                color: predictions.summary.risk_level === 'Low' ? 'green' :
                       predictions.summary.risk_level === 'Moderate' ? 'orange' : 'red',
                fontWeight: 'bold',
                marginLeft: '8px'
              }}>
                {predictions.summary.risk_level}
              </span>
            </div>
          </div>
          
          <div style={{ fontSize: '12px', color: '#666' }}>
            <strong>Data Source:</strong> {predictions.data_source} | 
            <strong> Predictions:</strong> {predictions.predictions.length} days |
            <strong> Avg Confidence:</strong> {(predictions.summary.average_confidence * 100).toFixed(1)}%
          </div>
        </div>
      )}

      {/* System Info */}
      <div style={{ 
        marginTop: '40px', 
        padding: '16px', 
        backgroundColor: '#f1f3f4', 
        borderRadius: '6px',
        fontSize: '12px',
        color: '#666'
      }}>
        <h5>ℹ️ System Information</h5>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>Data Fetching:</strong> One-time only per region using parallel API calls</li>
          <li><strong>Training:</strong> Uses ONLY cached data - no external API calls</li>
          <li><strong>Predictions:</strong> Generated from cached data and trained models</li>
          <li><strong>Performance:</strong> Fast and reliable - no network dependencies during training</li>
        </ul>
      </div>
    </div>
  );
};

export default PollutionPredictionPanel;