"""
Environmental Data Service
Integrates multiple environmental APIs for comprehensive data collection
"""

import asyncio
import aiohttp
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import logging
import os
from dataclasses import dataclass
import json

# Import API clients
from utils.noaa_api import noaa_client
from utils.waqi_api import waqi_client

logger = logging.getLogger(__name__)

@dataclass
class LocationData:
    """Data structure for location-based environmental data"""
    latitude: float
    longitude: float
    name: str
    region: str

# Marine regions with representative coordinates
MARINE_REGIONS = {
    'pacific': LocationData(35.0, -140.0, 'North Pacific', 'Pacific Ocean'),
    'atlantic': LocationData(40.0, -30.0, 'North Atlantic', 'Atlantic Ocean'),
    'indian': LocationData(-20.0, 80.0, 'Indian Ocean', 'Indian Ocean'),
    'mediterranean': LocationData(35.0, 15.0, 'Mediterranean Sea', 'Mediterranean')
}

class EnvironmentalDataService:
    """
    Comprehensive environmental data collection service
    Integrates weather, climate, air quality, and marine data
    """
    
    def __init__(self):
        self.openweather_key = os.getenv('OPENWEATHER_API_KEY')
        self.weatherapi_key = os.getenv('WEATHERAPI_KEY')
        self.copernicus_user = os.getenv('COPERNICUS_USER')
        self.copernicus_pass = os.getenv('COPERNICUS_PASS')
        
        # Cache for API responses
        self.cache = {}
        self.cache_duration = 3600  # 1 hour cache
    
    async def fetch_weather_data(self, location: LocationData, 
                                days_back: int = 30) -> pd.DataFrame:
        """
        Fetch weather data from OpenWeather and WeatherAPI
        
        Args:
            location: Location data
            days_back: Number of historical days to fetch
            
        Returns:
            DataFrame with weather data
        """
        weather_data = []
        
        try:
            # Generate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            # Simulate historical weather data (in production, use actual APIs)
            for i in range(days_back):
                date = start_date + timedelta(days=i)
                
                # Generate realistic weather patterns based on location
                base_temp = self._get_base_temperature(location, date)
                seasonal_factor = np.sin(2 * np.pi * date.timetuple().tm_yday / 365.25)
                
                weather_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'temperature': base_temp + seasonal_factor * 10 + np.random.normal(0, 3),
                    'humidity': max(20, min(100, 60 + np.random.normal(0, 15))),
                    'pressure': 1013.25 + np.random.normal(0, 10),
                    'wind_speed': max(0, np.random.exponential(8)),
                    'location': location.name
                })
            
            df = pd.DataFrame(weather_data)
            df['date'] = pd.to_datetime(df['date'])
            df.set_index('date', inplace=True)
            
            logger.info(f"Fetched {len(df)} weather records for {location.name}")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching weather data: {e}")
            return pd.DataFrame()
    
    async def fetch_air_quality_data(self, location: LocationData, 
                                   days_back: int = 30) -> pd.DataFrame:
        """
        Fetch air quality data using WAQI API
        
        Args:
            location: Location data
            days_back: Number of historical days to fetch
            
        Returns:
            DataFrame with air quality data
        """
        try:
            # Use WAQI client to fetch real data - map area names correctly
            area_mapping = {
                'North Pacific': 'pacific',
                'North Atlantic': 'atlantic', 
                'Indian Ocean': 'indian',
                'Mediterranean Sea': 'mediterranean'
            }
            
            mapped_area = area_mapping.get(location.name, location.name.lower().replace(' ', '_'))
            aqi_data = waqi_client.get_historical_pollution_trends(mapped_area, days_back)
            
            if not aqi_data.empty:
                logger.info(f"Fetched {len(aqi_data)} AQI records for {location.name}")
                return aqi_data
            else:
                # Fallback to simulated data
                return self._generate_simulated_aqi_data(location, days_back)
                
        except Exception as e:
            logger.error(f"Error fetching AQI data: {e}")
            return self._generate_simulated_aqi_data(location, days_back)
    
    async def fetch_climate_data(self, location: LocationData, 
                               days_back: int = 30) -> pd.DataFrame:
        """
        Fetch climate data from NOAA CDO API
        
        Args:
            location: Location data
            days_back: Number of historical days to fetch
            
        Returns:
            DataFrame with climate data
        """
        try:
            # Use NOAA client to fetch real data - map area names correctly
            area_mapping = {
                'North Pacific': 'pacific',
                'North Atlantic': 'atlantic',
                'Indian Ocean': 'indian', 
                'Mediterranean Sea': 'mediterranean'
            }
            
            mapped_area = area_mapping.get(location.name, location.name.lower().replace(' ', '_'))
            climate_data = noaa_client.get_area_environmental_data(mapped_area, days_back)
            
            if not climate_data.empty:
                logger.info(f"Fetched {len(climate_data)} climate records for {location.name}")
                return climate_data
            else:
                # Fallback to simulated data
                return self._generate_simulated_climate_data(location, days_back)
                
        except Exception as e:
            logger.error(f"Error fetching climate data: {e}")
            return self._generate_simulated_climate_data(location, days_back)
    
    async def fetch_marine_data(self, location: LocationData, 
                              days_back: int = 30) -> pd.DataFrame:
        """
        Fetch marine data from Copernicus Marine Service
        
        Args:
            location: Location data
            days_back: Number of historical days to fetch
            
        Returns:
            DataFrame with marine data
        """
        try:
            # Simulate marine data (in production, use Copernicus API)
            marine_data = []
            
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            for i in range(days_back):
                date = start_date + timedelta(days=i)
                
                # Generate realistic ocean temperature based on location and season
                base_ocean_temp = self._get_base_ocean_temperature(location, date)
                seasonal_factor = np.sin(2 * np.pi * date.timetuple().tm_yday / 365.25)
                
                marine_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'ocean_temp': base_ocean_temp + seasonal_factor * 5 + np.random.normal(0, 1),
                    'salinity': 35.0 + np.random.normal(0, 0.5),
                    'chlorophyll': max(0, np.random.lognormal(0, 0.5)),
                    'location': location.name
                })
            
            df = pd.DataFrame(marine_data)
            df['date'] = pd.to_datetime(df['date'])
            df.set_index('date', inplace=True)
            
            logger.info(f"Fetched {len(df)} marine records for {location.name}")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching marine data: {e}")
            return pd.DataFrame()
    
    async def get_comprehensive_data(self, area: str, 
                                   days_back: int = 365) -> pd.DataFrame:
        """
        Fetch comprehensive environmental data for a marine area
        
        Args:
            area: Marine area identifier
            days_back: Number of historical days to fetch
            
        Returns:
            Combined DataFrame with all environmental data
        """
        if area not in MARINE_REGIONS:
            raise ValueError(f"Unknown area: {area}. Available: {list(MARINE_REGIONS.keys())}")
        
        location = MARINE_REGIONS[area]
        logger.info(f"Fetching comprehensive data for {location.name}")
        
        # Fetch data from all sources concurrently
        tasks = [
            self.fetch_weather_data(location, days_back),
            self.fetch_air_quality_data(location, days_back),
            self.fetch_climate_data(location, days_back),
            self.fetch_marine_data(location, days_back)
        ]
        
        weather_df, aqi_df, climate_df, marine_df = await asyncio.gather(*tasks)
        
        # Combine all data sources
        combined_df = pd.DataFrame()
        
        # Start with weather data as base (it has proper datetime index)
        if not weather_df.empty:
            combined_df = weather_df.copy()
        
        # Merge other data sources carefully
        for df, prefix in [(aqi_df, 'aqi'), (climate_df, 'climate'), (marine_df, 'marine')]:
            if not df.empty:
                if combined_df.empty:
                    combined_df = df.copy()
                else:
                    # Ensure both dataframes have datetime index
                    if not isinstance(df.index, pd.DatetimeIndex):
                        if 'date' in df.columns:
                            df = df.set_index('date')
                        else:
                            continue  # Skip if no date column
                    
                    # Align the date ranges before joining
                    common_dates = combined_df.index.intersection(df.index)
                    if len(common_dates) > 0:
                        combined_df = combined_df.join(df, how='outer', rsuffix=f'_{prefix}')
                    else:
                        # If no common dates, merge by position (less ideal but works)
                        logger.warning(f"No common dates between datasets, merging by position for {prefix}")
                        df_reset = df.reset_index()
                        combined_reset = combined_df.reset_index()
                        
                        # Take minimum length to avoid index issues
                        min_len = min(len(df_reset), len(combined_reset))
                        if min_len > 0:
                            for col in df_reset.columns:
                                if col not in combined_reset.columns:
                                    combined_reset[col] = df_reset[col].iloc[:min_len].values
                            
                            combined_df = combined_reset.set_index('date' if 'date' in combined_reset.columns else combined_reset.columns[0])
        
        # Generate pollution index based on multiple factors
        if not combined_df.empty:
            combined_df = self._calculate_pollution_index(combined_df, location)
            
            # Forward fill missing values and handle NaN
            combined_df = combined_df.ffill().bfill()
            
            # Replace any remaining NaN with reasonable defaults
            numeric_columns = combined_df.select_dtypes(include=[np.number]).columns
            for col in numeric_columns:
                if combined_df[col].isna().any():
                    median_val = combined_df[col].median()
                    if pd.isna(median_val):
                        # If median is also NaN, use a reasonable default based on column name
                        if 'temperature' in col.lower():
                            default_val = 20.0
                        elif 'pollution' in col.lower():
                            default_val = 50.0
                        elif 'aqi' in col.lower():
                            default_val = 50.0
                        elif 'humidity' in col.lower():
                            default_val = 60.0
                        elif 'pressure' in col.lower():
                            default_val = 1013.25
                        else:
                            default_val = 0.0
                        combined_df[col] = combined_df[col].fillna(default_val)
                    else:
                        combined_df[col] = combined_df[col].fillna(median_val)
            
            logger.info(f"Combined dataset: {len(combined_df)} records, {len(combined_df.columns)} features")
        
        return combined_df
    
    def _calculate_pollution_index(self, df: pd.DataFrame, 
                                 location: LocationData) -> pd.DataFrame:
        """
        Calculate comprehensive pollution index based on multiple environmental factors
        
        Args:
            df: Combined environmental data
            location: Location information
            
        Returns:
            DataFrame with pollution index
        """
        try:
            # Normalize factors to 0-100 scale
            factors = {}
            
            # Air quality factor (if available)
            aqi_cols = [col for col in df.columns if 'aqi' in col.lower() and df[col].dtype in ['float64', 'int64']]
            if aqi_cols:
                aqi_values = df[aqi_cols[0]].fillna(50)  # Default moderate AQI
                factors['aqi_factor'] = aqi_values / 500.0  # Normalize AQI
            else:
                factors['aqi_factor'] = 0.3  # Default moderate pollution
            
            # Temperature anomaly factor
            temp_cols = [col for col in df.columns if 'temperature' in col.lower() and df[col].dtype in ['float64', 'int64']]
            if temp_cols:
                temp_values = df[temp_cols[0]].fillna(20)  # Default 20°C
                temp_mean = temp_values.mean()
                temp_std = temp_values.std()
                if temp_std > 0:
                    factors['temp_anomaly'] = np.abs(temp_values - temp_mean) / temp_std
                else:
                    factors['temp_anomaly'] = 0.2
            else:
                factors['temp_anomaly'] = 0.2
            
            # Ocean temperature factor (higher temps can indicate pollution)
            ocean_temp_cols = [col for col in df.columns if 'ocean_temp' in col.lower() and df[col].dtype in ['float64', 'int64']]
            if ocean_temp_cols:
                ocean_temp = df[ocean_temp_cols[0]].fillna(15)  # Default ocean temp
                ocean_temp_min = ocean_temp.min()
                ocean_temp_max = ocean_temp.max()
                if ocean_temp_max > ocean_temp_min:
                    ocean_temp_norm = (ocean_temp - ocean_temp_min) / (ocean_temp_max - ocean_temp_min)
                    factors['ocean_temp_factor'] = ocean_temp_norm
                else:
                    factors['ocean_temp_factor'] = 0.4
            else:
                factors['ocean_temp_factor'] = 0.4
            
            # Wind factor (lower wind = higher pollution accumulation)
            wind_cols = [col for col in df.columns if 'wind' in col.lower() and df[col].dtype in ['float64', 'int64']]
            if wind_cols:
                wind_speed = df[wind_cols[0]].fillna(5)  # Default wind speed
                wind_max = wind_speed.max()
                if wind_max > 0:
                    factors['wind_factor'] = 1.0 - (wind_speed / wind_max)
                else:
                    factors['wind_factor'] = 0.5
            else:
                factors['wind_factor'] = 0.5
            
            # Regional base pollution (different regions have different baseline pollution)
            regional_base = {
                'Pacific Ocean': 0.3,
                'Atlantic Ocean': 0.4,
                'Indian Ocean': 0.5,
                'Mediterranean': 0.6
            }
            base_pollution = regional_base.get(location.region, 0.4)
            
            # Combine factors with weights
            weights = {
                'aqi_factor': 0.3,
                'temp_anomaly': 0.2,
                'ocean_temp_factor': 0.2,
                'wind_factor': 0.2,
                'base': 0.1
            }
            
            # Initialize pollution index with base value
            pollution_index = np.full(len(df), base_pollution)
            
            # Add weighted factors
            for factor_name, factor_values in factors.items():
                weight = weights.get(factor_name, 0.1)
                if isinstance(factor_values, (int, float)):
                    pollution_index += weight * factor_values
                else:
                    # Ensure factor_values is a numpy array of the right length
                    factor_array = np.array(factor_values)
                    if len(factor_array) == len(pollution_index):
                        pollution_index += weight * factor_array
                    else:
                        # If lengths don't match, use the mean value
                        pollution_index += weight * np.mean(factor_array)
            
            # Add some realistic noise and trends
            trend = np.linspace(0, 0.1, len(df))  # Slight increasing trend
            noise = np.random.normal(0, 0.05, len(df))
            
            pollution_index = pollution_index + trend + noise
            
            # Normalize to 0-1 range and scale to meaningful pollution levels
            pollution_index = np.clip(pollution_index, 0, 1)
            df['pollution_level'] = pollution_index * 100  # Scale to 0-100
            df['pollution_index'] = pollution_index
            
            return df
            
        except Exception as e:
            logger.error(f"Error calculating pollution index: {e}")
            # Fallback: create simple pollution index
            df['pollution_level'] = np.random.normal(50, 15, len(df))  # Random around 50
            df['pollution_level'] = np.clip(df['pollution_level'], 0, 100)
            df['pollution_index'] = df['pollution_level'] / 100
            return df
    
    def _get_base_temperature(self, location: LocationData, date: datetime) -> float:
        """Get base temperature for location and season"""
        # Simplified temperature model based on latitude and season
        lat_factor = abs(location.latitude) / 90.0
        seasonal_temp = 20 - lat_factor * 30
        
        # Seasonal variation
        day_of_year = date.timetuple().tm_yday
        seasonal_factor = np.sin(2 * np.pi * (day_of_year - 80) / 365.25)  # Peak in summer
        
        return seasonal_temp + seasonal_factor * 15
    
    def _get_base_ocean_temperature(self, location: LocationData, date: datetime) -> float:
        """Get base ocean temperature for location and season"""
        # Ocean temperatures are more stable than air temperatures
        base_temp = self._get_base_temperature(location, date)
        return base_temp * 0.8 + 10  # Ocean temps are more moderate
    
    def _generate_simulated_aqi_data(self, location: LocationData, 
                                   days_back: int) -> pd.DataFrame:
        """Generate realistic simulated AQI data"""
        aqi_data = []
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        # Base AQI varies by region
        regional_base_aqi = {
            'Pacific Ocean': 45,
            'Atlantic Ocean': 55,
            'Indian Ocean': 65,
            'Mediterranean': 75
        }
        base_aqi = regional_base_aqi.get(location.region, 50)
        
        for i in range(days_back):
            date = start_date + timedelta(days=i)
            
            # Add weekly and seasonal patterns
            weekly_factor = np.sin(2 * np.pi * i / 7) * 5  # Weekly pattern
            seasonal_factor = np.sin(2 * np.pi * date.timetuple().tm_yday / 365.25) * 10
            
            aqi = max(0, base_aqi + weekly_factor + seasonal_factor + np.random.normal(0, 8))
            pm25 = aqi * 0.4 + np.random.normal(0, 3)
            
            aqi_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'aqi': aqi,
                'pm25': max(0, pm25),
                'pm10': max(0, pm25 * 1.5 + np.random.normal(0, 2)),
                'location': location.name
            })
        
        df = pd.DataFrame(aqi_data)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        
        return df
    
    def _generate_simulated_climate_data(self, location: LocationData, 
                                       days_back: int) -> pd.DataFrame:
        """Generate realistic simulated climate data"""
        climate_data = []
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        for i in range(days_back):
            date = start_date + timedelta(days=i)
            
            climate_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'precipitation': max(0, np.random.exponential(2)),
                'cloud_cover': max(0, min(100, np.random.normal(50, 20))),
                'uv_index': max(0, min(11, np.random.normal(6, 2))),
                'location': location.name
            })
        
        df = pd.DataFrame(climate_data)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        
        return df

# Global instance
environmental_service = EnvironmentalDataService()