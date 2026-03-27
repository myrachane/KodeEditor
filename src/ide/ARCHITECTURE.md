# Visrodeck IDE Architecture (Refactor Baseline)

## Entry
- `src/App.jsx`
- `src/ide/StudioIDE.jsx`

## Core
- `src/ide/core/bridge.js`
  - Desktop bridge + browser fallback adapter

## Config
- `src/ide/config/settings.js`
  - IDE defaults
  - interpreter mapping
  - storage keys
  - utility helpers (`getLang`, `flattenTree`, `buildRiskProfile`)

## Components
- `src/ide/components/index.js`
  - IDE surface component exports

## Main Runtime
- `src/pages/labs/StudioPage.jsx`
  - orchestrates workspace, editor, terminal, map, settings, auth

This structure is intentionally modular so future upgrades can move logic from
`StudioPage.jsx` into dedicated hooks/services without breaking feature parity.
