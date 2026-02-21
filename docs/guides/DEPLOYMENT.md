# 🚀 Deployment Guide

Complete guide for deploying the Marine Detection System to production environments.

## 📋 Pre-Deployment Checklist

### Security
- [ ] Change default admin password
- [ ] Update JWT secret key in `.env`
- [ ] Configure CORS for production domain
- [ ] Enable HTTPS/SSL certificates
- [ ] Set up firewall rules
- [ ] Configure rate limiting
- [ ] Review file upload size limits

### Configuration
- [ ] Update API base URLs in frontend
- [ ] Configure production database path
- [ ] Set up backup automation
- [ ] Configure logging levels
- [ ] Set environment variables
- [ ] Update CORS allowed origins

### Performance
- [ ] Optimize database indexes
- [ ] Configure caching strategy
- [ ] Set up CDN for static assets
- [ ] Enable gzip compression
- [ ] Configure worker processes

---

## 🖥️ Local Production Build

### Backend Setup

```bash
cd backend

# Install production dependencies
pip install -r requirements.txt

# Set production environment variables
export ENVIRONMENT=production
export JWT_SECRET_KEY=<your-secure-secret-key>
export DATABASE_PATH=/path/to/production/database.db

# Initialize database
python init_db.py

# Change default passwords immediately!
# Use admin menu or database directly

# Start with production settings
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend Build

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Output will be in dist/ directory
# Serve with any static file server
```

### Serve Frontend

**Option 1: Using Python HTTP Server**
```bash
cd dist
python -m http.server 8080
```

**Option 2: Using Node.js serve**
```bash
npm install -g serve
serve -s dist -p 8080
```

**Option 3: Using Nginx (Recommended)**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /path/to/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## ☁️ Cloud Deployment

### AWS Deployment

#### EC2 Instance Setup

```bash
# 1. Launch EC2 instance (Ubuntu 22.04 LTS)
# Recommended: t3.medium or larger (2 vCPU, 4GB RAM)

# 2. SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# 3. Install dependencies
sudo apt update
sudo apt install -y python3-pip nodejs npm nginx

# 4. Clone repository
git clone <your-repo-url>
cd marine-detection-system

# 5. Setup backend
cd backend
pip3 install -r requirements.txt
python3 init_db.py

# 6. Setup frontend
cd ..
npm install
npm run build

# 7. Configure Nginx
sudo cp deployment/nginx.conf /etc/nginx/sites-available/marine-detection
sudo ln -s /etc/nginx/sites-available/marine-detection /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 8. Setup systemd service for backend
sudo cp deployment/marine-backend.service /etc/systemd/system/
sudo systemctl enable marine-backend
sudo systemctl start marine-backend
```

#### S3 for Static Assets (Optional)

```bash
# Upload frontend build to S3
aws s3 sync dist/ s3://your-bucket-name/ --acl public-read

# Configure CloudFront for CDN
# Point to S3 bucket
```

### Google Cloud Platform (GCP)

#### Compute Engine Setup

```bash
# 1. Create VM instance
gcloud compute instances create marine-detection \
    --machine-type=e2-medium \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB

# 2. SSH into instance
gcloud compute ssh marine-detection

# 3. Follow same setup as AWS EC2
```

### DigitalOcean Droplet

```bash
# 1. Create Droplet (Ubuntu 22.04, 2GB RAM minimum)

# 2. SSH into droplet
ssh root@your-droplet-ip

# 3. Follow same setup as AWS EC2
```

---

## 🐳 Docker Deployment

### Dockerfile for Backend

```dockerfile
# backend/Dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Dockerfile for Frontend

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend/marine_detection.db:/app/marine_detection.db
      - ./backend/weights:/app/weights
      - ./backend/processed_videos:/app/processed_videos
    environment:
      - ENVIRONMENT=production
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
    restart: unless-stopped

  frontend:
    build: .
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

### Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## 🔒 Security Hardening

### Environment Variables

Create `.env` file in backend:

```bash
# backend/.env
ENVIRONMENT=production
JWT_SECRET_KEY=<generate-secure-random-key>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Database
DATABASE_PATH=/var/lib/marine-detection/database.db

# API Keys (if using external services)
NOAA_API_KEY=<your-key>
WAQI_API_KEY=<your-key>

# CORS
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Generate Secure JWT Secret

```python
import secrets
print(secrets.token_urlsafe(32))
```

### Firewall Configuration

```bash
# Ubuntu/Debian with UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Block direct access to backend port
sudo ufw deny 8000/tcp
```

### SSL/TLS Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal is configured automatically
sudo certbot renew --dry-run
```

---

## 📊 Monitoring & Logging

### System Monitoring

```bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Monitor processes
htop

# Monitor disk I/O
iotop

# Monitor network
nethogs
```

### Application Logging

**Backend Logging:**
```python
# In main.py, configure logging
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/marine-detection/backend.log'),
        logging.StreamHandler()
    ]
)
```

**Log Rotation:**
```bash
# /etc/logrotate.d/marine-detection
/var/log/marine-detection/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

---

## 🔄 Backup Strategy

### Automated Database Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/var/backups/marine-detection"
DB_PATH="/var/lib/marine-detection/database.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Create backup
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/database_$DATE.db'"

# Compress
gzip $BACKUP_DIR/database_$DATE.db

# Keep only last 30 days
find $BACKUP_DIR -name "database_*.db.gz" -mtime +30 -delete

echo "Backup completed: database_$DATE.db.gz"
```

### Cron Job for Backups

```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /path/to/backup.sh >> /var/log/marine-detection/backup.log 2>&1
```

---

## 🚦 Health Checks

### Backend Health Check

```bash
# Check if backend is running
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","yolo_model_loaded":true}
```

### Automated Health Monitoring

```bash
#!/bin/bash
# health-check.sh

BACKEND_URL="http://localhost:8000/health"
FRONTEND_URL="http://localhost:80"

# Check backend
if curl -f -s $BACKEND_URL > /dev/null; then
    echo "Backend: OK"
else
    echo "Backend: FAILED"
    # Restart service
    sudo systemctl restart marine-backend
fi

# Check frontend
if curl -f -s $FRONTEND_URL > /dev/null; then
    echo "Frontend: OK"
else
    echo "Frontend: FAILED"
    sudo systemctl restart nginx
fi
```

### Cron for Health Checks

```bash
# Every 5 minutes
*/5 * * * * /path/to/health-check.sh >> /var/log/marine-detection/health.log 2>&1
```

---

## 📈 Performance Optimization

### Database Optimization

```bash
# Run VACUUM and ANALYZE regularly
sqlite3 /path/to/database.db "VACUUM; ANALYZE;"

# Add to cron (weekly)
0 3 * * 0 sqlite3 /var/lib/marine-detection/database.db "VACUUM; ANALYZE;"
```

### Nginx Caching

```nginx
# Add to nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

location /api {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    
    proxy_pass http://localhost:8000;
}
```

---

## 🆘 Troubleshooting

### Backend Won't Start

```bash
# Check logs
sudo journalctl -u marine-backend -n 50

# Check if port is in use
sudo lsof -i :8000

# Check Python dependencies
pip3 list | grep -i fastapi
```

### Frontend Not Loading

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Test Nginx configuration
sudo nginx -t
```

### Database Issues

```bash
# Check database file permissions
ls -la /var/lib/marine-detection/database.db

# Check database integrity
sqlite3 database.db "PRAGMA integrity_check;"

# Restore from backup
cp /var/backups/marine-detection/database_latest.db.gz .
gunzip database_latest.db.gz
mv database_latest.db /var/lib/marine-detection/database.db
```

---

## 📞 Support

For deployment issues:
1. Check logs in `/var/log/marine-detection/`
2. Review systemd service status
3. Verify firewall and network configuration
4. Check resource usage (CPU, RAM, disk)
5. Consult documentation in `docs/` directory

---

**Deployment should take approximately 30-60 minutes for a complete production setup.**

✅ **Production-ready deployment with security, monitoring, and backup strategies!**
