#!/usr/bin/env python3
"""
Database Migration: Add base64 image columns
Adds original_base64 and annotated_base64 columns to images table
"""

import sqlite3
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    """Add base64 columns to images table"""
    
    db_path = os.path.join(os.path.dirname(__file__), "marine_detection.db")
    
    if not os.path.exists(db_path):
        logger.error(f"Database not found at {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logger.info("🔧 Adding base64 columns to images table...")
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(images)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'original_base64' not in columns:
            cursor.execute("ALTER TABLE images ADD COLUMN original_base64 TEXT")
            logger.info("✅ Added original_base64 column")
        else:
            logger.info("ℹ️ original_base64 column already exists")
        
        if 'annotated_base64' not in columns:
            cursor.execute("ALTER TABLE images ADD COLUMN annotated_base64 TEXT")
            logger.info("✅ Added annotated_base64 column")
        else:
            logger.info("ℹ️ annotated_base64 column already exists")
        
        conn.commit()
        conn.close()
        
        logger.info("✅ Migration completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    migrate()
