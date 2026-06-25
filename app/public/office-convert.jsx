// office-convert.jsx — SERVER-ONLY MOD (not from Claude Design)
//
// Overrides window.PPTXVisualPreview so PowerPoint files are rendered by
// converting them to PDF on the server (LibreOffice headless) and showing the
// PDF via the existing pdf.js previewer. Much higher fidelity than the
// client-side XML parser. Falls back to the original client parser if the
// server conversion fails (e.g. LibreOffice down).
//
// Must load AFTER pptx-render.jsx (sets PPTXVisualPreview) and previewers.jsx
// (sets PDFPreview + dataUrlToArrayBuffer), and BEFORE app.jsx renders.
(function () {
  const { useState, useEffect } = React;

  const OriginalPPTX = window.PPTXVisualPreview; // client-side fallback

  function extOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "pptx";
  }

  function dataUrlToBlob(dataUrl) {
    const buf = window.dataUrlToArrayBuffer(dataUrl);
    if (!buf) throw new Error("Datei nicht lesbar");
    return new Blob([buf], { type: "application/octet-stream" });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  // Generic server-side preview: converts any office file to PDF via the backend
  // (LibreOffice) and shows it with pdf.js. `loadingLabel` + `onError` customize UX.
  function makeServerPreview(loadingLabel, onError) {
    return function ServerPreview({ dataUrl, fileName }) {
      const [pdfUrl, setPdfUrl] = useState(null);
      const [err, setErr] = useState(null);

      useEffect(() => {
        let cancelled = false;
        setPdfUrl(null);
        setErr(null);
        (async () => {
          try {
            const blob = dataUrlToBlob(dataUrl);
            const r = await fetch("/api/convert/office?ext=" + encodeURIComponent(extOf(fileName)), {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/octet-stream" },
              body: blob,
            });
            if (!r.ok) throw new Error("Server-Konvertierung fehlgeschlagen (HTTP " + r.status + ")");
            const pdfBlob = await r.blob();
            const url = await blobToDataUrl(pdfBlob);
            if (!cancelled) setPdfUrl(url);
          } catch (e) {
            if (!cancelled) setErr(e.message || String(e));
          }
        })();
        return () => { cancelled = true; };
      }, [dataUrl, fileName]);

      if (err) return onError(dataUrl, fileName, err);
      if (!pdfUrl) return <div className="preview-loading">{loadingLabel}</div>;
      return React.createElement(window.PDFPreview, { dataUrl: pdfUrl, fileName });
    };
  }

  // PowerPoint: server preview, falls back to the original client-side parser.
  window.PPTXVisualPreview = makeServerPreview(
    "PowerPoint wird gerendert… (Server-Konvertierung)",
    (dataUrl, fileName, err) => {
      if (OriginalPPTX) return React.createElement(OriginalPPTX, { dataUrl, fileName });
      return (
        <div className="preview-with-source-note">
          <div className="preview-source-note">PowerPoint-Vorschau fehlgeschlagen: {err}</div>
        </div>
      );
    }
  );

  // Word / ODT / RTF / etc: server preview (Mammoth couldn't handle odt/rtf at all).
  window.OfficeServerPreview = makeServerPreview(
    "Dokument wird gerendert… (Server-Konvertierung)",
    (dataUrl, fileName, err) => (
      <div className="preview-with-source-note">
        <div className="preview-source-note">Dokument konnte nicht gerendert werden: {err}</div>
      </div>
    )
  );

  // ── Eager pre-conversion ──────────────────────────────────────────────
  // Fire-and-forget conversion to warm the server cache before the user opens
  // the preview, so opening feels instant. Deduped per-session by content size+name.
  const PREWARM_EXT = new Set([
    // presentations
    "pptx", "pptm", "potx", "potm", "ppsx", "ppsm", "ppt", "odp",
    // documents
    "docx", "docm", "dotx", "dotm", "doc", "odt", "ott", "rtf",
    // spreadsheets
    "xls", "xlsx", "xlsm", "xlsb", "xlt", "xltx", "xltm", "ods", "ots", "fods",
    // drawings / diagrams / misc LibreOffice-convertible
    "vsd", "vsdx", "vsdm", "vdx", "pub", "cdr", "odg", "otg", "fodg", "std", "sxd", "dxf", "wpg", "svm", "wmf", "emf",
  ]);
  const _prewarmed = new Set();

  window.prewarmOffice = function (dataUrl, fileName) {
    try {
      if (!dataUrl || !fileName) return;
      const ext = extOf(fileName);
      if (!PREWARM_EXT.has(ext)) return;
      const key = fileName + ":" + dataUrl.length;
      if (_prewarmed.has(key)) return;
      _prewarmed.add(key);
      const blob = dataUrlToBlob(dataUrl);
      // Low priority; ignore result — it just populates the server-side cache.
      fetch("/api/convert/office?ext=" + encodeURIComponent(ext), {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
        keepalive: false,
      }).catch(() => { _prewarmed.delete(key); });
    } catch (e) { /* best effort */ }
  };

  // Scan a note's blocks and pre-warm any office files it contains.
  window.prewarmOfficeInNote = function (note) {
    if (!note || !Array.isArray(note.blocks)) return;
    for (const b of note.blocks) {
      if (b && b.kind === "file" && b.src && b.name) window.prewarmOffice(b.src, b.name);
    }
  };
})();
