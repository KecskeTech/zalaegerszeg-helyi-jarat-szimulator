const fs=require("fs"); const src=fs.readFileSync("C:/prog/zalaegerszeg-jarat-szimulator/js/data/zalaegerszeg.js","utf8");
const CITY=JSON.parse(src.slice(src.indexOf("{"),src.lastIndexOf("}")+1));
// vasút pontok x=-1600..-600 között
const pts=[];
for(const r of CITY.rails) for(let i=0;i<r.p.length;i+=2){ const x=r.p[i],z=r.p[i+1]; if(x>-1700&&x<-500) pts.push([x,z]); }
pts.sort((a,b)=>a[0]-b[0]);
console.log("rail sample:", pts.filter((_,i)=>i%40===0).slice(0,20).map(p=>p.map(v=>Math.round(v)).join(",")).join(" | "));
// Kertvárosi ABC, Csertán, Széchenyi
for(const n of ["Kertvárosi ABC","Zalaegerszeg, Csertán Sándor utca","Széchenyi tér","Vasútállomás","Kovács Károly tér"]){ const s=CITY.stops.find(s=>s.n===n); if(s) console.log(n, Math.round(s.x), Math.round(s.z)); }
