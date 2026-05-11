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
const CONF_THRESH = 0.25;
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
 *   5. Classify each masked pixel by sampling the original image brightness:
 *      dark (brown/black) → necrotic (2), lighter (yellow/brown) → infected (1).
 *
 * @returns {Array<number>|null}  Flat array [16000] of 0/1/2, or null.
 */
function decodeMaskGrid(detections, protoOutput, imgEl, scale, padX, padY, srcW, srcH) {
  const SCA_COLS = 160;
  const SCA_ROWS = 100;

  // Proto output shape: [1, nm, pH, pW] — typically [1, 32, 160, 160]
  const protoData = protoOutput.data;
  const nm = protoOutput.dims[1];
  const pH = protoOutput.dims[2];
  const pW = protoOutput.dims[3];
  const protoPixels = pH * pW;

  // classId 2 = Healthy — only decode disease classes
  const diseaseDetections = detections.filter(
    d => d.maskCoeffs && d.classId !== 2
  );

  if (diseaseDetections.length === 0) {
    console.log('[S-Aging Mask] No disease detections with mask coefficients');
    return null;
  }

  console.log(`[S-Aging Mask] Decoding masks for ${diseaseDetections.length} disease detection(s)`);

  // Combined confidence map at proto resolution
  const combinedMask = new Float32Array(protoPixels);
  const protoScale = pW / INPUT_SIZE; // 160/640 = 0.25

  for (const det of diseaseDetections) {
    // coeffs[nm] @ protos[nm, protoPixels] → rawMask[protoPixels]
    const rawMask = new Float32Array(protoPixels);
    for (let j = 0; j < protoPixels; j++) {
      let sum = 0;
      for (let m = 0; m < nm; m++) {
        sum += det.maskCoeffs[m] * protoData[m * protoPixels + j];
      }
      rawMask[j] = sum;
    }

    // Bbox in proto space (original image → letterboxed 640 → proto 160)
    const bx1 = Math.max(0, Math.floor((det.x1 * scale + padX) * protoScale));
    const by1 = Math.max(0, Math.floor((det.y1 * scale + padY) * protoScale));
    const bx2 = Math.min(pW - 1, Math.ceil((det.x2 * scale + padX) * protoScale));
    const by2 = Math.min(pH - 1, Math.ceil((det.y2 * scale + padY) * protoScale));

    // Sigmoid + threshold within bbox → merge into combined mask
    for (let y = by1; y <= by2; y++) {
      for (let x = bx1; x <= bx2; x++) {
        const idx = y * pW + x;
        const sig = 1.0 / (1.0 + Math.exp(-rawMask[idx]));
        if (sig > 0.5) {
          combinedMask[idx] = Math.max(combinedMask[idx], sig);
        }
      }
    }
  }

  // Un-letterboxed region in proto space
  const protoPadX = Math.round(padX * protoScale);
  const protoPadY = Math.round(padY * protoScale);
  const protoContentW = Math.max(1, Math.round(srcW * scale * protoScale));
  const protoContentH = Math.max(1, Math.round(srcH * scale * protoScale));

  // Portrait photos (srcH > srcW) have the leaf's long axis running vertically.
  // The SCA grid is landscape (COLS=160 = leaf length, ROWS=100 = leaf width).
  // We rotate the coordinate sampling 90° for portrait so the leaf length direction
  // in the photo (vertical) maps to SCA columns and width (horizontal) maps to rows.
  const isPortrait = srcH > srcW;

  // Draw original image at SCA resolution for colour classification.
  // For portrait photos, rotate 90° CW so the long axis fills the 160-wide canvas.
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = SCA_COLS;
  colorCanvas.height = SCA_ROWS;
  const colorCtx = colorCanvas.getContext('2d');
  if (isPortrait) {
    colorCtx.save();
    colorCtx.translate(SCA_COLS, 0);
    colorCtx.rotate(Math.PI / 2);
    colorCtx.drawImage(imgEl, 0, 0, SCA_ROWS, SCA_COLS);
    colorCtx.restore();
  } else {
    colorCtx.drawImage(imgEl, 0, 0, SCA_COLS, SCA_ROWS);
  }
  const colorData = colorCtx.getImageData(0, 0, SCA_COLS, SCA_ROWS).data;

  // Resample combined proto mask → SCA grid, classify by brightness.
  // Portrait: c (leaf length) ← photo y; r (leaf width) ← photo x (rotated 90° CW).
  const maskGrid = new Array(SCA_ROWS * SCA_COLS).fill(0);
  let infCount = 0, necCount = 0;

  for (let r = 0; r < SCA_ROWS; r++) {
    for (let c = 0; c < SCA_COLS; c++) {
      let px, py;
      if (isPortrait) {
        // 90° CW rotation: leaf tip at portrait-top maps to SCA col 159 (leaf tip).
        // r (leaf width) ← photo-x: px = r/SCA_ROWS * contentW
        // c (leaf length) ← photo-y inverted: py = (1 - c/SCA_COLS) * contentH
        px = Math.round(protoPadX + (r / SCA_ROWS) * protoContentW);
        py = Math.round(protoPadY + (1 - c / SCA_COLS) * protoContentH);
      } else {
        px = Math.round(protoPadX + (c / SCA_COLS) * protoContentW);
        py = Math.round(protoPadY + (r / SCA_ROWS) * protoContentH);
      }

      if (px >= 0 && px < pW && py >= 0 && py < pH && combinedMask[py * pW + px] > 0) {
        const pixIdx = (r * SCA_COLS + c) * 4;
        const R = colorData[pixIdx];
        const G = colorData[pixIdx + 1];
        const B = colorData[pixIdx + 2];
        const brightness = (R + G + B) / 3;

        // Dark brown/black → necrotic (2);  yellow/brown → infected (1)
        if (brightness < 80) {
          maskGrid[r * SCA_COLS + c] = 2;
          necCount++;
        } else {
          maskGrid[r * SCA_COLS + c] = 1;
          infCount++;
        }
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
 * Warm up the ONNX session in the background (call on app mount).
 * Silently fails if the model is unavailable.
 */
export function warmupSession() {
  getSession().catch(() => { });
}
