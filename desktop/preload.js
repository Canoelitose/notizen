// preload.js — minimal, secure bridge. Currently nothing is exposed to the web
// app (it works unchanged in the browser). Kept as a hook for future native
// integrations (e.g. global hotkey, file export to disk) without enabling
// nodeIntegration. contextIsolation stays on.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
});
