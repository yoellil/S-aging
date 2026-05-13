import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FlaskConical, AlertTriangle, ShieldCheck, Leaf } from "lucide-react";

// ── Scenario content ──────────────────────────────────────────────────────────
const EARLY_TIPS = [
  {
    icon: <ShieldCheck size={16} />,
    title: "Clean Your Tools",
    body: "Early signs of disease have been detected. Before moving to the next plant, wipe all cutting tools with rubbing alcohol (isopropyl alcohol, 70%) or a bleach-and-water mix (1 part bleach to 9 parts water). This stops the disease from hitching a ride to healthy plants.",
  },
  {
    icon: <Leaf size={16} />,
    title: "Apply a Protective Spray",
    body: "Coat healthy plant parts — especially new leaves and the base of the main stem (pseudostem) — with a protective fungicide such as copper spray or mancozeb. Think of it as sunscreen for the plant: it sits on the surface and blocks disease spores from getting in.",
  },
  {
    icon: <AlertTriangle size={16} />,
    title: "Monitor Weather Conditions",
    body: "Record the daily temperature and air humidity. Disease spreads much faster when humidity stays above 70% (for Black Sigatoka) or above 75% (for Fusarium Wilt TR4). Use these readings as your signal to spray or take action before the disease gets worse.",
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
      },
      {
        icon: <FlaskConical size={16} />,
        title: "Destroy the Plant Where It Stands",
        body: "Once the weed killer has taken effect (wait 48–72 hours), chop the plant down on the spot and cover all the pieces with a thick layer of quicklime (about 15 cm). Do not carry plant parts to another area — digging up the underground base (corm) can scatter long-lasting disease spores (chlamydospores) into clean soil nearby.",
      },
      {
        icon: <ShieldCheck size={16} />,
        title: "Disinfect Tools and Footwear",
        body: "Soak all cutting tools in bleach solution (1 part bleach to 19 parts water) for 30 minutes. Scrub boots with soap, then step through a disinfectant footbath (10% bleach) before leaving the area. Note the exact location on a map and report to the farm manager right away.",
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
      },
      {
        icon: <AlertTriangle size={16} />,
        title: "Lay Cut Leaves Face-Down",
        body: "Place the removed leaves upside-down (spore side facing the soil) directly below the plant. This stops disease spores from being picked up by the wind and landing on healthy leaves. Spread them flat — do not stack or pile them up.",
      },
      {
        icon: <FlaskConical size={16} />,
        title: "Spray Remaining Healthy Leaves",
        body: "Apply a deep-acting fungicide (systemic triazole) — such as propiconazole or tebuconazole — to the still-healthy leaves as a leaf spray (foliar spray), mixed at 2 mL per liter of water. On your next spray cycle, switch to a different fungicide type (e.g., strobilurins) so the disease does not become resistant to one product.",
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
      },
      {
        icon: <FlaskConical size={16} />,
        title: "Rotate Your Fungicide Sprays",
        body: "Follow a 4-spray schedule, always switching between different fungicide types to slow down resistance (following FRAC resistance guidelines): rotate deep-acting fungicide group 3 (DMI), group 11 (strobilurins), and group 7 (SDHI) in turn. Spray in the early morning when wind is calm, and wait at least 21 days between each round of deep-acting sprays.",
      },
      {
        icon: <ShieldCheck size={16} />,
        title: "Feed the Plants to Boost Resistance",
        body: "Mix potassium sulfate (K₂SO₄) at 3 kg per hectare into your regular fungicide spray. Banana plants with high potassium levels are naturally tougher against Black Sigatoka. Also add calcium and boron to your fertilizer routine to help strengthen the outer walls of plant cells.",
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
      },
      {
        icon: <FlaskConical size={16} />,
        title: "Treat Nearby Plants with Protective Microbes",
        body: "Water the root zone (rhizosphere) of nearby healthy plants with a solution of a beneficial soil fungus called Trichoderma harzianum — apply about 5 liters per plant. This helpful fungus naturally competes with and blocks the Fusarium disease fungus (Foc TR4) in the soil. Repeat this treatment once a month for 3 months.",
      },
      {
        icon: <ShieldCheck size={16} />,
        title: "Replant with Disease-Resistant Varieties",
        body: "Let the soil rest for at least 12 months before replanting. When you do replant, choose only banana varieties that can resist TR4, such as GCTCV-219, Goldfinger, or wild-cross hybrids (Musa balbisiana). Keep clear records of which areas were replanted so they can be watched closely over time.",
      },
    ],
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────
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

function TipCard({ step, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 16px",
        background: "var(--bg)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--radius-md)",
        marginBottom: 8,
      }}
    >
      <div style={{
        flexShrink: 0,
        width: 30,
        height: 30,
        borderRadius: 8,
        background: "var(--green-light)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--green)",
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

// ── Main component ────────────────────────────────────────────────────────────
export default function ExplainabilityDashboard({ disease, month, simMode, timeStep, maxStep, months, onSeek, disabled }) {
  const isFW = disease === "fusarium_wilt";
  const diseaseKey = isFW ? "fusarium" : "sigatoka";

  const isEarlyOnset = month <= 10;

  const scenarioKey = useMemo(() => {
    const mode = simMode === "plantation" ? "plantation" : "single";
    return `${mode}-${diseaseKey}`;
  }, [simMode, diseaseKey]);

  const scenario = SCENARIOS[scenarioKey];

  const stateColor = isEarlyOnset
    ? "var(--teal-400)"
    : scenario.severity === "critical" ? "var(--red-400)" : "var(--amber-400)";
  const stateBg = isEarlyOnset
    ? "var(--teal-50)"
    : scenario.severity === "critical" ? "var(--red-50)" : "var(--amber-50)";
  const borderColor = isEarlyOnset
    ? "var(--teal-100)"
    : scenario.severity === "critical" ? "var(--red-100)" : "var(--amber-100)";

  // Derive display metrics from actual sim month (non-linear curves)
  const t = Math.max(0, Math.min(1, month / 30));
  const necrotic = Math.round(100 * Math.pow(t, 1.8));
  const healthy  = Math.round(100 * Math.pow(1 - t, 1.2));
  const infected = Math.max(0, 100 - necrotic - healthy);

  const stageLabel = isEarlyOnset ? "Early Onset — Monitoring" : "Advanced Stage — Active Intervention";
  const diseaseName = isFW ? "Fusarium Wilt TR4" : "Black Sigatoka";
  const modeName = simMode === "plantation" ? "Plantation (2D Field)" : "Single Plant (3D Leaf)";

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
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--green)",
        }}>
          <FlaskConical size={14} />
        </div>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Diagnostic &amp; Management Tips</span>
          <span className="explain-header-badge" style={{
            marginLeft: 8, fontSize: 11, color: "var(--text-muted)",
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: 99, padding: "1px 8px",
          }}>
            {diseaseName} · {modeName} · Month {month}
          </span>
        </div>
      </div>

      {/* Duplicate time slider — same state as the main viewer slider */}
      <div style={{
        background: "var(--bg2)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "12px 16px",
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
          <span>Month 0</span>
          <strong style={{ color: "var(--text)" }}>Month {month}</strong>
          <span>Month {months}</span>
        </div>
        <input
          type="range"
          className="time-slider"
          min={0}
          max={maxStep}
          step={1}
          value={Math.min(timeStep, maxStep)}
          disabled={disabled}
          onChange={e => onSeek(+e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div className="explain-grid">

        {/* Metrics panel */}
        <div style={{
          background: "var(--bg2)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
            Health estimate
          </div>
          <MetricBar label="Healthy"  value={healthy}  color="#639922" />
          <MetricBar label="Infected" value={infected} color="#BA7517" />
          <MetricBar label="Necrotic" value={necrotic} color="#E24B4A" />
          <div style={{
            marginTop: 14,
            padding: "10px 12px",
            background: stateBg,
            borderRadius: "var(--radius-sm)",
            borderLeft: `3px solid ${stateColor}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: stateColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isEarlyOnset ? "Early Onset" : "Advanced Stage"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Month {month} · {necrotic}% necrosis
            </div>
          </div>
        </div>

        {/* Tips card */}
        <div style={{
          background: "var(--bg2)",
          border: `1.5px solid ${borderColor}`,
          borderRadius: "var(--radius-md)",
          padding: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{
              padding: "3px 10px",
              borderRadius: 99,
              background: stateBg,
              color: stateColor,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {(isEarlyOnset ? EARLY_TIPS : scenario.steps).map((step, i) => (
                <TipCard key={i} step={step} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>

          {!isEarlyOnset && (
            <div style={{
              padding: "9px 12px",
              background: "var(--bg3)",
              borderRadius: "var(--radius-sm)",
              fontSize: 11,
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}>
              <strong style={{ color: "var(--text)" }}>Note:</strong> Recommendations are generated from S-Aging simulation outputs and validated agronomic literature. Consult a licensed plant pathologist before implementing eradication measures.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
