"""
Data Cache Service
Handles data fetching and local caching for LSTM training.
Re-fetch is allowed after a 1-hour cooldown per region.
"""

import os
import pandas as pd
import numpy as np
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor
import json

# Import API clients
from utils.noaa_api import noaa_client
from utils.waqi_api import waqi_client

logger = logging.getLogger(__name__)

FETCH_COOLDOWN_SECONDS = 3600  # 1 hour

class DataCacheService:
    """
    Service for fetching and caching environmental data
    Data is fetched only once and stored locally
    """
    
    def __init__(self):
        self.cache_dir = os.path.join(os.path.dirname(__file__), "data_cache")
        self.models_dir = os.path.join(os.path.dirname(__file__), "models")
        
        # Ensure directories exist
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.models_dir, exist_ok=True)
        
        # Supported regions
        self.regions = ['pacific', 'atlantic', 'indian', 'mediterranean']
        
        # WAQI cities for parallel fetching
        self.waqi_cities = {
            'pacific': ['los-angeles', 'san-francisco', 'seattle', 'tokyo', 'shanghai', 'vancouver'],
            'atlantic': ['new-york', 'boston', 'miami', 'london', 'lisbon', 'casablanca'],
            'indian': ['mumbai', 'chennai', 'colombo', 'perth', 'durban', 'jakarta'],
            'mediterranean': ['barcelona', 'marseille', 'rome', 'athens', 'istanbul', 'alexandria']
        }
        
        # NOAA station limits for efficient fetching
        self.noaa_station_limit = 10
        self.min_data_days = 300  # Stop retries once we have 300+ days
        
        logger.info("✅ Data Cache Service initialized")
    
    # ==================== COOLDOWN HELPERS ====================

    def _cooldown_path(self, region: str) -> str:
        return os.path.join(self.cache_dir, f"{region}_last_fetch.json")

    def get_fetch_status(self, region: str) -> Dict:
        """
        Return cooldown info for a region.
        {
          can_fetch: bool,
          last_fetched_at: str | None,
          next_fetch_at: str | None,
          seconds_remaining: int,
          dataset_exists: bool
        }
        """
        path = self._cooldown_path(region)
        dataset_exists = self.dataset_exists(region)

        if not os.path.exists(path):
            return {
                "can_fetch": True,
                "last_fetched_at": None,
                "next_fetch_at": None,
                "seconds_remaining": 0,
                "dataset_exists": dataset_exists,
            }

        try:
            with open(path) as f:
                meta = json.load(f)
            last_ts = datetime.fromisoformat(meta["fetched_at"])
            next_ts = last_ts + timedelta(seconds=FETCH_COOLDOWN_SECONDS)
            now = datetime.now()
            remaining = max(0, int((next_ts - now).total_seconds()))
            return {
                "can_fetch": remaining == 0,
                "last_fetched_at": last_ts.isoformat(),
                "next_fetch_at": next_ts.isoformat(),
                "seconds_remaining": remaining,
                "dataset_exists": dataset_exists,
            }
        except Exception as e:
            logger.warning(f"Could not read cooldown file for {region}: {e}")
            return {
                "can_fetch": True,
                "last_fetched_at": None,
                "next_fetch_at": None,
                "seconds_remaining": 0,
                "dataset_exists": dataset_exists,
            }

    def _record_fetch(self, region: str) -> None:
        """Write the current timestamp as the last fetch time for a region."""
        path = self._cooldown_path(region)
        with open(path, "w") as f:
            json.dump({"fetched_at": datetime.now().isoformat()}, f)
    
    def get_dataset_path(self, region: str) -> str:
        """Get the file path for a region's dataset"""
        return os.path.join(self.cache_dir, f"{region}_dataset.csv")
    
    def get_model_path(self, region: str) -> str:
        """Get the file path for a region's trained model"""
        return os.path.join(self.models_dir, f"{region}_lstm.h5")
    
    def dataset_exists(self, region: str) -> bool:
        """Check if dataset already exists for a region"""
        dataset_path = self.get_dataset_path(region)
        return os.path.exists(dataset_path) and os.path.getsize(dataset_path) > 0
    
    def get_dataset_info(self, region: str) -> Optional[Dict]:
        """Get information about cached dataset"""
        if not self.dataset_exists(region):
            return None
        
        try:
            dataset_path = self.get_dataset_path(region)
            df = pd.read_csv(dataset_path, parse_dates=['date'])
            
            return {
                'region': region,
                'file_path': dataset_path,
                'file_size_mb': round(os.path.getsize(dataset_path) / 1024 / 1024, 2),
                'total_records': len(df),
                'date_range': {
                    'start': df['date'].min().strftime('%Y-%m-%d'),
                    'end': df['date'].max().strftime('%Y-%m-%d')
                },
                'features': list(df.columns),
                'created_at': datetime.fromtimestamp(os.path.getctime(dataset_path)).strftime('%Y-%m-%d %H:%M:%S')
            }
        except Exception as e:
            logger.error(f"Error reading dataset info for {region}: {e}")
            return None
    
    async def fetch_waqi_data_parallel(self, region: str, days_back: int = 365) -> pd.DataFrame:
        """Fetch WAQI data using parallel requests"""
        logger.info(f"Fetching WAQI data for {region} using parallel requests...")
        
        cities = self.waqi_cities.get(region, [])
        if not cities:
            logger.warning(f"No WAQI cities configured for {region}")
            return pd.DataFrame()
        
        def fetch_city_data(city: str) -> Optional[Dict]:
            """Fetch data for a single city"""
            try:
                if waqi_client:
                    return waqi_client.get_city_air_quality(city)
                return None
            except Exception as e:
                logger.error(f"Error fetching WAQI data for {city}: {e}")
                return None
        
        # Use ThreadPoolExecutor for parallel API calls
        with ThreadPoolExecutor(max_workers=5) as executor:
            city_data_futures = {
                executor.submit(fetch_city_data, city): city 
                for city in cities
            }
            
            city_results = []
            for future in city_data_futures:
                city = city_data_futures[future]
                try:
                    result = future.result(timeout=30)
                    if result:
                        city_results.append({
                            'city': city,
                            'data': result
                        })
                        logger.info(f"✅ Fetched WAQI data for {city}")
                    else:
                        logger.warning(f"⚠️ No WAQI data for {city}")
                except Exception as e:
                    logger.error(f"❌ Failed to fetch WAQI data for {city}: {e}")
        
        if not city_results:
            logger.warning(f"No WAQI data retrieved for {region}")
            return self._generate_fallback_waqi_data(region, days_back)
        
        # Convert to historical time series
        return self._convert_waqi_to_timeseries(city_results, region, days_back)
    
    async def fetch_noaa_data_parallel(self, region: str, days_back: int = 365) -> pd.DataFrame:
        """Fetch NOAA data with station retry logic"""
        logger.info(f"Fetching NOAA data for {region} with retry logic...")
        
        if not noaa_client:
            logger.warning("NOAA client not available")
            return self._generate_fallback_noaa_data(region, days_back)
        
        try:
            # Find stations near the region
            stations = noaa_client.find_stations_near_area(region, limit=20)
            if not stations:
                logger.warning(f"No NOAA stations found for {region}")
                return self._generate_fallback_noaa_data(region, days_back)
            
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            start_str = start_date.strftime('%Y-%m-%d')
            end_str = end_date.strftime('%Y-%m-%d')
            
            def fetch_station_data(station: Dict) -> Optional[pd.DataFrame]:
                """Fetch data from a single station"""
                try:
                    station_id = station['id']
                    data = noaa_client.get_station_data(station_id, start_str, end_str)
                    if not data.empty:
                        logger.info(f"✅ Fetched {len(data)} records from station {station_id}")
                        return data
                    return None
                except Exception as e:
                    logger.error(f"❌ Failed to fetch from station {station['id']}: {e}")
                    return None
            
            # Use ThreadPoolExecutor for parallel station requests
            with ThreadPoolExecutor(max_workers=3) as executor:
                station_futures = {
                    executor.submit(fetch_station_data, station): station 
                    for station in stations[:self.noaa_station_limit]
                }
                
                station_data_list = []
                total_days = 0
                
                for future in station_futures:
                    station = station_futures[future]
                    try:
                        result = future.result(timeout=60)
                        if result is not None and not result.empty:
                            station_data_list.append(result)
                            total_days += len(result)
                            
                            # Stop once we have enough data
                            if total_days >= self.min_data_days:
                                logger.info(f"✅ Collected {total_days} days of data, stopping station queries")
                                break
                                
                    except Exception as e:
                        logger.error(f"❌ Station {station['id']} failed: {e}")
            
            if not station_data_list:
                logger.warning(f"No NOAA data retrieved for {region}")
                return self._generate_fallback_noaa_data(region, days_back)
            
            # Combine station data
            combined_data = pd.concat(station_data_list, ignore_index=True)
            logger.info(f"✅ Combined NOAA data: {len(combined_data)} records from {len(station_data_list)} stations")
            
            return self._process_noaa_data(combined_data, region, days_back)
            
        except Exception as e:
            logger.error(f"Error fetching NOAA data for {region}: {e}")
            return self._generate_fallback_noaa_data(region, days_back)
    
    async def fetch_weather_data_parallel(self, region: str, days_back: int = 365) -> pd.DataFrame:
        """Fetch weather data (simulated for now)"""
        logger.info(f"Generating weather data for {region}...")
        
        # Generate realistic weather data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Region-specific weather patterns
        region_params = {
            'pacific': {'base_temp': 15, 'temp_range': 12, 'base_humidity': 70},
            'atlantic': {'base_temp': 18, 'temp_range': 15, 'base_humidity': 65},
            'indian': {'base_temp': 25, 'temp_range': 8, 'base_humidity': 75},
            'mediterranean': {'base_temp': 20, 'temp_range': 18, 'base_humidity': 60}
        }
        
        params = region_params.get(region, {'base_temp': 18, 'temp_range': 12, 'base_humidity': 65})
        
        weather_data = []
        for i, date in enumerate(dates):
            day_of_year = date.timetuple().tm_yday
            seasonal_factor = np.sin(2 * np.pi * (day_of_year - 80) / 365.25)
            
            weather_data.append({
                'date': date,
                'temperature': params['base_temp'] + seasonal_factor * params['temp_range'] + np.random.normal(0, 3),
                'humidity': max(20, min(100, params['base_humidity'] + np.random.normal(0, 15))),
                'pressure': 1013.25 + np.random.normal(0, 10),
                'wind_speed': max(0, np.random.exponential(8)),
                'precipitation': max(0, np.random.exponential(2))
            })
        
        df = pd.DataFrame(weather_data)
        logger.info(f"✅ Generated {len(df)} days of weather data for {region}")
        return df
    
    async def fetch_marine_data_parallel(self, region: str, days_back: int = 365) -> pd.DataFrame:
        """Fetch marine data (simulated for now)"""
        logger.info(f"Generating marine data for {region}...")
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Region-specific marine parameters
        region_params = {
            'pacific': {'base_temp': 12, 'temp_range': 8, 'base_salinity': 34.5},
            'atlantic': {'base_temp': 15, 'temp_range': 10, 'base_salinity': 35.0},
            'indian': {'base_temp': 22, 'temp_range': 6, 'base_salinity': 34.8},
            'mediterranean': {'base_temp': 18, 'temp_range': 12, 'base_salinity': 38.5}
        }
        
        params = region_params.get(region, {'base_temp': 15, 'temp_range': 8, 'base_salinity': 35.0})
        
        marine_data = []
        for i, date in enumerate(dates):
            day_of_year = date.timetuple().tm_yday
            seasonal_factor = np.sin(2 * np.pi * (day_of_year - 80) / 365.25)
            
            marine_data.append({
                'date': date,
                'ocean_temp': params['base_temp'] + seasonal_factor * params['temp_range'] + np.random.normal(0, 1),
                'salinity': params['base_salinity'] + np.random.normal(0, 0.5),
                'chlorophyll': max(0, np.random.lognormal(0, 0.5)),
                'current_speed': max(0, np.random.exponential(0.5)),
                'wave_height': max(0, np.random.exponential(1.5))
            })
        
        df = pd.DataFrame(marine_data)
        logger.info(f"✅ Generated {len(df)} days of marine data for {region}")
        return df
    
    async def fetch_and_cache_data(self, region: str) -> Dict:
        """
        Fetch all data sources and create/refresh the cached dataset.
        Re-fetch is allowed after FETCH_COOLDOWN_SECONDS (1 hour).
        Returns cooldown info if called too soon.
        """
        if region not in self.regions:
            raise ValueError(f"Invalid region: {region}. Valid regions: {self.regions}")

        status = self.get_fetch_status(region)
        if not status["can_fetch"]:
            return {
                "success": False,
                "message": "cooldown_active",
                "region": region,
                "seconds_remaining": status["seconds_remaining"],
                "next_fetch_at": status["next_fetch_at"],
                "dataset_info": self.get_dataset_info(region),
            }

        logger.info(f"🚀 Starting data fetch for {region}...")
        start_time = datetime.now()

        try:
            # Fetch all data sources in parallel
            tasks = [
                self.fetch_waqi_data_parallel(region, 730),
                self.fetch_noaa_data_parallel(region, 730),
                self.fetch_weather_data_parallel(region, 730),
                self.fetch_marine_data_parallel(region, 730),
            ]
            waqi_df, noaa_df, weather_df, marine_df = await asyncio.gather(*tasks)

            merged_df = self._merge_datasets_by_date([
                ("waqi", waqi_df),
                ("noaa", noaa_df),
                ("weather", weather_df),
                ("marine", marine_df),
            ], region)

            if merged_df.empty:
                raise Exception("Failed to create merged dataset")

            merged_df = self._calculate_pollution_level(merged_df, region)

            dataset_path = self.get_dataset_path(region)
            merged_df.to_csv(dataset_path, index=False)

            # Record successful fetch timestamp
            self._record_fetch(region)

            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"✅ Data fetch completed for {region} in {duration:.1f}s")

            return {
                "success": True,
                "message": "data_fetched_successfully",
                "region": region,
                "dataset_info": self.get_dataset_info(region),
                "fetch_duration_seconds": duration,
                "sources_used": ["waqi", "noaa", "weather", "marine"],
            }

        except Exception as e:
            logger.error(f"❌ Error fetching data for {region}: {e}")
            return {
                "success": False,
                "message": f"fetch_failed: {str(e)}",
                "region": region,
            }
    
    def load_cached_dataset(self, region: str) -> pd.DataFrame:
        """Load dataset from cache for training"""
        if not self.dataset_exists(region):
            raise FileNotFoundError(f"No cached dataset found for {region}. Please fetch data first.")
        
        try:
            dataset_path = self.get_dataset_path(region)
            df = pd.read_csv(dataset_path, parse_dates=['date'])
            logger.info(f"✅ Loaded cached dataset for {region}: {len(df)} records")
            return df
        except Exception as e:
            logger.error(f"Error loading cached dataset for {region}: {e}")
            raise
    
    def _merge_datasets_by_date(self, datasets: List[Tuple[str, pd.DataFrame]], region: str) -> pd.DataFrame:
        """Merge datasets strictly by date, not by index"""
        logger.info("Merging datasets by date...")
        
        # Start with the largest dataset as base
        base_df = None
        base_name = None
        max_records = 0
        
        for name, df in datasets:
            if not df.empty and len(df) > max_records:
                base_df = df.copy()
                base_name = name
                max_records = len(df)
        
        if base_df is None:
            logger.error("No valid datasets to merge")
            return pd.DataFrame()
        
        # Ensure base has date column
        if 'date' not in base_df.columns:
            logger.error(f"Base dataset {base_name} missing date column")
            return pd.DataFrame()
        
        logger.info(f"Using {base_name} as base dataset with {len(base_df)} records")
        
        # Merge other datasets
        for name, df in datasets:
            if name == base_name or df.empty:
                continue
            
            if 'date' not in df.columns:
                logger.warning(f"Dataset {name} missing date column, skipping")
                continue
            
            # Merge on date
            before_merge = len(base_df)
            base_df = base_df.merge(df, on='date', how='left', suffixes=('', f'_{name}'))
            after_merge = len(base_df)
            
            logger.info(f"Merged {name}: {before_merge} -> {after_merge} records")
        
        # Drop rows with unmatched dates (as required)
        initial_count = len(base_df)
        base_df = base_df.dropna(subset=['date'])
        final_count = len(base_df)
        
        if initial_count != final_count:
            logger.info(f"Dropped {initial_count - final_count} rows with unmatched dates")
        
        # Forward/backward fill after merge
        numeric_columns = base_df.select_dtypes(include=[np.number]).columns
        base_df[numeric_columns] = base_df[numeric_columns].ffill().bfill()
        
        # Add region column
        base_df['region'] = region
        
        logger.info(f"✅ Final merged dataset: {len(base_df)} records, {len(base_df.columns)} features")
        return base_df
    
    def _calculate_pollution_level(self, df: pd.DataFrame, region: str) -> pd.DataFrame:
        """Calculate pollution level based on multiple environmental factors"""
        logger.info("Calculating pollution levels...")
        
        try:
            # Regional base pollution levels
            base_levels = {
                'pacific': 65,
                'atlantic': 45,
                'indian': 55,
                'mediterranean': 40
            }
            
            base_pollution = base_levels.get(region, 50)
            
            # Calculate pollution based on available features
            pollution_factors = []
            
            # Temperature factor
            if 'temperature' in df.columns:
                temp_norm = (df['temperature'] - df['temperature'].mean()) / df['temperature'].std()
                pollution_factors.append(temp_norm * 5)
            
            # Wind factor (inverse relationship)
            if 'wind_speed' in df.columns:
                wind_factor = -df['wind_speed'] * 2  # Higher wind = lower pollution
                pollution_factors.append(wind_factor)
            
            # AQI factor
            aqi_cols = [col for col in df.columns if 'aqi' in col.lower()]
            if aqi_cols:
                aqi_factor = df[aqi_cols[0]] * 0.3
                pollution_factors.append(aqi_factor)
            
            # Ocean temperature factor
            if 'ocean_temp' in df.columns:
                ocean_temp_factor = (df['ocean_temp'] - 15) * 2
                pollution_factors.append(ocean_temp_factor)
            
            # Combine factors
            if pollution_factors:
                combined_factor = sum(pollution_factors) / len(pollution_factors)
                df['pollution_level'] = base_pollution + combined_factor
            else:
                # Fallback: seasonal pattern
                if 'date' in df.columns:
                    day_of_year = pd.to_datetime(df['date']).dt.dayofyear
                    seasonal_factor = 20 * np.sin(2 * np.pi * (day_of_year - 90) / 365)
                    df['pollution_level'] = base_pollution + seasonal_factor
                else:
                    df['pollution_level'] = base_pollution
            
            # Add noise and ensure bounds
            df['pollution_level'] += np.random.normal(0, 5, len(df))
            df['pollution_level'] = np.clip(df['pollution_level'], 0, 100)
            
            # Handle any NaN values in pollution_level
            df['pollution_level'] = df['pollution_level'].fillna(base_pollution)
            
            # Final cleanup - ensure no NaN values in any numeric columns
            numeric_columns = df.select_dtypes(include=[np.number]).columns
            for col in numeric_columns:
                if df[col].isna().any():
                    if 'temperature' in col.lower():
                        df[col] = df[col].fillna(20.0)
                    elif 'pollution' in col.lower():
                        df[col] = df[col].fillna(50.0)
                    elif 'aqi' in col.lower():
                        df[col] = df[col].fillna(50.0)
                    elif 'humidity' in col.lower():
                        df[col] = df[col].fillna(60.0)
                    elif 'pressure' in col.lower():
                        df[col] = df[col].fillna(1013.25)
                    elif 'wind' in col.lower():
                        df[col] = df[col].fillna(5.0)
                    elif 'ocean' in col.lower():
                        df[col] = df[col].fillna(15.0)
                    elif 'precipitation' in col.lower():
                        df[col] = df[col].fillna(2.0)
                    elif 'salinity' in col.lower():
                        df[col] = df[col].fillna(35.0)
                    elif 'chlorophyll' in col.lower():
                        df[col] = df[col].fillna(1.0)
                    else:
                        df[col] = df[col].fillna(0.0)
            
            # Final check - replace any remaining NaN with 0
            df = df.fillna(0.0)
            
            logger.info(f"✅ Calculated pollution levels: mean={df['pollution_level'].mean():.1f}")
            return df
            
        except Exception as e:
            logger.error(f"Error calculating pollution levels: {e}")
            # Fallback
            df['pollution_level'] = 50 + np.random.normal(0, 10, len(df))
            df['pollution_level'] = np.clip(df['pollution_level'], 0, 100)
            return df
    
    def _convert_waqi_to_timeseries(self, city_results: List[Dict], region: str, days_back: int) -> pd.DataFrame:
        """Convert WAQI city data to time series"""
        # For now, generate time series based on current readings
        # In production, you'd use historical API endpoints
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Calculate average AQI from cities
        aqi_values = []
        for city_result in city_results:
            aqi = city_result['data'].get('aqi', 50)
            if isinstance(aqi, (int, float)):
                aqi_values.append(aqi)
        
        avg_aqi = np.mean(aqi_values) if aqi_values else 50
        
        # Generate time series with realistic variations
        data = []
        for date in dates:
            day_of_year = date.timetuple().tm_yday
            seasonal_factor = 1 + 0.3 * np.sin(2 * np.pi * (day_of_year + 90) / 365)
            daily_aqi = avg_aqi * seasonal_factor + np.random.normal(0, 10)
            
            data.append({
                'date': date,
                'aqi': max(0, daily_aqi),
                'pm25': max(0, daily_aqi * 0.4 + np.random.normal(0, 5)),
                'pm10': max(0, daily_aqi * 0.6 + np.random.normal(0, 8))
            })
        
        return pd.DataFrame(data)
    
    def _process_noaa_data(self, raw_data: pd.DataFrame, region: str, days_back: int) -> pd.DataFrame:
        """Process raw NOAA data into clean time series"""
        try:
            # Group by date and aggregate
            if 'date' not in raw_data.columns:
                logger.warning("NOAA data missing date column")
                return self._generate_fallback_noaa_data(region, days_back)
            
            # Convert NOAA codes to readable names
            column_mapping = {
                'PRCP': 'precipitation',
                'TMAX': 'temperature_max', 
                'TMIN': 'temperature_min',
                'AWND': 'wind_speed',
                'PRES': 'pressure'
            }
            
            # Aggregate by date
            agg_data = raw_data.groupby('date').agg({
                col: 'mean' for col in raw_data.columns 
                if col in column_mapping.keys() and col in raw_data.columns
            }).reset_index()
            
            # Rename columns
            for old_name, new_name in column_mapping.items():
                if old_name in agg_data.columns:
                    agg_data[new_name] = agg_data[old_name]
                    agg_data.drop(old_name, axis=1, inplace=True)
            
            # Convert units (NOAA uses tenths)
            unit_conversions = {
                'precipitation': 0.1,  # tenths of mm to mm
                'temperature_max': 0.1,  # tenths of °C to °C
                'temperature_min': 0.1,
                'pressure': 0.1  # tenths of hPa to hPa
            }
            
            for col, factor in unit_conversions.items():
                if col in agg_data.columns:
                    agg_data[col] = agg_data[col] * factor
            
            logger.info(f"✅ Processed NOAA data: {len(agg_data)} records")
            return agg_data
            
        except Exception as e:
            logger.error(f"Error processing NOAA data: {e}")
            return self._generate_fallback_noaa_data(region, days_back)
    
    def _generate_fallback_waqi_data(self, region: str, days_back: int) -> pd.DataFrame:
        """Generate fallback WAQI data"""
        logger.info(f"Generating fallback WAQI data for {region}")
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Regional AQI baselines
        baselines = {
            'pacific': 65,
            'atlantic': 55,
            'indian': 75,
            'mediterranean': 60
        }
        
        base_aqi = baselines.get(region, 60)
        
        data = []
        for date in dates:
            day_of_year = date.timetuple().tm_yday
            seasonal_factor = 1 + 0.2 * np.sin(2 * np.pi * day_of_year / 365)
            
            aqi = base_aqi * seasonal_factor + np.random.normal(0, 12)
            data.append({
                'date': date,
                'aqi': max(0, aqi),
                'pm25': max(0, aqi * 0.4 + np.random.normal(0, 5)),
                'pm10': max(0, aqi * 0.6 + np.random.normal(0, 8))
            })
        
        return pd.DataFrame(data)
    
    def _generate_fallback_noaa_data(self, region: str, days_back: int) -> pd.DataFrame:
        """Generate fallback NOAA data"""
        logger.info(f"Generating fallback NOAA data for {region}")
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Regional climate baselines
        baselines = {
            'pacific': {'temp': 15, 'precip': 2},
            'atlantic': {'temp': 18, 'precip': 3},
            'indian': {'temp': 25, 'precip': 4},
            'mediterranean': {'temp': 20, 'precip': 1}
        }
        
        baseline = baselines.get(region, {'temp': 18, 'precip': 2})
        
        data = []
        for date in dates:
            day_of_year = date.timetuple().tm_yday
            seasonal_factor = np.sin(2 * np.pi * (day_of_year - 80) / 365)
            
            data.append({
                'date': date,
                'temperature_max': baseline['temp'] + seasonal_factor * 10 + np.random.normal(0, 3),
                'temperature_min': baseline['temp'] - 5 + seasonal_factor * 8 + np.random.normal(0, 2),
                'precipitation': max(0, baseline['precip'] + np.random.exponential(2)),
                'wind_speed': max(0, np.random.exponential(6)),
                'pressure': 1013 + np.random.normal(0, 10)
            })
        
        return pd.DataFrame(data)

# Global instance
data_cache_service = DataCacheService()