// Obsidian-style graph view — nodes = notes, edges = wiki-links + noteref blocks.
// Force-directed layout with drag-to-move and click-to-open.

const { useState: useStateG, useRef: useRefG, useEffect: useEffectG, useMemo: useMemoG, useCallback: useCallbackG } = React;

// ---- Link extraction ----
// Returns Set of note-ids that the given note links to.
function extractLinksFromNote(note, allNotes) {
  const targets = new Set();
  if (!note?.blocks) return targets;

  const findByName = (name) => {
    const n = (name || "").trim().toLowerCase();
    if (!n) return null;
    return allNotes.find(other => {
      const t = (other.title || "").trim().toLowerCase();
      if (t === n) return true;
      const stripped = t.replace(/^\d+\s*[—–\-]\s*/, "").trim();
      return stripped === n;
    });
  };

  note.blocks.forEach(b => {
    if (b.kind === "noteref" && b.targetId && b.targetId !== note.id) {
      targets.add(b.targetId);
    }
    if (b.text && (b.kind === "text" || b.kind === "heading" || b.kind === "subheading")) {
      const re = /\[\[([^\]\n]+)\]\]/g;
      let m;
      while ((m = re.exec(b.text)) !== null) {
        const target = findByName(m[1]);
        if (target && target.id !== note.id) targets.add(target.id);
      }
    }
    // checklist items can also carry text
    if (b.kind === "checklist" && Array.isArray(b.items)) {
      b.items.forEach(it => {
        if (!it.text) return;
        const re = /\[\[([^\]\n]+)\]\]/g;
        let m;
        while ((m = re.exec(it.text)) !== null) {
          const target = findByName(m[1]);
          if (target && target.id !== note.id) targets.add(target.id);
        }
      });
    }
  });
  return targets;
}

// ---- Force-directed simulation ----
function GraphView({ notes, folders, onSelectNote, onContextMenu }) {
  const containerRef = useRefG();
  const [size, setSize] = useStateG({ w: 800, h: 600 });
  const [highlightId, setHighlightId] = useStateG(null);  // hover-only, transient
  const [selectedId, setSelectedId] = useStateG(null);    // persistent, set by click
  const focusId = selectedId || highlightId;
  const [pinnedIds, setPinnedIds] = useStateG(() => new Set()); // ids the user dragged
  const [zoom, setZoom] = useStateG(1);
  const [pan, setPan] = useStateG({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useStateG(true);

  // Build nodes + edges from notes
  const { nodes, edgeList, adjacency } = useMemoG(() => {
    const ns = notes.map(n => ({ id: n.id, note: n }));
    const edgeSet = new Map(); // key: "from→to" (undirected canonicalized)
    const adj = new Map(); // id → Set of connected ids
    notes.forEach(n => {
      const targets = extractLinksFromNote(n, notes);
      targets.forEach(tid => {
        const key = [n.id, tid].sort().join("→");
        edgeSet.set(key, { from: n.id, to: tid });
        if (!adj.has(n.id)) adj.set(n.id, new Set());
        if (!adj.has(tid)) adj.set(tid, new Set());
        adj.get(n.id).add(tid);
        adj.get(tid).add(n.id);
      });
    });
    return { nodes: ns, edgeList: [...edgeSet.values()], adjacency: adj };
  }, [notes]);

  const degree = (id) => (adjacency.get(id)?.size || 0);

  // Resize observer
  useEffectG(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(300, r.width), h: Math.max(300, r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Positions stored in refs to keep simulation cheap; React re-render via tick state.
  const positionsRef = useRefG(new Map());
  const [, forceTick] = useStateG(0);
  const [restartTick, setRestartTick] = useStateG(0);

  // Initialize positions for new nodes
  useEffectG(() => {
    const map = positionsRef.current;
    const cx = size.w / 2, cy = size.h / 2;
    nodes.forEach((n, i) => {
      if (!map.has(n.id)) {
        // Distribute new nodes around a circle so they start spread out
        const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
        const r = Math.min(size.w, size.h) * 0.32;
        map.set(n.id, {
          x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
          y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
          vx: 0, vy: 0,
        });
      }
    });
    // Remove positions for nodes that no longer exist
    const ids = new Set(nodes.map(n => n.id));
    [...map.keys()].forEach(id => { if (!ids.has(id)) map.delete(id); });
  }, [nodes, size.w, size.h]);

  // Simulation loop
  useEffectG(() => {
    let rafId;
    let running = true;
    let coolFrames = 0;

    const step = () => {
      const map = positionsRef.current;
      const cx = size.w / 2, cy = size.h / 2;
      const ids = nodes.map(n => n.id);
      const REPULSION = 2400;
      const SPRING = 0.045;
      const REST = 140;
      const DAMP = 0.85;
      const CENTER = 0.006;
      const MAX_VEL = 12;

      let maxEnergy = 0;

      // Repulsion (all pairs)
      for (let i = 0; i < ids.length; i++) {
        const a = map.get(ids[i]); if (!a) continue;
        for (let j = i + 1; j < ids.length; j++) {
          const b = map.get(ids[j]); if (!b) continue;
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(d2);
          const f = REPULSION / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      // Attraction (springs along edges)
      edgeList.forEach(e => {
        const a = map.get(e.from), b = map.get(e.to);
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const f = SPRING * (d - REST);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      });

      // Center gravity + integrate
      ids.forEach(id => {
        const p = map.get(id); if (!p) return;
        if (pinnedIds.has(id) || draggingRef.current?.id === id) return;
        p.vx += (cx - p.x) * CENTER;
        p.vy += (cy - p.y) * CENTER;
        p.vx *= DAMP; p.vy *= DAMP;
        if (p.vx > MAX_VEL) p.vx = MAX_VEL; else if (p.vx < -MAX_VEL) p.vx = -MAX_VEL;
        if (p.vy > MAX_VEL) p.vy = MAX_VEL; else if (p.vy < -MAX_VEL) p.vy = -MAX_VEL;
        p.x += p.vx; p.y += p.vy;
        const e = p.vx * p.vx + p.vy * p.vy;
        if (e > maxEnergy) maxEnergy = e;
      });

      forceTick(n => (n + 1) & 0xff);

      // Stop when settled
      if (maxEnergy < 0.05) coolFrames++; else coolFrames = 0;
      if (coolFrames > 30) running = false;

      if (running) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => { running = false; cancelAnimationFrame(rafId); };
  }, [nodes, edgeList, pinnedIds, size.w, size.h, restartTick]);

  // ---- Drag handling (nodes) ----
  // We use document-level mousemove/mouseup so drag works even if the cursor
  // leaves the node. Plain onClick / onDoubleClick on the <g> stay intact for
  // single-click highlight and double-click open — much more reliable than
  // synthesizing them from pointer events.
  const lastClickRef = useRefG({ id: null, t: 0 });
  const draggingRef = useRefG(null);
  const startNodeDrag = (e, id) => {
    // Only left button
    if (e.button !== 0) return;
    e.stopPropagation();
    const startCX = e.clientX, startCY = e.clientY;
    let dragging = false;
    const svg = containerRef.current.querySelector("svg");

    const onMove = (ev) => {
      if (!dragging) {
        if (Math.abs(ev.clientX - startCX) < 5 && Math.abs(ev.clientY - startCY) < 5) return;
        dragging = true;
        draggingRef.current = { id };
        document.body.style.cursor = "grabbing";
      }
      const rect = svg.getBoundingClientRect();
      // Account for current pan + zoom
      const x = (ev.clientX - rect.left - pan.x) / zoom;
      const y = (ev.clientY - rect.top - pan.y) / zoom;
      const p = positionsRef.current.get(id);
      if (p) { p.x = x; p.y = y; p.vx = 0; p.vy = 0; forceTick(t => (t + 1) & 0xff); }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      if (dragging) {
        // Give the simulation a kick so dropped nodes settle naturally
        // into the layout instead of staying frozen mid-air.
        const p = positionsRef.current.get(id);
        if (p) { p.vx = 0; p.vy = 0; }
        setRestartTick(t => t + 1);
      }
      // Reset on next frame so the trailing click event still sees nothing pending
      setTimeout(() => { draggingRef.current = null; }, 0);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onNodeClick = (e, id, note) => {
    // Swallow the synthetic click that follows a drag-release
    if (draggingRef.current) { e.stopPropagation(); return; }
    // Toggle persistent selection. Hover highlight is independent.
    setSelectedId(prev => prev === id ? null : id);
  };

  // ---- Pan + zoom ----
  const panningRef = useRefG(null);
  const onCanvasMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("[data-graph-node]")) return;
    const startX = e.clientX, startY = e.clientY;
    const startPan = pan;
    let panning = false;
    const onMove = (ev) => {
      if (!panning) {
        if (Math.abs(ev.clientX - startX) < 3 && Math.abs(ev.clientY - startY) < 3) return;
        panning = true;
        panningRef.current = true;
        document.body.style.cursor = "grabbing";
      }
      setPan({ x: startPan.x + (ev.clientX - startX), y: startPan.y + (ev.clientY - startY) });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      setTimeout(() => { panningRef.current = false; }, 0);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  // Use a native wheel listener so e.preventDefault() actually works (React's onWheel
  // is passive in some browsers). Zoom anchors on the cursor so the point you point
  // at stays under the mouse.
  useEffectG(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.target.closest(".graph-zoom")) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom(prevZoom => {
        const next = Math.max(0.3, Math.min(3, prevZoom * factor));
        if (next === prevZoom) return prevZoom;
        const k = next / prevZoom;
        setPan(prevPan => ({
          x: cx - (cx - prevPan.x) * k,
          y: cy - (cy - prevPan.y) * k,
        }));
        return next;
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Resets
  const resetLayout = () => {
    const map = positionsRef.current;
    map.clear();
    const cx = size.w / 2, cy = size.h / 2;
    nodes.forEach((n, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      const r = Math.min(size.w, size.h) * 0.32;
      map.set(n.id, {
        x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
        y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0,
      });
    });
    setPinnedIds(new Set());
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setRestartTick(t => t + 1);
    forceTick(n => (n + 1) & 0xff);
  };

  // Curated palette stays harmonious with the rest of the app.
  const FOLDER_COLORS = [
    "#B8451F", "#1E5FBF", "#15803D", "#A16207",
    "#7C3AED", "#DB2777", "#0891B2", "#475569",
    "#CA8A04", "#0F766E", "#9333EA", "#BE123C",
  ];
  const folderColor = (folderId) => {
    if (!folderId) return "#6B7280";
    let h = 0;
    for (let i = 0; i < folderId.length; i++) h = (h * 31 + folderId.charCodeAt(i)) >>> 0;
    return FOLDER_COLORS[h % FOLDER_COLORS.length];
  };

  // Highlight set: focused node + its neighbors
  const highlightSet = useMemoG(() => {
    if (!focusId) return null;
    const s = new Set([focusId]);
    (adjacency.get(focusId) || []).forEach(id => s.add(id));
    return s;
  }, [focusId, adjacency]);

  // Stats for the toolbar
  const linkedCount = nodes.filter(n => degree(n.id) > 0).length;
  const isolatedCount = nodes.length - linkedCount;

  return (
    <section className="graph-view">
      <div className="graph-toolbar">
        <div>
          <h1>Graph</h1>
          <div className="graph-sub">
            <b>{nodes.length}</b> Notiz{nodes.length !== 1 ? "en" : ""} · <b>{edgeList.length}</b> Verbindung{edgeList.length !== 1 ? "en" : ""} · {linkedCount} vernetzt, {isolatedCount} isoliert
          </div>
        </div>
        <div className="graph-toolbar-actions">
          {(() => {
            const sel = selectedId ? notes.find(n => n.id === selectedId) : null;
            return (
              <button
                className="btn sm accent"
                onClick={() => sel && onSelectNote?.(sel.id)}
                disabled={!sel}
                title={sel ? `Öffnen: „${sel.title || "Ohne Titel"}“` : "Erst einen Knoten anklicken zum Markieren"}
                style={!sel ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              >
                <Icon name="external" size={12} /> {sel ? `Öffnen: ${(sel.title || "Ohne Titel").slice(0, 22)}${(sel.title || "").length > 22 ? "…" : ""}` : "Öffnen"}
              </button>
            );
          })()}
          <button className={"btn sm" + (showLabels ? " accent" : "")} onClick={() => setShowLabels(v => !v)} title="Beschriftungen ein-/ausblenden">
            <Icon name="type" size={12} /> Labels
          </button>
          <button className="btn sm" onClick={resetLayout} title="Layout neu berechnen">
            <Icon name="undo" size={12} /> Reset
          </button>
        </div>
      </div>

      <div
        className="graph-canvas"
        ref={containerRef}
        onMouseDown={onCanvasMouseDown}
      >
        {nodes.length === 0 ? (
          <div className="graph-empty">
            <Icon name="link" size={36} />
            <div style={{ marginTop: 12, fontWeight: 500 }}>Noch keine Notizen vorhanden</div>
            <div style={{ marginTop: 4, color: "var(--text-subtle)" }}>Erstelle Notizen und verbinde sie mit Notiz-Link-Blöcken oder <code>[[Wiki-Links]]</code>.</div>
          </div>
        ) : (
          <svg
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            style={{ display: "block" }}
          >
            <defs>
              <filter id="graph-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="graph-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.25"/>
              </filter>
            </defs>
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              <g className="graph-edges">
                {edgeList.map((e, i) => {
                  const a = positionsRef.current.get(e.from);
                  const b = positionsRef.current.get(e.to);
                  if (!a || !b) return null;
                  const dim = highlightSet && (!highlightSet.has(e.from) || !highlightSet.has(e.to));
                  return (
                    <line
                      key={i}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      className={"graph-edge" + (dim ? " dim" : highlightSet ? " hi" : "")}
                    />
                  );
                })}
              </g>
              {/* Nodes */}
              <g className="graph-nodes">
                {nodes.map(({ id, note }) => {
                  const p = positionsRef.current.get(id);
                  if (!p) return null;
                  const d = degree(id);
                  const r = 6 + Math.min(10, d * 1.5);
                  const dim = highlightSet && !highlightSet.has(id);
                  const isHi = focusId === id;
                  const isSel = selectedId === id;
                  const color = folderColor(note.folderId);
                  return (
                    <g
                      key={id}
                      data-graph-node="1"
                      transform={`translate(${p.x} ${p.y})`}
                      className={"graph-node" + (dim ? " dim" : "") + (isHi ? " active" : "")}
                      onMouseDown={(e) => startNodeDrag(e, id)}
                      onClick={(e) => onNodeClick(e, id, note)}
                      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, note); }}
                      onMouseEnter={() => setHighlightId(id)}
                      onMouseLeave={() => setHighlightId(prev => prev === id ? null : prev)}
                      style={{ cursor: "pointer" }}
                    >
                      <circle
                        r={r + 8}
                        className="graph-node-halo"
                        fill={color}
                        opacity={isHi ? 0.25 : 0}
                      />
                      <circle
                        r={r}
                        fill={color}
                        stroke={isSel ? "var(--accent)" : isHi ? "var(--accent)" : "var(--surface)"}
                        strokeWidth={isSel ? 3 : isHi ? 2.5 : 1.5}
                        filter="url(#graph-shadow)"
                      />
                      {(showLabels || isHi) && (
                        <text
                          y={r + 12}
                          textAnchor="middle"
                          className="graph-label"
                        >
                          {(note.title || "Ohne Titel").length > 26
                            ? (note.title || "Ohne Titel").slice(0, 24) + "…"
                            : (note.title || "Ohne Titel")}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

        <div className="graph-zoom">
          <button className="icon-btn" onClick={() => setZoom(z => Math.min(3, z * 1.2))} title="Vergrössern"><Icon name="plus" size={14} /></button>
          <div className="graph-zoom-val">{Math.round(zoom * 100)}%</div>
          <button className="icon-btn" onClick={() => setZoom(z => Math.max(0.3, z / 1.2))} title="Verkleinern"><Icon name="minus" size={14} /></button>
        </div>
      </div>

      <div className="graph-legend">
        <span>💡 Knoten anklicken zum Markieren · oben rechts auf <b>Öffnen</b> klicken · Ziehen ordnet an · Mausrad zoomt · Hintergrund ziehen schwenkt</span>
      </div>
    </section>
  );
}

// Convert client coords to SVG coords, accounting for current pan + zoom transform.
function clientToSvg(svg, clientX, clientY, pan, zoom) {
  const rect = svg.getBoundingClientRect();
  const x = (clientX - rect.left - pan.x) / zoom;
  const y = (clientY - rect.top - pan.y) / zoom;
  return { x, y };
}

Object.assign(window, { GraphView });
