const { spawn } = require("child_process");
const os = require("os");
const path = require("path");

function getGitBin() {
  return os.platform() === "win32" ? "git.exe" : "git";
}

function runGitAsync(args, cwd, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const bin = getGitBin();
    const proc = spawn(bin, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const done = (result) => {
      if (settled) return;
      settled = true;
      try {
        proc.kill();
      } catch (_) {}
      resolve(result);
    };

    const timer = setTimeout(() => {
      done({ ok: false, error: "Timeout" });
    }, timeoutMs);

    proc.stdout?.on("data", (chunk) => {
      stdout += String(chunk || "");
    });

    proc.stderr?.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      done({ ok: false, error: err.message });
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        done({ ok: false, error: (stderr || stdout || "git failed").trim() });
        return;
      }
      done({ ok: true, out: stdout.trim() });
    });
  });
}

async function getChangedFiles(workspace) {
  if (!workspace) return { ok: false, error: "No workspace" };
  const res = await runGitAsync(["status", "--porcelain"], workspace);
  if (!res.ok) return res;

  const lines = (res.out || "").split(/\r?\n/).filter(Boolean);
  const files = [];
  for (const line of lines) {
    const status = line.slice(0, 2).trim();
    const filePath = line.slice(3).trim();
    if (!filePath) continue;
    const staged = status[0] !== " " && status[0] !== "?";
    const unstaged = status[1] !== " " && status[1] !== "?";
    files.push({
      path: filePath,
      staged,
      unstaged,
      status: status,
      isNew: status.includes("?"),
      isDeleted: status.includes("D"),
      isModified: status.includes("M"),
      isRenamed: status.includes("R"),
    });
  }
  return { ok: true, files };
}

async function getDiff(workspace, filePath) {
  if (!workspace || !filePath) return { ok: false, error: "Missing params" };
  const res = await runGitAsync(["diff", "HEAD", "--", filePath], workspace, 10000);
  if (!res.ok) return res;
  return { ok: true, diff: res.out || "" };
}

async function stageFile(workspace, filePath) {
  if (!workspace || !filePath) return { ok: false, error: "Missing params" };
  return await runGitAsync(["add", filePath], workspace);
}

async function unstageFile(workspace, filePath) {
  if (!workspace || !filePath) return { ok: false, error: "Missing params" };
  return await runGitAsync(["restore", "--staged", filePath], workspace);
}

async function commit(workspace, message) {
  if (!workspace || !message?.trim()) return { ok: false, error: "Missing message" };
  return await runGitAsync(["commit", "-m", message.trim()], workspace);
}

async function getBranch(workspace) {
  if (!workspace) return { ok: false, error: "No workspace" };
  const res = await runGitAsync(["rev-parse", "--abbrev-ref", "HEAD"], workspace);
  if (!res.ok) return res;
  return { ok: true, branch: res.out || "detached" };
}

module.exports = {
  getChangedFiles,
  getDiff,
  stageFile,
  unstageFile,
  commit,
  getBranch,
};
