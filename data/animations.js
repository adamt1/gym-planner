/*
 * אנימציות הדגמה לתרגילים — Gym Planner
 * גישת "תבניות תנועה": כל תרגיל ממופה לתבנית, כל תבנית = דמות SVG מונפשת ב-CSS.
 * ה-keyframes וכללי הצביעה מוגדרים ב-styles.css לפי מחלקת ‎.p-<pattern>‎ שעל המיכל.
 */

/* תבנית → מבט (חזית/צד) הקריא ביותר */
const PATTERN_VIEW = {
  "horizontal-press": "side", "overhead-press": "front", "chest-fly": "front",
  "pulldown": "front", "row": "side", "pullup": "front", "lateral-raise": "front",
  "biceps-curl": "front", "triceps-ext": "side", "squat": "side", "hinge": "side",
  "leg-extension": "side", "leg-curl": "side", "hip-extension": "side",
  "calf-raise": "side", "core-crunch": "side", "plank-hold": "side", "leg-raise": "side",
};

/* ברירת מחדל לפי שריר (אם ה-id לא נמצא במפה) */
const MUSCLE_PATTERN_FALLBACK = {
  chest: "horizontal-press", back: "row", shoulders: "overhead-press", quads: "squat",
  hamstrings: "leg-curl", glutes: "hip-extension", calves: "calf-raise",
  biceps: "biceps-curl", triceps: "triceps-ext", core: "core-crunch",
};

/* מפת id → תבנית לכל התרגילים */
const EXERCISE_PATTERN = {
  /* חזה */
  chest_machine_press: "horizontal-press", chest_incline_machine: "horizontal-press",
  chest_pec_deck: "chest-fly", chest_db_press: "horizontal-press", chest_incline_db: "horizontal-press",
  chest_barbell_bench: "horizontal-press", chest_cable_crossover: "chest-fly", chest_pushup: "horizontal-press",
  chest_smith_press: "horizontal-press", chest_cable_press: "horizontal-press",
  chest_decline_machine: "horizontal-press", chest_incline_pushup: "horizontal-press",
  /* גב */
  back_lat_pulldown: "pulldown", back_seated_row_machine: "row", back_cable_row: "row",
  back_assisted_pullup: "pullup", back_barbell_row: "row", back_db_row: "row",
  back_cable_pullover: "pulldown", back_pullup: "pullup", back_close_pulldown: "pulldown",
  back_reverse_pulldown: "pulldown", back_hammer_row: "row", back_tbar_row: "row",
  back_straight_arm: "pulldown", back_extension: "hinge", back_shrug: "lateral-raise",
  /* כתפיים */
  sh_machine_press: "overhead-press", sh_reverse_pec_deck: "lateral-raise", sh_lateral_raise: "lateral-raise",
  sh_cable_lateral: "lateral-raise", sh_face_pull: "row", sh_db_press: "overhead-press",
  sh_ohp: "overhead-press", sh_arnold: "overhead-press", sh_front_raise: "lateral-raise",
  sh_lateral_machine: "lateral-raise", sh_upright_row: "lateral-raise", sh_smith_press: "overhead-press",
  /* ארבע ראשי */
  q_leg_press: "squat", q_leg_extension: "leg-extension", q_hack_squat: "squat", q_goblet_squat: "squat",
  q_lunges: "squat", q_barbell_squat: "squat", q_smith_squat: "squat", q_step_up: "squat",
  q_bulgarian_squat: "squat", q_pendulum_squat: "squat",
  /* ירך אחורי */
  h_lying_curl: "leg-curl", h_seated_curl: "leg-curl", h_rdl: "hinge", h_deadlift: "hinge",
  h_good_morning: "hinge", h_single_rdl: "hinge", h_pull_through: "hinge",
  /* עכוז */
  g_hip_thrust: "hip-extension", g_hip_abduction: "hip-extension", g_cable_kickback: "hip-extension",
  g_glute_bridge: "hip-extension", g_machine_thrust: "hip-extension", g_reverse_lunge: "squat",
  /* שוקיים */
  c_standing_raise: "calf-raise", c_seated_raise: "calf-raise", c_leg_press_raise: "calf-raise", c_single_raise: "calf-raise",
  /* יד קדמית */
  b_db_curl: "biceps-curl", b_hammer_curl: "biceps-curl", b_cable_curl: "biceps-curl", b_machine_curl: "biceps-curl",
  b_barbell_curl: "biceps-curl", b_preacher: "biceps-curl", b_incline_curl: "biceps-curl",
  b_concentration: "biceps-curl", b_ez_curl: "biceps-curl",
  /* יד אחורית */
  t_pushdown: "triceps-ext", t_machine_ext: "triceps-ext", t_assisted_dip: "horizontal-press",
  t_overhead_ext: "triceps-ext", t_close_grip_bench: "horizontal-press", t_dips: "horizontal-press",
  t_skullcrusher: "triceps-ext", t_rope_pushdown: "triceps-ext", t_kickback: "triceps-ext", t_bench_dip: "triceps-ext",
  /* בטן / ליבה */
  core_machine_crunch: "core-crunch", core_plank: "plank-hold", core_cable_crunch: "core-crunch",
  core_hanging_raise: "leg-raise", core_leg_raise_floor: "leg-raise", core_bicycle: "leg-raise",
  core_russian_twist: "core-crunch", core_side_plank: "plank-hold", core_woodchopper: "core-crunch",
  core_ab_wheel: "plank-hold", core_mountain_climber: "leg-raise",
};

/* צבע גוף בסיס (האיבר הפעיל נצבע ב-var(--primary) דרך CSS) */
const AF = "#5C5942";

/* מוצא סיבוב יחסי לתיבת האיבר עצמו (נע עם האיבר במפרקים מקוננים) */
const TOP = 'style="transform-box:fill-box;transform-origin:center top"';
const BOT = 'style="transform-box:fill-box;transform-origin:center bottom"';
const CEN = 'style="transform-box:fill-box;transform-origin:center center"';

/* דמות חזית — זרועות מפורקות (זרוע עליונה + אמה) שמסתובבות במפרק */
function animFigureFront() {
  return `<svg class="animfig" viewBox="0 0 120 160" aria-hidden="true">
    <g class="af-body" ${CEN}>
      <circle cx="60" cy="24" r="11" fill="${AF}"/>
      <rect x="50" y="36" width="20" height="40" rx="7" fill="${AF}"/>
      <rect x="50" y="74" width="20" height="11" rx="4" fill="${AF}"/>
      <rect x="51" y="85" width="8" height="45" rx="4" fill="${AF}"/>
      <rect x="61" y="85" width="8" height="45" rx="4" fill="${AF}"/>
      <rect x="50" y="128" width="10" height="7" rx="2" fill="${AF}"/>
      <rect x="60" y="128" width="10" height="7" rx="2" fill="${AF}"/>
      <g class="af-arm-l" ${TOP}>
        <rect x="47" y="40" width="7" height="23" rx="3.5" fill="${AF}"/>
        <g class="af-fore-l" ${TOP}><rect x="47" y="61" width="6" height="22" rx="3" fill="${AF}"/><circle cx="50" cy="85" r="4" fill="${AF}"/></g>
      </g>
      <g class="af-arm-r" ${TOP}>
        <rect x="66" y="40" width="7" height="23" rx="3.5" fill="${AF}"/>
        <g class="af-fore-r" ${TOP}><rect x="66" y="61" width="6" height="22" rx="3" fill="${AF}"/><circle cx="69" cy="85" r="4" fill="${AF}"/></g>
      </g>
    </g>
  </svg>`;
}

/* דמות צד — זרוע (כתף+מרפק), גו (מפרק אגן), רגל (ירך+ברך) */
function animFigureSide() {
  return `<svg class="animfig" viewBox="0 0 120 170" aria-hidden="true">
    <g class="as-all" ${CEN}>
      <g class="as-thigh" ${TOP}>
        <rect x="56" y="100" width="12" height="35" rx="5" fill="${AF}"/>
        <g class="as-shin" ${TOP}><rect x="56" y="133" width="10" height="32" rx="4" fill="${AF}"/><rect x="56" y="163" width="17" height="6" rx="2" fill="${AF}"/></g>
      </g>
      <g class="as-torso" ${BOT}>
        <circle cx="60" cy="34" r="11" fill="${AF}"/>
        <rect x="54" y="44" width="14" height="57" rx="6" fill="${AF}"/>
        <g class="as-arm" ${TOP}>
          <rect x="58" y="52" width="8" height="27" rx="4" fill="${AF}"/>
          <g class="as-fore" ${TOP}><rect x="58" y="77" width="7" height="24" rx="3.5" fill="${AF}"/><circle cx="61" cy="102" r="4" fill="${AF}"/></g>
        </g>
      </g>
    </g>
  </svg>`;
}

function exerciseAnimation(ex) {
  const pat = EXERCISE_PATTERN[ex.id] || MUSCLE_PATTERN_FALLBACK[ex.muscle] || "horizontal-press";
  const fig = PATTERN_VIEW[pat] === "front" ? animFigureFront() : animFigureSide();
  return `<div class="anim-stage p-${pat}">${fig}</div>`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { EXERCISE_PATTERN, MUSCLE_PATTERN_FALLBACK, PATTERN_VIEW, exerciseAnimation };
}
