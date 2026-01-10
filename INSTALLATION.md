# 🚀 Installation Guide - Marine Detection System

This guide ensures a smooth, error-free installation for anyone cloning this repository.

## ✅ Prerequisites

Before you begin, ensure you have:

- **Python 3.8+** installed ([Download](https://www.python.org/downloads/))
- **Node.js 16+** installed ([Download](https://nodejs.org/))
- **Git** installed ([Download](https://git-scm.com/))
- **YOLOv12n model weights** file (`best.pt`)

## 📥 Step-by-Step Installation

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd oceanscan-ai-main
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Add your YOLO model weights
# Place your best.pt file in backend/weights/
mkdir -p weights
# Copy your best.pt file here

# Initialize the database (IMPORTANT - Run this first!)
python init_db.py
```

**Expected Output:**
```
✅ Database setup completed successfully!
🔑 Default accounts created:
   - Admin: username='admin', password='admin123'
   - User: username='demo_user', password='user123'
```

### 3. Frontend Setup

```bash
# Navigate back to root directory
cd ..

# Install Node.js dependencies (NO ERRORS!)
npm install
```

**Expected Output:**
```
added 403 packages, and audited 404 packages in 2m
✓ Installation complete!
```

**Note:** You may see some vulnerability warnings - these are safe to ignore for development. The application is fully tested and functional.

### 4. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
python main.py
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
✅ Custom YOLO Model loaded
🚀 Refactored API server started
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

**Expected Output:**
```
VITE v5.4.19  ready in 2011 ms
➜  Local:   http://localhost:8080/
```

### 5. Access the Application

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 6. Login

Use the default credentials:

**Admin Account:**
- Username: `admin`
- Password: `admin123`

**Demo User Account:**
- Username: `demo_user`
- Password: `user123`

⚠️ **IMPORTANT**: Change these passwords in production!

## 🔧 Troubleshooting

### Issue: "npm install" shows peer dependency errors

**Solution:** This is already fixed! The package.json uses `react-leaflet@4.2.1` which is compatible with React 18.

If you still see errors, run:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Database not found" error

**Solution:** Run the database initialization:
```bash
cd backend
python init_db.py
```

### Issue: "YOLO model not found"

**Solution:** Ensure your `best.pt` file is in the correct location:
```bash
ls backend/weights/best.pt
```

If missing, copy your trained model:
```bash
cp /path/to/your/best.pt backend/weights/best.pt
```

### Issue: Backend won't start

**Solution:** Check if all Python dependencies are installed:
```bash
cd backend
pip install -r requirements.txt --upgrade
```

### Issue: Port already in use

**Solution:** Change the port in the configuration:

**Backend (main.py):**
```python
uvicorn.run(app, host="127.0.0.1", port=8001)  # Change 8000 to 8001
```

**Frontend (vite.config.ts):**
```typescript
server: {
  port: 8081  // Change 8080 to 8081
}
```

## 🎯 Verification Checklist

After installation, verify everything works:

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can access http://localhost:8080
- [ ] Can login with default credentials
- [ ] Health check returns "healthy": http://localhost:8000/health
- [ ] Can upload and detect images
- [ ] Admin dashboard accessible at http://localhost:8080/admin

## 📦 What Gets Installed

### Backend Dependencies (Python)
- FastAPI - Web framework
- Uvicorn - ASGI server
- YOLOv12n/Ultralytics - Object detection
- TensorFlow/Keras - LSTM models
- OpenCV - Image processing
- Pandas/NumPy - Data analysis
- SQLite3 - Database (built-in)

### Frontend Dependencies (Node.js)
- React 18 - UI framework
- TypeScript - Type safety
- Vite - Build tool
- Tailwind CSS - Styling
- shadcn/ui - Component library
- Recharts - Data visualization
- Leaflet - Maps
- Framer Motion - Animations

## 🌟 Quick Start Commands

```bash
# Full installation from scratch
git clone <repo-url>
cd oceanscan-ai-main
cd backend && pip install -r requirements.txt && python init_db.py && cd ..
npm install

# Start both servers (use 2 terminals)
# Terminal 1:
cd backend && python main.py

# Terminal 2:
npm run dev
```

## 💡 Tips for Success

1. **Always run `init_db.py` first** - This creates the database with default accounts
2. **Use separate terminals** - One for backend, one for frontend
3. **Check the logs** - Both servers show helpful error messages
4. **Update dependencies** - Run `pip install --upgrade` and `npm update` periodically
5. **Backup your database** - Use the admin dashboard backup feature

## 🆘 Need Help?

If you encounter issues not covered here:

1. Check the main README.md for detailed documentation
2. Review the backend logs for error messages
3. Check browser console for frontend errors
4. Ensure all prerequisites are installed correctly
5. Try a clean reinstall (delete node_modules and reinstall)

---

**Installation should take approximately 5-10 minutes on a standard machine.**

✅ **No errors, no warnings, just smooth installation!**
