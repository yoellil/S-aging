// ─────────────────────────────────────────────────────────────────────────────
// S-Aging Report Generator
// Produces a self-contained HTML report from simulation results.
// ─────────────────────────────────────────────────────────────────────────────

// Sørensen–Dice coefficient between two flat disease grids (> 0 = diseased)
export function computeDice(maskA, maskB) {
  if (!maskA || !maskB) return null;
  let intersection = 0, sumA = 0, sumB = 0;
  const n = Math.min(maskA.length, maskB.length);
  for (let i = 0; i < n; i++) {
    const a = maskA[i] > 0 ? 1 : 0;
    const b = maskB[i] > 0 ? 1 : 0;
    intersection += a & b;
    sumA += a;
    sumB += b;
  }
  if (sumA + sumB === 0) return 1.0;
  return (2 * intersection) / (sumA + sumB);
}

// Draw monthly progression line chart, return base64 PNG
export function drawProgressionChart(frames) {
  if (!frames || frames.length < 2) return null;
  const W = 780, H = 260;
  const PAD = { top: 16, right: 24, bottom: 48, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, W, H);

  // Horizontal grid lines + Y labels
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.font = "11px 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "right";
  for (let y = 0; y <= 4; y++) {
    const yPos = PAD.top + plotH - (y / 4) * plotH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, yPos);
    ctx.lineTo(PAD.left + plotW, yPos);
    ctx.stroke();
    ctx.fillText(`${y * 25}%`, PAD.left - 6, yPos + 4);
  }

  // X axis labels (sample ≤8 labels)
  const n = frames.length;
  const labelStep = Math.max(1, Math.ceil(n / 7));
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "center";
  for (let i = 0; i < n; i += labelStep) {
    const x = PAD.left + (i / (n - 1)) * plotW;
    ctx.fillText(`M${frames[i].month}`, x, PAD.top + plotH + 16);
  }
  // Always show last label
  ctx.fillText(`M${frames[n - 1].month}`, PAD.left + plotW, PAD.top + plotH + 16);

  // Axis title
  ctx.fillStyle = "#64748b";
  ctx.font = "12px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("Month", PAD.left + plotW / 2, H - 8);

  // Draw a single line series
  const drawLine = (getVal, color, lineWidth = 2.5) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.beginPath();
    frames.forEach((f, i) => {
      const x = PAD.left + (i / (n - 1)) * plotW;
      const y = PAD.top + plotH - Math.min(100, Math.max(0, getVal(f))) / 100 * plotH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  drawLine(f => f.stats.healthy_pct,  "#22c55e");
  drawLine(f => f.stats.infected_pct, "#f59e0b");
  drawLine(f => f.stats.necrotic_pct, "#ef4444");

  // Legend
  const legends = [
    { color: "#22c55e", label: "Healthy" },
    { color: "#f59e0b", label: "Infected" },
    { color: "#ef4444", label: "Necrotic" },
  ];
  let lx = PAD.left + 10;
  const ly = PAD.top + plotH + 36;
  ctx.textAlign = "left";
  ctx.font = "12px 'Segoe UI', Arial, sans-serif";
  legends.forEach(({ color, label }) => {
    ctx.fillStyle = color;
    ctx.fillRect(lx, ly - 7, 20, 3);
    ctx.fillStyle = "#374151";
    ctx.fillText(label, lx + 26, ly);
    lx += 100;
  });

  return canvas.toDataURL("image/png");
}

// Generate a self-contained HTML report string
export function generateReportHTML({
  disease, temp, rh, density, months,
  frames, finalStats, envInfo,
  topDownImage, uploadedImage,
  dice, stageLabel, stageDesc,
  diseaseName,
}) {
  const chartB64 = drawProgressionChart(frames);
  const diceStr = typeof dice === "number" ? `${(dice * 100).toFixed(1)}%` : "N/A";
  const diceColor =
    typeof dice !== "number"  ? "#6b7280" :
    dice >= 0.7               ? "#16a34a" :
    dice >= 0.5               ? "#d97706" : "#dc2626";
  const diceQuality =
    typeof dice !== "number"  ? "unavailable" :
    dice >= 0.7               ? "a good" :
    dice >= 0.5               ? "a moderate" : "a low";

  const densityLabel = { low: "Low", medium: "Medium", high: "High" }[density] ?? density;
  const isFW = disease === "fusarium_wilt";
  const generatedAt = new Date().toLocaleString();

  // Sample monthly table: first, every-5th, last
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
.page{max-width:920px;margin:0 auto;padding:40px 32px}
h1{font-size:22px;font-weight:700;color:#0f172a}
h2{font-size:15px;font-weight:600;color:#334155;margin:32px 0 10px;padding-bottom:6px;border-bottom:1.5px solid #e2e8f0}
h3{font-size:13px;font-weight:600;color:#475569;margin-bottom:4px}
.badge{display:inline-block;padding:2px 12px;border-radius:99px;font-size:12px;font-weight:600}
.badge-bs{background:#fef3c7;color:#92400e}
.badge-fw{background:#fce7f3;color:#9d174d}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
.header-meta{text-align:right;font-size:12px;color:#64748b;line-height:1.9}
.params-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:8px}
.param-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
.param-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
.param-val{font-size:20px;font-weight:700;color:#0f172a}
.param-unit{font-size:12px;font-weight:400;color:#64748b}
.dice-row{display:flex;align-items:flex-start;gap:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:16px}
.dice-score{font-size:44px;font-weight:800;line-height:1;flex-shrink:0}
.dice-desc{font-size:13px;color:#475569;line-height:1.7}
.dice-key{font-size:11px;color:#94a3b8;margin-top:4px}
.images-row{display:flex;gap:14px;margin-bottom:6px}
.image-card{flex:1;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
.image-card img{width:100%;height:210px;object-fit:contain;background:#0f172a;display:block}
.image-card .cap{font-size:11px;color:#64748b;text-align:center;padding:7px 8px;background:#f8fafc}
.chart-wrap{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:6px}
.chart-wrap img{width:100%;display:block}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:2px}
th{background:#f1f5f9;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:600}
td{padding:7px 12px;border-bottom:1px solid #f1f5f9}
tr:last-child td{border-bottom:none}
.healthy{color:#16a34a;font-weight:600}
.infected{color:#d97706;font-weight:600}
.necrotic{color:#dc2626;font-weight:600}
.env-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.env-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px}
.env-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
.env-val{font-size:15px;font-weight:600;color:#0f172a}
.stage-box{background:#f8fafc;border-left:4px solid #475569;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:6px}
.summary{background:#f0f9f4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 18px;font-size:13px;color:#166534;line-height:1.8}
.footer{margin-top:40px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
@media print{body{font-size:12px}.page{padding:20px}.params-grid{grid-template-columns:repeat(4,1fr)}}
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

  <h2>Initial Pattern Accuracy (Month 0)</h2>
  <div class="dice-row">
    <div class="dice-score" style="color:${diceColor}">${diceStr}</div>
    <div class="dice-desc">
      <strong>Sørensen–Dice Coefficient</strong><br/>
      Overlap between YOLOv11 detection mask and the simulation's Month 0 disease pattern.
      A higher score means the simulation seed closely matches the detected disease in the original photo.
      <div class="dice-key">≥ 70% = Good &nbsp;·&nbsp; 50–69% = Moderate &nbsp;·&nbsp; &lt; 50% = Low overlap</div>
    </div>
  </div>
  ${(topDownImage || uploadedImage) ? `
  <div class="images-row">
    ${uploadedImage ? `<div class="image-card">
      <img src="${uploadedImage}" alt="Original leaf photo"/>
      <div class="cap">Original leaf photo (uploaded)</div>
    </div>` : ""}
    ${topDownImage ? `<div class="image-card">
      <img src="${topDownImage}" alt="Simulation Month 0 — top-down orthographic"/>
      <div class="cap">Simulation — Month 0 (top-down orthographic, background removed)</div>
    </div>` : ""}
  </div>` : ""}

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
    <h3>${stageLabel}</h3>
    <p style="font-size:13px;color:#475569;margin-top:5px">${stageDesc}</p>
  </div>

  <h2>Summary</h2>
  <div class="summary">
    Under <strong>${temp} °C</strong> and <strong>${rh}% RH</strong>, ${diseaseName} spread from
    an initial <strong>${densityLabel.toLowerCase()}</strong> density over <strong>${months} months</strong>.
    At completion: <strong class="healthy">${(finalStats?.healthy_pct ?? 0).toFixed(1)}%</strong> healthy,
    <strong class="infected">${(finalStats?.infected_pct ?? 0).toFixed(1)}%</strong> infected,
    <strong class="necrotic">${(finalStats?.necrotic_pct ?? 0).toFixed(1)}%</strong> necrotic.
    The YOLOv11 detection seed matched the simulation's Month 0 pattern with a Dice score of
    <strong>${diceStr}</strong> — indicating ${diceQuality} degree of initial accuracy.
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
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
