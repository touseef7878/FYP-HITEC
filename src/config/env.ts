/**
 * Environment configuration
 * Centralized environment variables for easy deployment
 */

export const ENV = {
  // API Configuration
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  API_TIMEOUT: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
  
  // Feature Flags
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS !== 'false',
  ENABLE_PWA: import.meta.env.VITE_ENABLE_PWA === 'true',
  
  // Development
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
  
  // Cache Configuration
  CACHE_DURATION: parseInt(import.meta.env.VITE_CACHE_DURATION || '300000'), // 5 minutes
  
  // Upload Limits
  MAX_FILE_SIZE: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '104857600'), // 100MB
  MAX_VIDEO_DURATION: parseInt(import.meta.env.VITE_MAX_VIDEO_DURATION || '300'), // 5 minutes

  // AI Assistant — Gemini 1.5 Flash (free tier)
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY || '',
} as const;

export default ENV;
