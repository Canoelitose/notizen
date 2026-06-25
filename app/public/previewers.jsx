// previewers.jsx — Preview components for many file formats.
// Used inside FilePreviewModal (editors.jsx).
//
// Exports to window:
//   JSONTreePreview, MarkdownPreview, HTMLPreview, SVGPreview,
//   FontPreview, ArchivePreview
//   readTextFromDataUrl, dataUrlToArrayBuffer

(function () {
  const { useState, useEffect, useMemo, useRef } = React;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function dataUrlToArrayBuffer(dataUrl) {
    if (!dataUrl) return null;
    const m = /^data:[^;]*;base64,(.*)$/.exec(dataUrl);
    if (!m) return null;
    const bin = atob(m[1]);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    return buf;
  }

  function readTextFromDataUrl(dataUrl) {
    const buf = dataUrlToArrayBuffer(dataUrl);
    if (!buf) return "";
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buf));
  }

  function formatBytes(n) {
    if (!n && n !== 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
    return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }

  // ── JSON Tree ────────────────────────────────────────────────────────────
  // Collapsible, color-coded tree. Falls back to syntax-highlighted source if
  // the file isn't valid JSON (e.g. YAML, TOML, JSONC with comments).
  function JSONTreePreview({ text, ext }) {
    const [parsed, error] = useMemo(() => {
      if (ext === "ndjson") {
        const lines = (text || "").split(/\r?\n/).filter(l => l.trim());
        try {
          const arr = lines.map(l => JSON.parse(l));
          return [arr, null];
        } catch (e) { return [null, e.message]; }
      }
      // Try parsing as JSON; jsonc → strip line comments
      let src = text || "";
      if (ext === "jsonc" || ext === "json5") {
        src = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      }
      try { return [JSON.parse(src), null]; }
      catch (e) { return [null, e.message]; }
    }, [text, ext]);

    if (error) {
      return (
        <div className="preview-with-source-note">
          <div className="preview-source-note">Keine gültige JSON-Struktur ({error}) — Roh-Ansicht:</div>
          <pre className="preview-text">{text}</pre>
        </div>
      );
    }

    return (
      <div className="json-tree-scroll">
        <JSONNode value={parsed} name={null} initialOpen={true} depth={0} />
      </div>
    );
  }

  function JSONNode({ name, value, depth, initialOpen }) {
    const [open, setOpen] = useState(initialOpen ?? depth < 2);
    const t = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    const indent = { paddingLeft: 0 };

    const label = name != null ? (
      <span className="jt-key">{typeof name === "number" ? name : `"${name}"`}:&nbsp;</span>
    ) : null;

    if (t === "array" || t === "object") {
      const entries = t === "array" ? value.map((v, i) => [i, v]) : Object.entries(value);
      const bracketOpen = t === "array" ? "[" : "{";
      const bracketClose = t === "array" ? "]" : "}";
      const isEmpty = entries.length === 0;
      return (
        <div className="jt-node" style={indent}>
          <span className="jt-row" onClick={() => !isEmpty && setOpen(v => !v)} style={{ cursor: isEmpty ? "default" : "pointer" }}>
            <span className={"jt-toggle " + (open ? "open" : "")}>{isEmpty ? "·" : (open ? "▾" : "▸")}</span>
            {label}
            <span className="jt-bracket">{bracketOpen}</span>
            {!open && !isEmpty && (
              <span className="jt-summary">
                {entries.length} {t === "array" ? "Elemente" : "Einträge"}
              </span>
            )}
            {(!open || isEmpty) && <span className="jt-bracket">{bracketClose}</span>}
          </span>
          {open && !isEmpty && (
            <div className="jt-children">
              {entries.map(([k, v]) => (
                <JSONNode key={k} name={k} value={v} depth={depth + 1} />
              ))}
              <div className="jt-bracket-close">{bracketClose}</div>
            </div>
          )}
        </div>
      );
    }

    let renderedValue;
    if (t === "string") renderedValue = <span className="jt-string">"{value}"</span>;
    else if (t === "number") renderedValue = <span className="jt-number">{value}</span>;
    else if (t === "boolean") renderedValue = <span className="jt-boolean">{String(value)}</span>;
    else if (t === "null") renderedValue = <span className="jt-null">null</span>;
    else renderedValue = <span>{String(value)}</span>;

    return (
      <div className="jt-node jt-leaf" style={indent}>
        <span className="jt-row">
          <span className="jt-toggle">·</span>
          {label}
          {renderedValue}
        </span>
      </div>
    );
  }

  // ── Markdown Rendered ────────────────────────────────────────────────────
  function MarkdownPreview({ text }) {
    const [mode, setMode] = useState("rendered"); // rendered | source
    const html = useMemo(() => {
      if (!window.marked) return "";
      try {
        window.marked.setOptions({ breaks: true, gfm: true });
        const raw = window.marked.parse(text || "");
        return window.DOMPurify ? window.DOMPurify.sanitize(raw) : raw;
      } catch (e) { return `<pre>${(e.message || "").replace(/[<&>]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c])}</pre>`; }
    }, [text]);

    return (
      <div className="md-preview">
        <div className="csv-preview-toolbar">
          <div className="csv-preview-stats"><span>Markdown</span></div>
          <button type="button" className="btn sm ghost" onClick={() => setMode(m => m === "rendered" ? "source" : "rendered")}>
            {mode === "rendered" ? "Quelltext" : "Rendered"}
          </button>
        </div>
        {mode === "rendered" ? (
          <div className="md-rendered" dangerouslySetInnerHTML={{ __html: html }}></div>
        ) : (
          <pre className="preview-text">{text}</pre>
        )}
      </div>
    );
  }

  // ── HTML Rendered (sandboxed) ────────────────────────────────────────────
  function HTMLPreview({ text, ext }) {
    const [mode, setMode] = useState(ext === "html" || ext === "htm" || ext === "xhtml" ? "rendered" : "source");
    const blobUrl = useMemo(() => {
      if (mode !== "rendered") return null;
      const blob = new Blob([text || ""], { type: "text/html" });
      return URL.createObjectURL(blob);
    }, [text, mode]);
    useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

    const canRender = ext === "html" || ext === "htm" || ext === "xhtml";

    return (
      <div className="md-preview">
        <div className="csv-preview-toolbar">
          <div className="csv-preview-stats">
            <span>{ext.toUpperCase()}</span>
            <span>·</span>
            <span>{formatBytes((text || "").length)}</span>
          </div>
          {canRender && (
            <button type="button" className="btn sm ghost" onClick={() => setMode(m => m === "rendered" ? "source" : "rendered")}>
              {mode === "rendered" ? "Quelltext" : "Rendered"}
            </button>
          )}
        </div>
        {mode === "rendered" && canRender ? (
          <iframe src={blobUrl} className="preview-iframe" sandbox="allow-same-origin allow-scripts" title="HTML-Vorschau"></iframe>
        ) : (
          <pre className="preview-code"><code className={"language-" + (ext === "css" ? "css" : ext === "html" ? "html" : "markup")}>{text}</code></pre>
        )}
      </div>
    );
  }

  // ── SVG Preview (rendered + source) ──────────────────────────────────────
  function SVGPreview({ text, blobUrl }) {
    const [mode, setMode] = useState("rendered");
    return (
      <div className="md-preview">
        <div className="csv-preview-toolbar">
          <div className="csv-preview-stats"><span>SVG</span></div>
          <button type="button" className="btn sm ghost" onClick={() => setMode(m => m === "rendered" ? "source" : "rendered")}>
            {mode === "rendered" ? "Quelltext" : "Rendered"}
          </button>
        </div>
        {mode === "rendered" ? (
          <div className="svg-stage">
            <img src={blobUrl} alt="SVG" className="preview-image" />
          </div>
        ) : (
          <pre className="preview-code"><code className="language-markup">{text}</code></pre>
        )}
      </div>
    );
  }

  // ── Font Preview ─────────────────────────────────────────────────────────
  function FontPreview({ blobUrl, fileName }) {
    const familyName = useMemo(() => "Preview_" + Math.random().toString(36).slice(2, 9), []);
    const [sample, setSample] = useState(
      "The quick brown fox jumps over the lazy dog.\nDie heiße Zypernsonne quälte Max und Victoria ja böse auf dem Weg bis zur Küste.\n0123456789 — €$£¥ ©®™ §¶†‡ • ★\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz"
    );
    const [size, setSize] = useState(36);
    const [ready, setReady] = useState(false);
    const [err, setErr] = useState(null);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const face = new FontFace(familyName, `url(${blobUrl})`);
          await face.load();
          if (cancelled) return;
          document.fonts.add(face);
          setReady(true);
        } catch (e) { if (!cancelled) setErr(e.message); }
      })();
      return () => { cancelled = true; };
    }, [blobUrl, familyName]);

    if (err) {
      return <div className="preview-loading">Schrift konnte nicht geladen werden: {err}</div>;
    }
    if (!ready) {
      return <div className="preview-loading">Schrift wird geladen…</div>;
    }

    const fontStack = `"${familyName}", system-ui, sans-serif`;

    return (
      <div className="font-preview">
        <div className="csv-preview-toolbar">
          <div className="csv-preview-stats">
            <span>{fileName}</span>
            <span>·</span>
            <span>{size}px</span>
          </div>
          <input
            type="range" min="10" max="120" step="1"
            value={size} onChange={(e) => setSize(parseInt(e.target.value, 10))}
            style={{ width: 140 }}
          />
        </div>
        <div className="font-preview-body">
          <div className="font-preview-sizes">
            {[12, 14, 18, 24, 32, 48, 72].map(s => (
              <div key={s} className="font-preview-size-row">
                <span className="font-preview-size-label">{s}</span>
                <span style={{ fontFamily: fontStack, fontSize: s + "px" }}>
                  The quick brown fox jumps over the lazy dog.
                </span>
              </div>
            ))}
          </div>
          <div className="font-preview-sample" style={{ fontFamily: fontStack, fontSize: size + "px" }}>
            <textarea
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              style={{ fontFamily: fontStack, fontSize: size + "px", lineHeight: 1.35 }}
              spellCheck={false}
            />
          </div>
          <div className="font-preview-glyphs" style={{ fontFamily: fontStack }}>
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("").map((c, i) => (
              <span key={i} className="font-preview-glyph">{c}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Archive (ZIP / EPUB / DOCX / etc.) ───────────────────────────────────
  function ArchivePreview({ dataUrl, fileName, fileType }) {
    const [entries, setEntries] = useState(null);
    const [err, setErr] = useState(null);
    const [filter, setFilter] = useState("");

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          if (!window.JSZip) throw new Error("JSZip nicht geladen");
          const buf = dataUrlToArrayBuffer(dataUrl);
          if (!buf) throw new Error("Datei nicht lesbar");
          const zip = await window.JSZip.loadAsync(buf);
          if (cancelled) return;
          const list = [];
          for (const [path, file] of Object.entries(zip.files)) {
            if (file.dir) continue;
            list.push({
              path,
              size: file._data?.uncompressedSize ?? 0,
              compressedSize: file._data?.compressedSize ?? 0,
              date: file.date,
            });
          }
          list.sort((a, b) => a.path.localeCompare(b.path));
          setEntries(list);
        } catch (e) { if (!cancelled) setErr(e.message); }
      })();
      return () => { cancelled = true; };
    }, [dataUrl]);

    if (err) {
      return (
        <div className="preview-with-source-note">
          <div className="preview-source-note">Archiv konnte nicht gelesen werden: {err}</div>
        </div>
      );
    }
    if (!entries) {
      return <div className="preview-loading">Archiv wird gelesen…</div>;
    }

    const filtered = filter
      ? entries.filter(e => e.path.toLowerCase().includes(filter.toLowerCase()))
      : entries;

    const totalSize = entries.reduce((a, e) => a + (e.size || 0), 0);
    const totalCompressed = entries.reduce((a, e) => a + (e.compressedSize || 0), 0);
    const ratio = totalSize > 0 ? Math.round((1 - totalCompressed / totalSize) * 100) : 0;

    return (
      <div className="csv-preview">
        <div className="csv-preview-toolbar">
          <input
            className="field-input csv-preview-search"
            type="text"
            placeholder="In Archiv suchen…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="csv-preview-stats">
            <span>{entries.length.toLocaleString("de")} Dateien</span>
            <span>·</span>
            <span>{formatBytes(totalSize)} unkomprimiert</span>
            {totalCompressed > 0 && (
              <>
                <span>·</span>
                <span>{ratio}% gespart</span>
              </>
            )}
          </div>
        </div>
        <div className="csv-preview-scroll">
          <table className="csv-preview-table archive-table">
            <thead>
              <tr>
                <th style={{ width: "60%" }}>Pfad</th>
                <th style={{ width: "20%", textAlign: "right" }}>Größe</th>
                <th style={{ width: "20%", textAlign: "right" }}>Komprimiert</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const ext = e.path.split(".").pop().toLowerCase();
                return (
                  <tr key={i}>
                    <td title={e.path}>
                      <span className="archive-ext">.{ext}</span>
                      <span style={{ marginLeft: 8 }}>{e.path}</span>
                    </td>
                    <td className="csv-num">{formatBytes(e.size)}</td>
                    <td className="csv-num">{formatBytes(e.compressedSize)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Drawio (diagrams.net) Preview ────────────────────────────────────────
  function DrawioPreview({ text, dataUrl, fileName }) {
    const [mode, setMode] = useState("rendered");
    const blob = useMemo(() => {
      const b = new Blob([text || ""], { type: "application/xml" });
      return URL.createObjectURL(b);
    }, [text]);
    useEffect(() => () => URL.revokeObjectURL(blob), [blob]);

    // diagrams.net embed viewer accepts XML directly via postMessage.
    const iframeRef = useRef(null);
    useEffect(() => {
      if (mode !== "rendered") return;
      const onMsg = (e) => {
        if (typeof e.data !== "string") return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.event === "init") {
            iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
              action: "load",
              xml: text || "",
              autosave: 0,
            }), "*");
          }
        } catch {}
      };
      window.addEventListener("message", onMsg);
      return () => window.removeEventListener("message", onMsg);
    }, [mode, text]);

    return (
      <div className="md-preview">
        <div className="csv-preview-toolbar">
          <div className="csv-preview-stats">
            <span>{fileName}</span>
            <span>·</span>
            <span>{formatBytes((text || "").length)}</span>
          </div>
          <button type="button" className="btn sm ghost" onClick={() => setMode(m => m === "rendered" ? "source" : "rendered")}>
            {mode === "rendered" ? "XML-Quelltext" : "Diagramm"}
          </button>
        </div>
        {mode === "rendered" ? (
          <iframe
            ref={iframeRef}
            src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&noSaveBtn=1&noExitBtn=1&toolbar=zoom%20layers"
            className="preview-iframe"
            title="Diagramm-Vorschau"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        ) : (
          <pre className="preview-code"><code className="language-markup">{text}</code></pre>
        )}
      </div>
    );
  }

  // ── PDF Preview (PDF.js — works even in sandboxed iframes) ────────────
  function PDFPreview({ dataUrl, fileName }) {
    const [pages, setPages] = useState([]);
    const [err, setErr] = useState(null);
    const [zoom, setZoom] = useState(1.0);
    const containerRef = useRef(null);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          if (!window.pdfjsLib) {
            // wait briefly for module to register
            for (let i = 0; i < 20 && !window.pdfjsLib; i++) await new Promise(r => setTimeout(r, 100));
            if (!window.pdfjsLib) throw new Error("PDF.js nicht geladen");
          }
          const buf = dataUrlToArrayBuffer(dataUrl);
          if (!buf) throw new Error("Datei nicht lesbar");
          const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
          if (cancelled) return;
          const pgs = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            pgs.push(await pdf.getPage(i));
          }
          if (!cancelled) setPages(pgs);
        } catch (e) { if (!cancelled) setErr(e.message); }
      })();
      return () => { cancelled = true; };
    }, [dataUrl]);

    if (err) {
      return (
        <div className="preview-with-source-note">
          <div className="preview-source-note">PDF konnte nicht gelesen werden: {err}</div>
        </div>
      );
    }
    if (pages.length === 0) {
      return <div className="preview-loading">PDF wird geladen…</div>;
    }

    return (
      <div className="pptx-preview">
        <div className="csv-preview-toolbar">
          <div className="csv-preview-stats">
            <span>{fileName}</span>
            <span>·</span>
            <span>{pages.length} Seiten</span>
          </div>
          <div className="pptx-zoom">
            <button type="button" className="btn sm ghost" onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} title="Verkleinern">−</button>
            <input type="range" min="0.25" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ width: 120 }} />
            <button type="button" className="btn sm ghost" onClick={() => setZoom(z => Math.min(3, z + 0.1))} title="Vergrößern">+</button>
            <button type="button" className="btn sm ghost pptx-zoom-pct" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          </div>
        </div>
        <div className="pptx-stage" ref={containerRef}>
          <div className="pptx-scroll">
            {pages.map((page, i) => (
              <PDFPage key={i} page={page} zoom={zoom} index={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  function PDFPage({ page, zoom, index }) {
    const canvasRef = useRef(null);
    useEffect(() => {
      if (!canvasRef.current) return;
      let cancelled = false;
      (async () => {
        const viewport = page.getViewport({ scale: zoom * 1.5 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = (viewport.width / 1.5) + "px";
        canvas.style.height = (viewport.height / 1.5) + "px";
        try { await page.render({ canvasContext: ctx, viewport }).promise; } catch {}
      })();
      return () => { cancelled = true; };
    }, [page, zoom]);

    return (
      <div className="pptx-slide-frame" style={{ height: "auto" }}>
        <div className="pptx-slide-label">Seite {index + 1}</div>
        <canvas ref={canvasRef}></canvas>
      </div>
    );
  }

  Object.assign(window, {
    JSONTreePreview, MarkdownPreview, HTMLPreview, SVGPreview,
    FontPreview, ArchivePreview, DrawioPreview, PDFPreview,
    readTextFromDataUrl, dataUrlToArrayBuffer,
  });
})();
