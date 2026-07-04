/* ==========================================================================
   Gym Planner - לוגיקת אפליקציה
   מחולל תוכניות, ניווט, מעקב אימונים וטיימר מנוחה. Vanilla JS, ללא תלויות.
   ========================================================================== */
"use strict";

/* ----------------------------- מילונים ----------------------------- */
const MUSCLE_LABELS = {
  chest: "חזה", back: "גב", shoulders: "כתפיים", quads: "ארבע ראשי",
  hamstrings: "ירך אחורי", glutes: "עכוז", biceps: "יד קדמית",
  triceps: "יד אחורית", core: "בטן / ליבה", calves: "שוקיים",
};

const EQUIP_LABELS = {
  machine: "מכשיר", free: "משקל חופשי", cable: "כבל", bodyweight: "משקל גוף",
};

const LEVEL_LABELS = { beginner: "מתחיל", intermediate: "בינוני", advanced: "מתקדם" };
const LEVEL_RANK = { beginner: 1, intermediate: 2, advanced: 3 };

/* מטרות: סטים, טווח חזרות ומנוחה מבוססי-מחקר */
const GOALS = {
  strength:    { label: "כוח",                 sets: 4, reps: "4-6",   restSec: 150 },
  hypertrophy: { label: "בניית שריר",           sets: 4, reps: "8-12",  restSec: 75  },
  toning:      { label: "חיטוב וירידה במשקל",   sets: 3, reps: "12-20", restSec: 40  },
  general:     { label: "כושר כללי",            sets: 3, reps: "10-12", restSec: 75  },
};

/* ------------------------ תבניות פיצול (Splits) ------------------------ */
/* כל יום: שם + קבוצות שריר עם מספר תרגילים בסיסי */
const DAYS = {
  fullA: { name: "גוף מלא A", groups: [ ["chest",1],["back",1],["quads",1],["shoulders",1],["biceps",1],["core",1] ] },
  fullB: { name: "גוף מלא B", groups: [ ["back",1],["chest",1],["hamstrings",1],["glutes",1],["triceps",1],["calves",1] ] },
  fullC: { name: "גוף מלא C", groups: [ ["quads",1],["back",1],["shoulders",1],["chest",1],["biceps",1],["triceps",1],["core",1] ] },
  push:  { name: "דחיפה (חזה/כתף/יד אחורית)", groups: [ ["chest",2],["shoulders",2],["triceps",2] ] },
  pull:  { name: "משיכה (גב/יד קדמית)",       groups: [ ["back",3],["shoulders",1],["biceps",2] ] },
  legs:  { name: "רגליים",                     groups: [ ["quads",2],["hamstrings",1],["glutes",1],["calves",1],["core",1] ] },
  upper: { name: "פלג גוף עליון",              groups: [ ["chest",2],["back",2],["shoulders",1],["biceps",1],["triceps",1] ] },
  lower: { name: "פלג גוף תחתון",              groups: [ ["quads",2],["hamstrings",1],["glutes",1],["calves",1],["core",1] ] },
};

/* בחירת פיצול לפי מספר ימים ורמה */
function pickSplit(days, level) {
  const beginner = level === "beginner";
  switch (days) {
    case 2: return ["fullA", "fullB"];
    case 3: return beginner ? ["fullA", "fullB", "fullC"] : ["push", "pull", "legs"];
    case 4: return ["upper", "lower", "upper", "lower"];
    case 5: return ["push", "pull", "legs", "upper", "lower"];
    case 6: return ["push", "pull", "legs", "push", "pull", "legs"];
    default: return ["fullA", "fullB", "fullC"];
  }
}

/* ------------------------- מחולל התוכנית ------------------------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* התמקדות: קבוצת פוקוס → קבוצות שריר */
const FOCUS_TO_MUSCLES = {
  arms: ["biceps", "triceps"], shoulders: ["shoulders"], back: ["back"],
  chest: ["chest"], legs: ["quads", "hamstrings", "glutes", "calves"], core: ["core"],
};
function expandFocus(focus) {
  const set = new Set();
  (focus || []).forEach((f) => { if (f !== "all" && FOCUS_TO_MUSCLES[f]) FOCUS_TO_MUSCLES[f].forEach((m) => set.add(m)); });
  return set;
}

/* מגבלות/פציעות → תרגילים להימנע מהם */
const CONTRAINDICATED = {
  knee: ["q_barbell_squat", "q_lunges", "q_bulgarian_squat", "q_step_up", "g_reverse_lunge", "q_hack_squat", "q_pendulum_squat"],
  shoulder: ["sh_ohp", "chest_barbell_bench", "sh_upright_row", "t_dips", "back_pullup", "sh_arnold"],
  back: ["h_deadlift", "h_good_morning", "back_barbell_row", "back_tbar_row", "q_barbell_squat", "back_extension"],
};
function blockedByLimitations(limitations) {
  const set = new Set();
  (limitations || []).forEach((l) => { if (CONTRAINDICATED[l]) CONTRAINDICATED[l].forEach((id) => set.add(id)); });
  return set;
}

function generatePlan(config) {
  const { goal, days, level } = config;
  const goalDef = GOALS[goal];
  const splitKeys = pickSplit(days, level);
  const setsPerExercise = Math.max(2, goalDef.sets - (level === "beginner" ? 1 : 0));

  const allowedEq = (config.equipment && config.equipment.length) ? config.equipment
    : ["machine", "free", "cable", "bodyweight"];
  const focusMuscles = expandFocus(config.focus);
  const blocked = blockedByLimitations(config.limitations);

  /* מעקב אחרי תרגילים שנבחרו לכל שריר, כדי לגוון בין ימים חוזרים */
  const usedByMuscle = {};

  const plan = splitKeys.map((key, dayIdx) => {
    const template = DAYS[key];
    const exercises = [];

    template.groups.forEach(([muscle, baseCount]) => {
      // התמקדות: +תרגיל אחד לשריר שנבחר
      const count = focusMuscles.has(muscle) ? baseCount + 1 : baseCount;

      const eqOk = (ex) => allowedEq.includes(ex.equipment) && !blocked.has(ex.id);
      let pool = EXERCISES.filter((ex) => ex.muscle === muscle && LEVEL_RANK[ex.level] <= LEVEL_RANK[level] && eqOk(ex));
      if (pool.length === 0) pool = EXERCISES.filter((ex) => ex.muscle === muscle && eqOk(ex)); // הרפיית רמה
      if (pool.length === 0) pool = EXERCISES.filter((ex) => ex.muscle === muscle && !blocked.has(ex.id)); // הרפיית ציוד
      if (pool.length === 0) pool = EXERCISES.filter((ex) => ex.muscle === muscle); // גיבוי אחרון
      // העדף תרגילים שטרם נבחרו לשריר זה השבוע
      const used = usedByMuscle[muscle] || new Set();
      const fresh = pool.filter((ex) => !used.has(ex.id));
      const ordered = shuffle(fresh).concat(shuffle(pool.filter((ex) => used.has(ex.id))));

      for (let i = 0; i < count && i < ordered.length; i++) {
        const ex = ordered[i];
        used.add(ex.id);
        exercises.push({
          id: ex.id,
          name: ex.name,
          muscle: ex.muscle,
          equipment: ex.equipment,
          instructions: ex.instructions,
          tip: ex.tip,
          secondary: ex.secondary || [],
          sets: setsPerExercise,
          reps: goalDef.reps,
          restSec: goalDef.restSec,
        });
      }
      usedByMuscle[muscle] = used;
    });

    return { key, name: template.name, index: dayIdx, exercises };
  });

  return {
    config,
    goalLabel: config.goalLabel || goalDef.label,
    restSec: goalDef.restSec,
    createdAt: new Date().toISOString(),
    days: plan,
    volume: computeVolume(plan),
  };
}

/* חישוב נפח שבועי (סטים) לכל קבוצת שריר.
   שריר ראשי = סט מלא; שריר משני = חצי סט (ספירת נפח עקיף, מקובל במחקר). */
function computeVolume(days) {
  const vol = {};
  days.forEach((d) => d.exercises.forEach((ex) => {
    vol[ex.muscle] = (vol[ex.muscle] || 0) + ex.sets;
    (ex.secondary || []).forEach((m) => { vol[m] = (vol[m] || 0) + ex.sets * 0.5; });
  }));
  Object.keys(vol).forEach((m) => { vol[m] = Math.round(vol[m]); });
  return vol;
}

/* ----------------------------- אחסון ----------------------------- */
const STORE_PLAN = "gymPlan_v1";
const STORE_PROGRESS = "gymProgress_v1";

function savePlan(plan) { localStorage.setItem(STORE_PLAN, JSON.stringify(plan)); }
function loadPlan() { try { return JSON.parse(localStorage.getItem(STORE_PLAN)); } catch { return null; } }
function loadProgress() { try { return JSON.parse(localStorage.getItem(STORE_PROGRESS)) || {}; } catch { return {}; } }
function saveProgress(p) { localStorage.setItem(STORE_PROGRESS, JSON.stringify(p)); }
function progKey(dayIdx, exId) { return `${dayIdx}::${exId}`; }

/* ----------------------------- מצב ----------------------------- */
const DEFAULT_ONB = {
  focus: [], goal: "build_muscle", level: "beginner", days: 3,
  equipment: ["machine", "free", "cable", "bodyweight"], limitations: ["none"],
  age: "", weight: "",
};
let state = {
  onb: { ...DEFAULT_ONB },
  step: 0,
  plan: null,
  activeDay: 0,
  progress: {},
};

/* ----------------------------- DOM helpers ----------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

/* SVG icon set (Lucide-style, ללא אימוג'י) */
const ICONS = {
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4"/><path d="M12 14v-4"/><circle cx="12" cy="14" r="8"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V2h12v7"/><path d="M6 14h12v8H6z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
  fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
};

/* ============================ אונבורדינג / שאלון ============================ */
const FOCUS_GROUPS = [
  { key: "chest", label: "חזה", view: "front", regions: ["chest"] },
  { key: "back", label: "גב", view: "back", regions: ["back"] },
  { key: "shoulders", label: "כתפיים", view: "front", regions: ["shoulders"] },
  { key: "arms", label: "ידיים", view: "front", regions: ["arms"] },
  { key: "legs", label: "רגליים", view: "front", regions: ["legs"] },
  { key: "core", label: "בטן", view: "front", regions: ["abs"] },
  { key: "all", label: "כל הגוף", view: "front", regions: ["all"] },
];

const GOAL_OPTIONS = [
  { key: "lose_weight", label: "ירידה במשקל", desc: "שריפת שומן וסיבולת", icon: () => ICONS.fire },
  { key: "build_muscle", label: "העלאת מסת שריר", desc: "היפרטרופיה ובניית שריר", icon: () => ICONS.dumbbell },
  { key: "tone", label: "חיטוב הגוף", desc: "עיצוב, חיזוק והגדרה", icon: () => ICONS.spark },
  { key: "strength", label: "כוח", desc: "הרמת משקלים כבדים", icon: () => ICONS.chart },
];
const GOAL_MAP = { lose_weight: "toning", build_muscle: "hypertrophy", tone: "general", strength: "strength" };

const EQUIP_OPTIONS = [
  { key: "machine", label: "מכשירים" }, { key: "free", label: "משקולות חופשיות" },
  { key: "cable", label: "כבלים" }, { key: "bodyweight", label: "משקל גוף" },
];
const LIMITATION_OPTIONS = [
  { key: "none", label: "אין מגבלות" }, { key: "knee", label: "ברך" },
  { key: "shoulder", label: "כתף" }, { key: "back", label: "גב תחתון" },
];

function levelNote(level) {
  return {
    beginner: "מתחיל: דגש על מכשירים, נפח מתון ולמידת טכניקה בטוחה.",
    intermediate: "בינוני: שילוב מכשירים ומשקולות חופשיות, נפח מלא.",
    advanced: "מתקדם: פיצולים, תרגילים מורכבים ונפח גבוה.",
  }[level];
}

/* --- דיאגרמות גוף (SVG מסוגנן) --- */
const BODY_BASE = "#5C5942", BODY_HL = "#C8E85B";
function bodyDiagram(g) { const a = new Set(g.regions); return g.view === "back" ? bodyBack(a) : bodyFront(a); }
function bodyFront(a) {
  const on = (r) => (a.has(r) || a.has("all")) ? BODY_HL : BODY_BASE;
  return `<svg viewBox="0 0 120 210" width="100%" height="100%" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <circle cx="60" cy="20" r="13" fill="${BODY_BASE}"/><rect x="54" y="30" width="12" height="9" rx="3" fill="${BODY_BASE}"/>
    <ellipse cx="33" cy="53" rx="12" ry="9" fill="${on("shoulders")}"/><ellipse cx="87" cy="53" rx="12" ry="9" fill="${on("shoulders")}"/>
    <rect x="40" y="50" width="18" height="20" rx="5" fill="${on("chest")}"/><rect x="62" y="50" width="18" height="20" rx="5" fill="${on("chest")}"/>
    <rect x="21" y="56" width="12" height="27" rx="6" fill="${on("arms")}"/><rect x="87" y="56" width="12" height="27" rx="6" fill="${on("arms")}"/>
    <rect x="22" y="85" width="10" height="24" rx="5" fill="${on("arms")}"/><rect x="88" y="85" width="10" height="24" rx="5" fill="${on("arms")}"/>
    <rect x="45" y="72" width="30" height="34" rx="6" fill="${on("abs")}"/><rect x="44" y="107" width="32" height="13" rx="5" fill="${BODY_BASE}"/>
    <rect x="45" y="121" width="14" height="42" rx="7" fill="${on("legs")}"/><rect x="61" y="121" width="14" height="42" rx="7" fill="${on("legs")}"/>
    <rect x="46" y="165" width="12" height="34" rx="6" fill="${on("legs")}"/><rect x="62" y="165" width="12" height="34" rx="6" fill="${on("legs")}"/>
  </svg>`;
}
function bodyBack(a) {
  const on = (r) => (a.has(r) || a.has("all")) ? BODY_HL : BODY_BASE;
  return `<svg viewBox="0 0 120 210" width="100%" height="100%" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <circle cx="60" cy="20" r="13" fill="${BODY_BASE}"/><rect x="54" y="30" width="12" height="9" rx="3" fill="${BODY_BASE}"/>
    <rect x="42" y="46" width="36" height="20" rx="7" fill="${on("back")}"/>
    <rect x="42" y="68" width="15" height="20" rx="5" fill="${on("back")}"/><rect x="63" y="68" width="15" height="20" rx="5" fill="${on("back")}"/>
    <rect x="21" y="56" width="12" height="27" rx="6" fill="${BODY_BASE}"/><rect x="87" y="56" width="12" height="27" rx="6" fill="${BODY_BASE}"/>
    <rect x="44" y="90" width="32" height="16" rx="5" fill="${BODY_BASE}"/><rect x="44" y="108" width="32" height="14" rx="6" fill="${on("glutes")}"/>
    <rect x="45" y="123" width="14" height="40" rx="7" fill="${on("hamstrings")}"/><rect x="61" y="123" width="14" height="40" rx="7" fill="${on("hamstrings")}"/>
    <rect x="46" y="165" width="12" height="34" rx="6" fill="${BODY_BASE}"/><rect x="62" y="165" width="12" height="34" rx="6" fill="${BODY_BASE}"/>
  </svg>`;
}

/* --- הגדרת שלבים --- */
const STEP_META = [
  null,
  { title: "במה תרצה להתמקד?", sub: "בחר קבוצה אחת או יותר", render: renderFocus, valid: () => state.onb.focus.length > 0, hint: "בחר לפחות קבוצה אחת" },
  { title: "מה המטרה שלך?", sub: "נתאים את הסטים והחזרות", render: renderGoal, valid: () => !!state.onb.goal },
  { title: "מה רמת הניסיון?", sub: "", render: renderLevel, valid: () => !!state.onb.level },
  { title: "כמה ימים בשבוע?", sub: "", render: renderDays, valid: () => !!state.onb.days },
  { title: "איזה ציוד זמין לך?", sub: "בחר את מה שיש במכון שלך", render: renderEquip, valid: () => state.onb.equipment.length > 0, hint: "בחר לפחות סוג ציוד אחד" },
  { title: "יש מגבלות או פציעות?", sub: "נתאים את התרגילים בהתאם", render: renderLimits, valid: () => true },
  { title: "פרטים אישיים", sub: "רשות — לחישוב מדויק יותר", render: renderDetails, valid: () => true },
  { title: "המידע והנתונים שלך", sub: "סיכום לפני יצירת התוכנית", render: renderSummary, valid: () => true, isSummary: true },
];
const LAST_STEP = STEP_META.length - 1;

function renderOnboarding() {
  const root = $("#app");
  root.innerHTML = "";
  if (state.step === 0) { root.appendChild(renderIntro()); return; }
  const meta = STEP_META[state.step];
  const pct = Math.round((state.step / LAST_STEP) * 100);
  const counter = meta.isSummary ? "סיכום" : `שאלה ${state.step} מתוך ${LAST_STEP - 1}`;
  root.appendChild(el("div", { class: "onb" }, [
    el("div", { class: "onb-head" }, [
      progressRing(pct),
      el("div", { class: "onb-head-txt" }, [
        el("span", { class: "onb-counter", text: counter }),
        el("h1", { class: "onb-title", text: meta.title }),
        meta.sub ? el("p", { class: "onb-sub", text: meta.sub }) : null,
      ]),
    ]),
    el("div", { class: "onb-body" }, meta.render()),
    renderNav(meta),
  ]));
}

function progressRing(pct) {
  const r = 26, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  const wrap = el("div", { class: "ring" });
  wrap.innerHTML = `<svg viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--muted)" stroke-width="6"/>
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--primary)" stroke-width="6" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 32 32)"/>
  </svg><span class="ring-pct">${pct}%</span>`;
  return wrap;
}

function renderNav(meta) {
  const back = el("button", { class: "btn-ghost onb-back", onclick: () => { state.step--; renderOnboarding(); } },
    [el("span", { html: ICONS.arrowRight }), el("span", { text: "הקודם" })]);
  const nextLabel = meta.isSummary ? "בנה תוכנית" : (state.step === LAST_STEP - 1 ? "לסיכום" : "הבא");
  const next = el("button", {
    class: "btn-primary onb-next", onclick: () => {
      if (meta.isSummary) { onGenerate(); return; }
      if (meta.valid && !meta.valid()) { flashHint(meta.hint || "נא לבחור"); return; }
      state.step++; renderOnboarding();
    },
  }, [el("span", { text: nextLabel }), el("span", { html: meta.isSummary ? ICONS.dumbbell : ICONS.arrowLeft })]);
  return el("div", { class: "onb-nav" }, [back, next]);
}

function flashHint(msg) {
  const nav = $(".onb-nav");
  let h = $(".onb-hint");
  if (!h) { h = el("span", { class: "onb-hint" }); nav.parentNode.insertBefore(h, nav); }
  h.textContent = msg; h.classList.remove("show"); void h.offsetWidth; h.classList.add("show");
}

/* --- שלבי השאלון --- */
function feature(icon, title, sub) {
  return el("div", { class: "feat" }, [
    el("span", { class: "feat-ic", html: icon }),
    el("div", {}, [el("span", { class: "feat-title", text: title }), el("span", { class: "feat-sub", text: sub })]),
  ]);
}
function renderIntro() {
  return el("div", { class: "onb-intro" }, [
    el("div", { class: "logo", html: ICONS.dumbbell }),
    el("h1", { text: "מלאו שאלון קצר" }),
    el("p", { class: "onb-sub", text: "נכיר אתכם — ונבנה תוכנית אימון שבועית מדויקת בדיוק בשבילכם." }),
    el("div", { class: "intro-features" }, [
      feature(ICONS.clock, "לוקח 5 דקות", "שאלון קצר וקולח"),
      feature(ICONS.spark, "קליל, כיפי ואינטראקטיבי", "בלי סרבול"),
      feature(ICONS.chart, "מידע ונתונים עליכם", "נפח, קלוריות והמלצות"),
    ]),
    el("button", { class: "btn-primary", onclick: () => { state.step = 1; renderOnboarding(); } },
      [el("span", { text: "בוא נתחיל" }), el("span", { html: ICONS.arrowLeft })]),
  ]);
}

function toggleFocus(key) {
  const f = state.onb.focus;
  if (key === "all") { state.onb.focus = f.includes("all") ? [] : ["all"]; }
  else {
    let arr = f.filter((x) => x !== "all");
    arr = arr.includes(key) ? arr.filter((x) => x !== key) : arr.concat(key);
    state.onb.focus = arr;
  }
  renderOnboarding();
}
function renderFocus() {
  const grid = el("div", { class: "focus-grid" });
  FOCUS_GROUPS.forEach((g) => {
    const sel = state.onb.focus.includes(g.key);
    grid.appendChild(el("button", { class: "focus-card" + (sel ? " selected" : ""), onclick: () => toggleFocus(g.key) }, [
      el("div", { class: "focus-body", html: bodyDiagram(g) }),
      el("span", { class: "focus-label", text: g.label }),
    ]));
  });
  return grid;
}

function renderGoal() {
  const grid = el("div", { class: "opt-grid" });
  GOAL_OPTIONS.forEach((o) => {
    const sel = state.onb.goal === o.key;
    grid.appendChild(el("button", { class: "opt-card" + (sel ? " selected" : ""), onclick: () => { state.onb.goal = o.key; renderOnboarding(); } }, [
      el("span", { class: "opt-ic", html: o.icon() }),
      el("div", { class: "opt-txt" }, [el("span", { class: "opt-title", text: o.label }), el("span", { class: "opt-sub", text: o.desc })]),
    ]));
  });
  return grid;
}

function renderLevel() {
  return el("div", {}, [
    el("div", { class: "pill-row" }, Object.entries(LEVEL_LABELS).map(([k, l]) =>
      el("button", { class: "pill" + (state.onb.level === k ? " selected" : ""), onclick: () => { state.onb.level = k; renderOnboarding(); }, text: l }))),
    el("p", { class: "level-note", text: levelNote(state.onb.level) }),
  ]);
}

function renderDays() {
  const preview = pickSplit(state.onb.days, state.onb.level).map((k) => DAYS[k].name).join(" · ");
  return el("div", {}, [
    el("div", { class: "pill-row" }, [2, 3, 4, 5, 6].map((d) =>
      el("button", { class: "pill" + (state.onb.days === d ? " selected" : ""), onclick: () => { state.onb.days = d; renderOnboarding(); }, text: `${d} ימים` }))),
    el("div", { class: "split-preview" }, [
      el("span", { class: "split-label", text: "התוכנית שתיבנה:" }),
      el("span", { class: "split-days", text: preview }),
    ]),
  ]);
}

function toggleArr(field, key) {
  const arr = state.onb[field];
  state.onb[field] = arr.includes(key) ? arr.filter((x) => x !== key) : arr.concat(key);
  renderOnboarding();
}
function renderEquip() {
  const grid = el("div", { class: "chip-grid" });
  EQUIP_OPTIONS.forEach((o) => {
    const sel = state.onb.equipment.includes(o.key);
    grid.appendChild(el("button", { class: "chip" + (sel ? " selected" : ""), onclick: () => toggleArr("equipment", o.key) },
      [el("span", { class: "chip-check", html: ICONS.check }), el("span", { text: o.label })]));
  });
  return grid;
}

function toggleLimit(key) {
  let arr = state.onb.limitations;
  if (key === "none") { arr = ["none"]; }
  else {
    arr = arr.filter((x) => x !== "none");
    arr = arr.includes(key) ? arr.filter((x) => x !== key) : arr.concat(key);
    if (arr.length === 0) arr = ["none"];
  }
  state.onb.limitations = arr; renderOnboarding();
}
function renderLimits() {
  const grid = el("div", { class: "chip-grid" });
  LIMITATION_OPTIONS.forEach((o) => {
    const sel = state.onb.limitations.includes(o.key);
    grid.appendChild(el("button", { class: "chip" + (sel ? " selected" : ""), onclick: () => toggleLimit(o.key) },
      [el("span", { class: "chip-check", html: ICONS.check }), el("span", { text: o.label })]));
  });
  return grid;
}

function detailField(label, field, unit) {
  const inp = el("input", {
    class: "weight-input", type: "number", inputmode: "numeric", min: "0", placeholder: unit, value: state.onb[field] || "",
    oninput: (e) => { state.onb[field] = e.target.value; },
  });
  return el("div", { class: "detail-row" }, [el("label", { class: "detail-label", text: label }), inp]);
}
function renderDetails() {
  return el("div", { class: "details" }, [
    detailField("גיל", "age", "שנים"),
    detailField("משקל", "weight", "ק״ג"),
    el("p", { class: "level-note", text: "אופציונלי — עוזר להעריך קלוריות. אפשר לדלג ולהמשיך." }),
  ]);
}

function computeSummary(onb) {
  const internal = GOAL_MAP[onb.goal];
  const goalDef = GOALS[internal];
  const splitKeys = pickSplit(onb.days, onb.level);
  const setsPer = Math.max(2, goalDef.sets - (onb.level === "beginner" ? 1 : 0));
  const focusM = expandFocus(onb.focus);
  let totalEx = 0;
  splitKeys.forEach((k) => DAYS[k].groups.forEach(([m, c]) => { totalEx += focusM.has(m) ? c + 1 : c; }));
  const avgEx = Math.round(totalEx / onb.days);
  const perDaySets = Math.round((totalEx / onb.days) * setsPer);
  const durMin = Math.round(perDaySets * (goalDef.restSec + 40) / 60);
  const w = parseFloat(onb.weight) || 75;
  const mets = internal === "toning" ? 6 : internal === "strength" ? 5 : 5.5;
  const kcal = Math.round(mets * w * (durMin / 60));
  return {
    split: splitKeys.map((k) => DAYS[k].name), days: onb.days, avgEx, setsPer,
    rest: goalDef.restSec, durMin, kcal, weightKnown: !!parseFloat(onb.weight),
    goalLabel: (GOAL_OPTIONS.find((o) => o.key === onb.goal) || {}).label,
  };
}
function sumRow(k, v) { return el("div", { class: "sum-row" }, [el("span", { class: "sum-k", text: k }), el("span", { class: "sum-v", text: v })]); }
function renderSummary() {
  const s = computeSummary(state.onb);
  const focusLabels = (state.onb.focus.includes("all") || state.onb.focus.length === 0) ? "כל הגוף"
    : state.onb.focus.map((f) => (FOCUS_GROUPS.find((g) => g.key === f) || {}).label).join(", ");
  const limitLabels = state.onb.limitations.includes("none") ? "אין"
    : state.onb.limitations.map((l) => (LIMITATION_OPTIONS.find((o) => o.key === l) || {}).label).join(", ");
  const metric = (ic, val, lbl) => el("div", { class: "sum-card" }, [
    el("span", { class: "sum-ic", html: ic }),
    el("span", { class: "sum-val", text: val }),
    el("span", { class: "sum-lbl", text: lbl }),
  ]);
  return el("div", { class: "summary" }, [
    el("div", { class: "sum-grid" }, [
      metric(ICONS.dumbbell, `${s.days}`, "ימים בשבוע"),
      metric(ICONS.chart, `${s.avgEx}`, "תרגילים לאימון"),
      metric(ICONS.clock, `~${s.durMin} דק׳`, "משך אימון משוער"),
      metric(ICONS.fire, s.weightKnown ? `~${s.kcal}` : "—", "קלוריות לאימון (משוער)"),
    ]),
    el("div", { class: "sum-list" }, [
      sumRow("מטרה", s.goalLabel),
      sumRow("התמקדות", focusLabels),
      sumRow("מגבלות", limitLabels),
      sumRow("פיצול מומלץ", s.split.join(" · ")),
      sumRow("סטים לתרגיל", `${s.setsPer}`),
      sumRow("מנוחה בין סטים", `${s.rest} שניות`),
      sumRow("נפח שבועי מומלץ", "10–20 סטים לכל קבוצת שריר"),
    ]),
  ]);
}

function onGenerate() {
  const onb = state.onb;
  const goalOpt = GOAL_OPTIONS.find((o) => o.key === onb.goal);
  const config = {
    goal: GOAL_MAP[onb.goal], days: onb.days, level: onb.level,
    equipment: onb.equipment.slice(), focus: onb.focus.slice(),
    limitations: onb.limitations.filter((l) => l !== "none"),
    goalLabel: goalOpt ? goalOpt.label : GOALS[GOAL_MAP[onb.goal]].label,
  };
  const plan = generatePlan(config);
  plan.onb = { ...onb };
  state.plan = plan;
  state.activeDay = 0;
  state.progress = {}; // תוכנית חדשה = איפוס מעקב
  savePlan(plan);
  saveProgress(state.progress);
  renderPlan();
}

/* ============================ מסך תוכנית ============================ */
function renderPlan() {
  const root = $("#app");
  root.innerHTML = "";
  const plan = state.plan;

  const tabs = el("div", { class: "day-tabs" },
    plan.days.map((d, i) =>
      el("button", {
        class: "day-tab" + (i === state.activeDay ? " active" : ""),
        onclick: () => { state.activeDay = i; renderPlan(); },
      }, [
        el("span", { class: "day-tab-num", text: `יום ${i + 1}` }),
        el("span", { class: "day-tab-name", text: shortDayName(d) }),
      ])
    )
  );

  root.appendChild(
    el("div", { class: "plan" }, [
      el("header", { class: "plan-header" }, [
        el("div", {}, [
          el("h1", { text: "התוכנית השבועית שלך" }),
          el("p", { class: "plan-meta", text:
            `${plan.goalLabel} · ${plan.config.days} ימים · רמה ${LEVEL_LABELS[plan.config.level]}` }),
        ]),
        el("div", { class: "plan-actions" }, [
          el("button", { class: "btn-ghost", onclick: () => window.print(), title: "הדפסה / שמירה כ-PDF" },
            [el("span", { html: ICONS.print }), el("span", { class: "btn-label", text: "הדפסה" })]),
          el("button", { class: "btn-ghost", onclick: onNewPlan, title: "בניית תוכנית חדשה" },
            [el("span", { html: ICONS.refresh }), el("span", { class: "btn-label", text: "תוכנית חדשה" })]),
        ]),
      ]),
      tabs,
      renderDay(plan.days[state.activeDay]),
      renderVolume(plan),
      el("div", { class: "print-only print-all" }, plan.days.map(renderPrintDay)),
    ])
  );
}

function shortDayName(d) {
  const muscles = [...new Set(d.exercises.map((e) => MUSCLE_LABELS[e.muscle]))];
  return muscles.slice(0, 3).join(" · ");
}

function onNewPlan() {
  if (confirm("לבנות תוכנית חדשה? התוכנית והמעקב הנוכחיים יימחקו.")) {
    localStorage.removeItem(STORE_PLAN);
    localStorage.removeItem(STORE_PROGRESS);
    state.plan = null;
    state.onb = { ...DEFAULT_ONB };
    state.step = 0;
    renderOnboarding();
  }
}

/* --- יום בודד (אינטראקטיבי) --- */
function renderDay(day) {
  const totalSets = day.exercises.reduce((s, e) => s + e.sets, 0);
  const rows = day.exercises.map((ex) => renderExerciseRow(day.index, ex));

  return el("section", { class: "day-panel" }, [
    el("div", { class: "day-panel-head" }, [
      el("h2", { text: `יום ${day.index + 1} — ${day.name}` }),
      el("span", { class: "day-summary", text: `${day.exercises.length} תרגילים · ${totalSets} סטים` }),
    ]),
    el("div", { class: "table-head" }, [
      el("span", { class: "col-ex", text: "תרגיל" }),
      el("span", { class: "col-eq", text: "ציוד" }),
      el("span", { class: "col-sets", text: "סטים" }),
      el("span", { class: "col-reps", text: "חזרות" }),
      el("span", { class: "col-rest", text: "מנוחה" }),
    ]),
    el("div", { class: "ex-list" }, rows),
  ]);
}

/* הדגמת תרגיל: GIF אמיתי אם קיים מיפוי, אחרת אנימציית SVG. */
const MEDIA_TIMEOUT_MS = 5000; // אם ה-GIF לא נטען בזמן זה → גיבוי SVG (מונע היתקעות ב"טוען")
function svgFallback(wrap, ex) {
  if (wrap._t) { clearTimeout(wrap._t); wrap._t = null; }
  if (wrap._fellBack) return;
  wrap._fellBack = true;
  wrap.classList.remove("ex-media-wrap", "loading");
  wrap.innerHTML = (typeof exerciseAnimation === "function") ? exerciseAnimation(ex) : "";
}
function buildDemo(ex) {
  const gifId = (typeof EXERCISE_MEDIA !== "undefined") ? EXERCISE_MEDIA[ex.id] : null;
  const wrap = el("div", { class: "ex-anim" });
  if (gifId && typeof mediaGifUrl === "function") {
    wrap.classList.add("ex-media-wrap", "loading");
    wrap._ex = ex;
    const img = el("img", { class: "ex-media", alt: `הדגמת ${ex.name}`, "data-src": mediaGifUrl(gifId) });
    img.addEventListener("load", () => { if (wrap._t) { clearTimeout(wrap._t); wrap._t = null; } wrap.classList.remove("loading"); });
    img.addEventListener("error", () => svgFallback(wrap, ex)); // קובץ מקומי חסר → אנימציית SVG
    wrap.appendChild(img);
  } else {
    wrap.innerHTML = (typeof exerciseAnimation === "function") ? exerciseAnimation(ex) : "";
  }
  return wrap;
}
/* טעינה עצלה + timeout: נקרא בעת פתיחת פאנל התרגיל */
function startMediaLoad(wrap, ex) {
  const img = wrap.querySelector("img.ex-media[data-src]");
  if (!img) return;
  const src = img.getAttribute("data-src");
  img.removeAttribute("data-src");
  wrap._t = setTimeout(() => { if (!img.complete || !img.naturalWidth) svgFallback(wrap, ex); }, MEDIA_TIMEOUT_MS);
  img.src = src;
}

function renderExerciseRow(dayIdx, ex) {
  const key = progKey(dayIdx, ex.id);
  const prog = state.progress[key] || { sets: [], weight: "" };

  const detail = el("div", { class: "ex-detail", hidden: "hidden" });

  const row = el("div", { class: "ex-row" }, [
    el("button", { class: "ex-main", onclick: () => toggleDetail(detail, row) }, [
      el("span", { class: "col-ex" }, [
        el("span", { class: "ex-name", text: ex.name }),
        el("span", { class: "ex-muscle", text: MUSCLE_LABELS[ex.muscle] }),
      ]),
      el("span", { class: "col-eq" }, [ el("span", { class: `eq-badge eq-${ex.equipment}`, text: EQUIP_LABELS[ex.equipment] }) ]),
      el("span", { class: "col-sets", text: String(ex.sets) }),
      el("span", { class: "col-reps", text: ex.reps }),
      el("span", { class: "col-rest", text: `${ex.restSec}ש׳` }),
      el("span", { class: "ex-chevron", html: ICONS.info }),
    ]),
    detail,
  ]);

  /* תוכן מורחב: הדגמה (GIF אמיתי, עם נפילה לאנימציית SVG) + הסבר + טיפ + מעקב */
  detail.appendChild(buildDemo(ex));
  detail.appendChild(el("p", { class: "ex-instructions", text: ex.instructions }));
  if (ex.tip) detail.appendChild(el("p", { class: "ex-tip", html: `<strong>טיפ:</strong> ${ex.tip}` }));
  if (ex.secondary && ex.secondary.length) {
    detail.appendChild(el("p", { class: "ex-secondary", text: "שרירים משניים: " + ex.secondary.map((m) => MUSCLE_LABELS[m]).join(", ") }));
  }

  /* מעקב סטים */
  const tracker = el("div", { class: "tracker" });
  const setDots = el("div", { class: "set-dots" });
  for (let s = 0; s < ex.sets; s++) {
    const done = !!(prog.sets && prog.sets[s]);
    const dot = el("button", {
      class: "set-dot" + (done ? " done" : ""),
      title: `סט ${s + 1}`,
      onclick: () => {
        const p = state.progress[key] || { sets: [], weight: prog.weight || "" };
        p.sets = p.sets || [];
        p.sets[s] = !p.sets[s];
        state.progress[key] = p;
        saveProgress(state.progress);
        dot.classList.toggle("done", !!p.sets[s]);
        if (p.sets[s]) startRestTimer(ex.restSec); // סימון סט מפעיל טיימר מנוחה
      },
    }, [ el("span", { class: "set-dot-num", text: String(s + 1) }), el("span", { class: "set-dot-check", html: ICONS.check }) ]);
    setDots.appendChild(dot);
  }

  const weightInput = el("input", {
    class: "weight-input", type: "number", inputmode: "decimal", min: "0",
    placeholder: "משקל (ק״ג)", value: prog.weight || "",
    oninput: (e) => {
      const p = state.progress[key] || { sets: [] };
      p.weight = e.target.value;
      state.progress[key] = p;
      saveProgress(state.progress);
    },
  });

  const timerBtn = el("button", { class: "mini-timer-btn", onclick: () => startRestTimer(ex.restSec) },
    [ el("span", { html: ICONS.timer }), el("span", { text: `מנוחה ${ex.restSec}ש׳` }) ]);

  tracker.appendChild(el("div", { class: "tracker-row" }, [ el("span", { class: "tracker-label", text: "סימון סטים:" }), setDots ]));
  tracker.appendChild(el("div", { class: "tracker-row" }, [ weightInput, timerBtn ]));
  detail.appendChild(tracker);

  return row;
}

function toggleDetail(detail, row) {
  const open = detail.hasAttribute("hidden");
  if (open) {
    detail.removeAttribute("hidden"); row.classList.add("open");
    const wrap = detail.querySelector(".ex-media-wrap"); // טעינה עצלה + timeout רק בפתיחה
    if (wrap && wrap._ex) startMediaLoad(wrap, wrap._ex);
  } else {
    detail.setAttribute("hidden", "hidden"); row.classList.remove("open");
  }
}

/* --- סיכום נפח שבועי --- */
function renderVolume(plan) {
  const entries = Object.entries(plan.volume).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((e) => e[1]), 1);

  const bars = entries.map(([muscle, sets]) => {
    const inRange = sets >= 10 && sets <= 20;
    const status = sets < 10 ? "low" : sets > 20 ? "high" : "ok";
    return el("div", { class: "vol-item" }, [
      el("div", { class: "vol-top" }, [
        el("span", { class: "vol-name", text: MUSCLE_LABELS[muscle] }),
        el("span", { class: `vol-sets vol-${status}`, text: `${sets} סטים` }),
      ]),
      el("div", { class: "vol-bar-bg" }, [
        el("div", { class: `vol-bar vol-bar-${status}`, style: `width:${(sets / max) * 100}%` }),
      ]),
    ]);
  });

  return el("section", { class: "volume" }, [
    el("h2", { text: "נפח שבועי לכל קבוצת שריר" }),
    el("p", { class: "vol-note", text: "טווח מומלץ מבוסס-מחקר: 10–20 סטים לשריר בשבוע. ירוק = בטווח." }),
    el("div", { class: "vol-list" }, bars),
  ]);
}

/* --- תצוגת הדפסה (כל הימים) --- */
function renderPrintDay(day) {
  return el("div", { class: "print-day" }, [
    el("h3", { text: `יום ${day.index + 1} — ${day.name}` }),
    el("table", { class: "print-table" }, [
      el("thead", {}, el("tr", {}, [
        el("th", { text: "תרגיל" }), el("th", { text: "ציוד" }),
        el("th", { text: "סטים" }), el("th", { text: "חזרות" }), el("th", { text: "מנוחה" }),
      ])),
      el("tbody", {}, day.exercises.map((ex) =>
        el("tr", {}, [
          el("td", { text: ex.name }),
          el("td", { text: EQUIP_LABELS[ex.equipment] }),
          el("td", { text: String(ex.sets) }),
          el("td", { text: ex.reps }),
          el("td", { text: `${ex.restSec}ש׳` }),
        ])
      )),
    ]),
  ]);
}

/* ============================ טיימר מנוחה ============================ */
let timerInterval = null;
let timerRemaining = 0;

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; gain.gain.value = 0.15;
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  } catch (e) { /* אודיו לא זמין - מתעלמים */ }
}

function ensureTimerPanel() {
  let panel = $("#rest-timer");
  if (panel) return panel;
  panel = el("div", { id: "rest-timer", class: "rest-timer hidden" }, [
    el("div", { class: "rt-label", text: "מנוחה" }),
    el("div", { class: "rt-time", id: "rt-time", text: "0:00" }),
    el("div", { class: "rt-controls" }, [
      el("button", { class: "rt-adj", onclick: () => adjustTimer(-15), text: "‏−15" }),
      el("button", { class: "rt-adj", onclick: () => adjustTimer(15), text: "‏+15" }),
      el("button", { class: "rt-stop", onclick: stopRestTimer, html: ICONS.close }),
    ]),
    el("div", { class: "rt-presets" }, [60, 90, 120].map((s) =>
      el("button", { class: "rt-preset", onclick: () => startRestTimer(s), text: `${s}ש׳` }))),
  ]);
  document.body.appendChild(panel);
  return panel;
}

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startRestTimer(sec) {
  const panel = ensureTimerPanel();
  panel.classList.remove("hidden", "done");
  timerRemaining = sec;
  $("#rt-time").textContent = fmt(timerRemaining);
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerRemaining--;
    $("#rt-time").textContent = fmt(Math.max(0, timerRemaining));
    if (timerRemaining <= 0) {
      clearInterval(timerInterval); timerInterval = null;
      beep();
      panel.classList.add("done");
      $("#rt-time").textContent = "סיום!";
    }
  }, 1000);
}

function adjustTimer(delta) {
  timerRemaining = Math.max(0, timerRemaining + delta);
  const panel = $("#rest-timer");
  if (panel) panel.classList.remove("done");
  const t = $("#rt-time"); if (t) t.textContent = fmt(timerRemaining);
}

function stopRestTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  const panel = $("#rest-timer");
  if (panel) panel.classList.add("hidden");
}

/* ============================ אתחול ============================ */
function init() {
  const saved = loadPlan();
  if (saved && saved.days) {
    state.plan = saved;
    if (saved.onb) state.onb = { ...DEFAULT_ONB, ...saved.onb };
    state.progress = loadProgress();
    renderPlan();
  } else {
    state.step = 0;
    renderOnboarding();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}

/* ייצוא לבדיקות ב-Node (לא משפיע על הדפדפן) */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { generatePlan, pickSplit, computeVolume, GOALS, DAYS, MUSCLE_LABELS };
}
