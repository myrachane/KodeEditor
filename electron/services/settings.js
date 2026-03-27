const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const DEFAULT_SETTINGS = {
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
};

function getUserDataPath() {
  return app.getPath("userData");
}

function getWorkspaceSettingsPath(workspace) {
  if (!workspace) return null;
  return path.join(workspace, ".visrodeck", "settings.json");
}

function loadJSON(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (_) {
    return defaultValue;
  }
}

function saveJSON(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function loadUserSettings() {
  const settingsPath = path.join(getUserDataPath(), "settings.json");
  return loadJSON(settingsPath, DEFAULT_SETTINGS);
}

function saveUserSettings(settings) {
  const settingsPath = path.join(getUserDataPath(), "settings.json");
  return saveJSON(settingsPath, settings);
}

function loadWorkspaceSettings(workspace) {
  const wsPath = getWorkspaceSettingsPath(workspace);
  if (!wsPath) return {};
  return loadJSON(wsPath, {});
}

function saveWorkspaceSettings(workspace, settings) {
  const wsPath = getWorkspaceSettingsPath(workspace);
  if (!wsPath) return { ok: false, error: "No workspace" };
  return saveJSON(wsPath, settings);
}

function getMergedSettings(workspacePath) {
  const user = loadUserSettings();
  const workspace = loadWorkspaceSettings(workspacePath);
  return { ...DEFAULT_SETTINGS, ...user, ...workspace };
}

module.exports = {
  loadUserSettings,
  saveUserSettings,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  getMergedSettings,
  DEFAULT_SETTINGS,
};
