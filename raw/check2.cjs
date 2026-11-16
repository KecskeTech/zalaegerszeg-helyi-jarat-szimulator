const fs = require("fs");
const src = fs.readFileSync("js/data/zalaegerszeg.js","utf8");
const CITY = JSON.parse(src.slice(src.indexOf("{"), src.lastIndexOf("}")+1));
for (const ref of ["18","25","5"]) {
  const r = CITY.routes.find(x=>x.ref===ref);
  console.log("=== "+ref, r.length, "legs:", r.legs.join(","));
  r.stops.forEach((s,i)=>console.log("  ", i, s.s, "off", s.off, s.n));
}
