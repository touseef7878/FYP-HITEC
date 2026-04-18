"""
Open-Meteo Historical Weather API
Free, no API key required — provides up to 80 years of historical weather data.
https://open-meteo.com/en/docs/historical-weather-api
"""

import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

# Coastal coordinates representative of each marine region
REGION_COORDS = {
    'pacific':       {'lat': 34.05,  'lon': -118.24, 'name': 'Los Angeles (Pacific coast)'},
    'atlantic':      {'lat': 40.71,  'lon': -74.01,  'name': 'New York (Atlantic coast)'},
    'indian':        {'lat': 19.08,  'lon': 72.88,   'name': 'Mumbai (Indian Ocean coast)'},
    'mediterranean': {'lat': 41.39,  'lon': 2.15,    'name': 'Barcelona (Mediterranean coast)'},
}

ARCHIVE_URL  = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

DAILY_VARS = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "windspeed_10m_max",
    "pressure_msl_mean",
    "shortwave_radiation_sum",
]


def fetch_historical_weather(region: str, days_back: int = 730) -> pd.DataFrame:
    """
    Fetch historical daily weather from Open-Meteo archive.
    Free, no API key, up to 80 years of data.

    Returns a DataFrame with columns:
        date, temperature, temperature_max, temperature_min,
        precipitation, wind_speed, pressure, solar_radiation
    """
    coords = REGION_COORDS.get(region)
    if not coords:
        logger.warning(f"Unknown region '{region}' for Open-Meteo, using fallback")
        return _synthetic_fallback(region, days_back)

    end_date   = datetime.now().date()
    # Archive API lags ~5 days behind real-time
    end_date   = end_date - timedelta(days=5)
    start_date = end_date - timedelta(days=days_back)

    params = {
        "latitude":   coords["lat"],
        "longitude":  coords["lon"],
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date":   end_date.strftime("%Y-%m-%d"),
        "daily":      ",".join(DAILY_VARS),
        "timezone":   "UTC",
    }

    try:
        logger.info(f"📡 Open-Meteo: fetching {days_back}d weather for {region} ({coords['name']})")
        resp = requests.get(ARCHIVE_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        daily = data.get("daily", {})
        if not daily or not daily.get("time"):
            logger.warning(f"Open-Meteo returned empty data for {region}")
            return _synthetic_fallback(region, days_back)

        df = pd.DataFrame({
            "date":             pd.to_datetime(daily["time"]),
            "temperature_max":  daily.get("temperature_2m_max",  [np.nan] * len(daily["time"])),
            "temperature_min":  daily.get("temperature_2m_min",  [np.nan] * len(daily["time"])),
            "precipitation":    daily.get("precipitation_sum",   [np.nan] * len(daily["time"])),
            "wind_speed":       daily.get("windspeed_10m_max",   [np.nan] * len(daily["time"])),
            "pressure":         daily.get("pressure_msl_mean",   [np.nan] * len(daily["time"])),
            "solar_radiation":  daily.get("shortwave_radiation_sum", [np.nan] * len(daily["time"])),
        })

        # Derived average temperature
        df["temperature"] = (df["temperature_max"] + df["temperature_min"]) / 2

        # Fill any gaps
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        df[numeric_cols] = df[numeric_cols].interpolate(method="linear").ffill().bfill()

        logger.info(f"✅ Open-Meteo: {len(df)} days for {region}")
        return df

    except Exception as e:
        logger.error(f"Open-Meteo fetch failed for {region}: {e}")
        return _synthetic_fallback(region, days_back)


def _synthetic_fallback(region: str, days_back: int) -> pd.DataFrame:
    """High-quality synthetic weather when API is unavailable."""
    region_params = {
        'pacific':       {'base_temp': 17, 'temp_range': 8,  'base_precip': 1.5, 'base_wind': 5},
        'atlantic':      {'base_temp': 14, 'temp_range': 12, 'base_precip': 2.5, 'base_wind': 7},
        'indian':        {'base_temp': 27, 'temp_range': 5,  'base_precip': 3.0, 'base_wind': 4},
        'mediterranean': {'base_temp': 18, 'temp_range': 14, 'base_precip': 1.0, 'base_wind': 4},
    }
    p = region_params.get(region, region_params['atlantic'])

    end   = datetime.now().date()
    start = end - timedelta(days=days_back)
    dates = pd.date_range(start=start, end=end, freq='D')

    rng = np.random.default_rng(hash(region) % (2**32))
    rows = []
    for d in dates:
        doy = d.timetuple().tm_yday
        s   = np.sin(2 * np.pi * (doy - 80) / 365.25)
        t   = p['base_temp'] + s * p['temp_range'] + rng.normal(0, 2)
        rows.append({
            'date':            pd.Timestamp(d),
            'temperature':     t,
            'temperature_max': t + rng.uniform(2, 6),
            'temperature_min': t - rng.uniform(2, 5),
            'precipitation':   max(0, rng.exponential(p['base_precip'])),
            'wind_speed':      max(0, rng.exponential(p['base_wind'])),
            'pressure':        1013.25 + rng.normal(0, 8),
            'solar_radiation': max(0, 150 + s * 100 + rng.normal(0, 20)),
        })
    return pd.DataFrame(rows)
