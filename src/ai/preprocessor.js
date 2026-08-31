import * as ortModule from 'onnxruntime-web';

const ort = (typeof window !== 'undefined' && window.ort) ? window.ort : ortModule;

/**
 * Preprocesses an image source (HTMLImageElement, File, Blob, HTMLCanvasElement, HTMLVideoElement, or image URL)
 * into a letterboxed Float32Array tensor [1, 3, 640, 640] normalized to [0, 1].
 *
 * Preserves aspect ratio with 114 gray padding and calculates exact reverse coordinate mapping.
 */
export async function preprocessImage(imageSource, targetSize = 640) {
  const img = await loadImageElement(imageSource);
  const origW = img.naturalWidth || img.videoWidth || img.width;
  const origH = img.naturalHeight || img.videoHeight || img.height;

  if (!origW || !origH) {
    throw new Error('Invalid image dimensions. Unable to read image.');
  }

  // Calculate aspect-ratio preserving letterbox scale and padding
  const scale = Math.min(targetSize / origW, targetSize / origH);
  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);
  const padX = Math.floor((targetSize - newW) / 2);
  const padY = Math.floor((targetSize - newH) / 2);

  // Offscreen canvas for letterboxing
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Fill canvas with standard YOLO letterbox padding color (RGB 114, 114, 114)
  ctx.fillStyle = '#727272';
  ctx.fillRect(0, 0, targetSize, targetSize);

  // Draw image scaled in the center
  ctx.drawImage(img, 0, 0, origW, origH, padX, padY, newW, newH);

  // Extract RGBA pixel data
  const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
  const { data } = imageData; // [R, G, B, A, R, G, B, A, ...]

  const totalPixels = targetSize * targetSize;
  const float32Data = new Float32Array(3 * totalPixels);

  // Convert HWC (RGBA) to CHW (RGB) planar format normalized to [0.0, 1.0]
  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    float32Data[i] = r;                          // Channel 0: Red
    float32Data[totalPixels + i] = g;            // Channel 1: Green
    float32Data[totalPixels * 2 + i] = b;        // Channel 2: Blue
  }

  // Create ONNX Tensor
  const tensor = new ort.Tensor('float32', float32Data, [1, 3, targetSize, targetSize]);

  // Coordinate transformation metadata for inverse mapping
  const metadata = {
    origW,
    origH,
    targetSize,
    scale,
    padX,
    padY,
    newW,
    newH
  };

  return { tensor, metadata, sourceImg: img };
}

/**
 * Loads an image from various input types safely
 */
export function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    if (!source) {
      return reject(new Error('Please upload a road image first.'));
    }

    if (source instanceof HTMLCanvasElement && source.width > 0 && source.height > 0) {
      return resolve(source);
    }

    if (source instanceof HTMLVideoElement && source.videoWidth > 0 && source.videoHeight > 0) {
      return resolve(source);
    }

    if (source instanceof HTMLImageElement && source.complete && (source.naturalWidth > 0 || source.width > 0)) {
      return resolve(source);
    }

    const img = new Image();

    // Only set crossOrigin for remote HTTP/HTTPS URLs (never for blob: or data: URLs to prevent CORS errors)
    if (typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(new Error('Invalid image dimensions. Please select a valid JPG, PNG, or WebP image.'));
      } else {
        resolve(img);
      }
    };

    img.onerror = () => {
      reject(new Error('Invalid image. Please select a JPG, PNG or WEBP image.'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof File || source instanceof Blob) {
      img.src = URL.createObjectURL(source);
    } else {
      reject(new Error('Invalid image. Please select a JPG, PNG or WEBP image.'));
    }
  });
}
