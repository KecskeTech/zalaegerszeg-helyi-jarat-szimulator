const fs=require("fs"); const src=fs.readFileSync("C:/prog/zalaegerszeg-jarat-szimulator/js/data/zalaegerszeg.js","utf8");
const CITY=JSON.parse(src.slice(src.indexOf("{"),src.lastIndexOf("}")+1));
for (const r of CITY.rails) {
  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
  for(let i=0;i<r.p.length;i+=2){minX=Math.min(minX,r.p[i]);maxX=Math.max(maxX,r.p[i]);minZ=Math.min(minZ,r.p[i+1]);maxZ=Math.max(maxZ,r.p[i+1]);}
  if (maxX-minX>200) console.log("rail bbox", Math.round(minX),Math.round(maxX),Math.round(minZ),Math.round(maxZ), "len", r.p.length/2);
}
// utak, amelyek átérnek z=1500 és z=1700 között x=-1300..-800
console.log("--- roads crossing z 1400..1750, x -1400..-700 ---");
for (const r of CITY.roads) {
  let has=[];
  for(let i=0;i<r.p.length-2;i+=2){ const x=r.p[i],z=r.p[i+1]; if(x>-1400&&x<-700&&z>1400&&z<1750) has.push(Math.round(x)+","+Math.round(z)); }
  if (has.length>0 && r.w>=6) console.log(r.t, r.n, has.length, has.slice(0,3).join(" "));
}
