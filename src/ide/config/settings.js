export const DEFAULT_SETTINGS = {
  theme: "dark",
  fontSize: 13,
  lineHeight: 1.65,
  fontFamily: "JetBrains Mono",
  minimap: false,
  wordWrap: false,
  lineNumbers: true,
  bracketPairs: true,
  smoothScroll: true,
  autoSave: true,
  formatOnSave: false,
  cursorBlink: true,
  tabSize: 2,
  cursorStyle: "bar",
  interpreter: "auto",
  safeExecute: true,
  isolateRun: true,
  runParallel: false,
};

export const EXT_INTERP = {
  py: "python",
  ts: "ts",
  tsx: "ts",
  js: "node",
  jsx: "node",
};

export const SETTINGS_KEY = "visrodeck:settings:v1";
export const AUTH_KEY = "visrodeck:auth:v1";
export const GUEST_MODE_KEY = "visrodeck:guest-enabled:v1";

export function getLang(name = "") {
  const ext = name.split(".").pop()?.toLowerCase();
  return {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    sass: "scss",
    less: "less",
    html: "html",
    htm: "html",
    xml: "xml",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    py: "python",
    pyw: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    c: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    env: "plaintext",
  }[ext] ?? "plaintext";
}

export function flattenTree(nodes, out = []) {
  for (const node of nodes || []) {
    if (node.type === "file" && !node.meta?.truncated) out.push(node);
    if (Array.isArray(node.children)) flattenTree(node.children, out);
  }
  return out;
}

export function buildRiskProfile(command = "") {
  const cmd = command.toLowerCase();
  const isInstall = /npm install|pnpm install|yarn install|pip install/.test(cmd);
  const isBuild = /build|compile|webpack|vite build/.test(cmd);
  const isScript = /node |python|tsx|ts-node|deno|bun/.test(cmd);
  return {
    cpu: isBuild ? "High" : isScript ? "Medium" : "Low",
    memory: isBuild ? "High" : isInstall ? "Medium" : "Low",
    network: isInstall ? "High (package registry access)" : "Low",
    permissions: isInstall
      ? "Reads lockfiles, writes node_modules/site-packages, opens network sockets"
      : "Reads workspace files, writes runtime temp/output files",
    engine: "VRE risk engine",
  };
}
