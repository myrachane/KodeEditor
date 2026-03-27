// electron/main.js — Phase 4
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path  = require("path");
const fs    = require("fs");
const os    = require("os");
const https = require("https");
const net = require("net");
const { spawn } = require("child_process");
const { spawnSync } = require("child_process");
const { PtySessions } = require("./services/ptySessions");
const { searchWorkspace } = require("./services/search");
const { getChangedFiles, getDiff, stageFile, unstageFile, commit, getBranch } = require("./services/git");
const { loadUserSettings, saveUserSettings, loadWorkspaceSettings, saveWorkspaceSettings, getMergedSettings } = require("./services/settings");

let pty = null;
const SHOULD_USE_NODE_PTY = process.env.VISRODECK_USE_NODE_PTY === "1";
if (SHOULD_USE_NODE_PTY) {
  try {
    pty = require("node-pty");
  } catch (error) {
    console.warn("[studio] node-pty unavailable, using shell fallback:", error.message);
  }
} else {
  console.warn("[studio] using stable shell backend (set VISRODECK_USE_NODE_PTY=1 to enable node-pty)");
}

process.on("uncaughtException", (err) => {
  console.error("[studio] uncaughtException:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[studio] unhandledRejection:", err);
});

// Low-end / Linux: optional GPU disable to avoid compositor hangs (set VISRODECK_LOW_GPU=1 to enable)
if (process.env.VISRODECK_LOW_GPU === "1" || process.platform === "linux") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
}
if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
}

const isDev = !app.isPackaged;

let win       = null;
let workspace = null;
let lastPreparedRunFile = null;
let depBaseline = null;
let lastIsolationDir = null;
let ptySessions = null;

const IGNORED = new Set([
  "node_modules",".git",".DS_Store","dist","build",
  ".next",".nuxt",".vite","__pycache__",".cache",
  "coverage",".nyc_output",".turbo",
]);
const TREE_LIMITS = {
  root: { maxDepth: 1, maxEntriesPerDir: 120, maxTotal: 600 },
  list: { maxDepth: 0, maxEntriesPerDir: 160, maxTotal: 260 },
};
let treeBuildToken = 0;

function getShell() {
  if (os.platform() === "win32") return "powershell.exe";
  return process.env.SHELL || "/bin/bash";
}

function normCase(p) {
  const resolved = path.resolve(String(p || ""));
  return os.platform() === "win32" ? resolved.toLowerCase() : resolved;
}

function isInsideWorkspace(targetPath) {
  if (!workspace) return false;
  const base = normCase(workspace);
  const target = normCase(targetPath);
  const rel = path.relative(base, target);
  if (!rel) return true;
  if (rel === "") return true;
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  return true;
}

function guardWorkspacePath(targetPath) {
  if (!workspace) return { ok: false, error: "No workspace selected" };
  if (!targetPath) return { ok: false, error: "Missing path" };
  const resolved = path.resolve(String(targetPath));
  if (!isInsideWorkspace(resolved)) return { ok: false, error: "Path outside workspace" };
  return { ok: true, path: resolved };
}

function isSafeRenameName(name) {
  const n = String(name || "");
  if (!n.trim()) return false;
  if (n.includes("/") || n.includes("\\") || n.includes("..")) return false;
  return true;
}

// ── File tree ─────────────────────────────────────────────────
async function buildTree(dir, limits = TREE_LIMITS.root, depth = 0, state = { count: 0, ticks: 0 }) {
  if (depth > limits.maxDepth || state.count >= limits.maxTotal) return [];
  let entries;
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const visible = entries
    .filter(e => !IGNORED.has(e.name) && !e.name.startsWith("."))
    .filter(e => !e.isSymbolicLink())
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const limited = visible.slice(0, limits.maxEntriesPerDir);
  const nodes = [];
  for (const e of limited) {
    if (state.count >= limits.maxTotal) break;
    state.count += 1;
    state.ticks += 1;
    if (state.ticks % 80 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }

    const fp = path.join(dir, e.name);
    if (e.isDirectory()) {
      const canRecurse = depth < limits.maxDepth;
      nodes.push({
        type: "directory",
        name: e.name,
        path: fp,
        children: canRecurse ? await buildTree(fp, limits, depth + 1, state) : null,
      });
    } else {
      nodes.push({ type: "file", name: e.name, path: fp });
    }
  }

  if (visible.length > limits.maxEntriesPerDir) {
    nodes.push({
      type: "file",
      name: `... ${visible.length - limits.maxEntriesPerDir} more items`,
      path: path.join(dir, "__visrodeck_truncated__"),
      meta: { truncated: true },
    });
  }
  return nodes;
}

async function pushTree(mode = "root") {
  if (!workspace || !win?.webContents) return;
  const token = ++treeBuildToken;
  const limits = mode === "list" ? TREE_LIMITS.list : TREE_LIMITS.root;
  const tree = await buildTree(workspace, limits);
  if (token !== treeBuildToken) return;
  win.webContents.send("fs:treeUpdate", tree);
}

// ── PTY ───────────────────────────────────────────────────────
function ensurePtySessions() {
  if (ptySessions) return;
  ptySessions = new PtySessions({
    ptyModule: pty,
    sendToRenderer: (ch, payload) => win?.webContents?.send(ch, payload),
  });
}

function stripGhostBlocks(content = "") {
  const lines = content.split(/\r?\n/);
  const out = [];
  let ghostDepth = 0;
  for (const line of lines) {
    if (line.includes("GHOST-START")) { ghostDepth += 1; continue; }
    if (line.includes("GHOST-END")) { ghostDepth = Math.max(0, ghostDepth - 1); continue; }
    if (ghostDepth === 0) out.push(line);
  }
  return out.join("\n");
}

function runGit(args, cwd) {
  const bin = os.platform() === "win32" ? "git.exe" : "git";
  try {
    const res = spawnSync(bin, args, {
      cwd,
      encoding: "utf8",
      timeout: 2500,
    });
    if (res.error) return { ok: false, error: res.error.message };
    if (res.status !== 0) return { ok: false, error: (res.stderr || res.stdout || "").trim() || "git failed" };
    return { ok: true, out: (res.stdout || "").trim() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function safeMtime(target) {
  try {
    return fs.statSync(target).mtimeMs;
  } catch (_) {
    return 0;
  }
}

function detectLockfile(baseDir) {
  const candidates = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];
  for (const file of candidates) {
    const full = path.join(baseDir, file);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function captureDependencySnapshot(baseDir) {
  const packageJson = path.join(baseDir, "package.json");
  const lockfile = detectLockfile(baseDir);
  const nodeModules = path.join(baseDir, "node_modules");
  return {
    packageJsonMtime: safeMtime(packageJson),
    lockfilePath: lockfile,
    lockfileMtime: lockfile ? safeMtime(lockfile) : 0,
    nodeModulesMtime: safeMtime(nodeModules),
  };
}

function dependencyStatus(baseDir) {
  if (!baseDir || !fs.existsSync(baseDir)) return { ok: false, error: "No workspace selected" };
  const now = captureDependencySnapshot(baseDir);
  const baseline = depBaseline || now;
  const nodeModulesChanged = Boolean(baseline.nodeModulesMtime && now.nodeModulesMtime && now.nodeModulesMtime !== baseline.nodeModulesMtime);
  const lockfileMismatch = Boolean(now.lockfilePath && now.packageJsonMtime && now.lockfileMtime && now.packageJsonMtime > now.lockfileMtime);
  const dependencyDrift = Boolean(now.lockfilePath && now.lockfileMtime && now.nodeModulesMtime && now.lockfileMtime > now.nodeModulesMtime);
  const alerts = [];
  if (nodeModulesChanged) alerts.push("node_modules changed");
  if (lockfileMismatch) alerts.push("lockfile mismatch");
  if (dependencyDrift) alerts.push("dependency drift");
  return {
    ok: true,
    workspace: baseDir,
    nodeModulesChanged,
    lockfileMismatch,
    dependencyDrift,
    alerts,
    lockfile: now.lockfilePath ? path.basename(now.lockfilePath) : null,
    baselineTime: depBaseline ? depBaseline.nodeModulesMtime : 0,
    snapshot: now,
  };
}

async function cloneWorkspaceToIsolation(baseDir) {
  const isoRoot = path.join(os.tmpdir(), "visrodeck-isolation");
  await fs.promises.mkdir(isoRoot, { recursive: true });
  const target = path.join(isoRoot, `${path.basename(baseDir)}-${Date.now()}`);
  await fs.promises.cp(baseDir, target, { recursive: true, force: true });
  lastIsolationDir = target;
  return target;
}

// ── Jane AI via Anthropic API ─────────────────────────────────
function callAnthropic(systemPrompt, userMsg, history) {
  return new Promise((resolve, reject) => {
    // Read key from env — set ANTHROPIC_API_KEY in your shell profile
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    if (!apiKey) { resolve("Set ANTHROPIC_API_KEY env var to use Jane."); return; }

    const messages = [
      ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: userMsg }
    ];

    const body = JSON.stringify({
      model: "claude-opus-4-5-20251101",
      max_tokens: 1024,
      system: systemPrompt || "You are Jane, a helpful coding assistant in Visrodeck Studio. Be concise and practical.",
      messages,
    });

    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content?.[0]?.text || "No response");
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── IPC ───────────────────────────────────────────────────────
ipcMain.handle("dialog:openFolder", async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"], title: "Select Workspace",
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle("workspace:set", async (_, dir) => {
  if (!dir || !fs.existsSync(dir)) return { ok: false };
  try {
    workspace = path.resolve(dir);
    depBaseline = captureDependencySnapshot(workspace);
    treeBuildToken += 1;
    // Return immediately to keep renderer responsive, then load in background.
    setTimeout(() => {
      void pushTree("root");
    }, 10);
    return { ok: true, tree: [] };
  } catch (e) {
    console.error("[studio] workspace:set failed:", e);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("fs:tree", async (_, d) => {
  const base = workspace;
  if (!base) return { tree: [] };
  const target = d || base;
  const g = guardWorkspacePath(target);
  if (!g.ok) return { tree: [] };
  return { tree: await buildTree(g.path, TREE_LIMITS.list) };
});

ipcMain.handle("fs:read", (_, fp) => {
  const g = guardWorkspacePath(fp);
  if (!g.ok) return { error: g.error };
  try {
    return { content: fs.readFileSync(g.path, "utf8") };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("fs:write", (_, { fp, content }) => {
  const g = guardWorkspacePath(fp);
  if (!g.ok) return { error: g.error };
  try {
    fs.mkdirSync(path.dirname(g.path), { recursive: true });
    fs.writeFileSync(g.path, String(content ?? ""), "utf8");
    void pushTree("root");
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("fs:mkdir", (_, d) => {
  const g = guardWorkspacePath(d);
  if (!g.ok) return { error: g.error };
  try {
    fs.mkdirSync(g.path, { recursive: true });
    void pushTree("root");
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("fs:rename", (_, { from, name }) => {
  if (!isSafeRenameName(name)) return { error: "Invalid name" };
  const g = guardWorkspacePath(from);
  if (!g.ok) return { error: g.error };
  try {
    const dest = path.resolve(path.join(path.dirname(g.path), String(name)));
    const gd = guardWorkspacePath(dest);
    if (!gd.ok) return { error: gd.error };
    fs.renameSync(g.path, gd.path);
    void pushTree("root");
    return { ok: true, path: gd.path };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("fs:delete", (_, fp) => {
  const g = guardWorkspacePath(fp);
  if (!g.ok) return { error: g.error };
  try {
    const st = fs.statSync(g.path);
    st.isDirectory() ? fs.rmSync(g.path, { recursive: true, force: true }) : fs.unlinkSync(g.path);
    void pushTree("root");
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("fs:writeBinary", (_, { fp, base64 }) => {
  const g = guardWorkspacePath(fp);
  if (!g.ok) return { error: g.error };
  try {
    const data = Buffer.from(String(base64 || ""), "base64");
    fs.mkdirSync(path.dirname(g.path), { recursive: true });
    fs.writeFileSync(g.path, data);
    void pushTree("root");
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("fs:importPaths", async (_, payload = {}) => {
  const targetDir = payload.targetDir || workspace;
  const g = guardWorkspacePath(targetDir);
  if (!g.ok) return { error: g.error };
  const paths = Array.isArray(payload.paths) ? payload.paths : [];
  if (!paths.length) return { ok: true, imported: 0 };

  let imported = 0;
  const copyOne = async (sourcePath) => {
    const src = path.resolve(String(sourcePath || ""));
    if (!src || !fs.existsSync(src)) return;
    const baseName = path.basename(src);
    const dest = path.join(g.path, baseName);
    const st = fs.statSync(src);
    if (st.isDirectory()) {
      await fs.promises.cp(src, dest, { recursive: true, force: true });
    } else {
      await fs.promises.copyFile(src, dest);
    }
    imported += 1;
  };

  try {
    for (const p of paths) {
      // importing from outside workspace into workspace is allowed by design.
      await copyOne(p);
    }
    void pushTree("root");
    return { ok: true, imported };
  } catch (e) {
    return { error: e.message, imported };
  }
});

ipcMain.handle("pty:create", (_, { cwd } = {}) => {
  ensurePtySessions();
  return ptySessions.create({ cwd: cwd || workspace || os.homedir() });
});

ipcMain.handle("pty:dispose", (_, { sessionId }) => {
  ensurePtySessions();
  return ptySessions.dispose(String(sessionId || ""));
});

ipcMain.on("pty:input", (_, payload) => {
  ensurePtySessions();
  const sessionId = typeof payload === "object" && payload ? payload.sessionId : "default";
  const data = typeof payload === "object" && payload ? payload.data : payload;
  ptySessions.ensure(String(sessionId), { cwd: workspace || os.homedir() });
  ptySessions.write(String(sessionId), String(data || ""));
});

ipcMain.on("pty:resize", (_, payload) => {
  ensurePtySessions();
  const sessionId = String(payload?.sessionId || "default");
  ptySessions.ensure(sessionId, { cwd: workspace || os.homedir() });
  ptySessions.resize(sessionId, Number(payload?.cols || 0), Number(payload?.rows || 0));
});

ipcMain.on("pty:run", async (_, payload) => {
  ensurePtySessions();
  const sessionId = String(payload?.sessionId || "default");
  ptySessions.ensure(sessionId, { cwd: workspace || os.homedir() });
  await ptySessions.run(sessionId, {
    cmd: payload?.cmd,
    options: payload?.options || {},
    workspace,
    cloneWorkspaceToIsolation,
  });
});

ipcMain.on("pty:stop", (_, payload) => {
  ensurePtySessions();
  const sessionId = String(payload?.sessionId || "default");
  ptySessions.ensure(sessionId, { cwd: workspace || os.homedir() });
  ptySessions.stop(sessionId);
});

ipcMain.on("pty:cd", (_, payload) => {
  ensurePtySessions();
  const sessionId = String(payload?.sessionId || "default");
  const dir = payload?.dir || payload;
  ptySessions.ensure(sessionId, { cwd: workspace || os.homedir() });
  ptySessions.cd(sessionId, String(dir || workspace || os.homedir()));
});

// Jane AI
ipcMain.handle("jane:ask", async (_, { system, userMsg, history }) => {
  try { return await callAnthropic(system, userMsg, history || []); }
  catch(e) { return `Error: ${e.message}`; }
});

ipcMain.on("win:minimize",  () => win?.minimize());
ipcMain.on("win:maximize",  () => win?.isMaximized() ? win.unmaximize() : win?.maximize());
ipcMain.on("win:close",     () => win?.close());
ipcMain.handle("win:isMaximized", () => win?.isMaximized() ?? false);
ipcMain.on("shell:open",    (_, p) => shell.openPath(p));

ipcMain.handle("system:stats", () => {
  try {
    const mu = process.memoryUsage();
    const cu = process.cpuUsage();
    return {
      ok: true,
      rssMB: Math.round(mu.rss / 1024 / 1024 * 10) / 10,
      heapUsedMB: Math.round(mu.heapUsed / 1024 / 1024 * 10) / 10,
      externalMB: Math.round((mu.external || 0) / 1024 / 1024 * 10) / 10,
      cpuUser: cu.user,
      cpuSystem: cu.system,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("system:resolveInterpreter", (_, pref) => {
  const isWin = os.platform() === "win32";
  const candidates = {
    auto: isWin ? ["python", "py", "node", "deno", "bun"] : ["python3", "python", "node", "deno", "bun"],
    python: isWin ? ["python", "py"] : ["python3", "python"],
    node: ["node"],
    ts: ["ts-node", "tsx", "node"],
    deno: ["deno"],
    bun: ["bun"],
  }[pref] || ["node"];

  const whichCmd = os.platform() === "win32" ? "where" : "which";
  for (const cmd of candidates) {
    try {
      const res = spawnSync(whichCmd, [cmd], { stdio: "ignore" });
      if (res.status === 0) return { ok: true, command: cmd };
    } catch (_) {}
  }
  return { ok: false, checked: candidates };
});

ipcMain.handle("system:testDb", async (_, config = {}) => {
  const host = String(config.host || "").trim() || "127.0.0.1";
  const port = Number(config.port || 0);
  const timeoutMs = Number(config.timeoutMs || 2500);
  if (!port || Number.isNaN(port)) return { ok: false, error: "Invalid port" };

  return await new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (_) {}
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done({ ok: true, message: `Connected to ${host}:${port}` }));
    socket.once("timeout", () => done({ ok: false, error: "Connection timeout" }));
    socket.once("error", (err) => done({ ok: false, error: err.message }));
    socket.connect(port, host);
  });
});

ipcMain.handle("dep:status", () => dependencyStatus(workspace));

ipcMain.handle("search:query", async (_, payload = {}) => {
  if (!workspace) return { ok: false, error: "No workspace selected", results: [] };
  const q = String(payload.q || "").trim();
  if (!q) return { ok: true, results: [] };
  const maxResults = Math.max(1, Math.min(600, Number(payload.maxResults || 200)));
  try {
    const results = await searchWorkspace({ root: workspace, q, maxResults });
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: e.message, results: [] };
  }
});

ipcMain.handle("run:prepare", (_, { filePath, content }) => {
  try {
    if (!filePath) return { ok: false, error: "Missing file path" };
    const g = guardWorkspacePath(filePath);
    if (!g.ok) return { ok: false, error: g.error };
    if (lastPreparedRunFile && fs.existsSync(lastPreparedRunFile)) {
      try { fs.unlinkSync(lastPreparedRunFile); } catch (_) {}
    }
    const ext = path.extname(g.path) || ".txt";
    const dir = path.dirname(g.path);
    const base = path.basename(g.path, ext);
    const tempName = `.${base}.visrodeck-run.${Date.now()}${ext}`;
    const tempPath = path.join(dir, tempName);
    const prepared = stripGhostBlocks(content || "");
    fs.writeFileSync(tempPath, prepared, "utf8");
    lastPreparedRunFile = tempPath;
    return { ok: true, path: tempPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("run:cleanup", (_, fp) => {
  const target = fp || lastPreparedRunFile;
  if (!target) return { ok: true };
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (_) {}
  if (target === lastPreparedRunFile) lastPreparedRunFile = null;
  return { ok: true };
});

ipcMain.handle("git:status", async () => {
  if (!workspace) return { ok: false, error: "No workspace selected" };
  const branchRes = await getBranch(workspace);
  if (!branchRes.ok) return branchRes;
  const changedRes = await getChangedFiles(workspace);
  if (!changedRes.ok) return changedRes;
  const aheadBehindRes = runGit(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], workspace);
  let ahead = 0;
  let behind = 0;
  if (aheadBehindRes.ok && aheadBehindRes.out) {
    const parts = aheadBehindRes.out.split(/\s+/).map(n => Number(n || 0));
    ahead = Number.isFinite(parts[0]) ? parts[0] : 0;
    behind = Number.isFinite(parts[1]) ? parts[1] : 0;
  }
  return {
    ok: true,
    branch: branchRes.branch || "detached",
    changed: changedRes.files?.map(f => f.path) || [],
    ahead,
    behind,
  };
});

ipcMain.handle("git:changedFiles", async () => {
  if (!workspace) return { ok: false, error: "No workspace selected", files: [] };
  return await getChangedFiles(workspace);
});

ipcMain.handle("git:diff", async (_, { path: filePath }) => {
  if (!workspace) return { ok: false, error: "No workspace selected", diff: "" };
  return await getDiff(workspace, filePath);
});

ipcMain.handle("git:stage", async (_, { path: filePath }) => {
  if (!workspace) return { ok: false, error: "No workspace selected" };
  return await stageFile(workspace, filePath);
});

ipcMain.handle("git:unstage", async (_, { path: filePath }) => {
  if (!workspace) return { ok: false, error: "No workspace selected" };
  return await unstageFile(workspace, filePath);
});

ipcMain.handle("git:commit", async (_, { message }) => {
  if (!workspace) return { ok: false, error: "No workspace selected" };
  return await commit(workspace, message);
});

ipcMain.handle("settings:load", async (_, { scope = "user" } = {}) => {
  if (scope === "workspace") {
    return { ok: true, settings: loadWorkspaceSettings(workspace) };
  }
  return { ok: true, settings: loadUserSettings() };
});

ipcMain.handle("settings:save", async (_, { settings, scope = "user" } = {}) => {
  if (scope === "workspace") {
    return saveWorkspaceSettings(workspace, settings);
  }
  return saveUserSettings(settings);
});

ipcMain.handle("settings:merged", async () => {
  return { ok: true, settings: getMergedSettings(workspace) };
});

// ── Window ────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    frame: false, backgroundColor: "#0a0a0b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
    show: false,
  });
  const targetUrl = "http://localhost:5173";
  const targetFile = path.join(__dirname, "../dist/index.html");
  isDev ? win.loadURL(targetUrl) : win.loadFile(targetFile);
  win.webContents.on("did-fail-load", (_, errorCode, errorDescription, validatedURL) => {
    console.error("[studio] did-fail-load:", { errorCode, errorDescription, validatedURL });
    if (isDev) {
      setTimeout(() => {
        if (!win?.isDestroyed()) win.loadURL(targetUrl).catch(() => {});
      }, 1000);
      return;
    }
    const safeHtml = `
      <html><body style="margin:0;background:#0b111b;color:#e8f0fc;font-family:JetBrains Mono,monospace;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div style="width:min(720px,96vw);background:#111b2d;border:1px solid #2a3f5e;border-radius:10px;padding:16px;">
          <div style="font-size:12px;letter-spacing:.14em;color:#9eb3d3;margin-bottom:8px;">VISRODECK RECOVERY</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px;">Failed to load renderer</div>
          <div style="font-size:12px;color:#b8cbe7;margin-bottom:8px;">${errorDescription || "Unknown load error"} (${errorCode})</div>
          <div style="font-size:11px;color:#87a0c5;">URL: ${validatedURL || "n/a"}</div>
        </div>
      </body></html>`;
    win?.loadURL(`data:text/html,${encodeURIComponent(safeHtml)}`).catch(() => {});
  });
  win.webContents.on("console-message", (_, level, message, line, sourceId) => {
    if (level >= 2) {
      console.error("[studio][renderer]", { message, line, sourceId });
    }
  });
  win.webContents.on("unresponsive", () => {
    console.error("[studio] renderer became unresponsive");
  });
  win.webContents.on("render-process-gone", (_, details) => {
    console.error("[studio] render-process-gone:", details);
    if (details?.reason !== "clean-exit") {
      setTimeout(() => {
        if (!win?.isDestroyed()) {
          if (isDev) win.loadURL(targetUrl).catch(() => {});
          else win.loadFile(targetFile).catch(() => {});
        }
      }, 900);
    }
  });
  win.once("ready-to-show", () => { win.show(); });
  win.on("closed", () => {
    try { ptySessions?.disposeAll?.(); } catch (_) {}
    win = null;
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  try { ptySessions?.disposeAll?.(); } catch (_) {}
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => { if(BrowserWindow.getAllWindows().length===0) createWindow(); });
