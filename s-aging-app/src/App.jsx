import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useInView } from "motion/react";
import {
  ScanSearch, Waypoints, Thermometer, Biohazard, ShieldCheck, Sprout,
  CloudUpload, X, Play, Pause, RefreshCcw, Wind,
  Hexagon, ScanEye, Orbit, Scroll,
  TestTubes, Sparkles, Atom, MoveRight, LoaderCircle, DoorOpen,
  Fingerprint, Leaf, FlaskConical, BookOpen, Users, BarChart3,
  CheckCircle2, Image as ImageIcon, Maximize2, Sun, Menu,
  LoaderCircle as Loader, ExternalLink,
} from "lucide-react";
import Antigravity from "./Antigravity";
import CurvedLoop from "./CurvedLoop";
import { detectDisease, warmupSession } from "./detection";
import { streamSimulation } from "./api";
import { saveSimulationLog } from "./profileApi";
import { supabase } from "./utils/supabase";
import AuthPage from "./AuthPage";
import ProfilePage from "./ProfilePage";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const COLORS = {
  green50: "#EAF3DE", green100: "#C0DD97", green200: "#97C459",
  green400: "#639922", green600: "#3B6D11", green800: "#27500A",
  teal50: "#E1F5EE", teal100: "#9FE1CB", teal200: "#5DCAA5",
  teal400: "#1D9E75", teal600: "#0F6E56", teal800: "#085041",
  gray50: "#F8F7F4", gray100: "#EEEDEA", gray200: "#D3D1C7",
  gray400: "#888780", gray600: "#5F5E5A", gray800: "#2A2A28",
  amber400: "#BA7517", amber50: "#FAEEDA", amber100: "#FAC775",
  red400: "#E24B4A", red50: "#FCEBEB", red100: "#F7C1C1",
};

// ── ANIMATION HELPERS ────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = "", y = 20 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Animated gradient text (ReactBits GradientText, simplified)
function GradientText({ children, className = "" }) {
  return (
    <span className={`gradient-text-anim ${className}`}>{children}</span>
  );
}

// Shiny sweep text (ReactBits ShinyText, simplified)
function ShinyText({ text, className = "", speed = 3 }) {
  return (
    <span className={`shiny-text ${className}`} style={{ "--shine-speed": `${speed}s` }}>
      {text}
    </span>
  );
}

// Cursor-tracking spotlight card (ReactBits SpotlightCard)
function SpotlightCard({ children, className = "", color = "rgba(99,153,34,0.10)" }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--sx", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--sy", `${e.clientY - r.top}px`);
    ref.current.style.setProperty("--sc", color);
  };
  return (
    <div ref={ref} onMouseMove={onMove} className={`spotlight-card ${className}`}>
      {children}
    </div>
  );
}

// Magnetic button (ReactBits Magnet)
function Magnet({ children, strength = 3, className = "" }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = Math.abs(cx - e.clientX), dy = Math.abs(cy - e.clientY);
      if (dx < r.width / 2 + 60 && dy < r.height / 2 + 60) {
        setActive(true);
        setPos({ x: (e.clientX - cx) / strength, y: (e.clientY - cy) / strength });
      } else {
        setActive(false);
        setPos({ x: 0, y: 0 });
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [strength]);
  return (
    <div ref={ref} className={className} style={{ display: "inline-block", position: "relative" }}>
      <div style={{
        transform: `translate3d(${pos.x}px,${pos.y}px,0)`,
        transition: active ? "transform 0.3s ease-out" : "transform 0.5s ease-in-out",
        willChange: "transform",
      }}>
        {children}
      </div>
    </div>
  );
}

// Animated number counter (ReactBits CountUp)
function CountUp({ to, from = 0, duration = 2, suffix = "", className = "" }) {
  const ref = useRef(null);
  const motionVal = useMotionValue(from);
  const spring = useSpring(motionVal, { damping: 20 + 40 / duration, stiffness: 100 / duration });
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (inView) motionVal.set(to);
  }, [inView, motionVal, to]);
  useEffect(() => {
    return spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = Math.round(v).toLocaleString() + suffix;
    });
  }, [spring, suffix]);
  return <span ref={ref} className={className}>{from}{suffix}</span>;
}

// Slot-machine word cycler
function CyclingWord({ words, interval = 2200 }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  return (
    <span className="cycling-word-wrap">
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          className="cycling-word"
          initial={{ y: 14, opacity: 0, filter: "blur(6px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -14, opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        >
          {words[idx]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ── SIM SPARKLINE ─────────────────────────────────────────────────────────────
function SimSparkline({ infData, necData, timeStep, months = 30, infColor = "#639922" }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !infData?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const PL = 32, PR = 14, PT = 8, PB = 22;
    const cw = W - PL - PR, ch = H - PT - PB;
    const n = infData.length;
    const xOf = i => PL + (n < 2 ? cw / 2 : (i / (n - 1)) * cw);
    const yOf = v => PT + ch - (v / 100) * ch;

    const isDark = document.documentElement.dataset.theme === "dark";
    const gridCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
    const labelCol = isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)";

    // Grid + Y labels
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    [0, 25, 50, 75, 100].forEach(v => {
      const y = yOf(v);
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cw, y);
      ctx.strokeStyle = gridCol; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = labelCol;
      ctx.fillText(v + "%", PL - 5, y + 3.5);
    });

    // X labels — 4 ticks spanning chosen duration
    ctx.textAlign = "center";
    const mStep = months / 3;
    [0, mStep, mStep * 2, months].forEach(m => {
      const i = Math.min(Math.round((m / months) * (n - 1)), n - 1);
      ctx.fillStyle = labelCol;
      ctx.fillText("M" + Math.round(m), xOf(i), PT + ch + PB - 5);
    });

    // Draw a series with fill
    const drawSeries = (data, color) => {
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = xOf(i), y = yOf(v);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.stroke();
      ctx.lineTo(xOf(n - 1), PT + ch); ctx.lineTo(xOf(0), PT + ch); ctx.closePath();
      ctx.fillStyle = color + "18"; ctx.fill();
    };

    drawSeries(infData, infColor);
    drawSeries(necData ?? [], "#5F5E5A");

    // Dashed cursor
    const ti = Math.min(timeStep, n - 1);
    const cx = xOf(ti);
    ctx.beginPath(); ctx.moveTo(cx, PT); ctx.lineTo(cx, PT + ch);
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.20)";
    ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);

    // Dots at cursor
    [[infData, infColor], [necData ?? [], "#5F5E5A"]].forEach(([d, col]) => {
      const v = d[ti] ?? 0;
      ctx.beginPath(); ctx.arc(cx, yOf(v), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
    });
  }, [infData, necData, timeStep, months, infColor]);

  return <canvas ref={ref} style={{ width: "100%", height: 140, display: "block" }} />;
}

// ── FIELD SPARKLINE ───────────────────────────────────────────────────────────
function FieldSparkline({ data, timeStep, months = 30 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data?.length) return;
    // Read the actual rendered CSS size, then size the backing store to match.
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const PL = 32, PR = 14, PT = 8, PB = 22;
    const cw = W - PL - PR, ch = H - PT - PB;
    const n = data.length;
    // X positions are always based on total months so the chart doesn't rescale
    const xOf = i => PL + (n < 2 ? cw / 2 : (i / (n - 1)) * cw);
    const yOf = v => PT + ch - (v / 100) * ch;

    // Only show data up to the current slider position
    const visibleCount = Math.min(timeStep + 1, n);

    const isDark = document.documentElement.dataset.theme === "dark";
    const gridCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
    const labelCol = isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.40)";

    // Grid lines + Y labels
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    [0, 25, 50, 75, 100].forEach(v => {
      const y = yOf(v);
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cw, y);
      ctx.strokeStyle = gridCol; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = labelCol;
      ctx.fillText(v + "%", PL - 5, y + 3.5);
    });

    // X axis labels — 4 evenly spaced ticks across the chosen duration
    ctx.textAlign = "center";
    const step = months / 3;
    [0, step, step * 2, months].forEach(m => {
      const i = Math.min(Math.round(m), n - 1);
      ctx.fillStyle = labelCol;
      ctx.fillText("M" + Math.round(m), xOf(i), PT + ch + PB - 5);
    });

    // 4 data lines — only draw up to visibleCount
    const SERIES = [
      { key: "healthy", color: "#4a9020" },
      { key: "early", color: "#c4b010" },
      { key: "advanced", color: "#f07818" },
      { key: "hi", color: "#cc1212" },
    ];
    SERIES.forEach(({ key, color }) => {
      ctx.beginPath();
      for (let i = 0; i < visibleCount; i++) {
        const x = xOf(i), y = yOf(data[i][key]);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.stroke();
    });

    // Dots at current position
    const ti = Math.min(timeStep, n - 1);
    const cx = xOf(ti);
    SERIES.forEach(({ key, color }) => {
      const v = data[ti]?.[key] ?? 0;
      ctx.beginPath(); ctx.arc(cx, yOf(v), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    });
  }, [data, timeStep, months]);

  return <canvas ref={ref} style={{ width: "100%", height: 160, display: "block" }} />;
}

// ── FIELD SIMULATION CONSTANTS & PURE FUNCTIONS ──────────────────────────────
const FIELD_COLS = 80;
const FIELD_ROWS = 40;
const FIELD_STEPS_PER_MONTH = 6;
// Age thresholds (in SCA steps) for color bands
const FIELD_AGE_ORANGE = FIELD_STEPS_PER_MONTH * 3;  // ~3 months infected
const FIELD_AGE_RED = FIELD_STEPS_PER_MONTH * 7;    // ~7 months infected

function makeFieldGrid(density) {
  return Array.from({ length: FIELD_ROWS }, () =>
    Array.from({ length: FIELD_COLS }, () => ({
      hasPlant: Math.random() < density,
      state: 0,
      age: 0,
    }))
  );
}

function makeFieldGridCornrow(density) {
  // Row spacing: wider gaps between rows as density decreases (2–6 rows apart)
  const rowStep = Math.max(2, Math.round((1 - density) * 5 + 2));
  const colStep = 2; // fixed: plants every 2 columns within a row

  return Array.from({ length: FIELD_ROWS }, (_, r) =>
    Array.from({ length: FIELD_COLS }, (_, c) => {
      if (r % rowStep !== 0) return { hasPlant: false, state: 0, age: 0 };
      // Stagger alternate rows by half a column step for banana plantation geometry
      const stagger = (Math.floor(r / rowStep) % 2 === 1) ? 1 : 0;
      return { hasPlant: (c + stagger) % colStep === 0, state: 0, age: 0 };
    })
  );
}

function fieldCellColor(state, age) {
  if (state === 0) return "#4a9020";             // Green  – Healthy
  if (age < FIELD_AGE_ORANGE) return "#d4c520";  // Yellow – Early
  if (age < FIELD_AGE_RED) return "#f07818";  // Orange – Advanced
  return "#cc1212";                              // Red    – Highly advanced
}

function stepFieldGrid(g, disease, env, windAngle, maxRange = 1, durationScale = 1) {
  const next = g.map(row => row.map(cell => ({ ...cell })));

  // Wind label = origin of wind; spores travel in the opposite direction.
  const wx = -Math.cos(windAngle), wy = -Math.sin(windAngle);
  const NBRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

  const bsWeights = disease === "black_sigatoka"
    ? NBRS.map(([dr, dc]) => {
      const len = Math.sqrt(dc * dc + dr * dr);
      const dot = (dc / len) * wx + (dr / len) * wy;
      return [dr, dc, (0.05 + 0.95 * Math.max(0, (dot + 1) / 2)) * (len === 1 ? 1 : 0.75)];
    })
    : null;

  for (let r = 0; r < FIELD_ROWS; r++) {
    for (let c = 0; c < FIELD_COLS; c++) {
      const cell = g[r][c];
      if (!cell.hasPlant) continue;
      if (cell.state === 1) {
        next[r][c].age++;
      } else {
        let prob = 0;
        if (bsWeights) {
          for (const [dr, dc, w] of bsWeights) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < FIELD_ROWS && nc >= 0 && nc < FIELD_COLS && g[nr][nc].hasPlant && g[nr][nc].state === 1)
              prob += 0.06 * w * env * durationScale;
          }
          for (const dist of [2, 3]) {
            const nr = Math.round(r - dist * wy), nc = Math.round(c - dist * wx);
            if (nr >= 0 && nr < FIELD_ROWS && nc >= 0 && nc < FIELD_COLS && g[nr][nc].hasPlant && g[nr][nc].state === 1)
              prob += (0.02 / dist) * env * durationScale;
          }
        } else {
          for (const [dr, dc] of NBRS) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < FIELD_ROWS && nc >= 0 && nc < FIELD_COLS && g[nr][nc].hasPlant && g[nr][nc].state === 1)
              prob += 0.08 * env * durationScale;
          }
        }

        // Extended-range spread for cornrow inter-row propagation.
        // Probability decays with Chebyshev distance so it stays moderate.
        if (maxRange > 1) {
          for (let dr = -maxRange; dr <= maxRange; dr++) {
            for (let dc = -maxRange; dc <= maxRange; dc++) {
              const d = Math.max(Math.abs(dr), Math.abs(dc));
              if (d <= 1 || d > maxRange) continue;
              const nr = r + dr, nc = c + dc;
              if (nr < 0 || nr >= FIELD_ROWS || nc < 0 || nc >= FIELD_COLS) continue;
              if (!g[nr][nc].hasPlant || g[nr][nc].state !== 1) continue;
              const decay = 0.35 / d;
              if (bsWeights) {
                const len = Math.sqrt(dc * dc + dr * dr);
                const dot = (dc / len) * wx + (dr / len) * wy;
                const w = 0.05 + 0.95 * Math.max(0, (dot + 1) / 2);
                prob += 0.06 * w * decay * env * durationScale;
              } else {
                prob += 0.08 * decay * env * durationScale;
              }
            }
          }
        }

        if (prob > 0 && Math.random() < Math.min(prob, 0.95))
          next[r][c].state = 1;
      }
    }
  }
  return next;
}

function computeFieldSnapshots(seededGrid, disease, envFactor, windAngle, maxRange = 1, temp = 27, months = 30) {
  const isFW = disease === "fusarium_wilt";
  const T_MIN = isFW ? 20.0 : 16.6;
  const T_MAX = isFW ? 35.0 : 30.3;
  const outOfRange = temp < T_MIN || temp > T_MAX;
  // Outside viable range = dormant/latent: still spreads, but very slowly
  const env = outOfRange ? 0.08 : Math.max(0.15, envFactor);
  // Scale spread rate so disease paces across the full duration
  // (calibrated for 30 months — longer durations spread slower per step)
  const durationScale = 30 / Math.max(1, months);
  const snaps = [seededGrid];
  let cur = seededGrid;
  for (let m = 1; m <= months; m++) {
    for (let s = 0; s < FIELD_STEPS_PER_MONTH; s++)
      cur = stepFieldGrid(cur, disease, env, windAngle, maxRange, durationScale);
    snaps.push(cur);
  }
  return snaps;
}

function fieldSnapshotStats(snap) {
  let total = 0, healthy = 0, early = 0, advanced = 0, hi = 0;
  for (const row of snap)
    for (const cell of row) {
      if (!cell.hasPlant) continue;
      total++;
      if (cell.state === 0) healthy++;
      else if (cell.age < FIELD_AGE_ORANGE) early++;
      else if (cell.age < FIELD_AGE_RED) advanced++;
      else hi++;
    }
  if (!total) return { healthy: 100, early: 0, advanced: 0, hi: 0 };
  const p = v => Math.round(v / total * 100);
  return { healthy: p(healthy), early: p(early), advanced: p(advanced), hi: p(hi) };
}

function FieldView({ disease, timeStep, envFactor, temp, months, onStatsUpdate, playing, onPlayPause, onRerun }) {
  const ref = useRef(null);
  const animRef = useRef(null);
  const snapsRef = useRef(null);
  const displayRef = useRef(null);
  const timeStepRef = useRef(timeStep);
  const diseaseRef = useRef(disease);
  const envRef = useRef(envFactor);
  const tempRef = useRef(temp);
  const monthsRef = useRef(months);
  const densityRef = useRef(0.75);
  const maxRangeRef = useRef(1);
  const baseGridRef = useRef(null);
  const seedsRef = useRef([]);    // [{cx,cy}, …] — accumulates clicks
  const windAngle = useRef(0);     // radians; 0 = East
  const dragStart = useRef(null);

  const [density, setDensity] = useState(0.75);
  const [pattern, setPattern] = useState("random"); // "random" | "cornrow"
  const [windDir, setWindDir] = useState("E");
  const [computing, setComputing] = useState(false);
  const [showWind, setShowWind] = useState(false);

  useEffect(() => { diseaseRef.current = disease; }, [disease]);
  useEffect(() => { envRef.current = envFactor; }, [envFactor]);
  useEffect(() => { tempRef.current = temp; }, [temp]);
  useEffect(() => { monthsRef.current = months; }, [months]);
  useEffect(() => { timeStepRef.current = timeStep; }, [timeStep]);
  useEffect(() => {
    maxRangeRef.current = pattern === "cornrow"
      ? Math.max(2, Math.round((1 - density) * 5 + 2)) + 1
      : 1;
  }, [pattern, density]);

  const rebuild = useCallback((base, seeds, angle) => {
    setComputing(true);
    setTimeout(() => {
      const seeded = base.map((row, r) => row.map((cell, c) => {
        const hit = seeds.some(({ cx, cy }) => Math.abs(r - cy) <= 2 && Math.abs(c - cx) <= 2);
        return hit && cell.hasPlant ? { ...cell, state: 1, age: 0 } : { ...cell };
      }));
      const snaps = computeFieldSnapshots(seeded, diseaseRef.current, envRef.current, angle, maxRangeRef.current, tempRef.current, monthsRef.current);
      snapsRef.current = snaps;
      displayRef.current = snaps[Math.min(timeStepRef.current, snaps.length - 1)];
      onStatsUpdate?.(snaps.map(fieldSnapshotStats));
      setComputing(false);
    }, 10);
  }, []);

  const doReset = useCallback((den, pat) => {
    const base = pat === "cornrow" ? makeFieldGridCornrow(den) : makeFieldGrid(den);
    baseGridRef.current = base;
    seedsRef.current = [];
    windAngle.current = 0;
    setWindDir("E");
    rebuild(base, [], 0);
  }, [rebuild]);

  useEffect(() => { doReset(density, pattern); }, [disease, density, pattern, doReset]);

  useEffect(() => {
    if (!snapsRef.current) return;
    displayRef.current = snapsRef.current[Math.min(timeStep, snapsRef.current.length - 1)];
  }, [timeStep]);

  // ── Pointer interaction (mouse + touch via Pointer Events) ──────────────────
  const toCoords = (e) => {
    const canvas = ref.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    return {
      px, py,
      cx: Math.min(FIELD_COLS - 1, Math.max(0, Math.floor(px * FIELD_COLS))),
      cy: Math.min(FIELD_ROWS - 1, Math.max(0, Math.floor(py * FIELD_ROWS))),
    };
  };

  const onDown = (e) => {
    ref.current?.setPointerCapture(e.pointerId);
    dragStart.current = toCoords(e);
  };

  const onUp = (e) => {
    if (!dragStart.current) return;
    const c = toCoords(e);
    const start = dragStart.current;
    dragStart.current = null;
    if (!c || !baseGridRef.current) return;
    if (Math.hypot(c.px - start.px, c.py - start.py) < 0.02) {
      seedsRef.current = [...seedsRef.current, { cx: c.cx, cy: c.cy }];
      rebuild(baseGridRef.current, seedsRef.current, windAngle.current);
    }
  };

  // ── Render loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const cW = W / FIELD_COLS, cH = H / FIELD_ROWS;
    const RAD = Math.min(cW, cH) * 0.40;

    const loop = () => {
      const g = displayRef.current;
      ctx.fillStyle = "#0d1a08"; ctx.fillRect(0, 0, W, H);
      if (g) {
        for (let r = 0; r < FIELD_ROWS; r++) {
          for (let c = 0; c < FIELD_COLS; c++) {
            const cell = g[r][c];
            if (!cell.hasPlant) continue;
            ctx.beginPath();
            ctx.arc((c + 0.5) * cW, (r + 0.5) * cH, RAD, 0, Math.PI * 2);
            ctx.fillStyle = fieldCellColor(cell.state, cell.age);
            ctx.fill();
          }
        }
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // 8 compass directions: label, angle (radians in canvas coords, Y-down)
  const WIND_DIRS = [
    ["NW", -3 * Math.PI / 4], ["N", -Math.PI / 2], ["NE", -Math.PI / 4],
    ["W", Math.PI], [null, null], ["E", 0],
    ["SW", 3 * Math.PI / 4], ["S", Math.PI / 2], ["SE", Math.PI / 4],
  ];

  const setWind = (label, angle) => {
    windAngle.current = angle;
    setWindDir(label);
    if (baseGridRef.current && seedsRef.current.length > 0)
      rebuild(baseGridRef.current, seedsRef.current, angle);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Controls toolbar */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
        padding: "10px 14px", fontSize: 12, color: "var(--text-muted)",
        background: "var(--bg)", borderBottom: "1px solid var(--color-border-secondary)",
      }}>
        {/* Pattern — left */}
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
          {[["random", "Random"], ["cornrow", "Cornrow"]].map(([val, label]) => (
            <button key={val} onClick={() => setPattern(val)} style={{
              fontSize: 11, padding: "5px 11px", borderRadius: "var(--radius-sm)", cursor: "pointer",
              whiteSpace: "nowrap",
              border: `1px solid ${pattern === val ? "var(--green-400)" : "var(--color-border-primary)"}`,
              background: pattern === val ? "var(--green-50)" : "transparent",
              color: pattern === val ? "var(--green-mid)" : "var(--text-muted)",
              fontWeight: pattern === val ? 500 : 400,
              transition: "background 0.12s, color 0.12s, border-color 0.12s",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: "var(--color-border-secondary)", flexShrink: 0 }} />

        {/* Density slider — grows */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 140px", minWidth: 0 }}>
          <span style={{ whiteSpace: "nowrap" }}>Plant density</span>
          <input
            type="range" min={0.3} max={1.0} step={0.05} value={density}
            onChange={e => { const v = +e.target.value; densityRef.current = v; setDensity(v); }}
            style={{ flex: 1, minWidth: 60, accentColor: "var(--green)" }}
          />
          <span style={{ minWidth: 30, textAlign: "right" }}>{Math.round(density * 100)}%</span>
        </div>

        {/* Play, Reset, Re-run */}
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
          <button onClick={onPlayPause} className="play-btn" style={{ fontSize: 11, padding: "5px 11px" }}>
            {playing ? <Pause size={11} /> : <Play size={11} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button onClick={() => doReset(density, pattern)} style={{
            fontSize: 11, padding: "5px 12px", borderRadius: "var(--radius-sm)", cursor: "pointer",
            whiteSpace: "nowrap", border: "1px solid var(--color-border-primary)",
            background: "transparent", color: "var(--text-muted)",
            transition: "background 0.12s",
          }}>Clear seeds</button>
          <button onClick={onRerun} style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 11, padding: "5px 12px", borderRadius: "var(--radius-sm)", cursor: "pointer",
            whiteSpace: "nowrap", border: "1px solid var(--color-border-primary)",
            background: "transparent", color: "var(--text-muted)",
            transition: "background 0.12s",
          }}>
            <RefreshCcw size={12} />
            Restart sim
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
        padding: "7px 14px", color: "var(--text-muted)",
        background: "var(--bg2)", borderBottom: "1px solid var(--color-border-secondary)",
      }}>
        {[["#4a9020", "Healthy"], ["#d4c520", "Early infection"], ["#f07818", "Advanced"], ["#cc1212", "Highly advanced"]].map(([color, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 11 }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, opacity: 0.5, marginLeft: "auto", whiteSpace: "nowrap" }}>
          Tap / click to seed infection
        </span>
      </div>

      {/* Canvas + overlays */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={ref} width={640} height={320} className="sim-canvas"
          style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair", touchAction: "none" }}
          onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={onUp}
        />

        {/* Wind button — upper-left, BS only */}
        {disease === "black_sigatoka" && (
          <button
            onClick={() => setShowWind(v => !v)}
            style={{
              position: "absolute", top: 10, left: 10,
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: "var(--radius-sm)",
              fontSize: 11, fontWeight: 500, cursor: "pointer",
              background: showWind ? "rgba(99,153,34,0.18)" : "rgba(0,0,0,0.45)",
              border: `1px solid ${showWind ? "rgba(99,153,34,0.55)" : "rgba(255,255,255,0.18)"}`,
              color: showWind ? "#a8d870" : "rgba(255,255,255,0.82)",
              backdropFilter: "blur(6px)",
              transition: "background 0.15s, border-color 0.15s, color 0.15s",
            }}
          >
            <Wind size={13} />
            Wind
            <span style={{
              marginLeft: 3, paddingLeft: 7,
              borderLeft: "1px solid rgba(255,255,255,0.2)",
              opacity: 0.9, letterSpacing: "0.03em",
            }}>
              {{ "N": "↑", "NE": "↗", "E": "→", "SE": "↘", "S": "↓", "SW": "↙", "W": "←", "NW": "↖" }[windDir]} {windDir}
            </span>
          </button>
        )}

        {/* Wind direction popup */}
        {disease === "black_sigatoka" && showWind && (
          <div style={{
            position: "absolute", top: 40, left: 10, zIndex: 10,
            background: "rgba(12,20,12,0.88)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
            padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 44px)", gap: 4,
            }}>
              {WIND_DIRS.map(([label, angle], i) => {
                if (label === null) {
                  return (
                    <button key={i} onClick={() => setShowWind(false)} style={{
                      width: 44, height: 36, borderRadius: "var(--radius-sm)",
                      cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.55)",
                      transition: "background 0.12s",
                    }}>
                      <X size={13} />
                    </button>
                  );
                }
                const active = windDir === label;
                return (
                  <button key={label} onClick={() => { setWind(label, angle); setShowWind(false); }} style={{
                    width: 44, height: 36, borderRadius: "var(--radius-sm)",
                    cursor: "pointer", fontSize: 10, fontWeight: active ? 700 : 400,
                    lineHeight: 1,
                    border: `1px solid ${active ? "rgba(99,153,34,0.7)" : "rgba(255,255,255,0.12)"}`,
                    background: active ? "rgba(99,153,34,0.22)" : "rgba(255,255,255,0.05)",
                    color: active ? "#a8d870" : "rgba(255,255,255,0.65)",
                    transition: "background 0.12s, color 0.12s, border-color 0.12s",
                  }}>{label}</button>
                );
              })}
            </div>
          </div>
        )}

        {computing && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
            background: "rgba(0,0,0,0.55)", fontSize: 13, color: "#b8d4b8",
          }}>
            <Loader size={15} style={{ animation: "spin 1s linear infinite" }} />
            Computing…
          </div>
        )}
      </div>

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  HOME PAGE
// ══════════════════════════════════════════════════════════════════════════════
function HomePage({ onNavigate, reduceMotion }) {
  return (
    <div className="page-wrapper">
      {/* Hero */}
      <div className="hero">
        <div className="hero-aurora" aria-hidden="true" />

        {/* ── Floating side decorations ── */}
        <div className="hero-side-deco hero-side-deco-left" aria-hidden="true">
          <svg viewBox="0 0 200 360" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M40 60 C 60 20, 140 30, 160 80 C 175 130, 130 200, 90 230 C 60 250, 30 240, 30 200 C 30 150, 25 100, 40 60 Z"
              fill="url(#leafGradL)" opacity="0.55" />
            <path d="M90 90 C 100 130, 95 180, 80 220" stroke="#3B6D11" strokeWidth="1.2" opacity="0.4" strokeLinecap="round" />
            {[80, 110, 140, 170, 200].map((y, i) => (
              <path key={i} d={`M90 ${y} L ${50 + (i % 2) * 8} ${y - 10}`} stroke="#3B6D11" strokeWidth="0.8" opacity="0.3" />
            ))}
            <defs>
              <linearGradient id="leafGradL" x1="0" y1="0" x2="200" y2="360" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#97C459" /><stop offset="1" stopColor="#1D9E75" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="hero-side-deco hero-side-deco-right" aria-hidden="true">
          <svg viewBox="0 0 200 360" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M40 60 C 60 20, 140 30, 160 80 C 175 130, 130 200, 90 230 C 60 250, 30 240, 30 200 C 30 150, 25 100, 40 60 Z"
              fill="url(#leafGradR)" opacity="0.5" />
            <path d="M90 90 C 100 130, 95 180, 80 220" stroke="#0F6E56" strokeWidth="1.2" opacity="0.4" strokeLinecap="round" />
            {[80, 110, 140, 170, 200].map((y, i) => (
              <path key={i} d={`M90 ${y} L ${130 + (i % 2) * 8} ${y - 10}`} stroke="#0F6E56" strokeWidth="0.8" opacity="0.3" />
            ))}
            <defs>
              <linearGradient id="leafGradR" x1="200" y1="0" x2="0" y2="360" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#5DCAA5" /><stop offset="1" stopColor="#639922" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Floating molecule dots */}
        <div className="hero-particles" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="hero-particle" style={{
              left: `${(i * 7.3) % 95 + 2}%`,
              top: `${(i * 11.7) % 80 + 10}%`,
              animationDelay: `${(i * 0.7) % 4}s`,
              animationDuration: `${4 + (i % 5)}s`,
            }} />
          ))}
        </div>

        <motion.div
          className="hero-badge"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="hero-badge-dot" />
          <ShinyText text="FEU Institute of Technology · 2026" speed={4} />
        </motion.div>
        <motion.h1
          className="hero-title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          Simulate how<br />
          <GradientText>banana diseases</GradientText> spread
        </motion.h1>
        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          Powered by{" "}
          <CyclingWord words={["YOLOv11-seg", "Stochastic CA", "Moore 8-cell", "3D Spatio-Temporal"]} />
          {" "}to model how Black Sigatoka and Fusarium Wilt spread across Cavendish banana crops.
        </motion.p>
        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Magnet strength={4}>
            <button className="btn-secondary" onClick={() => document.getElementById("home-diseases").scrollIntoView({ behavior: "smooth" })}>
              Learn more
            </button>
          </Magnet>
        </motion.div>
      </div>

      {/* Features */}
      <div className="features">
        <FadeIn>
          <div className="section-label"><ShinyText text="Capabilities" speed={5} /></div>
          <h2 className="section-title">Built for agricultural education</h2>
        </FadeIn>
        <div className="features-grid">
          {[
            {
              color: COLORS.green50, iconColor: COLORS.green600,
              icon: <ScanSearch size={20} />,
              title: "Real-time detection",
              desc: "Upload a banana leaf image and get instant disease identification with pixel-level segmentation masks.",
            },
            {
              color: COLORS.teal50, iconColor: COLORS.teal600,
              icon: <Waypoints size={20} />,
              title: "Cellular Automata engine",
              desc: "8-cell Moore neighborhood SCA simulates organic, pathologically accurate disease spread patterns.",
            },
            {
              color: COLORS.amber50, iconColor: COLORS.amber400,
              icon: <Thermometer size={20} />,
              title: "Environmental variables",
              desc: "Adjust temperature, humidity, and plant density to explore how conditions affect disease progression speed.",
            },
            {
              color: COLORS.green50, iconColor: COLORS.green600,
              icon: <Biohazard size={20} />,
              title: "Two disease models",
              desc: "Marginal-lateral spread for Fusarium Wilt TR4 (margin-first chlorosis) and longitudinal σ-β model for Black Sigatoka.",
            },
            {
              color: COLORS.teal50, iconColor: COLORS.teal600,
              icon: <ShieldCheck size={20} />,
              title: "ISO-25010 evaluated",
              desc: "System quality assessed across functionality, performance, interaction, maintainability, and security.",
            },
            {
              color: COLORS.amber50, iconColor: COLORS.amber400,
              icon: <Sprout size={20} />,
              title: "Philippine banana focus",
              desc: "Targets Cavendish (Musa acuminata) — the primary export variety from Mindanao's 82,000+ hectares.",
            },
          ].map(({ color, iconColor, icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            >
              <SpotlightCard className="feature-card" color={`${iconColor}12`}>
                <div className="feature-icon" style={{ background: color, color: iconColor }}>{icon}</div>
                <div className="feature-title">{title}</div>
                <div className="feature-desc">{desc}</div>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Tech marquee strip ── */}
      <div className="home-marquee-wrap" aria-hidden="true">
        <div className="home-marquee-track">
          {[
            "YOLOv11-seg", "Stochastic CA", "Moore 8-cell", "3D Spatio-Temporal",
            "CLAHE + GC", "FastAPI", "PyVista", "ISO-25010", "AdamW Optimizer",
            "Black Sigatoka", "Fusarium Wilt TR4", "React 19", "ONNX Runtime",
            "YOLOv11-seg", "Stochastic CA", "Moore 8-cell", "3D Spatio-Temporal",
            "CLAHE + GC", "FastAPI", "PyVista", "ISO-25010",
          ].map((t, i) => (
            <span className="home-marquee-pill" key={i}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Model metrics band ── */}
      <div className="home-metrics-band">
        <div className="home-metrics-inner">
          {[
            { label: "Mask mAP@50", value: "91.4%", sub: "YOLOv11-seg detection", icon: ScanSearch },
            { label: "Simulation months", value: "30", sub: "Per disease run", icon: Orbit },
            { label: "SCA grid cells", value: "16 K", sub: "Moore 8-cell neighbourhood", icon: Waypoints },
            { label: "Target hectares", value: "82 K+", sub: "Mindanao Cavendish farms", icon: Leaf },
          ].map(({ label, value, sub, icon: Icon }, i) => (
            <motion.div
              className="home-metric-item"
              key={label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="home-metric-icon"><Icon size={18} /></div>
              <div className="home-metric-value">{value}</div>
              <div className="home-metric-label">{label}</div>
              <div className="home-metric-sub">{sub}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Diseases */}
      <div className="diseases" id="home-diseases">
        <FadeIn>
          <div className="section-label"><ShinyText text="Target diseases" speed={5} /></div>
          <h2 className="section-title">Two pathogens, two spread models</h2>
        </FadeIn>
        <div className="disease-grid">
          <motion.div
            className="disease-card"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="disease-card-header">
              <div className="disease-tag" style={{ background: COLORS.amber50, color: "#854F0B" }}>
                Fusarium Wilt TR4
              </div>
              <div className="disease-name">Panama Disease / Fusarium Wilt</div>
              <div className="disease-sci">Fusarium oxysporum f. sp. cubense</div>
              <div className="disease-desc">
                Fusarium Wilt is a soil-borne disease that affects the vascular tissue of the plant, preventing
                the water from reaching the leaves. The most observed characteristic of this disease in banana plants
                is that the leaves turn yellow and eventually die. Chlorosis appears in the margins and progresses inward,
                eventually covering the entire leaf.
              </div>
            </div>
            <div className="disease-card-footer">
              <div className="disease-meta">Spread model <strong>Marginal-lateral</strong></div>
              <div className="disease-meta">Origin <strong>Root → xylem → margins</strong></div>
              <div className="disease-meta">Onset temperature <strong>20°C</strong></div>
              <div className="disease-meta">Optimal temperature <strong>24–30°C</strong></div>
              <div className="disease-meta">Humidity onset <strong>≥75%</strong></div>
              <div className="disease-meta">Optimal humidity <strong>≥85%</strong></div>
            </div>
          </motion.div>
          <motion.div
            className="disease-card"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="disease-card-header">
              <div className="disease-tag" style={{ background: COLORS.green50, color: COLORS.green600 }}>
                Black Sigatoka
              </div>
              <div className="disease-name">Black Sigatoka</div>
              <div className="disease-sci">Mycosphaerella fijiensis</div>
              <div className="disease-desc">
                Black Sigatoka is a leaf spot disease that affects the leaves of banana plants. It is characterized by
                the apperance of small streaks or spots to which then expands into dark patches and reduces the plants
                ability to photosynthesize. The pattern of spread starts at the edges of the leaves and progresses inward
                toward the midrib.
              </div>
            </div>
            <div className="disease-card-footer">
              <div className="disease-meta">Spread model <strong>Longitudinal σ-β</strong></div>
              <div className="disease-meta">Origin <strong>Leaf surface spots</strong></div>
              <div className="disease-meta">Onset temperature <strong>20°C</strong></div>
              <div className="disease-meta">Optimal temperature <strong>26–28°C</strong></div>
              <div className="disease-meta">Humidity onset <strong>≥70%</strong></div>
              <div className="disease-meta">Optimal humidity <strong>≥90%</strong></div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="pipeline">
        <div className="pipeline-inner">
          <FadeIn>
            <div className="section-label"><ShinyText text="System pipeline" speed={5} /></div>
            <h2 className="section-title">How S-Aging works</h2>
          </FadeIn>
          <div className="pipeline-steps">
            {[
              { n: "01", t: "Upload", d: "Banana leaf photo via web app", icon: <CloudUpload size={16} /> },
              { n: "02", t: "CLAHE + GC", d: "Contrast & gamma preprocessing", icon: <Sparkles size={16} /> },
              { n: "03", t: "YOLOv11-seg", d: "Pixel-level disease mask extraction", icon: <ScanSearch size={16} /> },
              { n: "04", t: "SCA Engine", d: "Disease spread simulation on UV grid", icon: <Waypoints size={16} /> },
              { n: "05", t: "3D Viewer", d: "Interactive temporal visualization", icon: <Atom size={16} /> },
            ].map(({ n, t, d, icon }, i) => (
              <motion.div
                className="pipeline-step"
                key={n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.09, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="pipeline-step-num">{icon}</div>
                <div className="pipeline-step-title">{t}</div>
                <div className="pipeline-step-desc">{d}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom CTA Band ── */}
      <div className="home-cta-band">
        <div className="home-cta-glow" aria-hidden="true" />
        <div className="home-cta-inner">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="home-cta-content"
          >
            <div className="home-cta-badge">
              <div className="hero-badge-dot" />
              <ShinyText text="Simulation ready" speed={3} />
            </div>
            <h2 className="home-cta-heading">Analyze your first banana leaf today</h2>
            <p className="home-cta-desc">
              Upload a photo — YOLOv11 detects the disease in seconds, then our Stochastic
              Cellular Automata engine simulates how it spreads across your plantation month by month.
            </p>
            <div className="home-cta-actions">
              <Magnet strength={4}>
                <button className="btn-primary" onClick={() => onNavigate("upload")}>
                  Upload & detect <MoveRight size={14} style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} />
                </button>
              </Magnet>
              <Magnet strength={4}>
                <button className="btn-secondary home-cta-secondary" onClick={() => onNavigate("about")}>
                  Read the research
                </button>
              </Magnet>
            </div>
          </motion.div>
          <div className="home-cta-visual" aria-hidden="true">
            <div className="home-cta-orb home-cta-orb-1" />
            <div className="home-cta-orb home-cta-orb-2" />
            <div className="home-cta-orb home-cta-orb-3" />
            <div className="home-cta-leaf-grid">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="home-cta-leaf-cell"
                  style={{ opacity: Math.random() * 0.6 + 0.1, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      {!reduceMotion && (
        <CurvedLoop
          marqueeText="SCAN · YOUR · LEAF · TODAY! · FOR · ECONOMY · AND · FOR · SCIENCE! · "
          speed={1.2}
          curveAmount={60}
          direction="left"
          className="home-marquee-text"
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  UPLOAD PAGE
// ══════════════════════════════════════════════════════════════════════════════
function UploadPage({ onNavigate, setSimConfig }) {
  const [selected, setSelected] = useState("black_sigatoka");
  const [temp, setTemp] = useState(26);
  const [rh, setRh] = useState(85);
  const [density, setDensity] = useState("medium");
  const [duration, setDuration] = useState("30");
  const [drag, setDrag] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detections, setDetections] = useState(null);   // array from detectDisease()
  const [maskGrid, setMaskGrid] = useState(null);       // 160×100 flat array from YOLO seg masks
  const [detectionError, setDetectionError] = useState(null);
  const fileInputRef = useRef(null);
  const imgRef = useRef(null);

  const envEffect = () => {
    const isFW = selected === "fusarium_wilt";
    // FW:  Topt=27.5°C (±5°C peak band), RH_OPT=85% (MDPI Agronomy 2021)
    // BS:  Topt=27.2°C (±2°C peak band), RH_OPT=90% — "favoured by 90–100% RH"
    //      (Maxapress 2024 Sigatoka overview)
    const tOptimal = isFW ? (temp >= 24 && temp <= 32) : (temp >= 25 && temp <= 29);
    const rhOptimal = isFW ? rh >= 80 : rh >= 90;
    const tModerate = isFW ? (temp >= 20 && temp <= 35) : (temp >= 16.6 && temp <= 30.3);
    const rhModerate = isFW ? rh >= 65 : rh >= 70;
    if (tOptimal && rhOptimal) return { label: "Optimal — peak disease spread", color: COLORS.red400 };
    if (tModerate && rhModerate) return { label: "Moderate — gradual spread", color: COLORS.amber400 };
    return { label: "Unfavorable — minimal spread", color: COLORS.green400 };
  };

  const eff = envEffect();

  // Run ONNX detection whenever a real image is uploaded
  useEffect(() => {
    if (!uploadedImage) { setDetections(null); setMaskGrid(null); setDetectionError(null); return; }
    let cancelled = false;
    setDetecting(true);
    setDetections(null);
    setDetectionError(null);

    // Wait for the <img> to fully load then run inference
    const run = async (imgEl) => {
      try {
        const result = await detectDisease(imgEl);
        if (cancelled) return;
        setDetections(result.detections);
        setMaskGrid(result.maskGrid);
        // Auto-select the disease with the highest confidence
        const top = result.detections
          .filter(d => d.diseaseKey !== "unknown" && d.diseaseKey !== "healthy")
          .sort((a, b) => b.score - a.score)[0];
        if (top) setSelected(top.diseaseKey);
      } catch (err) {
        if (!cancelled) setDetectionError("Detection failed: " + err.message);
      } finally {
        if (!cancelled) setDetecting(false);
      }
    };

    // imgRef may not be mounted yet — use a short poll
    const tryRun = () => {
      const el = imgRef.current;
      if (el && el.complete && el.naturalWidth > 0) { run(el); return; }
      if (el) { el.onload = () => { if (!cancelled) run(el); }; return; }
      setTimeout(tryRun, 50);
    };
    tryRun();
    return () => { cancelled = true; };
  }, [uploadedImage]);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setUploadedImage({ url: e.target.result, name: file.name });
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer?.files?.[0];
    handleFileSelect(file);
  }, [handleFileSelect]);

  // Top detection for display (disease classes only)
  const topDetection = detections
    ?.filter(d => d.diseaseKey !== "unknown" && d.diseaseKey !== "healthy")
    .sort((a, b) => b.score - a.score)[0] ?? null;

  return (
    <div className="page-wrapper">
      <div className="upload-page">
        <div className="page-title">Analyze a banana leaf</div>
        <div className="page-subtitle">
          Upload a photo of a diseased leaf or select a demo sample to begin simulation.

          {/* ── Supported conditions strip ── */}
          <div className="upload-conditions-strip">
            <div className="upload-conditions-label">Detectable conditions</div>
            <div className="upload-conditions-chips">
              {[
                { name: "Black Sigatoka", color: "#639922", bg: "#EAF3DE" },
                { name: "Fusarium Wilt TR4", color: "#854F0B", bg: "#FAEEDA" },
                { name: "Healthy leaf", color: "#0F6E56", bg: "#E1F5EE" },
              ].map(({ name, color, bg }) => (
                <span key={name} className="upload-condition-chip" style={{ background: bg, color, borderColor: color + "40" }}>
                  <span className="upload-condition-dot" style={{ background: color }} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>



        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />

        {/* ── Tips for best results ── */}
        <div className="upload-tips-section">
          <div className="upload-tips-heading">Tips for best detection accuracy</div>
          <div className="upload-tips-grid">
            {[
              { icon: Sun, color: "#BA7517", title: "Good lighting", desc: "Diffused natural light — avoid harsh shadows or flash glare on the leaf surface." },
              { icon: Maximize2, color: "#1D9E75", title: "Fill the frame", desc: "The leaf should cover at least 60% of the image area. Avoid busy backgrounds." },
              { icon: Leaf, color: "#639922", title: "Show the margins", desc: "Capture the full leaf including edges — margin chlorosis is key for Fusarium Wilt." },
              { icon: ImageIcon, color: "#3B6D11", title: "JPG · PNG · WEBP", desc: "Max 10 MB · Minimum 640×640 px recommended for YOLOv11 segmentation." },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div className="upload-tip-card" key={title}>
                <div className="upload-tip-icon" style={{ background: color + "1A", color }}>
                  <Icon size={15} />
                </div>
                <div className="upload-tip-title">{title}</div>
                <div className="upload-tip-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Upload zone */}
        {!uploadedImage ? (
          <div
            className={`upload-zone ${drag ? "drag" : ""}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-icon">
              <CloudUpload size={24} color={COLORS.green400} strokeWidth={1.5} />
            </div>
            <div className="upload-title">Tap to upload or take a photo</div>
            <div className="upload-hint">
              <span>Browse files</span> or use your camera
            </div>
            <div className="upload-formats">Supports JPG, PNG, WEBP · Max 10MB</div>
          </div>
        ) : (
          <div className="upload-preview">
            <img ref={imgRef} src={uploadedImage.url} alt={uploadedImage.name} />
            <button
              className="upload-preview-remove"
              onClick={() => { setUploadedImage(null); setDetections(null); setMaskGrid(null); }}
              title="Remove image"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── YOLOv11 Detection result panel ── */}
        {uploadedImage && (
          <div className="detection-card" style={{ marginTop: 16 }}>
            <div className="detection-title">YOLOv11 detection</div>
            {detecting && (
              <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
                Running inference…
              </div>
            )}
            {detectionError && !detecting && (
              <div style={{ fontSize: 13, color: COLORS.red400, padding: "8px 0" }}>
                {detectionError}
              </div>
            )}
            {!detecting && detections && detections.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
                No disease detected above threshold — check image quality.
              </div>
            )}
            {!detecting && detections && detections.length > 0 && (
              <>
                {detections.slice(0, 3).map((d, idx) => (
                  <div className="detection-item" key={idx}>
                    <div className="detection-item-top">
                      <span className="detection-item-name">{d.className.replace(/_/g, " ")}</span>
                      <span className="detection-conf">conf {d.score.toFixed(2)}</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill"
                        style={{ width: `${(d.score * 100).toFixed(0)}%`, background: COLORS.green400 }} />
                    </div>
                  </div>
                ))}
                {topDetection && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                    Auto-selected: <strong style={{ color: "var(--text)" }}>
                      {topDetection.className.replace(/_/g, " ")}
                    </strong>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Environment panel */}
        <div className="env-panel">
          <div className="env-panel-title">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={COLORS.green400} strokeWidth="1.5">
              <circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" />
            </svg>
            Environmental parameters
          </div>
          <div className="env-grid">
            <div className="env-field">
              <label>Temperature (°C)</label>
              <div className="slider-row">
                <input type="range" min={10} max={40} step={1} value={temp}
                  onChange={e => setTemp(+e.target.value)} />
                <span className="env-value">{temp}°C</span>
              </div>
            </div>
            <div className="env-field">
              <label>Relative Humidity (%)</label>
              <div className="slider-row">
                <input type="range" min={20} max={100} step={5} value={rh}
                  onChange={e => setRh(+e.target.value)} />
                <span className="env-value">{rh}%</span>
              </div>
            </div>
            <div className="env-field">
              <label>Plant density</label>
              <select value={density} onChange={e => setDensity(e.target.value)}>
                <option value="low">Low — isolated plants</option>
                <option value="medium">Medium — standard plantation</option>
                <option value="high">High — dense cultivation</option>
              </select>
            </div>
            <div className="env-field">
              <label>Simulation duration (Months)</label>
              <select value={duration} onChange={e => setDuration(e.target.value)}>
                <option value="30">30 months</option>
                <option value="60">60 months</option>
                <option value="90">90 months</option>
              </select>
            </div>
            <div className="env-field">
              <label>Predicted spread rate</label>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: eff.color }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: eff.color }}>{eff.label}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          className="analyze-btn"
          disabled={false}
          onClick={() => {
            const imageData = uploadedImage?.url
              ? uploadedImage.url.split(",")[1] ?? null
              : null;
            setSimConfig({
              disease: selected, temp, rh, density, months: +duration,
              detections: detections ?? null,
              maskGrid: maskGrid ?? null,
              imgWidth: imgRef.current?.naturalWidth ?? null,
              imgHeight: imgRef.current?.naturalHeight ?? null,
              imageData,
            });
            onNavigate("simulation");
          }}
        >
          Run disease simulation →
        </button>

      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  3-D INTERACTIVE LEAF VIEWER  — Three.js + OrbitControls
// ══════════════════════════════════════════════════════════════════════════════
const _LEAF_ROWS = 100, _LEAF_COLS = 160, _TEX = 512;

function LeafViewer3D({ frame, disease }) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const pendingRef = useRef(null); // holds { gridData, intensityData } while scene loads

  const decodeB64 = (b64) => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  const paintCanvas = useCallback((gridData, intensityData, diseaseType) => {
    const s = stateRef.current;
    if (!s) { pendingRef.current = { gridData, intensityData, diseaseType }; return; }
    const { ctx, baseImg, texture } = s;

    ctx.clearRect(0, 0, _TEX, _TEX);
    if (baseImg?.complete && baseImg.naturalWidth > 0)
      ctx.drawImage(baseImg, 0, 0, _TEX, _TEX);

    const gridU8 = typeof gridData === "string" ? decodeB64(gridData) : gridData;
    const intensityU8 = typeof intensityData === "string" ? decodeB64(intensityData) : intensityData;
    // GLTF UV bounds from scene.gltf accessor: U 0.2546–0.7454, V 0.0–1.0
    // The 3D model is rotated to display horizontally, so the mask axes
    // are swapped to align with the on-screen orientation:
    //   SCA cols (c) = leaf LENGTH → texture X (U axis)
    //   SCA rows (r) = leaf WIDTH  → texture Y (V axis)
    const UV_X_MIN = 0.2546, UV_X_RANGE = 0.4908;
    const UV_Y_MIN = 0.0,    UV_Y_RANGE = 1.0;
    const cellW = UV_X_RANGE * _TEX / _LEAF_COLS;
    const cellH = UV_Y_RANGE * _TEX / _LEAF_ROWS;

    for (let r = 0; r < _LEAF_ROWS; r++) {
      for (let c = 0; c < _LEAF_COLS; c++) {
        const idx = r * _LEAF_COLS + c;
        const state = gridU8[idx];
        if (state === 0) continue;

        const iv = intensityU8[idx] / 255;
        const px = (UV_X_MIN + (c / _LEAF_COLS) * UV_X_RANGE) * _TEX;
        const py = (UV_Y_MIN + (r / _LEAF_ROWS) * UV_Y_RANGE) * _TEX;

        let ri, gi, bi, alpha;
        if (state === 1) {
          if (diseaseType === "fusarium_wilt") {
            ri = 225 + iv * (185 - 225); gi = 220 + iv * (120 - 220); bi = 70 + iv * (25 - 70);
          } else {
            ri = 160 + iv * (80 - 160); gi = 140 + iv * (40 - 140); bi = 45 + iv * (10 - 45);
          }
          alpha = 0.50 + 0.45 * iv;
        } else {
          ri = 95 + iv * (25 - 95); gi = 55 + iv * (12 - 55); bi = 18 + iv * (4 - 18);
          alpha = 0.78 + 0.18 * iv;
        }
        ctx.fillStyle = `rgba(${Math.round(ri)},${Math.round(gi)},${Math.round(bi)},${alpha.toFixed(3)})`;
        ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
      }
    }
    texture.needsUpdate = true;
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const W = container.clientWidth || 960;
    const H = container.clientHeight || 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b180b);
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(5, 5, 30);
    scene.add(dir);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 2000);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const canvas2d = document.createElement("canvas");
    canvas2d.width = _TEX;
    canvas2d.height = _TEX;
    const ctx = canvas2d.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas2d);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    const baseImg = new Image();
    baseImg.crossOrigin = "anonymous";
    baseImg.src = "/models/banana_leaf/textures/ganeshlambert4SG_baseColor.png";
    baseImg.onload = () => {
      ctx.drawImage(baseImg, 0, 0, _TEX, _TEX);
      texture.needsUpdate = true;
      // flush any pending disease frame
      if (pendingRef.current) {
        const { gridData, intensityData, diseaseType } = pendingRef.current;
        pendingRef.current = null;
        paintCanvas(gridData, intensityData, diseaseType);
      }
    };

    const loader = new GLTFLoader();
    loader.load("/models/banana_leaf/scene.gltf", (gltf) => {
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: 0.0,
      });
      gltf.scene.traverse((child) => {
        if (child.isMesh) child.material = mat;
      });
      // Rotate 90° around Z so the leaf's long axis (which is vertical in the
      // GLTF file) becomes horizontal on screen, matching a real horizontal leaf photo.
      gltf.scene.rotation.z = -Math.PI / 2;
      scene.add(gltf.scene);

      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      // After rotation the leaf is wider than tall; pull camera back enough to
      // frame the full width and add a slight forward tilt for a 3-D feel.
      const dist = Math.max(size.x, size.y) * 1.6;
      camera.position.set(center.x, center.y + dist * 0.9, center.z + dist * 0.3);
      camera.lookAt(center);
      controls.target.copy(center);
      controls.update();
    });

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight || H;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    stateRef.current = { renderer, scene, camera, controls, texture, ctx, baseImg };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!frame?.gridData) return;
    paintCanvas(frame.gridData, frame.intensityData, disease);
  }, [frame, disease, paintCanvas]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: 480, borderRadius: 8, overflow: "hidden", cursor: "grab" }}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SIMULATION PAGE  — PyVista backend-driven
// ══════════════════════════════════════════════════════════════════════════════
function SimulationPage({ config }) {
  const { disease = "black_sigatoka", temp = 26, rh = 85, density = "medium", months = 30,
    detections = null, maskGrid = null, imgWidth = null, imgHeight = null,
    imageData = null } = config || {};

  // Streamed frames from FastAPI backend  (one per simulated month, 0-30)
  const [frames, setFrames] = useState([]);
  const [simState, setSimState] = useState("loading"); // loading | complete | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [timeStep, setTimeStep] = useState(0);        // index into frames[]
  const [playing, setPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState("leaf");
  const [fieldStats, setFieldStats] = useState(null); // array[31] of {healthy,early,advanced,hi}

  const framesRef = useRef([]);
  const playRef = useRef(null);
  const cancelledRef = useRef(false);
  const hasSavedRef = useRef(false);

  const isFW = disease === "fusarium_wilt";
  const diseaseName = isFW ? "Fusarium Wilt TR4" : "Black Sigatoka";
  const expectedFrames = Math.max(10, Math.round(months * 55 / 30)) + 1;

  const handleRerun = useCallback(() => {
    cancelledRef.current = true;
    clearInterval(playRef.current);
    setTimeout(() => {
      cancelledRef.current = false;
      framesRef.current = [];
      setFrames([]); setTimeStep(0); setPlaying(false); setSimState("loading"); setErrorMsg(null);
      streamSimulation(
        { disease, temp, rh, density, months, detections, maskGrid, imgWidth, imgHeight, imageData },
        (frame) => {
          if (cancelledRef.current) return;
          framesRef.current = [...framesRef.current, frame];
          setFrames([...framesRef.current]);
          setTimeStep(framesRef.current.length - 1);
        },
        () => { if (!cancelledRef.current) setSimState("complete"); },
        (err) => { if (!cancelledRef.current) { setSimState("error"); setErrorMsg(err.message); } }
      );
    }, 50);
  }, [disease, temp, rh, density, detections, maskGrid, imgWidth, imgHeight, imageData]);

  const handlePlayPause = useCallback(() => {
    setPlaying(p => {
      if (!p && timeStep >= frames.length - 1) setTimeStep(0);
      return !p;
    });
  }, [timeStep]);

  // ── Stream simulation frames from FastAPI backend on mount ────────────────
  useEffect(() => {
    cancelledRef.current = false;
    hasSavedRef.current = false;
    framesRef.current = [];
    setFrames([]);
    setTimeStep(0);
    setSimState("loading");
    setErrorMsg(null);

    streamSimulation(
      { disease, temp, rh, density, months, detections, maskGrid, imgWidth, imgHeight, imageData },
      (frame) => {
        if (cancelledRef.current) return;
        framesRef.current = [...framesRef.current, frame];
        setFrames([...framesRef.current]);
        setTimeStep(framesRef.current.length - 1); // auto-advance while streaming
      },
      () => {
        if (cancelledRef.current) return;
        setSimState("complete");
        const lastFrame = framesRef.current[framesRef.current.length - 1];
        if (lastFrame && !hasSavedRef.current) {
          hasSavedRef.current = true;
          saveSimulationLog({
            disease, temp, rh, density,
            finalStats: lastFrame.stats,
            months: framesRef.current.length,
            imageData: imageData ?? null,
            detections: detections ?? null,
            maskGrid: maskGrid ?? null,
            imgWidth: imgWidth ?? null,
            imgHeight: imgHeight ?? null,
          }).catch(() => { });
        }
      },
      (err) => {
        if (!cancelledRef.current) { setSimState("error"); setErrorMsg(err.message); }
      }
    );

    return () => { cancelledRef.current = true; clearInterval(playRef.current); };
  }, []); // run once on mount

  // ── Play-through timer (only after all frames loaded) ─────────────────────
  useEffect(() => {
    clearInterval(playRef.current);
    if (!playing || simState !== "complete") return;
    playRef.current = setInterval(() => {
      setTimeStep(t => {
        if (t >= framesRef.current.length - 1) { setPlaying(false); return t; }
        return t + 1;
      });
    }, 320);
    return () => clearInterval(playRef.current);
  }, [playing, simState]);

  // ── Derived display values from the current frame ─────────────────────────
  const currentFrame = frames[timeStep] ?? frames[frames.length - 1] ?? null;
  const month = currentFrame?.month ?? 0;
  const stats = currentFrame?.stats ?? { infected_pct: 0, necrotic_pct: 0, healthy_pct: 100 };
  const envInfo = currentFrame?.env ?? {};

  const infPct = stats.infected_pct.toFixed(1);
  const necPct = stats.necrotic_pct.toFixed(1);
  const healthyPct = Math.max(0, stats.healthy_pct).toFixed(1);

  const T_OPT = envInfo.T_OPT ?? (isFW ? 27.5 : 27.2);
  const RH_MIN = envInfo.RH_MIN ?? (isFW ? 75 : 70);
  const CT = envInfo.CT ?? 0;
  const CRH = envInfo.CRH ?? 0;
  const E_ENV = envInfo.E_ENV ?? 0;
  const pBase = envInfo.p_base ?? 0;

  // Sparkline histories derived from all streamed frames
  const infHistory = useMemo(() => frames.map(f => f.stats.infected_pct), [frames]);
  const necHistory = useMemo(() => frames.map(f => f.stats.necrotic_pct), [frames]);

  // ── Disease stage ─────────────────────────────────────────────────────────
  // BS severity levels follow the new Standard Area Diagram (SAD) scale
  // (Springer EJPP 2024, doi:10.1007/s10658-024-02917-x) — six quantitative
  // severity ranges: 0–5 % / 5–13 % / 13–23 % / 23–40 % / 40–65 % / 65–100 %
  const BS_STAGES = [
    { num: "I", name: "Initial Specks", range: [0, 3], desc: "SAD Level 1 (0–5 % leaf area). Tiny reddish-brown flecks visible on the abaxial (underside) surface — ascospore germination at epidermal level. Optimal RH ≥90 % accelerates onset (Maxapress 2024)." },
    { num: "II", name: "Pale Streaks", range: [3, 7], desc: "SAD Level 2 (5–13 % leaf area). Dark-brown streaks 2–5 mm parallel to leaf veins, most prominent abaxially. Leaf wetness of 48 h at Topt 27.2 °C enables full ascospore production." },
    { num: "III", name: "Brown Lesions", range: [7, 12], desc: "SAD Level 3 (13–23 % leaf area). Streaks lengthen to 20–30 mm, darkening to brown with expanding yellow chlorotic halos. Lesions now visible on adaxial (upper) surface." },
    { num: "IV", name: "Coalescing Lesions", range: [12, 18], desc: "SAD Level 4 (23–40 % leaf area). Adjacent lesions merge; sunken grey-white necrotic centres form with distinct dark border and yellow halo. Sporulation intensifies." },
    { num: "V", name: "Necrotic Patches", range: [18, 24], desc: "SAD Level 5 (40–65 % leaf area). Large coalesced necrotic patches with fading grey centres and black margin. Photosynthetic capacity severely compromised; yield losses begin." },
    { num: "VI", name: "Necrotic Collapse", range: [24, 31], desc: "SAD Level 6 (65–100 % leaf area). Systemic necrosis — leaf tissue collapses and desiccates. Up to 90 % yield loss reported (Maxapress 2024). Functional photosynthetic area effectively lost." },
  ];
  // FW phases grounded in: MDPI Agronomy 2021 (Venezuelan FW agro-environmental
  // factors) and Frontiers Plant Sci 2019 (FW epidemiology)
  const FW_PHASES = [
    { num: "I", name: "Root Invasion", range: [0, 5], desc: "Foc TR4 chlamydospores germinate in root exudates, penetrate lateral roots, and colonise xylem vessels. No visible foliar symptoms yet; internal vascular discolouration begins in pseudostem." },
    { num: "II", name: "Marginal Chlorosis", range: [5, 12], desc: "Yellowing appears FIRST at the MARGINS of the oldest, outermost leaves — the tissues furthest from the xylem supply. Incubation: 2–5 months after root infection (Agronomy 2021). Leaf margins turn bright yellow then orange-brown." },
    { num: "III", name: "Pseudostem Wilt", range: [12, 20], desc: "Chlorosis advances from margins inward toward the midrib. Internal reddish-brown vascular streaking visible in pseudostem cross-section. Wilting progresses from outer to inner leaves; plant unable to maintain turgor." },
    { num: "IV", name: "Crown Rot Collapse", range: [20, 31], desc: "Total collapse — all leaves wilt and the pseudostem rots at the crown. No viable vascular or leaf tissue remains. Soil inoculum (chlamydospores) persists >5 years with no known chemical cure (Frontiers 2019)." },
  ];
  const stageList = isFW ? FW_PHASES : BS_STAGES;
  const stageType = isFW ? "Phase" : "Stage";
  const stage = stageList.find(s => month >= s.range[0] && month < s.range[1]) ?? stageList[stageList.length - 1];
  const STAGE_COLORS = { "I": COLORS.green400, "II": COLORS.amber400, "III": "#BA5500", "IV": COLORS.red400, "V": COLORS.red400, "VI": COLORS.red400 };
  const stageColor = STAGE_COLORS[stage.num] ?? COLORS.green400;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-wrapper">
      <div className="sim-page">

        {/* Header */}
        <div className="sim-header">
          <div>
            <div className="page-title">{diseaseName} progression</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <span className={`tag ${isFW ? "tag-fusarium" : "tag-sigatoka"}`}>{diseaseName}</span>
              <span className="tag" style={{ background: "var(--bg2)", color: "var(--text-muted)" }}>
                {infPct}% infected
              </span>
              {simState === "loading" && (
                <span className="tag" style={{ background: COLORS.teal50, color: COLORS.teal600, display: "flex", alignItems: "center", gap: 4 }}>
                  <Loader size={10} style={{ animation: "spin 1s linear infinite" }} />
                  Loading {frames.length}/{expectedFrames}
                </span>
              )}
              {simState === "complete" && (
                <span className="tag" style={{ background: COLORS.green50, color: COLORS.green600 }}>
                  PyVista · 3D
                </span>
              )}
            </div>
          </div>
          <div className="sim-header-right" />
        </div>

        <div className="sim-grid">
          {/* ── Main viewer ── */}
          <div>
            <div className="tabs">
              {[["leaf", "3D Leaf (PyVista)"], ["field", "Field spread"]].map(([t, label]) => (
                <button key={t} className={`tab ${activeTab === t ? "active" : ""}`}
                  onClick={() => setActiveTab(t)}>{label}</button>
              ))}
              {activeTab === "leaf" && (
                <button
                  className="play-btn"
                  style={{ marginLeft: "auto" }}
                  disabled={simState !== "complete"}
                  onClick={handlePlayPause}
                >
                  {playing ? <Pause size={12} /> : <Play size={12} />}
                  {playing ? "Pause" : "Play"}
                </button>
              )}
            </div>

            <div className="sim-viewer">
              <div className="sim-canvas-wrap" style={{
                position: "relative",
                minHeight: activeTab === "field" ? 0 : 480,
                background: activeTab === "field" ? "transparent" : "#0C1A0C",
                borderRadius: 8,
              }}>
                {activeTab === "leaf" ? (
                  <>
                    {/* Interactive 3-D leaf viewer */}
                    {simState !== "error" ? (
                      <LeafViewer3D frame={currentFrame} disease={disease} />
                    ) : (
                      <div style={{ padding: 32, textAlign: "center" }}>
                        <div style={{ fontSize: 13, color: COLORS.red400, marginBottom: 10 }}>
                          Backend unreachable
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
                          {errorMsg}
                          <br />
                          Start the backend:<br />
                          <code style={{ fontSize: 11, background: "var(--bg2)", padding: "2px 6px", borderRadius: 4 }}>
                            cd backend &amp;&amp; uvicorn main:app --reload
                          </code>
                        </div>
                      </div>
                    )}

                    {/* Initial loading overlay (no frames yet) */}
                    {simState === "loading" && !currentFrame && simState !== "error" && (
                      <div style={{
                        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        background: "rgba(11,24,11,0.72)", backdropFilter: "blur(4px)", borderRadius: 8,
                        color: "var(--text-muted)", fontSize: 13, gap: 10,
                      }}>
                        <Loader size={20} style={{ animation: "spin 1s linear infinite" }} />
                        <div>Computing SCA simulation…</div>
                      </div>
                    )}

                    {/* Progress badge while streaming */}
                    {simState === "loading" && currentFrame && (
                      <div style={{
                        position: "absolute", bottom: 8, right: 10, fontSize: 11,
                        background: "rgba(0,0,0,0.55)", color: "#acd", borderRadius: 4,
                        padding: "2px 8px", backdropFilter: "blur(4px)",
                      }}>
                        Computing… {frames.length}/{expectedFrames}
                      </div>
                    )}
                  </>
                ) : (
                  <FieldView
                    disease={disease}
                    timeStep={month}
                    envFactor={E_ENV > 0 ? Math.min(1.5, E_ENV * 1.3) : (rh >= 80 && temp >= 25 ? 1.4 : 0.8)}
                    temp={temp}
                    months={months}
                    onStatsUpdate={setFieldStats}
                    playing={playing}
                    onPlayPause={handlePlayPause}
                    onRerun={handleRerun}
                  />
                )}
              </div>

              {/* Loading progress bar */}
              {simState === "loading" && (
                <div style={{ marginTop: 6 }}>
                  <div className="progress-bar-bg">
                    <motion.div
                      className="progress-bar-fill"
                      animate={{ width: `${(frames.length / expectedFrames) * 100}%` }}
                      transition={{ duration: 0.4 }}
                      style={{ background: COLORS.teal400 }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    <span>SCA + PyVista rendering</span>
                    <span>{frames.length} / {expectedFrames} frames</span>
                  </div>
                </div>
              )}

              {/* Time slider */}
              <div className="time-slider-wrap" style={{ marginTop: simState === "loading" ? 6 : 12 }}>
                <div className="time-slider-label">
                  <span>Month 0</span>
                  <strong>Month {month}</strong>
                  <span>Month {months}</span>
                </div>
                <input
                  type="range" className="time-slider"
                  min={0} max={Math.max(0, frames.length - 1)} step={1}
                  value={Math.min(timeStep, Math.max(0, frames.length - 1))}
                  disabled={frames.length === 0}
                  onChange={e => { setPlaying(false); setTimeStep(+e.target.value); }}
                />
              </div>

              {/* Toolbar */}
              <div className="sim-toolbar">
                <div className="sim-toolbar-left">
                  <span className="time-label">Month</span>
                  <span className="time-value">{month} / {months}</span>
                  <span className="time-label" style={{ marginLeft: 8, color: COLORS.teal400, fontSize: 11 }}>
                    {simState === "loading" ? "streaming…" : "PyVista 3D"}
                  </span>
                </div>
                <div className="sim-toolbar-right">
                  {activeTab === "leaf" && (
                    <button className="icon-btn" title="Re-run simulation" onClick={handleRerun}>
                      <RefreshCcw size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Disease spread over time */}
            <div className="metrics-card" style={{ marginTop: 12 }}>
              <div className="metrics-card-title">Disease spread over time</div>
              {activeTab === "field" && fieldStats ? (
                <>
                  <FieldSparkline data={fieldStats} timeStep={month} months={months} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8 }}>
                    {[
                      { color: "#4a9020", label: "Healthy" },
                      { color: "#c4b010", label: "Early" },
                      { color: "#f07818", label: "Advanced" },
                      { color: "#cc1212", label: "Highly advanced" },
                    ].map(({ color, label }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                        <div style={{ width: 12, height: 3, borderRadius: 2, background: color }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <SimSparkline
                    infData={infHistory}
                    necData={necHistory}
                    timeStep={timeStep}
                    months={months}
                    infColor={isFW ? "#BA7517" : "#639922"}
                  />
                  <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                      <div style={{ width: 12, height: 3, borderRadius: 2, background: isFW ? "#BA7517" : "#639922" }} />
                      Infected %
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                      <div style={{ width: 12, height: 3, borderRadius: 2, background: "#5F5E5A" }} />
                      Necrotic %
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="sim-sidebar">
            {/* Leaf health metrics / Field health breakdown */}
            <div className="metrics-card">
              {activeTab === "field" && fieldStats ? (() => {
                const s = fieldStats[Math.min(month, fieldStats.length - 1)];
                return (
                  <>
                    <div className="metrics-card-title">Field health — Month {month}</div>
                    {[
                      { label: "Healthy", val: s.healthy, color: "#4a9020", cls: "good" },
                      { label: "Early infection", val: s.early, color: "#c4b010", cls: s.early > 20 ? "warn" : "" },
                      { label: "Advanced", val: s.advanced, color: "#f07818", cls: s.advanced > 10 ? "warn" : "" },
                      { label: "Highly advanced", val: s.hi, color: "#cc1212", cls: s.hi > 5 ? "bad" : "" },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className="metric-row">
                        <span className="metric-name">{label}</span>
                        <span className={`metric-val ${cls}`}>{val}%</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 14 }}>
                      <div className="progress-bar-bg">
                        <div style={{ display: "flex", height: 5 }}>
                          <div className="progress-bar-fill" style={{ width: s.healthy + "%", background: "#4a9020" }} />
                          <div className="progress-bar-fill" style={{ width: s.early + "%", background: "#c4b010" }} />
                          <div className="progress-bar-fill" style={{ width: s.advanced + "%", background: "#f07818" }} />
                          <div className="progress-bar-fill" style={{ width: s.hi + "%", background: "#cc1212" }} />
                        </div>
                      </div>
                      <div className="legend" style={{ marginTop: 10 }}>
                        <div className="legend-item"><div className="legend-dot" style={{ background: "#4a9020" }} />Healthy</div>
                        <div className="legend-item"><div className="legend-dot" style={{ background: "#c4b010" }} />Early</div>
                        <div className="legend-item"><div className="legend-dot" style={{ background: "#f07818" }} />Advanced</div>
                        <div className="legend-item"><div className="legend-dot" style={{ background: "#cc1212" }} />Highly adv.</div>
                      </div>
                    </div>
                  </>
                );
              })() : (
                <>
                  <div className="metrics-card-title">Leaf health metrics</div>
                  {[
                    { label: "Healthy tissue", val: healthyPct + "%", cls: "good" },
                    { label: "Infected area", val: infPct + "%", cls: parseFloat(infPct) > 30 ? "bad" : "warn" },
                    { label: "Necrotic area", val: necPct + "%", cls: parseFloat(necPct) > 20 ? "bad" : "warn" },
                  ].map(({ label, val, cls }) => (
                    <div key={label} className="metric-row">
                      <span className="metric-name">{label}</span>
                      <span className={`metric-val ${cls}`}>{val}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 14 }}>
                    <div className="progress-bar-bg">
                      <div style={{ display: "flex", height: 5 }}>
                        <div className="progress-bar-fill" style={{ width: healthyPct + "%", background: COLORS.green200 }} />
                        <div className="progress-bar-fill" style={{ width: infPct + "%", background: COLORS.amber100 }} />
                        <div className="progress-bar-fill" style={{ width: necPct + "%", background: COLORS.gray400 }} />
                      </div>
                    </div>
                    <div className="legend" style={{ marginTop: 10 }}>
                      <div className="legend-item"><div className="legend-dot" style={{ background: COLORS.green200 }} />Healthy</div>
                      <div className="legend-item"><div className="legend-dot" style={{ background: COLORS.amber100 }} />Infected</div>
                      <div className="legend-item"><div className="legend-dot" style={{ background: COLORS.gray400 }} />Necrotic</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Disease progression stage — leaf tab only */}
            {activeTab === "leaf" && <div className="metrics-card">
              <div className="metrics-card-title">Disease progression stage</div>
              <div className="stage-badge-row">
                <motion.div
                  className="stage-badge" key={stage.num}
                  initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ borderColor: stageColor, color: stageColor }}
                >
                  {stageType} {stage.num}
                </motion.div>
                <AnimatePresence mode="wait">
                  <motion.div key={stage.num} className="stage-name" style={{ color: stageColor }}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.25 }}>
                    {stage.name}
                  </motion.div>
                </AnimatePresence>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={stage.num} className="stage-desc"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}>
                  {stage.desc}
                </motion.div>
              </AnimatePresence>
              <div className="stage-track">
                <motion.div className="stage-fill" initial={false}
                  animate={{ width: `${Math.max(2, (month / months) * 100)}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: stageColor }} />
              </div>
              <div className="stage-track-labels">
                <span>Month 0</span><span>Month {month}</span><span>Month {months}</span>
              </div>
            </div>}

            {/* Simulation parameters + env factors */}
            <div className="env-display">
              <div className="env-display-title">Simulation parameters</div>
              {[
                { label: "Temperature", val: `${temp}°C  (T_opt ${T_OPT}°C)` },
                { label: "Relative humidity", val: `${rh}%  (onset ≥${RH_MIN}%)` },
                { label: "Plant density", val: density },
                { label: "Disease model", val: isFW ? "Marginal-lateral spread (FW)" : "σ-β Longitudinal (BS)" },
                { label: "Neighbourhood", val: "Moore 8-cell" },
                { label: "Engine", val: "Python SCA + PyVista" },
              ].map(({ label, val }) => (
                <div className="env-row" key={label}>
                  <span className="env-row-label">{label}</span>
                  <span className="env-row-val">{val}</span>
                </div>
              ))}
              <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
              {[
                { label: `CT  [β-poly, Topt=${T_OPT}°C]`, val: CT.toFixed(3) },
                { label: `CRH [onset ≥${RH_MIN}% RH]`, val: CRH.toFixed(3) },
                { label: "E_ENV = CT × CRH", val: E_ENV.toFixed(3), hi: true },
                { label: "p_base (scaled)", val: pBase.toFixed(5) },
              ].map(({ label, val, hi }) => (
                <div className="env-row" key={label}>
                  <span className="env-row-label">{label}</span>
                  <span className="env-row-val" style={hi ? { color: "var(--green-mid)", fontWeight: 600 } : {}}>{val}</span>
                </div>
              ))}
            </div>

            {/* YOLOv11 detection card */}
            <div className="detection-card">
              <div className="detection-title">YOLOv11 detection</div>
              {detections && detections.length > 0 ? (
                <>
                  {detections.slice(0, 3).map((d, i) => (
                    <div className="detection-item" key={i}>
                      <div className="detection-item-top">
                        <span className="detection-item-name">{d.className.replace(/_/g, " ")}</span>
                        <span className="detection-conf">conf {d.score.toFixed(2)}</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill"
                          style={{ width: `${(d.score * 100).toFixed(0)}%`, background: COLORS.green400 }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, fontSize: 11, color: COLORS.green400, fontWeight: 500 }}>
                    Phase 1: seeds from detection bbox
                  </div>
                </>
              ) : (
                <>
                  <div className="detection-item">
                    <div className="detection-item-top">
                      <span className="detection-item-name">{diseaseName}</span>
                      <span className="detection-conf">demo mode</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: "100%", background: COLORS.gray200 }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: COLORS.gray400 }}>
                    Phase 1: anatomical default seeds
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
//  ABOUT PAGE
// ══════════════════════════════════════════════════════════════════════════════
function AboutPage() {
  return (
    <div className="page-wrapper">
      <div className="about-page">

        {/* ── Key research metrics banner ── */}
        <div className="about-metrics-banner">
          {[
            { icon: ScanSearch, value: "91.4%", label: "Mask mAP@50", sub: "YOLOv11-seg on test set" },
            { icon: BarChart3, value: "30 mo", label: "Disease simulation", sub: "Months modelled per run" },
            { icon: FlaskConical, value: "2", label: "Disease models", sub: "Black Sigatoka + Fusarium" },
            { icon: Users, value: "4", label: "Research team", sub: "BS Computer Science · FEU" },
          ].map(({ icon: Icon, value, label, sub }, i) => (
            <motion.div
              className="about-metric-card"
              key={label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="about-metric-icon"><Icon size={18} /></div>
              <div className="about-metric-value">{value}</div>
              <div className="about-metric-label">{label}</div>
              <div className="about-metric-sub">{sub}</div>
            </motion.div>
          ))}
        </div>

        <FadeIn delay={0.05}>
          <div className="about-section">
            <h3>Technology stack</h3>
            <div style={{ marginTop: 8 }}>
              {["YOLOv11-seg", "Stochastic Cellular Automata", "PyVista (3D)", "CLAHE + Gamma Correction",
                "FastAPI", "React", "AdamW optimizer", "ISO-25010", "Moore 8-cell neighborhood"].map(t => (
                  <span className="tech-pill" key={t}>{t}</span>
                ))}
            </div>
          </div>
        </FadeIn>


        <FadeIn delay={0.08}>
          <div className="about-section about-team-banner">
            <img src="/Nautilizers-banner.png" alt="Nautilizers banner" className="about-team-banner-img" />
            <div className="about-team-banner-row">
              <img src="/Nautilizers.png" alt="Nautilizers" className="about-team-logo" />
              <div className="about-team-intro">
                <h3>Nautilizers</h3>
                <p>
                  Nautilizers is a student research group from FEU Institute of Technology composed of
                  four BS Computer Science students dedicated to building technology-driven solutions for
                  real-world agricultural challenges. S-Aging is the group's undergraduate thesis project,
                  combining machine learning and simulation to address banana leaf disease spread in
                  Mindanao's Cavendish farming communities.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>


        <FadeIn delay={0.1}>
          <div className="about-section">
            <h3>Research team</h3>
            <div className="team-grid">
              {[
                { name: "Justine Gabriel P. Rodriguez", role: "BS Computer Science", focus: "Project Manager", avatar: "/avatar-justine.png", linkedin: "https://www.linkedin.com/in/justine-gabriel-rodriguez/" },
                { name: "Jimiel D. Balitayo", role: "BS Computer Science", focus: "Researcher & Front-end", avatar: "/avatar-jimiel.png", linkedin: "https://www.linkedin.com/in/jimiel-balitayo/" },
                { name: "Darryl B. Baranda", role: "BS Computer Science", focus: "Researcher & Quality Testing", avatar: "/avatar-darryl.png", linkedin: "https://www.linkedin.com/in/darryl-baranda/" },
                { name: "Yoel Dwayne G. Reyes", role: "BS Computer Science", focus: "Main Programmer, ML, & UI/UX", avatar: "/avatar-yoel.png", linkedin: "https://www.linkedin.com/in/yoel-dwayne-reyes-9720b0308/" },

              ].map(({ name, role, focus, avatar, linkedin }) => {
                const initials = name.split(" ").map(p => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join("");
                return (
                  <motion.div
                    className="team-card"
                    key={name}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-30px" }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="team-avatar">
                      <img src={avatar} alt={name} onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }} />
                      <span style={{ display: "none" }}>{initials}</span>
                    </div>
                    <div className="team-name">{name}</div>
                    <div className="team-role">{role}</div>
                    <div className="team-focus">{focus}</div>
                    <a
                      className="team-linkedin"
                      href={linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${name} on LinkedIn`}
                      onClick={e => { if (linkedin === "#") e.preventDefault(); }}
                    >
                      <ExternalLink size={13} />
                      LinkedIn
                    </a>
                  </motion.div>
                );
              })}
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              Thesis Mentor: <strong style={{ color: "var(--text)" }}>Mr. Anthony D. Aquino</strong>
              &nbsp;·&nbsp; FEU Institute of Technology, March 2026
            </div>
          </div>
        </FadeIn>


        <FadeIn delay={0.15}>
          <div className="about-section">
            <h3>Evaluation metrics</h3>
            <p>The system is evaluated using detection performance metrics (Mask mAP, Precision, Recall)
              and simulation accuracy metrics (Intersection over Union and Structural Similarity Index Measure).
              Software quality is assessed under ISO-25010 across Functionality Suitability, Performance
              Efficiency, Interaction Capability, Maintainability, and Security.
            </p>
          </div>
        </FadeIn>

        {/* ── ISO-25010 quality pillars ── */}
        <FadeIn delay={0.2}>
          <div className="about-section">
            <h3 style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BookOpen size={18} style={{ color: "var(--green-400)" }} /> ISO-25010 Quality Pillars
              <a
                href="https://iso25000.com/index.php/en/iso-25000-standards/iso-25010"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 500, padding: "3px 10px",
                  borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border-secondary)",
                  color: "var(--text-muted)", textDecoration: "none",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--green-400)"; e.currentTarget.style.borderColor = "var(--green-400)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--color-border-secondary)"; }}
              >
                <ExternalLink size={11} /> ISO standard
              </a>
            </h3>
            <div className="about-iso-grid">
              {[
                { pillar: "Functional Suitability", desc: "The degree to which a product provides functions that meet stated and implied needs — covering functional completeness, correctness, and appropriateness." },
                { pillar: "Performance Efficiency", desc: "Performance relative to the amount of resources used under stated conditions, including time behavior, resource utilization, and capacity." },
                { pillar: "Interaction Capability", desc: "The degree to which a product can be used by specified users to achieve goals with effectiveness, efficiency, and satisfaction in a specified context of use." },
                { pillar: "Maintainability", desc: "The degree of effectiveness and efficiency with which a product can be modified to improve it, correct it, or adapt it to changes in environment and requirements." },
                { pillar: "Security", desc: "The degree to which a product protects information and data so that persons or systems have data access appropriate to their type and level of authorization." },
              ].map(({ pillar, desc }, i) => (
                <motion.div
                  className="about-iso-card"
                  key={pillar}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="about-iso-header">
                    <CheckCircle2 size={14} style={{ color: "var(--green-400)", flexShrink: 0 }} />
                    <span className="about-iso-pillar">{pillar}</span>
                  </div>
                  <div className="about-iso-desc">{desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════════════════════════════════════
export default function SAgingApp() {
  const [page, setPage] = useState("home");
  const [simConfig, setSimConfig] = useState({ disease: "black_sigatoka", temp: 26, rh: 85, density: "medium", detections: null, maskGrid: null });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("saging-theme") || "light");
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem("saging-reduce-motion") === "true");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("saging-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("saging-reduce-motion", reduceMotion);
  }, [reduceMotion]);

  // ── Auth state ─────────────────────────────────────────────────────────
  // Single credential: Supabase JWT (session.access_token). Auth-service validates it on each request.
  // status: "loading" | "unauthenticated" | "ready"
  const [auth, setAuth] = useState({
    status: "loading",
    session: null,
    error: null,
  });

  // Bootstrap from Supabase + subscribe to auth changes
  useEffect(() => {
    // Clean up legacy custom-token storage from older auth model
    try { localStorage.removeItem("s_aging_session_token"); } catch { /* ignore */ }

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuth({
        status: data.session ? "ready" : "unauthenticated",
        session: data.session,
        error: null,
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({
        status: session ? "ready" : "unauthenticated",
        session,
        error: null,
      });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setAuth({ status: "unauthenticated", session: null, error: null });
  }, []);

  // Warm up ONNX session as soon as the app loads
  useEffect(() => { warmupSession(); }, []);

  // Scroll to top on navigation
  const navigate = useCallback((p) => {
    setPage(p);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (auth.status === "loading") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8F7F4" }}>
      <LoaderCircle size={24} style={{ animation: "spin 1s linear infinite", color: "#639922" }} />
    </div>
  );

  if (auth.status === "unauthenticated") return (
    <AuthPage
      initialNotice={auth.error}
      onAuth={(session) => setAuth({ status: "ready", session, error: null })}
    />
  );

  return (
    <div className="saging-app">
      <nav className="nav">
        <div className="nav-logo" onClick={() => navigate("home")}>
          <div className="nav-logo-mark">
            <img src="/Nautilizers.png" alt="Nautilizers" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <span className="nav-logo-text">S-Aging</span>
        </div>

        <div className="nav-links">
          {[
            ["home", "Home", <Hexagon size={14} />],
            ["upload", "Analyze", <ScanEye size={14} />],
            ["simulation", "Simulate", <Orbit size={14} />],
            ["about", "About", <Scroll size={14} />],
            ["profile", "Profile", <Fingerprint size={14} />],
          ].map(([p, label, icon]) => (
            <button key={p} className={`nav-link ${page === p ? "active" : ""}`} onClick={() => navigate(p)}>
              <span className="nav-link-icon">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        <button className="nav-cta" onClick={() => navigate("upload")}>
          <Atom size={13} style={{ marginRight: 5, verticalAlign: "middle" }} />
          Start simulation
        </button>

        <button
          onClick={handleLogout}
          title={`Logged in as ${auth.session?.user?.email}`}
          className="nav-logout-btn"
        >
          <DoorOpen size={13} />
          Log out
        </button>

        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(o => !o)}>
          <Menu size={20} />
        </button>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="nav-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              className="nav-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
            >
              <div className="nav-drawer-top">
                <div className="nav-logo" onClick={() => navigate("home")} style={{ gap: 8 }}>
                  <div className="nav-logo-mark" style={{ width: 28, height: 28 }}>
                    <img src="/Nautilizers.png" alt="Nautilizers" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                  <span className="nav-logo-text" style={{ fontSize: 16 }}>S-Aging</span>
                </div>
                <button className="nav-drawer-close" onClick={() => setMobileMenuOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="nav-drawer-links">
                {[
                  ["home", "Home", <Hexagon size={16} />],
                  ["upload", "Analyze", <ScanEye size={16} />],
                  ["simulation", "Simulate", <Orbit size={16} />],
                  ["about", "About", <Scroll size={16} />],
                  ["profile", "Profile", <Fingerprint size={16} />],
                ].map(([p, label, icon]) => (
                  <button key={p} className={`nav-drawer-link ${page === p ? "active" : ""}`} onClick={() => navigate(p)}>
                    <span className="nav-link-icon" style={{ opacity: 1 }}>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>

              <div className="nav-drawer-footer">
                <button className="nav-cta" style={{ width: "100%", justifyContent: "center", padding: "12px" }} onClick={() => navigate("upload")}>
                  <Atom size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Start simulation
                </button>
                <button
                  onClick={handleLogout}
                  title={`Logged in as ${auth.session?.user?.email}`}
                  className="nav-logout-btn"
                  style={{ width: "100%", justifyContent: "center", padding: "11px 12px" }}
                >
                  <DoorOpen size={14} />
                  Log out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {!reduceMotion && <Antigravity visible={["home", "about", "profile"].includes(page)} />}

      {!reduceMotion && ["upload", "simulation"].includes(page) && (
        <div className="banana-swatch-bg" aria-hidden="true">
          <div className="banana-swatch-inner" />
        </div>
      )}

      {page === "home" && <HomePage onNavigate={navigate} reduceMotion={reduceMotion} />}
      {page === "upload" && <UploadPage onNavigate={navigate} setSimConfig={setSimConfig} />}
      {page === "simulation" && <SimulationPage config={simConfig} />}
      {page === "about" && <AboutPage />}
      {page === "profile" && <ProfilePage auth={auth} onLogout={handleLogout} onNavigate={navigate} setSimConfig={setSimConfig} theme={theme} setTheme={setTheme} reduceMotion={reduceMotion} setReduceMotion={setReduceMotion} />}

      <footer className="footer">
        <span>S-Aging · FEU Institute of Technology · 2026</span>
        <div className="footer-logos">
          <img src="/ISO.png" alt="ISO 25010" className="footer-logo" />
          <img src="/Nautilizers.png" alt="Nautilizers" className="footer-logo" />
          <img src="/Tech.png" alt="FEU Tech" className="footer-logo" />
        </div>
        <span>BS Computer Science — Software Engineering</span>
      </footer>
    </div>
  );
}
