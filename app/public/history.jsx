// history.jsx — Per-note version history.
// Snapshots are stored in a separate localStorage key (notes-app-v1-history) so
// they don't bloat the main state. Each note keeps up to MAX_VERSIONS snapshots.
//
// Snapshot triggers:
//   1) When the user switches away from an edited note
//   2) Every ~3 minutes of active editing on the same note
//   3) Manually, via the "Snapshot jetzt" button in the modal
//
// Within a 60-second window of the previous snapshot, a new snapshot REPLACES
// the previous one rather than appending — keeps the list readable.

const { useState: useStateH, useEffect: useEffectH, useRef: useRefH, useMemo: useMemoH } = React;

const HISTORY_KEY = "notes-app-v1-history";
const MAX_VERSIONS = 40;
const REPLACE_WINDOW_MS = 60_000;
const AUTOSAVE_INTERVAL_MS = 3 * 60_000;

const loadHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch (e) { console.warn("History load failed", e); }
  return {};
};
const saveHistory = (h) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }
  catch (e) { console.warn("History save failed", e); }
};

// Build a stable signature for change detection (title + tags + blocks)
const noteSignature = (n) => {
  if (!n) return "";
  // We omit timestamps to avoid spurious "changes".
  const sig = {
    title: n.title || "",
    icon: n.icon || "",
    tags: (n.tags || []).join("\n"),
    dueDate: n.dueDate || "",
    blocks: (n.blocks || []).map(b => {
      const { id, ...rest } = b;
      return rest;
    }),
  };
  try { return JSON.stringify(sig); } catch { return ""; }
};

// Lightweight word-count for previews
const previewOfNote = (n) => {
  if (!n) return "";
  const parts = [];
  (n.blocks || []).forEach(b => {
    if (b.text) parts.push(b.text);
    else if (b.items) parts.push(b.items.map(i => i.text || i.name || "").join(" "));
    else if (b.rows) parts.push(b.rows.flat().join(" "));
  });
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 200);
};

const getVersions = (noteId) => {
  const h = loadHistory();
  return h[noteId] || [];
};

// Trim list to MAX_VERSIONS but always preserve pinned versions.
const trimList = (list) => {
  if (list.length <= MAX_VERSIONS) return list;
  const pinned = new Set(list.filter(v => v.pinned).map(v => v.id));
  const unpinned = list.filter(v => !pinned.has(v.id));
  const keepUnpinned = new Set(unpinned.slice(0, Math.max(1, MAX_VERSIONS - pinned.size)).map(v => v.id));
  return list.filter(v => pinned.has(v.id) || keepUnpinned.has(v.id));
};

// Record a snapshot. Returns true if a new (or replacement) snapshot was stored.
const recordSnapshot = (note, { reason = "auto" } = {}) => {
  if (!note || !note.id) return false;
  const sig = noteSignature(note);
  if (!sig) return false;
  const h = loadHistory();
  const list = h[note.id] || [];
  const last = list[0];

  // Skip if unchanged
  if (last && last.sig === sig) return false;

  const snapshot = {
    id: uid(),
    ts: nowIso(),
    sig,
    reason,
    pinned: false,
    title: note.title || "",
    icon: note.icon || "",
    tags: [...(note.tags || [])],
    dueDate: note.dueDate || null,
    blocks: JSON.parse(JSON.stringify(note.blocks || [])),
  };

  // Replace if within window — but never overwrite a pinned snapshot
  if (last && reason === "auto" && !last.pinned) {
    const dt = Date.now() - new Date(last.ts).getTime();
    if (dt < REPLACE_WINDOW_MS) {
      list[0] = snapshot;
      h[note.id] = trimList(list);
      saveHistory(h);
      return true;
    }
  }

  list.unshift(snapshot);
  h[note.id] = trimList(list);
  saveHistory(h);
  return true;
};

const togglePinVersion = (noteId, versionId) => {
  const h = loadHistory();
  const list = h[noteId] || [];
  const v = list.find(x => x.id === versionId);
  if (!v) return false;
  v.pinned = !v.pinned;
  saveHistory(h);
  return v.pinned;
};

const deleteVersion = (noteId, versionId) => {
  const h = loadHistory();
  if (!h[noteId]) return;
  h[noteId] = h[noteId].filter(v => v.id !== versionId);
  if (h[noteId].length === 0) delete h[noteId];
  saveHistory(h);
};

const clearAllVersions = (noteId) => {
  const h = loadHistory();
  delete h[noteId];
  saveHistory(h);
};

const clearAllHistory = () => {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
};

// Hook: auto-snapshot the currently selected note.
// Calls onSnapshot every change cycle:
//   - Records snapshot of the previously-selected note when we switch away
//   - Periodically (every AUTOSAVE_INTERVAL_MS) records the current note
function useAutoSnapshot(currentNote) {
  const lastIdRef = useRefH(null);
  const lastNoteRef = useRefH(null);

  // Keep latest note in a ref so the interval can read it
  useEffectH(() => {
    lastNoteRef.current = currentNote;
  }, [currentNote]);

  // On note switch: snapshot the previous one
  useEffectH(() => {
    const prevId = lastIdRef.current;
    if (prevId && prevId !== currentNote?.id && lastNoteRef.previous) {
      recordSnapshot(lastNoteRef.previous, { reason: "switch" });
    }
    lastIdRef.current = currentNote?.id || null;
    lastNoteRef.previous = currentNote;
  }, [currentNote?.id]);

  // Periodic snapshot
  useEffectH(() => {
    const t = setInterval(() => {
      const n = lastNoteRef.current;
      if (n) recordSnapshot(n, { reason: "auto" });
    }, AUTOSAVE_INTERVAL_MS);
    // On unmount / page hide: snapshot now
    const onHide = () => {
      const n = lastNoteRef.current;
      if (n) recordSnapshot(n, { reason: "auto" });
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    window.addEventListener("beforeunload", onHide);
    return () => {
      clearInterval(t);
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);
}

// ── UI ────────────────────────────────────────────────────────────────────────

function formatVersionTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Heute, ${time}`;
  if (isYesterday) return `Gestern, ${time}`;
  const dateStr = d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
  return `${dateStr}, ${time}`;
}

function relativeAge(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "gerade";
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m} Min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  if (d < 30) return `vor ${d} Tag${d === 1 ? "" : "en"}`;
  return formatVersionTime(iso);
}

// ── Stats & grouping helpers ──────────────────────────────────────────────────

function countVersion(v) {
  if (!v) return { words: 0, chars: 0, blocks: 0, tags: 0 };
  const blocks = v.blocks || [];
  let chars = 0, words = 0;
  const wc = (s) => {
    if (typeof s !== "string" || !s) return;
    chars += s.length;
    const m = s.match(/\S+/g);
    if (m) words += m.length;
  };
  blocks.forEach(b => {
    if (b.text) wc(b.text);
    if (b.items) b.items.forEach(i => { wc(i.text); wc(i.name); wc(i.amount); wc(i.unit); });
    if (b.rows) b.rows.forEach(r => r.forEach(c => wc(c)));
    if (b.headers) b.headers.forEach(h => wc(h));
    if (b.caption) wc(b.caption);
    if (b.nodes) b.nodes.forEach(n => wc(n.label));
    if (b.kind === "recipe-meta") {
      wc(String(b.servings || ""));
      wc(b.prepTime); wc(b.cookTime); wc(b.difficulty);
    }
  });
  wc(v.title || "");
  return { words, chars, blocks: blocks.length, tags: (v.tags || []).length };
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + " Sek";
  const m = Math.floor(s / 60);
  if (m < 60) return m + " Min";
  const h = Math.floor(m / 60);
  const restM = m % 60;
  if (h < 24) return h + " Std" + (restM ? " " + restM + " Min" : "");
  const days = Math.floor(h / 24);
  return days + " Tag" + (days === 1 ? "" : "e");
}

function dayKey(iso) {
  const d = new Date(iso);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function dayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Heute";
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Gestern";
  // Within last 7 days → weekday + date
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString("de-DE", { weekday: "long" });
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

function groupByDay(versions) {
  const groups = [];
  let curKey = null, cur = null;
  versions.forEach(v => {
    const k = dayKey(v.ts);
    if (k !== curKey) {
      curKey = k;
      cur = { key: k, label: dayLabel(v.ts), items: [] };
      groups.push(cur);
    }
    cur.items.push(v);
  });
  return groups;
}

// ── Block matching with "modified" detection ─────────────────────────────────


function blockSig(b) {
  if (!b) return "";
  try {
    const { id, ...rest } = b;
    return JSON.stringify({ k: rest.kind, ...rest });
  } catch { return ""; }
}

// Render a compact preview of a diagram block's nodes (used in add/del/context cards)
function MermaidPreview({ block }) {
  const nodes = block?.nodes || [];
  const edges = block?.edges || [];
  if (nodes.length === 0 && !block?.text) {
    return <div className="mermaid-diff-empty">(leeres Diagramm)</div>;
  }
  if (nodes.length === 0 && block?.text) {
    // Legacy mermaid: just show the source text condensed
    return (
      <pre style={{ margin: 0, padding: "6px 8px", background: "var(--surface-2)", borderRadius: 5, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>{block.text}</pre>
    );
  }
  return (
    <div className="mermaid-preview-chips">
      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {nodes.length} Knoten · {edges.length} Verbindung{edges.length === 1 ? "" : "en"}
      </span>
      {nodes.slice(0, 10).map(n => (
        <span key={n.id} className="mermaid-preview-chip">
          <span className={"shape-chip shape-" + (n.shape || "round") + (n.color ? " color-" + n.color : "")}></span>
          {n.label || "(leer)"}
        </span>
      ))}
      {nodes.length > 10 && (
        <span className="mermaid-preview-chip" style={{ color: "var(--text-subtle)" }}>… +{nodes.length - 10}</span>
      )}
    </div>
  );
}

// Compute a detailed diff between two diagram blocks
function diffMermaidBlock(fromBlock, toBlock) {
  const fromNodes = fromBlock?.nodes || [];
  const toNodes = toBlock?.nodes || [];
  const fromEdges = fromBlock?.edges || [];
  const toEdges = toBlock?.edges || [];
  const fromNodeMap = new Map(fromNodes.map(n => [n.id, n]));
  const toNodeMap = new Map(toNodes.map(n => [n.id, n]));

  const nodeChanges = [];
  // Added nodes (in to but not in from)
  toNodes.forEach(n => {
    if (!fromNodeMap.has(n.id)) nodeChanges.push({ kind: "add", node: n });
  });
  // Removed (in from but not in to)
  fromNodes.forEach(n => {
    if (!toNodeMap.has(n.id)) nodeChanges.push({ kind: "del", node: n });
  });
  // Modified (in both but differ)
  fromNodes.forEach(n => {
    const o = toNodeMap.get(n.id);
    if (!o) return;
    if (n.label !== o.label || n.shape !== o.shape || n.color !== o.color) {
      nodeChanges.push({ kind: "mod", from: n, to: o });
    }
  });

  const edgeKey = (e) => e.from + "→" + e.to;
  const fromEdgeMap = new Map(fromEdges.map(e => [edgeKey(e), e]));
  const toEdgeMap = new Map(toEdges.map(e => [edgeKey(e), e]));
  const edgeChanges = [];
  toEdges.forEach(e => {
    if (!fromEdgeMap.has(edgeKey(e))) edgeChanges.push({ kind: "add", edge: e });
  });
  fromEdges.forEach(e => {
    if (!toEdgeMap.has(edgeKey(e))) edgeChanges.push({ kind: "del", edge: e });
  });
  fromEdges.forEach(e => {
    const o = toEdgeMap.get(edgeKey(e));
    if (o && (e.label || "") !== (o.label || "")) {
      edgeChanges.push({ kind: "mod", from: e, to: o });
    }
  });

  return {
    nodeChanges,
    edgeChanges,
    addedNodes: nodeChanges.filter(c => c.kind === "add").length,
    removedNodes: nodeChanges.filter(c => c.kind === "del").length,
    modifiedNodes: nodeChanges.filter(c => c.kind === "mod").length,
    addedEdges: edgeChanges.filter(c => c.kind === "add").length,
    removedEdges: edgeChanges.filter(c => c.kind === "del").length,
    modifiedEdges: edgeChanges.filter(c => c.kind === "mod").length,
  };
}

function MermaidDiffCard({ from, to }) {
  const d = useMemoH(() => diffMermaidBlock(from, to), [from, to]);

  const lookupNodeLabel = (id) => {
    const fromN = (from?.nodes || []).find(n => n.id === id);
    const toN = (to?.nodes || []).find(n => n.id === id);
    return (toN?.label || fromN?.label || id);
  };

  const hasChanges = d.nodeChanges.length > 0 || d.edgeChanges.length > 0;

  return (
    <div className="mermaid-diff-card">
      <div className="mermaid-diff-card-head">
        <Icon name="git-branch" size={10} />
        <span>Diagramm</span>
        <span className="summary">
          {d.addedNodes + d.addedEdges > 0 && <span className="add">+{d.addedNodes + d.addedEdges}</span>}
          {d.modifiedNodes + d.modifiedEdges > 0 && <span className="mod">~{d.modifiedNodes + d.modifiedEdges}</span>}
          {d.removedNodes + d.removedEdges > 0 && <span className="del">−{d.removedNodes + d.removedEdges}</span>}
        </span>
      </div>
      <div className="mermaid-diff-card-body">
        {!hasChanges && <div className="mermaid-diff-empty">Keine strukturellen Änderungen</div>}

        {d.nodeChanges.map((c, i) => {
          if (c.kind === "add") return (
            <div key={"n-a-" + i} className="mermaid-diff-row add">
              <span className="marker">+</span>
              <span className="kind">Knoten</span>
              <span className={"shape-chip shape-" + (c.node.shape || "round") + (c.node.color ? " color-" + c.node.color : "")}></span>
              <span className="label">{c.node.label || "(leer)"}</span>
            </div>
          );
          if (c.kind === "del") return (
            <div key={"n-d-" + i} className="mermaid-diff-row del">
              <span className="marker">−</span>
              <span className="kind">Knoten</span>
              <span className={"shape-chip shape-" + (c.node.shape || "round") + (c.node.color ? " color-" + c.node.color : "")}></span>
              <span className="label">{c.node.label || "(leer)"}</span>
            </div>
          );
          // modified
          const f = c.from, t = c.to;
          const labelChanged = f.label !== t.label;
          const shapeChanged = (f.shape || "round") !== (t.shape || "round");
          const colorChanged = (f.color || "") !== (t.color || "");
          return (
            <div key={"n-m-" + i} className="mermaid-diff-row mod">
              <span className="marker">~</span>
              <span className="kind">Knoten</span>
              <span className={"shape-chip shape-" + (t.shape || "round") + (t.color ? " color-" + t.color : "")}></span>
              <span className="label">
                {labelChanged ? (
                  <>
                    <span className="word-diff-del">{f.label || "(leer)"}</span>
                    <span style={{ color: "var(--text-muted)", padding: "0 4px" }}>→</span>
                    <span className="word-diff-add">{t.label || "(leer)"}</span>
                  </>
                ) : (
                  <span>{t.label || "(leer)"}</span>
                )}
                {(shapeChanged || colorChanged) && (
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8 }}>
                    {shapeChanged && <span>Form: {f.shape || "round"} → {t.shape || "round"}</span>}
                    {shapeChanged && colorChanged && <span> · </span>}
                    {colorChanged && <span>Farbe: {f.color || "default"} → {t.color || "default"}</span>}
                  </span>
                )}
              </span>
            </div>
          );
        })}

        {d.edgeChanges.map((c, i) => {
          if (c.kind === "add") return (
            <div key={"e-a-" + i} className="mermaid-diff-row add">
              <span className="marker">+</span>
              <span className="kind">Verbindung</span>
              <span className="label">
                {lookupNodeLabel(c.edge.from)} <span className="arrow">→</span> {lookupNodeLabel(c.edge.to)}
                {c.edge.label && <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>„{c.edge.label}"</span>}
              </span>
            </div>
          );
          if (c.kind === "del") return (
            <div key={"e-d-" + i} className="mermaid-diff-row del">
              <span className="marker">−</span>
              <span className="kind">Verbindung</span>
              <span className="label">
                {lookupNodeLabel(c.edge.from)} <span className="arrow">→</span> {lookupNodeLabel(c.edge.to)}
                {c.edge.label && <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>„{c.edge.label}"</span>}
              </span>
            </div>
          );
          return (
            <div key={"e-m-" + i} className="mermaid-diff-row mod">
              <span className="marker">~</span>
              <span className="kind">Beschriftung</span>
              <span className="label">
                {lookupNodeLabel(c.from.from)} <span className="arrow">→</span> {lookupNodeLabel(c.from.to)}:{" "}
                <span className="word-diff-del">{c.from.label || "(leer)"}</span>
                <span style={{ padding: "0 4px", color: "var(--text-muted)" }}>→</span>
                <span className="word-diff-add">{c.to.label || "(leer)"}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Human-readable block-kind label, for diff badges.
const BLOCK_KIND_LABEL = {
  heading: "Überschrift",
  subheading: "Zwischentitel",
  text: "Text",
  checklist: "Checkliste",
  code: "Code",
  mermaid: "Diagramm",
  table: "Tabelle",
  image: "Bild",
  status: "Status",
  links: "Links",
  noteref: "Notiz-Link",
  "recipe-meta": "Rezept-Info",
  ingredients: "Zutaten",
};
const blockKindLabel = (b) => BLOCK_KIND_LABEL[b?.kind] || (b?.kind || "Block");

// True if a block has no meaningful content — used to skip noise in the diff.
function isBlockEmpty(b) {
  if (!b) return true;
  if (b.text && b.text.trim()) return false;
  if (b.items && b.items.length > 0 && b.items.some(i => (i.text || i.name || i.amount || i.unit))) return false;
  if (b.rows && b.rows.length > 0 && b.rows.some(r => r.some(c => c && c.trim && c.trim()))) return false;
  if (b.headers && b.headers.some(h => h && h.trim && h.trim())) return false;
  if (b.nodes && b.nodes.length > 0) return false;
  if (b.edges && b.edges.length > 0) return false;
  if (b.src) return false;
  if (b.kind === "status" && b.value && b.value !== "neutral") return false;
  if (b.kind === "recipe-meta" && (b.servings || b.prepTime || b.cookTime || b.difficulty)) return false;
  if (b.caption && b.caption.trim()) return false;
  return true;
}

// Block-level diff: render the note as it normally looks, but with each block
// flagged as added (green), removed (red), modified (yellow with inline word-diff),
// or unchanged (normal).
function matchBlocksWithModified(fromBlocks, toBlocks) {
  if (typeof Diff === "undefined") return null;
  const fromSigs = fromBlocks.map(blockSig);
  const toSigs = toBlocks.map(blockSig);
  const parts = Diff.diffArrays(fromSigs, toSigs);
  const segments = [];
  let fi = 0, ti = 0;
  parts.forEach(p => {
    const count = p.value.length;
    if (p.added) {
      for (let k = 0; k < count; k++) segments.push({ kind: "add", to: toBlocks[ti++] });
    } else if (p.removed) {
      for (let k = 0; k < count; k++) segments.push({ kind: "del", from: fromBlocks[fi++] });
    } else {
      for (let k = 0; k < count; k++) {
        segments.push({ kind: "context", from: fromBlocks[fi], to: toBlocks[ti] });
        fi++; ti++;
      }
    }
  });
  // Second pass: pair adjacent del+add of same kind into "modified".
  const merged = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (s.kind !== "del") { merged.push(s); continue; }
    let j = i;
    const dels = [];
    while (j < segments.length && segments[j].kind === "del") { dels.push(segments[j]); j++; }
    const adds = [];
    while (j < segments.length && segments[j].kind === "add") { adds.push(segments[j]); j++; }
    const usedDel = new Set(), usedAdd = new Set();
    for (let di = 0; di < dels.length; di++) {
      for (let ai = 0; ai < adds.length; ai++) {
        if (usedAdd.has(ai)) continue;
        if (dels[di].from.kind === adds[ai].to.kind) {
          merged.push({ kind: "mod", from: dels[di].from, to: adds[ai].to });
          usedDel.add(di); usedAdd.add(ai);
          break;
        }
      }
    }
    for (let di = 0; di < dels.length; di++) if (!usedDel.has(di)) merged.push(dels[di]);
    for (let ai = 0; ai < adds.length; ai++) if (!usedAdd.has(ai)) merged.push(adds[ai]);
    i = j - 1;
  }
  return merged;
}

// Inline word-level diff for text — used inside modified text blocks.
function InlineWordDiff({ from, to }) {
  if (typeof Diff === "undefined" || (!from && !to)) return <span>{to || ""}</span>;
  const parts = Diff.diffWordsWithSpace(from || "", to || "");
  return (
    <React.Fragment>
      {parts.map((p, i) => {
        if (p.added) return <span key={i} className="word-diff-add">{p.value}</span>;
        if (p.removed) return <span key={i} className="word-diff-del">{p.value}</span>;
        return <span key={i}>{p.value}</span>;
      })}
    </React.Fragment>
  );
}

// Render a "modified" block — show inline word-diff for text-like blocks,
// dedicated structural diff for diagrams, stack old/new for everything else.
function ModifiedBlockView({ from, to }) {
  const sameKind = from.kind === to.kind;
  if (sameKind && from.kind === "heading") {
    return <div className="text-block heading" style={{ pointerEvents: "none" }}><InlineWordDiff from={from.text} to={to.text} /></div>;
  }
  if (sameKind && from.kind === "subheading") {
    return <div className="text-block subheading" style={{ pointerEvents: "none" }}><InlineWordDiff from={from.text} to={to.text} /></div>;
  }
  if (sameKind && from.kind === "text") {
    return <div className="text-block" style={{ pointerEvents: "none", whiteSpace: "pre-wrap" }}><InlineWordDiff from={from.text} to={to.text} /></div>;
  }
  if (sameKind && from.kind === "code") {
    return (
      <div className="code-block">
        <div className="code-block-header"><span style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{from.lang || "code"}</span></div>
        <pre style={{ padding: "8px 10px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          <InlineWordDiff from={from.text} to={to.text} />
        </pre>
      </div>
    );
  }
  if (sameKind && from.kind === "mermaid") {
    return <MermaidDiffCard from={from} to={to} />;
  }
  if (sameKind && from.kind === "checklist") {
    return <ChecklistDiff from={from} to={to} />;
  }
  if (sameKind && from.kind === "recipe-meta") {
    return <RecipeMetaDiff from={from} to={to} />;
  }
  if (sameKind && from.kind === "ingredients") {
    return <IngredientsDiff from={from} to={to} />;
  }
  if (sameKind && from.kind === "status") {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Status: <span className="word-diff-del">{from.value}</span>
        <span style={{ padding: "0 4px" }}>→</span>
        <span className="word-diff-add">{to.value}</span>
      </div>
    );
  }
  // Fallback: stack old + new
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ opacity: 0.65, textDecoration: "line-through" }}><ReadOnlyBlock block={from} /></div>
      <div><ReadOnlyBlock block={to} /></div>
    </div>
  );
}

// Diff for recipe-meta block — field-by-field
function RecipeMetaDiff({ from, to }) {
  const fields = [
    { key: "servings",  icon: "🍽️", label: "Portionen" },
    { key: "prepTime",  icon: "⏱️", label: "Vorb." },
    { key: "cookTime",  icon: "🔥", label: "Kochen" },
    { key: "difficulty", icon: "⚡", label: "Schwierigkeit" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
      {fields.map(f => {
        const a = String(from[f.key] ?? "");
        const b = String(to[f.key] ?? "");
        const changed = a !== b;
        return (
          <div key={f.key} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ color: "var(--text-muted)" }}>{f.icon} {f.label}:</span>
            {changed ? (
              <>
                <span className="word-diff-del">{a || "—"}</span>
                <span style={{ color: "var(--text-muted)", padding: "0 2px" }}>→</span>
                <span className="word-diff-add">{b || "—"}</span>
              </>
            ) : (
              <strong style={{ color: "var(--text)" }}>{b || "—"}</strong>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Diff for ingredients block — item-level (added/removed/modified)
function IngredientsDiff({ from, to }) {
  const fromItems = from.items || [];
  const toItems = to.items || [];
  // Match by name (case-insensitive). Items with same name → potentially modified.
  const normName = (n) => (n || "").trim().toLowerCase();
  const fromMap = new Map();
  fromItems.forEach((i, idx) => {
    if (i.name) fromMap.set(normName(i.name), { item: i, idx });
  });
  const seenFrom = new Set();
  const rows = [];
  toItems.forEach(t => {
    const key = normName(t.name);
    const match = fromMap.get(key);
    if (!match) {
      rows.push({ kind: "add", to: t });
    } else {
      seenFrom.add(match.idx);
      const f = match.item;
      const amountChanged = (f.amount || "") !== (t.amount || "");
      const unitChanged = (f.unit || "") !== (t.unit || "");
      if (amountChanged || unitChanged) {
        rows.push({ kind: "mod", from: f, to: t });
      } else {
        rows.push({ kind: "same", to: t });
      }
    }
  });
  fromItems.forEach((f, idx) => {
    if (!seenFrom.has(idx) && f.name) rows.push({ kind: "del", from: f });
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12.5 }}>
      {rows.map((r, i) => {
        if (r.kind === "add") return (
          <div key={i} className="word-diff-add" style={{ display: "flex", gap: 6, padding: "1px 2px" }}>
            <span style={{ minWidth: 50, opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>{r.to.amount} {r.to.unit}</span>
            <span>{r.to.name}</span>
          </div>
        );
        if (r.kind === "del") return (
          <div key={i} className="word-diff-del" style={{ display: "flex", gap: 6, padding: "1px 2px" }}>
            <span style={{ minWidth: 50, opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>{r.from.amount} {r.from.unit}</span>
            <span>{r.from.name}</span>
          </div>
        );
        if (r.kind === "mod") return (
          <div key={i} style={{ display: "flex", gap: 6, padding: "1px 2px", alignItems: "baseline" }}>
            <span style={{ minWidth: 50, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
              <span className="word-diff-del">{r.from.amount} {r.from.unit}</span>
              <span style={{ padding: "0 2px" }}>→</span>
              <span className="word-diff-add">{r.to.amount} {r.to.unit}</span>
            </span>
            <span>{r.to.name}</span>
          </div>
        );
        return (
          <div key={i} style={{ display: "flex", gap: 6, opacity: 0.6, padding: "1px 2px" }}>
            <span style={{ minWidth: 50, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{r.to.amount} {r.to.unit}</span>
            <span>{r.to.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// Diff for checklist items — show added/removed/changed items inline.
function ChecklistDiff({ from, to }) {
  const fromItems = from.items || [];
  const toItems = to.items || [];
  const fromMap = new Map(fromItems.map(i => [i.text || "", i]));
  const toMap = new Map(toItems.map(i => [i.text || "", i]));
  const rows = [];
  toItems.forEach(i => {
    const o = fromMap.get(i.text || "");
    if (!o) rows.push({ kind: "add", item: i });
    else if (o.done !== i.done) rows.push({ kind: "toggle", from: o, to: i });
    else rows.push({ kind: "same", item: i });
  });
  fromItems.forEach(i => {
    if (!toMap.has(i.text || "")) rows.push({ kind: "del", item: i });
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map((r, i) => {
        const item = r.item || r.to;
        const cls = r.kind === "add" ? "word-diff-add" : r.kind === "del" ? "word-diff-del" : "";
        const checked = (r.to || r.item || {}).done;
        return (
          <div key={i} className={"checklist-row" + (checked ? " done" : "")} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "1px 0" }}>
            <span style={{ width: 14, height: 14, border: "1.5px solid var(--border-strong)", borderRadius: 3, background: checked ? "var(--accent)" : "transparent", display: "inline-block", flexShrink: 0, marginTop: 3 }}></span>
            <span className={cls} style={{ flex: 1 }}>
              {item.text || ""}
              {r.kind === "toggle" && (
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8 }}>({r.to.done ? "erledigt" : "wieder offen"})</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VersionBlocksDiff({ from, to, fromLabel = "Diese Version", toLabel = "Aktueller Stand" }) {
  const fromBlocks = from?.blocks || [];
  const toBlocks = to?.blocks || [];

  const segments = useMemoH(() => matchBlocksWithModified(fromBlocks, toBlocks), [from, to]);

  if (segments === null) {
    return <div className="version-diff-loading">Diff-Bibliothek wird geladen…</div>;
  }

  const added = segments.filter(s => s.kind === "add").length;
  const removed = segments.filter(s => s.kind === "del").length;
  const modified = segments.filter(s => s.kind === "mod").length;

  const titleChanged = (from?.title || "") !== (to?.title || "");
  const fromTags = new Set(from?.tags || []);
  const toTags = new Set(to?.tags || []);
  const addedTags = [...toTags].filter(t => !fromTags.has(t));
  const removedTags = [...fromTags].filter(t => !toTags.has(t));

  const noChange = !titleChanged && addedTags.length === 0 && removedTags.length === 0 && added === 0 && removed === 0 && modified === 0;

  if (noChange) {
    return (
      <div className="version-diff-empty">
        <Icon name="check" size={18} />
        <div>Keine Unterschiede</div>
        <div className="version-diff-empty-sub">{fromLabel} und {toLabel} sind identisch.</div>
      </div>
    );
  }

  return (
    <div className="version-blocks-diff">
      <div className="version-diff-summary">
        {added > 0 && <span className="version-diff-stat add"><span className="version-diff-stat-bar" style={{ width: Math.min(60, added * 8) + "px" }}></span>+{added}</span>}
        {modified > 0 && <span className="version-diff-stat" style={{ color: "var(--warning)" }}><span className="version-diff-stat-bar" style={{ width: Math.min(60, modified * 8) + "px", background: "var(--warning)" }}></span>~{modified}</span>}
        {removed > 0 && <span className="version-diff-stat del"><span className="version-diff-stat-bar" style={{ width: Math.min(60, removed * 8) + "px" }}></span>−{removed}</span>}
        <span className="version-diff-legend">{fromLabel} → {toLabel}</span>
      </div>

      <div className="version-blocks-diff-body">
        {titleChanged ? (
          <div className="version-blocks-diff-title">
            <div className="version-blocks-diff-block mod">
              <span className="version-diff-marker">~</span>
              <div className="version-preview-title">
                <InlineWordDiff from={from?.title || ""} to={to?.title || ""} />
              </div>
            </div>
          </div>
        ) : (
          <div className="version-preview-title" style={{ marginBottom: 10 }}>{to?.title || from?.title || "Ohne Titel"}</div>
        )}

        {(addedTags.length > 0 || removedTags.length > 0) && (
          <div className="version-blocks-diff-tags">
            {[...toTags].filter(t => !addedTags.includes(t) && !removedTags.includes(t)).map((t, i) =>
              <span key={"u-" + i} className="tag">#{t}</span>
            )}
            {addedTags.map((t, i) => <span key={"a-" + i} className="tag tag-added">+ #{t}</span>)}
            {removedTags.map((t, i) => <span key={"r-" + i} className="tag tag-removed">− #{t}</span>)}
          </div>
        )}

        <div className="version-blocks-diff-list">
          {segments.map((s, i) => {
            const block = s.kind === "del" ? s.from : s.to;
            const empty = s.kind !== "mod" && isBlockEmpty(block);
            const cls = "version-blocks-diff-block " + s.kind + (empty ? " empty" : "");
            return (
              <div key={i} className={cls}>
                {s.kind !== "context" && (
                  <span className="version-diff-marker">{s.kind === "add" ? "+" : s.kind === "del" ? "−" : "~"}</span>
                )}
                <span className="version-block-kind">{blockKindLabel(block)}</span>
                <div className="version-blocks-diff-block-inner">
                  {empty ? (
                    <span style={{ color: "var(--text-subtle)", fontStyle: "italic", fontSize: 11.5 }}>
                      leerer {
                        block.kind === "mermaid" ? "Diagramm-" :
                        block.kind === "code" ? "Code-" :
                        block.kind === "checklist" ? "Checklisten-" :
                        block.kind === "table" ? "Tabellen-" :
                        block.kind === "ingredients" ? "Zutaten-" :
                        block.kind === "recipe-meta" ? "Rezept-Info-" :
                        block.kind === "links" ? "Link-" :
                        block.kind === "image" ? "Bild-" :
                        ""
                      }Block
                    </span>
                  ) : s.kind === "mod"
                    ? <ModifiedBlockView from={s.from} to={s.to} />
                    : <ReadOnlyBlock block={block} />
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Convert a note/version to a single text representation we can diff line-by-line.
// We reuse the markdown serializer if available; otherwise fall back to a simple
// title+blocks dump.
function versionToText(v) {
  if (!v) return "";
  if (typeof window.toMarkdown === "function") {
    return window.toMarkdown({
      title: v.title || "",
      tags: v.tags || [],
      blocks: v.blocks || [],
      // Strip metadata noise that would always diff (timestamps etc.)
    }).replace(/^_Erstellt:.*$/m, "").replace(/^_Aktualisiert:.*$/m, "");
  }
  const lines = [`# ${v.title || ""}`];
  if (v.tags?.length) lines.push(v.tags.map(t => `#${t}`).join(" "));
  (v.blocks || []).forEach(b => {
    if (b.text) lines.push(b.text);
    if (b.items) b.items.forEach(i => lines.push(`- ${i.text || i.name || ""}`));
    if (b.rows) b.rows.forEach(r => lines.push(r.join(" | ")));
  });
  return lines.join("\n");
}

// Render a unified line-level diff between two versions.
// `from` is the older state, `to` is the newer state (or current note).
function VersionDiff({ from, to, fromLabel = "Diese Version", toLabel = "Aktueller Stand" }) {
  const fromText = useMemoH(() => versionToText(from), [from]);
  const toText = useMemoH(() => versionToText(to), [to]);
  const parts = useMemoH(() => {
    if (typeof Diff === "undefined") return null;
    // diffLines splits on '\n' and returns chunks with { value, added, removed, count }
    return Diff.diffLines(fromText || "", toText || "", { newlineIsToken: false });
  }, [fromText, toText]);

  if (parts === null) {
    return (
      <div className="version-diff-loading">
        Diff-Bibliothek wird geladen…
      </div>
    );
  }

  // Stats
  let added = 0, removed = 0;
  parts.forEach(p => {
    const ls = (p.value || "").split("\n");
    // jsdiff appends an empty trailing element for blocks ending in \n; ignore it
    const n = ls.length - (p.value.endsWith("\n") ? 1 : 0);
    if (p.added) added += n;
    else if (p.removed) removed += n;
  });

  if (added === 0 && removed === 0) {
    return (
      <div className="version-diff-empty">
        <Icon name="check" size={18} />
        <div>Keine Unterschiede</div>
        <div className="version-diff-empty-sub">{fromLabel} und {toLabel} sind identisch.</div>
      </div>
    );
  }

  // Build line-by-line rows. Each row: { type: 'add'|'del'|'context', text }
  const rows = [];
  parts.forEach(p => {
    const value = p.value || "";
    const trailingNL = value.endsWith("\n");
    const lines = value.split("\n");
    if (trailingNL) lines.pop();
    lines.forEach(line => {
      rows.push({
        type: p.added ? "add" : p.removed ? "del" : "context",
        text: line,
      });
    });
  });

  // Show the whole note inline — context lines remain visible so users see the
  // full document, not just the diff hunks.
  const visible = rows;

  return (
    <div className="version-diff">
      <div className="version-diff-summary">
        <span className="version-diff-stat add"><span className="version-diff-stat-bar" style={{ width: Math.min(60, added * 4) + "px" }}></span>+{added}</span>
        <span className="version-diff-stat del"><span className="version-diff-stat-bar" style={{ width: Math.min(60, removed * 4) + "px" }}></span>−{removed}</span>
        <span className="version-diff-legend">
          {fromLabel} → {toLabel}
        </span>
      </div>
      <div className="version-diff-body" role="region" aria-label="Änderungen">
        {visible.map((r, i) => {
          if (r.type === "skip") {
            return (
              <div key={i} className="version-diff-skip">
                ⋯ {r.count} unveränderte Zeile{r.count === 1 ? "" : "n"}
              </div>
            );
          }
          const sign = r.type === "add" ? "+" : r.type === "del" ? "−" : " ";
          return (
            <div key={i} className={"version-diff-line " + r.type}>
              <span className="version-diff-sign" aria-hidden="true">{sign}</span>
              <span className="version-diff-text">{r.text || "\u00A0"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function collapseContext(rows, ctx = 3) {
  // Walk rows; for context (unchanged) runs longer than 2*ctx, keep first/last ctx
  // and replace the middle with a single "skip" placeholder.
  const out = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i].type !== "context") { out.push(rows[i]); i++; continue; }
    // Collect context run
    let j = i;
    while (j < rows.length && rows[j].type === "context") j++;
    const run = rows.slice(i, j);
    const isStart = i === 0;
    const isEnd = j === rows.length;
    if (run.length <= ctx * 2) {
      // Short context — keep as-is
      // …unless it's the very start or end and longer than ctx: trim
      if ((isStart || isEnd) && run.length > ctx) {
        if (isStart) {
          out.push({ type: "skip", count: run.length - ctx });
          out.push(...run.slice(run.length - ctx));
        } else {
          out.push(...run.slice(0, ctx));
          out.push({ type: "skip", count: run.length - ctx });
        }
      } else {
        out.push(...run);
      }
    } else {
      // Long context — split
      const headCount = isStart ? 0 : ctx;
      const tailCount = isEnd ? 0 : ctx;
      const skipCount = run.length - headCount - tailCount;
      if (headCount) out.push(...run.slice(0, headCount));
      if (skipCount > 0) out.push({ type: "skip", count: skipCount });
      if (tailCount) out.push(...run.slice(run.length - tailCount));
    }
    i = j;
  }
  return out;
}

// Render a snapshot's content as a read-only preview (reuses Block rendering)
function VersionPreview({ version }) {
  if (!version) return null;
  const blocks = version.blocks || [];
  return (
    <div className="version-preview">
      <div className="version-preview-title">{version.title || "Ohne Titel"}</div>
      {(version.tags || []).length > 0 && (
        <div className="version-preview-tags">
          {version.tags.map((t, i) => <span key={i} className="tag">#{t}</span>)}
        </div>
      )}
      <div className="version-preview-blocks">
        {blocks.map((b, i) => (
          <div key={i} className="version-preview-block">
            <ReadOnlyBlock block={b} />
          </div>
        ))}
        {blocks.length === 0 && <div className="version-preview-empty">(leere Notiz)</div>}
      </div>
    </div>
  );
}

function ReadOnlyBlock({ block }) {
  // Static, simplified render — enough to identify content. Avoids depending on
  // the editor's full Block component (which expects callbacks and state).
  if (block.kind === "heading") return <div className="text-block heading" style={{ pointerEvents: "none" }}>{block.text || ""}</div>;
  if (block.kind === "subheading") return <div className="text-block subheading" style={{ pointerEvents: "none" }}>{block.text || ""}</div>;
  if (block.kind === "text") return <div className="text-block" style={{ pointerEvents: "none", whiteSpace: "pre-wrap" }}>{block.text || ""}</div>;
  if (block.kind === "checklist") return (
    <div>{(block.items || []).map((i, k) => (
      <div key={k} className={"checklist-row" + (i.done ? " done" : "")}>
        <span style={{ width: 16, height: 16, border: "1.5px solid var(--border-strong)", borderRadius: 4, background: i.done ? "var(--accent)" : "transparent", display: "inline-block", flexShrink: 0, marginTop: 4 }}></span>
        <span className="text-block" style={{ flex: 1 }}>{i.text || ""}</span>
      </div>
    ))}</div>
  );
  if (block.kind === "code") return (
    <div className="code-block">
      <div className="code-block-header"><span style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{block.lang || "code"}</span></div>
      <pre style={{ padding: "10px 12px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{block.text || ""}</pre>
    </div>
  );
  if (block.kind === "mermaid") {
    if ((block.nodes && block.nodes.length > 0) || (block.edges && block.edges.length > 0)) {
      return <MermaidPreview block={block} />;
    }
    if (!block.text) {
      return <div className="mermaid-diff-empty">(leeres Diagramm)</div>;
    }
    return (
      <pre style={{ margin: 0, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 5, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, maxHeight: 140, overflow: "auto" }}>{block.text}</pre>
    );
  }
  if (block.kind === "table") return (
    <div className="table-block">
      <table>
        <thead><tr>{(block.headers || []).map((h, k) => <th key={k} style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{(block.rows || []).map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} style={{ padding: "6px 10px", fontSize: 12 }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  if (block.kind === "image" && block.src) return <img src={block.src} alt={block.caption || ""} style={{ maxWidth: "100%", borderRadius: 6 }} />;
  if (block.kind === "status") return <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Status: {block.value}</div>;
  if (block.kind === "links") return (
    <div>{(block.items || []).map((l, k) => <div key={k} style={{ fontSize: 12 }}>→ {l.label || l.url}</div>)}</div>
  );
  if (block.kind === "recipe-meta") return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, color: "var(--text-muted)" }}>
      {block.servings != null && <span>🍽️ <strong style={{ color: "var(--text)" }}>{block.servings}</strong> Portionen</span>}
      {block.prepTime && <span>⏱️ Vorb.: <strong style={{ color: "var(--text)" }}>{block.prepTime}</strong></span>}
      {block.cookTime && <span>🔥 Kochen: <strong style={{ color: "var(--text)" }}>{block.cookTime}</strong></span>}
      {block.difficulty && <span>⚡ <strong style={{ color: "var(--text)" }}>{block.difficulty}</strong></span>}
    </div>
  );
  if (block.kind === "ingredients") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12.5 }}>
      {(block.items || []).map((it, k) => (
        <div key={k} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
          <span style={{ minWidth: 50, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
            {it.amount || ""} {it.unit || ""}
          </span>
          <span>{it.name || ""}</span>
        </div>
      ))}
    </div>
  );
  if (block.kind === "noteref") return (
    <div style={{ fontSize: 12, color: "var(--info)" }}>→ {block.label || "(verknüpfte Notiz)"}</div>
  );
  return null;
}

// Reason badge label
const REASON_LABEL = {
  manual: "Manuell",
  auto: "Auto",
  switch: "Wechsel",
  "pre-restore": "Vor Wiederherst.",
};

// Inline stats badge: shows +chars / −chars vs the previous version.
function VersionItemStats({ v, prev }) {
  if (!prev) {
    const c = countVersion(v);
    return (
      <span className="version-item-stats">
        <span className="none">{c.words} W</span>
      </span>
    );
  }
  const a = countVersion(prev);
  const b = countVersion(v);
  const dw = b.words - a.words;
  const dc = b.chars - a.chars;
  if (dw === 0 && dc === 0) {
    return <span className="version-item-stats"><span className="none">±0</span></span>;
  }
  return (
    <span className="version-item-stats" title={(dc >= 0 ? "+" : "") + dc + " Zeichen, " + (dw >= 0 ? "+" : "") + dw + " Wörter"}>
      {dw > 0 && <span className="add">+{dw}</span>}
      {dw < 0 && <span className="del">{dw}</span>}
      {dw !== 0 && <span style={{ color: "var(--text-subtle)", fontWeight: 500 }}>W</span>}
    </span>
  );
}

// Detailed stats panel shown above the diff in the detail pane.
function VersionStatsPanel({ from, to, fromLabel, toLabel, durationMs }) {
  const a = countVersion(from);
  const b = countVersion(to);
  const delta = (x, y) => {
    const d = y - x;
    if (d === 0) return <span className="version-stat-delta zero">±0</span>;
    return <span className={"version-stat-delta " + (d > 0 ? "add" : "del")}>{d > 0 ? "+" : ""}{d}</span>;
  };
  return (
    <div className="version-stats-panel">
      <div className="version-stat">
        <span className="version-stat-label">Wörter</span>
        <span className="version-stat-value">{b.words} {delta(a.words, b.words)}</span>
        <span className="version-stat-sub">vorher {a.words}</span>
      </div>
      <div className="version-stat">
        <span className="version-stat-label">Zeichen</span>
        <span className="version-stat-value">{b.chars} {delta(a.chars, b.chars)}</span>
        <span className="version-stat-sub">vorher {a.chars}</span>
      </div>
      <div className="version-stat">
        <span className="version-stat-label">Blöcke</span>
        <span className="version-stat-value">{b.blocks} {delta(a.blocks, b.blocks)}</span>
        <span className="version-stat-sub">vorher {a.blocks}</span>
      </div>
      <div className="version-stat">
        <span className="version-stat-label">Tags</span>
        <span className="version-stat-value">{b.tags} {delta(a.tags, b.tags)}</span>
        <span className="version-stat-sub">vorher {a.tags}</span>
      </div>
      {durationMs != null && durationMs > 0 && (
        <div className="version-stat">
          <span className="version-stat-label">Δ Zeit</span>
          <span className="version-stat-value" style={{ fontSize: 14 }}>{formatDuration(durationMs)}</span>
          <span className="version-stat-sub">zwischen Versionen</span>
        </div>
      )}
    </div>
  );
}

function VersionHistoryModal({ note, onClose, onRestore, onShowToast }) {
  const [versions, setVersions] = useStateH(() => getVersions(note?.id));
  const [selected, setSelected] = useStateH(versions[0] || null);
  const [confirmRestore, setConfirmRestore] = useStateH(null);
  const [viewMode, setViewMode] = useStateH("diff"); // "preview" | "diff"
  const [filterReason, setFilterReason] = useStateH("all"); // all | manual | auto | switch | pre-restore | pinned
  const [search, setSearch] = useStateH("");
  const [compareWith, setCompareWith] = useStateH(null); // version object — when set, diff compares selected vs compareWith

  const refresh = () => {
    const v = getVersions(note?.id);
    setVersions(v);
    if (selected && !v.find(x => x.id === selected.id)) setSelected(v[0] || null);
    else if (!selected) setSelected(v[0] || null);
  };

  useEffectH(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSnapshotNow = () => {
    const ok = recordSnapshot(note, { reason: "manual" });
    if (ok) {
      onShowToast?.("Snapshot gespeichert");
      const v = getVersions(note.id);
      setVersions(v);
      setSelected(v[0]);
    } else {
      onShowToast?.("Keine Änderungen seit letztem Snapshot");
    }
  };

  const handleDelete = (versionId) => {
    deleteVersion(note.id, versionId);
    refresh();
  };

  const handleTogglePin = (versionId) => {
    togglePinVersion(note.id, versionId);
    refresh();
  };

  const handleClearAll = () => {
    if (!window.confirm("Wirklich alle Versionen dieser Notiz löschen? (Angepinnte werden ebenfalls entfernt)")) return;
    clearAllVersions(note.id);
    setVersions([]);
    setSelected(null);
  };

  const handleRestoreConfirmed = () => {
    if (!confirmRestore) return;
    recordSnapshot(note, { reason: "pre-restore" });
    onRestore?.(confirmRestore);
    setConfirmRestore(null);
    onClose();
  };

  // Filter logic
  const q = search.trim().toLowerCase();
  const filtered = useMemoH(() => {
    return versions.filter(v => {
      if (filterReason === "pinned" && !v.pinned) return false;
      if (filterReason !== "all" && filterReason !== "pinned" && v.reason !== filterReason) return false;
      if (q) {
        const hay = (v.title + " " + (v.tags || []).join(" ") + " " + previewOfNote(v)).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [versions, filterReason, q]);

  const groups = useMemoH(() => groupByDay(filtered), [filtered]);

  // Compare-context: what we're diffing against
  const compareTarget = compareWith || note; // {ts?, title, tags, blocks, ...}
  const compareTargetLabel = compareWith ? formatVersionTime(compareWith.ts) : "Aktueller Stand";
  const isComparingCurrent = !compareWith;

  // Δ-time between selected and its previous version in the full list
  const durationMs = useMemoH(() => {
    if (!selected) return null;
    if (compareWith) return Math.abs(new Date(compareWith.ts) - new Date(selected.ts));
    const idx = versions.findIndex(v => v.id === selected.id);
    if (idx < 0 || idx === versions.length - 1) return null;
    return Math.abs(new Date(versions[idx].ts) - new Date(versions[idx + 1].ts));
  }, [selected, compareWith, versions]);

  // For the inline stats badge on each item: the version below it in the list (older one)
  const prevById = useMemoH(() => {
    const map = {};
    for (let i = 0; i < versions.length; i++) {
      map[versions[i].id] = versions[i + 1] || null;
    }
    return map;
  }, [versions]);

  const reasonChips = [
    { id: "all",         label: "Alle",     count: versions.length },
    { id: "manual",      label: "Manuell",  count: versions.filter(v => v.reason === "manual").length },
    { id: "auto",        label: "Auto",     count: versions.filter(v => v.reason === "auto").length },
    { id: "switch",      label: "Wechsel",  count: versions.filter(v => v.reason === "switch").length },
    { id: "pre-restore", label: "Wiederherst.", count: versions.filter(v => v.reason === "pre-restore").length },
    { id: "pinned",      label: "Angepinnt", count: versions.filter(v => v.pinned).length },
  ].filter(c => c.id === "all" || c.count > 0);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal version-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="version-modal-head">
          <div>
            <h3 style={{ margin: 0 }}>Versionsverlauf</h3>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 3 }}>
              {note?.title || "Ohne Titel"} · {versions.length} Version{versions.length === 1 ? "" : "en"}
              {versions.filter(v => v.pinned).length > 0 && (
                <span> · {versions.filter(v => v.pinned).length} angepinnt</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn sm" onClick={handleSnapshotNow} title="Aktuellen Stand als Snapshot speichern">
              <Icon name="plus" size={12} /> Snapshot jetzt
            </button>
            <button className="icon-btn" onClick={onClose} title="Schließen"><Icon name="x" size={14} /></button>
          </div>
        </div>

        {versions.length === 0 ? (
          <div className="version-empty">
            <Icon name="history" size={36} />
            <h4 style={{ margin: "12px 0 4px", fontWeight: 600 }}>Noch keine Versionen</h4>
            <div style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 360, textAlign: "center" }}>
              Beim Bearbeiten werden automatisch Snapshots angelegt (ca. alle 3 Min und beim Wechsel auf eine andere Notiz). Mit „Snapshot jetzt" speicherst du sofort einen.
            </div>
          </div>
        ) : (
          <div className="version-body">
            <div className="version-list">
              <div className="version-filter-bar">
                <input
                  className="version-filter-search"
                  type="text"
                  placeholder="Suchen…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: "100%" }}>
                  {reasonChips.map(c => (
                    <button
                      key={c.id}
                      className={"chip" + (filterReason === c.id ? " active" : "")}
                      onClick={() => setFilterReason(c.id)}
                    >
                      {c.label} <span className="chip-count">{c.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-subtle)", fontSize: 12 }}>
                  Keine Versionen entsprechen dem Filter.
                </div>
              ) : groups.map(g => (
                <React.Fragment key={g.key}>
                  <div className="version-day-header">
                    <span>{g.label}</span>
                    <span className="version-day-count">{g.items.length}</span>
                  </div>
                  {g.items.map(v => {
                    const idx = versions.findIndex(x => x.id === v.id);
                    const isCurrent = idx === 0;
                    const isSelected = selected?.id === v.id;
                    const isCompare = compareWith?.id === v.id;
                    const cls = "version-item"
                      + (isSelected ? " active" : "")
                      + (v.pinned ? " pinned" : "")
                      + (isCompare ? " compare-b" : "")
                      + (isSelected && compareWith ? " compare-a" : "");
                    return (
                      <div
                        key={v.id}
                        role="button"
                        tabIndex={0}
                        className={cls}
                        onClick={() => setSelected(v)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(v); } }}
                      >
                        <div className="version-item-row">
                          <span className="version-item-time">{new Date(v.ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
                          {isCurrent && <span className="version-item-badge current">Aktuell</span>}
                          {v.pinned && <span className="version-item-badge pinned" title="Angepinnt">📌</span>}
                          {v.reason === "manual" && <span className="version-item-badge manual">Manuell</span>}
                          {v.reason === "pre-restore" && <span className="version-item-badge restore">Wiederherst.</span>}
                          {isSelected && compareWith && <span className="version-item-badge compare-a">A</span>}
                          {isCompare && <span className="version-item-badge compare-b">B</span>}
                          <VersionItemStats v={v} prev={prevById[v.id]} />
                        </div>
                        <div className="version-item-meta">
                          <span>{relativeAge(v.ts)}</span>
                          <span className="dot-sep"></span>
                          <span>{(v.blocks || []).length} Blöcke</span>
                          <span className="dot-sep"></span>
                          <span>{countVersion(v).words} Wörter</span>
                        </div>
                        <div className="version-item-preview">{previewOfNote(v) || "(leer)"}</div>
                        <button
                          className="version-item-pin"
                          onClick={(e) => { e.stopPropagation(); handleTogglePin(v.id); }}
                          title={v.pinned ? "Pin entfernen" : "Anpinnen (wird nicht automatisch gelöscht)"}
                          aria-label="Anpinnen"
                        >
                          <Icon name={v.pinned ? "star-fill" : "star"} size={12} />
                        </button>
                        <button
                          className="version-item-delete"
                          onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                          title="Diese Version löschen"
                          aria-label="Löschen"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            <div className="version-detail">
              {selected ? (
                <React.Fragment>
                  <div className="version-detail-head">
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: 1 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{formatVersionTime(selected.ts)}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                          {relativeAge(selected.ts)} · {REASON_LABEL[selected.reason] || "Automatisch"}
                          {selected.pinned && " · 📌 Angepinnt"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div className="seg version-view-seg" role="tablist">
                          <button className={viewMode === "diff" ? "active" : ""} onClick={() => setViewMode("diff")}>
                            <Icon name="git-branch" size={11} /> Diff
                          </button>
                          <button className={viewMode === "preview" ? "active" : ""} onClick={() => setViewMode("preview")}>
                            <Icon name="doc" size={11} /> Vorschau
                          </button>
                        </div>
                        {!compareWith ? (
                          <button className="btn ghost sm" onClick={() => {
                            const idx = versions.findIndex(v => v.id === selected.id);
                            const next = versions[idx + 1];
                            if (next) setCompareWith(next);
                            else onShowToast?.("Keine ältere Version zum Vergleich");
                          }} title="Mit einer anderen Version vergleichen">
                            <Icon name="git-branch" size={11} /> Vergleichen
                          </button>
                        ) : (
                          <button className="btn sm" onClick={() => setCompareWith(null)}>
                            <Icon name="x" size={11} /> Vergleich beenden
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                      <button
                        className="btn accent sm"
                        onClick={() => setConfirmRestore(selected)}
                        disabled={selected.sig === noteSignature(note)}
                        title={selected.sig === noteSignature(note) ? "Identisch mit aktuellem Stand" : "Diese Version wiederherstellen"}
                      >
                        <Icon name="history" size={12} /> Wiederherstellen
                      </button>
                      <button
                        className="btn ghost sm"
                        onClick={() => handleTogglePin(selected.id)}
                        title={selected.pinned ? "Pin entfernen" : "Anpinnen"}
                      >
                        <Icon name={selected.pinned ? "star-fill" : "star"} size={11} /> {selected.pinned ? "Angepinnt" : "Anpinnen"}
                      </button>
                    </div>
                  </div>

                  {compareWith && (
                    <div style={{ padding: "10px 20px 0" }}>
                      <div className="version-compare-bar">
                        <span className="label-a">A</span>
                        <span>{formatVersionTime(selected.ts)}</span>
                        <span style={{ color: "var(--text-muted)" }}>↔</span>
                        <span className="label-b">B</span>
                        <span>{formatVersionTime(compareWith.ts)}</span>
                        <button className="swap-btn" onClick={() => { const s = selected; setSelected(compareWith); setCompareWith(s); }} title="A und B tauschen">
                          <Icon name="git-branch" size={10} /> Tauschen
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="version-detail-body">
                    {viewMode === "diff" ? (
                      <React.Fragment>
                        <VersionStatsPanel
                          from={compareWith || selected}
                          to={compareWith ? selected : note}
                          fromLabel={compareWith ? formatVersionTime(compareWith.ts) : formatVersionTime(selected.ts)}
                          toLabel={compareWith ? formatVersionTime(selected.ts) : "Aktueller Stand"}
                          durationMs={durationMs}
                        />
                        <VersionBlocksDiff
                          from={compareWith || selected}
                          to={compareWith ? selected : note}
                          fromLabel={compareWith ? "B: " + formatVersionTime(compareWith.ts) : formatVersionTime(selected.ts)}
                          toLabel={compareWith ? "A: " + formatVersionTime(selected.ts) : "Aktueller Stand"}
                        />
                      </React.Fragment>
                    ) : (
                      <VersionPreview version={selected} />
                    )}
                  </div>
                </React.Fragment>
              ) : (
                <div className="version-empty"><span>Keine Version ausgewählt</span></div>
              )}
            </div>
          </div>
        )}

        {versions.length > 0 && (
          <div className="version-modal-foot">
            <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>
              Max. {MAX_VERSIONS} Versionen pro Notiz · angepinnte bleiben dauerhaft erhalten
            </span>
            <button className="btn ghost sm danger" onClick={handleClearAll}>
              <Icon name="trash" size={12} /> Alle löschen
            </button>
          </div>
        )}

        {confirmRestore && (
          <div className="version-confirm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="version-confirm-card">
              <h4 style={{ margin: "0 0 8px", fontWeight: 600 }}>Diese Version wiederherstellen?</h4>
              <p style={{ margin: "0 0 14px", color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>
                Der aktuelle Stand wird vor dem Überschreiben als Snapshot gesichert, sodass du jederzeit zurück kannst.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn sm" onClick={() => setConfirmRestore(null)}>Abbrechen</button>
                <button className="btn accent sm" onClick={handleRestoreConfirmed}>
                  <Icon name="history" size={12} /> Wiederherstellen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  loadHistory, saveHistory, getVersions, recordSnapshot, deleteVersion,
  clearAllVersions, clearAllHistory, useAutoSnapshot, VersionHistoryModal,
  togglePinVersion, noteSignature, HISTORY_KEY,
});
