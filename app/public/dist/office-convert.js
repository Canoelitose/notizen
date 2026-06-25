(function () {
  const {
    useState,
    useEffect
  } = React;
  const OriginalPPTX = window.PPTXVisualPreview;
  function extOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "pptx";
  }
  function dataUrlToBlob(dataUrl) {
    const buf = window.dataUrlToArrayBuffer(dataUrl);
    if (!buf) throw new Error("Datei nicht lesbar");
    return new Blob([buf], {
      type: "application/octet-stream"
    });
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }
  function makeServerPreview(loadingLabel, onError) {
    return function ServerPreview({
      dataUrl,
      fileName
    }) {
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
              headers: {
                "Content-Type": "application/octet-stream"
              },
              body: blob
            });
            if (!r.ok) throw new Error("Server-Konvertierung fehlgeschlagen (HTTP " + r.status + ")");
            const pdfBlob = await r.blob();
            const url = await blobToDataUrl(pdfBlob);
            if (!cancelled) setPdfUrl(url);
          } catch (e) {
            if (!cancelled) setErr(e.message || String(e));
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [dataUrl, fileName]);
      if (err) return onError(dataUrl, fileName, err);
      if (!pdfUrl) return React.createElement("div", {
        className: "preview-loading"
      }, loadingLabel);
      return React.createElement(window.PDFPreview, {
        dataUrl: pdfUrl,
        fileName
      });
    };
  }
  window.PPTXVisualPreview = makeServerPreview("PowerPoint wird gerendert… (Server-Konvertierung)", (dataUrl, fileName, err) => {
    if (OriginalPPTX) return React.createElement(OriginalPPTX, {
      dataUrl,
      fileName
    });
    return React.createElement("div", {
      className: "preview-with-source-note"
    }, React.createElement("div", {
      className: "preview-source-note"
    }, "PowerPoint-Vorschau fehlgeschlagen: ", err));
  });
  window.OfficeServerPreview = makeServerPreview("Dokument wird gerendert… (Server-Konvertierung)", (dataUrl, fileName, err) => React.createElement("div", {
    className: "preview-with-source-note"
  }, React.createElement("div", {
    className: "preview-source-note"
  }, "Dokument konnte nicht gerendert werden: ", err)));
  const PREWARM_EXT = new Set(["pptx", "pptm", "potx", "potm", "ppsx", "ppsm", "ppt", "odp", "docx", "docm", "dotx", "dotm", "doc", "odt", "ott", "rtf", "xls", "xlsx", "xlsm", "xlsb", "xlt", "xltx", "xltm", "ods", "ots", "fods", "vsd", "vsdx", "vsdm", "vdx", "pub", "cdr", "odg", "otg", "fodg", "std", "sxd", "dxf", "wpg", "svm", "wmf", "emf"]);
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
      fetch("/api/convert/office?ext=" + encodeURIComponent(ext), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/octet-stream"
        },
        body: blob,
        keepalive: false
      }).catch(() => {
        _prewarmed.delete(key);
      });
    } catch (e) {}
  };
  window.prewarmOfficeInNote = function (note) {
    if (!note || !Array.isArray(note.blocks)) return;
    for (const b of note.blocks) {
      if (b && b.kind === "file" && b.src && b.name) window.prewarmOffice(b.src, b.name);
    }
  };
})();