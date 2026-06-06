#!/usr/bin/env node
/* parse-combined.js — parse the COMBINED Statsguru "Overall figures" table that has
 * batting + bowling + fielding in one (the 2020s format):
 *   Player(CC)  Span  Mat  Inns  Runs  HS  BatAv  100  Wkts  BBI  BowlAv  5  Ct  St  AveDiff  [junk]
 * Dashes ("-") mean "none". Tab- or multi-space-separated. Self-checks BatAv where possible.
 *
 *   node parse-combined.js <decade> <rawfile>
 * Output: <decade>.md and <decade>.json
 */
const fs=require("fs"), path=require("path");
const decade=process.argv[2], rawfile=process.argv[3];
if(!decade||!rawfile){console.error("usage: node parse-combined.js <decade> <rawfile>");process.exit(1);}
const num=v=>{v=(v||"").trim();return (v===""||v==="-")?null:Number(v.replace("*",""));};
const rows=[], flags=[];
for(const raw of fs.readFileSync(rawfile,"utf8").split("\n")){
  const line=raw.replace(/\s*investigate this query\s*$/,"").trim();
  if(!line||/^Player\b/.test(line)||/^Overall figures/i.test(line)) continue;
  const m=line.match(/^(.+?)\s*\(([A-Z/]{2,12})\)/);
  if(!m) continue;
  const name=m[1].trim();
  const cc=(m[2].split("/").filter(x=>x!=="ICC")[0])||m[2];  // "ICC/IND"->IND, "ENG/ICC"->ENG
  const rest=line.slice(m[0].length).split(/\t+|\s{2,}|\s(?=\d)|\s(?=-)/).map(s=>s.trim()).filter(s=>s!=="");
  // rest: Span Mat Inns Runs HS BatAv 100 Wkts BBI BowlAv 5 Ct St AveDiff
  const [span,mat,inns,runs,hs,batav,h100,wkts,bbi,bowlav,fw,ct,st]=rest;
  const r={name,cc,span,mat:num(mat),inns:num(inns),runs:num(runs),hs,batav:num(batav),h100:num(h100),
    wkts:num(wkts),bbi:bbi&&bbi!=="-"?bbi:null,bowlav:num(bowlav),fivew:num(fw),ct:num(ct),st:num(st)};
  if(r.mat==null||r.runs==null){flags.push(line);continue;}
  // sanity: batting average can never be below runs/innings (NO only lowers the denominator)
  if(r.inns>0&&r.batav!=null&&r.batav < r.runs/r.inns - 0.6){flags.push("[BatAv<Runs/Inns] "+line);continue;}
  rows.push(r);
}
rows.sort((a,b)=>b.mat-a.mat);
const base=path.join(path.dirname(rawfile).replace(/raw$/,"")||".",decade);
let md=`# ${decade} — Test data (real ESPNcricinfo, batting+bowling+fielding)\n\n${rows.length} players`;
if(flags.length)md+=` · ${flags.length} unparsed`;
md+=`\n\n| Player | C | Span | Mat | Inns | Runs | HS | BatAv | 100 | Wkts | BBI | BowlAv | 5w | Ct | St |\n|---|---|---|--:|--:|--:|--:|--:|--:|--:|---|--:|--:|--:|--:|\n`;
for(const r of rows)md+=`| ${r.name} | ${r.cc} | ${r.span} | ${r.mat} | ${r.inns} | ${r.runs} | ${r.hs} | ${r.batav??""} | ${r.h100??""} | ${r.wkts??""} | ${r.bbi??""} | ${r.bowlav??""} | ${r.fivew??""} | ${r.ct??""} | ${r.st??""} |\n`;
fs.writeFileSync(base+".md",md);
fs.writeFileSync(base+".json",JSON.stringify(rows.map(r=>({...r,decade})),null,0));
console.log(`${decade}: ${rows.length} players, ${flags.length} unparsed -> ${base}.md/.json`);
if(flags.length)console.log("  unparsed:",flags.slice(0,5));
