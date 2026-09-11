import { modelManager } from './modelManager';
import { preprocessImage } from './preprocessor';
import { decodeModelOutput, applyNMS } from './decoder';
import { calculateSceneRisk } from './riskEngine';

/**
 * Unified MargDrishti AI Road Hazard Detection API
 *
 * @param {HTMLImageElement | File | Blob | HTMLCanvasElement | HTMLVideoElement | string} imageSource
 * @param {object} options
 * @param {string} options.model 'pothole' | 'rdd' | 'obstacle' | 'unified'
 * @param {number} options.confThreshold
 * @param {number} options.nmsThreshold
 * @returns {Promise<{
 *   status: "DETECTED" | "CLEAR" | "UNCERTAIN" | "ERROR",
 *   detections: Array,
 *   inferenceTime: number,
 *   preprocessTime: number,
 *   totalTime: number,
 *   sceneRisk: object,
 *   diagnostic: object,
 *   error: string | null,
 *   imageMetadata: object
 * }>}
 */
export async function detectRoadHazards(imageSource, options = {}) {
  const modelChoice = options.model || 'unified';
  const confThreshold = options.confThreshold ?? 0.25;
  const nmsThreshold = options.nmsThreshold ?? 0.45;

  const startTime = performance.now();
  let preprocessTime = 0;
  let inferenceTime = 0;

  try {
    modelManager.acquireLock();

    console.log(`[MargDrishti AI] Starting hazard evaluation (model: ${modelChoice}, conf: ${confThreshold})...`);
    console.log(`[MargDrishti AI] Preprocessing image...`);

    // 1. Preprocess image into Float32 BCHW tensor [1, 3, 640, 640]
    const prepStart = performance.now();
    const { tensor, metadata, sourceImg } = await preprocessImage(imageSource, 640);
    preprocessTime = Math.round(performance.now() - prepStart);

    console.log(`[MargDrishti AI] Preprocessing complete in ${preprocessTime}ms. Original: ${metadata.origW}x${metadata.origH}px`);
    console.log(`[MargDrishti AI] Inference started...`);

    let rawDetections = [];
    const modelsUsed = [];
    const infStart = performance.now();

    if (modelChoice === 'unified') {
      // 1. Run Pothole Specialist (YOLO-End2End)
      const potholeModel = await modelManager.getModel('pothole');
      modelsUsed.push(potholeModel.info.name);

      const tPotholeStart = performance.now();
      const potholeInputName = potholeModel.session.inputNames?.[0] || 'images';
      const potholeOutputs = await potholeModel.session.run({ [potholeInputName]: tensor });
      const tPotholeDuration = performance.now() - tPotholeStart;

      const potholeOutputName = potholeModel.session.outputNames?.[0] || 'output0';
      const potholeTensor = potholeOutputs[potholeOutputName] || potholeOutputs.output0 || potholeOutputs[Object.keys(potholeOutputs)[0]];
      const potholeDets = decodeModelOutput(potholeTensor, potholeModel.info, metadata, {
        confThreshold,
        nmsThreshold
      });

      console.log(`[MargDrishti AI] Pothole Specialist found ${potholeDets.length} raw detections in ${tPotholeDuration.toFixed(1)}ms`);
      rawDetections.push(...potholeDets);

      // 2. Run RDD Global Multi-Damage Detector (YOLOv8 Global Benchmark)
      const rddGlobalModel = await modelManager.getModel('rddGlobal');
      modelsUsed.push(rddGlobalModel.info.name);

      const tRddStart = performance.now();
      const rddInputName = rddGlobalModel.session.inputNames?.[0] || 'images';
      const rddOutputs = await rddGlobalModel.session.run({ [rddInputName]: tensor });
      const tRddDuration = performance.now() - tRddStart;

      const rddOutputName = rddGlobalModel.session.outputNames?.[0] || 'output0';
      const rddTensor = rddOutputs[rddOutputName] || rddOutputs.output0 || rddOutputs[Object.keys(rddOutputs)[0]];
      const rddDets = decodeModelOutput(rddTensor, rddGlobalModel.info, metadata, {
        confThreshold,
        nmsThreshold
      });

      console.log(`[MargDrishti AI] RDD Global Model found ${rddDets.length} raw detections in ${tRddDuration.toFixed(1)}ms`);
      rawDetections.push(...rddDets);

      // 3. Run Road Obstacle & Debris Detector (YOLOv8 COCO)
      const obstacleModel = await modelManager.getModel('obstacle');
      modelsUsed.push(obstacleModel.info.name);

      const tObstacleStart = performance.now();
      const obstacleInputName = obstacleModel.session.inputNames?.[0] || 'images';
      const obstacleOutputs = await obstacleModel.session.run({ [obstacleInputName]: tensor });
      const tObstacleDuration = performance.now() - tObstacleStart;

      const obstacleOutputName = obstacleModel.session.outputNames?.[0] || 'output0';
      const obstacleTensor = obstacleOutputs[obstacleOutputName] || obstacleOutputs.output0 || obstacleOutputs[Object.keys(obstacleOutputs)[0]];
      const obstacleDets = decodeModelOutput(obstacleTensor, obstacleModel.info, metadata, {
        confThreshold,
        nmsThreshold
      });

      console.log(`[MargDrishti AI] Obstacle Detector found ${obstacleDets.length} raw detections in ${tObstacleDuration.toFixed(1)}ms`);
      rawDetections.push(...obstacleDets);

      inferenceTime = Math.round(performance.now() - infStart);
    } else {
      // Single specific model inference
      const targetModel = await modelManager.getModel(modelChoice);
      modelsUsed.push(targetModel.info.name);

      const targetInputName = targetModel.session.inputNames?.[0] || 'images';
      const outputs = await targetModel.session.run({ [targetInputName]: tensor });
      inferenceTime = Math.round(performance.now() - infStart);

      const targetOutputName = targetModel.session.outputNames?.[0] || 'output0';
      const outputTensor = outputs[targetOutputName] || outputs.output0 || outputs[Object.keys(outputs)[0]];
      rawDetections = decodeModelOutput(outputTensor, targetModel.info, metadata, {
        confThreshold,
        nmsThreshold
      });
    }

    console.log(`[MargDrishti AI] Inference completed: ${inferenceTime} ms`);
    console.log(`[MargDrishti AI] Detections after confidence filtering (>= ${confThreshold}): ${rawDetections.length}`);

    // Apply global NMS to suppress overlapping duplicate detections
    const filteredDetections = applyNMS(rawDetections, nmsThreshold);
    console.log(`[MargDrishti AI] Detections after NMS: ${filteredDetections.length}`);

    // Calculate explainable scene risk
    const sceneRisk = calculateSceneRisk(filteredDetections);

    // Determine final honest status
    let status = 'CLEAR';
    if (filteredDetections.length > 0) {
      status = 'DETECTED';
    } else {
      // Check if any marginal signals existed between 0.15 and threshold
      const marginalCount = rawDetections.filter(d => d.confidence >= 0.15).length;
      if (marginalCount > 0) {
        status = 'UNCERTAIN';
      } else {
        status = 'CLEAR';
      }
    }

    const totalTime = Math.round(performance.now() - startTime);

    const diagnostic = {
      modelsExecuted: modelsUsed,
      inputTensor: `[1, 3, 640, 640] Float32`,
      outputTensor: modelChoice === 'pothole' ? '[1, 300, 6]' : (modelChoice === 'rdd' ? '[1, 10, 8400]' : (modelChoice === 'rddGlobal' ? '[1, 9, 8400]' : (modelChoice === 'obstacle' ? '[1, 84, 8400]' : '[1, 300, 6] (Pothole) + [1, 9, 8400] (RDD Global) + [1, 84, 8400] (Obstacle)'))),
      rawDetectionsCount: rawDetections.length,
      filteredDetectionsCount: filteredDetections.length,
      confidenceThreshold: `${Math.round(confThreshold * 100)}%`,
      inferenceTimeMs: inferenceTime,
      preprocessTimeMs: preprocessTime,
      totalTimeMs: totalTime,
      status,
      detectedClasses: filteredDetections.map(d => d.type),
      supportedHazardClasses: [
        'Pothole',
        'Longitudinal Crack',
        'Transverse Crack',
        'Alligator Crack',
        'Crosswalk Blur',
        'Whiteline Blur',
        'Road Obstacle / Debris'
      ],
      unsupportedCategoriesNote: 'Waterlogging, Flooded Road, and Open Manholes are not currently in the trained model classes.',
      timestamp: new Date().toISOString()
    };

    console.log(`[MargDrishti AI DIAGNOSTIC]`, diagnostic);

    return {
      status,
      detections: sceneRisk.evaluatedDetections || filteredDetections || [],
      inferenceTime,
      preprocessTime,
      totalTime,
      sceneRisk,
      diagnostic,
      imageMetadata: metadata,
      sourceImg,
      error: null
    };

  } catch (err) {
    console.error(`[MargDrishti AI] Analysis failed:`, err);
    return {
      status: 'ERROR',
      detections: [],
      inferenceTime: 0,
      preprocessTime: 0,
      totalTime: 0,
      sceneRisk: null,
      diagnostic: {
        error: err.message,
        timestamp: new Date().toISOString()
      },
      imageMetadata: null,
      sourceImg: null,
      error: err.message || 'AI inference encountered an unexpected error.'
    };
  } finally {
    modelManager.releaseLock();
  }
}
