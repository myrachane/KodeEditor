const os = require("os");
const { spawn } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

function getShell() {
  if (os.platform() === "win32") return "powershell.exe";
  return process.env.SHELL || "/bin/bash";
}

function makeId() {
  return crypto.randomBytes(12).toString("hex");
}

function createShellFallback({ cwd, onData, onExit, onError }) {
  const shellCmd = getShell();
  const args = os.platform() === "win32" ? ["-NoLogo"] : ["-i"];
  const child = spawn(shellCmd, args, {
    cwd,
    env: { ...process.env, TERM: "xterm-256color" },
    stdio: "pipe",
  });
  child.stdout?.on("data", (d) => onData?.(d.toString()));
  child.stderr?.on("data", (d) => onData?.(d.toString()));
  child.on("close", (exitCode) => onExit?.(exitCode ?? 0));
  child.on("error", (err) => onError?.(err));
  return {
    backend: "shell",
    write: (data) => child.stdin?.write(data),
    resize: () => {},
    kill: () => child.kill("SIGTERM"),
  };
}

function tryCreateNodePty({ pty, cwd, onData, onExit }) {
  if (!pty) return null;
  try {
    const proc = pty.spawn(getShell(), [], {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd,
      env: { ...process.env, TERM: "xterm-256color" },
    });
    proc.onData((data) => onData?.(data));
    proc.onExit(({ exitCode }) => onExit?.(exitCode ?? 0));
    return {
      backend: "node-pty",
      write: (data) => proc.write(data),
      resize: (cols, rows) => proc.resize(cols, rows),
      kill: () => {
        try {
          proc.kill();
        } catch (_) {}
      },
    };
  } catch (_) {
    return null;
  }
}

function safeDefaultCwd(candidate) {
  try {
    if (candidate && fs.existsSync(candidate)) return candidate;
  } catch (_) {}
  return os.homedir();
}

class PtySessions {
  constructor({ ptyModule, sendToRenderer }) {
    this.pty = ptyModule || null;
    this.send = sendToRenderer;
    this.sessions = new Map(); // id -> { proc, cwd }
  }

  create({ id, cwd } = {}) {
    const sessionId = id || makeId();
    const targetCwd = safeDefaultCwd(cwd);
    const proc =
      tryCreateNodePty({
        pty: this.pty,
        cwd: targetCwd,
        onData: (data) => this.send?.("pty:data", { sessionId, data }),
        onExit: (code) => {
          this.send?.("pty:exit", { sessionId, code });
          this.sessions.delete(sessionId);
        },
      }) ||
      createShellFallback({
        cwd: targetCwd,
        onData: (data) => this.send?.("pty:data", { sessionId, data }),
        onExit: (code) => {
          this.send?.("pty:exit", { sessionId, code });
          this.sessions.delete(sessionId);
        },
        onError: (err) => this.send?.("pty:data", { sessionId, data: `\r\n[terminal error] ${err.message}\r\n` }),
      });

    this.sessions.set(sessionId, { id: sessionId, proc, cwd: targetCwd });
    return { ok: true, sessionId, backend: proc.backend };
  }

  ensure(id, { cwd } = {}) {
    if (this.sessions.has(id)) return { ok: true, sessionId: id };
    const created = this.create({ id, cwd });
    return created.ok ? { ok: true, sessionId: created.sessionId } : { ok: false, error: "pty create failed" };
  }

  write(id, data) {
    const sess = this.sessions.get(id);
    if (!sess) return { ok: false, error: "no such session" };
    sess.proc?.write?.(data);
    return { ok: true };
  }

  resize(id, cols, rows) {
    const sess = this.sessions.get(id);
    if (!sess) return { ok: false, error: "no such session" };
    try {
      sess.proc?.resize?.(cols, rows);
    } catch (_) {}
    return { ok: true };
  }

  stop(id) {
    const sess = this.sessions.get(id);
    if (!sess) return { ok: false, error: "no such session" };
    sess.proc?.write?.("\x03");
    return { ok: true };
  }

  cd(id, dir) {
    const sess = this.sessions.get(id);
    if (!sess) return { ok: false, error: "no such session" };
    const target = safeDefaultCwd(dir);
    sess.cwd = target;
    sess.proc?.write?.(`cd "${target}"\r`);
    return { ok: true };
  }

  run(id, { cmd, options = {}, workspace, cloneWorkspaceToIsolation }) {
    const sess = this.sessions.get(id);
    if (!sess) return { ok: false, error: "no such session" };
    const payloadCmd = String(cmd || "");
    if (!payloadCmd) return { ok: false, error: "missing cmd" };
    const isWin = os.platform() === "win32";
    const joiner = isWin ? ";" : "&&";

    let runBase = workspace || sess.cwd || os.homedir();
    let isolated = false;
    const isolate = Boolean(options?.isolate);
    const doClone = typeof cloneWorkspaceToIsolation === "function";
    if (isolate && workspace && doClone) {
      // Best-effort; isolation failures fall back to normal workspace.
      return (async () => {
        try {
          runBase = await cloneWorkspaceToIsolation(workspace);
          isolated = true;
        } catch (error) {
          this.send?.("pty:data", { sessionId: id, data: `\r\n[isolation warning] ${error.message}\r\n` });
          runBase = workspace;
        }
        this.send?.("run:context", {
          sessionId: id,
          isolated,
          workspace: workspace || null,
          runWorkspace: runBase || null,
          command: payloadCmd,
          at: Date.now(),
        });
        const full = runBase ? `cd "${runBase}" ${joiner} ${payloadCmd}\r` : `${payloadCmd}\r`;
        sess.proc?.write?.(full);
        return { ok: true };
      })();
    }

    this.send?.("run:context", {
      sessionId: id,
      isolated,
      workspace: workspace || null,
      runWorkspace: runBase || null,
      command: payloadCmd,
      at: Date.now(),
    });
    const full = runBase ? `cd "${runBase}" ${joiner} ${payloadCmd}\r` : `${payloadCmd}\r`;
    sess.proc?.write?.(full);
    return { ok: true };
  }

  dispose(id) {
    const sess = this.sessions.get(id);
    if (!sess) return { ok: true };
    try {
      sess.proc?.kill?.();
    } catch (_) {}
    this.sessions.delete(id);
    return { ok: true };
  }

  disposeAll() {
    for (const id of this.sessions.keys()) this.dispose(id);
  }
}

module.exports = { PtySessions };

