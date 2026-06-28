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

// State → fill color
const STATE_COLOR = ["#22c55e", "#d97706", "#78350f"]; // healthy / infected / necrotic

// ── Per-class Dice ────────────────────────────────────────────────────────────
export function computePerClassDice(maskA, gridDataB) {
  if (!maskA || !gridDataB) return null;
  const b = _resolve(gridDataB);
  const n = Math.min(maskA.length, b.length);

  const inter = [0, 0, 0], sumA = [0, 0, 0], sumB = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const a = maskA[i] ?? 0;
    const bv = b[i];
    for (let cls = 0; cls < 3; cls++) {
      const ia = a === cls ? 1 : 0, ib = bv === cls ? 1 : 0;
      inter[cls] += ia & ib; sumA[cls] += ia; sumB[cls] += ib;
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
function _drawGrid(gridData, bg = "#111827") {
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

// Agreement map: green/yellow/brown = agree, red = disagree, black = bg
export function drawAgreementMap(maskA, gridDataB) {
  const W = _COLS * _CELL, H = _ROWS * _CELL;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, W, H);

  const b = _resolve(gridDataB);
  for (let r = 0; r < _ROWS; r++) {
    for (let c = 0; c < _COLS; c++) {
      if (!_inLeaf(r, c)) continue;
      const i = r * _COLS + c;
      const a = maskA[i] ?? 0;
      const bv = b[i];
      ctx.fillStyle = a === bv ? STATE_COLOR[bv] : "#ef4444";
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
export function generateReportHTML({
  disease, temp, rh, density, months,
  frames, finalStats, envInfo,
  uploadedImage, maskGrid, frame0GridData,
  stageLabel, stageDesc, diseaseName,
}) {
  // Restore full data URL if only the raw base64 was stored
  const uploadedImgSrc = uploadedImage
    ? (uploadedImage.startsWith("data:") ? uploadedImage : `data:image/png;base64,${uploadedImage}`)
    : null;

  // Generate 2-D grid images
  const simGridImg     = frame0GridData ? drawSimulatedGrid(frame0GridData) : null;
  const agreementImg   = (maskGrid && frame0GridData) ? drawAgreementMap(maskGrid, frame0GridData) : null;
  const perClass       = computePerClassDice(maskGrid, frame0GridData);
  const chartB64       = drawProgressionChart(frames);

  const fmt = v => typeof v === "number" ? v.toFixed(3) : "N/A";
  const pct = v => typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "N/A";

  const densityLabel = { low: "Low", medium: "Medium", high: "High" }[density] ?? density;
  const isFW = disease === "fusarium_wilt";
  const generatedAt = new Date().toLocaleString();

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
.dice-header{background:#111827;color:#f9fafb;text-align:center;padding:14px;border-radius:8px 8px 0 0;font-weight:700;font-size:14px;letter-spacing:.02em}
.dice-panels{display:flex;gap:0;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
.dice-panel{flex:1;display:flex;flex-direction:column;align-items:center;background:#0f172a}
.dice-panel+.dice-panel{border-left:1px solid #1e293b}
.dice-panel .label{color:#94a3b8;font-size:11px;font-weight:600;text-align:center;padding:8px 4px 4px;background:#0f172a;width:100%}
.dice-panel img{width:100%;display:block;object-fit:contain;background:#111827}
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
.footer{margin-top:40px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
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

  <h2>Dice Similarity — Initial Pattern Accuracy (Month 0)</h2>
  ${perClass ? `
  <div class="dice-header">
    Dice Similarity Test &nbsp;—&nbsp;
    Infected: ${fmt(perClass.infected)} &nbsp;|&nbsp;
    Necrotic: ${fmt(perClass.necrotic)} &nbsp;|&nbsp;
    Healthy: ${fmt(perClass.healthy)} &nbsp;|&nbsp;
    Mean: ${fmt(perClass.mean)}
  </div>` : `<div class="dice-header">Dice Similarity Test — No detection mask available</div>`}

  <div class="dice-panels">
    <div class="dice-panel">
      <div class="label">Original</div>
      ${uploadedImgSrc
        ? `<img src="${uploadedImgSrc}" alt="Original leaf photo" style="max-height:320px;object-fit:contain"/>`
        : `<div style="height:200px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px">No image uploaded</div>`}
    </div>
    <div class="dice-panel">
      <div class="label">Simulated (Month 0)</div>
      ${simGridImg
        ? `<img src="${simGridImg}" alt="Simulation Month 0"/>`
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
    <div class="legend-item"><div class="legend-swatch" style="background:#22c55e"></div> Healthy (agree)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#d97706"></div> Infected (agree)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#78350f"></div> Necrotic (agree)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#ef4444"></div> Disagree</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#111827;border:1px solid #e2e8f0"></div> Background</div>
    <div style="font-size:11px;color:#94a3b8;margin-left:8px">Matching pixels shown in class color · Red = disagreement</div>
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
    ${perClass ? `The YOLOv11 detection mask agreed with the simulation's Month 0 pattern with a mean Dice score of
    <strong>${fmt(perClass.mean)}</strong> (Healthy ${pct(perClass.healthy)},
    Infected ${pct(perClass.infected)}, Necrotic ${pct(perClass.necrotic)}).` : ""}
  </div>

  <div class="footer">
    <span>S-Aging — Banana Disease Simulation System</span>
    <span>Generated ${generatedAt}</span>
  </div>
</div>
</body>
</html>`;
}

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
