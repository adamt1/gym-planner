/*
 * שכבת חיבור ל-Supabase: אימות (Google / אימייל+סיסמה), תוכנית פר-משתמש, והיסטוריית סטים.
 * המפתח הציבורי בטוח לחשיפה — האבטחה נאכפת ע"י RLS בצד השרת.
 * אם הספרייה לא נטענה / אין רשת — הפונקציות מחזירות null והאפליקציה נופלת ל-localStorage.
 */
const SUPABASE_URL = "https://otbcmxokvjplygbqhxqm.supabase.co";
const SUPABASE_KEY = "sb_publishable_EsfyRD0X9GyQQ1_RzgfI7w_He2oo8QK";

let _sb = null;
function sbClient() {
  if (_sb) return _sb;
  if (typeof supabase === "undefined" || !supabase.createClient) return null;
  _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _sb;
}
function sbReady() { return !!sbClient(); }

/* ---------- אימות ---------- */
async function sbGetUser() {
  const c = sbClient(); if (!c) return null;
  const { data } = await c.auth.getUser();
  return data ? data.user : null;
}
async function sbSignInGoogle() {
  const c = sbClient(); if (!c) return { error: { message: "Supabase not loaded" } };
  return c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
}
async function sbSignInEmail(email, password) {
  const c = sbClient(); if (!c) return { error: { message: "Supabase not loaded" } };
  return c.auth.signInWithPassword({ email, password });
}
async function sbSignUpEmail(email, password) {
  const c = sbClient(); if (!c) return { error: { message: "Supabase not loaded" } };
  return c.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
}
async function sbSignOut() { const c = sbClient(); if (c) await c.auth.signOut(); }
function sbOnAuthChange(cb) { const c = sbClient(); if (c) c.auth.onAuthStateChange((_e, session) => cb(session)); }

/* ---------- תוכנית (שורה אחת פר-משתמש) ---------- */
async function sbLoadPlan() {
  const c = sbClient(); if (!c) return null;
  const { data, error } = await c.from("plans").select("data, progress").maybeSingle();
  if (error) { console.warn("sbLoadPlan", error.message); return null; }
  return data; // { data: <plan>, progress: {...} } או null
}
async function sbSavePlan(plan, progress) {
  const c = sbClient(); if (!c) return;
  const u = await sbGetUser(); if (!u) return;
  const { error } = await c.from("plans").upsert({
    user_id: u.id, data: plan, progress: progress || {}, updated_at: new Date().toISOString(),
  });
  if (error) console.warn("sbSavePlan", error.message);
}
async function sbSaveProgress(progress) {
  const c = sbClient(); if (!c) return;
  const u = await sbGetUser(); if (!u) return;
  const { error } = await c.from("plans").update({ progress, updated_at: new Date().toISOString() }).eq("user_id", u.id);
  if (error) console.warn("sbSaveProgress", error.message);
}

/* ---------- היסטוריית סטים ---------- */
async function sbLogSets(entries) {
  const c = sbClient(); if (!c || !entries.length) return { error: null };
  return c.from("set_logs").insert(entries);
}
async function sbHistory(exerciseId) {
  const c = sbClient(); if (!c) return [];
  let q = c.from("set_logs").select("*").order("performed_at", { ascending: true });
  if (exerciseId) q = q.eq("exercise_id", exerciseId);
  const { data, error } = await q;
  if (error) { console.warn("sbHistory", error.message); return []; }
  return data || [];
}
async function sbLoggedExercises() {
  const c = sbClient(); if (!c) return [];
  const { data, error } = await c.from("set_logs").select("exercise_id, exercise_name").order("performed_at", { ascending: false });
  if (error || !data) return [];
  const seen = new Map();
  data.forEach((r) => { if (!seen.has(r.exercise_id)) seen.set(r.exercise_id, r.exercise_name || r.exercise_id); });
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}
