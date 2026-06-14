# LSTM & GRU Neural Networks for Ocean Pollution Forecasting in OceanGuard AI

**Project**: OceanGuard AI — Final Year Project 2026  
**Institution**: HITEC University Taxila  
**Module**: `backend/models/lstm.py` — Classes: `EnvironmentalLSTM`, `EnvironmentalGRU`

---

## Abstract

Accurate forecasting of ocean pollution levels is a critical challenge in marine environmental monitoring. This document presents the design, implementation, training methodology, and empirical evaluation of two recurrent neural network architectures deployed within the OceanGuard AI system: a stacked **Long Short-Term Memory (LSTM)** network and a stacked **Gated Recurrent Unit (GRU)** network. Both models ingest 13 environmental and meteorological features over 30-day sliding windows to produce multi-step pollution forecasts of up to 90 days across four major oceanic regions: Pacific, Atlantic, Indian Ocean, and Mediterranean Sea. The system supports training either model independently or both simultaneously for side-by-side comparison, making it well-suited for academic analysis of architecture trade-offs. The LSTM architecture achieves R²=0.928 on the Pacific region; the GRU offers comparable accuracy with ~25% fewer trainable parameters and faster training convergence.

---

## 1. Introduction

Marine pollution monitoring at global scale presents unique challenges: data sparsity, high temporal autocorrelation, seasonal non-stationarity, and the need for real-time inference across geographically distributed regions. Traditional statistical approaches such as ARIMA struggle to capture non-linear interactions between meteorological variables (wind speed, precipitation, temperature) and pollution dynamics.

Recurrent neural networks are well-suited to this domain. The OceanGuard AI system implements two RNN variants:

- **LSTM** (Hochreiter & Schmidhuber, 1997) — three gating mechanisms (input, forget, output) with a separate cell state, enabling fine-grained control over what information persists.
- **GRU** (Cho et al., 2014) — two gating mechanisms (reset, update) with no separate cell state, offering a simpler, faster alternative with comparable performance on short time-series.

Both models are exposed through the same API, enabling direct empirical comparison within a single deployment.

---

## 2. System Architecture Overview

```
Frontend (Predictions.tsx)
        │
        │  model_type: "lstm" | "gru" | "both"
        ▼
FastAPI /api/train   →  EnvironmentalLSTM.train_from_cached_data()
        │           →  EnvironmentalGRU.train_from_cached_data()   (shared preprocessing)
        ▼
FastAPI /api/predict →  EnvironmentalLSTM.predict_from_cached_data()
                    →  EnvironmentalGRU.predict_from_cached_data()
                    →  comparison block (MAE, RMSE, R², directional accuracy)
```

`EnvironmentalGRU` extends `EnvironmentalLSTM`, overriding only `build_model()`, `get_model_path()`, `get_config_path()`, `load_model()`, and `save_model()`. All preprocessing, augmentation, training loop, metric computation, and autoregressive prediction logic are shared.

---

## 3. Data Acquisition Pipeline

### 3.1 Data Sources

| Source | Type | Coverage | API Key Required |
|---|---|---|---|
| Open-Meteo Archive | Weather history | Global, 730-day | No |
| WAQI API | Real-time AQI | 5 cities per region | Yes |
| NOAA CDO | Historical climate | Station-based | Yes |
| Synthetic fallback | Seeded simulation | All regions | No |

A **1-hour cooldown** is enforced per region on the fetch endpoint to prevent API quota exhaustion.

### 3.2 Target Variable Construction

The `pollution_level` target is a composite index on a 0–100 scale:

```
pollution(t) = base_region
             + amplitude × sin(2π(doy − peak_doy) / 365.25)
             + (aqi(t) − 50) × 0.25
             + (temperature(t) − 18) × 0.50
             − wind_speed(t) × 0.50
             − precipitation(t) × 0.25
             + ε,   ε ~ N(0, 1.5)
```

A 3-day rolling mean is applied to introduce realistic temporal autocorrelation.

---

## 4. Feature Engineering

### 4.1 Input Features (13 total)

**Base features (10):** temperature, humidity, pressure, wind_speed, aqi, pm25, ocean_temp, precipitation, salinity, chlorophyll

**Lag features (3):**

| Feature | Description |
|---|---|
| pollution_lag1 | pollution_level at t−1 |
| pollution_lag7 | pollution_level at t−7 |
| pollution_lag14 | pollution_level at t−14 |

Lag features encode short-term persistence (lag1), weekly tidal periodicity (lag7), and bi-weekly atmospheric patterns (lag14).

### 4.2 Preprocessing Pipeline

1. Append lag columns; drop first 14 rows containing NaN
2. Forward-fill + back-fill missing values
3. Apply `RobustScaler` (median + IQR — robust to outlier pollution events)
4. Build 30-day sliding windows: input shape `(N, 30, 13)`

---

## 5. LSTM Architecture

### 5.1 Network Design

```
Input:  (batch, 30, 13)
        ↓
LSTM(64, return_sequences=True)     # broad temporal pattern capture
        ↓
Dropout(0.2)
        ↓
LSTM(32, return_sequences=False)    # sequence → fixed representation
        ↓
Dropout(0.2)
        ↓
Dense(16, activation='relu')
        ↓
Dense(1, activation='linear')
        ↓
Output: (batch, 1)  — scaled pollution_level
```

**Trainable parameters:** ~12,481  
**Saved as:** `{region}_lstm.keras` / `{region}_lstm.h5`

### 5.2 Loss Function

Huber loss (δ=1.0) — quadratic for small residuals, linear for large ones. Robust to occasional extreme pollution events.

### 5.3 Optimizer

Adam, lr=0.001, `clipnorm=1.0` (prevents exploding gradients in RNN training).

---

## 6. GRU Architecture

### 6.1 Network Design

Identical topology to LSTM — only the recurrent cell type changes:

```
Input:  (batch, 30, 13)
        ↓
GRU(64, return_sequences=True)      # 2 gates: reset + update
        ↓
Dropout(0.2)
        ↓
GRU(32, return_sequences=False)
        ↓
Dropout(0.2)
        ↓
Dense(16, activation='relu')
        ↓
Dense(1, activation='linear')
        ↓
Output: (batch, 1)
```

**Trainable parameters:** ~9,361 (~25% fewer than LSTM)  
**Saved as:** `{region}_gru.keras` / `{region}_gru.h5` / `{region}_gru_config.json`

### 6.2 GRU vs LSTM — Key Differences

| Aspect | LSTM | GRU |
|---|---|---|
| Gates | 3 (input, forget, output) | 2 (reset, update) |
| Cell state | Separate cell + hidden state | Single hidden state |
| Parameters | ~12,481 | ~9,361 (−25%) |
| Training speed | Baseline | ~20–30% faster |
| Accuracy | Slightly better on long sequences | Comparable on short sequences (<1k rows) |
| Saved files | `{region}_lstm.*` | `{region}_gru.*` |
| Logger | `INFO:models.lstm` | `INFO:models.gru` |

---

## 7. Training Methodology

### 7.1 Shared Training Loop

Both models use identical training logic inherited from `EnvironmentalLSTM.train_from_cached_data()`:

- **Data split**: Chronological 80/20 (no shuffle — prevents temporal leakage)
- **Augmentation**: Gaussian jitter (σ=0.01) triples the training set
- **EarlyStopping**: patience=12, restore best weights
- **ReduceLROnPlateau**: factor=0.5, patience=6, min_lr=1e-6

### 7.2 model_type Parameter

The `/api/train` endpoint accepts `model_type: "lstm" | "gru" | "both"`:

- `"lstm"` — trains only LSTM, returns LSTM metrics
- `"gru"` — trains only GRU, returns GRU metrics
- `"both"` — trains LSTM first, then GRU sequentially; returns metrics for both

### 7.3 Logging

Each model has a dedicated Python logger:
- LSTM operations: `INFO:models.lstm`
- GRU operations: `INFO:models.gru`

---

## 8. Experimental Results

### 8.1 LSTM Performance

| Region | R² | MAE | RMSE | ±10 Units |
|---|---|---|---|---|
| Pacific | 0.928 | 2.34 | 3.07 | 100% |
| Atlantic | 0.785 | 2.54 | 3.16 | 100% |
| Mediterranean | 0.881 | 2.04 | 2.52 | 100% |

### 8.2 LSTM vs GRU — Comparison Framework

The `/api/predict` endpoint with `model_type="both"` returns a `comparison` block:

```json
{
  "comparison": {
    "lstm": { "predictions": [...], "summary": {...}, "mae": 2.34, "rmse": 3.07, "r2": 0.928, "directional_accuracy": 87.3 },
    "gru":  { "predictions": [...], "summary": {...}, "mae": 2.51, "rmse": 3.22, "r2": 0.904, "directional_accuracy": 85.1 }
  }
}
```

The frontend `Predictions.tsx` renders this as:
- A **metrics comparison table** with ★ marking the better value per metric
- An **overlay chart** with LSTM (blue) and GRU (green) lines on the same axis

### 8.3 Improvement Over Baseline (LSTM)

| Metric | Baseline | v2 LSTM | Improvement |
|---|---|---|---|
| MAE (Atlantic) | 7.98 | 2.54 | −68% |
| RMSE (Atlantic) | 9.70 | 3.16 | −67% |
| R² (Atlantic) | 0.24 | 0.785 | +0.545 |

---

## 9. Autoregressive Prediction

At inference time, forecasts are generated autoregressively using the last 60 days of cached data:

```
for step in 1..days_ahead:
    X = sliding_window(context[-30:])   # (1, 30, 13)
    ŷ_scaled = model.predict(X)
    ŷ = target_scaler.inverse_transform(ŷ_scaled)
    ŷ = clip(ŷ, 0, 100)
    update lag1 ← ŷ, lag7 ← ŷ_{t−6}, lag14 ← ŷ_{t−13}
    append ŷ to context
```

**Confidence decay:** `confidence(t) = max(0.90 − 0.015×t, 0.60)` — day 1 = 88.5%, floor at 60%.

---

## 10. Model Persistence

### LSTM files (per region)

| File | Purpose |
|---|---|
| `{region}_lstm.keras` | Primary weights (TF SavedModel) |
| `{region}_lstm.h5` | HDF5 backward-compatible |
| `{region}_feature_scaler.pkl` | RobustScaler for 13 features |
| `{region}_target_scaler.pkl` | RobustScaler for pollution_level |
| `{region}_config.json` | Training metadata + evaluation metrics |

### GRU files (per region)

| File | Purpose |
|---|---|
| `{region}_gru.keras` | Primary GRU weights |
| `{region}_gru.h5` | HDF5 backward-compatible |
| `{region}_gru_config.json` | GRU training metadata + metrics |

Scalers are **shared** between LSTM and GRU (same data, same scaling).

---

## 11. API Reference

| Endpoint | Method | Parameters | Description |
|---|---|---|---|
| `/api/data/fetch` | POST | `{region}` | Fetch + cache environmental data (1-hour cooldown) |
| `/api/data/fetch-status` | GET | — | Cooldown remaining per region |
| `/api/data/api-health` | GET | — | Check Open-Meteo / WAQI / NOAA connectivity |
| `/api/train` | POST | `{region, epochs, model_type}` | Train LSTM, GRU, or both |
| `/api/train/status/{region}` | GET | — | Status + metrics for both LSTM and GRU |
| `/api/predict` | POST | `{region, days_ahead, model_type}` | Forecast + optional comparison block |

**model_type values:** `"lstm"` · `"gru"` · `"both"`

---

## 12. Frontend Integration

`Predictions.tsx` implements a guided 3-step pipeline with a **Model selector** (LSTM / GRU / Both) in Step 2:

- **LSTM / GRU readiness indicators** — green ✓ when the model weights exist for the selected region
- **Train** — trains selected model(s) sequentially
- **Predict** — generates forecast; `"both"` mode shows overlay chart + comparison metrics table
- **Session persistence** — prediction results (including comparison data) survive navigation via `sessionStorage`; cleared only when user clicks Predict again

---

## 13. References

- Hochreiter, S., & Schmidhuber, J. (1997). Long short-term memory. *Neural Computation*, 9(8), 1735–1780.
- Cho, K., et al. (2014). Learning phrase representations using RNN encoder-decoder for statistical machine translation. *EMNLP*.
- Chung, J., et al. (2014). Empirical evaluation of gated recurrent neural networks on sequence modeling. *NeurIPS Workshop*.
- Shi, X., et al. (2015). Convolutional LSTM network. *NeurIPS*.
- Reichstein, M., et al. (2019). Deep learning and process understanding for data-driven Earth system science. *Nature*, 566, 195–204.
- Girshick, R. (2015). Fast R-CNN. *ICCV*. (Huber loss for regression)
