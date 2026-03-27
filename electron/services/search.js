const fs = require("fs");
const path = require("path");

const DEFAULT_IGNORED = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".vite",
  "__pycache__",
  ".cache",
  "coverage",
  ".nyc_output",
  ".turbo",
]);

function isProbablyBinary(buf) {
  if (!buf || !buf.length) return false;
  const limit = Math.min(buf.length, 4096);
  for (let i = 0; i < limit; i += 1) {
    if (buf[i] === 0) return true;
  }
  return false;
}

async function* walkFiles(root, { ignored = DEFAULT_IGNORED } = {}) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const e of entries) {
      if (!e?.name) continue;
      if (e.name.startsWith(".")) continue;
      if (ignored.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile()) {
        yield full;
      }
    }
  }
}

async function searchWorkspace({ root, q, maxResults = 200, maxFileBytes = 1024 * 1024 } = {}) {
  const query = String(q || "").trim();
  if (!root || !query) return [];
  const results = [];
  const lowerNeedle = query.toLowerCase();

  for await (const filePath of walkFiles(root)) {
    if (results.length >= maxResults) break;
    let st;
    try {
      st = await fs.promises.stat(filePath);
    } catch (_) {
      continue;
    }
    if (!st?.isFile?.()) continue;
    if (st.size > maxFileBytes) continue;

    let buf;
    try {
      buf = await fs.promises.readFile(filePath);
    } catch (_) {
      continue;
    }
    if (isProbablyBinary(buf)) continue;

    const text = buf.toString("utf8");
    if (!text.toLowerCase().includes(lowerNeedle)) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const lineText = lines[i];
      const idx = lineText.toLowerCase().indexOf(lowerNeedle);
      if (idx === -1) continue;
      results.push({
        path: filePath,
        line: i + 1,
        column: idx + 1,
        preview: lineText.slice(0, 280),
      });
      if (results.length >= maxResults) break;
    }
  }

  return results;
}

module.exports = { searchWorkspace };

