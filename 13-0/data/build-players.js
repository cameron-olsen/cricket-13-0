#!/usr/bin/env node
/* build-players.js — merge all decade JSONs into one players.json with roles.
 *
 * Roles needed by the game: OP (opener), TOP (no.3/4), MD (middle), AR, PC (pace),
 * SP (spin), WK (keeper). Statsguru gives us none of these directly, so:
 *   - WK is derived from the data: stumpings>0, or catches per match very high.
 *   - bat-position (OP/TOP/MD) and bowl-type (PC/SP) are pulled from the existing
 *     game's hand-tagged roster by matching surname + first initial.
 *   - bowler/batter split is sanity-checked against career wickets.
 * Anything that can't be resolved is written to needs-roles.txt for manual tagging.
 */
const fs = require("fs"), path = require("path");
const DECADES = ["1930s","1940s","1950s","1960s","1970s","1980s","1990s","2000s","2010s","2020s"];
const dir = __dirname;

// ---- 1. load the hand-tagged roles from the current game (RAW array in 13-0.html) ----
const html = fs.readFileSync(path.join(dir, "..", "13-0.html"), "utf8");
const rawBlock = html.split("const RAW=[")[1].split("];")[0];
const RAW = eval("[" + rawBlock + "]");
const norm = s => s.toLowerCase().replace(/[^a-z ]/g, "").trim();
const surnameKey = full => {
  const w = norm(full).split(" ").filter(Boolean);
  return w[w.length - 1];                       // last word = surname
};
const roleMap = {};                              // "surname|firstInitial" -> rolesCSV
for (const r of RAW) {
  const full = r[0], roles = r[3];
  const sn = surnameKey(full), fi = norm(full)[0];
  roleMap[sn + "|" + fi] = roles;
  roleMap[sn] = roleMap[sn] || roles;            // surname-only fallback
}

// ---- 2. merge decades ----
const players = {};
for (const dec of DECADES) {
  const rows = JSON.parse(fs.readFileSync(path.join(dir, dec + ".json"), "utf8"));
  for (const r of rows) {
    const key = r.name + "|" + r.cc;
    if (!players[key]) players[key] = { name: r.name, cc: r.cc, eras: {} };
    players[key].eras[dec] = { mat:r.mat, runs:r.runs, avg:r.batav, h100:r.h100,
      wkts:r.wkts, bbi:r.bbi, bavg:r.bowlav, fivew:r.fivew, ct:r.ct, st:r.st };
  }
}

// ---- 3. assign roles ----
const needs = [];
for (const key of Object.keys(players)) {
  const p = players[key];
  let mat=0, runs=0, wkts=0, ct=0, st=0;
  for (const d in p.eras){const e=p.eras[d]; mat+=e.mat||0; runs+=e.runs||0; wkts+=e.wkts||0; ct+=e.ct||0; st+=e.st||0;}
  p.career = { mat, runs, wkts, ct, st };
  // role lookup from hand-tagged roster
  const espnName = p.name.replace(/^Sir /,"");
  const sn = surnameKey(espnName), fi = norm(espnName)[0];
  let roles = roleMap[sn + "|" + fi] || roleMap[sn] || "";
  let pos = roles ? roles.split(",") : [];
  // derive keeper from data if not tagged
  const keeperish = st > 0 || (mat > 0 && ct / mat > 1.6);
  if (keeperish && !pos.includes("WK")) pos.push("WK");
  // if no role at all, derive a coarse one from the stats so the player is usable
  if (!pos.length) {
    if (wkts >= 20 && runs / Math.max(mat,1) < 18) pos.push("PC");   // bowler (type unknown -> default pace, flag)
    else pos.push("MD");
    needs.push(p.name + " (" + p.cc + ")  derived=" + pos.join("/") + "  [mat " + mat + ", runs " + runs + ", wkts " + wkts + "]");
  }
  p.pos = [...new Set(pos)];
}

const out = Object.values(players);
fs.writeFileSync(path.join(dir, "players.json"), JSON.stringify(out));
fs.writeFileSync(path.join(dir, "needs-roles.txt"), needs.join("\n"));
console.log("players.json:", out.length, "unique players");
console.log("needed manual roles (no match in current roster):", needs.length);
// coverage summary
const withBowl = out.filter(p=>p.pos.some(r=>r==="PC"||r==="SP")).length;
const spin = out.filter(p=>p.pos.includes("SP")).length, pace = out.filter(p=>p.pos.includes("PC")).length;
const wk = out.filter(p=>p.pos.includes("WK")).length;
console.log(`roles: pace ${pace}, spin ${spin}, keeper ${wk}, bowlers total ${withBowl}`);
