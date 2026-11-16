// Egyszerű helyi webszerver a szimulátorhoz (nincs függőség).
// Indítás:  node server.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";

const ROOT = import.meta.dirname;
const PORT = Number(process.env.PORT || 8123);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
  if (!path.normalize(filePath).startsWith(ROOT)) {
    res.writeHead(403).end("Tiltott útvonal");
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, "index.html");
    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Nem található: " + urlPath);
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`Zalaegerszeg helyi járat szimulátor fut: ${url}`);
  console.log("Leállítás: Ctrl+C");
  if (process.platform === "win32" && !process.env.NO_OPEN) {
    exec(`start "" "${url}"`);
  }
});
