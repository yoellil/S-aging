import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FlaskConical, AlertTriangle, ShieldCheck, Leaf, RotateCcw, Loader, PlayCircle } from "lucide-react";

// ── Scenario content ──────────────────────────────────────────────────────────
const EARLY_TIPS = [
  {
    icon: <ShieldCheck size={16} />,
    title: "Clean Your Tools",
    body: "Early signs of disease have been detected. Before moving to the next plant, wipe all cutting tools with rubbing alcohol (isopropyl alcohol, 70%) or a bleach-and-water mix (1 part bleach to 9 parts water). This stops the disease from hitching a ride to healthy plants.",
    reduction: 0.35,
  },
  {
    icon: <Leaf size={16} />,
    title: "Apply a Protective Spray",
    body: "Coat healthy plant parts — especially new leaves and the base of the main stem (pseudostem) — with a protective fungicide such as copper spray or mancozeb. Think of it as sunscreen for the plant: it sits on the surface and blocks disease spores from getting in.",
    reduction: 0.45,
  },
  {
    icon: <AlertTriangle size={16} />,
    title: "Monitor Weather Conditions",
    body: "Record the daily temperature and air humidity. Disease spreads much faster when humidity stays above 70% (for Black Sigatoka) or above 75% (for Fusarium Wilt TR4). Use these readings as your signal to spray or take action before the disease gets worse.",
    reduction: 0.20,
  },
];

const SCENARIOS = {
  "single-fusarium": {
    label: "Single Plant · Fusarium Wilt TR4 — Active Eradication",
    severity: "critical",
    steps: [
      {
        icon: <AlertTriangle size={16} />,
        title: "Kill the Plant at the Source",
        body: "Inject 10 mL of weed killer (glyphosate) directly into the main stem (pseudostem) about 30 cm from the ground. This shuts down the plant's internal water and food channels and stops the underground base (corm) from releasing more disease spores. Mark the spot and do not replant for at least 6 months.",
        reduction: 0.65,
      },
      {
        icon: <FlaskConical size={16} />,
        title: "Destroy the Plant Where It Stands",
        body: "Once the weed killer has taken effect (wait 48–72 hours), chop the plant down on the spot and cover all the pieces with a thick layer of quicklime (about 15 cm). Do not carry plant parts to another area — digging up the underground base (corm) can scatter long-lasting disease spores (chlamydospores) into clean soil nearby.",
        reduction: 0.45,
      },
      {
        icon: <ShieldCheck size={16} />,
        title: "Disinfect Tools and Footwear",
        body: "Soak all cutting tools in bleach solution (1 part bleach to 19 parts water) for 30 minutes. Scrub boots with soap, then step through a disinfectant footbath (10% bleach) before leaving the area. Note the exact location on a map and report to the farm manager right away.",
        reduction: 0.25,
      },
    ],
  },
  "single-sigatoka": {
    label: "Single Plant · Black Sigatoka — Sanitation Protocol",
    severity: "warning",
    steps: [
      {
        icon: <Leaf size={16} />,
        title: "Remove Infected Leaves",
        body: "Find and cut off all leaves with Stage 3 or worse damage — look for dark brown streaks that have merged into large dead (necrotic) patches. Cut at the leaf stalk base (petiole), as close to the main stem (pseudostem) as possible. Always use a clean blade and avoid cutting through the middle of the leaf.",
        reduction: 0.45,
      },
      {
        icon: <AlertTriangle size={16} />,
        title: "Lay Cut Leaves Face-Down",
        body: "Place the removed leaves upside-down (spore side facing the soil) directly below the plant. This stops disease spores from being picked up by the wind and landing on healthy leaves. Spread them flat — do not stack or pile them up.",
        reduction: 0.30,
      },
      {
        icon: <FlaskConical size={16} />,
        title: "Spray Remaining Healthy Leaves",
        body: "Apply a deep-acting fungicide (systemic triazole) — such as propiconazole or tebuconazole — to the still-healthy leaves as a leaf spray (foliar spray), mixed at 2 mL per liter of water. On your next spray cycle, switch to a different fungicide type (e.g., strobilurins) so the disease does not become resistant to one product.",
        reduction: 0.50,
      },
    ],
  },
  "plantation-sigatoka": {
    label: "Plantation · Black Sigatoka — Integrated Field Strategy",
    severity: "warning",
    steps: [
      {
        icon: <Leaf size={16} />,
        title: "Thin Out Shoots and Leaves",
        body: "Cut off all young side shoots (suckers) that are shorter than 1 meter to open up the space between plants and let air flow through. Keep no more than 3 healthy leaves per plant at a time. Leaf-removal teams should always move in one direction across the rows so they do not carry disease spores back into areas they already cleaned.",
        reduction: 0.35,
      },
      {
        icon: <FlaskConical size={16} />,
        title: "Rotate Your Fungicide Sprays",
        body: "Follow a 4-spray schedule, always switching between different fungicide types to slow down resistance (following FRAC resistance guidelines): rotate deep-acting fungicide group 3 (DMI), group 11 (strobilurins), and group 7 (SDHI) in turn. Spray in the early morning when wind is calm, and wait at least 21 days between each round of deep-acting sprays.",
        reduction: 0.55,
      },
      {
        icon: <ShieldCheck size={16} />,
        title: "Feed the Plants to Boost Resistance",
        body: "Mix potassium sulfate (K₂SO₄) at 3 kg per hectare into your regular fungicide spray. Banana plants with high potassium levels are naturally tougher against Black Sigatoka. Also add calcium and boron to your fertilizer routine to help strengthen the outer walls of plant cells.",
        reduction: 0.30,
      },
    ],
  },
  "plantation-fusarium": {
    label: "Plantation · Fusarium Wilt TR4 — Containment & Replanting",
    severity: "critical",
    steps: [
      {
        icon: <AlertTriangle size={16} />,
        title: "Seal Off the Infected Area",
        body: "As soon as disease is confirmed, dig a trench around the outbreak area (10 meters out from the sick plants, 50 cm deep, 30 cm wide) and fill it with quicklime. Put up clear warning signs around the zone. Set up one entry-and-exit cleaning station where all workers and equipment must be disinfected with a bleach footbath before passing through.",
        reduction: 0.55,
      },
      {
        icon: <FlaskConical size={16} />,
        title: "Treat Nearby Plants with Protective Microbes",
        body: "Water the root zone (rhizosphere) of nearby healthy plants with a solution of a beneficial soil fungus called Trichoderma harzianum — apply about 5 liters per plant. This helpful fungus naturally competes with and blocks the Fusarium disease fungus (Foc TR4) in the soil. Repeat this treatment once a month for 3 months.",
        reduction: 0.40,
      },
      {
        icon: <ShieldCheck size={16} />,
        title: "Replant with Disease-Resistant Varieties",
        body: "Let the soil rest for at least 12 months before replanting. When you do replant, choose only banana varieties that can resist TR4, such as GCTCV-219, Goldfinger, or wild-cross hybrids (Musa balbisiana). Keep clear records of which areas were replanted so they can be watched closely over time.",
        reduction: 0.25,
      },
    ],
  },
};

// ── ChecklistItem ─────────────────────────────────────────────────────────────
function ChecklistItem({ step, index, checked, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      onClick={onToggle}
      style={{
        display: "flex",
        gap: 12,
        padding: "11px 14px",
        background: checked ? "rgba(99,153,34,0.08)" : "var(--bg)",
        border: `1.5px solid ${checked ? "var(--green)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        marginBottom: 6,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        userSelect: "none",
      }}
    >
      {/* Checkbox */}
      <div style={{
        flexShrink: 0, width: 18, height: 18, marginTop: 3,
        borderRadius: 4,
        border: `2px solid ${checked ? "var(--green)" : "var(--border)"}`,
        background: checked ? "var(--green)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 3.5L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Icon */}
      <div style={{
        flexShrink: 0, width: 26, height: 26, borderRadius: 6,
        background: checked ? "rgba(99,153,34,0.12)" : "var(--bg2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: checked ? "var(--green)" : "var(--text-muted)",
        transition: "all 0.15s",
      }}>
        {step.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: checked ? "var(--green)" : "var(--text)", transition: "color 0.15s" }}>
            {step.title}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
            background: checked ? "var(--green)" : "var(--bg3)",
            color: checked ? "#fff" : "var(--text-muted)",
            transition: "all 0.15s", whiteSpace: "nowrap",
          }}>
            −{Math.round(step.reduction * 100)}% spread
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{step.body}</div>
      </div>
    </motion.div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function CategoryHeader({ label, color, bg }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
      color, background: bg, borderRadius: 99, padding: "3px 10px",
      display: "inline-block", marginBottom: 10,
    }}>
      {label}
    </div>
  );
}

// ── Read-only tip card (no checkbox) ─────────────────────────────────────────
function TipCard({ step, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex", gap: 12, padding: "14px 16px",
        background: "var(--bg)", border: "1.5px solid var(--border)",
        borderRadius: "var(--radius-md)", marginBottom: 8,
      }}
    >
      <div style={{
        flexShrink: 0, width: 30, height: 30, borderRadius: 8,
        background: "var(--green-light)", display: "flex",
        alignItems: "center", justifyContent: "center", color: "var(--green)",
      }}>
        {step.icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>{step.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.65 }}>{step.body}</div>
      </div>
    </motion.div>
  );
}

function MetricBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, fontWeight: 500 }}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{value}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "var(--bg3)", overflow: "hidden" }}>
        <motion.div
          style={{ height: "100%", borderRadius: 99, background: color }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

// ── 3D Leaf: read-only diagnostic tips panel ──────────────────────────────────
export function DiagnosticTipsPanel({ disease, month, simMode, timeStep, maxStep, months, onSeek, disabled }) {
  const isFW = disease === "fusarium_wilt";
  const diseaseKey = isFW ? "fusarium" : "sigatoka";
  const isEarlyOnset = month <= 10;
  const scenarioKey = `${simMode === "plantation" ? "plantation" : "single"}-${diseaseKey}`;
  const scenario = SCENARIOS[scenarioKey] ?? SCENARIOS["single-sigatoka"];

  const stateColor = isEarlyOnset ? "var(--teal-400)" : scenario.severity === "critical" ? "var(--red-400)" : "var(--amber-400)";
  const stateBg    = isEarlyOnset ? "var(--teal-50)"   : scenario.severity === "critical" ? "var(--red-50)"  : "var(--amber-50)";
  const borderColor = isEarlyOnset ? "var(--teal-100)" : scenario.severity === "critical" ? "var(--red-100)" : "var(--amber-100)";

  const t = Math.max(0, Math.min(1, month / 30));
  const necrotic = Math.round(100 * Math.pow(t, 1.8));
  const healthy  = Math.round(100 * Math.pow(1 - t, 1.2));
  const infected = Math.max(0, 100 - necrotic - healthy);

  const stageLabel  = isEarlyOnset ? "Early Onset — Monitoring" : "Advanced Stage — Active Intervention";
  const diseaseName = isFW ? "Fusarium Wilt TR4" : "Black Sigatoka";
  const modeName    = simMode === "plantation" ? "Plantation (2D Field)" : "Single Plant (3D Leaf)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginTop: 20 }}
    >
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, var(--green-50), var(--teal-50))",
          border: "1.5px solid var(--green-100)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--green)",
        }}>
          <FlaskConical size={14} />
        </div>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Diagnostic &amp; Management Tips</span>
          <span style={{
            marginLeft: 8, fontSize: 11, color: "var(--text-muted)",
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: 99, padding: "1px 8px",
          }}>
            {diseaseName} · {modeName} · Month {month}
          </span>
        </div>
      </div>

      {/* Time slider */}
      <div style={{
        background: "var(--bg2)", border: "1.5px solid var(--border)",
        borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
          <span>Month 0</span>
          <strong style={{ color: "var(--text)" }}>Month {month}</strong>
          <span>Month {months}</span>
        </div>
        <input
          type="range" className="time-slider"
          min={0} max={maxStep} step={1}
          value={Math.min(timeStep, maxStep)}
          disabled={disabled}
          onChange={e => onSeek(+e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div className="explain-grid">
        {/* Metrics */}
        <div style={{
          background: "var(--bg2)", border: "1.5px solid var(--border)",
          borderRadius: "var(--radius-md)", padding: "16px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
            Health estimate
          </div>
          <MetricBar label="Healthy"  value={healthy}  color="#639922" />
          <MetricBar label="Infected" value={infected} color="#BA7517" />
          <MetricBar label="Necrotic" value={necrotic} color="#E24B4A" />
          <div style={{
            marginTop: 14, padding: "10px 12px", background: stateBg,
            borderRadius: "var(--radius-sm)", borderLeft: `3px solid ${stateColor}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: stateColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isEarlyOnset ? "Early Onset" : "Advanced Stage"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Month {month} · {necrotic}% necrosis
            </div>
          </div>
        </div>

        {/* Tips */}
        <div style={{
          background: "var(--bg2)", border: `1.5px solid ${borderColor}`,
          borderRadius: "var(--radius-md)", padding: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{
              padding: "3px 10px", borderRadius: 99, background: stateBg,
              color: stateColor, fontSize: 10, fontWeight: 700,
              letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              {stageLabel}
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
            {isEarlyOnset ? "General Early Intervention Protocol" : scenario.label}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={isEarlyOnset ? "early" : scenarioKey}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {(isEarlyOnset ? EARLY_TIPS : scenario.steps).map((step, i) => (
                <TipCard key={i} step={step} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
          {!isEarlyOnset && (
            <div style={{
              padding: "9px 12px", background: "var(--bg3)",
              borderRadius: "var(--radius-sm)", fontSize: 11,
              color: "var(--text-muted)", lineHeight: 1.6,
            }}>
              <strong style={{ color: "var(--text)" }}>Note:</strong> Recommendations are generated from S-Aging simulation outputs and validated agronomic literature. Consult a licensed plant pathologist before implementing eradication measures.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component (field checklist) ──────────────────────────────────────────
export default function ExplainabilityDashboard({
  disease, scenarioKey,
  checkedEarly, onToggleEarly,
  checkedLate,  onToggleLate,
  onResimulate, onReset, simState,
}) {
  const isFW = disease === "fusarium_wilt";
  const scenario = SCENARIOS[scenarioKey] ?? SCENARIOS["single-sigatoka"];
  const isCritical = scenario.severity === "critical";

  const MAX_PREVENTION = 0.70;
  const earlyReduction = EARLY_TIPS.reduce((s, step, i) => checkedEarly.has(i) ? s + step.reduction : s, 0);
  const lateReduction  = scenario.steps.reduce((s, step, i) => checkedLate.has(i)  ? s + step.reduction  : s, 0);
  const rawReduction   = earlyReduction + lateReduction;
  const preventionFactor = Math.min(rawReduction, MAX_PREVENTION);
  const preventionPct    = Math.round(preventionFactor * 100);
  const anyChecked = checkedEarly.size > 0 || checkedLate.size > 0;
  const isResimulating = simState === "loading";

  const handleReset = () => {
    onReset();
    onResimulate(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginTop: 20 }}
    >
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, var(--green-50), var(--teal-50))",
          border: "1.5px solid var(--green-100)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--green)",
        }}>
          <FlaskConical size={14} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          Diagnostic &amp; Management — Prevention Checklist
        </span>
      </div>

      <div style={{
        background: "var(--bg2)",
        border: `1.5px solid ${anyChecked ? "var(--green)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        padding: "18px",
        transition: "border-color 0.2s",
      }}>

        {/* ── Early Prevention ── */}
        <CategoryHeader label="Early Prevention" color="var(--teal-400, #2dd4bf)" bg="var(--teal-50, rgba(45,212,191,0.10))" />
        <div style={{ marginBottom: 18 }}>
          {EARLY_TIPS.map((step, i) => (
            <ChecklistItem
              key={i} step={step} index={i}
              checked={checkedEarly.has(i)}
              onToggle={() => onToggleEarly(i)}
            />
          ))}
        </div>

        {/* ── Late Stage Prevention ── */}
        <CategoryHeader
          label={isCritical ? "Late Stage — Critical Intervention" : "Late Stage — Active Intervention"}
          color={isCritical ? "var(--red-400, #f87171)" : "var(--amber-400, #fbbf24)"}
          bg={isCritical ? "rgba(248,113,113,0.10)" : "rgba(251,191,36,0.10)"}
        />
        <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginTop: -4, marginBottom: 10 }}>
          {scenario.label}
        </div>
        <div style={{ marginBottom: 14 }}>
          {scenario.steps.map((step, i) => (
            <ChecklistItem
              key={i} step={step} index={i}
              checked={checkedLate.has(i)}
              onToggle={() => onToggleLate(i)}
            />
          ))}
        </div>

        {/* ── Prevention Impact ── */}
        <AnimatePresence>
          {anyChecked && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                overflow: "hidden",
                background: "linear-gradient(135deg, rgba(99,153,34,0.10), rgba(34,113,34,0.06))",
                border: "1.5px solid var(--green)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)" }}>Estimated spread reduction</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--green)" }}>−{preventionPct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "var(--bg3)", overflow: "hidden" }}>
                <motion.div
                  animate={{ width: `${(preventionPct / 90) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: "100%", borderRadius: 99, background: "var(--green)" }}
                />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 5 }}>
                Max 70% · {rawReduction > MAX_PREVENTION ? "Capped at 70%" : `${Math.round((MAX_PREVENTION - preventionFactor) * 100)}% remaining`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Buttons ── */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onResimulate(preventionFactor)}
            disabled={!anyChecked || isResimulating}
            style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)", border: "none",
              background: anyChecked && !isResimulating ? "var(--green)" : "var(--bg3)",
              color: anyChecked && !isResimulating ? "#fff" : "var(--text-muted)",
              fontSize: 12, fontWeight: 700,
              cursor: anyChecked && !isResimulating ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}
          >
            {isResimulating
              ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Simulating…</>
              : <><PlayCircle size={14} /> Resimulate</>}
          </button>
          <button
            onClick={handleReset}
            disabled={!anyChecked || isResimulating}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1.5px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text-muted)",
              fontSize: 12, fontWeight: 600,
              cursor: anyChecked && !isResimulating ? "pointer" : "not-allowed",
              opacity: anyChecked && !isResimulating ? 1 : 0.4,
              transition: "all 0.15s",
            }}
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>
    </motion.div>
  );
}
