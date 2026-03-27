# Visrodeck Studio Web IDE

Production-style web IDE inspired by VS Code.

## Stack
- React + TypeScript + Vite
- Monaco Editor
- Tailwind CSS
- Node.js + Express
- Socket.io (real-time editing + terminal stream)
- Local storage settings + mock cloud sync

## Features Included
- VS Code style activity bar, collapsible sidebar, tabbed editor, bottom panel, status bar
- Workspace open, nested explorer, create/rename/delete files/folders
- Search across workspace (debounced)
- Monaco with minimap, sticky scroll, code folding, bracket colorization, multi-cursor support
- Auto-save, theme toggle, word wrap, tab size, font settings
- Command palette (`Ctrl+Shift+P`), global search (`Ctrl+Shift+F`), zen mode, fullscreen
- AI assistant panel scaffold (local LLM integration point)
- Real-time collaboration events via Socket.io
- Git branch + changed files indicator
- Terminal command runner in bottom panel
- Cloud sync endpoint (stores snapshots in `.visrodeck-cloud.json`)
- Responsive dark futuristic UI

## Folder Structure
```text
server/
  index.js                # API + socket server
src/
  components/
    ActivityBar.tsx
    AiAssistantPanel.tsx
    BottomPanel.tsx
    CommandPalette.tsx
    EditorPane.tsx
    FileTree.tsx
    StatusBar.tsx
    TabsBar.tsx
    WelcomeDashboard.tsx
  hooks/
    useDebounce.ts
  lib/
    api.ts
    socket.ts
  types/
    ide.ts
  App.tsx
  main.tsx
  index.css
```

## Local Run
```bash
npm install
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8787`

## Production Build
```bash
npm run build
NODE_ENV=production npm run start
```
Then open `http://localhost:8787`.

## Deploy (Ubuntu/VPS)
```bash
npm ci
npm run build
NODE_ENV=production PORT=8787 npm run start
```
Use Nginx as reverse proxy to `localhost:8787`.

## Notes
- Use absolute folder path when opening workspace.
- Right-click selected code in editor -> **Ghost it** (wrap block to ignore/debug).
- Replace AI panel logic with your local LLM endpoint in backend for research mode.
