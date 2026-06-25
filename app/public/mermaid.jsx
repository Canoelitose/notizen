// mermaid.jsx — Visual diagram editor (with optional Mermaid source export).
//
// New blocks default to a visual node editor (draw.io-like): pan, zoom, drag
// nodes, inline-edit labels, drag from anchors to connect, right-click for
// context menu. The Mermaid source is treated as an export view, hidden by
// default. Legacy blocks (with only `text`, no `nodes` array) keep using the
// classic Mermaid renderer.
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM, useCallback: useCallbackM, useMemo: useMemoM, useLayoutEffect: useLayoutEffectM } = React;

// ── Data templates ────────────────────────────────────────────────────────────

const SHAPES = [
  { value: "round",   label: "Abgerundet" },
  { value: "rect",    label: "Rechteck"    },
  { value: "circle",  label: "Kreis"       },
  { value: "diamond", label: "Raute"       },
  { value: "pill",    label: "Pille"       },
];

const COLORS = [
  { value: "",        label: "Standard" },
  { value: "accent",  label: "Akzent"   },
  { value: "info",    label: "Info"     },
  { value: "success", label: "Grün"     },
  { value: "warning", label: "Gelb"     },
  { value: "danger",  label: "Rot"      },
];

const DIAGRAM_TEMPLATES = {
  flowchart: {
    label: "Flowchart",
    preview: "Start → Entscheid → Aktion",
    make: () => ({
      nodes: [
        { id: "n1", x: 80,  y: 80,  label: "Start",        shape: "pill",    color: "success" },
        { id: "n2", x: 280, y: 80,  label: "Entscheidung", shape: "diamond", color: "warning" },
        { id: "n3", x: 480, y: 20,  label: "Aktion A",     shape: "round",   color: "" },
        { id: "n4", x: 480, y: 140, label: "Aktion B",     shape: "round",   color: "" },
        { id: "n5", x: 680, y: 80,  label: "Ende",         shape: "pill",    color: "info" },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3", label: "Ja" },
        { id: "e3", from: "n2", to: "n4", label: "Nein" },
        { id: "e4", from: "n3", to: "n5" },
        { id: "e5", from: "n4", to: "n5" },
      ],
    }),
  },
  mindmap: {
    label: "Mindmap",
    preview: "Zentrum mit Verzweigungen",
    make: () => ({
      nodes: [
        { id: "c",  x: 320, y: 160, label: "Thema",  shape: "circle", color: "accent" },
        { id: "a1", x: 80,  y: 60,  label: "Idee 1", shape: "round",  color: "" },
        { id: "a2", x: 80,  y: 260, label: "Idee 2", shape: "round",  color: "" },
        { id: "a3", x: 540, y: 60,  label: "Idee 3", shape: "round",  color: "" },
        { id: "a4", x: 540, y: 260, label: "Idee 4", shape: "round",  color: "" },
      ],
      edges: [
        { id: "e1", from: "c", to: "a1" },
        { id: "e2", from: "c", to: "a2" },
        { id: "e3", from: "c", to: "a3" },
        { id: "e4", from: "c", to: "a4" },
      ],
    }),
  },
  process: {
    label: "Linearer Prozess",
    preview: "Schritt 1 → 2 → 3 → 4",
    make: () => ({
      nodes: [
        { id: "n1", x: 40,  y: 120, label: "Schritt 1", shape: "round", color: "" },
        { id: "n2", x: 220, y: 120, label: "Schritt 2", shape: "round", color: "" },
        { id: "n3", x: 400, y: 120, label: "Schritt 3", shape: "round", color: "" },
        { id: "n4", x: 580, y: 120, label: "Schritt 4", shape: "round", color: "" },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4" },
      ],
    }),
  },
  architecture: {
    label: "Architektur",
    preview: "Client · Server · DB",
    make: () => ({
      nodes: [
        { id: "c",  x: 60,  y: 100, label: "Client",   shape: "round", color: "info" },
        { id: "s",  x: 300, y: 100, label: "Server",   shape: "round", color: "accent" },
        { id: "db", x: 540, y: 100, label: "Datenbank", shape: "round", color: "warning" },
        { id: "ca", x: 300, y: 240, label: "Cache",    shape: "round", color: "" },
      ],
      edges: [
        { id: "e1", from: "c",  to: "s",  label: "HTTP" },
        { id: "e2", from: "s",  to: "db", label: "SQL" },
        { id: "e3", from: "s",  to: "ca", label: "lesen" },
      ],
    }),
  },
  empty: {
    label: "Leer",
    preview: "Leere Leinwand",
    make: () => ({ nodes: [], edges: [] }),
  },
};

const newId = (prefix = "n") => prefix + Math.random().toString(36).slice(2, 8);

// ── Mermaid export ────────────────────────────────────────────────────────────
const escapeLabel = (s) => (s || "").replace(/["\n]/g, " ").trim();
const SHAPE_WRAP = {
  round:   (l) => `(${l})`,
  rect:    (l) => `[${l}]`,
  circle:  (l) => `((${l}))`,
  diamond: (l) => `{${l}}`,
  pill:    (l) => `([${l}])`,
};
function graphToMermaid({ nodes, edges }) {
  if (!nodes || nodes.length === 0) return "flowchart LR";
  const lines = ["flowchart LR"];
  nodes.forEach(n => {
    const wrap = SHAPE_WRAP[n.shape] || SHAPE_WRAP.round;
    lines.push(`    ${n.id}${wrap(escapeLabel(n.label) || n.id)}`);
  });
  edges.forEach(e => {
    const arrow = e.label ? ` -->|${escapeLabel(e.label)}| ` : " --> ";
    lines.push(`    ${e.from}${arrow}${e.to}`);
  });
  return lines.join("\n");
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
const NODE_W = 140;
const NODE_H = 56;

// Find a point on the node's perimeter along the line toward (tx,ty).
// Tightens for visually inset shapes (diamond, circle) so the arrow tip lands
// on the rendered edge instead of the bounding rectangle.
function nodeAnchor(n, tx, ty) {
  const cx = n.x + NODE_W / 2;
  const cy = n.y + NODE_H / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const shape = n.shape || "round";
  if (shape === "circle") {
    const r = Math.min(NODE_W, NODE_H) / 2;
    const len = Math.hypot(dx, dy);
    return { x: cx + (dx / len) * r, y: cy + (dy / len) * r };
  }
  if (shape === "diamond") {
    const a = NODE_W / 2;
    const b = NODE_H / 2;
    const t = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);
    return { x: cx + dx * t, y: cy + dy * t };
  }
  const rx = NODE_W / 2;
  const ry = NODE_H / 2;
  const t = 1 / Math.max(Math.abs(dx) / rx, Math.abs(dy) / ry);
  return { x: cx + dx * t, y: cy + dy * t };
}
function edgeEndpoints(fromN, toN) {
  const fc = { x: fromN.x + NODE_W / 2, y: fromN.y + NODE_H / 2 };
  const tc = { x: toN.x + NODE_W / 2,   y: toN.y + NODE_H / 2 };
  return [nodeAnchor(fromN, tc.x, tc.y), nodeAnchor(toN, fc.x, fc.y)];
}
function edgePath(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Adaptive control points: extend along the dominant axis so vertical edges
  // get a nice top-to-bottom curve and horizontal edges get a left-to-right
  // curve, instead of always-horizontal control points that create awkward
  // S-shapes on vertical runs.
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const dist = Math.hypot(dx, dy);
  const offset = Math.min(120, Math.max(24, dist * 0.45));
  if (horizontal) {
    const ox = Math.sign(dx || 1) * offset;
    return `M ${a.x},${a.y} C ${a.x + ox},${a.y} ${b.x - ox},${b.y} ${b.x},${b.y}`;
  }
  const oy = Math.sign(dy || 1) * offset;
  return `M ${a.x},${a.y} C ${a.x},${a.y + oy} ${b.x},${b.y - oy} ${b.x},${b.y}`;
}

// ── Inline toolbar pickers (shape & color popovers) ──────────────────────────

function ToolbarShapePicker({ value, onChange }) {
  const [open, setOpen] = useStateM(false);
  const ref = useRefM(null);
  useEffectM(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const cur = SHAPES.find(s => s.value === value) || SHAPES[0];
  return (
    <div className="diagram-tb-picker" ref={ref}>
      <button className={"diagram-tb-picker-btn" + (open ? " open" : "")}
        onClick={() => setOpen(v => !v)}
        title={"Form: " + cur.label}
      >
        <span className={"diagram-shape-mini shape-" + cur.value}></span>
        <Icon name="chevron-down" size={9} />
      </button>
      {open && (
        <div className="diagram-tb-picker-menu">
          <div className="diagram-tb-picker-row">
            {SHAPES.map(s => (
              <button key={s.value}
                className={"diagram-shape-swatch" + (value === s.value ? " active" : "")}
                onClick={() => { onChange(s.value); setOpen(false); }}
                title={s.label}
              >
                <span className={"diagram-shape-mini shape-" + s.value}></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarColorPicker({ value, onChange }) {
  const [open, setOpen] = useStateM(false);
  const ref = useRefM(null);
  useEffectM(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const cur = COLORS.find(c => c.value === value) || COLORS[0];
  return (
    <div className="diagram-tb-picker" ref={ref}>
      <button className={"diagram-tb-picker-btn" + (open ? " open" : "")}
        onClick={() => setOpen(v => !v)}
        title={"Farbe: " + cur.label}
      >
        <span className={"diagram-color-swatch tiny color-" + (cur.value || "default")}></span>
        <Icon name="chevron-down" size={9} />
      </button>
      {open && (
        <div className="diagram-tb-picker-menu">
          <div className="diagram-tb-picker-row">
            {COLORS.map(c => (
              <button key={c.value || "default"}
                className={"diagram-color-swatch color-" + (c.value || "default") + (value === c.value ? " active" : "")}
                onClick={() => { onChange(c.value); setOpen(false); }}
                title={c.label}
              ></button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── In-app modal helpers (replace native prompt/confirm) ─────────────────────

function PromptModal({ title, label, defaultValue = "", placeholder = "", onSubmit, onCancel, confirmLabel = "OK", cancelLabel = "Abbrechen" }) {
  const [value, setValue] = useStateM(defaultValue);
  const inputRef = useRefM(null);
  useEffectM(() => { setTimeout(() => inputRef.current?.select(), 30); }, []);
  useEffectM(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal in-app-prompt" onMouseDown={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 6px" }}>{title}</h3>
        {label && <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>{label}</div>}
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}>
          <input
            ref={inputRef}
            className="field-input"
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <div className="actions">
            <button type="button" className="btn sm" onClick={onCancel}>{cancelLabel}</button>
            <button type="submit" className="btn primary sm">{confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, danger = false, onConfirm, onCancel, confirmLabel = "OK", cancelLabel = "Abbrechen" }) {
  useEffectM(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 6px" }}>{title}</h3>
        {message && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{message}</div>}
        <div className="actions">
          <button className="btn sm" onClick={onCancel}>{cancelLabel}</button>
          <button className={"btn sm " + (danger ? "danger" : "primary")} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Context menu (used for right-click) ──────────────────────────────────────

function ContextMenu({ x, y, items, onClose }) {
  const ref = useRefM(null);
  const [pos, setPos] = useStateM({ x, y });
  useLayoutEffectM(() => {
    const m = ref.current;
    if (!m) return;
    const r = m.getBoundingClientRect();
    let nx = x, ny = y;
    if (x + r.width  > window.innerWidth  - 8) nx = window.innerWidth  - r.width  - 8;
    if (y + r.height > window.innerHeight - 8) ny = window.innerHeight - r.height - 8;
    setPos({ x: Math.max(8, nx), y: Math.max(8, ny) });
  }, [x, y]);
  useEffectM(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="diagram-ctx-menu" style={{ left: pos.x, top: pos.y }}>
      {items.map((it, i) => {
        if (it.divider) return <div key={i} className="diagram-ctx-divider" />;
        if (it.heading) return <div key={i} className="diagram-ctx-heading">{it.heading}</div>;
        if (it.swatches) return (
          <div key={i} className="diagram-ctx-swatches">
            {it.swatches.map((s, j) => (
              <button key={j} className={"diagram-color-swatch color-" + (s.value || "default") + (s.active ? " active" : "")}
                onClick={() => { s.onClick?.(); onClose(); }}
                title={s.label}
              ></button>
            ))}
          </div>
        );
        if (it.shapes) return (
          <div key={i} className="diagram-ctx-shapes">
            {it.shapes.map((s, j) => (
              <button key={j} className={"diagram-shape-swatch" + (s.active ? " active" : "")}
                onClick={() => { s.onClick?.(); onClose(); }}
                title={s.label}
              >
                <span className={"diagram-shape-mini shape-" + s.value}></span>
              </button>
            ))}
          </div>
        );
        return (
          <button key={i}
            className={"diagram-ctx-item" + (it.danger ? " danger" : "")}
            onClick={() => { it.onClick?.(); onClose(); }}
            disabled={it.disabled}
          >
            {it.icon && <Icon name={it.icon} size={13} />}
            <span>{it.label}</span>
            {it.hint && <span className="diagram-ctx-hint">{it.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Diagram Node ─────────────────────────────────────────────────────────────

function DiagramNode({ node, selected, editing, onMouseDown, onDoubleClick, onContextMenu, onEditCommit, onAnchorMouseDown }) {
  const shape = node.shape || "round";
  const color = node.color || "";
  const inputRef = useRefM(null);
  const [draft, setDraft] = useStateM(node.label || "");
  useEffectM(() => { setDraft(node.label || ""); }, [node.label, editing]);
  useEffectM(() => {
    if (editing) setTimeout(() => inputRef.current?.select(), 20);
  }, [editing]);

  const commit = () => onEditCommit?.(draft);
  const cancel = () => { setDraft(node.label || ""); onEditCommit?.(null); };

  return (
    <div
      className={"diagram-node shape-" + shape + " color-" + (color || "default") + (selected ? " selected" : "") + (editing ? " editing" : "")}
      style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H, fontSize: (node.fontSize || 13) + "px" }}
      onMouseDown={(e) => onMouseDown?.(e, node)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(node); }}
      onContextMenu={(e) => onContextMenu?.(e, node)}
    >
      <div className="diagram-node-shape">
        {editing ? (
          <input
            ref={inputRef}
            className="diagram-node-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
            onBlur={commit}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="diagram-node-label">{node.label || <em>Knoten</em>}</span>
        )}
      </div>
      {/* Anchor handles on each side (only shown on hover/selection) */}
      <button className="diagram-anchor anchor-n" onMouseDown={(e) => onAnchorMouseDown?.(e, node, "n")} aria-label="Verbindung oben"></button>
      <button className="diagram-anchor anchor-e" onMouseDown={(e) => onAnchorMouseDown?.(e, node, "e")} aria-label="Verbindung rechts"></button>
      <button className="diagram-anchor anchor-s" onMouseDown={(e) => onAnchorMouseDown?.(e, node, "s")} aria-label="Verbindung unten"></button>
      <button className="diagram-anchor anchor-w" onMouseDown={(e) => onAnchorMouseDown?.(e, node, "w")} aria-label="Verbindung links"></button>
    </div>
  );
}

// ── Edge component ───────────────────────────────────────────────────────────

function DiagramEdge({ edge, fromN, toN, selected, onClick, onContextMenu, onDoubleClick, onLabelDoubleClick }) {
  if (!fromN || !toN) return null;
  const [a, b] = edgeEndpoints(fromN, toN);
  const d = edgePath(a, b);
  // Place the label at t=0.5 along the cubic curve so it sits on the line,
  // not in dead space between bent control points.
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const mid = horizontal
    ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return (
    <g className={"diagram-edge" + (selected ? " selected" : "")}
       onMouseDown={(e) => { e.stopPropagation(); onClick?.(edge, e); }}
       onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(edge); }}
       onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e, edge); }}>
      <path d={d} className="diagram-edge-hit" />
      <path d={d} className="diagram-edge-path" markerEnd={selected ? "url(#diagram-arrow-selected)" : "url(#diagram-arrow)"} />
      {edge.label && (
        <g transform={`translate(${mid.x}, ${mid.y})`} onDoubleClick={(e) => { e.stopPropagation(); onLabelDoubleClick?.(edge); }}>
          <rect className="diagram-edge-label-bg" x={-edge.label.length * 3.4 - 8} y={-10} rx={5} width={edge.label.length * 6.8 + 16} height={20} />
          <text className="diagram-edge-label" textAnchor="middle" dy={4}>{edge.label}</text>
        </g>
      )}
    </g>
  );
}

// ── Visual canvas ────────────────────────────────────────────────────────────

function VisualDiagram({ block, onChange, onCopy, fullscreen = false, onCloseFullscreen, onOpenFullscreen }) {
  const nodes = block.nodes || [];
  const edges = block.edges || [];
  const wrapRef = useRefM(null);
  const worldRef = useRefM(null);

  // View state (pan + zoom)
  const [view, setView] = useStateM(() => block.view || { x: 0, y: 0, scale: 1 });
  const viewRef = useRefM(view);
  useEffectM(() => { viewRef.current = view; }, [view]);

  // Server-only mod: robustly restore a saved view. The lazy initializer above
  // only runs on first mount — if block.view arrives later (async state load,
  // edit from another device), adopt it. We ignore our own writes (tracked in
  // lastWrittenViewRef) so this never fights a live pan/zoom.
  const lastWrittenViewRef = useRefM(block.view ? JSON.stringify(block.view) : null);
  useEffectM(() => {
    if (!block.view) return;
    const incoming = JSON.stringify(block.view);
    if (incoming === lastWrittenViewRef.current) return; // our own persisted value — skip
    if (incoming === JSON.stringify(viewRef.current)) return; // already applied
    lastWrittenViewRef.current = incoming;
    setView(block.view);
  }, [block.view]);

  // Lock — when true, the diagram is read-only: no dragging, no node creation,
  // and the mouse wheel scrolls the page instead of zooming the canvas. Useful
  // when the user just wants to scroll past a large diagram.
  const [locked, setLocked] = useStateM(!!block.locked);
  useEffectM(() => { setLocked(!!block.locked); }, [block.locked]);
  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    onChange({ ...block, locked: next });
  };

  // Selection & editing
  const [selection, setSelection] = useStateM(null); // { kind: "node"|"edge", id }
  const [editingId, setEditingId] = useStateM(null);
  const [ctxMenu, setCtxMenu] = useStateM(null);
  const [modal, setModal] = useStateM(null);

  // Drag state (refs to avoid re-renders during pointer move)
  const dragRef = useRefM(null); // { kind: "node"|"pan"|"edge", ... }
  const [edgePreview, setEdgePreview] = useStateM(null); // { from, x, y }
  const [, forceRerender] = useStateM(0);

  // Helpers to update the graph
  const setGraph = useCallbackM((patch) => onChange(patch), [onChange]);

  const updateNode = useCallbackM((id, patch) => {
    setGraph({ nodes: nodes.map(n => n.id === id ? { ...n, ...patch } : n) });
  }, [nodes, setGraph]);

  const removeNode = useCallbackM((id) => {
    setGraph({
      nodes: nodes.filter(n => n.id !== id),
      edges: edges.filter(e => e.from !== id && e.to !== id),
    });
  }, [nodes, edges, setGraph]);

  const removeEdge = useCallbackM((id) => {
    setGraph({ edges: edges.filter(e => e.id !== id) });
  }, [edges, setGraph]);

  const addNode = useCallbackM((opts = {}) => {
    const id = newId();
    const n = {
      id,
      x: opts.x ?? 200,
      y: opts.y ?? 120,
      label: opts.label || "Neuer Knoten",
      shape: opts.shape || "round",
      color: opts.color || "",
    };
    setGraph({ nodes: [...nodes, n] });
    return id;
  }, [nodes, setGraph]);

  const addEdge = useCallbackM((from, to, label) => {
    if (!from || !to || from === to) return;
    // Don't duplicate identical edges
    if (edges.some(e => e.from === from && e.to === to && (e.label || "") === (label || ""))) return;
    setGraph({ edges: [...edges, { id: newId("e"), from, to, ...(label ? { label } : {}) }] });
  }, [edges, setGraph]);

  // Persist view changes (pan/zoom) infrequently to avoid spamming localStorage
  const persistViewTimer = useRefM(null);
  const persistView = useCallbackM((v) => {
    if (persistViewTimer.current) clearTimeout(persistViewTimer.current);
    // Shorter debounce (150ms) so a quick zoom + navigate-away still saves.
    persistViewTimer.current = setTimeout(() => {
      lastWrittenViewRef.current = JSON.stringify(v); // mark as our own write
      setGraph({ view: v });
    }, 150);
  }, [setGraph]);

  // Convert client coords to world coords
  const clientToWorld = useCallbackM((cx, cy) => {
    const wrap = wrapRef.current;
    if (!wrap) return { x: cx, y: cy };
    const r = wrap.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: (cx - r.left - v.x) / v.scale,
      y: (cy - r.top  - v.y) / v.scale,
    };
  }, []);

  // Wheel zoom (anchored to cursor). When locked, do nothing — the wheel
  // bubbles up to the outer scroll container so the user can scroll past.
  const onWheel = useCallbackM((e) => {
    if (locked) return;
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const v = viewRef.current;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newScale = Math.min(4, Math.max(0.2, v.scale * factor));
    const ratio = newScale / v.scale;
    const next = {
      x: mx - (mx - v.x) * ratio,
      y: my - (my - v.y) * ratio,
      scale: newScale,
    };
    setView(next);
    persistView(next);
  }, [persistView]);

  // Attach wheel listener with passive: false so we can preventDefault
  useEffectM(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // Mouse move during drags
  useEffectM(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === "node") {
        const w = clientToWorld(e.clientX, e.clientY);
        updateNode(d.id, { x: w.x - d.offsetX, y: w.y - d.offsetY });
      } else if (d.kind === "pan") {
        const v = viewRef.current;
        const next = { ...v, x: d.baseX + (e.clientX - d.startX), y: d.baseY + (e.clientY - d.startY) };
        setView(next);
        persistView(next);
      } else if (d.kind === "edge") {
        const w = clientToWorld(e.clientX, e.clientY);
        setEdgePreview({ from: d.fromId, x: w.x, y: w.y });
        // Highlight target node under cursor
        const targetEl = document.elementFromPoint(e.clientX, e.clientY);
        const nodeEl = targetEl?.closest?.(".diagram-node-positioner");
        const targetId = nodeEl?.dataset?.nodeId || null;
        if (targetId !== d.hoverId) {
          d.hoverId = targetId;
          forceRerender(x => x + 1);
        }
      }
    };
    const onUp = (e) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === "edge") {
        const targetEl = document.elementFromPoint(e.clientX, e.clientY);
        const nodeEl = targetEl?.closest?.(".diagram-node-positioner");
        const toId = nodeEl?.dataset?.nodeId;
        if (toId && toId !== d.fromId) {
          addEdge(d.fromId, toId);
        }
      }
      dragRef.current = null;
      setEdgePreview(null);
      forceRerender(x => x + 1);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [clientToWorld, updateNode, persistView, addEdge]);

  // Keyboard: delete selected
  useEffectM(() => {
    const onKey = (e) => {
      if (modal || ctxMenu || editingId) return;
      if (!selection) return;
      if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selection.kind === "node") removeNode(selection.id);
        else if (selection.kind === "edge") removeEdge(selection.id);
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, modal, ctxMenu, editingId, removeNode, removeEdge]);

  // Background interactions
  const onBgMouseDown = (e) => {
    if (locked) return;
    if (e.button === 0) {
      // Start pan if clicking on empty area (not on a node/edge/anchor)
      if (e.target === wrapRef.current || e.target === worldRef.current || e.target.classList?.contains("diagram-svg-layer")) {
        const v = viewRef.current;
        dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, baseX: v.x, baseY: v.y };
        setSelection(null);
      }
    }
  };
  const onBgDoubleClick = (e) => {
    if (locked) return;
    if (e.target !== wrapRef.current && e.target !== worldRef.current && !e.target.classList?.contains("diagram-svg-layer")) return;
    const w = clientToWorld(e.clientX, e.clientY);
    addNode({ x: w.x - NODE_W / 2, y: w.y - NODE_H / 2, label: "Neuer Knoten" });
  };
  const onBgContextMenu = (e) => {
    if (e.target !== wrapRef.current && e.target !== worldRef.current && !e.target.classList?.contains("diagram-svg-layer")) return;
    e.preventDefault();
    const w = clientToWorld(e.clientX, e.clientY);
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { icon: "plus", label: "Knoten hinzufügen", hint: "Doppelklick", onClick: () => addNode({ x: w.x - NODE_W / 2, y: w.y - NODE_H / 2 }) },
        { divider: true },
        { icon: "target", label: "Ansicht zentrieren", onClick: () => fitToView() },
      ],
    });
  };

  // Node interactions
  const onNodeMouseDown = (e, node) => {
    if (locked) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelection({ kind: "node", id: node.id });
    if (editingId === node.id) return; // don't drag while editing
    const w = clientToWorld(e.clientX, e.clientY);
    dragRef.current = { kind: "node", id: node.id, offsetX: w.x - node.x, offsetY: w.y - node.y };
  };
  const onNodeDoubleClick = (n) => {
    setEditingId(n.id);
    setSelection({ kind: "node", id: n.id });
  };
  const onNodeContextMenu = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    setSelection({ kind: "node", id: node.id });
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { icon: "edit", label: "Beschriftung bearbeiten", hint: "Doppelklick", onClick: () => setEditingId(node.id) },
        { heading: "Form" },
        { shapes: SHAPES.map(s => ({ ...s, active: (node.shape || "round") === s.value, onClick: () => updateNode(node.id, { shape: s.value }) })) },
        { heading: "Farbe" },
        { swatches: COLORS.map(c => ({ ...c, active: (node.color || "") === c.value, onClick: () => updateNode(node.id, { color: c.value }) })) },
        { divider: true },
        { icon: "copy", label: "Duplizieren", onClick: () => addNode({ ...node, id: undefined, x: node.x + 20, y: node.y + 20 }) },
        { icon: "trash", label: "Knoten löschen", danger: true, onClick: () => { removeNode(node.id); setSelection(null); } },
      ],
    });
  };
  const onAnchorMouseDown = (e, node, side) => {
    if (locked) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { kind: "edge", fromId: node.id, hoverId: null };
    const w = clientToWorld(e.clientX, e.clientY);
    setEdgePreview({ from: node.id, x: w.x, y: w.y });
  };
  const onEditCommit = (newLabel, id) => {
    if (newLabel === null) { setEditingId(null); return; }
    updateNode(id, { label: newLabel });
    setEditingId(null);
  };

  // Edge interactions
  const onEdgeClick = (edge) => setSelection({ kind: "edge", id: edge.id });
  const onEdgeContextMenu = (e, edge) => {
    setSelection({ kind: "edge", id: edge.id });
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { icon: "edit", label: edge.label ? "Beschriftung ändern" : "Beschriftung hinzufügen", onClick: () => setModal({
            kind: "prompt",
            title: edge.label ? "Beschriftung ändern" : "Beschriftung hinzufügen",
            defaultValue: edge.label || "",
            placeholder: "z.B. Ja, Nein, OK",
            onSubmit: (v) => { setGraph({ edges: edges.map(e2 => e2.id === edge.id ? { ...e2, label: v.trim() || undefined } : e2) }); setModal(null); },
          }) },
        { divider: true },
        { icon: "trash", label: "Verbindung löschen", danger: true, onClick: () => { removeEdge(edge.id); setSelection(null); } },
      ],
    });
  };
  const onEdgeLabelDoubleClick = (edge) => setModal({
    kind: "prompt",
    title: edge.label ? "Beschriftung ändern" : "Beschriftung hinzufügen",
    label: "Text auf dem Pfeil zwischen den Knoten",
    defaultValue: edge.label || "",
    placeholder: "z.B. Ja, Nein, OK",
    onSubmit: (v) => { setGraph({ edges: edges.map(e2 => e2.id === edge.id ? { ...e2, label: v.trim() || undefined } : e2) }); setModal(null); },
  });

  // Fit-to-view: compute bbox of nodes and adjust pan/zoom
  const fitToView = useCallbackM(() => {
    if (nodes.length === 0) { setView({ x: 0, y: 0, scale: 1 }); return; }
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs) + NODE_W;
    const maxY = Math.max(...ys) + NODE_H;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const pad = 40;
    const sx = (r.width - pad * 2) / (maxX - minX);
    const sy = (r.height - pad * 2) / (maxY - minY);
    const scale = Math.min(1.5, Math.max(0.3, Math.min(sx, sy)));
    setView({
      x: r.width / 2 - (minX + (maxX - minX) / 2) * scale,
      y: r.height / 2 - (minY + (maxY - minY) / 2) * scale,
      scale,
    });
  }, [nodes]);

  // Auto-fit on first load if view is default and there are nodes
  const didAutoFitRef = useRefM(false);
  useEffectM(() => {
    if (didAutoFitRef.current) return;
    if (nodes.length === 0) return;
    if (block.view) { didAutoFitRef.current = true; return; }
    const t = setTimeout(() => { fitToView(); didAutoFitRef.current = true; }, 80);
    return () => clearTimeout(t);
  }, [nodes.length, fitToView, block.view]);

  // Applying a template (with confirmation if non-empty)
  const applyTemplate = (key) => {
    const t = DIAGRAM_TEMPLATES[key];
    if (!t) return;
    const apply = () => {
      const g = t.make();
      setGraph({ nodes: g.nodes, edges: g.edges, view: undefined });
      didAutoFitRef.current = false;
      setSelection(null);
      setEditingId(null);
    };
    if (nodes.length > 0) {
      setModal({
        kind: "confirm",
        title: "Diagramm ersetzen?",
        message: `Vorlage „${t.label}" überschreibt das aktuelle Diagramm.`,
        confirmLabel: "Ersetzen",
        danger: true,
        onConfirm: () => { apply(); setModal(null); },
      });
    } else apply();
  };

  // Export & sharing
  const downloadSvg = () => {
    const svg = wrapRef.current?.querySelector("svg.diagram-svg-layer");
    if (!svg) return;
    // Build a standalone SVG by cloning + inlining computed styles for nodes/edges
    const clone = svg.cloneNode(true);
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n` + xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "diagram.svg"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copySource = async () => {
    const src = graphToMermaid({ nodes, edges });
    try { await navigator.clipboard.writeText(src); onCopy?.("Mermaid-Code kopiert"); } catch {}
  };

  const node = (id) => nodes.find(n => n.id === id);
  const draggingEdgeHover = dragRef.current?.kind === "edge" ? dragRef.current.hoverId : null;
  const draggingEdgeFromId = dragRef.current?.kind === "edge" ? dragRef.current.fromId : null;

  return (
    <div className={"diagram-editor" + (fullscreen ? " fullscreen" : "") + (locked ? " locked" : "")}>
      <div className="diagram-toolbar">
        <span className="mermaid-badge"><Icon name="git-branch" size={10} /> Diagramm</span>
        <button className="btn sm" onClick={() => addNode({ x: 200, y: 120 })}>
          <Icon name="plus" size={12} /> Knoten
        </button>
        <window.StyledSelect
          value=""
          onChange={(v) => { if (v) applyTemplate(v); }}
          placeholder="+ Vorlage"
          minWidth={140}
          options={Object.entries(DIAGRAM_TEMPLATES).map(([k, v]) => ({ value: k, label: v.label }))}
        />

        <div className="diagram-toolbar-spacer"></div>
        <button
          className={"mermaid-icon-btn" + (locked ? " active" : "")}
          onClick={toggleLock}
          title={locked ? "Diagramm entsperren" : "Diagramm sperren (kein Verschieben, Seitenscroll)"}
        >
          <Icon name={locked ? "lock" : "unlock"} size={13} />
        </button>
        <button className="mermaid-icon-btn" onClick={fitToView} title="Ansicht zentrieren">
          <Icon name="target" size={13} />
        </button>
        <button className="mermaid-icon-btn" onClick={copySource} title="Als Mermaid-Code kopieren" disabled={nodes.length === 0}>
          <Icon name="copy" size={13} />
        </button>
        <button className="mermaid-icon-btn" onClick={downloadSvg} title="Als SVG herunterladen" disabled={nodes.length === 0}>
          <Icon name="download" size={13} />
        </button>
        {fullscreen ? (
          <button className="mermaid-icon-btn" onClick={onCloseFullscreen} title="Vollbild schließen (Esc)">
            <Icon name="x" size={14} />
          </button>
        ) : (
          <button className="mermaid-icon-btn" onClick={onOpenFullscreen} title="Vollbild öffnen" disabled={nodes.length === 0}>
            <Icon name="external" size={13} />
          </button>
        )}
      </div>

      <div
        ref={wrapRef}
        className="diagram-canvas"
        onMouseDown={onBgMouseDown}
        onDoubleClick={onBgDoubleClick}
        onContextMenu={onBgContextMenu}
        style={{ cursor: dragRef.current?.kind === "pan" ? "grabbing" : (dragRef.current?.kind === "edge" ? "crosshair" : "grab") }}
      >
        <div
          ref={worldRef}
          className="diagram-world"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {/* Edges (SVG layer behind nodes) */}
          <svg className="diagram-svg-layer" overflow="visible">
            <defs>
              <marker id="diagram-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
              <marker id="diagram-arrow-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
              <marker id="diagram-arrow-preview" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            {edges.map(e => (
              <DiagramEdge
                key={e.id}
                edge={e}
                fromN={node(e.from)}
                toN={node(e.to)}
                selected={selection?.kind === "edge" && selection.id === e.id}
                onClick={onEdgeClick}
                onContextMenu={onEdgeContextMenu}
                onDoubleClick={onEdgeLabelDoubleClick}
                onLabelDoubleClick={onEdgeLabelDoubleClick}
              />
            ))}
            {edgePreview && (() => {
              const fromN = node(edgePreview.from);
              if (!fromN) return null;
              const a = nodeAnchor(fromN, edgePreview.x, edgePreview.y);
              const b = { x: edgePreview.x, y: edgePreview.y };
              return <path d={edgePath(a, b)} className="diagram-edge-preview" markerEnd="url(#diagram-arrow-preview)" />;
            })()}
          </svg>

          {/* Nodes */}
          {nodes.map(n => (
            <div key={n.id} data-node-id={n.id} style={{ position: "absolute", left: 0, top: 0 }}
              className={"diagram-node-positioner" + (draggingEdgeHover === n.id ? " edge-target" : "") + (draggingEdgeFromId === n.id ? " edge-source" : "")}>
              <DiagramNode
                node={n}
                selected={selection?.kind === "node" && selection.id === n.id}
                editing={editingId === n.id}
                onMouseDown={onNodeMouseDown}
                onDoubleClick={onNodeDoubleClick}
                onContextMenu={onNodeContextMenu}
                onEditCommit={(label) => onEditCommit(label, n.id)}
                onAnchorMouseDown={onAnchorMouseDown}
              />
            </div>
          ))}
        </div>

        {/* Hint overlay when empty */}
        {nodes.length === 0 && (
          <div className="diagram-empty">
            <Icon name="git-branch" size={28} />
            <h4>Leeres Diagramm</h4>
            <div className="diagram-empty-hint">
              <b>Doppelklick</b> setzt einen Knoten · <b>Drag</b> verbindet sie · <b>Rechtsklick</b> für Optionen
            </div>
            <div className="diagram-empty-or">oder wähle oben eine Vorlage</div>
          </div>
        )}

        {/* Zoom indicator */}
        <div className="diagram-zoom-indicator">{Math.round(view.scale * 100)}%</div>

        {/* Floating format bar — appears when a node is selected */}
        {selection?.kind === "node" && (() => {
          const sel = nodes.find(n => n.id === selection.id);
          if (!sel) return null;
          const fs = sel.fontSize || 13;
          return (
            <div className="diagram-format-bar" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
              <div className="fb-group">
                {SHAPES.map(s => (
                  <button key={s.value}
                    className={"diagram-shape-swatch" + ((sel.shape || "round") === s.value ? " active" : "")}
                    onClick={() => updateNode(sel.id, { shape: s.value })}
                    title={s.label}>
                    <span className={"diagram-shape-mini shape-" + s.value}></span>
                  </button>
                ))}
              </div>
              <div className="fb-sep"></div>
              <div className="fb-group">
                {COLORS.map(c => (
                  <button key={c.value || "default"}
                    className={"diagram-color-swatch color-" + (c.value || "default") + ((sel.color || "") === c.value ? " active" : "")}
                    onClick={() => updateNode(sel.id, { color: c.value })}
                    title={c.label}></button>
                ))}
              </div>
              <div className="fb-sep"></div>
              <div className="diagram-font-size">
                <button className="mermaid-icon-btn"
                  onClick={() => updateNode(sel.id, { fontSize: Math.max(8, fs - 1) })}
                  disabled={fs <= 8}
                  title="Schrift kleiner">
                  <Icon name="minus" size={11} />
                </button>
                <span className="diagram-font-size-value">{fs}</span>
                <button className="mermaid-icon-btn"
                  onClick={() => updateNode(sel.id, { fontSize: Math.min(28, fs + 1) })}
                  disabled={fs >= 28}
                  title="Schrift grösser">
                  <Icon name="plus" size={11} />
                </button>
              </div>
              <div className="fb-sep"></div>
              <button className="mermaid-icon-btn"
                onClick={() => { removeNode(sel.id); setSelection(null); }}
                title="Knoten löschen">
                <Icon name="trash" size={13} />
              </button>
            </div>
          );
        })()}
      </div>

      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}

      {modal?.kind === "prompt" && (
        <PromptModal
          title={modal.title}
          label={modal.label}
          defaultValue={modal.defaultValue}
          placeholder={modal.placeholder}
          confirmLabel={modal.confirmLabel}
          onSubmit={(v) => modal.onSubmit(v)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.kind === "confirm" && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          danger={modal.danger}
          confirmLabel={modal.confirmLabel}
          onConfirm={() => modal.onConfirm()}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── MermaidBlock wrapper: visual editor for new blocks, legacy fallback ─────

function MermaidBlock({ block, onChange, onCopy }) {
  const [fullscreen, setFullscreen] = useStateM(false);
  const [resizing, setResizing] = useStateM(false);
  const height = block.height || 360;
  const hasGraph = Array.isArray(block.nodes);

  // Migrate legacy blocks: if user adds a block before the new format existed,
  // it'll have text but no nodes. We render a one-time migrate banner.
  // For now, we just default new blocks to graph mode in `makeBlock`.

  const startResize = (e) => {
    e.preventDefault();
    setResizing(true);
    const startY = e.clientY;
    const startH = height;
    const move = (ev) => {
      const next = Math.max(200, Math.min(1000, startH + (ev.clientY - startY)));
      onChange({ height: next });
    };
    const up = () => {
      setResizing(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  useEffectM(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === "Escape") setFullscreen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Legacy fallback: if the block has only mermaid source (no nodes), render it
  // using mermaid.js so older notes keep working.
  if (!hasGraph) {
    return (
      <div className="mermaid-block legacy">
        <div className="mermaid-block-header">
          <span className="mermaid-badge"><Icon name="git-branch" size={10} /> Mermaid (alt)</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Legacy-Mermaid-Block</span>
          <div style={{ marginLeft: "auto" }}>
            <button className="btn sm" onClick={() => {
              if (!window.confirm) return;
              if (!confirm("Diesen Mermaid-Block durch ein leeres visuelles Diagramm ersetzen?")) return;
              onChange({ text: undefined, nodes: [], edges: [], view: undefined });
            }}>Auf Visuell umstellen</button>
          </div>
        </div>
        <div className="mermaid-legacy-body">
          <LegacyMermaidRender text={block.text || ""} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={"mermaid-block" + (resizing ? " resizing" : "")}
        style={{ "--mermaid-h": height + "px" }}
      >
        <VisualDiagram
          block={block}
          onChange={onChange}
          onCopy={onCopy}
          onOpenFullscreen={() => setFullscreen(true)}
        />
        <div className="mermaid-resize-handle" onMouseDown={startResize} title="Höhe anpassen (ziehen)">
          <span></span><span></span>
        </div>
      </div>

      {fullscreen && (
        <div className="mermaid-fullscreen-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setFullscreen(false); }}>
          <VisualDiagram
            block={block}
            onChange={onChange}
            onCopy={onCopy}
            fullscreen
            onCloseFullscreen={() => setFullscreen(false)}
          />
        </div>
      )}
    </>
  );
}

// ── Legacy mermaid renderer (for backward compatibility) ─────────────────────
let __mermaidCurrentTheme = null;
const ensureMermaid = (isDark) => {
  if (typeof mermaid === "undefined") return null;
  const wantTheme = isDark ? "dark" : "light";
  if (__mermaidCurrentTheme !== wantTheme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: isDark ? "dark" : "default",
      fontFamily: '"DM Sans", system-ui, sans-serif',
    });
    __mermaidCurrentTheme = wantTheme;
  }
  return mermaid;
};

function LegacyMermaidRender({ text }) {
  const [svg, setSvg] = useStateM("");
  const [error, setError] = useStateM("");
  const idRef = useRefM("lmd-" + Math.random().toString(36).slice(2, 8));
  useEffectM(() => {
    if (!text.trim()) { setSvg(""); setError(""); return; }
    let cancelled = false;
    const tryRender = (attempt = 0) => {
      const m = ensureMermaid(document.documentElement.getAttribute("data-theme") === "dark");
      if (!m) { if (attempt < 20) setTimeout(() => tryRender(attempt + 1), 150); return; }
      m.render(idRef.current + "-" + Date.now().toString(36), text)
        .then(({ svg }) => { if (!cancelled) { setSvg(svg); setError(""); } })
        .catch(e => { if (!cancelled) setError((e?.message || String(e)).split("\n").slice(0, 6).join("\n")); });
    };
    tryRender();
    return () => { cancelled = true; };
  }, [text]);
  if (error) return <div className="mermaid-error"><Icon name="alert" size={14} /><pre>{error}</pre></div>;
  if (svg) return <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />;
  return <div className="mermaid-loading">Rendert…</div>;
}

Object.assign(window, {
  MermaidBlock, DIAGRAM_TEMPLATES, SHAPES, COLORS, graphToMermaid,
  PromptModal, ConfirmModal,
});
