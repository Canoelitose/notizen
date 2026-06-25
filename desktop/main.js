// main.js — Electron-Desktop-App (Local-First).
//
// Startet den Notizen-Server LOKAL im eigenen Prozess und zeigt ihn im Fenster.
// Der Server bindet einen vom Betriebssystem zugewiesenen FREIEN Port (PORT=0),
// damit es nie zu „Port belegt"-Fehlern kommt; den tatsächlichen Port schreibt
// der Server in eine Datei, die wir hier auslesen. Beim ersten Start ohne DB
// erscheint der Einrichtungs-Assistent (/setup). Daten/Config in AppData.

const { app, BrowserWindow, shell, Menu, Tray, nativeImage } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// App-Namen FEST setzen, damit der Datenpfad (%AppData%\Notizen) im Dev-Modus
// und in der installierten .exe identisch ist.
app.setName("Notizen");

// ---- Server-Umgebung setzen (VOR dem Laden von server.js) ----
const userData = app.getPath("userData");
process.env.PORT = "0";                       // OS wählt einen freien Port
process.env.BIND_HOST = "127.0.0.1";          // nur lokal erreichbar
process.env.COOKIE_SECURE = "0";              // lokales http
process.env.NODE_ENV = "production";
process.env.NOTES_DATA_DIR = userData;        // Snapshots/Cache -> AppData
process.env.DB_CONFIG_FILE = path.join(userData, "db-connection.json"); // DB-Config -> AppData

const RUNTIME_PORT_FILE = path.join(userData, "runtime-port");
const LOG_FILE = path.join(userData, "notizen-main.log");
function logMain(msg) {
  try { fs.appendFileSync(LOG_FILE, new Date().toISOString() + "  " + msg + "\n"); } catch (e) {}
}
process.on("uncaughtException", (e) => { logMain("UNCAUGHT: " + ((e && e.stack) || e)); });
process.on("unhandledRejection", (e) => { logMain("UNHANDLED-REJECT: " + ((e && e.stack) || e)); });

// Im gebauten Programm liegt der Server unter resources/app, in der Entwicklung
// im Repo unter ../app.
const serverEntry = app.isPackaged
  ? path.join(process.resourcesPath, "app", "server.js")
  : path.join(__dirname, "..", "app", "server.js");

let serverStarted = false;
function startServer() {
  if (serverStarted) return;
  try { fs.unlinkSync(RUNTIME_PORT_FILE); } catch (e) {}   // alten Port-Stand entfernen
  logMain("startServer: serverEntry=" + serverEntry + " exists=" + fs.existsSync(serverEntry));
  try {
    require(serverEntry);   // startet Express (app.listen) im Hauptprozess
    serverStarted = true;
    logMain("server.js geladen");
  } catch (e) {
    logMain("Server-Start FEHLGESCHLAGEN: " + ((e && e.stack) || e));
  }
}

function readRuntimePort() {
  try { return parseInt(fs.readFileSync(RUNTIME_PORT_FILE, "utf8").trim(), 10) || null; }
  catch (e) { return null; }
}

let appUrl = null;
let mainWindow = null, tray = null, isQuiting = false;

const LOADING_HTML =
  "data:text/html;charset=utf-8," + encodeURIComponent(
    "<!doctype html><meta charset=utf-8><title>Notizen</title>" +
    "<body style='margin:0;height:100vh;display:grid;place-items:center;background:#0E0D0B;color:#9C968B;font:15px system-ui'>" +
    "<div style='text-align:center'><div style='font-size:22px;color:#F08A4B;font-weight:700'>Notizen</div>" +
    "<div id=m style='margin-top:10px'>Starte …</div></div></body>");

function showError(text) {
  if (!mainWindow) return;
  mainWindow.loadURL(LOADING_HTML + encodeURIComponent(
    "<script>document.getElementById('m').textContent=" + JSON.stringify(text || "Konnte nicht starten.") + "</script>"));
}

// Wartet, bis der Server einen Port gemeldet hat UND HTTP beantwortet, dann lädt
// es die App ins Fenster.
function resolveAndLoad(tries = 150) {
  const port = readRuntimePort();
  if (!port) {
    if (tries <= 0) { logMain("kein runtime-port — Server nicht gestartet"); return showError("Server konnte nicht starten. Log: " + LOG_FILE); }
    return setTimeout(() => resolveAndLoad(tries - 1), 200);
  }
  appUrl = `http://127.0.0.1:${port}/`;
  const ping = (n) => {
    const req = http.get(appUrl + "api/health", (res) => { res.resume(); logMain("Server bereit auf Port " + port); mainWindow && mainWindow.loadURL(appUrl); });
    req.on("error", () => { if (n <= 0) return showError("Server antwortet nicht."); setTimeout(() => ping(n - 1), 250); });
    req.setTimeout(1500, () => req.destroy());
  };
  ping(60);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 860, minWidth: 480, minHeight: 480,
    backgroundColor: "#141210", title: "Notizen",
    icon: path.join(__dirname, "build", process.platform === "win32" ? "icon.ico" : "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, spellcheck: true,
    },
  });

  mainWindow.loadURL(LOADING_HTML);

  // Externe Links (nicht die lokale App) im System-Browser öffnen.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (appUrl && url.startsWith(appUrl)) return { action: "allow" };
    shell.openExternal(url); return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("data:")) return;
    if (!appUrl || !url.startsWith(appUrl)) { e.preventDefault(); shell.openExternal(url); }
  });

  // Schließen = in den Tray, nicht beenden.
  mainWindow.on("close", (e) => { if (!isQuiting) { e.preventDefault(); mainWindow.hide(); } });
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, "build", "icon.png"));
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 }));
  tray.setToolTip("Notizen");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Notizen öffnen", click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: "Neu laden", click: () => mainWindow.reload() },
    { type: "separator" },
    { label: "Beenden", click: () => { isQuiting = true; app.quit(); } },
  ]));
  tray.on("click", () => { mainWindow.isVisible() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus()); });
}

// Nur eine Instanz (sonst zwei Server / zwei Fenster).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });

  app.whenReady().then(() => {
    startServer();
    createWindow();
    createTray();
    resolveAndLoad();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else mainWindow.show();
    });
  });

  app.on("before-quit", () => { isQuiting = true; });
  app.on("window-all-closed", () => { /* im Tray weiterlaufen; Beenden nur übers Menü */ });
}
