/**
 * detection.js — YOLOv11-seg ONNX inference for S-Aging
 *
 * Handles: preprocessing → inference → NMS post-processing
 * Model:   best.onnx (served from /public/best.onnx)
 * Classes: defined below — must match your training label order
 */

import * as ort from 'onnxruntime-web';

// ── CONFIGURATION ─────────────────────────────────────────────────────────────

// Set to 1 to avoid SharedArrayBuffer / COOP-COEP requirement in older browsers
ort.env.wasm.numThreads = 1;

// Class names in training order (alphabetical — matches ultralytics default)
export const CLASS_NAMES = ['Black_Sigatoka', 'Fusarium_Wilt', 'Healthy'];

// Map ONNX class name → internal disease key used by the simulation
export const CLASS_TO_DISEASE = {
  Black_Sigatoka: 'black_sigatoka',
  Fusarium_Wilt: 'fusarium_wilt',
  Healthy: 'healthy',
};

const MODEL_URL = '/best.onnx';
const INPUT_SIZE = 640;
const CONF_THRESH = 0.27;
const IOU_THRESH = 0.45;

// ── SESSION (singleton) ───────────────────────────────────────────────────────

let _sessionPromise = null;

function getSession() {
  if (!_sessionPromise) {
    _sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    }).catch((err) => {
      _sessionPromise = null; // allow retry on failure
      throw err;
    });
  }
  return _sessionPromise;
}

// ── PREPROCESSING ─────────────────────────────────────────────────────────────

/**
 * Letterbox-resize an image to INPUT_SIZE × INPUT_SIZE and return a
 * CHW float32 tensor normalized to [0, 1].
 */
function preprocessImage(imgEl) {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d');

  const srcW = imgEl.naturalWidth || imgEl.width;
  const srcH = imgEl.naturalHeight || imgEl.height;
  const scale = Math.min(INPUT_SIZE / srcW, INPUT_SIZE / srcH);
  const dstW = Math.round(srcW * scale);
  const dstH = Math.round(srcH * scale);
  const padX = Math.round((INPUT_SIZE - dstW) / 2);
  const padY = Math.round((INPUT_SIZE - dstH) / 2);

  // Gray letterbox padding (matches YOLOv11 default)
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(imgEl, padX, padY, dstW, dstH);

  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const N = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) {
    tensor[i] = data[i * 4] / 255.0; // R
    tensor[N + i] = data[i * 4 + 1] / 255.0; // G
    tensor[2 * N + i] = data[i * 4 + 2] / 255.0; // B
  }

  return { tensor, scale, padX, padY, srcW, srcH };
}

// ── POST-PROCESSING ───────────────────────────────────────────────────────────

function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1), y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2), y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const aArea = (a.x2 - a.x1) * (a.y2 - a.y1);
  const bArea = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (aArea + bArea - inter + 1e-6);
}

function nms(boxes, iouThresh) {
  boxes.sort((a, b) => b.score - a.score);
  const keep = [];
  const used = new Uint8Array(boxes.length);
  for (let i = 0; i < boxes.length; i++) {
    if (used[i]) continue;
    keep.push(boxes[i]);
    for (let j = i + 1; j < boxes.length; j++) {
      if (!used[j] && iou(boxes[i], boxes[j]) > iouThresh) used[j] = 1;
    }
  }
  return keep;
}

/**
 * Parse the raw output0 tensor from YOLOv11-seg ONNX.
 *
 * Ultralytics export format: [1, 4 + nc + nm, num_anchors]
 *   – dim[1] is features (4 bbox + nc classes + nm mask coeffs)
 *   – dim[2] is num_anchors (8400 for 640×640)
 *
 * Some exports are transposed: [1, num_anchors, 4 + nc + nm]
 * We auto-detect by checking which dimension is larger.
 *
 * @param {number} numMaskCoeffs  – auto-detected from proto output (0 if detect-only)
 */
function parseDetections(output0, numMaskCoeffs, scale, padX, padY, srcW, srcH) {
  const dims = output0.dims;
  const data = output0.data;

  // Support both 2D [feats, anchors] and 3D [1, feats, anchors] shapes
  const d1 = dims.length === 3 ? dims[1] : dims[0];
  const d2 = dims.length === 3 ? dims[2] : dims[1];

  // Heuristic: the larger dimension is num_anchors
  const transposed = d1 > d2; // [1, anchors, feats]
  const numAnchors = transposed ? d1 : d2;
  const numFeats = transposed ? d2 : d1;
  const nc = numFeats - 4 - numMaskCoeffs; // number of classes

  console.log(`[S-Aging Detection] Output dims: [${dims}]`);
  console.log(`[S-Aging Detection] transposed=${transposed}, anchors=${numAnchors}, feats=${numFeats}, maskCoeffs=${numMaskCoeffs}, nc=${nc}`);
  console.log(`[S-Aging Detection] Expected nc=3 (Black_Sigatoka, Fusarium_Wilt, Healthy)`);

  if (nc <= 0 || nc > 100) {
    console.error(`[S-Aging Detection] Invalid nc=${nc}! Model output shape might not match expected format.`);
    console.error(`[S-Aging Detection] Try exporting with: model.export(format="onnx", imgsz=640, simplify=True)`);
    return [];
  }

  if (nc !== CLASS_NAMES.length) {
    console.warn(`[S-Aging Detection] WARNING: Model has nc=${nc} classes but CLASS_NAMES has ${CLASS_NAMES.length}!`);
    console.warn(`[S-Aging Detection] Class order might be wrong. Check your data.yaml class order.`);
  }

  const boxes = [];

  // Track top-5 raw scores for debugging
  let debugTop = [];

  for (let i = 0; i < numAnchors; i++) {
    const get = (feat) =>
      transposed ? data[i * numFeats + feat] : data[feat * numAnchors + i];

    // Class with highest score
    let maxScore = 0, maxClass = 0;
    const classScores = [];
    for (let c = 0; c < nc; c++) {
      const s = get(4 + c);
      classScores.push(s);
      if (s > maxScore) { maxScore = s; maxClass = c; }
    }

    // Collect debug info for top detections
    if (debugTop.length < 5 || maxScore > debugTop[debugTop.length - 1].score) {
      debugTop.push({ score: maxScore, classId: maxClass, classScores: [...classScores] });
      debugTop.sort((a, b) => b.score - a.score);
      if (debugTop.length > 5) debugTop.length = 5;
    }

    if (maxScore < CONF_THRESH) continue;

    // Decode centre-format bbox, un-letterbox to original image coords
    const cx = get(0), cy = get(1), w = get(2), h = get(3);
    const x1 = Math.max(0, (cx - w / 2 - padX) / scale);
    const y1 = Math.max(0, (cy - h / 2 - padY) / scale);
    const x2 = Math.min(srcW, (cx + w / 2 - padX) / scale);
    const y2 = Math.min(srcH, (cy + h / 2 - padY) / scale);

    // Extract mask coefficients for segmentation
    let maskCoeffs = null;
    if (numMaskCoeffs > 0) {
      maskCoeffs = new Float32Array(numMaskCoeffs);
      for (let m = 0; m < numMaskCoeffs; m++) {
        maskCoeffs[m] = get(4 + nc + m);
      }
    }

    boxes.push({ x1, y1, x2, y2, score: maxScore, classId: maxClass, classScores, maskCoeffs });
  }

  // Log debug info
  console.log(`[S-Aging Detection] Top-5 raw detections (before NMS):`);
  debugTop.forEach((d, i) => {
    const scores = d.classScores.map((s, ci) =>
      `${CLASS_NAMES[ci] || `class_${ci}`}=${s.toFixed(4)}`
    ).join(', ');
    console.log(`  #${i + 1}: classId=${d.classId} (${CLASS_NAMES[d.classId] || '?'}), score=${d.score.toFixed(4)}, all=[${scores}]`);
  });
  console.log(`[S-Aging Detection] ${boxes.length} detections above conf=${CONF_THRESH}`);

  return nms(boxes, IOU_THRESH);
}

// ── MASK DECODING ─────────────────────────────────────────────────────────────

/**
 * Decode YOLOv11-seg masks → 160×100 SCA grid.
 *
 * Steps:
 *   1. Matrix-multiply each detection's 32 mask coefficients with the 160×160
 *      prototype tensor to produce a per-instance mask.
 *   2. Sigmoid + threshold within the detection bbox.
 *   3. Combine all disease masks into a single 160×160 confidence map.
 *   4. Remove letterbox padding, resample to the 160×100 SCA lattice.
 *   5. Classify each masked pixel via HSV: necrotic (2), infected (1), or healthy (0).
 *      If YOLO confirmed disease but HSV reads green, defaults to infected (1).
 *
 * @returns {Array<number>|null}  Flat array [16000] of 0/1/2, or null.
 */

// Shared HSV pixel classifier used by both YOLO mask decoding and colorSegMask.
// Returns 2 (necrotic), 1 (infected), or 0 (healthy/background).
function classifyHSV(R, G, B) {
  const brightness = (R + G + B) / 3;
  if (brightness < 25 || brightness > 235) return 0;
  const rn = R / 255, gn = G / 255, bn = B / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta > 0.01) {
    if (max === rn)      h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else                 h = 60 * ((rn - gn) / delta + 4);
    if (h < 0) h += 360;
  }
  const s = max > 0 ? delta / max : 0;
  const v = max;
  const isGreen  = h >= 70 && h <= 160 && s > 0.15;
  const isYellow = h >= 35 && h < 75  && s > 0.25 && v > 0.35 && !isGreen;
  const isBrown  = h >= 10 && h < 45  && s > 0.20 && v < 0.65;
  const isDark   = v < 0.25 && s > 0.05;
  if (isDark || isBrown) return 2;
  if (isYellow) return 1;
  return 0;
}

function decodeMaskGrid(detections, _protoOutput, imgEl, scale, padX, padY, srcW, srcH) {
  const SCA_COLS = 160;
  const SCA_ROWS = 100;

  const diseaseDetections = detections.filter(d => d.classId !== 2);

  if (diseaseDetections.length === 0) {
    console.log('[S-Aging Mask] No disease detections');
    return null;
  }

  console.log(`[S-Aging Mask] HSV-classifying within ${diseaseDetections.length} disease bbox(es)`);

  const isPortrait = srcH > srcW;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = srcW;
  colorCanvas.height = srcH;
  const colorCtx = colorCanvas.getContext('2d');
  colorCtx.drawImage(imgEl, 0, 0, srcW, srcH);
  const colorData = colorCtx.getImageData(0, 0, srcW, srcH).data;

  const maskGrid = new Array(SCA_ROWS * SCA_COLS).fill(0);
  let infCount = 0, necCount = 0;

  for (let r = 0; r < SCA_ROWS; r++) {
    for (let c = 0; c < SCA_COLS; c++) {
      let imgX, imgY;
      if (isPortrait) {
        imgX = Math.round((r / SCA_ROWS) * srcW);
        imgY = Math.round((1 - c / SCA_COLS) * srcH);
      } else {
        imgX = Math.round((c / SCA_COLS) * srcW);
        imgY = Math.round((r / SCA_ROWS) * srcH);
      }

      const inBox = diseaseDetections.some(
        d => imgX >= d.x1 && imgX <= d.x2 && imgY >= d.y1 && imgY <= d.y2
      );
      if (!inBox) continue;

      const pixIdx = (Math.min(srcH - 1, imgY) * srcW + Math.min(srcW - 1, imgX)) * 4;
      const R = colorData[pixIdx], G = colorData[pixIdx + 1], B = colorData[pixIdx + 2];
      const state = classifyHSV(R, G, B);
      if (state > 0) {
        maskGrid[r * SCA_COLS + c] = state;
        if (state === 2) necCount++; else infCount++;
      }
    }
  }

  console.log(`[S-Aging Mask] Grid: ${infCount} infected, ${necCount} necrotic, ${SCA_ROWS * SCA_COLS - infCount - necCount} healthy`);
  return maskGrid;
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * Run YOLOv11-seg inference on an <img> element (must be fully loaded).
 *
 * Returns an array of detections:
 *   { classId, className, diseaseKey, score, x1, y1, x2, y2 }
 *
 * Returns [] if no detections pass the confidence threshold.
 * Throws on model load / inference error.
 */
export async function detectDisease(imgEl) {
  const session = await getSession();

  console.log(`[S-Aging Detection] Model inputs: [${session.inputNames}]`);
  console.log(`[S-Aging Detection] Model outputs: [${session.outputNames}]`);

  const { tensor, scale, padX, padY, srcW, srcH } = preprocessImage(imgEl);

  // Use the session's actual input name
  const inputName = session.inputNames[0];
  const inputTensor = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);

  const results = await session.run({ [inputName]: inputTensor });

  // Log all output shapes for debugging
  for (const name of session.outputNames) {
    console.log(`[S-Aging Detection] Output "${name}" shape: [${results[name].dims}]`);
  }

  // Auto-detect mask coefficients from proto output (output1)
  // Seg models have 2+ outputs: output0 (detections) + output1 (mask protos)
  // Proto shape is [1, num_mask_coeffs, mask_h, mask_w]
  const isSeg = session.outputNames.length >= 2;
  let numMaskCoeffs = 0;
  if (isSeg) {
    const protoOutput = results[session.outputNames[1]];
    if (protoOutput && protoOutput.dims.length >= 2) {
      numMaskCoeffs = protoOutput.dims[1];
      console.log(`[S-Aging Detection] Auto-detected mask coefficients: ${numMaskCoeffs} (from proto output)`);
    } else {
      // Fallback: try common values
      numMaskCoeffs = 32;
      console.warn(`[S-Aging Detection] Could not detect mask coeffs from proto, using default: ${numMaskCoeffs}`);
    }
  }

  const output0 = results[session.outputNames[0]];
  const raw = parseDetections(output0, numMaskCoeffs, scale, padX, padY, srcW, srcH);

  console.log(`[S-Aging Detection] Final results after NMS: ${raw.length} detections`);

  // Decode segmentation masks → 160×100 SCA grid
  let maskGrid = null;
  if (isSeg && raw.length > 0) {
    const protoOutput = results[session.outputNames[1]];
    maskGrid = decodeMaskGrid(raw, protoOutput, imgEl, scale, padX, padY, srcW, srcH);
  }

  const detections = raw.map((d) => {
    const className = CLASS_NAMES[d.classId] ?? `class_${d.classId}`;
    const mapped = {
      ...d,
      className,
      diseaseKey: CLASS_TO_DISEASE[className] ?? 'unknown',
    };
    delete mapped.maskCoeffs;  // no need to send raw coefficients downstream
    console.log(`[S-Aging Detection]   → ${className} (${mapped.diseaseKey}): ${d.score.toFixed(4)}`);
    return mapped;
  });

  return { detections, maskGrid };
}

/**
 * Color-segmentation mask — no model required.
 *
 * Samples the uploaded image at each 160×100 SCA cell and classifies pixels
 * by hue/saturation to find disease regions:
 *   2 = necrotic  (dark brown / very dark)
 *   1 = infected  (yellow / yellowish, typical early-stage lesion)
 *   0 = healthy / background (green or unclassified)
 *
 * Returns the same flat 160×100 array format as detectDisease().maskGrid.
 */
export function colorSegMask(imgEl) {
  const SCA_ROWS = 100, SCA_COLS = 160;
  const W = imgEl.naturalWidth, H = imgEl.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgEl, 0, 0);
  const { data } = ctx.getImageData(0, 0, W, H);

  const cellW = W / SCA_COLS, cellH = H / SCA_ROWS;
  const mask = new Array(SCA_ROWS * SCA_COLS).fill(0);

  for (let r = 0; r < SCA_ROWS; r++) {
    for (let c = 0; c < SCA_COLS; c++) {
      // 2×2 sub-sample per cell for robustness
      let sumR = 0, sumG = 0, sumB = 0;
      for (let dy = 0.25; dy < 1; dy += 0.5) {
        for (let dx = 0.25; dx < 1; dx += 0.5) {
          const px = Math.min(W - 1, Math.round((c + dx) * cellW));
          const py = Math.min(H - 1, Math.round((r + dy) * cellH));
          const i = (py * W + px) * 4;
          sumR += data[i]; sumG += data[i + 1]; sumB += data[i + 2];
        }
      }
      const R = sumR / 4, G = sumG / 4, B = sumB / 4;
      const state = classifyHSV(R, G, B);
      if (state > 0) mask[r * SCA_COLS + c] = state;
    }
  }
  return mask;
}

/**
 * Merges a YOLO-decoded maskGrid with a colorSegMask on the same image.
 * Each cell takes the higher severity state (Math.max), so Color Seg fills
 * spots YOLO missed and YOLO anchors regions Color Seg would misclassify.
 *
 * @param {Array<number>} yoloMask  Flat 160×100 array from decodeMaskGrid (or zeros if null)
 * @param {HTMLImageElement} imgEl  The uploaded image element
 * @returns {Array<number>}  Merged flat 160×100 array of 0/1/2
 */
export function combinedMask(yoloMask, imgEl) {
  if (yoloMask) return yoloMask;
  return colorSegMask(imgEl);
}

/**
 * Warm up the ONNX session in the background (call on app mount).
 * Silently fails if the model is unavailable.
 */
export function warmupSession() {
  getSession().catch(() => { });
}
