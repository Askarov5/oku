#!/usr/bin/env node
/**
 * Stop whatever is listening on the AI worker port, then start
 * services/ai-worker with env from apps/web/.env.local.
 *
 *   pnpm worker:restart
 *   pnpm worker:restart -- --foreground
 *   pnpm worker:restart -- --live
 *   pnpm worker:restart -- --mock
 *   pnpm worker:restart -- --port 8000
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, openSync, readFileSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER_DIR = join(ROOT, "services", "ai-worker");
const WEB_ENV = join(ROOT, "apps", "web", ".env.local");
const LOG_FILE = join(WORKER_DIR, ".worker.log");
const DEFAULT_PORT = 8000;

const args = new Set(process.argv.slice(2));
const foreground = args.has("--foreground") || args.has("-f");
const forceMock = args.has("--mock");
const forceLive = args.has("--live");
const portArg = process.argv.find((a) => a.startsWith("--port="));
const portIndex = process.argv.indexOf("--port");
const port = Number(
  portArg?.slice("--port=".length) ??
    (portIndex >= 0 ? process.argv[portIndex + 1] : DEFAULT_PORT),
);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${port}`);
  process.exit(1);
}

const readDotEnv = (path) => {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
};

const pidsListeningOn = (listenPort) => {
  if (process.platform === "win32") {
    const out = execFileSync("netstat", ["-ano", "-p", "tcp"], {
      encoding: "utf8",
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      // Proto LocalAddress ForeignAddress State PID
      if (parts.length < 5) continue;
      const local = parts[1] ?? "";
      const pid = parts[parts.length - 1] ?? "";
      if (!/^\d+$/.test(pid)) continue;
      if (
        local.endsWith(`:${listenPort}`) ||
        local.endsWith(`:${listenPort}]`)
      ) {
        pids.add(pid);
      }
    }
    return [...pids];
  }

  try {
    const out = execFileSync(
      "lsof",
      [`-tiTCP:${listenPort}`, "-sTCP:LISTEN"],
      { encoding: "utf8" },
    );
    return out
      .trim()
      .split(/\s+/)
      .filter((pid) => /^\d+$/.test(pid));
  } catch {
    return [];
  }
};

const killPids = (pids) => {
  for (const pid of pids) {
    try {
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/PID", pid, "/T", "/F"], {
          stdio: "ignore",
        });
      } else {
        process.kill(Number(pid), "SIGTERM");
      }
      console.log(`Stopped PID ${pid}`);
    } catch {
      // Already gone.
    }
  }
};

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

const waitForHealth = async (listenPort, timeoutMs = 20_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${listenPort}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) return true;
    } catch {
      // Not up yet.
    }
    await wait(400);
  }
  return false;
};

const venvPython = () => {
  const win = join(WORKER_DIR, ".venv", "Scripts", "python.exe");
  const unix = join(WORKER_DIR, ".venv", "bin", "python");
  if (existsSync(win)) return win;
  if (existsSync(unix)) return unix;
  return null;
};

const python = venvPython();
if (!python) {
  console.error(
    "Missing services/ai-worker/.venv. Create it first (see README).",
  );
  process.exit(1);
}

const fileEnv = readDotEnv(WEB_ENV);
const pids = pidsListeningOn(port);
if (pids.length > 0) {
  console.log(`Port ${port} in use by: ${pids.join(", ")}`);
  killPids(pids);
  await wait(800);
} else {
  console.log(`Port ${port} is free`);
}

const hasGeminiKey = Boolean(
  (fileEnv.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "").trim(),
);
// Prefer live extraction when a key is present; --mock / --live override.
const mockFromEnv =
  (fileEnv.MOCK_LLM ?? process.env.MOCK_LLM ?? "false").toLowerCase() ===
  "true";
const mockLlm = forceMock
  ? true
  : forceLive
    ? false
    : hasGeminiKey
      ? false
      : mockFromEnv;

// Web .env uses a path relative to apps/web (../../.r2-local → repo/.r2-local).
// The worker resolves relative LOCAL_STORAGE_DIR from the repo root, so the same
// value would point at Desktop/.r2-local. Always pass an absolute repo path.
const localStorageDir = join(ROOT, ".r2-local");

const env = {
  ...process.env,
  ...fileEnv,
  DATABASE_URL:
    fileEnv.DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://oku:oku@localhost:5432/oku",
  STORAGE_DRIVER: fileEnv.STORAGE_DRIVER ?? process.env.STORAGE_DRIVER ?? "local",
  LOCAL_STORAGE_DIR: localStorageDir,
  MOCK_LLM: mockLlm ? "true" : "false",
  PYTHONIOENCODING: "utf-8",
  PYTHONUNBUFFERED: "1",
};

// Avoid carrying a stale shell override into the child.
delete env.LLM_MODEL;

const uvicornArgs = [
  "-m",
  "uvicorn",
  "app.main:app",
  "--host",
  "127.0.0.1",
  "--port",
  String(port),
];

console.log(
  `Starting worker (${mockLlm ? "mock" : "live LLM"}) on http://127.0.0.1:${port}`,
);
console.log(`Storage ${localStorageDir}`);

if (foreground) {
  const child = spawn(python, uvicornArgs, {
    cwd: WORKER_DIR,
    env,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
} else {
  const logFd = openSync(LOG_FILE, "a");
  writeSync(
    logFd,
    `\n----- restart ${new Date().toISOString()} port=${port} mock=${mockLlm} -----\n`,
  );
  const child = spawn(python, uvicornArgs, {
    cwd: WORKER_DIR,
    env,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    windowsHide: true,
  });
  child.unref();
  console.log(`PID ${child.pid}`);
  console.log(`Log ${LOG_FILE}`);

  const ok = await waitForHealth(port);
  if (!ok) {
    console.error("Worker did not become healthy in time. Check the log.");
    process.exit(1);
  }
  console.log("Health ok — new code is loaded.");
}
