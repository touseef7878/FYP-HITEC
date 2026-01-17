#!/usr/bin/env python3
"""
Video Codec Fixer
Converts existing processed videos to browser-compatible format
"""

import os
import cv2
import glob
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_video_codec(input_path, output_path):
    """Convert video to browser-compatible H.264 codec"""
    try:
        # Open input video
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            logger.error(f"Cannot open input video: {input_path}")
            return False
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Input video: {width}x{height} @ {fps} FPS, {total_frames} frames")
        
        # Setup output video writer with H.264 codec
        fourcc = cv2.VideoWriter_fourcc(*'H264')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        if not out.isOpened():
            logger.warning("H264 failed, trying avc1...")
            fourcc = cv2.VideoWriter_fourcc(*'avc1')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        if not out.isOpened():
            logger.error("Failed to create output video writer")
            cap.release()
            return False
        
        logger.info("Converting video...")
        frame_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            out.write(frame)
            frame_count += 1
            
            if frame_count % 30 == 0:  # Progress every 30 frames
                progress = (frame_count / total_frames) * 100
                logger.info(f"Progress: {progress:.1f}% ({frame_count}/{total_frames})")
        
        # Cleanup
        cap.release()
        out.release()
        
        logger.info(f"✅ Video conversion complete: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error converting video: {e}")
        return False

def main():
    """Fix all videos in processed_videos directory"""
    processed_videos_dir = "processed_videos"
    
    if not os.path.exists(processed_videos_dir):
        logger.error(f"Directory not found: {processed_videos_dir}")
        return
    
    # Find all MP4 files
    video_files = glob.glob(os.path.join(processed_videos_dir, "*.mp4"))
    
    if not video_files:
        logger.info("No MP4 files found to convert")
        return
    
    logger.info(f"Found {len(video_files)} video files to check/convert")
    
    for video_file in video_files:
        logger.info(f"\n🔄 Processing: {os.path.basename(video_file)}")
        
        # Create backup filename
        backup_file = video_file.replace(".mp4", "_backup.mp4")
        fixed_file = video_file.replace(".mp4", "_fixed.mp4")
        
        # Convert to browser-compatible format
        if fix_video_codec(video_file, fixed_file):
            # If conversion successful, replace original
            try:
                os.rename(video_file, backup_file)  # Backup original
                os.rename(fixed_file, video_file)   # Replace with fixed version
                logger.info(f"✅ Replaced {os.path.basename(video_file)} with browser-compatible version")
                logger.info(f"   Backup saved as: {os.path.basename(backup_file)}")
            except Exception as e:
                logger.error(f"Error replacing file: {e}")
        else:
            logger.error(f"❌ Failed to convert {os.path.basename(video_file)}")

if __name__ == "__main__":
    main()