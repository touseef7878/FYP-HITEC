# YOLOv26s-Based Marine Debris Detection in OceanGuard AI

**Project**: OceanGuard AI — Final Year Project 2026  
**Institution**: HITEC University Taxila  
**Weights**: `backend/weights/best.pt`  
**Training Platform**: Kaggle (NVIDIA T4 GPU)

---

## Abstract

Automated detection of marine debris from visual media is a critical capability for scalable ocean monitoring. This document presents the design, training, and deployment of a custom YOLOv26s (Small) object detection model within the OceanGuard AI system. The model is trained on a merged dataset of approximately 16,500 marine debris images spanning **eight** object classes, sourced from seven Roboflow datasets and merged with a custom label-harmonization pipeline. Training was performed on a Kaggle NVIDIA T4 GPU over 100 epochs, achieving an overall mAP50 of 71% and inference speed of ~25ms per frame on CPU. The system supports both single-image and asynchronous video detection pipelines, with results persisted to a relational database and visualized through a React frontend. Per-class performance ranges from 99.4% mAP50 for fishing nets to 21.0% for plastic fragments, reflecting the inherent visual complexity of marine debris categories. This document covers the YOLOv26s architecture, dataset construction and merging methodology, training configuration, per-class analysis, inference pipelines, and directions for future improvement.

---

## 1. Introduction

Marine debris — encompassing plastic waste, discarded fishing gear, metal refuse, and glass — poses severe threats to marine ecosystems, wildlife, and human health. Manual monitoring through vessel surveys and diver inspections is costly, slow, and geographically limited. Computer vision-based automated detection from drone footage, underwater cameras, and satellite imagery offers a scalable alternative.

The YOLO (You Only Look Once) family of object detectors has established itself as the dominant paradigm for real-time detection tasks due to its single-pass inference architecture, which eliminates the two-stage proposal-then-classify bottleneck of earlier detectors (Redmon et al., 2016). YOLOv26s, the model used in this project, represents a state-of-the-art single-stage detector offering strong accuracy at the Small model scale.

OceanGuard AI integrates a custom-trained YOLOv26s model to detect **eight** categories of marine debris from user-uploaded images and videos. The system is designed for operational deployment: it processes images in under 25ms, handles asynchronous video processing via background threads, and exposes results through a REST API consumed by a React dashboard.

---

## 2. YOLOv26s Architecture Background

### 2.1 Single-Stage Detection Paradigm

YOLOv26s follows the single-stage detection paradigm: a single forward pass through the network produces bounding box coordinates, objectness scores, and class probabilities simultaneously. This contrasts with two-stage detectors (e.g., Faster R-CNN) that first generate region proposals and then classify them — a design that improves accuracy at the cost of inference speed.

### 2.2 Network Structure

YOLOv26s employs a CSP (Cross Stage Partial) backbone with C2f modules, a Path Aggregation Network (PAN) neck for multi-scale feature fusion, and a decoupled detection head that separates classification and regression branches. Key architectural properties include:

- **Anchor-free detection**: Eliminates hand-crafted anchor boxes, reducing hyperparameter sensitivity.
- **Decoupled head**: Separate branches for classification and bounding box regression improve gradient flow.
- **C2f modules**: Enhanced cross-stage partial connections improve gradient flow through the backbone.
- **Multi-scale feature fusion**: PAN neck aggregates features from multiple backbone stages for detecting objects at different scales.

### 2.3 Model Scale

OceanGuard AI uses the **Small (s)** variant, which provides a favorable balance between accuracy and inference speed for CPU deployment — critical for a web application where GPU inference is not guaranteed at runtime.

| Variant | Speed (CPU) | Use Case |
|---|---|---|
| Nano (n) | ~80ms | Edge devices |
| **Small (s)** | **~25ms** | **Web deployment (this project)** |
| Medium (m) | ~234ms | Server GPU |

---

## 3. Dataset

### 3.1 Dataset Sources

The training dataset was assembled by merging **seven Roboflow datasets**, all publicly available, covering diverse marine debris scenarios:

| # | Dataset Name | Roboflow URL |
|---|---|---|
| 1 | underwater_trash | `roboflow.com/ds/J7bSQC3qjl` |
| 2 | marine_debris | `roboflow.com/ds/zci5BoLmer` |
| 3 | can_dataset | `roboflow.com/ds/6aTJftUQtt` |
| 4 | underwater_ds | `roboflow.com/ds/dFlMXAXCPr` |
| 5 | plastic_bottle | `roboflow.com/ds/ukianfZcXE` |
| 6 | plastic_bag | `roboflow.com/ds/0mitb3wvv3` |
| 7 | final_project | `roboflow.com/ds/GboZC1KUKF` |

Total merged images: **~16,500** after label harmonization and deduplication.

### 3.2 Label Harmonization

Each source dataset used different class names for the same physical objects. A master mapping was applied to consolidate all source labels into 8 unified target classes:

```python
MAPPING = {
    # Class 0 — fishing_net
    'net': 0, 'fishing_net': 0, 'rope': 0, 'fishing_line': 0,

    # Class 1 — plastic_bottle
    'plastic_bottle': 1, 'pbottle': 1, 'bottle_cap': 1,
    'water_bottle': 1, 'Plastic bottle': 1,

    # Class 2 — metal_can
    'can': 2, 'metal_can': 2, 'drink_can': 2,
    'aluminum_can': 2, 'Can': 2,

    # Class 3 — tyre
    'tyre': 3, 'tire': 3,

    # Class 4 — glass_container
    'glass_bottle': 4, 'gbottle': 4, 'glass': 4,
    'jar': 4, 'Glass Bottles': 4,

    # Class 5 — plastic_bag
    'plastic_bag': 5, 'pbag': 5, 'Plastic bag': 5,

    # Class 6 — plastic_fragments
    'plastic_wrapper': 6, 'styrofoam': 6,
    'packaging': 6, 'fragment': 6,

    # Class 7 — other_debris
    'mask': 7, 'Mask': 7, 'clothing': 7, 'wood': 7,
    'metal_scrap': 7, 'garbage': 7, 'other': 7,
}
```

Labels not present in the mapping were discarded, ensuring only clean, harmonized annotations entered training.

### 3.3 Train/Validation Split

An 80/20 stratified split was applied using scikit-learn's `train_test_split` with `random_state=42` for reproducibility:

```
Training set:   ~13,200 images (80%)
Validation set: ~3,300  images (20%)
```

The final `data.yaml` used for training:

```yaml
train: /kaggle/working/research_final_8class/train/images
val:   /kaggle/working/research_final_8class/val/images
nc: 8
names: ['fishing_net', 'plastic_bottle', 'metal_can', 'tyre',
        'glass_container', 'plastic_bag', 'plastic_fragments', 'other_debris']
```

### 3.4 The 8 Detection Classes

| ID | Class | Source Labels Mapped |
|---|---|---|
| 0 | `fishing_net` | net, fishing_net, rope, fishing_line |
| 1 | `plastic_bottle` | plastic_bottle, pbottle, bottle_cap, water_bottle |
| 2 | `metal_can` | can, metal_can, drink_can, aluminum_can |
| 3 | `tyre` | tyre, tire |
| 4 | `glass_container` | glass_bottle, gbottle, glass, jar |
| 5 | `plastic_bag` | plastic_bag, pbag |
| 6 | `plastic_fragments` | plastic_wrapper, styrofoam, packaging, fragment |
| 7 | `other_debris` | mask, clothing, wood, metal_scrap, garbage, other |

### 3.5 Dataset Characteristics

Marine debris datasets present several challenges that distinguish them from standard object detection benchmarks:

- **Occlusion**: Debris is frequently partially submerged, buried in sediment, or entangled with other objects.
- **Scale variation**: Objects range from small fragments (centimetres) to large nets (metres).
- **Appearance variability**: Weathering, biofouling, and water distortion alter the visual appearance of debris over time.
- **Label heterogeneity**: Seven source datasets used inconsistent naming conventions, requiring the harmonization pipeline above.
- **Class imbalance**: Fishing nets and tyres are more consistently represented across datasets than plastic fragments.
- **Background complexity**: Underwater and surface water backgrounds introduce high-frequency texture noise.

---

## 4. Training Methodology

### 4.1 Training Platform

Training was performed on **Kaggle** using an **NVIDIA T4 GPU** (16GB VRAM), which provided sufficient memory for batch_size=16 at 640×640 resolution.

### 4.2 Training Script

```python
from ultralytics import YOLO

model = YOLO('yolo26s.pt')   # YOLOv26s pretrained base weights

results = model.train(
    data='/kaggle/working/research_final_8class/data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    device=0,                # T4 GPU
    name='Marine_Debris_SOTA_2026',
    augment=True,
    patience=20,             # early stopping
)
```

### 4.3 Training Configuration

| Parameter | Value |
|---|---|
| Base weights | `yolo26s.pt` (pretrained) |
| Input resolution | 640 × 640 pixels |
| Epochs | 100 |
| Batch size | 16 |
| Device | Kaggle NVIDIA T4 GPU |
| Early stopping patience | 20 epochs |
| Augmentation | Enabled (`augment=True`) |
| Run name | `Marine_Debris_SOTA_2026` |

### 4.4 Data Augmentation

With `augment=True`, the following augmentation strategies were applied during training:

**Mosaic augmentation**: Combines four training images into a single composite image, forcing the model to detect objects at reduced scale and in novel spatial contexts. This is particularly effective for small debris fragments.

**Mixup augmentation**: Linearly interpolates between pairs of images and their labels, creating soft-label training examples that improve calibration and reduce overconfidence.

**AutoAugment**: Applies a learned policy of photometric and geometric transformations (brightness, contrast, rotation, shear) selected to maximize validation performance.

These augmentations are especially important for marine debris detection, where the visual appearance of objects varies substantially with water conditions, lighting, and camera angle.

### 4.5 Confidence Threshold

The confidence threshold is user-configurable via a slider in the frontend (range: 10%–90%, default: 25%). A lower threshold increases recall at the cost of precision; the 25% default was selected to balance detection sensitivity against false positive rate for operational use. The threshold is applied at inference time:

```python
results = model(image_array, conf=threshold / 100, verbose=False)
```

---

## 5. Performance Evaluation

### 5.1 Overall Metrics

| Metric | Value |
|---|---|
| mAP50 | 71.0% (70.3% weighted) |
| mAP50-95 | 52% |
| Precision | 83% |
| Recall | 67% |
| Inference speed | ~25ms/frame (CPU) |

The precision–recall trade-off (P=83%, R=67%) reflects a model tuned toward precision: it is more conservative about confirming detections, reducing false positives at the cost of missing some true debris instances. This is appropriate for an environmental monitoring context where false alarms erode user trust.

### 5.2 Per-Class Performance

| Class | mAP50 | Assessment |
|---|---|---|
| fishing_net | 99.4% | Exceptional |
| tyre | 89.1% | Excellent |
| glass_container | 74.7% | Strong |
| metal_can | 70.3% | Good |
| other_debris | 62.1% | Moderate |
| plastic_bag | 61.2% | Moderate |
| plastic_bottle | 53.6% | Moderate |
| plastic_fragments | 21.0% | Developing |

### 5.3 Per-Class Analysis

**fishing_net (99.4%)**: Fishing nets exhibit large, distinctive woven textures with high contrast against water backgrounds. Their spatial extent is large relative to the image frame, providing abundant feature signal. The near-perfect mAP50 reflects both the visual distinctiveness of this class and its strong representation in the training data.

**tyre (89.1%)**: Rubber tyres have a highly consistent circular morphology and distinctive tread patterns. Their rigid structure means appearance is relatively invariant to weathering, and they are rarely partially occluded in the same way as flexible debris. The 89.1% mAP50 reflects this visual consistency.

**glass_container (74.7%)** and **metal_can (70.3%)**: Both classes have relatively consistent shapes (cylindrical/rectangular) but suffer from specular reflections on water surfaces and partial submersion that obscures distinctive features. Performance is strong but not exceptional.

**other_debris (62.1%)**: This catch-all class is inherently heterogeneous, encompassing objects that do not fit the eight specific categories. The model must learn a negative-space definition ("debris that is not any of the other classes"), which is a fundamentally harder learning problem.

**plastic_bag (61.2%)**: Plastic bags are highly deformable, adopting irregular shapes depending on water currents and entanglement. Their translucency in water further reduces visual distinctiveness. The 61.2% mAP50 reflects these challenges.

**plastic_bottle (53.6%)**: Partially submerged bottles lose their characteristic cylindrical profile, presenting as irregular shapes at the waterline. Label ambiguity between plastic_bottle and plastic_fragments for heavily degraded bottles also contributes to reduced performance.

**plastic_fragments (21.0%)**: This is the most challenging class. Plastic fragments are highly variable in shape, size, color, and texture — ranging from microplastic pellets to large irregular shards. Their small size relative to the image frame reduces the feature signal available to the detector. The 21.0% mAP50 indicates that this class requires substantially more training data and potentially specialized detection strategies (e.g., higher-resolution crops, dedicated small-object detection heads).

---

## 6. Inference Pipelines

### 6.1 Image Detection Pipeline (POST /detect)

The image detection pipeline processes a single uploaded image synchronously:

```
1. Receive multipart/form-data (image file)
2. Load with PIL → convert to RGB numpy array
3. Run YOLO inference: model(image_array, conf=threshold, verbose=False)
4. Extract results: boxes.xyxy, boxes.conf, boxes.cls
5. Draw bounding boxes with class labels + confidence on annotated image
6. Encode both original and annotated images as base64 strings
7. Persist to database:
   - detections table (metadata)
   - detection_results table (per-box records)
   - images table (base64 originals + annotated)
8. Return JSON: { detections: [...], original_b64: "...", annotated_b64: "..." }
```

Bounding box coordinates are stored in absolute pixel space (`bbox_x1`, `bbox_y1`, `bbox_x2`, `bbox_y2`) alongside the frame number (0 for images) to support unified storage with video detections.

### 6.2 Video Detection Pipeline (POST /detect-video)

Video processing is handled asynchronously to avoid blocking the HTTP response:

```
1. Receive video file → save as original_{uuid}.{ext} in processed_videos/
2. Return detection_id immediately (HTTP 202 Accepted)
3. Background thread (ThreadPoolExecutor, 2–4 workers):
   a. Open with cv2.VideoCapture
   b. Process ALL frames (no frame skipping) for maximum accuracy
   c. Run YOLO on each frame with configured confidence threshold
   d. Draw bounding boxes on each annotated frame
   e. Write to processed_{uuid}.mp4 with cv2.VideoWriter
   f. Update DB status: pending → processing → completed
4. Frontend polls GET /api/detections/{id}/status every 2 seconds
5. On completion: auto-redirect to Results page
```

The decision to process all frames (rather than sampling every N-th frame) prioritizes detection completeness over processing speed, which is appropriate for environmental monitoring where missed detections have real-world consequences.

### 6.3 Pipeline Comparison

| Aspect | Image Pipeline | Video Pipeline |
|---|---|---|
| Processing mode | Synchronous | Asynchronous (background thread) |
| Response | Immediate results | detection_id + polling |
| Frame handling | Single frame | All frames, no skipping |
| Output | base64 annotated image | Annotated MP4 file |
| Storage | images table | videos table |
| Concurrency | Per-request | ThreadPoolExecutor (2–4 workers) |

---

## 7. Video Streaming

Processed videos are served via `GET /processed-video/{filename}` with HTTP range request support, enabling browser-native video seeking:

- **Partial content (206)** responses for byte-range requests
- **Content-Type detection**: mp4 / webm / avi / mov
- **CORS headers** for cross-origin video playback from the React frontend
- **Cache-Control: max-age=3600** (1-hour client-side caching)

Range request support is essential for video playback in browsers, which issue range requests to enable seeking without downloading the entire file.

---

## 8. Database Schema

Detection results are persisted across four related tables:

**detections**: `user_id`, `filename`, `file_type`, `file_path`, `file_size`, `total_detections`, `confidence_threshold`, `processing_time`, `status`, `metadata`

**detection_results**: `detection_id`, `class_name`, `confidence`, `bbox_x1`, `bbox_y1`, `bbox_x2`, `bbox_y2`, `frame_number`

**images**: `detection_id`, `width`, `height`, `original_path`, `annotated_path`, `original_base64`, `annotated_base64`

**videos**: `detection_id`, `total_frames`, `processed_frames`, `fps`, `duration`, `resolution`, `original_path`, `annotated_path`

This schema supports both image and video detections through a unified `detections` parent table with type-specific child tables, enabling consistent querying across media types.

---

## 9. Frontend Integration

### 9.1 Upload.tsx

The upload interface provides:

- **Drag-and-drop zone** with file type validation (images: jpg/png/webp; video: mp4/webm/avi/mov)
- **Memoized FileItem component** to prevent unnecessary re-renders during multi-file uploads
- **Confidence threshold slider** in a collapsible settings panel (10%–90%, default 25%)
- **Real-time progress bar** with status transitions: `pending → uploading → processing → complete`
- **2-second polling** for video processing status via `GET /api/detections/{id}/status`
- **Auto-redirect** to Results page on completion

### 9.2 Results.tsx

The results interface provides:

- **Before/after image comparison slider** for side-by-side original vs. annotated view
- **Per-class detection breakdown** with individual confidence scores
- **VideoPlayer component** with frame navigation for video detections
- **Download annotated media** button
- **Share detection results** functionality

### 9.3 Dashboard.tsx Analytics

The dashboard aggregates detection history into four visualization panels:

| Panel | Chart Type | Content |
|---|---|---|
| Detection trends | Recharts AreaChart | Detections over time |
| Class distribution | Pie chart | Proportion per debris class |
| Object counts | Bar chart | Total detections per class |
| Stats cards | KPI cards | Total detections, avg confidence, this week, detection rate |

---

## 10. Discussion

### 10.1 Strengths

The YOLOv26s architecture provides a strong foundation for marine debris detection, achieving 71% mAP50 across eight classes on a challenging real-world dataset assembled from seven Roboflow sources. The high performance on fishing_net (99.4%) and tyre (89.1%) — the two classes with the most severe ecological impact — is particularly valuable for operational monitoring.

The asynchronous video pipeline with ThreadPoolExecutor enables concurrent processing of multiple video uploads without blocking the API server, and the HTTP range request implementation provides a smooth video playback experience in the browser.

The configurable confidence threshold gives operators control over the precision–recall trade-off, allowing the system to be tuned for different operational contexts (e.g., lower threshold for comprehensive surveys, higher threshold for automated alerting).

### 10.2 Limitations

- **plastic_fragments performance (21.0%)**: The lowest-performing class represents one of the most ecologically significant debris types. Microplastic and fragment detection requires specialized approaches beyond standard object detection.
- **Dataset bias**: The merged dataset may over-represent certain geographic regions or debris conditions (e.g., clear water, good lighting), reducing generalization to turbid or low-light environments.
- **CPU inference latency for video**: At ~25ms per frame, a 30fps video requires ~750ms of processing per second of footage. Long videos (>10 minutes) may have significant processing times.
- **No tracking**: The video pipeline detects objects independently per frame without temporal tracking (e.g., SORT, DeepSORT), meaning the same debris object may be counted multiple times across frames.
- **Fixed input resolution**: The 640×640 input resolution may be insufficient for detecting small debris in high-resolution drone or satellite imagery.

---

## 11. Future Work

1. **Small object detection**: Implementing a dedicated small-object detection head or using SAHI (Slicing Aided Hyper Inference) to process high-resolution images in overlapping tiles would improve plastic_fragments performance.

2. **Multi-object tracking**: Integrating a tracking algorithm (e.g., ByteTrack, which is natively supported in Ultralytics YOLOv26s) would enable unique debris counting across video frames and trajectory analysis.

3. **Domain adaptation**: Fine-tuning on region-specific data (e.g., turbid coastal waters, deep-sea footage) would improve generalization beyond the training distribution.

4. **Model distillation**: Distilling the YOLOv26s model into a lighter Nano variant could enable edge deployment on autonomous underwater vehicles (AUVs) or buoy-mounted cameras.

5. **Severity estimation**: Extending the model to estimate debris density or pollution severity from detection counts and spatial distribution would enable direct integration with the LSTM pollution forecasting pipeline.

6. **Segmentation upgrade**: Migrating to a YOLOv26-seg (instance segmentation) variant would provide pixel-level debris masks, enabling more accurate area estimation and better handling of irregular shapes like plastic_fragments.

---

## 12. Conclusion

The OceanGuard AI YOLOv26s implementation demonstrates that a custom-trained single-stage detector can achieve operationally useful marine debris detection performance across eight classes, with overall mAP50 of 71% and exceptional performance on high-impact classes such as fishing nets (99.4%) and tyres (89.1%). The model was trained on a merged dataset of ~16,500 images from seven Roboflow sources using a Kaggle NVIDIA T4 GPU, with a custom label-harmonization pipeline consolidating heterogeneous annotations into eight unified classes. The system is fully integrated into an asynchronous image and video processing pipeline with database persistence, HTTP range-request video streaming, and a React frontend providing before/after comparison and analytics dashboards. The primary remaining challenge is improving detection of plastic fragments (21.0%), which will require targeted data collection and specialized small-object detection strategies.

---

## References

- Redmon, J., et al. (2016). You only look once: Unified, real-time object detection. *CVPR*.
- Jocher, G., et al. (2023). Ultralytics YOLOv26s. *GitHub*. https://github.com/ultralytics/ultralytics
- Bochkovskiy, A., Wang, C.-Y., & Liao, H.-Y. M. (2020). YOLOv4: Optimal speed and accuracy of object detection. *arXiv:2004.10934*.
- Wang, C.-Y., Bochkovskiy, A., & Liao, H.-Y. M. (2023). YOLOv7: Trainable bag-of-freebies sets new state-of-the-art for real-time object detectors. *CVPR*.
- Akiva, P., et al. (2022). Finding plastic patches in coastal waters using optical satellite data. *ISPRS Journal of Photogrammetry and Remote Sensing*.
- Fulton, M., et al. (2019). Robotic detection of marine litter using deep visual detection models. *ICRA*.
- Bewley, A., et al. (2016). Simple online and realtime tracking (SORT). *ICIP*.
