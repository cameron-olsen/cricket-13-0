/* backfill-scorecards.js — one-time migration.
 *
 * Re-simulates every existing 13-0 (format='test') Hall-of-Fame record under the engine version
 * it was made on, and stores its full scorecards in the Supabase `tour_scorecards` table, so that
 * shared links can replay WITHOUT re-running the match engine. Once this completes, the frozen
 * engine ladder (ENG_V1/V2/V3, engFor, verify-by-resim) can be deleted.
 *
 * Run locally (needs Node 18+ for global fetch), from the 13-0/ folder:
 *     node backfill-scorecards.js
 * Safe to re-run: writes are upserts (resolution=merge-duplicates), keyed by share_code.
 */
const fs = require("fs"), vm = require("vm"), path = require("path");

const HTML = path.join(__dirname, "index.html");
const SB_URL = "https://wptcbnfqkrvdndgcwpit.supabase.co";
const SB_KEY = "sb_publishable_zdkhDNtnqH-_QdmfXoOTew_k3VGvH4U";
const SB_HEAD = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY };

function biggestScript(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m, best = "";
  while ((m = re.exec(html))) { if (/\bsrc\s*=/.test(m[1])) continue; if (m[2].length > best.length) best = m[2]; }
  return best;
}
function domProxy() {
  const t = function () { return p; };
  const p = new Proxy(t, {
    get(o, k) { if (k === "length") return 0; if (k === Symbol.toPrimitive) return () => ""; if (["value", "textContent", "innerHTML", "className"].includes(k)) return ""; return p; },
    set() { return true; }, apply() { return p; }, has() { return true; }, construct() { return p; }
  });
  return p;
}

// ---- load the game engine in a headless sandbox ----
const script = biggestScript(fs.readFileSync(HTML, "utf8"));
const ctx = {
  console, Math, JSON, Date, parseInt, parseFloat, isFinite, isNaN, Array, Object, String, Number, Boolean, Set, Map, RegExp, Symbol,
  unescape, escape, encodeURIComponent, decodeURIComponent, URLSearchParams,
  setTimeout: () => 0, clearTimeout: () => {}, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  btoa: x => Buffer.from(x, "binary").toString("base64"), atob: x => Buffer.from(x, "base64").toString("binary"),
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
ctx.document = domProxy();
ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
ctx.location = { search: "", pathname: "/", origin: "http://localhost" };
ctx.navigator = { language: "en" };
ctx.gtag = function () {}; ctx.dataLayer = [];
ctx.scrollTo = () => {}; ctx.addEventListener = () => {};
ctx.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {} });
ctx.getComputedStyle = () => domProxy();
ctx.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve([]) });   // game's own fetches are no-ops in backfill

const appended = `;globalThis.__bf=function(code){try{
  const d=decodeShare(code); if(!d) return {err:'decode'};
  picks=d.picksArr; used=new Set(picks.map(p=>p.n)); sharedView=true;
  shareEng=d.eng===1?ENG_V1:d.eng===2?ENG_V2:d.eng===3?ENG_V3:null;
  shareRoster=d.open&&d.roster===1?1:null;
  let cards=null;
  if(d.challenge){ gameMode='challenge'; challengeOpp=d.opp; simulateChallenge(); cards=challengeTests; }
  else if(d.open){ gameMode='tour'; challengeOpp=null; tour=d.fixtures; tourType=d.tourType; simulateOpen(); cards=tourTests; }
  else return {legacy:true};
  if(!cards) return {err:'nocards'};
  return {engine:(d.eng||4), cards:{t:cards, w:lastResult.W, d:lastResult.D, l:lastResult.L, s:lastStats, m:gameMode, tt:lastTourType||''}};
}catch(e){ return {err:String(e&&e.message||e)}; }};`;

vm.createContext(ctx);
vm.runInContext(script + appended, ctx, { timeout: 30000 });

(async () => {
  if (typeof fetch !== "function") { console.error("This script needs Node 18+ (global fetch)."); process.exit(1); }

  // 1. pull every test share_code from the Hall of Fame
  const codes = []; let offset = 0;
  while (true) {
    const r = await fetch(`${SB_URL}/rest/v1/tours?select=share_code&format=eq.test&order=created_at&offset=${offset}&limit=1000`, { headers: SB_HEAD });
    const rows = await r.json();
    codes.push(...rows.map(x => x.share_code));
    if (rows.length < 1000) break;
    offset += 1000;
  }
  console.log(`Found ${codes.length} test records to backfill.`);

  // 2. re-sim + upsert each tour's cards
  let stored = 0, skipped = 0, failed = 0;
  for (const code of codes) {
    const r = ctx.__bf(code);
    if (r.legacy) { skipped++; continue; }              // legacy "1|" codes carry no scorecards
    if (r.err || !r.cards) { failed++; continue; }
    try {
      const res = await fetch(`${SB_URL}/rest/v1/tour_scorecards`, {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, SB_HEAD),
        body: JSON.stringify({ share_code: code, engine: r.engine, cards: r.cards }),
      });
      if (res.ok) stored++; else { failed++; if (failed <= 5) console.error("  insert failed", res.status, await res.text()); }
    } catch (e) { failed++; }
    if ((stored + failed + skipped) % 100 === 0) console.log(`  ${stored + failed + skipped}/${codes.length} (stored ${stored}, skipped ${skipped}, failed ${failed})`);
  }
  console.log(`\nDone: ${stored} stored, ${skipped} legacy-skipped, ${failed} failed, of ${codes.length}.`);
  if (failed === 0) console.log("All records backfilled — the engine ladder can now be deleted.");
})();
