import * as ortModule from 'onnxruntime-web';

// Use window.ort if available from static bundle, otherwise fall back to imported module
const ort = (typeof window !== 'undefined' && window.ort) ? window.ort : ortModule;

// Configure ONNX Runtime Web WASM backend
try {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.wasmPaths = '/wasm/';
} catch (e) {
  console.warn('ONNX environment initialization warning:', e);
}

export const MODEL_REGISTRY = {
  pothole: {
    id: 'pothole',
    name: 'MargDrishti Pothole Specialist (YOLOv8-End2End)',
    path: '/models/pothole_model.onnx',
    size: '4.7 MB',
    type: 'end2end', // output: [1, 300, 6] -> [x1, y1, x2, y2, score, class_id]
    inputName: 'images',
    inputShape: [1, 3, 640, 640],
    outputName: 'output0',
    classes: ['Pothole'],
    description: 'High-precision real-time pothole detector with built-in NMS layer.'
  },
  rdd: {
    id: 'rdd',
    name: 'MargDrishti RDD2022 Multi-Damage Detector',
    path: '/models/rdd_model.onnx',
    size: '10.1 MB',
    type: 'yolo_multiclass', // output: [1, 10, 8400]
    inputName: 'images',
    inputShape: [1, 3, 640, 640],
    outputName: 'output0',
    classes: [
      'Longitudinal Crack',
      'Transverse Crack',
      'Alligator Crack',
      'Pothole',
      'Crosswalk Blur',
      'Whiteline Blur'
    ],
    description: 'Trained on Road Damage Detection benchmark (cracks, potholes, road markings).'
  },
  obstacle: {
    id: 'obstacle',
    name: 'MargDrishti Road Obstacle & Debris Detector',
    path: '/models/obstacle_model.onnx',
    size: '12.3 MB',
    type: 'yolo_coco', // output: [1, 84, 8400]
    inputName: 'images',
    inputShape: [1, 3, 640, 640],
    outputName: 'output0',
    classes: [
      'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
      'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
      'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
      'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
      'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
      'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
      'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
      'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
      'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
      'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
    ],
    description: 'Detects fallen debris, road objects, animals, and hazards.'
  }
};

class ModelManager {
  constructor() {
    this.sessions = new Map();
    this.loadingPromises = new Map();
    this.isInferencing = false;
  }

  /**
   * Loads or returns cached ONNX InferenceSession
   * @param {string} modelKey 'pothole' | 'rdd' | 'obstacle'
   * @returns {Promise<{session: ort.InferenceSession, info: object}>}
   */
  async getModel(modelKey = 'pothole') {
    const modelInfo = MODEL_REGISTRY[modelKey];
    if (!modelInfo) {
      throw new Error(`Unknown model key: ${modelKey}`);
    }

    if (this.sessions.has(modelKey)) {
      return { session: this.sessions.get(modelKey), info: modelInfo };
    }

    if (this.loadingPromises.has(modelKey)) {
      const session = await this.loadingPromises.get(modelKey);
      return { session, info: modelInfo };
    }

    const loadPromise = (async () => {
      console.log(`[MargDrishti AI] Loading ONNX model "${modelInfo.name}" from ${modelInfo.path}...`);
      const startTime = performance.now();
      
      const sessionOptions = {
        executionProviders: ['wasm']
      };

      try {
        let modelSource = modelInfo.path;
        if (typeof window !== 'undefined' && typeof fetch === 'function') {
          // Fetch model ArrayBuffer in browser for reliable zero-latency loading
          const response = await fetch(modelInfo.path);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} fetching model file from ${modelInfo.path}`);
          }
          modelSource = await response.arrayBuffer();
        }

        const session = await ort.InferenceSession.create(modelSource, sessionOptions);
        const duration = (performance.now() - startTime).toFixed(1);
        console.log(`[MargDrishti AI] Model "${modelInfo.name}" loaded successfully in ${duration}ms. Inputs: ${session.inputNames}, Outputs: ${session.outputNames}`);
        this.sessions.set(modelKey, session);
        return session;
      } catch (err) {
        console.error(`[MargDrishti AI] Error loading model ${modelInfo.name}:`, err);
        throw new Error(`Failed to load AI model (${modelInfo.name}): ${err.message}`);
      } finally {
        this.loadingPromises.delete(modelKey);
      }
    })();

    this.loadingPromises.set(modelKey, loadPromise);
    const session = await loadPromise;
    return { session, info: modelInfo };
  }

  /**
   * Preload default primary models in background
   */
  async preloadModels() {
    try {
      await this.getModel('pothole');
      this.getModel('rdd').catch(e => console.warn('Background RDD load note:', e));
    } catch (e) {
      console.warn('Initial model preload note:', e);
    }
  }

  /**
   * Acquire mutex lock to prevent simultaneous duplicate inference
   */
  acquireLock() {
    if (this.isInferencing) {
      throw new Error('Inference already in progress. Please wait for current analysis to complete.');
    }
    this.isInferencing = true;
  }

  /**
   * Release mutex lock
   */
  releaseLock() {
    this.isInferencing = false;
  }
}

export const modelManager = new ModelManager();
