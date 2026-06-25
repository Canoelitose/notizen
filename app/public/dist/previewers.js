(function () {
  const {
    useState,
    useEffect,
    useMemo,
    useRef
  } = React;
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
    return new TextDecoder("utf-8", {
      fatal: false
    }).decode(new Uint8Array(buf));
  }
  function formatBytes(n) {
    if (!n && n !== 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
    return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }
  function JSONTreePreview({
    text,
    ext
  }) {
    const [parsed, error] = useMemo(() => {
      if (ext === "ndjson") {
        const lines = (text || "").split(/\r?\n/).filter(l => l.trim());
        try {
          const arr = lines.map(l => JSON.parse(l));
          return [arr, null];
        } catch (e) {
          return [null, e.message];
        }
      }
      let src = text || "";
      if (ext === "jsonc" || ext === "json5") {
        src = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      }
      try {
        return [JSON.parse(src), null];
      } catch (e) {
        return [null, e.message];
      }
    }, [text, ext]);
    if (error) {
      return React.createElement("div", {
        className: "preview-with-source-note"
      }, React.createElement("div", {
        className: "preview-source-note"
      }, "Keine g\xFCltige JSON-Struktur (", error, ") \u2014 Roh-Ansicht:"), React.createElement("pre", {
        className: "preview-text"
      }, text));
    }
    return React.createElement("div", {
      className: "json-tree-scroll"
    }, React.createElement(JSONNode, {
      value: parsed,
      name: null,
      initialOpen: true,
      depth: 0
    }));
  }
  function JSONNode({
    name,
    value,
    depth,
    initialOpen
  }) {
    const [open, setOpen] = useState(initialOpen ?? depth < 2);
    const t = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    const indent = {
      paddingLeft: 0
    };
    const label = name != null ? React.createElement("span", {
      className: "jt-key"
    }, typeof name === "number" ? name : `"${name}"`, ":\xA0") : null;
    if (t === "array" || t === "object") {
      const entries = t === "array" ? value.map((v, i) => [i, v]) : Object.entries(value);
      const bracketOpen = t === "array" ? "[" : "{";
      const bracketClose = t === "array" ? "]" : "}";
      const isEmpty = entries.length === 0;
      return React.createElement("div", {
        className: "jt-node",
        style: indent
      }, React.createElement("span", {
        className: "jt-row",
        onClick: () => !isEmpty && setOpen(v => !v),
        style: {
          cursor: isEmpty ? "default" : "pointer"
        }
      }, React.createElement("span", {
        className: "jt-toggle " + (open ? "open" : "")
      }, isEmpty ? "·" : open ? "▾" : "▸"), label, React.createElement("span", {
        className: "jt-bracket"
      }, bracketOpen), !open && !isEmpty && React.createElement("span", {
        className: "jt-summary"
      }, entries.length, " ", t === "array" ? "Elemente" : "Einträge"), (!open || isEmpty) && React.createElement("span", {
        className: "jt-bracket"
      }, bracketClose)), open && !isEmpty && React.createElement("div", {
        className: "jt-children"
      }, entries.map(([k, v]) => React.createElement(JSONNode, {
        key: k,
        name: k,
        value: v,
        depth: depth + 1
      })), React.createElement("div", {
        className: "jt-bracket-close"
      }, bracketClose)));
    }
    let renderedValue;
    if (t === "string") renderedValue = React.createElement("span", {
      className: "jt-string"
    }, "\"", value, "\"");else if (t === "number") renderedValue = React.createElement("span", {
      className: "jt-number"
    }, value);else if (t === "boolean") renderedValue = React.createElement("span", {
      className: "jt-boolean"
    }, String(value));else if (t === "null") renderedValue = React.createElement("span", {
      className: "jt-null"
    }, "null");else renderedValue = React.createElement("span", null, String(value));
    return React.createElement("div", {
      className: "jt-node jt-leaf",
      style: indent
    }, React.createElement("span", {
      className: "jt-row"
    }, React.createElement("span", {
      className: "jt-toggle"
    }, "\xB7"), label, renderedValue));
  }
  function MarkdownPreview({
    text
  }) {
    const [mode, setMode] = useState("rendered");
    const html = useMemo(() => {
      if (!window.marked) return "";
      try {
        window.marked.setOptions({
          breaks: true,
          gfm: true
        });
        const raw = window.marked.parse(text || "");
        return window.DOMPurify ? window.DOMPurify.sanitize(raw) : raw;
      } catch (e) {
        return `<pre>${(e.message || "").replace(/[<&>]/g, c => ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;"
        })[c])}</pre>`;
      }
    }, [text]);
    return React.createElement("div", {
      className: "md-preview"
    }, React.createElement("div", {
      className: "csv-preview-toolbar"
    }, React.createElement("div", {
      className: "csv-preview-stats"
    }, React.createElement("span", null, "Markdown")), React.createElement("button", {
      type: "button",
      className: "btn sm ghost",
      onClick: () => setMode(m => m === "rendered" ? "source" : "rendered")
    }, mode === "rendered" ? "Quelltext" : "Rendered")), mode === "rendered" ? React.createElement("div", {
      className: "md-rendered",
      dangerouslySetInnerHTML: {
        __html: html
      }
    }) : React.createElement("pre", {
      className: "preview-text"
    }, text));
  }
  function HTMLPreview({
    text,
    ext
  }) {
    const [mode, setMode] = useState(ext === "html" || ext === "htm" || ext === "xhtml" ? "rendered" : "source");
    const blobUrl = useMemo(() => {
      if (mode !== "rendered") return null;
      const blob = new Blob([text || ""], {
        type: "text/html"
      });
      return URL.createObjectURL(blob);
    }, [text, mode]);
    useEffect(() => () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    }, [blobUrl]);
    const canRender = ext === "html" || ext === "htm" || ext === "xhtml";
    return React.createElement("div", {
      className: "md-preview"
    }, React.createElement("div", {
      className: "csv-preview-toolbar"
    }, React.createElement("div", {
      className: "csv-preview-stats"
    }, React.createElement("span", null, ext.toUpperCase()), React.createElement("span", null, "\xB7"), React.createElement("span", null, formatBytes((text || "").length))), canRender && React.createElement("button", {
      type: "button",
      className: "btn sm ghost",
      onClick: () => setMode(m => m === "rendered" ? "source" : "rendered")
    }, mode === "rendered" ? "Quelltext" : "Rendered")), mode === "rendered" && canRender ? React.createElement("iframe", {
      src: blobUrl,
      className: "preview-iframe",
      sandbox: "allow-same-origin allow-scripts",
      title: "HTML-Vorschau"
    }) : React.createElement("pre", {
      className: "preview-code"
    }, React.createElement("code", {
      className: "language-" + (ext === "css" ? "css" : ext === "html" ? "html" : "markup")
    }, text)));
  }
  function SVGPreview({
    text,
    blobUrl
  }) {
    const [mode, setMode] = useState("rendered");
    return React.createElement("div", {
      className: "md-preview"
    }, React.createElement("div", {
      className: "csv-preview-toolbar"
    }, React.createElement("div", {
      className: "csv-preview-stats"
    }, React.createElement("span", null, "SVG")), React.createElement("button", {
      type: "button",
      className: "btn sm ghost",
      onClick: () => setMode(m => m === "rendered" ? "source" : "rendered")
    }, mode === "rendered" ? "Quelltext" : "Rendered")), mode === "rendered" ? React.createElement("div", {
      className: "svg-stage"
    }, React.createElement("img", {
      src: blobUrl,
      alt: "SVG",
      className: "preview-image"
    })) : React.createElement("pre", {
      className: "preview-code"
    }, React.createElement("code", {
      className: "language-markup"
    }, text)));
  }
  function FontPreview({
    blobUrl,
    fileName
  }) {
    const familyName = useMemo(() => "Preview_" + Math.random().toString(36).slice(2, 9), []);
    const [sample, setSample] = useState("The quick brown fox jumps over the lazy dog.\nDie heiße Zypernsonne quälte Max und Victoria ja böse auf dem Weg bis zur Küste.\n0123456789 — €$£¥ ©®™ §¶†‡ • ★\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz");
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
        } catch (e) {
          if (!cancelled) setErr(e.message);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [blobUrl, familyName]);
    if (err) {
      return React.createElement("div", {
        className: "preview-loading"
      }, "Schrift konnte nicht geladen werden: ", err);
    }
    if (!ready) {
      return React.createElement("div", {
        className: "preview-loading"
      }, "Schrift wird geladen\u2026");
    }
    const fontStack = `"${familyName}", system-ui, sans-serif`;
    return React.createElement("div", {
      className: "font-preview"
    }, React.createElement("div", {
      className: "csv-preview-toolbar"
    }, React.createElement("div", {
      className: "csv-preview-stats"
    }, React.createElement("span", null, fileName), React.createElement("span", null, "\xB7"), React.createElement("span", null, size, "px")), React.createElement("input", {
      type: "range",
      min: "10",
      max: "120",
      step: "1",
      value: size,
      onChange: e => setSize(parseInt(e.target.value, 10)),
      style: {
        width: 140
      }
    })), React.createElement("div", {
      className: "font-preview-body"
    }, React.createElement("div", {
      className: "font-preview-sizes"
    }, [12, 14, 18, 24, 32, 48, 72].map(s => React.createElement("div", {
      key: s,
      className: "font-preview-size-row"
    }, React.createElement("span", {
      className: "font-preview-size-label"
    }, s), React.createElement("span", {
      style: {
        fontFamily: fontStack,
        fontSize: s + "px"
      }
    }, "The quick brown fox jumps over the lazy dog.")))), React.createElement("div", {
      className: "font-preview-sample",
      style: {
        fontFamily: fontStack,
        fontSize: size + "px"
      }
    }, React.createElement("textarea", {
      value: sample,
      onChange: e => setSample(e.target.value),
      style: {
        fontFamily: fontStack,
        fontSize: size + "px",
        lineHeight: 1.35
      },
      spellCheck: false
    })), React.createElement("div", {
      className: "font-preview-glyphs",
      style: {
        fontFamily: fontStack
      }
    }, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("").map((c, i) => React.createElement("span", {
      key: i,
      className: "font-preview-glyph"
    }, c)))));
  }
  function ArchivePreview({
    dataUrl,
    fileName,
    fileType
  }) {
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
              date: file.date
            });
          }
          list.sort((a, b) => a.path.localeCompare(b.path));
          setEntries(list);
        } catch (e) {
          if (!cancelled) setErr(e.message);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [dataUrl]);
    if (err) {
      return React.createElement("div", {
        className: "preview-with-source-note"
      }, React.createElement("div", {
        className: "preview-source-note"
      }, "Archiv konnte nicht gelesen werden: ", err));
    }
    if (!entries) {
      return React.createElement("div", {
        className: "preview-loading"
      }, "Archiv wird gelesen\u2026");
    }
    const filtered = filter ? entries.filter(e => e.path.toLowerCase().includes(filter.toLowerCase())) : entries;
    const totalSize = entries.reduce((a, e) => a + (e.size || 0), 0);
    const totalCompressed = entries.reduce((a, e) => a + (e.compressedSize || 0), 0);
    const ratio = totalSize > 0 ? Math.round((1 - totalCompressed / totalSize) * 100) : 0;
    return React.createElement("div", {
      className: "csv-preview"
    }, React.createElement("div", {
      className: "csv-preview-toolbar"
    }, React.createElement("input", {
      className: "field-input csv-preview-search",
      type: "text",
      placeholder: "In Archiv suchen\u2026",
      value: filter,
      onChange: e => setFilter(e.target.value)
    }), React.createElement("div", {
      className: "csv-preview-stats"
    }, React.createElement("span", null, entries.length.toLocaleString("de"), " Dateien"), React.createElement("span", null, "\xB7"), React.createElement("span", null, formatBytes(totalSize), " unkomprimiert"), totalCompressed > 0 && React.createElement(React.Fragment, null, React.createElement("span", null, "\xB7"), React.createElement("span", null, ratio, "% gespart")))), React.createElement("div", {
      className: "csv-preview-scroll"
    }, React.createElement("table", {
      className: "csv-preview-table archive-table"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
      style: {
        width: "60%"
      }
    }, "Pfad"), React.createElement("th", {
      style: {
        width: "20%",
        textAlign: "right"
      }
    }, "Gr\xF6\xDFe"), React.createElement("th", {
      style: {
        width: "20%",
        textAlign: "right"
      }
    }, "Komprimiert"))), React.createElement("tbody", null, filtered.map((e, i) => {
      const ext = e.path.split(".").pop().toLowerCase();
      return React.createElement("tr", {
        key: i
      }, React.createElement("td", {
        title: e.path
      }, React.createElement("span", {
        className: "archive-ext"
      }, ".", ext), React.createElement("span", {
        style: {
          marginLeft: 8
        }
      }, e.path)), React.createElement("td", {
        className: "csv-num"
      }, formatBytes(e.size)), React.createElement("td", {
        className: "csv-num"
      }, formatBytes(e.compressedSize)));
    })))));
  }
  function DrawioPreview({
    text,
    dataUrl,
    fileName
  }) {
    const [mode, setMode] = useState("rendered");
    const blob = useMemo(() => {
      const b = new Blob([text || ""], {
        type: "application/xml"
      });
      return URL.createObjectURL(b);
    }, [text]);
    useEffect(() => () => URL.revokeObjectURL(blob), [blob]);
    const iframeRef = useRef(null);
    useEffect(() => {
      if (mode !== "rendered") return;
      const onMsg = e => {
        if (typeof e.data !== "string") return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.event === "init") {
            iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
              action: "load",
              xml: text || "",
              autosave: 0
            }), "*");
          }
        } catch {}
      };
      window.addEventListener("message", onMsg);
      return () => window.removeEventListener("message", onMsg);
    }, [mode, text]);
    return React.createElement("div", {
      className: "md-preview"
    }, React.createElement("div", {
      className: "csv-preview-toolbar"
    }, React.createElement("div", {
      className: "csv-preview-stats"
    }, React.createElement("span", null, fileName), React.createElement("span", null, "\xB7"), React.createElement("span", null, formatBytes((text || "").length))), React.createElement("button", {
      type: "button",
      className: "btn sm ghost",
      onClick: () => setMode(m => m === "rendered" ? "source" : "rendered")
    }, mode === "rendered" ? "XML-Quelltext" : "Diagramm")), mode === "rendered" ? React.createElement("iframe", {
      ref: iframeRef,
      src: "https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&noSaveBtn=1&noExitBtn=1&toolbar=zoom%20layers",
      className: "preview-iframe",
      title: "Diagramm-Vorschau",
      sandbox: "allow-scripts allow-same-origin allow-popups"
    }) : React.createElement("pre", {
      className: "preview-code"
    }, React.createElement("code", {
      className: "language-markup"
    }, text)));
  }
  function PDFPreview({
    dataUrl,
    fileName
  }) {
    const [pages, setPages] = useState([]);
    const [err, setErr] = useState(null);
    const [zoom, setZoom] = useState(1.0);
    const containerRef = useRef(null);
    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          if (!window.pdfjsLib) {
            for (let i = 0; i < 20 && !window.pdfjsLib; i++) await new Promise(r => setTimeout(r, 100));
            if (!window.pdfjsLib) throw new Error("PDF.js nicht geladen");
          }
          const buf = dataUrlToArrayBuffer(dataUrl);
          if (!buf) throw new Error("Datei nicht lesbar");
          const pdf = await window.pdfjsLib.getDocument({
            data: buf
          }).promise;
          if (cancelled) return;
          const pgs = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            pgs.push(await pdf.getPage(i));
          }
          if (!cancelled) setPages(pgs);
        } catch (e) {
          if (!cancelled) setErr(e.message);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [dataUrl]);
    if (err) {
      return React.createElement("div", {
        className: "preview-with-source-note"
      }, React.createElement("div", {
        className: "preview-source-note"
      }, "PDF konnte nicht gelesen werden: ", err));
    }
    if (pages.length === 0) {
      return React.createElement("div", {
        className: "preview-loading"
      }, "PDF wird geladen\u2026");
    }
    return React.createElement("div", {
      className: "pptx-preview"
    }, React.createElement("div", {
      className: "csv-preview-toolbar"
    }, React.createElement("div", {
      className: "csv-preview-stats"
    }, React.createElement("span", null, fileName), React.createElement("span", null, "\xB7"), React.createElement("span", null, pages.length, " Seiten")), React.createElement("div", {
      className: "pptx-zoom"
    }, React.createElement("button", {
      type: "button",
      className: "btn sm ghost",
      onClick: () => setZoom(z => Math.max(0.25, z - 0.1)),
      title: "Verkleinern"
    }, "\u2212"), React.createElement("input", {
      type: "range",
      min: "0.25",
      max: "3",
      step: "0.05",
      value: zoom,
      onChange: e => setZoom(parseFloat(e.target.value)),
      style: {
        width: 120
      }
    }), React.createElement("button", {
      type: "button",
      className: "btn sm ghost",
      onClick: () => setZoom(z => Math.min(3, z + 0.1)),
      title: "Vergr\xF6\xDFern"
    }, "+"), React.createElement("button", {
      type: "button",
      className: "btn sm ghost pptx-zoom-pct",
      onClick: () => setZoom(1)
    }, Math.round(zoom * 100), "%"))), React.createElement("div", {
      className: "pptx-stage",
      ref: containerRef
    }, React.createElement("div", {
      className: "pptx-scroll"
    }, pages.map((page, i) => React.createElement(PDFPage, {
      key: i,
      page: page,
      zoom: zoom,
      index: i
    })))));
  }
  function PDFPage({
    page,
    zoom,
    index
  }) {
    const canvasRef = useRef(null);
    useEffect(() => {
      if (!canvasRef.current) return;
      let cancelled = false;
      (async () => {
        const viewport = page.getViewport({
          scale: zoom * 1.5
        });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = viewport.width / 1.5 + "px";
        canvas.style.height = viewport.height / 1.5 + "px";
        try {
          await page.render({
            canvasContext: ctx,
            viewport
          }).promise;
        } catch {}
      })();
      return () => {
        cancelled = true;
      };
    }, [page, zoom]);
    return React.createElement("div", {
      className: "pptx-slide-frame",
      style: {
        height: "auto"
      }
    }, React.createElement("div", {
      className: "pptx-slide-label"
    }, "Seite ", index + 1), React.createElement("canvas", {
      ref: canvasRef
    }));
  }
  Object.assign(window, {
    JSONTreePreview,
    MarkdownPreview,
    HTMLPreview,
    SVGPreview,
    FontPreview,
    ArchivePreview,
    DrawioPreview,
    PDFPreview,
    readTextFromDataUrl,
    dataUrlToArrayBuffer
  });
})();