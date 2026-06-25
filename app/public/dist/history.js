const {
  useState: useStateH,
  useEffect: useEffectH,
  useRef: useRefH,
  useMemo: useMemoH
} = React;
const HISTORY_KEY = "notes-app-v1-history";
const MAX_VERSIONS = 40;
const REPLACE_WINDOW_MS = 60_000;
const AUTOSAVE_INTERVAL_MS = 3 * 60_000;
const loadHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch (e) {
    console.warn("History load failed", e);
  }
  return {};
};
const saveHistory = h => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch (e) {
    console.warn("History save failed", e);
  }
};
const noteSignature = n => {
  if (!n) return "";
  const sig = {
    title: n.title || "",
    icon: n.icon || "",
    tags: (n.tags || []).join("\n"),
    dueDate: n.dueDate || "",
    blocks: (n.blocks || []).map(b => {
      const {
        id,
        ...rest
      } = b;
      return rest;
    })
  };
  try {
    return JSON.stringify(sig);
  } catch {
    return "";
  }
};
const previewOfNote = n => {
  if (!n) return "";
  const parts = [];
  (n.blocks || []).forEach(b => {
    if (b.text) parts.push(b.text);else if (b.items) parts.push(b.items.map(i => i.text || i.name || "").join(" "));else if (b.rows) parts.push(b.rows.flat().join(" "));
  });
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 200);
};
const getVersions = noteId => {
  const h = loadHistory();
  return h[noteId] || [];
};
const trimList = list => {
  if (list.length <= MAX_VERSIONS) return list;
  const pinned = new Set(list.filter(v => v.pinned).map(v => v.id));
  const unpinned = list.filter(v => !pinned.has(v.id));
  const keepUnpinned = new Set(unpinned.slice(0, Math.max(1, MAX_VERSIONS - pinned.size)).map(v => v.id));
  return list.filter(v => pinned.has(v.id) || keepUnpinned.has(v.id));
};
const recordSnapshot = (note, {
  reason = "auto"
} = {}) => {
  if (!note || !note.id) return false;
  const sig = noteSignature(note);
  if (!sig) return false;
  const h = loadHistory();
  const list = h[note.id] || [];
  const last = list[0];
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
    blocks: JSON.parse(JSON.stringify(note.blocks || []))
  };
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
const clearAllVersions = noteId => {
  const h = loadHistory();
  delete h[noteId];
  saveHistory(h);
};
const clearAllHistory = () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
};
function useAutoSnapshot(currentNote) {
  const lastIdRef = useRefH(null);
  const lastNoteRef = useRefH(null);
  useEffectH(() => {
    lastNoteRef.current = currentNote;
  }, [currentNote]);
  useEffectH(() => {
    const prevId = lastIdRef.current;
    if (prevId && prevId !== currentNote?.id && lastNoteRef.previous) {
      recordSnapshot(lastNoteRef.previous, {
        reason: "switch"
      });
    }
    lastIdRef.current = currentNote?.id || null;
    lastNoteRef.previous = currentNote;
  }, [currentNote?.id]);
  useEffectH(() => {
    const t = setInterval(() => {
      const n = lastNoteRef.current;
      if (n) recordSnapshot(n, {
        reason: "auto"
      });
    }, AUTOSAVE_INTERVAL_MS);
    const onHide = () => {
      const n = lastNoteRef.current;
      if (n) recordSnapshot(n, {
        reason: "auto"
      });
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
function formatVersionTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  });
  if (sameDay) return `Heute, ${time}`;
  if (isYesterday) return `Gestern, ${time}`;
  const dateStr = d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
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
function countVersion(v) {
  if (!v) return {
    words: 0,
    chars: 0,
    blocks: 0,
    tags: 0
  };
  const blocks = v.blocks || [];
  let chars = 0,
    words = 0;
  const wc = s => {
    if (typeof s !== "string" || !s) return;
    chars += s.length;
    const m = s.match(/\S+/g);
    if (m) words += m.length;
  };
  blocks.forEach(b => {
    if (b.text) wc(b.text);
    if (b.items) b.items.forEach(i => {
      wc(i.text);
      wc(i.name);
      wc(i.amount);
      wc(i.unit);
    });
    if (b.rows) b.rows.forEach(r => r.forEach(c => wc(c)));
    if (b.headers) b.headers.forEach(h => wc(h));
    if (b.caption) wc(b.caption);
    if (b.nodes) b.nodes.forEach(n => wc(n.label));
    if (b.kind === "recipe-meta") {
      wc(String(b.servings || ""));
      wc(b.prepTime);
      wc(b.cookTime);
      wc(b.difficulty);
    }
  });
  wc(v.title || "");
  return {
    words,
    chars,
    blocks: blocks.length,
    tags: (v.tags || []).length
  };
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
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Gestern";
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString("de-DE", {
    weekday: "long"
  });
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric"
  });
}
function groupByDay(versions) {
  const groups = [];
  let curKey = null,
    cur = null;
  versions.forEach(v => {
    const k = dayKey(v.ts);
    if (k !== curKey) {
      curKey = k;
      cur = {
        key: k,
        label: dayLabel(v.ts),
        items: []
      };
      groups.push(cur);
    }
    cur.items.push(v);
  });
  return groups;
}
function blockSig(b) {
  if (!b) return "";
  try {
    const {
      id,
      ...rest
    } = b;
    return JSON.stringify({
      k: rest.kind,
      ...rest
    });
  } catch {
    return "";
  }
}
function MermaidPreview({
  block
}) {
  const nodes = block?.nodes || [];
  const edges = block?.edges || [];
  if (nodes.length === 0 && !block?.text) {
    return React.createElement("div", {
      className: "mermaid-diff-empty"
    }, "(leeres Diagramm)");
  }
  if (nodes.length === 0 && block?.text) {
    return React.createElement("pre", {
      style: {
        margin: 0,
        padding: "6px 8px",
        background: "var(--surface-2)",
        borderRadius: 5,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-muted)",
        whiteSpace: "pre-wrap",
        maxHeight: 120,
        overflow: "auto"
      }
    }, block.text);
  }
  return React.createElement("div", {
    className: "mermaid-preview-chips"
  }, React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      color: "var(--text-subtle)",
      textTransform: "uppercase",
      letterSpacing: "0.06em"
    }
  }, nodes.length, " Knoten \xB7 ", edges.length, " Verbindung", edges.length === 1 ? "" : "en"), nodes.slice(0, 10).map(n => React.createElement("span", {
    key: n.id,
    className: "mermaid-preview-chip"
  }, React.createElement("span", {
    className: "shape-chip shape-" + (n.shape || "round") + (n.color ? " color-" + n.color : "")
  }), n.label || "(leer)")), nodes.length > 10 && React.createElement("span", {
    className: "mermaid-preview-chip",
    style: {
      color: "var(--text-subtle)"
    }
  }, "\u2026 +", nodes.length - 10));
}
function diffMermaidBlock(fromBlock, toBlock) {
  const fromNodes = fromBlock?.nodes || [];
  const toNodes = toBlock?.nodes || [];
  const fromEdges = fromBlock?.edges || [];
  const toEdges = toBlock?.edges || [];
  const fromNodeMap = new Map(fromNodes.map(n => [n.id, n]));
  const toNodeMap = new Map(toNodes.map(n => [n.id, n]));
  const nodeChanges = [];
  toNodes.forEach(n => {
    if (!fromNodeMap.has(n.id)) nodeChanges.push({
      kind: "add",
      node: n
    });
  });
  fromNodes.forEach(n => {
    if (!toNodeMap.has(n.id)) nodeChanges.push({
      kind: "del",
      node: n
    });
  });
  fromNodes.forEach(n => {
    const o = toNodeMap.get(n.id);
    if (!o) return;
    if (n.label !== o.label || n.shape !== o.shape || n.color !== o.color) {
      nodeChanges.push({
        kind: "mod",
        from: n,
        to: o
      });
    }
  });
  const edgeKey = e => e.from + "→" + e.to;
  const fromEdgeMap = new Map(fromEdges.map(e => [edgeKey(e), e]));
  const toEdgeMap = new Map(toEdges.map(e => [edgeKey(e), e]));
  const edgeChanges = [];
  toEdges.forEach(e => {
    if (!fromEdgeMap.has(edgeKey(e))) edgeChanges.push({
      kind: "add",
      edge: e
    });
  });
  fromEdges.forEach(e => {
    if (!toEdgeMap.has(edgeKey(e))) edgeChanges.push({
      kind: "del",
      edge: e
    });
  });
  fromEdges.forEach(e => {
    const o = toEdgeMap.get(edgeKey(e));
    if (o && (e.label || "") !== (o.label || "")) {
      edgeChanges.push({
        kind: "mod",
        from: e,
        to: o
      });
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
    modifiedEdges: edgeChanges.filter(c => c.kind === "mod").length
  };
}
function MermaidDiffCard({
  from,
  to
}) {
  const d = useMemoH(() => diffMermaidBlock(from, to), [from, to]);
  const lookupNodeLabel = id => {
    const fromN = (from?.nodes || []).find(n => n.id === id);
    const toN = (to?.nodes || []).find(n => n.id === id);
    return toN?.label || fromN?.label || id;
  };
  const hasChanges = d.nodeChanges.length > 0 || d.edgeChanges.length > 0;
  return React.createElement("div", {
    className: "mermaid-diff-card"
  }, React.createElement("div", {
    className: "mermaid-diff-card-head"
  }, React.createElement(Icon, {
    name: "git-branch",
    size: 10
  }), React.createElement("span", null, "Diagramm"), React.createElement("span", {
    className: "summary"
  }, d.addedNodes + d.addedEdges > 0 && React.createElement("span", {
    className: "add"
  }, "+", d.addedNodes + d.addedEdges), d.modifiedNodes + d.modifiedEdges > 0 && React.createElement("span", {
    className: "mod"
  }, "~", d.modifiedNodes + d.modifiedEdges), d.removedNodes + d.removedEdges > 0 && React.createElement("span", {
    className: "del"
  }, "\u2212", d.removedNodes + d.removedEdges))), React.createElement("div", {
    className: "mermaid-diff-card-body"
  }, !hasChanges && React.createElement("div", {
    className: "mermaid-diff-empty"
  }, "Keine strukturellen \xC4nderungen"), d.nodeChanges.map((c, i) => {
    if (c.kind === "add") return React.createElement("div", {
      key: "n-a-" + i,
      className: "mermaid-diff-row add"
    }, React.createElement("span", {
      className: "marker"
    }, "+"), React.createElement("span", {
      className: "kind"
    }, "Knoten"), React.createElement("span", {
      className: "shape-chip shape-" + (c.node.shape || "round") + (c.node.color ? " color-" + c.node.color : "")
    }), React.createElement("span", {
      className: "label"
    }, c.node.label || "(leer)"));
    if (c.kind === "del") return React.createElement("div", {
      key: "n-d-" + i,
      className: "mermaid-diff-row del"
    }, React.createElement("span", {
      className: "marker"
    }, "\u2212"), React.createElement("span", {
      className: "kind"
    }, "Knoten"), React.createElement("span", {
      className: "shape-chip shape-" + (c.node.shape || "round") + (c.node.color ? " color-" + c.node.color : "")
    }), React.createElement("span", {
      className: "label"
    }, c.node.label || "(leer)"));
    const f = c.from,
      t = c.to;
    const labelChanged = f.label !== t.label;
    const shapeChanged = (f.shape || "round") !== (t.shape || "round");
    const colorChanged = (f.color || "") !== (t.color || "");
    return React.createElement("div", {
      key: "n-m-" + i,
      className: "mermaid-diff-row mod"
    }, React.createElement("span", {
      className: "marker"
    }, "~"), React.createElement("span", {
      className: "kind"
    }, "Knoten"), React.createElement("span", {
      className: "shape-chip shape-" + (t.shape || "round") + (t.color ? " color-" + t.color : "")
    }), React.createElement("span", {
      className: "label"
    }, labelChanged ? React.createElement(React.Fragment, null, React.createElement("span", {
      className: "word-diff-del"
    }, f.label || "(leer)"), React.createElement("span", {
      style: {
        color: "var(--text-muted)",
        padding: "0 4px"
      }
    }, "\u2192"), React.createElement("span", {
      className: "word-diff-add"
    }, t.label || "(leer)")) : React.createElement("span", null, t.label || "(leer)"), (shapeChanged || colorChanged) && React.createElement("span", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginLeft: 8
      }
    }, shapeChanged && React.createElement("span", null, "Form: ", f.shape || "round", " \u2192 ", t.shape || "round"), shapeChanged && colorChanged && React.createElement("span", null, " \xB7 "), colorChanged && React.createElement("span", null, "Farbe: ", f.color || "default", " \u2192 ", t.color || "default"))));
  }), d.edgeChanges.map((c, i) => {
    if (c.kind === "add") return React.createElement("div", {
      key: "e-a-" + i,
      className: "mermaid-diff-row add"
    }, React.createElement("span", {
      className: "marker"
    }, "+"), React.createElement("span", {
      className: "kind"
    }, "Verbindung"), React.createElement("span", {
      className: "label"
    }, lookupNodeLabel(c.edge.from), " ", React.createElement("span", {
      className: "arrow"
    }, "\u2192"), " ", lookupNodeLabel(c.edge.to), c.edge.label && React.createElement("span", {
      style: {
        color: "var(--text-muted)",
        marginLeft: 6
      }
    }, "\u201E", c.edge.label, "\"")));
    if (c.kind === "del") return React.createElement("div", {
      key: "e-d-" + i,
      className: "mermaid-diff-row del"
    }, React.createElement("span", {
      className: "marker"
    }, "\u2212"), React.createElement("span", {
      className: "kind"
    }, "Verbindung"), React.createElement("span", {
      className: "label"
    }, lookupNodeLabel(c.edge.from), " ", React.createElement("span", {
      className: "arrow"
    }, "\u2192"), " ", lookupNodeLabel(c.edge.to), c.edge.label && React.createElement("span", {
      style: {
        color: "var(--text-muted)",
        marginLeft: 6
      }
    }, "\u201E", c.edge.label, "\"")));
    return React.createElement("div", {
      key: "e-m-" + i,
      className: "mermaid-diff-row mod"
    }, React.createElement("span", {
      className: "marker"
    }, "~"), React.createElement("span", {
      className: "kind"
    }, "Beschriftung"), React.createElement("span", {
      className: "label"
    }, lookupNodeLabel(c.from.from), " ", React.createElement("span", {
      className: "arrow"
    }, "\u2192"), " ", lookupNodeLabel(c.from.to), ":", " ", React.createElement("span", {
      className: "word-diff-del"
    }, c.from.label || "(leer)"), React.createElement("span", {
      style: {
        padding: "0 4px",
        color: "var(--text-muted)"
      }
    }, "\u2192"), React.createElement("span", {
      className: "word-diff-add"
    }, c.to.label || "(leer)")));
  })));
}
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
  ingredients: "Zutaten"
};
const blockKindLabel = b => BLOCK_KIND_LABEL[b?.kind] || b?.kind || "Block";
function isBlockEmpty(b) {
  if (!b) return true;
  if (b.text && b.text.trim()) return false;
  if (b.items && b.items.length > 0 && b.items.some(i => i.text || i.name || i.amount || i.unit)) return false;
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
function matchBlocksWithModified(fromBlocks, toBlocks) {
  if (typeof Diff === "undefined") return null;
  const fromSigs = fromBlocks.map(blockSig);
  const toSigs = toBlocks.map(blockSig);
  const parts = Diff.diffArrays(fromSigs, toSigs);
  const segments = [];
  let fi = 0,
    ti = 0;
  parts.forEach(p => {
    const count = p.value.length;
    if (p.added) {
      for (let k = 0; k < count; k++) segments.push({
        kind: "add",
        to: toBlocks[ti++]
      });
    } else if (p.removed) {
      for (let k = 0; k < count; k++) segments.push({
        kind: "del",
        from: fromBlocks[fi++]
      });
    } else {
      for (let k = 0; k < count; k++) {
        segments.push({
          kind: "context",
          from: fromBlocks[fi],
          to: toBlocks[ti]
        });
        fi++;
        ti++;
      }
    }
  });
  const merged = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (s.kind !== "del") {
      merged.push(s);
      continue;
    }
    let j = i;
    const dels = [];
    while (j < segments.length && segments[j].kind === "del") {
      dels.push(segments[j]);
      j++;
    }
    const adds = [];
    while (j < segments.length && segments[j].kind === "add") {
      adds.push(segments[j]);
      j++;
    }
    const usedDel = new Set(),
      usedAdd = new Set();
    for (let di = 0; di < dels.length; di++) {
      for (let ai = 0; ai < adds.length; ai++) {
        if (usedAdd.has(ai)) continue;
        if (dels[di].from.kind === adds[ai].to.kind) {
          merged.push({
            kind: "mod",
            from: dels[di].from,
            to: adds[ai].to
          });
          usedDel.add(di);
          usedAdd.add(ai);
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
function InlineWordDiff({
  from,
  to
}) {
  if (typeof Diff === "undefined" || !from && !to) return React.createElement("span", null, to || "");
  const parts = Diff.diffWordsWithSpace(from || "", to || "");
  return React.createElement(React.Fragment, null, parts.map((p, i) => {
    if (p.added) return React.createElement("span", {
      key: i,
      className: "word-diff-add"
    }, p.value);
    if (p.removed) return React.createElement("span", {
      key: i,
      className: "word-diff-del"
    }, p.value);
    return React.createElement("span", {
      key: i
    }, p.value);
  }));
}
function ModifiedBlockView({
  from,
  to
}) {
  const sameKind = from.kind === to.kind;
  if (sameKind && from.kind === "heading") {
    return React.createElement("div", {
      className: "text-block heading",
      style: {
        pointerEvents: "none"
      }
    }, React.createElement(InlineWordDiff, {
      from: from.text,
      to: to.text
    }));
  }
  if (sameKind && from.kind === "subheading") {
    return React.createElement("div", {
      className: "text-block subheading",
      style: {
        pointerEvents: "none"
      }
    }, React.createElement(InlineWordDiff, {
      from: from.text,
      to: to.text
    }));
  }
  if (sameKind && from.kind === "text") {
    return React.createElement("div", {
      className: "text-block",
      style: {
        pointerEvents: "none",
        whiteSpace: "pre-wrap"
      }
    }, React.createElement(InlineWordDiff, {
      from: from.text,
      to: to.text
    }));
  }
  if (sameKind && from.kind === "code") {
    return React.createElement("div", {
      className: "code-block"
    }, React.createElement("div", {
      className: "code-block-header"
    }, React.createElement("span", {
      style: {
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 600
      }
    }, from.lang || "code")), React.createElement("pre", {
      style: {
        padding: "8px 10px",
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        color: "var(--text)",
        fontFamily: "var(--font-mono)",
        fontSize: 12
      }
    }, React.createElement(InlineWordDiff, {
      from: from.text,
      to: to.text
    })));
  }
  if (sameKind && from.kind === "mermaid") {
    return React.createElement(MermaidDiffCard, {
      from: from,
      to: to
    });
  }
  if (sameKind && from.kind === "checklist") {
    return React.createElement(ChecklistDiff, {
      from: from,
      to: to
    });
  }
  if (sameKind && from.kind === "recipe-meta") {
    return React.createElement(RecipeMetaDiff, {
      from: from,
      to: to
    });
  }
  if (sameKind && from.kind === "ingredients") {
    return React.createElement(IngredientsDiff, {
      from: from,
      to: to
    });
  }
  if (sameKind && from.kind === "status") {
    return React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--text-muted)"
      }
    }, "Status: ", React.createElement("span", {
      className: "word-diff-del"
    }, from.value), React.createElement("span", {
      style: {
        padding: "0 4px"
      }
    }, "\u2192"), React.createElement("span", {
      className: "word-diff-add"
    }, to.value));
  }
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, React.createElement("div", {
    style: {
      opacity: 0.65,
      textDecoration: "line-through"
    }
  }, React.createElement(ReadOnlyBlock, {
    block: from
  })), React.createElement("div", null, React.createElement(ReadOnlyBlock, {
    block: to
  })));
}
function RecipeMetaDiff({
  from,
  to
}) {
  const fields = [{
    key: "servings",
    icon: "🍽️",
    label: "Portionen"
  }, {
    key: "prepTime",
    icon: "⏱️",
    label: "Vorb."
  }, {
    key: "cookTime",
    icon: "🔥",
    label: "Kochen"
  }, {
    key: "difficulty",
    icon: "⚡",
    label: "Schwierigkeit"
  }];
  return React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      fontSize: 12
    }
  }, fields.map(f => {
    const a = String(from[f.key] ?? "");
    const b = String(to[f.key] ?? "");
    const changed = a !== b;
    return React.createElement("div", {
      key: f.key,
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 4
      }
    }, React.createElement("span", {
      style: {
        color: "var(--text-muted)"
      }
    }, f.icon, " ", f.label, ":"), changed ? React.createElement(React.Fragment, null, React.createElement("span", {
      className: "word-diff-del"
    }, a || "—"), React.createElement("span", {
      style: {
        color: "var(--text-muted)",
        padding: "0 2px"
      }
    }, "\u2192"), React.createElement("span", {
      className: "word-diff-add"
    }, b || "—")) : React.createElement("strong", {
      style: {
        color: "var(--text)"
      }
    }, b || "—"));
  }));
}
function IngredientsDiff({
  from,
  to
}) {
  const fromItems = from.items || [];
  const toItems = to.items || [];
  const normName = n => (n || "").trim().toLowerCase();
  const fromMap = new Map();
  fromItems.forEach((i, idx) => {
    if (i.name) fromMap.set(normName(i.name), {
      item: i,
      idx
    });
  });
  const seenFrom = new Set();
  const rows = [];
  toItems.forEach(t => {
    const key = normName(t.name);
    const match = fromMap.get(key);
    if (!match) {
      rows.push({
        kind: "add",
        to: t
      });
    } else {
      seenFrom.add(match.idx);
      const f = match.item;
      const amountChanged = (f.amount || "") !== (t.amount || "");
      const unitChanged = (f.unit || "") !== (t.unit || "");
      if (amountChanged || unitChanged) {
        rows.push({
          kind: "mod",
          from: f,
          to: t
        });
      } else {
        rows.push({
          kind: "same",
          to: t
        });
      }
    }
  });
  fromItems.forEach((f, idx) => {
    if (!seenFrom.has(idx) && f.name) rows.push({
      kind: "del",
      from: f
    });
  });
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      fontSize: 12.5
    }
  }, rows.map((r, i) => {
    if (r.kind === "add") return React.createElement("div", {
      key: i,
      className: "word-diff-add",
      style: {
        display: "flex",
        gap: 6,
        padding: "1px 2px"
      }
    }, React.createElement("span", {
      style: {
        minWidth: 50,
        opacity: 0.85,
        fontVariantNumeric: "tabular-nums"
      }
    }, r.to.amount, " ", r.to.unit), React.createElement("span", null, r.to.name));
    if (r.kind === "del") return React.createElement("div", {
      key: i,
      className: "word-diff-del",
      style: {
        display: "flex",
        gap: 6,
        padding: "1px 2px"
      }
    }, React.createElement("span", {
      style: {
        minWidth: 50,
        opacity: 0.85,
        fontVariantNumeric: "tabular-nums"
      }
    }, r.from.amount, " ", r.from.unit), React.createElement("span", null, r.from.name));
    if (r.kind === "mod") return React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        gap: 6,
        padding: "1px 2px",
        alignItems: "baseline"
      }
    }, React.createElement("span", {
      style: {
        minWidth: 50,
        color: "var(--text-muted)",
        fontVariantNumeric: "tabular-nums"
      }
    }, React.createElement("span", {
      className: "word-diff-del"
    }, r.from.amount, " ", r.from.unit), React.createElement("span", {
      style: {
        padding: "0 2px"
      }
    }, "\u2192"), React.createElement("span", {
      className: "word-diff-add"
    }, r.to.amount, " ", r.to.unit)), React.createElement("span", null, r.to.name));
    return React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        gap: 6,
        opacity: 0.6,
        padding: "1px 2px"
      }
    }, React.createElement("span", {
      style: {
        minWidth: 50,
        color: "var(--text-muted)",
        fontVariantNumeric: "tabular-nums"
      }
    }, r.to.amount, " ", r.to.unit), React.createElement("span", null, r.to.name));
  }));
}
function ChecklistDiff({
  from,
  to
}) {
  const fromItems = from.items || [];
  const toItems = to.items || [];
  const fromMap = new Map(fromItems.map(i => [i.text || "", i]));
  const toMap = new Map(toItems.map(i => [i.text || "", i]));
  const rows = [];
  toItems.forEach(i => {
    const o = fromMap.get(i.text || "");
    if (!o) rows.push({
      kind: "add",
      item: i
    });else if (o.done !== i.done) rows.push({
      kind: "toggle",
      from: o,
      to: i
    });else rows.push({
      kind: "same",
      item: i
    });
  });
  fromItems.forEach(i => {
    if (!toMap.has(i.text || "")) rows.push({
      kind: "del",
      item: i
    });
  });
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, rows.map((r, i) => {
    const item = r.item || r.to;
    const cls = r.kind === "add" ? "word-diff-add" : r.kind === "del" ? "word-diff-del" : "";
    const checked = (r.to || r.item || {}).done;
    return React.createElement("div", {
      key: i,
      className: "checklist-row" + (checked ? " done" : ""),
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "1px 0"
      }
    }, React.createElement("span", {
      style: {
        width: 14,
        height: 14,
        border: "1.5px solid var(--border-strong)",
        borderRadius: 3,
        background: checked ? "var(--accent)" : "transparent",
        display: "inline-block",
        flexShrink: 0,
        marginTop: 3
      }
    }), React.createElement("span", {
      className: cls,
      style: {
        flex: 1
      }
    }, item.text || "", r.kind === "toggle" && React.createElement("span", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginLeft: 8
      }
    }, "(", r.to.done ? "erledigt" : "wieder offen", ")")));
  }));
}
function VersionBlocksDiff({
  from,
  to,
  fromLabel = "Diese Version",
  toLabel = "Aktueller Stand"
}) {
  const fromBlocks = from?.blocks || [];
  const toBlocks = to?.blocks || [];
  const segments = useMemoH(() => matchBlocksWithModified(fromBlocks, toBlocks), [from, to]);
  if (segments === null) {
    return React.createElement("div", {
      className: "version-diff-loading"
    }, "Diff-Bibliothek wird geladen\u2026");
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
    return React.createElement("div", {
      className: "version-diff-empty"
    }, React.createElement(Icon, {
      name: "check",
      size: 18
    }), React.createElement("div", null, "Keine Unterschiede"), React.createElement("div", {
      className: "version-diff-empty-sub"
    }, fromLabel, " und ", toLabel, " sind identisch."));
  }
  return React.createElement("div", {
    className: "version-blocks-diff"
  }, React.createElement("div", {
    className: "version-diff-summary"
  }, added > 0 && React.createElement("span", {
    className: "version-diff-stat add"
  }, React.createElement("span", {
    className: "version-diff-stat-bar",
    style: {
      width: Math.min(60, added * 8) + "px"
    }
  }), "+", added), modified > 0 && React.createElement("span", {
    className: "version-diff-stat",
    style: {
      color: "var(--warning)"
    }
  }, React.createElement("span", {
    className: "version-diff-stat-bar",
    style: {
      width: Math.min(60, modified * 8) + "px",
      background: "var(--warning)"
    }
  }), "~", modified), removed > 0 && React.createElement("span", {
    className: "version-diff-stat del"
  }, React.createElement("span", {
    className: "version-diff-stat-bar",
    style: {
      width: Math.min(60, removed * 8) + "px"
    }
  }), "\u2212", removed), React.createElement("span", {
    className: "version-diff-legend"
  }, fromLabel, " \u2192 ", toLabel)), React.createElement("div", {
    className: "version-blocks-diff-body"
  }, titleChanged ? React.createElement("div", {
    className: "version-blocks-diff-title"
  }, React.createElement("div", {
    className: "version-blocks-diff-block mod"
  }, React.createElement("span", {
    className: "version-diff-marker"
  }, "~"), React.createElement("div", {
    className: "version-preview-title"
  }, React.createElement(InlineWordDiff, {
    from: from?.title || "",
    to: to?.title || ""
  })))) : React.createElement("div", {
    className: "version-preview-title",
    style: {
      marginBottom: 10
    }
  }, to?.title || from?.title || "Ohne Titel"), (addedTags.length > 0 || removedTags.length > 0) && React.createElement("div", {
    className: "version-blocks-diff-tags"
  }, [...toTags].filter(t => !addedTags.includes(t) && !removedTags.includes(t)).map((t, i) => React.createElement("span", {
    key: "u-" + i,
    className: "tag"
  }, "#", t)), addedTags.map((t, i) => React.createElement("span", {
    key: "a-" + i,
    className: "tag tag-added"
  }, "+ #", t)), removedTags.map((t, i) => React.createElement("span", {
    key: "r-" + i,
    className: "tag tag-removed"
  }, "\u2212 #", t))), React.createElement("div", {
    className: "version-blocks-diff-list"
  }, segments.map((s, i) => {
    const block = s.kind === "del" ? s.from : s.to;
    const empty = s.kind !== "mod" && isBlockEmpty(block);
    const cls = "version-blocks-diff-block " + s.kind + (empty ? " empty" : "");
    return React.createElement("div", {
      key: i,
      className: cls
    }, s.kind !== "context" && React.createElement("span", {
      className: "version-diff-marker"
    }, s.kind === "add" ? "+" : s.kind === "del" ? "−" : "~"), React.createElement("span", {
      className: "version-block-kind"
    }, blockKindLabel(block)), React.createElement("div", {
      className: "version-blocks-diff-block-inner"
    }, empty ? React.createElement("span", {
      style: {
        color: "var(--text-subtle)",
        fontStyle: "italic",
        fontSize: 11.5
      }
    }, "leerer ", block.kind === "mermaid" ? "Diagramm-" : block.kind === "code" ? "Code-" : block.kind === "checklist" ? "Checklisten-" : block.kind === "table" ? "Tabellen-" : block.kind === "ingredients" ? "Zutaten-" : block.kind === "recipe-meta" ? "Rezept-Info-" : block.kind === "links" ? "Link-" : block.kind === "image" ? "Bild-" : "", "Block") : s.kind === "mod" ? React.createElement(ModifiedBlockView, {
      from: s.from,
      to: s.to
    }) : React.createElement(ReadOnlyBlock, {
      block: block
    })));
  }))));
}
function versionToText(v) {
  if (!v) return "";
  if (typeof window.toMarkdown === "function") {
    return window.toMarkdown({
      title: v.title || "",
      tags: v.tags || [],
      blocks: v.blocks || []
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
function VersionDiff({
  from,
  to,
  fromLabel = "Diese Version",
  toLabel = "Aktueller Stand"
}) {
  const fromText = useMemoH(() => versionToText(from), [from]);
  const toText = useMemoH(() => versionToText(to), [to]);
  const parts = useMemoH(() => {
    if (typeof Diff === "undefined") return null;
    return Diff.diffLines(fromText || "", toText || "", {
      newlineIsToken: false
    });
  }, [fromText, toText]);
  if (parts === null) {
    return React.createElement("div", {
      className: "version-diff-loading"
    }, "Diff-Bibliothek wird geladen\u2026");
  }
  let added = 0,
    removed = 0;
  parts.forEach(p => {
    const ls = (p.value || "").split("\n");
    const n = ls.length - (p.value.endsWith("\n") ? 1 : 0);
    if (p.added) added += n;else if (p.removed) removed += n;
  });
  if (added === 0 && removed === 0) {
    return React.createElement("div", {
      className: "version-diff-empty"
    }, React.createElement(Icon, {
      name: "check",
      size: 18
    }), React.createElement("div", null, "Keine Unterschiede"), React.createElement("div", {
      className: "version-diff-empty-sub"
    }, fromLabel, " und ", toLabel, " sind identisch."));
  }
  const rows = [];
  parts.forEach(p => {
    const value = p.value || "";
    const trailingNL = value.endsWith("\n");
    const lines = value.split("\n");
    if (trailingNL) lines.pop();
    lines.forEach(line => {
      rows.push({
        type: p.added ? "add" : p.removed ? "del" : "context",
        text: line
      });
    });
  });
  const visible = rows;
  return React.createElement("div", {
    className: "version-diff"
  }, React.createElement("div", {
    className: "version-diff-summary"
  }, React.createElement("span", {
    className: "version-diff-stat add"
  }, React.createElement("span", {
    className: "version-diff-stat-bar",
    style: {
      width: Math.min(60, added * 4) + "px"
    }
  }), "+", added), React.createElement("span", {
    className: "version-diff-stat del"
  }, React.createElement("span", {
    className: "version-diff-stat-bar",
    style: {
      width: Math.min(60, removed * 4) + "px"
    }
  }), "\u2212", removed), React.createElement("span", {
    className: "version-diff-legend"
  }, fromLabel, " \u2192 ", toLabel)), React.createElement("div", {
    className: "version-diff-body",
    role: "region",
    "aria-label": "\xC4nderungen"
  }, visible.map((r, i) => {
    if (r.type === "skip") {
      return React.createElement("div", {
        key: i,
        className: "version-diff-skip"
      }, "\u22EF ", r.count, " unver\xE4nderte Zeile", r.count === 1 ? "" : "n");
    }
    const sign = r.type === "add" ? "+" : r.type === "del" ? "−" : " ";
    return React.createElement("div", {
      key: i,
      className: "version-diff-line " + r.type
    }, React.createElement("span", {
      className: "version-diff-sign",
      "aria-hidden": "true"
    }, sign), React.createElement("span", {
      className: "version-diff-text"
    }, r.text || "\u00A0"));
  })));
}
function collapseContext(rows, ctx = 3) {
  const out = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i].type !== "context") {
      out.push(rows[i]);
      i++;
      continue;
    }
    let j = i;
    while (j < rows.length && rows[j].type === "context") j++;
    const run = rows.slice(i, j);
    const isStart = i === 0;
    const isEnd = j === rows.length;
    if (run.length <= ctx * 2) {
      if ((isStart || isEnd) && run.length > ctx) {
        if (isStart) {
          out.push({
            type: "skip",
            count: run.length - ctx
          });
          out.push(...run.slice(run.length - ctx));
        } else {
          out.push(...run.slice(0, ctx));
          out.push({
            type: "skip",
            count: run.length - ctx
          });
        }
      } else {
        out.push(...run);
      }
    } else {
      const headCount = isStart ? 0 : ctx;
      const tailCount = isEnd ? 0 : ctx;
      const skipCount = run.length - headCount - tailCount;
      if (headCount) out.push(...run.slice(0, headCount));
      if (skipCount > 0) out.push({
        type: "skip",
        count: skipCount
      });
      if (tailCount) out.push(...run.slice(run.length - tailCount));
    }
    i = j;
  }
  return out;
}
function VersionPreview({
  version
}) {
  if (!version) return null;
  const blocks = version.blocks || [];
  return React.createElement("div", {
    className: "version-preview"
  }, React.createElement("div", {
    className: "version-preview-title"
  }, version.title || "Ohne Titel"), (version.tags || []).length > 0 && React.createElement("div", {
    className: "version-preview-tags"
  }, version.tags.map((t, i) => React.createElement("span", {
    key: i,
    className: "tag"
  }, "#", t))), React.createElement("div", {
    className: "version-preview-blocks"
  }, blocks.map((b, i) => React.createElement("div", {
    key: i,
    className: "version-preview-block"
  }, React.createElement(ReadOnlyBlock, {
    block: b
  }))), blocks.length === 0 && React.createElement("div", {
    className: "version-preview-empty"
  }, "(leere Notiz)")));
}
function ReadOnlyBlock({
  block
}) {
  if (block.kind === "heading") return React.createElement("div", {
    className: "text-block heading",
    style: {
      pointerEvents: "none"
    }
  }, block.text || "");
  if (block.kind === "subheading") return React.createElement("div", {
    className: "text-block subheading",
    style: {
      pointerEvents: "none"
    }
  }, block.text || "");
  if (block.kind === "text") return React.createElement("div", {
    className: "text-block",
    style: {
      pointerEvents: "none",
      whiteSpace: "pre-wrap"
    }
  }, block.text || "");
  if (block.kind === "checklist") return React.createElement("div", null, (block.items || []).map((i, k) => React.createElement("div", {
    key: k,
    className: "checklist-row" + (i.done ? " done" : "")
  }, React.createElement("span", {
    style: {
      width: 16,
      height: 16,
      border: "1.5px solid var(--border-strong)",
      borderRadius: 4,
      background: i.done ? "var(--accent)" : "transparent",
      display: "inline-block",
      flexShrink: 0,
      marginTop: 4
    }
  }), React.createElement("span", {
    className: "text-block",
    style: {
      flex: 1
    }
  }, i.text || ""))));
  if (block.kind === "code") return React.createElement("div", {
    className: "code-block"
  }, React.createElement("div", {
    className: "code-block-header"
  }, React.createElement("span", {
    style: {
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      fontWeight: 600
    }
  }, block.lang || "code")), React.createElement("pre", {
    style: {
      padding: "10px 12px",
      margin: 0,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      color: "var(--text)",
      fontFamily: "var(--font-mono)",
      fontSize: 12
    }
  }, block.text || ""));
  if (block.kind === "mermaid") {
    if (block.nodes && block.nodes.length > 0 || block.edges && block.edges.length > 0) {
      return React.createElement(MermaidPreview, {
        block: block
      });
    }
    if (!block.text) {
      return React.createElement("div", {
        className: "mermaid-diff-empty"
      }, "(leeres Diagramm)");
    }
    return React.createElement("pre", {
      style: {
        margin: 0,
        padding: "8px 10px",
        background: "var(--surface-2)",
        borderRadius: 5,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        color: "var(--text-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        maxHeight: 140,
        overflow: "auto"
      }
    }, block.text);
  }
  if (block.kind === "table") return React.createElement("div", {
    className: "table-block"
  }, React.createElement("table", null, React.createElement("thead", null, React.createElement("tr", null, (block.headers || []).map((h, k) => React.createElement("th", {
    key: k,
    style: {
      padding: "6px 10px",
      textAlign: "left",
      fontSize: 11,
      fontWeight: 600,
      color: "var(--text-muted)",
      textTransform: "uppercase"
    }
  }, h)))), React.createElement("tbody", null, (block.rows || []).map((r, k) => React.createElement("tr", {
    key: k
  }, r.map((c, j) => React.createElement("td", {
    key: j,
    style: {
      padding: "6px 10px",
      fontSize: 12
    }
  }, c)))))));
  if (block.kind === "image" && block.src) return React.createElement("img", {
    src: block.src,
    alt: block.caption || "",
    style: {
      maxWidth: "100%",
      borderRadius: 6
    }
  });
  if (block.kind === "status") return React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)"
    }
  }, "Status: ", block.value);
  if (block.kind === "links") return React.createElement("div", null, (block.items || []).map((l, k) => React.createElement("div", {
    key: k,
    style: {
      fontSize: 12
    }
  }, "\u2192 ", l.label || l.url)));
  if (block.kind === "recipe-meta") return React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      fontSize: 12,
      color: "var(--text-muted)"
    }
  }, block.servings != null && React.createElement("span", null, "\uD83C\uDF7D\uFE0F ", React.createElement("strong", {
    style: {
      color: "var(--text)"
    }
  }, block.servings), " Portionen"), block.prepTime && React.createElement("span", null, "\u23F1\uFE0F Vorb.: ", React.createElement("strong", {
    style: {
      color: "var(--text)"
    }
  }, block.prepTime)), block.cookTime && React.createElement("span", null, "\uD83D\uDD25 Kochen: ", React.createElement("strong", {
    style: {
      color: "var(--text)"
    }
  }, block.cookTime)), block.difficulty && React.createElement("span", null, "\u26A1 ", React.createElement("strong", {
    style: {
      color: "var(--text)"
    }
  }, block.difficulty)));
  if (block.kind === "ingredients") return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      fontSize: 12.5
    }
  }, (block.items || []).map((it, k) => React.createElement("div", {
    key: k,
    style: {
      display: "flex",
      gap: 6,
      alignItems: "baseline"
    }
  }, React.createElement("span", {
    style: {
      minWidth: 50,
      color: "var(--text-muted)",
      fontVariantNumeric: "tabular-nums"
    }
  }, it.amount || "", " ", it.unit || ""), React.createElement("span", null, it.name || ""))));
  if (block.kind === "noteref") return React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--info)"
    }
  }, "\u2192 ", block.label || "(verknüpfte Notiz)");
  return null;
}
const REASON_LABEL = {
  manual: "Manuell",
  auto: "Auto",
  switch: "Wechsel",
  "pre-restore": "Vor Wiederherst."
};
function VersionItemStats({
  v,
  prev
}) {
  if (!prev) {
    const c = countVersion(v);
    return React.createElement("span", {
      className: "version-item-stats"
    }, React.createElement("span", {
      className: "none"
    }, c.words, " W"));
  }
  const a = countVersion(prev);
  const b = countVersion(v);
  const dw = b.words - a.words;
  const dc = b.chars - a.chars;
  if (dw === 0 && dc === 0) {
    return React.createElement("span", {
      className: "version-item-stats"
    }, React.createElement("span", {
      className: "none"
    }, "\xB10"));
  }
  return React.createElement("span", {
    className: "version-item-stats",
    title: (dc >= 0 ? "+" : "") + dc + " Zeichen, " + (dw >= 0 ? "+" : "") + dw + " Wörter"
  }, dw > 0 && React.createElement("span", {
    className: "add"
  }, "+", dw), dw < 0 && React.createElement("span", {
    className: "del"
  }, dw), dw !== 0 && React.createElement("span", {
    style: {
      color: "var(--text-subtle)",
      fontWeight: 500
    }
  }, "W"));
}
function VersionStatsPanel({
  from,
  to,
  fromLabel,
  toLabel,
  durationMs
}) {
  const a = countVersion(from);
  const b = countVersion(to);
  const delta = (x, y) => {
    const d = y - x;
    if (d === 0) return React.createElement("span", {
      className: "version-stat-delta zero"
    }, "\xB10");
    return React.createElement("span", {
      className: "version-stat-delta " + (d > 0 ? "add" : "del")
    }, d > 0 ? "+" : "", d);
  };
  return React.createElement("div", {
    className: "version-stats-panel"
  }, React.createElement("div", {
    className: "version-stat"
  }, React.createElement("span", {
    className: "version-stat-label"
  }, "W\xF6rter"), React.createElement("span", {
    className: "version-stat-value"
  }, b.words, " ", delta(a.words, b.words)), React.createElement("span", {
    className: "version-stat-sub"
  }, "vorher ", a.words)), React.createElement("div", {
    className: "version-stat"
  }, React.createElement("span", {
    className: "version-stat-label"
  }, "Zeichen"), React.createElement("span", {
    className: "version-stat-value"
  }, b.chars, " ", delta(a.chars, b.chars)), React.createElement("span", {
    className: "version-stat-sub"
  }, "vorher ", a.chars)), React.createElement("div", {
    className: "version-stat"
  }, React.createElement("span", {
    className: "version-stat-label"
  }, "Bl\xF6cke"), React.createElement("span", {
    className: "version-stat-value"
  }, b.blocks, " ", delta(a.blocks, b.blocks)), React.createElement("span", {
    className: "version-stat-sub"
  }, "vorher ", a.blocks)), React.createElement("div", {
    className: "version-stat"
  }, React.createElement("span", {
    className: "version-stat-label"
  }, "Tags"), React.createElement("span", {
    className: "version-stat-value"
  }, b.tags, " ", delta(a.tags, b.tags)), React.createElement("span", {
    className: "version-stat-sub"
  }, "vorher ", a.tags)), durationMs != null && durationMs > 0 && React.createElement("div", {
    className: "version-stat"
  }, React.createElement("span", {
    className: "version-stat-label"
  }, "\u0394 Zeit"), React.createElement("span", {
    className: "version-stat-value",
    style: {
      fontSize: 14
    }
  }, formatDuration(durationMs)), React.createElement("span", {
    className: "version-stat-sub"
  }, "zwischen Versionen")));
}
function VersionHistoryModal({
  note,
  onClose,
  onRestore,
  onShowToast
}) {
  const [versions, setVersions] = useStateH(() => getVersions(note?.id));
  const [selected, setSelected] = useStateH(versions[0] || null);
  const [confirmRestore, setConfirmRestore] = useStateH(null);
  const [viewMode, setViewMode] = useStateH("diff");
  const [filterReason, setFilterReason] = useStateH("all");
  const [search, setSearch] = useStateH("");
  const [compareWith, setCompareWith] = useStateH(null);
  const refresh = () => {
    const v = getVersions(note?.id);
    setVersions(v);
    if (selected && !v.find(x => x.id === selected.id)) setSelected(v[0] || null);else if (!selected) setSelected(v[0] || null);
  };
  useEffectH(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const handleSnapshotNow = () => {
    const ok = recordSnapshot(note, {
      reason: "manual"
    });
    if (ok) {
      onShowToast?.("Snapshot gespeichert");
      const v = getVersions(note.id);
      setVersions(v);
      setSelected(v[0]);
    } else {
      onShowToast?.("Keine Änderungen seit letztem Snapshot");
    }
  };
  const handleDelete = versionId => {
    deleteVersion(note.id, versionId);
    refresh();
  };
  const handleTogglePin = versionId => {
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
    recordSnapshot(note, {
      reason: "pre-restore"
    });
    onRestore?.(confirmRestore);
    setConfirmRestore(null);
    onClose();
  };
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
  const compareTarget = compareWith || note;
  const compareTargetLabel = compareWith ? formatVersionTime(compareWith.ts) : "Aktueller Stand";
  const isComparingCurrent = !compareWith;
  const durationMs = useMemoH(() => {
    if (!selected) return null;
    if (compareWith) return Math.abs(new Date(compareWith.ts) - new Date(selected.ts));
    const idx = versions.findIndex(v => v.id === selected.id);
    if (idx < 0 || idx === versions.length - 1) return null;
    return Math.abs(new Date(versions[idx].ts) - new Date(versions[idx + 1].ts));
  }, [selected, compareWith, versions]);
  const prevById = useMemoH(() => {
    const map = {};
    for (let i = 0; i < versions.length; i++) {
      map[versions[i].id] = versions[i + 1] || null;
    }
    return map;
  }, [versions]);
  const reasonChips = [{
    id: "all",
    label: "Alle",
    count: versions.length
  }, {
    id: "manual",
    label: "Manuell",
    count: versions.filter(v => v.reason === "manual").length
  }, {
    id: "auto",
    label: "Auto",
    count: versions.filter(v => v.reason === "auto").length
  }, {
    id: "switch",
    label: "Wechsel",
    count: versions.filter(v => v.reason === "switch").length
  }, {
    id: "pre-restore",
    label: "Wiederherst.",
    count: versions.filter(v => v.reason === "pre-restore").length
  }, {
    id: "pinned",
    label: "Angepinnt",
    count: versions.filter(v => v.pinned).length
  }].filter(c => c.id === "all" || c.count > 0);
  return React.createElement("div", {
    className: "modal-backdrop",
    onMouseDown: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, React.createElement("div", {
    className: "modal version-modal",
    onMouseDown: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "version-modal-head"
  }, React.createElement("div", null, React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "Versionsverlauf"), React.createElement("div", {
    style: {
      color: "var(--text-muted)",
      fontSize: 13,
      marginTop: 3
    }
  }, note?.title || "Ohne Titel", " \xB7 ", versions.length, " Version", versions.length === 1 ? "" : "en", versions.filter(v => v.pinned).length > 0 && React.createElement("span", null, " \xB7 ", versions.filter(v => v.pinned).length, " angepinnt"))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, React.createElement("button", {
    className: "btn sm",
    onClick: handleSnapshotNow,
    title: "Aktuellen Stand als Snapshot speichern"
  }, React.createElement(Icon, {
    name: "plus",
    size: 12
  }), " Snapshot jetzt"), React.createElement("button", {
    className: "icon-btn",
    onClick: onClose,
    title: "Schlie\xDFen"
  }, React.createElement(Icon, {
    name: "x",
    size: 14
  })))), versions.length === 0 ? React.createElement("div", {
    className: "version-empty"
  }, React.createElement(Icon, {
    name: "history",
    size: 36
  }), React.createElement("h4", {
    style: {
      margin: "12px 0 4px",
      fontWeight: 600
    }
  }, "Noch keine Versionen"), React.createElement("div", {
    style: {
      color: "var(--text-muted)",
      fontSize: 13,
      maxWidth: 360,
      textAlign: "center"
    }
  }, "Beim Bearbeiten werden automatisch Snapshots angelegt (ca. alle 3 Min und beim Wechsel auf eine andere Notiz). Mit \u201ESnapshot jetzt\" speicherst du sofort einen.")) : React.createElement("div", {
    className: "version-body"
  }, React.createElement("div", {
    className: "version-list"
  }, React.createElement("div", {
    className: "version-filter-bar"
  }, React.createElement("input", {
    className: "version-filter-search",
    type: "text",
    placeholder: "Suchen\u2026",
    value: search,
    onChange: e => setSearch(e.target.value)
  }), React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      flexWrap: "wrap",
      width: "100%"
    }
  }, reasonChips.map(c => React.createElement("button", {
    key: c.id,
    className: "chip" + (filterReason === c.id ? " active" : ""),
    onClick: () => setFilterReason(c.id)
  }, c.label, " ", React.createElement("span", {
    className: "chip-count"
  }, c.count))))), filtered.length === 0 ? React.createElement("div", {
    style: {
      padding: 24,
      textAlign: "center",
      color: "var(--text-subtle)",
      fontSize: 12
    }
  }, "Keine Versionen entsprechen dem Filter.") : groups.map(g => React.createElement(React.Fragment, {
    key: g.key
  }, React.createElement("div", {
    className: "version-day-header"
  }, React.createElement("span", null, g.label), React.createElement("span", {
    className: "version-day-count"
  }, g.items.length)), g.items.map(v => {
    const idx = versions.findIndex(x => x.id === v.id);
    const isCurrent = idx === 0;
    const isSelected = selected?.id === v.id;
    const isCompare = compareWith?.id === v.id;
    const cls = "version-item" + (isSelected ? " active" : "") + (v.pinned ? " pinned" : "") + (isCompare ? " compare-b" : "") + (isSelected && compareWith ? " compare-a" : "");
    return React.createElement("div", {
      key: v.id,
      role: "button",
      tabIndex: 0,
      className: cls,
      onClick: () => setSelected(v),
      onKeyDown: e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSelected(v);
        }
      }
    }, React.createElement("div", {
      className: "version-item-row"
    }, React.createElement("span", {
      className: "version-item-time"
    }, new Date(v.ts).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    })), isCurrent && React.createElement("span", {
      className: "version-item-badge current"
    }, "Aktuell"), v.pinned && React.createElement("span", {
      className: "version-item-badge pinned",
      title: "Angepinnt"
    }, "\uD83D\uDCCC"), v.reason === "manual" && React.createElement("span", {
      className: "version-item-badge manual"
    }, "Manuell"), v.reason === "pre-restore" && React.createElement("span", {
      className: "version-item-badge restore"
    }, "Wiederherst."), isSelected && compareWith && React.createElement("span", {
      className: "version-item-badge compare-a"
    }, "A"), isCompare && React.createElement("span", {
      className: "version-item-badge compare-b"
    }, "B"), React.createElement(VersionItemStats, {
      v: v,
      prev: prevById[v.id]
    })), React.createElement("div", {
      className: "version-item-meta"
    }, React.createElement("span", null, relativeAge(v.ts)), React.createElement("span", {
      className: "dot-sep"
    }), React.createElement("span", null, (v.blocks || []).length, " Bl\xF6cke"), React.createElement("span", {
      className: "dot-sep"
    }), React.createElement("span", null, countVersion(v).words, " W\xF6rter")), React.createElement("div", {
      className: "version-item-preview"
    }, previewOfNote(v) || "(leer)"), React.createElement("button", {
      className: "version-item-pin",
      onClick: e => {
        e.stopPropagation();
        handleTogglePin(v.id);
      },
      title: v.pinned ? "Pin entfernen" : "Anpinnen (wird nicht automatisch gelöscht)",
      "aria-label": "Anpinnen"
    }, React.createElement(Icon, {
      name: v.pinned ? "star-fill" : "star",
      size: 12
    })), React.createElement("button", {
      className: "version-item-delete",
      onClick: e => {
        e.stopPropagation();
        handleDelete(v.id);
      },
      title: "Diese Version l\xF6schen",
      "aria-label": "L\xF6schen"
    }, React.createElement(Icon, {
      name: "trash",
      size: 12
    })));
  })))), React.createElement("div", {
    className: "version-detail"
  }, selected ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "version-detail-head"
  }, React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 14
    }
  }, formatVersionTime(selected.ts)), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      marginTop: 2
    }
  }, relativeAge(selected.ts), " \xB7 ", REASON_LABEL[selected.reason] || "Automatisch", selected.pinned && " · 📌 Angepinnt")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, React.createElement("div", {
    className: "seg version-view-seg",
    role: "tablist"
  }, React.createElement("button", {
    className: viewMode === "diff" ? "active" : "",
    onClick: () => setViewMode("diff")
  }, React.createElement(Icon, {
    name: "git-branch",
    size: 11
  }), " Diff"), React.createElement("button", {
    className: viewMode === "preview" ? "active" : "",
    onClick: () => setViewMode("preview")
  }, React.createElement(Icon, {
    name: "doc",
    size: 11
  }), " Vorschau")), !compareWith ? React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => {
      const idx = versions.findIndex(v => v.id === selected.id);
      const next = versions[idx + 1];
      if (next) setCompareWith(next);else onShowToast?.("Keine ältere Version zum Vergleich");
    },
    title: "Mit einer anderen Version vergleichen"
  }, React.createElement(Icon, {
    name: "git-branch",
    size: 11
  }), " Vergleichen") : React.createElement("button", {
    className: "btn sm",
    onClick: () => setCompareWith(null)
  }, React.createElement(Icon, {
    name: "x",
    size: 11
  }), " Vergleich beenden"))), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      alignItems: "flex-end"
    }
  }, React.createElement("button", {
    className: "btn accent sm",
    onClick: () => setConfirmRestore(selected),
    disabled: selected.sig === noteSignature(note),
    title: selected.sig === noteSignature(note) ? "Identisch mit aktuellem Stand" : "Diese Version wiederherstellen"
  }, React.createElement(Icon, {
    name: "history",
    size: 12
  }), " Wiederherstellen"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => handleTogglePin(selected.id),
    title: selected.pinned ? "Pin entfernen" : "Anpinnen"
  }, React.createElement(Icon, {
    name: selected.pinned ? "star-fill" : "star",
    size: 11
  }), " ", selected.pinned ? "Angepinnt" : "Anpinnen"))), compareWith && React.createElement("div", {
    style: {
      padding: "10px 20px 0"
    }
  }, React.createElement("div", {
    className: "version-compare-bar"
  }, React.createElement("span", {
    className: "label-a"
  }, "A"), React.createElement("span", null, formatVersionTime(selected.ts)), React.createElement("span", {
    style: {
      color: "var(--text-muted)"
    }
  }, "\u2194"), React.createElement("span", {
    className: "label-b"
  }, "B"), React.createElement("span", null, formatVersionTime(compareWith.ts)), React.createElement("button", {
    className: "swap-btn",
    onClick: () => {
      const s = selected;
      setSelected(compareWith);
      setCompareWith(s);
    },
    title: "A und B tauschen"
  }, React.createElement(Icon, {
    name: "git-branch",
    size: 10
  }), " Tauschen"))), React.createElement("div", {
    className: "version-detail-body"
  }, viewMode === "diff" ? React.createElement(React.Fragment, null, React.createElement(VersionStatsPanel, {
    from: compareWith || selected,
    to: compareWith ? selected : note,
    fromLabel: compareWith ? formatVersionTime(compareWith.ts) : formatVersionTime(selected.ts),
    toLabel: compareWith ? formatVersionTime(selected.ts) : "Aktueller Stand",
    durationMs: durationMs
  }), React.createElement(VersionBlocksDiff, {
    from: compareWith || selected,
    to: compareWith ? selected : note,
    fromLabel: compareWith ? "B: " + formatVersionTime(compareWith.ts) : formatVersionTime(selected.ts),
    toLabel: compareWith ? "A: " + formatVersionTime(selected.ts) : "Aktueller Stand"
  })) : React.createElement(VersionPreview, {
    version: selected
  }))) : React.createElement("div", {
    className: "version-empty"
  }, React.createElement("span", null, "Keine Version ausgew\xE4hlt")))), versions.length > 0 && React.createElement("div", {
    className: "version-modal-foot"
  }, React.createElement("span", {
    style: {
      fontSize: 11,
      color: "var(--text-subtle)"
    }
  }, "Max. ", MAX_VERSIONS, " Versionen pro Notiz \xB7 angepinnte bleiben dauerhaft erhalten"), React.createElement("button", {
    className: "btn ghost sm danger",
    onClick: handleClearAll
  }, React.createElement(Icon, {
    name: "trash",
    size: 12
  }), " Alle l\xF6schen")), confirmRestore && React.createElement("div", {
    className: "version-confirm",
    onMouseDown: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "version-confirm-card"
  }, React.createElement("h4", {
    style: {
      margin: "0 0 8px",
      fontWeight: 600
    }
  }, "Diese Version wiederherstellen?"), React.createElement("p", {
    style: {
      margin: "0 0 14px",
      color: "var(--text-muted)",
      fontSize: 13,
      lineHeight: 1.5
    }
  }, "Der aktuelle Stand wird vor dem \xDCberschreiben als Snapshot gesichert, sodass du jederzeit zur\xFCck kannst."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end"
    }
  }, React.createElement("button", {
    className: "btn sm",
    onClick: () => setConfirmRestore(null)
  }, "Abbrechen"), React.createElement("button", {
    className: "btn accent sm",
    onClick: handleRestoreConfirmed
  }, React.createElement(Icon, {
    name: "history",
    size: 12
  }), " Wiederherstellen"))))));
}
Object.assign(window, {
  loadHistory,
  saveHistory,
  getVersions,
  recordSnapshot,
  deleteVersion,
  clearAllVersions,
  clearAllHistory,
  useAutoSnapshot,
  VersionHistoryModal,
  togglePinVersion,
  noteSignature,
  HISTORY_KEY
});