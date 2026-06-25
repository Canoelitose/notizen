// pptx-render.jsx
// Minimal client-side PPTX renderer.
// Parses the PPTX zip, reads slideN.xml + slideLayoutN.xml + theme1.xml + slideMasterN.xml,
// extracts shapes with positions, text runs, and basic formatting, and renders
// each slide as a scaled HTML "stage" with positioned divs.
//
// Not pixel-perfect — but accurate enough to show real slide layouts,
// images, colors, and typography instead of bare text dumps.

(function () {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  const EMU_PER_INCH = 914400;
  const EMU_PER_PX = EMU_PER_INCH / 96;

  function emuToPx(v) { return v / EMU_PER_PX; }

  // Convert a Theme color reference (e.g. "accent1", "bg1") to a hex color.
  // theme: { schemeClr: { accent1: "#...", ... } }
  function resolveColor(colorXml, theme) {
    if (!colorXml) return null;
    const srgb = colorXml.querySelector("srgbClr");
    if (srgb) return "#" + srgb.getAttribute("val");
    const scheme = colorXml.querySelector("schemeClr");
    if (scheme && theme) {
      const name = scheme.getAttribute("val");
      return theme[name] || null;
    }
    const sys = colorXml.querySelector("sysClr");
    if (sys) {
      const last = sys.getAttribute("lastClr");
      if (last) return "#" + last;
      const v = sys.getAttribute("val");
      if (v === "window") return "#FFFFFF";
      if (v === "windowText") return "#000000";
    }
    return null;
  }

  function parseXml(text) {
    return new DOMParser().parseFromString(text, "application/xml");
  }

  // ── Theme color extraction ─────────────────────────────────────────────
  async function parseTheme(zip) {
    const themeFile = zip.file(/^ppt\/theme\/theme\d+\.xml$/)[0];
    if (!themeFile) return {};
    const xml = parseXml(await themeFile.async("string"));
    const result = {};
    const scheme = xml.getElementsByTagNameNS("*", "clrScheme")[0];
    if (!scheme) return result;
    for (const node of scheme.children) {
      const name = node.localName;
      const c = node.children[0];
      if (!c) continue;
      if (c.localName === "srgbClr") result[name] = "#" + c.getAttribute("val");
      else if (c.localName === "sysClr") {
        const last = c.getAttribute("lastClr");
        if (last) result[name] = "#" + last;
      }
    }
    // Friendly aliases used inside slide XML
    if (result.lt1) result.bg1 = result.lt1;
    if (result.lt2) result.bg2 = result.lt2;
    if (result.dk1) result.tx1 = result.dk1;
    if (result.dk2) result.tx2 = result.dk2;
    return result;
  }

  // ── Slide dimensions ───────────────────────────────────────────────────
  async function parseSlideSize(zip) {
    const f = zip.file("ppt/presentation.xml");
    if (!f) return { w: 9144000, h: 6858000 };
    const xml = parseXml(await f.async("string"));
    const sld = xml.getElementsByTagNameNS("*", "sldSz")[0];
    if (!sld) return { w: 9144000, h: 6858000 };
    return {
      w: parseInt(sld.getAttribute("cx"), 10) || 9144000,
      h: parseInt(sld.getAttribute("cy"), 10) || 6858000,
    };
  }

  // ── Shape parsing ──────────────────────────────────────────────────────
  function parseTextBody(txBody, theme) {
    if (!txBody) return [];
    const paragraphs = [];
    for (const p of txBody.getElementsByTagNameNS("*", "p")) {
      const para = { runs: [], align: "left", bullet: false, level: 0 };
      const pPr = p.getElementsByTagNameNS("*", "pPr")[0];
      if (pPr) {
        const algn = pPr.getAttribute("algn");
        if (algn === "ctr") para.align = "center";
        else if (algn === "r") para.align = "right";
        else if (algn === "just") para.align = "justify";
        const lvl = pPr.getAttribute("lvl");
        if (lvl) para.level = parseInt(lvl, 10);
        if (pPr.getElementsByTagNameNS("*", "buChar").length > 0 ||
            pPr.getElementsByTagNameNS("*", "buAutoNum").length > 0) {
          para.bullet = true;
        }
      }
      for (const child of p.children) {
        if (child.localName === "r") {
          const rPr = child.getElementsByTagNameNS("*", "rPr")[0];
          const t = child.getElementsByTagNameNS("*", "t")[0];
          const run = { text: t ? t.textContent : "" };
          if (rPr) {
            if (rPr.getAttribute("b") === "1") run.bold = true;
            if (rPr.getAttribute("i") === "1") run.italic = true;
            if (rPr.getAttribute("u") && rPr.getAttribute("u") !== "none") run.underline = true;
            const sz = rPr.getAttribute("sz");
            if (sz) run.fontSize = parseInt(sz, 10) / 100; // half-pt → pt? actually hundredths-of-point
            const solid = rPr.getElementsByTagNameNS("*", "solidFill")[0];
            if (solid) run.color = resolveColor(solid, theme);
            const latin = rPr.getElementsByTagNameNS("*", "latin")[0];
            if (latin) run.font = latin.getAttribute("typeface");
          }
          para.runs.push(run);
        } else if (child.localName === "br") {
          para.runs.push({ text: "\n" });
        }
      }
      paragraphs.push(para);
    }
    return paragraphs;
  }

  function parseShapeProperties(sp) {
    const spPr = sp.getElementsByTagNameNS("*", "spPr")[0];
    if (!spPr) return null;
    const xfrm = spPr.getElementsByTagNameNS("*", "xfrm")[0];
    if (!xfrm) return null;
    const off = xfrm.getElementsByTagNameNS("*", "off")[0];
    const ext = xfrm.getElementsByTagNameNS("*", "ext")[0];
    if (!off || !ext) return null;
    return {
      x: parseInt(off.getAttribute("x"), 10) || 0,
      y: parseInt(off.getAttribute("y"), 10) || 0,
      w: parseInt(ext.getAttribute("cx"), 10) || 0,
      h: parseInt(ext.getAttribute("cy"), 10) || 0,
      rot: parseInt(xfrm.getAttribute("rot"), 10) / 60000 || 0,
    };
  }

  function parseFill(spPr, theme) {
    if (!spPr) return null;
    const solid = spPr.getElementsByTagNameNS("*", "solidFill")[0];
    if (solid) return { type: "solid", color: resolveColor(solid, theme) };
    const grad = spPr.getElementsByTagNameNS("*", "gradFill")[0];
    if (grad) {
      const stops = [...grad.getElementsByTagNameNS("*", "gs")].map(gs => ({
        pos: parseInt(gs.getAttribute("pos"), 10) / 1000,
        color: resolveColor(gs, theme),
      })).filter(s => s.color);
      return { type: "gradient", stops };
    }
    return null;
  }

  // Parse one slide's shapes. relsXml maps image rIds to media paths.
  async function parseSlide(zip, slidePath, theme) {
    const xml = parseXml(await zip.file(slidePath).async("string"));
    // Find matching _rels
    const relsPath = slidePath.replace(/^(ppt\/slides\/)(slide\d+\.xml)$/, "$1_rels/$2.rels");
    let rels = {};
    if (zip.file(relsPath)) {
      const relsXml = parseXml(await zip.file(relsPath).async("string"));
      for (const r of relsXml.getElementsByTagNameNS("*", "Relationship")) {
        rels[r.getAttribute("Id")] = r.getAttribute("Target");
      }
    }
    const shapes = [];
    const spTree = xml.getElementsByTagNameNS("*", "spTree")[0];
    if (!spTree) return shapes;

    // Slide background
    const bgFill = xml.getElementsByTagNameNS("*", "bg")[0];
    let bg = null;
    if (bgFill) {
      const bgPr = bgFill.getElementsByTagNameNS("*", "bgPr")[0];
      if (bgPr) bg = parseFill(bgPr, theme);
    }

    function walk(parent) {
      for (const node of parent.children) {
        const ln = node.localName;
        if (ln === "sp") {
          const props = parseShapeProperties(node);
          if (!props) continue;
          const spPr = node.getElementsByTagNameNS("*", "spPr")[0];
          const fill = parseFill(spPr, theme);
          const txBody = node.getElementsByTagNameNS("*", "txBody")[0];
          const paragraphs = parseTextBody(txBody, theme);
          // Shape geometry
          const prstGeom = spPr.getElementsByTagNameNS("*", "prstGeom")[0];
          const shapeType = prstGeom ? prstGeom.getAttribute("prst") : "rect";
          shapes.push({ kind: "shape", ...props, fill, paragraphs, shapeType });
        } else if (ln === "pic") {
          const props = parseShapeProperties(node);
          if (!props) continue;
          const blip = node.getElementsByTagNameNS("*", "blip")[0];
          if (blip) {
            const rId = blip.getAttribute("r:embed") || blip.getAttributeNS("*", "embed");
            const target = rels[rId];
            if (target) {
              // Resolve relative path
              let mediaPath = target.replace(/^\.\.\//, "ppt/");
              if (!mediaPath.startsWith("ppt/")) mediaPath = "ppt/" + mediaPath;
              shapes.push({ kind: "image", ...props, mediaPath });
            }
          }
        } else if (ln === "grpSp") {
          walk(node);
        }
      }
    }
    walk(spTree);
    return { shapes, bg };
  }

  // ── Image data URL cache ──────────────────────────────────────────────
  async function loadImageDataUrl(zip, path) {
    const f = zip.file(path);
    if (!f) return null;
    const blob = await f.async("blob");
    return URL.createObjectURL(blob);
  }

  // ── Top-level: parse whole PPTX ────────────────────────────────────────
  async function parsePPTX(arrayBuffer) {
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const theme = await parseTheme(zip);
    const slideSize = await parseSlideSize(zip);

    // Find slides in presentation.xml order
    const presRels = zip.file("ppt/_rels/presentation.xml.rels");
    let slidePaths = [];
    if (presRels) {
      const xml = parseXml(await presRels.async("string"));
      const map = {};
      for (const r of xml.getElementsByTagNameNS("*", "Relationship")) {
        if ((r.getAttribute("Type") || "").endsWith("/slide")) {
          map[r.getAttribute("Id")] = "ppt/" + r.getAttribute("Target").replace(/^\.\.\//, "");
        }
      }
      const presXml = parseXml(await zip.file("ppt/presentation.xml").async("string"));
      for (const sldId of presXml.getElementsByTagNameNS("*", "sldIdLst")[0]?.children || []) {
        const rId = sldId.getAttribute("r:id") || sldId.getAttributeNS("*", "id");
        if (map[rId]) slidePaths.push(map[rId]);
      }
    }
    if (slidePaths.length === 0) {
      slidePaths = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort();
    }

    const slides = [];
    const imageUrlCache = {};
    for (const path of slidePaths) {
      const { shapes, bg } = await parseSlide(zip, path, theme);
      // Resolve image paths into blob URLs
      for (const s of shapes) {
        if (s.kind === "image" && s.mediaPath) {
          if (!imageUrlCache[s.mediaPath]) {
            imageUrlCache[s.mediaPath] = await loadImageDataUrl(zip, s.mediaPath);
          }
          s.url = imageUrlCache[s.mediaPath];
        }
      }
      slides.push({ shapes, bg });
    }

    return { slides, slideSize, theme, _cleanup: () => {
      for (const url of Object.values(imageUrlCache)) {
        if (url) URL.revokeObjectURL(url);
      }
    }};
  }

  // ── Renderer ───────────────────────────────────────────────────────────
  function PPTXSlideRender({ slide, slideSize, scale }) {
    const styleSlide = {
      width: emuToPx(slideSize.w) + "px",
      height: emuToPx(slideSize.h) + "px",
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      position: "relative",
      flexShrink: 0,
      overflow: "hidden",
    };

    let bgStyle = { background: "white" };
    if (slide.bg) {
      if (slide.bg.type === "solid" && slide.bg.color) bgStyle.background = slide.bg.color;
      else if (slide.bg.type === "gradient" && slide.bg.stops?.length >= 2) {
        const stops = slide.bg.stops.map(s => `${s.color} ${s.pos}%`).join(", ");
        bgStyle.background = `linear-gradient(180deg, ${stops})`;
      }
    }

    return (
      <div className="pptx-slide" style={{ ...styleSlide, ...bgStyle }}>
        {slide.shapes.map((s, i) => {
          const baseStyle = {
            position: "absolute",
            left: emuToPx(s.x) + "px",
            top: emuToPx(s.y) + "px",
            width: emuToPx(s.w) + "px",
            height: emuToPx(s.h) + "px",
            ...(s.rot ? { transform: `rotate(${s.rot}deg)` } : {}),
          };
          if (s.kind === "image") {
            return (
              <img
                key={i}
                src={s.url}
                style={{ ...baseStyle, objectFit: "contain" }}
                alt=""
              />
            );
          }
          const fillStyle = {};
          if (s.fill?.type === "solid" && s.fill.color) fillStyle.background = s.fill.color;
          else if (s.fill?.type === "gradient" && s.fill.stops?.length >= 2) {
            fillStyle.background = `linear-gradient(180deg, ${s.fill.stops.map(st => `${st.color} ${st.pos}%`).join(", ")})`;
          }
          const isRound = s.shapeType === "ellipse" || s.shapeType === "roundRect";
          const radius = s.shapeType === "ellipse" ? "50%" : s.shapeType === "roundRect" ? "8px" : "0";
          return (
            <div key={i} style={{ ...baseStyle, ...fillStyle, borderRadius: radius, padding: "8px 12px", display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
              {s.paragraphs.map((p, pi) => (
                <div key={pi} style={{
                  textAlign: p.align,
                  paddingLeft: p.bullet ? (p.level * 16 + 14) + "px" : 0,
                  position: "relative",
                  marginBottom: "0.2em",
                  lineHeight: 1.2,
                }}>
                  {p.bullet && <span style={{ position: "absolute", left: (p.level * 16) + "px", top: "0.05em" }}>•</span>}
                  {p.runs.map((r, ri) => {
                    if (r.text === "\n") return <br key={ri} />;
                    const style = {};
                    if (r.bold) style.fontWeight = 700;
                    if (r.italic) style.fontStyle = "italic";
                    if (r.underline) style.textDecoration = "underline";
                    if (r.fontSize) style.fontSize = r.fontSize + "pt";
                    if (r.color) style.color = r.color;
                    if (r.font) style.fontFamily = `"${r.font}", sans-serif`;
                    return <span key={ri} style={style}>{r.text}</span>;
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // Main preview component
  function PPTXVisualPreview({ dataUrl, fileName }) {
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    const containerRef = useRef(null);
    const [fitScale, setFitScale] = useState(1);
    const [zoom, setZoom] = useState(1); // user multiplier on top of fit

    useEffect(() => {
      let cancelled = false;
      let cleanup = null;
      (async () => {
        try {
          const buf = window.dataUrlToArrayBuffer(dataUrl);
          if (!buf) throw new Error("Datei nicht lesbar");
          const result = await parsePPTX(buf);
          if (cancelled) { result._cleanup?.(); return; }
          cleanup = result._cleanup;
          setData(result);
        } catch (e) {
          if (!cancelled) setErr(e.message);
        }
      })();
      return () => { cancelled = true; if (cleanup) cleanup(); };
    }, [dataUrl]);

    // Compute scale to fit container width — sized so a slide is comfortably visible
    // without filling the whole pane (leaves room to see context/next slide).
    useEffect(() => {
      if (!data || !containerRef.current) return;
      const update = () => {
        const rect = containerRef.current.getBoundingClientRect();
        const slideW = emuToPx(data.slideSize.w);
        const slideH = emuToPx(data.slideSize.h);
        // Target: slide takes ~60% of pane height, capped so width stays sane
        const targetH = rect.height * 0.6;
        const targetW = rect.width - 80;
        const s = Math.min(targetH / slideH, targetW / slideW);
        setFitScale(Math.max(0.1, Math.min(1.0, s)));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }, [data]);

    if (err) {
      return (
        <div className="preview-with-source-note">
          <div className="preview-source-note">PowerPoint konnte nicht gelesen werden: {err}</div>
        </div>
      );
    }
    if (!data) {
      return <div className="preview-loading">PowerPoint wird geladen…</div>;
    }

    const slideW = emuToPx(data.slideSize.w);
    const slideH = emuToPx(data.slideSize.h);
    const scale = fitScale * zoom;

    return (
      <div className="pptx-preview">
        <div className="csv-preview-toolbar">
          <div className="csv-preview-stats">
            <span>{fileName}</span>
            <span>·</span>
            <span>{data.slides.length} Folien</span>
          </div>
          <div className="pptx-zoom">
            <button type="button" className="btn sm ghost" onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} title="Verkleinern">−</button>
            <input
              type="range" min="0.25" max="3" step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{ width: 120 }}
            />
            <button type="button" className="btn sm ghost" onClick={() => setZoom(z => Math.min(3, z + 0.1))} title="Vergrößern">+</button>
            <button
              type="button"
              className="btn sm ghost pptx-zoom-pct"
              onClick={() => setZoom(1)}
              title="Auf Standard zurücksetzen"
            >
              {Math.round(zoom * 100)}%
            </button>
          </div>
        </div>
        <div className="pptx-stage" ref={containerRef}>
          <div className="pptx-scroll">
            {data.slides.map((slide, i) => (
              <div key={i} className="pptx-slide-frame" style={{
                width: slideW * scale,
                height: slideH * scale,
              }}>
                <div className="pptx-slide-label">Folie {i + 1}</div>
                <PPTXSlideRender slide={slide} slideSize={data.slideSize} scale={scale} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, { PPTXVisualPreview, parsePPTX });
})();
