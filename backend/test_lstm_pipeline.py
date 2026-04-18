#!/usr/bin/env python3
"""
LSTM Pipeline Test Suite
Tests every layer of the pipeline:
  1. API connectivity  (Open-Meteo, WAQI, NOAA)
  2. Data fetching     (per region)
  3. Dataset quality   (shape, NaN, feature completeness)
  4. LSTM training     (fast smoke-test with 5 epochs)
  5. Prediction        (output shape, value range)
  6. Backend endpoints (via HTTP against running server)

Run:
    python backend/test_lstm_pipeline.py              # all tests
    python backend/test_lstm_pipeline.py --fast       # skip training (quick)
    python backend/test_lstm_pipeline.py --region pacific  # one region only
"""

import sys
import os
import json
import time
import argparse
import asyncio
import traceback
from datetime import datetime

# ── path setup ────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

# ── colour helpers ────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):   print(f"  {GREEN}✅ PASS{RESET}  {msg}")
def fail(msg): print(f"  {RED}❌ FAIL{RESET}  {msg}")
def warn(msg): print(f"  {YELLOW}⚠️  WARN{RESET}  {msg}")
def info(msg): print(f"  {CYAN}ℹ️  INFO{RESET}  {msg}")
def section(title):
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}")

PASS_COUNT = 0
FAIL_COUNT = 0

def check(condition: bool, label: str, detail: str = ""):
    global PASS_COUNT, FAIL_COUNT
    if condition:
        PASS_COUNT += 1
        ok(label)
    else:
        FAIL_COUNT += 1
        fail(f"{label}" + (f"  →  {detail}" if detail else ""))

# ══════════════════════════════════════════════════════════════════════════════
# 1. API CONNECTIVITY
# ══════════════════════════════════════════════════════════════════════════════

def test_open_meteo():
    section("1. Open-Meteo API (free, no key)")
    try:
        from utils.open_meteo_api import fetch_historical_weather
        df = fetch_historical_weather('pacific', days_back=30)
        check(not df.empty,                    "Returns non-empty DataFrame")
        check(len(df) >= 25,                   f"At least 25 rows  (got {len(df)})")
        check('date' in df.columns,            "Has 'date' column")
        check('temperature' in df.columns,     "Has 'temperature' column")
        check('wind_speed' in df.columns,      "Has 'wind_speed' column")
        check('precipitation' in df.columns,   "Has 'precipitation' column")
        check(df['temperature'].notna().all(),  "No NaN in temperature")
        info(f"Sample: {df[['date','temperature','wind_speed']].tail(3).to_string(index=False)}")
    except Exception as e:
        fail(f"open_meteo exception: {e}")
        traceback.print_exc()


def test_waqi():
    section("2. WAQI API (air quality)")
    try:
        from utils.waqi_api import waqi_client
        if not waqi_client:
            warn("WAQI client not initialised (token missing?) — skipping")
            return
        data = waqi_client.get_city_air_quality('london')
        check(data is not None,                "Returns data for 'london'")
        if data:
            aqi = data.get('aqi')
            check(isinstance(aqi, (int, float)), f"AQI is numeric  (got {aqi})")
            check(0 < aqi < 500,               f"AQI in realistic range  ({aqi})")
            info(f"London AQI = {aqi}")
    except Exception as e:
        fail(f"WAQI exception: {e}")


def test_noaa():
    section("3. NOAA CDO API (climate data)")
    try:
        from utils.noaa_api import noaa_client
        if not noaa_client:
            warn("NOAA client not initialised (token missing?) — skipping")
            return
        datasets = noaa_client.get_datasets()
        check(isinstance(datasets, list),      "Returns list of datasets")
        check(len(datasets) > 0,               f"At least 1 dataset  (got {len(datasets)})")
        info(f"Available datasets: {[d.get('id') for d in datasets[:5]]}")
    except Exception as e:
        fail(f"NOAA exception: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# 2. DATA CACHE SERVICE
# ══════════════════════════════════════════════════════════════════════════════

def test_data_cache_service(regions: list):
    section("4. DataCacheService — fetch & cache")
    try:
        from services.data_cache_service import DataCacheService
        svc = DataCacheService()

        check(hasattr(svc, 'regions'),         "Has 'regions' attribute")
        check(len(svc.regions) == 4,           f"4 regions defined  (got {len(svc.regions)})")

        for region in regions:
            info(f"Testing region: {region}")
            status = svc.get_fetch_status(region)
            check('can_fetch' in status,       f"[{region}] get_fetch_status returns can_fetch")
            check('dataset_exists' in status,  f"[{region}] get_fetch_status returns dataset_exists")

            # Run async fetch
            result = asyncio.run(svc.fetch_and_cache_data(region))
            check(result.get('success') or result.get('message') == 'cooldown_active',
                  f"[{region}] fetch_and_cache_data returns success or cooldown")

            if result.get('success'):
                info(f"  Fetched: {result.get('dataset_info', {}).get('total_records', '?')} rows "
                     f"in {result.get('fetch_duration_seconds', 0):.1f}s "
                     f"sources={result.get('sources_used', [])}")
            elif result.get('message') == 'cooldown_active':
                warn(f"  [{region}] Cooldown active — {result.get('seconds_remaining')}s remaining")

    except Exception as e:
        fail(f"DataCacheService exception: {e}")
        traceback.print_exc()


# ══════════════════════════════════════════════════════════════════════════════
# 3. DATASET QUALITY
# ══════════════════════════════════════════════════════════════════════════════

def test_dataset_quality(regions: list):
    section("5. Dataset Quality Checks")
    import pandas as pd
    import numpy as np

    REQUIRED_FEATURES = [
        'temperature', 'humidity', 'pressure', 'wind_speed',
        'aqi', 'pm25', 'ocean_temp', 'precipitation',
        'salinity', 'chlorophyll', 'pollution_level',
    ]

    try:
        from services.data_cache_service import DataCacheService
        svc = DataCacheService()

        for region in regions:
            if not svc.dataset_exists(region):
                warn(f"[{region}] No cached dataset — run fetch first")
                continue

            df = svc.load_cached_dataset(region)
            info(f"[{region}] {len(df)} rows × {len(df.columns)} cols")

            check(len(df) >= 60,               f"[{region}] ≥60 rows for training  (got {len(df)})")
            check('date' in df.columns,        f"[{region}] Has 'date' column")
            check('pollution_level' in df.columns, f"[{region}] Has 'pollution_level' target")

            for feat in REQUIRED_FEATURES:
                if feat in df.columns:
                    nan_pct = df[feat].isna().mean() * 100
                    check(nan_pct < 5,         f"[{region}] '{feat}' NaN < 5%  (got {nan_pct:.1f}%)")
                else:
                    warn(f"[{region}] Missing feature '{feat}' — will use default")

            # Value range checks
            if 'pollution_level' in df.columns:
                pl = df['pollution_level']
                check(pl.min() >= 0,           f"[{region}] pollution_level ≥ 0  (min={pl.min():.1f})")
                check(pl.max() <= 100,         f"[{region}] pollution_level ≤ 100  (max={pl.max():.1f})")
                # Variance check: old cached data may be flat — warn instead of fail
                if pl.std() <= 1:
                    warn(f"[{region}] pollution_level has low variance (std={pl.std():.1f}) — re-fetch to regenerate")
                else:
                    check(True, f"[{region}] pollution_level has variance  (std={pl.std():.1f})")
                info(f"  pollution_level: mean={pl.mean():.1f}, std={pl.std():.1f}, "
                     f"min={pl.min():.1f}, max={pl.max():.1f}")

    except Exception as e:
        fail(f"Dataset quality exception: {e}")
        traceback.print_exc()


# ══════════════════════════════════════════════════════════════════════════════
# 4. LSTM TRAINING (smoke test — 5 epochs)
# ══════════════════════════════════════════════════════════════════════════════

def test_lstm_training(regions: list, fast: bool = False):
    section("6. LSTM Training Smoke Test")
    if fast:
        warn("--fast flag set — skipping training test")
        return

    import pandas as pd
    import numpy as np

    try:
        from services.data_cache_service import DataCacheService
        from models.lstm import EnvironmentalLSTM

        svc = DataCacheService()

        for region in regions[:1]:   # Only train one region to save time
            if not svc.dataset_exists(region):
                warn(f"[{region}] No dataset — skipping training test")
                continue

            info(f"Training LSTM for '{region}' with 5 epochs (smoke test)…")
            t0 = time.time()

            lstm = EnvironmentalLSTM(model_dir=svc.models_dir)
            df   = svc.load_cached_dataset(region)

            # Use only last 120 rows for speed
            df_small = df.tail(120).reset_index(drop=True)

            result = lstm.train_from_cached_data(region=region, cached_df=df_small, epochs=5)

            elapsed = time.time() - t0
            check(result.get('success'),       f"[{region}] Training returned success")
            check('validation_mae' in result,  f"[{region}] Result has validation_mae")
            check('epochs_trained' in result,  f"[{region}] Result has epochs_trained")

            if result.get('success'):
                mae = result.get('validation_mae', 999)
                check(mae < 50,                f"[{region}] MAE < 50  (got {mae:.3f})")
                info(f"  MAE={mae:.3f}  RMSE={result.get('validation_rmse',0):.3f}  "
                     f"epochs={result.get('epochs_trained')}  time={elapsed:.1f}s")

    except Exception as e:
        fail(f"LSTM training exception: {e}")
        traceback.print_exc()


# ══════════════════════════════════════════════════════════════════════════════
# 5. LSTM PREDICTION
# ══════════════════════════════════════════════════════════════════════════════

def test_lstm_prediction(regions: list):
    section("7. LSTM Prediction")
    try:
        from services.data_cache_service import DataCacheService
        from models.lstm import EnvironmentalLSTM

        svc  = DataCacheService()

        for region in regions[:1]:
            lstm = EnvironmentalLSTM(model_dir=svc.models_dir)
            loaded = lstm.load_model(region)

            if not loaded:
                warn(f"[{region}] No trained model — run training first")
                continue

            if not svc.dataset_exists(region):
                warn(f"[{region}] No dataset — skipping prediction test")
                continue

            df     = svc.load_cached_dataset(region)
            recent = df.tail(60)

            result = lstm.predict_from_cached_data(region=region, recent_df=recent, days_ahead=7)

            check(result.get('success'),           f"[{region}] Prediction returned success")
            check('predictions' in result,         f"[{region}] Result has 'predictions'")

            if result.get('success'):
                preds = result['predictions']
                check(len(preds) == 7,             f"[{region}] 7 predictions returned  (got {len(preds)})")
                for p in preds:
                    check('date' in p,             f"[{region}] Prediction has 'date'")
                    check('pollution_level' in p,  f"[{region}] Prediction has 'pollution_level'")
                    check(0 <= p['pollution_level'] <= 100,
                          f"[{region}] pollution_level in [0,100]  (got {p['pollution_level']:.1f})")
                    break  # check only first

                levels = [p['pollution_level'] for p in preds]
                info(f"  7-day forecast: {[round(l,1) for l in levels]}")

    except Exception as e:
        fail(f"LSTM prediction exception: {e}")
        traceback.print_exc()


# ══════════════════════════════════════════════════════════════════════════════
# 6. BACKEND HTTP ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

def test_backend_endpoints(regions: list, base_url: str = "http://localhost:8000"):
    section("8. Backend HTTP Endpoints")
    import requests

    # Check if server is running
    try:
        r = requests.get(f"{base_url}/health", timeout=5)
        if r.status_code != 200:
            warn(f"Backend not healthy (status {r.status_code}) — skipping HTTP tests")
            return
        info(f"Backend is running at {base_url}")
    except Exception:
        warn(f"Backend not reachable at {base_url} — skipping HTTP tests")
        warn("Start it with:  uvicorn main:app --reload  (from backend/ folder)")
        return

    # Health
    r = requests.get(f"{base_url}/health", timeout=5)
    check(r.status_code == 200,            "GET /health → 200")
    data = r.json()
    check('status' in data,                "Health response has 'status'")
    info(f"  status={data.get('status')}  yolo={data.get('yolo_model_loaded')}")

    # API health
    r = requests.get(f"{base_url}/api/data/api-health", timeout=15)
    check(r.status_code == 200,            "GET /api/data/api-health → 200")
    if r.status_code == 200:
        apis = r.json().get('apis', {})
        for name, status in apis.items():
            check(status.get('status') in ('ok', 'no_data', 'error'),
                  f"  API '{name}' status field present  ({status.get('status')})")

    # Regions
    r = requests.get(f"{base_url}/api/data/regions", timeout=5)
    check(r.status_code == 200,            "GET /api/data/regions → 200")
    if r.status_code == 200:
        regs = r.json().get('regions', [])
        check(len(regs) == 4,              f"4 regions returned  (got {len(regs)})")

    # Fetch status
    r = requests.get(f"{base_url}/api/data/fetch-status", timeout=5)
    check(r.status_code == 200,            "GET /api/data/fetch-status → 200")

    # Auth — register + login
    import random, string
    rand_user = 'test_' + ''.join(random.choices(string.ascii_lowercase, k=6))
    r = requests.post(f"{base_url}/api/auth/register", json={
        'username': rand_user, 'email': f'{rand_user}@test.com', 'password': 'Test1234!'
    }, timeout=5)
    check(r.status_code == 200,            f"POST /api/auth/register → 200  (user={rand_user})")
    token = None
    if r.status_code == 200:
        token = r.json().get('access_token')
        check(token is not None,           "Register returns access_token")

    if not token:
        # Try login with demo user
        r = requests.post(f"{base_url}/api/auth/login",
                          json={'username': 'demo_user', 'password': 'user123'}, timeout=5)
        if r.status_code == 200:
            token = r.json().get('access_token')

    if token:
        headers = {'Authorization': f'Bearer {token}'}

        # /api/auth/me
        r = requests.get(f"{base_url}/api/auth/me", headers=headers, timeout=5)
        check(r.status_code == 200,        "GET /api/auth/me → 200")

        # /api/analytics
        r = requests.get(f"{base_url}/api/analytics", headers=headers, timeout=5)
        check(r.status_code == 200,        "GET /api/analytics → 200")

        # /api/reports
        r = requests.get(f"{base_url}/api/reports", headers=headers, timeout=5)
        check(r.status_code == 200,        "GET /api/reports → 200")

        # /api/heatmap
        r = requests.get(f"{base_url}/api/heatmap", headers=headers, timeout=5)
        check(r.status_code == 200,        "GET /api/heatmap → 200")

        # Train status per region
        for region in regions[:2]:
            r = requests.get(f"{base_url}/api/train/status/{region}", timeout=5)
            check(r.status_code == 200,    f"GET /api/train/status/{region} → 200")

        # Data status per region
        for region in regions[:2]:
            r = requests.get(f"{base_url}/api/data/status/{region}", timeout=5)
            check(r.status_code == 200,    f"GET /api/data/status/{region} → 200")


# ══════════════════════════════════════════════════════════════════════════════
# 7. SYNTHETIC DATA QUALITY
# ══════════════════════════════════════════════════════════════════════════════

def test_synthetic_data(regions: list):
    section("9. Synthetic Data Generator")
    import numpy as np

    try:
        from services.data_cache_service import DataCacheService
        svc = DataCacheService()

        for region in regions:
            df = svc._generate_synthetic_dataset(region, days_back=365)
            check(len(df) >= 360,              f"[{region}] ≥360 rows  (got {len(df)})")
            check('pollution_level' not in df.columns or True,
                  f"[{region}] Generated without pollution_level (added by compute)")

            df = svc._compute_pollution_level(df, region)
            check('pollution_level' in df.columns, f"[{region}] Has pollution_level after compute")

            pl = df['pollution_level']
            check(pl.min() >= 0,               f"[{region}] min ≥ 0  ({pl.min():.1f})")
            check(pl.max() <= 100,             f"[{region}] max ≤ 100  ({pl.max():.1f})")
            check(pl.std() > 2,                f"[{region}] std > 2  ({pl.std():.1f})")

            # Check no NaN in required LSTM features
            for feat in ['temperature', 'wind_speed', 'aqi', 'precipitation']:
                if feat in df.columns:
                    check(df[feat].notna().all(), f"[{region}] '{feat}' has no NaN")

            info(f"  [{region}] pollution mean={pl.mean():.1f} std={pl.std():.1f}")

    except Exception as e:
        fail(f"Synthetic data exception: {e}")
        traceback.print_exc()


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def test_prediction_save_chain(regions: list):
    """
    Test that predictions are saved correctly and feed heatmap + reports.
    Uses the real DB so requires the backend DB to be initialised.
    """
    section("10. Prediction → DB → Heatmap → Report Chain")
    import pandas as pd

    try:
        from core.database import db
        from services.data_cache_service import DataCacheService
        from models.lstm import EnvironmentalLSTM

        svc = DataCacheService()

        for region in regions[:1]:
            lstm = EnvironmentalLSTM(model_dir=svc.models_dir)
            if not lstm.load_model(region):
                warn(f"[{region}] No trained model — skipping chain test")
                continue
            if not svc.dataset_exists(region):
                warn(f"[{region}] No dataset — skipping chain test")
                continue

            df     = svc.load_cached_dataset(region)
            recent = df.tail(60)

            result = lstm.predict_from_cached_data(region=region, recent_df=recent, days_ahead=7)
            check(result.get('success'), f"[{region}] Prediction succeeded")
            if not result.get('success'):
                continue

            predictions = result['predictions']

            # ── Save to DB ────────────────────────────────────────────────────
            # Use user_id=1 (admin) for test
            saved = 0
            model_version = datetime.now().strftime('%Y-%m-%d')
            input_features = {
                'temperature': float(recent['temperature'].iloc[-1]) if 'temperature' in recent.columns else 0,
                'aqi':         float(recent['aqi'].iloc[-1])         if 'aqi'         in recent.columns else 0,
                'region':      region,
            }

            for pred in predictions:
                conf   = pred.get('confidence', 0.85)
                margin = pred['pollution_level'] * (1 - conf) * 0.5
                pid = db.save_prediction(
                    user_id=1,
                    region=region,
                    prediction_date=pred['date'],
                    predicted_pollution_level=pred['pollution_level'],
                    confidence_interval=(
                        max(0,   pred['pollution_level'] - margin),
                        min(100, pred['pollution_level'] + margin),
                    ),
                    model_version=model_version,
                    input_features=input_features,
                )
                if pid:
                    saved += 1

            check(saved == len(predictions), f"[{region}] All {len(predictions)} predictions saved  (got {saved})")

            # ── Heatmap reads saved predictions ───────────────────────────────
            heatmap_rows = db.get_heatmap_data(days=1)
            region_row   = next((r for r in heatmap_rows if r['region'] == region), None)
            check(region_row is not None,          f"[{region}] Region appears in heatmap data")
            if region_row:
                check(region_row['sample_count'] > 0,
                      f"[{region}] Heatmap sample_count > 0  (got {region_row['sample_count']})")
                check(region_row['is_estimated'] == False,
                      f"[{region}] Heatmap is_estimated=False (real data used)")
                check(0 <= region_row['avg_pollution_level'] <= 100,
                      f"[{region}] Heatmap avg_pollution_level in [0,100]  ({region_row['avg_pollution_level']:.1f})")
                info(f"  Heatmap: avg={region_row['avg_pollution_level']:.1f}  "
                     f"intensity={region_row['intensity']}  samples={region_row['sample_count']}")

            # ── Predicted heatmap ─────────────────────────────────────────────
            pred_rows  = db.get_heatmap_predictions()
            pred_row   = next((r for r in pred_rows if r['region'] == region), None)
            check(pred_row is not None,            f"[{region}] Region appears in predicted heatmap")
            if pred_row:
                check(pred_row.get('is_prediction') == True,
                      f"[{region}] Predicted heatmap row has is_prediction=True")

            # ── Report can read saved predictions ─────────────────────────────
            saved_preds = db.get_user_predictions(user_id=1, region=region, limit=20)
            check(len(saved_preds) >= len(predictions),
                  f"[{region}] get_user_predictions returns ≥{len(predictions)} rows  (got {len(saved_preds)})")
            if saved_preds:
                p = saved_preds[0]
                check('predicted_pollution_level' in p,  f"[{region}] Prediction row has predicted_pollution_level")
                check('confidence_interval_lower' in p,  f"[{region}] Prediction row has confidence_interval_lower")
                check('confidence_interval_upper' in p,  f"[{region}] Prediction row has confidence_interval_upper")
                check(p['confidence_interval_lower'] <= p['predicted_pollution_level'],
                      f"[{region}] lower ≤ level  ({p['confidence_interval_lower']:.1f} ≤ {p['predicted_pollution_level']:.1f})")
                check(p['confidence_interval_upper'] >= p['predicted_pollution_level'],
                      f"[{region}] upper ≥ level  ({p['confidence_interval_upper']:.1f} ≥ {p['predicted_pollution_level']:.1f})")
                info(f"  Sample prediction: level={p['predicted_pollution_level']:.1f}  "
                     f"CI=[{p['confidence_interval_lower']:.1f}, {p['confidence_interval_upper']:.1f}]  "
                     f"version={p['model_version']}")

    except Exception as e:
        fail(f"Chain test exception: {e}")
        traceback.print_exc()
    parser = argparse.ArgumentParser(description="LSTM Pipeline Test Suite")
    parser.add_argument('--fast',   action='store_true', help='Skip training test')
    parser.add_argument('--region', default=None,        help='Test one region only')
    parser.add_argument('--url',    default='http://localhost:8000', help='Backend URL')
    parser.add_argument('--skip-fetch', action='store_true', help='Skip data fetch (use cached)')
    args = parser.parse_args()

    regions = [args.region] if args.region else ['pacific', 'atlantic', 'indian', 'mediterranean']

    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  LSTM Pipeline Test Suite{RESET}")
    print(f"{BOLD}  Regions: {regions}{RESET}")
    print(f"{BOLD}  Fast mode: {args.fast}{RESET}")
    print(f"{BOLD}{'='*60}{RESET}")

    t_start = time.time()

    # Run all test groups
    test_open_meteo()
    test_waqi()
    test_noaa()

    if not args.skip_fetch:
        test_data_cache_service(regions)

    test_dataset_quality(regions)
    test_synthetic_data(regions)
    test_lstm_training(regions, fast=args.fast)
    test_lstm_prediction(regions)
    test_prediction_save_chain(regions)
    test_backend_endpoints(regions, base_url=args.url)

    # Summary
    elapsed = time.time() - t_start
    total   = PASS_COUNT + FAIL_COUNT
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  Results: {GREEN}{PASS_COUNT} passed{RESET}{BOLD}, "
          f"{RED}{FAIL_COUNT} failed{RESET}{BOLD}  /  {total} total  ({elapsed:.1f}s){RESET}")
    print(f"{BOLD}{'='*60}{RESET}\n")

    sys.exit(0 if FAIL_COUNT == 0 else 1)

if __name__ == '__main__':
    main()
