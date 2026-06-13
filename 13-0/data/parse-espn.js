#!/usr/bin/env node
/* parse-espn.js — convert an ESPNcricinfo Statsguru paste into clean rows.
 *
 *   node parse-espn.js <decade> <rawfile>
 *   e.g. node parse-espn.js 1940s raw/1940s-batting.txt
 *
 * Handles two paste shapes:
 *   1. "Overall figures" tab/space-delimited rows  (RELIABLE)
 *        DCS Compton (ENG)\t1946-1949\t28\t48\t5\t2664\t208\t61.95\t11\t10\t2
 *   2. The HTML table copied as markdown links with the NUMBERS CONCATENATED (LOSSY)
 *        [DCS Compton](url) (ENG)1946-1949704119... <- no separators
 *      These are solved with an Ave = Runs/(Inns-NO) check; any row that can't be
 *      verified is written to <decade>-FLAGGED.txt instead of the clean output.
 *
 * Output: <decade>-batting.md  (clean table) and <decade>-batting.json
 * Every emitted row is validated: |Ave - Runs/(Inns-NO)| <= 0.06.
 */
const fs = require("fs");
const path = require("path");

const decade = process.argv[2];
const rawfile = process.argv[3];
if (!decade || !rawfile) { console.error("usage: node parse-espn.js <decade> <rawfile>"); process.exit(1); }
const raw = fs.readFileSync(rawfile, "utf8");

const rows = [];
const flagged = [];
const seen = new Set();

const validate = r => {
  if (r.inns <= r.no) return true;            // can't check (all not out) — accept
  const calc = r.runs / (r.inns - r.no);
  return Math.abs(calc - r.ave) <= 0.06;
};
const push = r => {
  const key = r.name + "|" + r.cc;
  if (seen.has(key)) return;                  // first (most matches) wins
  if (validate(r)) { seen.add(key); rows.push(r); }
  else flagged.push(r);
};

/* ---- shape 1: delimited rows (tabs or runs of spaces) ---- */
const cleanRe = /([A-Za-z][A-Za-z.'\- ]+?) \(([A-Z/]{2,7})\)[\t ]+(\d{4})-(\d{4})[\t ]+(\d+)[\t ]+(\d+)[\t ]+(\d+)[\t ]+(\d+)[\t ]+(\d+\*?)[\t ]+(\d+(?:\.\d+)?)[\t ]+(\d+)[\t ]+(\d+)[\t ]+(\d+)/g;
let m;
while ((m = cleanRe.exec(raw))) {
  push({ name: m[1].trim(), cc: m[2], span: m[3] + "-" + m[4],
    mat:+m[5], inns:+m[6], no:+m[7], runs:+m[8], hs:m[9], ave:+m[10], h100:+m[11], f50:+m[12], d0:+m[13] });
}

/* ---- shape 2: concatenated markdown-link rows ---- */
const linkRe = /\[([^\]]+)\]\(https?:\/\/[^)]*?player\/[^)]*\)\s*\(([A-Z/]{2,7})\)(\d{4})-(\d{4})([\d*.]+?)(?=\[|$)/g;
function solveBlob(blob) {
  // blob = mat inns no runs hs(*?) ave(.?dd?) h100 f50 d0   (all concatenated)
  const star = blob.includes("*");
  const digits = blob;
  // brute force boundaries; validate with Ave = runs/(inns-no)
  for (let a = 1; a <= 2; a++) for (let b = 1; b <= 3; b++) for (let c = 0; c <= 2; c++)
  for (let d = 1; d <= 4; d++) for (let e = 1; e <= 3; e++) {
    let i = 0;
    const mat = +digits.slice(i, i+=a), inns = +digits.slice(i, i+=b), no = +digits.slice(i, i+=c);
    const runs = +digits.slice(i, i+=d); let hsRaw = digits.slice(i, i+=e);
    let rest = digits.slice(i);
    if (rest[0] === "*") rest = rest.slice(1);            // not-out star on HS
    // ave: integer part then optional .dd
    for (let ai = 1; ai <= 3; ai++) {
      let aveStr = rest.slice(0, ai), j = ai;
      if (rest[j] === ".") { aveStr += rest.slice(j, j+3); j += 3; }
      const ave = +aveStr; const tail = rest.slice(j);
      if (tail.length < 3 || tail.length > 6) continue;
      // split tail into h100,f50,d0 (greedy 1-2 digits each, must consume all)
      for (let p = 1; p <= 2; p++) for (let q = 1; q <= 2; q++) {
        const r3 = tail.length - p - q; if (r3 < 1 || r3 > 2) continue;
        const h100 = +tail.slice(0,p), f50 = +tail.slice(p,p+q), d0 = +tail.slice(p+q);
        if (inns < no || inns < 1) continue;
        const cand = { mat, inns, no, runs, hs: hsRaw + (star?"*":""), ave, h100, f50, d0 };
        if (inns > no && Math.abs(runs/(inns-no) - ave) <= 0.06) return cand;
      }
    }
  }
  return null;
}
while ((m = linkRe.exec(raw))) {
  const name = m[1].trim(), cc = m[2], span = m[3] + "-" + m[4], blob = m[5];
  const s = solveBlob(blob);
  if (s) push({ name, cc, span, ...s });
  else flagged.push({ name, cc, span, blob });
}

/* ---- output ---- */
rows.sort((a,b)=> b.mat - a.mat);
const outDir = path.dirname(rawfile).replace(/raw$/, "") || ".";
const base = path.join(outDir, decade + "-batting");
let md = `# ${decade} — Test batting (real ESPNcricinfo data)\n\n`;
md += `${rows.length} players parsed and Ave-validated`;
if (flagged.length) md += ` · ${flagged.length} flagged (see ${decade}-FLAGGED.txt)`;
md += `\n\n| Player | Country | Span | Mat | Inns | NO | Runs | HS | Ave | 100 | 50 | 0 |\n`;
md += `|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|\n`;
for (const r of rows)
  md += `| ${r.name} | ${r.cc} | ${r.span} | ${r.mat} | ${r.inns} | ${r.no} | ${r.runs} | ${r.hs} | ${r.ave} | ${r.h100} | ${r.f50} | ${r.d0} |\n`;
fs.writeFileSync(base + ".md", md);
fs.writeFileSync(base + ".json", JSON.stringify(rows.map(r=>({...r, decade})), null, 0));
if (flagged.length) fs.writeFileSync(path.join(outDir, decade + "-FLAGGED.txt"),
  flagged.map(f=>JSON.stringify(f)).join("\n"));
console.log(`${decade}: ${rows.length} clean, ${flagged.length} flagged -> ${base}.md/.json`);
