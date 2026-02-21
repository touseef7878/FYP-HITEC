# 🔧 Environment Setup Guide

## Overview

This guide explains how to properly configure environment variables for both the backend and frontend of the Marine Detection System.

---

## Backend Environment Variables

### Location
`backend/.env`

### Setup Steps

1. **Copy the example file:**
```bash
cd backend
cp .env.example .env
```

2. **Generate a secure JWT secret key:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

3. **Edit `backend/.env` with your values:**

```env
# CRITICAL: JWT Secret Key (REQUIRED)
JWT_SECRET_KEY=your-generated-secret-key-here-min-32-chars

# CORS Configuration (comma-separated origins)
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173

# Database
DATABASE_PATH=./marine_detection.db

# API Keys (Optional - for real data fetching)
NOAA_API_KEY=your-noaa-api-key-here
WAQI_API_KEY=your-waqi-api-key-here

# Server Configuration
HOST=0.0.0.0
PORT=8000
WORKERS=4

# File Upload Limits
MAX_UPLOAD_SIZE=104857600  # 100MB
MAX_VIDEO_DURATION=300     # 5 minutes

# Model Configuration
YOLO_CONFIDENCE_THRESHOLD=0.25
YOLO_IOU_THRESHOLD=0.45

# Logging
LOG_LEVEL=INFO
LOG_FILE=./logs/app.log
```

### Required Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET_KEY` | ✅ YES | Must be at least 32 characters. Application will not start without it. |
| `ALLOWED_ORIGINS` | ✅ YES | Comma-separated list of allowed frontend origins. No wildcards for security. |

### Optional Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NOAA_API_KEY` | ❌ No | For fetching real NOAA weather data. Falls back to synthetic data. |
| `WAQI_API_KEY` | ❌ No | For fetching real air quality data. Falls back to synthetic data. |
| `DATABASE_PATH` | ❌ No | Custom database location. Defaults to `./marine_detection.db` |
| `HOST` | ❌ No | Server host. Defaults to `0.0.0.0` |
| `PORT` | ❌ No | Server port. Defaults to `8000` |

---

## Frontend Environment Variables

### Location
`.env` (root directory)

### Setup Steps

1. **Copy the example file:**
```bash
cp .env.example .env
```

2. **Edit `.env` with your values:**

```env
# API Configuration
VITE_API_URL=http://localhost:8000
VITE_API_TIMEOUT=30000

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_PWA=false

# Cache Configuration (milliseconds)
VITE_CACHE_DURATION=300000  # 5 minutes

# Upload Limits
VITE_MAX_FILE_SIZE=104857600    # 100MB
VITE_MAX_VIDEO_DURATION=300     # 5 minutes
```

### Variable Descriptions

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API URL. Change for production deployment. |
| `VITE_API_TIMEOUT` | `30000` | API request timeout in milliseconds. |
| `VITE_ENABLE_ANALYTICS` | `true` | Enable/disable analytics features. |
| `VITE_ENABLE_PWA` | `false` | Enable Progressive Web App features. |
| `VITE_CACHE_DURATION` | `300000` | Cache duration for API responses (5 minutes). |
| `VITE_MAX_FILE_SIZE` | `104857600` | Maximum upload file size (100MB). |
| `VITE_MAX_VIDEO_DURATION` | `300` | Maximum video duration in seconds (5 minutes). |

---

## Production Deployment

### Backend Production Settings

```env
# Use strong, unique JWT secret
JWT_SECRET_KEY=<generate-with-64-chars-minimum>

# Set your production domain(s)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Enable production logging
LOG_LEVEL=WARNING
LOG_FILE=/var/log/marine-detection/app.log

# Increase workers for production
WORKERS=8
```

### Frontend Production Settings

```env
# Point to production API
VITE_API_URL=https://api.yourdomain.com

# Disable development features
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_PWA=true

# Optimize cache for production
VITE_CACHE_DURATION=600000  # 10 minutes
```

---

## Security Best Practices

### ✅ DO:
- Generate unique JWT secrets for each environment (dev, staging, prod)
- Use at least 32 characters for JWT_SECRET_KEY (64+ recommended for production)
- Keep `.env` files out of version control (already in `.gitignore`)
- Use HTTPS in production for ALLOWED_ORIGINS
- Rotate JWT secrets periodically
- Use environment-specific API keys

### ❌ DON'T:
- Use default or example values in production
- Commit `.env` files to git
- Share JWT secrets across environments
- Use wildcards (`*`) in ALLOWED_ORIGINS
- Hardcode secrets in source code
- Use HTTP in production

---

## Troubleshooting

### Backend won't start

**Error:** `ValueError: JWT_SECRET_KEY environment variable is required!`

**Solution:** 
1. Ensure `backend/.env` exists
2. Verify `JWT_SECRET_KEY` is set and at least 32 characters
3. Restart the backend server

### CORS errors in browser

**Error:** `Access to fetch at 'http://localhost:8000' from origin 'http://localhost:8080' has been blocked by CORS policy`

**Solution:**
1. Check `ALLOWED_ORIGINS` in `backend/.env`
2. Ensure your frontend URL is included
3. No trailing slashes in URLs
4. Restart backend after changes

### Frontend can't connect to API

**Error:** `Network Error` or `Failed to fetch`

**Solution:**
1. Verify backend is running on the correct port
2. Check `VITE_API_URL` in `.env` matches backend URL
3. Ensure no firewall blocking the connection
4. Check browser console for detailed errors

---

## Environment Variable Validation

The application validates environment variables on startup:

### Backend Validation
- JWT_SECRET_KEY must exist and be ≥32 characters
- ALLOWED_ORIGINS must be a valid comma-separated list
- PORT must be a valid number

### Frontend Validation
- VITE_API_URL must be a valid URL
- Numeric values must be valid integers

---

## Quick Reference

### Generate Secure Keys

```bash
# JWT Secret (32 chars)
python -c "import secrets; print(secrets.token_urlsafe(32))"

# JWT Secret (64 chars - recommended for production)
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Random password
python -c "import secrets; print(secrets.token_urlsafe(16))"
```

### Check Current Configuration

```bash
# Backend
cd backend
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print('JWT_SECRET_KEY:', 'SET' if os.getenv('JWT_SECRET_KEY') else 'NOT SET')"

# Frontend
cat .env | grep VITE_API_URL
```

---

## Additional Resources

- [FastAPI Environment Variables](https://fastapi.tiangolo.com/advanced/settings/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Python-dotenv Documentation](https://github.com/theskumar/python-dotenv)
- [Security Best Practices](./SECURITY_AND_OPTIMIZATION_REPORT.md)

---

**Last Updated:** February 21, 2026
