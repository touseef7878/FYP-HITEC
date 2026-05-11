"""
LSTM Accuracy Analysis — OceanScan AI
Trains and evaluates the LSTM model for all ocean regions.
Suppresses TensorFlow noise for clean professional output.
"""
import os, sys, json, warnings

# ── Suppress TensorFlow / oneDNN noise before any import ──────────────────────
os.environ['TF_CPP_MIN_LOG_LEVEL']  = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
warnings.filterwarnings('ignore')

import logging
logging.getLogger('tensorflow').setLevel(logging.ERROR)
logging.getLogger('absl').setLevel(logging.ERROR)
logging.getLogger('models.lstm').setLevel(logging.WARNING)
logging.getLogger('services.data_cache_service').setLevel(logging.WARNING)
logging.getLogger('utils.noaa_api').setLevel(logging.WARNING)
logging.getLogger('utils.waqi_api').setLevel(logging.WARNING)

import numpy as np
import pandas as pd
from datetime import datetime

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from models.lstm import EnvironmentalLSTM
from services.data_cache_service import data_cache_service
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

REGIONS = ['pacific', 'atlantic', 'mediterranean']

# ── Banner ─────────────────────────────────────────────────────────────────────
print()
print("╔══════════════════════════════════════════════════════════════╗")
print("║          OceanScan AI — LSTM Accuracy Evaluation            ║")
print(f"║          {datetime.now().strftime('%Y-%m-%d  %H:%M:%S')}                              ║")
print("╚══════════════════════════════════════════════════════════════╝")

all_results = {}

for region in REGIONS:
    print(f"\n┌─ {region.upper()} {'─'*(57 - len(region))}")

    dataset_path = f'services/data_cache/{region}_dataset.csv'
    if not os.path.exists(dataset_path):
        print(f"│  ⚠  No cached dataset found — skipping.")
        print(f"└{'─'*60}")
        continue

    # Load and recompute pollution_level with improved formula
    df = pd.read_csv(dataset_path, parse_dates=['date'])
    df = data_cache_service._compute_pollution_level(df, region)

    print(f"│  Dataset  : {len(df)} rows  "
          f"({df['date'].min().date()} → {df['date'].max().date()})")
    print(f"│  Target   : mean={df['pollution_level'].mean():.1f}  "
          f"std={df['pollution_level'].std():.1f}  "
          f"range=[{df['pollution_level'].min():.1f}, {df['pollution_level'].max():.1f}]")

    lstm = EnvironmentalLSTM(model_dir='models')
    lstm.config['epochs'] = 50   # early stopping usually kicks in at ~20-35

    print(f"│  Training : up to 50 epochs (early stopping patience=12)...")

    import time
    t0 = time.time()
    result = lstm.train_from_cached_data(region=region, cached_df=df, epochs=50)
    elapsed = time.time() - t0

    print(f"│  Done     : {result['epochs_trained']} epochs  |  {elapsed:.0f}s")
    print(f"│  Samples  : {result['training_samples']} train (×2 aug = {result['training_samples']*2})  "
          f"+ {int(result['training_samples'] * 0.25)} val")

    # ── Detailed metrics ───────────────────────────────────────────────────────
    X, y = lstm.preprocess_cached_data(df)
    val_split = int(len(X) * 0.8)
    X_val, y_val = X[val_split:], y[val_split:]

    y_pred_s = lstm.model.predict(X_val, verbose=0).flatten()
    y_true   = lstm.target_scaler.inverse_transform(y_val.reshape(-1,1)).flatten()
    y_pred   = lstm.target_scaler.inverse_transform(y_pred_s.reshape(-1,1)).flatten()

    mae   = mean_absolute_error(y_true, y_pred)
    rmse  = np.sqrt(mean_squared_error(y_true, y_pred))
    r2    = r2_score(y_true, y_pred)
    # MAPE — guard against near-zero true values
    mape  = np.mean(np.abs((y_true - y_pred) / np.maximum(np.abs(y_true), 1))) * 100
    trange = df['pollution_level'].max() - df['pollution_level'].min()
    nrmse = (rmse / trange * 100) if trange > 0 else float('nan')

    true_diff = np.diff(y_true)
    pred_diff = np.diff(y_pred)
    dir_acc   = np.mean(np.sign(true_diff) == np.sign(pred_diff)) * 100

    residuals = np.abs(y_true - y_pred)
    w5  = np.mean(residuals <= 5)  * 100
    w10 = np.mean(residuals <= 10) * 100
    w15 = np.mean(residuals <= 15) * 100

    r2_ok  = "✅" if r2      >= 0.80 else "⚠ "
    da_ok  = "✅" if dir_acc >= 80   else "⚠ "
    w10_ok = "✅" if w10     >= 80   else "⚠ "

    print(f"│")
    print(f"│  ── Validation Metrics (held-out 20%, {len(y_val)} samples) ──")
    print(f"│  MAE               : {mae:.3f}  (avg error in pollution units)")
    print(f"│  RMSE              : {rmse:.3f}")
    print(f"│  NRMSE             : {nrmse:.1f}%  (lower = better)")
    print(f"│  R² Score          : {r2:.4f}  {r2_ok}  (target ≥ 0.80)")
    print(f"│  MAPE              : {mape:.1f}%")
    print(f"│  Directional Acc.  : {dir_acc:.1f}%  {da_ok}  (target ≥ 80%)")
    print(f"│  Within ±5 units   : {w5:.1f}%")
    print(f"│  Within ±10 units  : {w10:.1f}%  {w10_ok}  (target ≥ 80%)")
    print(f"│  Within ±15 units  : {w15:.1f}%")
    print(f"└{'─'*60}")

    all_results[region] = dict(
        epochs=result['epochs_trained'], train_sec=round(elapsed,1),
        mae=round(mae,3), rmse=round(rmse,3), nrmse=round(nrmse,1),
        r2=round(r2,4), mape=round(mape,1),
        dir_acc=round(dir_acc,1), w5=round(w5,1),
        w10=round(w10,1), w15=round(w15,1),
    )

# ── Summary table ──────────────────────────────────────────────────────────────
print()
print("╔══════════════════════════════════════════════════════════════╗")
print("║                     SUMMARY TABLE                           ║")
print("╠══════════════════════════════════════════════════════════════╣")
print(f"║  {'Region':<14} {'R²':>6}  {'DirAcc%':>8}  {'±10%':>6}  {'MAE':>6}  {'RMSE':>6} ║")
print(f"║  {'─'*14} {'─'*6}  {'─'*8}  {'─'*6}  {'─'*6}  {'─'*6} ║")
for r, m in all_results.items():
    r2_s  = f"{m['r2']:.4f}" + ("✅" if m['r2']      >= 0.80 else "⚠ ")
    da_s  = f"{m['dir_acc']:.1f}" + ("✅" if m['dir_acc'] >= 80   else "⚠ ")
    w10_s = f"{m['w10']:.1f}" + ("✅" if m['w10']     >= 80   else "⚠ ")
    print(f"║  {r:<14} {r2_s:>8}  {da_s:>10}  {w10_s:>8}  {m['mae']:>6}  {m['rmse']:>6} ║")
print("╠══════════════════════════════════════════════════════════════╣")
print("║  ✅ = meets ≥80% accuracy target   ⚠  = needs attention     ║")
print("╚══════════════════════════════════════════════════════════════╝")

with open('lstm_accuracy_results.json', 'w') as f:
    json.dump(all_results, f, indent=2)
print(f"\n  Results saved → backend/lstm_accuracy_results.json\n")
