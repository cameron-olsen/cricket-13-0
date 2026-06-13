const fs=require('fs'),path=require('path');
const SRC='data/sr-source';
const DECS=["1930s","1940s","1950s","1960s","1970s","1980s","1990s","2000s","2010s","2020s"];
const num=s=>{if(s==null)return null;s=String(s).replace(/[+*]/g,'').trim();if(s===''||s==='-')return null;const v=parseFloat(s);return isFinite(v)?v:null;};
const SR={};
for(const dec of DECS){
  const lines=fs.readFileSync(path.join(SRC,dec+'.txt'),'utf8').split(/\r?\n/);
  let section=null,curName=null;
  for(const ln of lines){
    if(/=+\s*BATTING/i.test(ln)){section='bat';curName=null;continue;}
    if(/=+\s*BOWLING/i.test(ln)){section='bowl';curName=null;continue;}
    if(/^\s*#/.test(ln)||ln.trim()==='')continue;
    const nm=ln.match(/^(.+?)\s*\(([A-Za-z\/]+)\)\s*$/);
    if(nm){curName=nm[1].trim();continue;}
    if(curName&&/^\s*\d{4}/.test(ln)){
      const after=ln.split('\t').map(s=>s.trim()).slice(1);
      const rec=(SR[curName]=SR[curName]||{}),d=(rec[dec]=rec[dec]||{});
      if(section==='bat')d.batSR=num(after[7]); else d.bowlSR=num(after[12]);
      curName=null;
    }
  }
}
const d=fs.readFileSync('index.html','utf8');
function grab(v){const i=d.indexOf('const '+v+'=');const s=d.indexOf('=',i)+1;let dep=0,j=s,inS=false,q='';for(;j<d.length;j++){const c=d[j];if(inS){if(c===q&&d[j-1]!=='\\')inS=false;continue;}if(c==='"'||c==="'"){inS=true;q=c;continue;}if(c==='['||c==='{')dep++;else if(c===']'||c==='}'){dep--;if(dep===0){j++;break;}}}return d.slice(s,j);}
const DATA=eval(grab('DATA')); const SRX=eval('('+grab('SRX')+')');
const SRX2={};
let nb=0,nw=0;
for(const a of DATA){const name=a[0],eras=a[3];
  for(const dec in eras){const wkts=eras[dec][3];const sx=(SRX[name]||{})[dec];const src=(SR[name]||{})[dec];
    const needBat=!(sx&&sx[3]!=null), needBowl=wkts>=20&&!(sx&&sx[5]!=null);
    let bat=null,bowl=null;
    if(needBat&&src&&src.batSR>0){bat=src.batSR;nb++;}
    if(needBowl&&src&&src.bowlSR>0){bowl=src.bowlSR;nw++;}
    if(bat!=null||bowl!=null){(SRX2[name]=SRX2[name]||{});SRX2[name][dec]=[bat,bowl];}
  }
}
// minified, drop trailing nulls where possible but keep 2-elem for bowl-only -> need [null,bowl]
const json=JSON.stringify(SRX2);
fs.writeFileSync('/tmp/SRX2.min.json',json);
console.log('SRX2 players:',Object.keys(SRX2).length,'batFills:',nb,'bowlFills:',nw,'bytes:',json.length);
console.log('sample:',json.slice(0,300));
