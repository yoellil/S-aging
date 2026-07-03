// ─────────────────────────────────────────────────────────────────────────────
// S-Aging Report Generator
// ─────────────────────────────────────────────────────────────────────────────

const _ROWS = 100, _COLS = 160, _CELL = 5; // 5px per cell → 800×500 canvas

function _b64decode(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Elliptical leaf mask (matches Python simulation / JS _LEAF_MASK)
function _inLeaf(r, c) {
  const u = -1 + (2 * c) / (_COLS - 1);
  const v = -1 + (2 * r) / (_ROWS - 1);
  return u * u + v * v <= 1.0;
}

function _resolve(grid) {
  return typeof grid === "string" ? _b64decode(grid) : grid;
}

// State → fill color (matches dice.py reference exactly)
const STATE_COLOR  = ["#368626", "#e8da16", "#783c14"]; // healthy / infected / necrotic
const AGREE_COLOR  = ["#368626", "#e8da16", "#783c14"]; // same: agree = class color
const DISAGREE_CLR = "#dc3232";
const BG_CLR       = "#0f0f0f";

// ── Diagnostic tips (mirrored from ExplainabilityDashboard.jsx) ───────────────
const _EARLY_TIPS = [
  { title: "Clean Your Tools", body: "Early signs of disease have been detected. Before moving to the next plant, wipe all cutting tools with rubbing alcohol (isopropyl alcohol, 70%) or a bleach-and-water mix (1 part bleach to 9 parts water). This stops the disease from hitching a ride to healthy plants." },
  { title: "Apply a Protective Spray", body: "Coat healthy plant parts — especially new leaves and the base of the main stem (pseudostem) — with a protective fungicide such as copper spray or mancozeb. Think of it as sunscreen for the plant: it sits on the surface and blocks disease spores from getting in." },
  { title: "Monitor Weather Conditions", body: "Record the daily temperature and air humidity. Disease spreads much faster when humidity stays above 70% (for Black Sigatoka) or above 75% (for Fusarium Wilt TR4). Use these readings as your signal to spray or take action before the disease gets worse." },
];

const _SCENARIOS = {
  "single-fusarium": {
    label: "Single Plant · Fusarium Wilt TR4 — Active Eradication",
    severity: "critical",
    steps: [
      { title: "Kill the Plant at the Source", body: "Inject 10 mL of weed killer (glyphosate) directly into the main stem (pseudostem) about 30 cm from the ground. This shuts down the plant's internal water and food channels and stops the underground base (corm) from releasing more disease spores. Mark the spot and do not replant for at least 6 months." },
      { title: "Destroy the Plant Where It Stands", body: "Once the weed killer has taken effect (wait 48–72 hours), chop the plant down on the spot and cover all the pieces with a thick layer of quicklime (about 15 cm). Do not carry plant parts to another area — digging up the underground base (corm) can scatter long-lasting disease spores (chlamydospores) into clean soil nearby." },
      { title: "Disinfect Tools and Footwear", body: "Soak all cutting tools in bleach solution (1 part bleach to 19 parts water) for 30 minutes. Scrub boots with soap, then step through a disinfectant footbath (10% bleach) before leaving the area. Note the exact location on a map and report to the farm manager right away." },
    ],
  },
  "single-sigatoka": {
    label: "Single Plant · Black Sigatoka — Sanitation Protocol",
    severity: "warning",
    steps: [
      { title: "Remove Infected Leaves", body: "Find and cut off all leaves with Stage 3 or worse damage — look for dark brown streaks that have merged into large dead (necrotic) patches. Cut at the leaf stalk base (petiole), as close to the main stem (pseudostem) as possible. Always use a clean blade and avoid cutting through the middle of the leaf." },
      { title: "Lay Cut Leaves Face-Down", body: "Place the removed leaves upside-down (spore side facing the soil) directly below the plant. This stops disease spores from being picked up by the wind and landing on healthy leaves. Spread them flat — do not stack or pile them up." },
      { title: "Spray Remaining Healthy Leaves", body: "Apply a deep-acting fungicide (systemic triazole) — such as propiconazole or tebuconazole — to the still-healthy leaves as a leaf spray (foliar spray), mixed at 2 mL per liter of water. On your next spray cycle, switch to a different fungicide type (e.g., strobilurins) so the disease does not become resistant to one product." },
    ],
  },
  "plantation-sigatoka": {
    label: "Plantation · Black Sigatoka — Integrated Field Strategy",
    severity: "warning",
    steps: [
      { title: "Thin Out Shoots and Leaves", body: "Cut off all young side shoots (suckers) that are shorter than 1 meter to open up the space between plants and let air flow through. Keep no more than 3 healthy leaves per plant at a time. Leaf-removal teams should always move in one direction across the rows so they do not carry disease spores back into areas they already cleaned." },
      { title: "Rotate Your Fungicide Sprays", body: "Follow a 4-spray schedule, always switching between different fungicide types to slow down resistance (following FRAC resistance guidelines): rotate deep-acting fungicide group 3 (DMI), group 11 (strobilurins), and group 7 (SDHI) in turn. Spray in the early morning when wind is calm, and wait at least 21 days between each round of deep-acting sprays." },
      { title: "Feed the Plants to Boost Resistance", body: "Mix potassium sulfate (K₂SO₄) at 3 kg per hectare into your regular fungicide spray. Banana plants with high potassium levels are naturally tougher against Black Sigatoka. Also add calcium and boron to your fertilizer routine to help strengthen the outer walls of plant cells." },
    ],
  },
  "plantation-fusarium": {
    label: "Plantation · Fusarium Wilt TR4 — Containment &amp; Replanting",
    severity: "critical",
    steps: [
      { title: "Seal Off the Infected Area", body: "As soon as disease is confirmed, dig a trench around the outbreak area (10 meters out from the sick plants, 50 cm deep, 30 cm wide) and fill it with quicklime. Put up clear warning signs around the zone. Set up one entry-and-exit cleaning station where all workers and equipment must be disinfected with a bleach footbath before passing through." },
      { title: "Treat Nearby Plants with Protective Microbes", body: "Water the root zone (rhizosphere) of nearby healthy plants with a solution of a beneficial soil fungus called Trichoderma harzianum — apply about 5 liters per plant. This helpful fungus naturally competes with and blocks the Fusarium disease fungus (Foc TR4) in the soil. Repeat this treatment once a month for 3 months." },
      { title: "Replant with Disease-Resistant Varieties", body: "Let the soil rest for at least 12 months before replanting. When you do replant, choose only banana varieties that can resist TR4, such as GCTCV-219, Goldfinger, or wild-cross hybrids (Musa balbisiana). Keep clear records of which areas were replanted so they can be watched closely over time." },
    ],
  },
};

// ── HSV classifier for real leaf photos ───────────────────────────────────────
// Tuned for actual camera images, NOT the SCA grid palette colors.
// Returns: -1=background, 0=healthy, 1=infected, 2=necrotic
//
// Key differences from dice.py (which targets SCA grid colors):
//   • Green extended to h 60–185 to catch blue-green/teal banana leaf tissue
//   • Lower green saturation floor (0.10) for muted/weathered leaf surfaces
//   • Purple range added (h ≥ 240) for Black Sigatoka's violet-black lesions
//   • Brown range widened (h 5–50, v < 0.75) for Fusarium necrotic tissue
//   • Classification is priority-ordered: necrotic → infected → healthy → background
function _classifyHSVPhoto(R, G, B) {
  const brightness = (R + G + B) / 3;
  if (brightness < 8 || brightness > 242) return -1;
  const rn = R / 255, gn = G / 255, bn = B / 255;
  const mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn);
  const delta = mx - mn;
  const s = mx > 0 ? delta / mx : 0;
  const v = mx;
  let h = 0;
  if (delta > 0.01) {
    if      (mx === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (mx === gn) h = 60 * ((bn - rn) / delta + 2);
    else                h = 60 * ((rn - gn) / delta + 4);
    if (h < 0) h += 360;
  }

  // Dark lesion cores — check BEFORE saturation gate so low-chroma dark tissue
  // isn't discarded as background before it can be classified as necrotic.
  if (v < 0.28 && s > 0.03) return 2;

  // Truly achromatic (pure white glare / neutral shadow) → background
  if (s < 0.04) return -1;

  // Warm/brown/tan/ashen necrotic — two sub-thresholds:
  //   1. Clear brown/tan: higher saturation, any dark-to-moderate brightness
  //   2. Pale ashen: very low saturation (s 0.04–0.06) warm-gray oval lesion centers,
  //      capped at v < 0.85 to exclude bright white highlights on the leaf surface
  if ((h >= 5 && h < 50) || h > 340) {
    if (s > 0.06 && v < 0.88) return 2;
    if (s > 0.04 && v > 0.30 && v < 0.85) return 2;
  }

  // Purple / violet necrotic — Black Sigatoka dark violet lesions
  if (h >= 240 && h <= 340 && s > 0.08 && v < 0.80) return 2;

  // Yellow infected halos (bright, saturated yellow — s raised to 0.15 to keep
  // dull brownish-yellow from escaping the warm-necrotic check above)
  if (h >= 22 && h < 75 && s > 0.15 && v > 0.22) return 1;

  // Green healthy — wide hue range for blue-green banana leaf tissue
  if (h >= 65 && h <= 185 && s > 0.10 && v > 0.12) return 0;

  return -1;
}

// Classify the uploaded photo at SCA grid resolution (160×100) using dice.py HSV.
// Returns Int8Array[16000] with -1=background, 0/1/2=class.
// Portrait images are CW-rotated so their long axis maps to grid columns.
async function _computePhotoMask(imgDataURL) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const srcW = img.naturalWidth, srcH = img.naturalHeight;
      const isPortrait = srcH > srcW;
      const canvas = document.createElement("canvas");
      let sW, sH;
      if (isPortrait) {
        sW = srcH; sH = srcW;
        canvas.width = sW; canvas.height = sH;
        const rctx = canvas.getContext("2d");
        rctx.translate(srcH, 0);
        rctx.rotate(Math.PI / 2);
        rctx.drawImage(img, 0, 0, srcW, srcH);
      } else {
        sW = srcW; sH = srcH;
        canvas.width = sW; canvas.height = sH;
        canvas.getContext("2d").drawImage(img, 0, 0);
      }
      const data = canvas.getContext("2d").getImageData(0, 0, sW, sH).data;
      const cellW = sW / _COLS, cellH = sH / _ROWS;
      const mask = new Int8Array(_ROWS * _COLS).fill(-1);
      for (let r = 0; r < _ROWS; r++) {
        for (let c = 0; c < _COLS; c++) {
          if (!_inLeaf(r, c)) continue;
          // 2×2 sub-sample per cell (matches colorSegMask in detection.js)
          let sumR = 0, sumG = 0, sumB = 0;
          for (let dy = 0.25; dy < 1; dy += 0.5) {
            for (let dx = 0.25; dx < 1; dx += 0.5) {
              const px = Math.min(sW - 1, Math.round((c + dx) * cellW));
              const py = Math.min(sH - 1, Math.round((r + dy) * cellH));
              const idx = (py * sW + px) * 4;
              sumR += data[idx]; sumG += data[idx + 1]; sumB += data[idx + 2];
            }
          }
          mask[r * _COLS + c] = _classifyHSVPhoto(sumR / 4, sumG / 4, sumB / 4);
        }
      }
      resolve(mask);
    };
    img.src = imgDataURL;
  });
}

// ── Per-class Dice ────────────────────────────────────────────────────────────
// maskA: Int8Array from _computePhotoMask (-1=bg, 0/1/2=class)
// gridDataB: SCA simulation frame gridData (0/1/2 only)
export function computePerClassDice(maskA, gridDataB) {
  if (!maskA || !gridDataB) return null;
  const b = _resolve(gridDataB);

  const inter = [0, 0, 0], sumA = [0, 0, 0], sumB = [0, 0, 0];
  for (let r = 0; r < _ROWS; r++) {
    for (let c = 0; c < _COLS; c++) {
      if (!_inLeaf(r, c)) continue;
      const i = r * _COLS + c;
      const a = maskA[i]; // -1 background pixels don't match any class → not counted
      const bv = b[i];
      for (let cls = 0; cls < 3; cls++) {
        const ia = a === cls ? 1 : 0, ib = bv === cls ? 1 : 0;
        inter[cls] += ia & ib; sumA[cls] += ia; sumB[cls] += ib;
      }
    }
  }
  const dice = inter.map((v, i) =>
    sumA[i] + sumB[i] === 0 ? 1 : (2 * v) / (sumA[i] + sumB[i])
  );
  return {
    healthy:  dice[0],
    infected: dice[1],
    necrotic: dice[2],
    mean: (dice[0] + dice[1] + dice[2]) / 3,
  };
}

// ── 2-D grid renderers ────────────────────────────────────────────────────────

// Render simulation grid: each cell colored by its state (0/1/2), elliptical mask
function _drawGrid(gridData, bg = "#ffffff") {
  const W = _COLS * _CELL, H = _ROWS * _CELL;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const grid = _resolve(gridData);
  for (let r = 0; r < _ROWS; r++) {
    for (let c = 0; c < _COLS; c++) {
      if (!_inLeaf(r, c)) continue;
      ctx.fillStyle = STATE_COLOR[grid[r * _COLS + c]] ?? STATE_COLOR[0];
      ctx.fillRect(c * _CELL, r * _CELL, _CELL, _CELL);
    }
  }
  return canvas;
}

export function drawSimulatedGrid(gridData) {
  return _drawGrid(gridData).toDataURL("image/png");
}

// Rotate a dataURL image 90° CCW — used when the source photo is portrait so the
// SCA grid (always landscape) can be displayed upright to match the photo panels.
function _rotateCCW(dataURL) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = H; canvas.height = W;
      const ctx = canvas.getContext("2d");
      ctx.translate(0, W);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = dataURL;
  });
}

// Render the full photo with per-pixel HSV classification coloring.
// Shows the same orientation as the original photo (no rotation, no oval).
// Pixels too dark/bright/desaturated to classify show as near-black.
async function _drawPhotoHSVImage(imgDataURL) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const srcW = img.naturalWidth, srcH = img.naturalHeight;
      // Cap at 900px on the long side so the report stays a reasonable size
      const scale = Math.min(1, 900 / Math.max(srcW, srcH));
      const dW = Math.round(srcW * scale);
      const dH = Math.round(srcH * scale);

      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = dW; srcCanvas.height = dH;
      srcCanvas.getContext("2d").drawImage(img, 0, 0, dW, dH);
      const src = srcCanvas.getContext("2d").getImageData(0, 0, dW, dH).data;

      const outCanvas = document.createElement("canvas");
      outCanvas.width = dW; outCanvas.height = dH;
      const outCtx = outCanvas.getContext("2d");
      const out = outCtx.createImageData(dW, dH);

      const COLORS = [
        [54, 134, 38],   // 0 healthy  → green  #368626
        [232, 218, 22],  // 1 infected → yellow #e8da16
        [120, 60, 20],   // 2 necrotic → brown  #783c14
      ];

      for (let i = 0; i < dW * dH; i++) {
        const s = i * 4;
        const cls = _classifyHSVPhoto(src[s], src[s + 1], src[s + 2]);
        const [r, g, b] = cls < 0 ? [15, 15, 15] : COLORS[cls];
        out.data[s] = r; out.data[s + 1] = g; out.data[s + 2] = b; out.data[s + 3] = 255;
      }

      outCtx.putImageData(out, 0, 0);
      resolve(outCanvas.toDataURL("image/png"));
    };
    img.src = imgDataURL;
  });
}

// Agreement map: class color = agree, red = disagree, near-black = background
// Matches dice.py: outside-ellipse cells stay background; inside cells
// that agree → class color, disagree → DISAGREE_CLR (both must be foreground).
export function drawAgreementMap(maskA, gridDataB) {
  const W = _COLS * _CELL, H = _ROWS * _CELL;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG_CLR;
  ctx.fillRect(0, 0, W, H);

  const b = _resolve(gridDataB);
  for (let r = 0; r < _ROWS; r++) {
    for (let c = 0; c < _COLS; c++) {
      if (!_inLeaf(r, c)) continue;
      const i = r * _COLS + c;
      const a = maskA[i]; // -1 = photo background
      if (a < 0) continue; // background pixel → stay as BG_CLR (dice.py: "one or both are background → dark")
      const bv = b[i];
      // Both foreground: agree → class color, disagree → red
      ctx.fillStyle = a === bv ? AGREE_COLOR[bv] : DISAGREE_CLR;
      ctx.fillRect(c * _CELL, r * _CELL, _CELL, _CELL);
    }
  }
  return canvas.toDataURL("image/png");
}

// ── Progression chart ─────────────────────────────────────────────────────────
export function drawProgressionChart(frames) {
  if (!frames || frames.length < 2) return null;
  const W = 780, H = 260;
  const PAD = { top: 16, right: 24, bottom: 48, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1;
  ctx.font = "11px 'Segoe UI',Arial,sans-serif";
  ctx.fillStyle = "#94a3b8"; ctx.textAlign = "right";
  for (let y = 0; y <= 4; y++) {
    const yp = PAD.top + plotH - (y / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(PAD.left, yp); ctx.lineTo(PAD.left + plotW, yp); ctx.stroke();
    ctx.fillText(`${y * 25}%`, PAD.left - 6, yp + 4);
  }

  const n = frames.length;
  ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center";
  const step = Math.max(1, Math.ceil(n / 7));
  for (let i = 0; i < n; i += step)
    ctx.fillText(`M${frames[i].month}`, PAD.left + (i / (n-1)) * plotW, PAD.top + plotH + 16);
  ctx.fillText(`M${frames[n-1].month}`, PAD.left + plotW, PAD.top + plotH + 16);

  ctx.fillStyle = "#64748b"; ctx.font = "12px 'Segoe UI',Arial,sans-serif";
  ctx.fillText("Month", PAD.left + plotW / 2, H - 8);

  const drawLine = (getV, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
    ctx.beginPath();
    frames.forEach((f, i) => {
      const x = PAD.left + (i / (n-1)) * plotW;
      const y = PAD.top + plotH - Math.min(100, Math.max(0, getV(f))) / 100 * plotH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  drawLine(f => f.stats.healthy_pct,  "#22c55e");
  drawLine(f => f.stats.infected_pct, "#d97706");
  drawLine(f => f.stats.necrotic_pct, "#ef4444");

  let lx = PAD.left + 10;
  const ly = PAD.top + plotH + 36;
  ctx.textAlign = "left"; ctx.font = "12px 'Segoe UI',Arial,sans-serif";
  [["#22c55e","Healthy"],["#d97706","Infected"],["#ef4444","Necrotic"]].forEach(([c,l]) => {
    ctx.fillStyle = c; ctx.fillRect(lx, ly - 7, 20, 3);
    ctx.fillStyle = "#374151"; ctx.fillText(l, lx + 26, ly);
    lx += 100;
  });

  return canvas.toDataURL("image/png");
}

// ── HTML report ───────────────────────────────────────────────────────────────
// Returns a Promise<string> — await it before passing to downloadReport.
export async function generateReportHTML({
  disease, temp, rh, density, months,
  frames, finalStats, envInfo,
  uploadedImage, maskGrid, frame0GridData,
  stageLabel, stageDesc, diseaseName,
  detections,
}) {
  // Restore full data URL if only the raw base64 was stored
  const uploadedImgSrc = uploadedImage
    ? (uploadedImage.startsWith("data:") ? uploadedImage : `data:image/png;base64,${uploadedImage}`)
    : null;

  // Classify the raw photo pixels with dice.py HSV (independent of YOLO maskGrid).
  // This gives honest Dice scores — photo HSV ≠ YOLO detection, so disagreement
  // between them reflects real classification differences rather than ~1.0 self-comparison.
  const photoMask = uploadedImgSrc ? await _computePhotoMask(uploadedImgSrc) : null;

  // Detect portrait so we can rotate the SCA grid panels to match photo orientation
  const isPortrait = uploadedImgSrc
    ? await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalHeight > i.naturalWidth); i.src = uploadedImgSrc; })
    : false;

  // Generate 2-D grid images; rotate sim + agreement 90° CCW when photo is portrait
  const photoHSVImg        = uploadedImgSrc ? await _drawPhotoHSVImage(uploadedImgSrc) : null;
  const simGridRaw         = frame0GridData ? drawSimulatedGrid(frame0GridData) : null;
  const agreementRaw       = (photoMask && frame0GridData) ? drawAgreementMap(photoMask, frame0GridData) : null;
  const simGridImg         = (isPortrait && simGridRaw)   ? await _rotateCCW(simGridRaw)   : simGridRaw;
  const agreementImg       = (isPortrait && agreementRaw) ? await _rotateCCW(agreementRaw) : agreementRaw;
  const perClass           = computePerClassDice(photoMask, frame0GridData);
  const chartB64           = drawProgressionChart(frames);

  const fmt = v => typeof v === "number" ? v.toFixed(3) : "N/A";
  const pct = v => typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "N/A";

  const densityLabel = { low: "Low", medium: "Medium", high: "High" }[density] ?? density;
  const isFW = disease === "fusarium_wilt";
  const generatedAt = new Date().toLocaleString();

  // Diagnostic tips — derive scenario from disease + density (high density → plantation)
  const _scenarioMode  = density === "high" ? "plantation" : "single";
  const _scenarioKey   = `${_scenarioMode}-${isFW ? "fusarium" : "sigatoka"}`;
  const _isEarlyOnset  = months <= 10;
  const _scenario      = _SCENARIOS[_scenarioKey];
  const _tipSeverity   = _isEarlyOnset ? "early" : _scenario.severity;
  const _tipBadgeText  = _isEarlyOnset ? `Early Onset — Monitoring · ${diseaseName}` : `${_scenario.label}`;
  const _tipSteps      = _isEarlyOnset ? _EARLY_TIPS : _scenario.steps;
  const _tipCardClass  = _isEarlyOnset ? "" : (_tipSeverity === "critical" ? " critical" : " warning");
  const tipsHTML = _tipSteps.map(step => `
    <div class="tip-card${_tipCardClass}">
      <div class="tip-title">${step.title}</div>
      <div class="tip-body">${step.body}</div>
    </div>`).join("");

  const tableRows = frames
    .filter((f, i) => i === 0 || i === frames.length - 1 || f.month % 5 === 0)
    .map(f => `<tr>
      <td>${f.month}</td>
      <td class="healthy">${f.stats.healthy_pct.toFixed(1)}%</td>
      <td class="infected">${f.stats.infected_pct.toFixed(1)}%</td>
      <td class="necrotic">${f.stats.necrotic_pct.toFixed(1)}%</td>
    </tr>`).join("\n");

  const envRow = (label, val, suffix = "") =>
    `<div class="env-card"><div class="env-label">${label}</div><div class="env-val">${
      typeof val === "number" ? val.toFixed(4) : (val ?? "—")
    }${suffix}</div></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>S-Aging Report — ${diseaseName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:14px;line-height:1.5}
.page{max-width:980px;margin:0 auto;padding:40px 32px}
h1{font-size:22px;font-weight:700;color:#0f172a}
h2{font-size:15px;font-weight:600;color:#334155;margin:32px 0 10px;padding-bottom:6px;border-bottom:1.5px solid #e2e8f0}
.badge{display:inline-block;padding:2px 12px;border-radius:99px;font-size:12px;font-weight:600}
.badge-bs{background:#fef3c7;color:#92400e}.badge-fw{background:#fce7f3;color:#9d174d}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
.header-meta{text-align:right;font-size:12px;color:#64748b;line-height:1.9}
.params-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.param-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
.param-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
.param-val{font-size:20px;font-weight:700;color:#0f172a}
.param-unit{font-size:12px;font-weight:400;color:#64748b}

/* DICE section */
.dice-header{background:#0f0f0f;color:#e0e0e0;text-align:center;padding:14px;border-radius:8px 8px 0 0;font-weight:700;font-size:14px;letter-spacing:.02em}
.dice-panels{display:flex;gap:0;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
.dice-panel{flex:1;display:flex;flex-direction:column;align-items:center;background:#0f0f0f}
.dice-panel+.dice-panel{border-left:1px solid #222}
.dice-panel .label{color:#888;font-size:11px;font-weight:600;text-align:center;padding:8px 4px 4px;background:#0f0f0f;width:100%}
.dice-panel img{width:100%;display:block;object-fit:contain;background:#0f0f0f}
.dice-legend{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;align-items:center;padding:10px 0;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;background:#f8fafc;margin-top:-8px}
.legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#374151}
.legend-swatch{width:14px;height:14px;border-radius:2px;flex-shrink:0}

.chart-wrap{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
.chart-wrap img{width:100%;display:block}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f1f5f9;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:600}
td{padding:7px 12px;border-bottom:1px solid #f1f5f9}
tr:last-child td{border-bottom:none}
.healthy{color:#16a34a;font-weight:600}.infected{color:#d97706;font-weight:600}.necrotic{color:#dc2626;font-weight:600}
.env-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.env-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px}
.env-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
.env-val{font-size:15px;font-weight:600;color:#0f172a}
.stage-box{background:#f8fafc;border-left:4px solid #475569;border-radius:0 8px 8px 0;padding:14px 18px}
.summary{background:#f0f9f4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 18px;font-size:13px;color:#166534;line-height:1.8}
.conf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.conf-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
.conf-name{font-size:12px;font-weight:600;color:#334155;margin-bottom:6px;text-transform:capitalize}
.conf-bar-wrap{background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;margin-bottom:4px}
.conf-bar{height:100%;border-radius:99px;background:linear-gradient(90deg,#16a34a,#22c55e)}
.conf-pct{font-size:11px;color:#64748b}
.footer{margin-top:40px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
.tip-badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0;margin-bottom:10px}
.tip-card{padding:12px 16px 12px 20px;border-left:3px solid #16a34a;background:#f0fdf4;border-radius:0 6px 6px 0;margin-bottom:8px}
.tip-card.warning{border-left-color:#d97706;background:#fffbeb}
.tip-card.critical{border-left-color:#dc2626;background:#fff5f5}
.tip-title{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px}
.tip-body{font-size:12px;color:#475569;line-height:1.65}
.hsv-explain{font-size:13px;color:#475569;line-height:1.7;margin-bottom:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px}
@media print{body{font-size:12px}.page{padding:20px}}
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <h1>S-Aging Simulation Report</h1>
      <div style="margin-top:7px">
        <span class="badge ${isFW ? "badge-fw" : "badge-bs"}">${diseaseName}</span>
      </div>
    </div>
    <div class="header-meta">
      <div><strong>Generated:</strong> ${generatedAt}</div>
      <div><strong>Duration:</strong> ${months} months simulated</div>
    </div>
  </div>

  <h2>Simulation Parameters</h2>
  <div class="params-grid">
    <div class="param-card">
      <div class="param-label">Temperature</div>
      <div class="param-val">${temp} <span class="param-unit">°C</span></div>
    </div>
    <div class="param-card">
      <div class="param-label">Relative Humidity</div>
      <div class="param-val">${rh} <span class="param-unit">%</span></div>
    </div>
    <div class="param-card">
      <div class="param-label">Initial Density</div>
      <div class="param-val">${densityLabel}</div>
    </div>
    <div class="param-card">
      <div class="param-label">Months Simulated</div>
      <div class="param-val">${months}</div>
    </div>
  </div>

  <h2>Disease Progression Chart</h2>
  ${chartB64
    ? `<div class="chart-wrap"><img src="${chartB64}" alt="Progression chart"/></div>`
    : `<p style="color:#94a3b8;font-size:13px">No frame data available.</p>`}

  <h2>Monthly Statistics</h2>
  <table>
    <thead><tr><th>Month</th><th>Healthy %</th><th>Infected %</th><th>Necrotic %</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h2>Environmental Analysis</h2>
  <div class="env-grid">
    ${envRow("Optimal Temp (T<sub>opt</sub>)", envInfo?.T_OPT, " °C")}
    ${envRow("Min. RH (RH<sub>min</sub>)", envInfo?.RH_MIN, " %")}
    ${envRow("Temp. Correction (C<sub>T</sub>)", envInfo?.CT)}
    ${envRow("Humidity Correction (C<sub>RH</sub>)", envInfo?.CRH)}
    ${envRow("Environmental Index (E<sub>env</sub>)", envInfo?.E_ENV)}
    ${envRow("Base Spread Prob. (p<sub>base</sub>)", envInfo?.p_base)}
  </div>

  <h2>Final Disease Stage</h2>
  <div class="stage-box">
    <h3 style="margin-bottom:5px">${stageLabel}</h3>
    <p style="font-size:13px;color:#475569">${stageDesc}</p>
  </div>

  <h2>Summary</h2>
  <div class="summary">
    Under <strong>${temp} °C</strong> and <strong>${rh}% RH</strong>, ${diseaseName} spread from
    an initial <strong>${densityLabel.toLowerCase()}</strong> density over <strong>${months} months</strong>.
    Final state: <strong class="healthy">${(finalStats?.healthy_pct ?? 0).toFixed(1)}%</strong> healthy,
    <strong class="infected">${(finalStats?.infected_pct ?? 0).toFixed(1)}%</strong> infected,
    <strong class="necrotic">${(finalStats?.necrotic_pct ?? 0).toFixed(1)}%</strong> necrotic.
    ${perClass ? `The photo's raw HSV pixel classification agreed with the YOLO-extracted SCA grid at Month 1 with a mean Dice score of
    <strong>${fmt(perClass.mean)}</strong> (Healthy ${pct(perClass.healthy)},
    Infected ${pct(perClass.infected)}, Necrotic ${pct(perClass.necrotic)}).` : ""}
  </div>

  ${detections && detections.length > 0 ? `
  <h2>YOLOv11 Detection Confidence</h2>
  <div class="conf-grid">
    ${detections.map(d => {
      const pctVal = Math.round(d.score * 100);
      const label = d.className.replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
      return `<div class="conf-card">
      <div class="conf-name">${label}</div>
      <div class="conf-bar-wrap"><div class="conf-bar" style="width:${pctVal}%"></div></div>
      <div class="conf-pct">${pctVal}% confidence</div>
    </div>`;
    }).join("\n    ")}
  </div>` : ""}

  <h2>Diagnostic &amp; Management Tips</h2>
  <div class="tip-badge">${_tipBadgeText}</div>
  ${tipsHTML}

  <h2>HSV Comparison — Original vs Simulated (Initial Extraction)</h2>
  <div class="hsv-explain">
    Each pixel of the original leaf photograph is independently classified using hue, saturation,
    and value (HSV) thresholds — with no reference to the YOLO detection result. The resulting
    class map is then compared against the SCA simulation at Month 1 (the initial extraction state
    seeded by YOLO). The <strong>Agreement Map</strong> shows where both methods agree (class color)
    and where they diverge (red). Dice scores measure per-class overlap: a score of 1.0 means
    perfect agreement, 0.0 means no overlap. Background pixels are excluded from all counts.
  </div>
  ${perClass ? `
  <div class="dice-header">
    HSV Comparison Test &nbsp;—&nbsp;
    Infected: ${fmt(perClass.infected)} &nbsp;|&nbsp;
    Necrotic: ${fmt(perClass.necrotic)} &nbsp;|&nbsp;
    Healthy: ${fmt(perClass.healthy)} &nbsp;|&nbsp;
    Mean: ${fmt(perClass.mean)}
  </div>` : `<div class="dice-header">HSV Comparison — No detection mask available</div>`}

  <div class="dice-panels">
    <div class="dice-panel">
      <div class="label">Original</div>
      ${uploadedImgSrc
        ? `<img src="${uploadedImgSrc}" alt="Original leaf photo" style="max-height:320px;object-fit:contain"/>`
        : `<div style="height:200px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px">No image uploaded</div>`}
    </div>
    <div class="dice-panel">
      <div class="label">Original (HSV Classification)</div>
      ${photoHSVImg
        ? `<img src="${photoHSVImg}" alt="Photo HSV classification"/>`
        : `<div style="height:200px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px">No HSV data</div>`}
    </div>
    <div class="dice-panel">
      <div class="label">Simulated (Month 1 — Initial Extraction)</div>
      ${simGridImg
        ? `<img src="${simGridImg}" alt="Simulation Month 1"/>`
        : `<div style="height:200px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px">No simulation data</div>`}
    </div>
    <div class="dice-panel">
      <div class="label">Agreement Map</div>
      ${agreementImg
        ? `<img src="${agreementImg}" alt="Agreement map"/>`
        : `<div style="height:200px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px">No mask data</div>`}
    </div>
  </div>
  <div class="dice-legend">
    <div class="legend-item"><div class="legend-swatch" style="background:#368626"></div> Healthy (agree)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#e8da16"></div> Infected (agree)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#783c14"></div> Necrotic (agree)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#dc3232"></div> Disagree</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#0f0f0f;border:1px solid #e2e8f0"></div> Background</div>
    <div style="font-size:11px;color:#94a3b8;margin-left:8px">Matching pixels shown in class color · Red = disagreement</div>
  </div>

  <div class="footer">
    <span>S-Aging — Banana Disease Simulation System</span>
    <span>Generated ${generatedAt}</span>
  </div>
</div>
</body>
</html>`;
}

// Named exports for helpers needed by the web app's live HSV comparison panel
export const computePhotoMask  = _computePhotoMask;
export const drawPhotoHSVImage = _drawPhotoHSVImage;
export const rotateCCW         = _rotateCCW;

// Trigger browser download of the HTML string
export function downloadReport(html, filename = "saging-report.html") {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
