(function () {
  const {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback
  } = React;
  function normalize(text) {
    return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function tokenize(text) {
    return normalize(text).split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 2);
  }
  const STOPWORDS = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines", "und", "oder", "aber", "auch", "ist", "sind", "war", "waren", "wird", "werden", "wurde", "worden", "im", "in", "an", "am", "auf", "aus", "bei", "bis", "durch", "fuer", "für", "gegen", "nach", "von", "vom", "zu", "zum", "zur", "ueber", "über", "unter", "mit", "ohne", "als", "wie", "wenn", "weil", "dass", "daß", "the", "a", "an", "of", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being", "in", "on", "at", "to", "from", "by", "with", "without", "for", "as", "than", "that", "this", "these"]);
  function extractFields(note) {
    const title = note.title || "";
    const tags = (note.tags || []).join(" ");
    const bodyParts = [];
    if (Array.isArray(note.blocks)) {
      for (const b of note.blocks) {
        if (!b) continue;
        switch (b.type) {
          case "text":
          case "heading":
          case "subheading":
          case "quote":
            if (b.text) bodyParts.push(b.text);
            break;
          case "code":
          case "terminal":
            if (b.code) bodyParts.push(b.code);
            break;
          case "list":
          case "todo":
          case "checklist":
            if (Array.isArray(b.items)) {
              for (const it of b.items) bodyParts.push(typeof it === "string" ? it : it?.text || "");
            }
            break;
          case "table":
            if (Array.isArray(b.rows)) {
              for (const row of b.rows) {
                for (const cell of row) bodyParts.push(typeof cell === "string" ? cell : String(cell || ""));
              }
            }
            break;
          case "file":
            if (b.name) bodyParts.push(b.name);
            if (b.caption) bodyParts.push(b.caption);
            break;
          case "image":
            if (b.caption) bodyParts.push(b.caption);
            if (b.alt) bodyParts.push(b.alt);
            break;
          case "callout":
          case "status":
            if (b.text) bodyParts.push(b.text);
            if (b.title) bodyParts.push(b.title);
            break;
          case "diagram":
            if (b.title) bodyParts.push(b.title);
            if (Array.isArray(b.nodes)) for (const n of b.nodes) bodyParts.push(n.label || "");
            break;
          default:
            for (const k of ["text", "title", "label", "content", "value", "caption"]) {
              if (typeof b[k] === "string") bodyParts.push(b[k]);
            }
        }
      }
    }
    if (note.type === "it" && note.it) {
      for (const k of ["host", "ip", "os", "role", "description", "credentials", "notes"]) {
        if (typeof note.it[k] === "string") bodyParts.push(note.it[k]);
      }
    }
    return {
      title,
      tags,
      body: bodyParts.join("\n")
    };
  }
  function buildIndex(notes, folders) {
    const df = new Map();
    const postings = new Map();
    const fieldsByNote = new Map();
    const noteById = new Map();
    const folderById = new Map();
    let totalLen = 0;
    for (const f of folders || []) folderById.set(f.id, f.name);
    for (const note of notes) {
      const fields = extractFields(note);
      fieldsByNote.set(note.id, fields);
      noteById.set(note.id, note);
      const counts = new Map();
      const addTokens = (text, field, boost = 1) => {
        const toks = tokenize(text);
        for (const t of toks) {
          if (STOPWORDS.has(t)) continue;
          const ex = counts.get(t) || {
            tf: 0,
            fields: new Set()
          };
          ex.tf += boost;
          ex.fields.add(field);
          counts.set(t, ex);
        }
        return toks.length;
      };
      const lenTitle = addTokens(fields.title, "title", 3);
      const lenTags = addTokens(fields.tags, "tags", 4);
      const lenBody = addTokens(fields.body, "body", 1);
      const docLen = lenTitle + lenTags + lenBody;
      totalLen += docLen;
      for (const [term, info] of counts) {
        df.set(term, (df.get(term) || 0) + 1);
        if (!postings.has(term)) postings.set(term, []);
        postings.get(term).push({
          noteId: note.id,
          tf: info.tf,
          fields: info.fields,
          len: docLen
        });
      }
    }
    return {
      df,
      postings,
      totalDocs: notes.length,
      avgLen: notes.length ? totalLen / notes.length : 0,
      fieldsByNote,
      noteById,
      folderById
    };
  }
  function rebuildIndex(notes, folders) {
    window.__searchIndex = buildIndex(notes, folders);
  }
  const BM25_K1 = 1.4;
  const BM25_B = 0.75;
  function scoreDoc(query, index) {
    const queryTerms = tokenize(query).filter(t => !STOPWORDS.has(t));
    if (queryTerms.length === 0) return [];
    const scores = new Map();
    for (const term of queryTerms) {
      const candidates = [];
      for (const [t, plist] of index.postings) {
        if (t === term || t.startsWith(term) || term.startsWith(t)) {
          const exact = t === term ? 1 : 0.6;
          for (const p of plist) candidates.push({
            ...p,
            exact
          });
        }
      }
      if (candidates.length === 0) continue;
      const docFreq = new Set(candidates.map(c => c.noteId)).size;
      const idf = Math.log(1 + (index.totalDocs - docFreq + 0.5) / (docFreq + 0.5));
      for (const c of candidates) {
        const norm = 1 - BM25_B + BM25_B * (c.len / (index.avgLen || 1));
        const tfScore = c.tf * (BM25_K1 + 1) / (c.tf + BM25_K1 * norm);
        const contribution = idf * tfScore * c.exact;
        const ex = scores.get(c.noteId) || {
          score: 0,
          hitFields: new Set()
        };
        ex.score += contribution;
        for (const f of c.fields) ex.hitFields.add(f);
        scores.set(c.noteId, ex);
      }
    }
    const arr = [...scores.entries()].map(([noteId, info]) => ({
      noteId,
      ...info
    }));
    arr.sort((a, b) => b.score - a.score);
    const maxScore = arr[0]?.score || 1;
    for (const r of arr) r.score = r.score / maxScore;
    return arr;
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;"
    })[c]);
  }
  function makeSnippet(field, query, maxLen = 160) {
    if (!field) return null;
    const queryTerms = tokenize(query).filter(t => !STOPWORDS.has(t));
    if (queryTerms.length === 0) return null;
    const norm = normalize(field);
    let firstHit = -1;
    let hitTerm = null;
    for (const t of queryTerms) {
      const idx = norm.indexOf(t);
      if (idx >= 0 && (firstHit === -1 || idx < firstHit)) {
        firstHit = idx;
        hitTerm = t;
      }
    }
    if (firstHit === -1) return null;
    const before = Math.max(0, firstHit - 40);
    const end = Math.min(field.length, firstHit + maxLen);
    let slice = field.slice(before, end);
    if (before > 0) slice = "…" + slice;
    if (end < field.length) slice = slice + "…";
    const sliceNorm = normalize(slice);
    const matches = [];
    for (const t of queryTerms) {
      let from = 0;
      while (true) {
        const idx = sliceNorm.indexOf(t, from);
        if (idx === -1) break;
        matches.push([idx, idx + t.length]);
        from = idx + t.length;
      }
    }
    matches.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const m of matches) {
      const last = merged[merged.length - 1];
      if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);else merged.push([...m]);
    }
    let html = "";
    let cursor = 0;
    for (const [s, e] of merged) {
      html += escapeHtml(slice.slice(cursor, s));
      html += '<mark>' + escapeHtml(slice.slice(s, e)) + '</mark>';
      cursor = e;
    }
    html += escapeHtml(slice.slice(cursor));
    return html;
  }
  async function runSearch(query, opts = {}) {
    const index = window.__searchIndex;
    if (!index) return [];
    const q = query?.trim();
    if (!q) return [];
    const scored = scoreDoc(q, index);
    const limit = opts.limit ?? 30;
    const results = [];
    for (const r of scored.slice(0, limit)) {
      const note = index.noteById.get(r.noteId);
      if (!note) continue;
      const fields = index.fieldsByNote.get(r.noteId);
      const snippets = [];
      const tSnip = makeSnippet(fields.title, q);
      if (tSnip) snippets.push({
        field: "title",
        html: tSnip
      });
      const tagSnip = r.hitFields.has("tags") ? makeSnippet(fields.tags, q) : null;
      if (tagSnip) snippets.push({
        field: "tags",
        html: tagSnip
      });
      const bSnip = makeSnippet(fields.body, q);
      if (bSnip) snippets.push({
        field: "body",
        html: bSnip
      });
      results.push({
        noteId: r.noteId,
        title: note.title || "(unbenannt)",
        folder: index.folderById.get(note.folderId) || "",
        score: r.score,
        snippets
      });
    }
    return results;
  }
  function SearchModal({
    onClose,
    onSelect,
    initialQuery = ""
  }) {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(0);
    const inputRef = useRef(null);
    const resultsRef = useRef(null);
    useEffect(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, []);
    useEffect(() => {
      let cancelled = false;
      if (!query.trim()) {
        setResults([]);
        setActive(0);
        return;
      }
      setLoading(true);
      const t = setTimeout(async () => {
        try {
          const r = await runSearch(query);
          if (!cancelled) {
            setResults(r);
            setActive(0);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }, 100);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [query]);
    useEffect(() => {
      const onKey = e => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive(a => Math.min(results.length - 1, a + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive(a => Math.max(0, a - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const r = results[active];
          if (r) {
            onSelect(r.noteId);
            onClose();
          }
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [results, active, onClose, onSelect]);
    useEffect(() => {
      if (!resultsRef.current) return;
      const el = resultsRef.current.querySelector(`[data-idx="${active}"]`);
      if (el) el.scrollIntoView({
        block: "nearest"
      });
    }, [active]);
    return React.createElement("div", {
      className: "search-backdrop",
      onClick: onClose
    }, React.createElement("div", {
      className: "search-modal",
      onClick: e => e.stopPropagation()
    }, React.createElement("div", {
      className: "search-input-row"
    }, React.createElement("span", {
      className: "search-input-icon"
    }, React.createElement(Icon, {
      name: "search",
      size: 16
    })), React.createElement("input", {
      ref: inputRef,
      type: "text",
      className: "search-input",
      placeholder: "In allen Notizen suchen\u2026",
      value: query,
      onChange: e => setQuery(e.target.value)
    }), query && React.createElement("button", {
      className: "search-clear",
      onClick: () => {
        setQuery("");
        inputRef.current?.focus();
      },
      title: "Leeren"
    }, React.createElement(Icon, {
      name: "x",
      size: 14
    })), React.createElement("span", {
      className: "search-hint"
    }, "ESC")), React.createElement("div", {
      ref: resultsRef,
      className: "search-results"
    }, loading && query && results.length === 0 && React.createElement("div", {
      className: "search-empty"
    }, "Suche\u2026"), !loading && query && results.length === 0 && React.createElement("div", {
      className: "search-empty"
    }, "Keine Treffer f\xFCr \u201E", query, "\""), !query && React.createElement("div", {
      className: "search-empty search-hints"
    }, React.createElement("div", null, "Tipp: ", React.createElement("kbd", null, "\u2191"), " ", React.createElement("kbd", null, "\u2193"), " navigieren \xB7 ", React.createElement("kbd", null, "Enter"), " \xF6ffnen \xB7 ", React.createElement("kbd", null, "Esc"), " schlie\xDFen")), results.map((r, i) => React.createElement("button", {
      key: r.noteId,
      "data-idx": i,
      className: "search-result" + (i === active ? " active" : ""),
      onMouseEnter: () => setActive(i),
      onClick: () => {
        onSelect(r.noteId);
        onClose();
      }
    }, React.createElement("div", {
      className: "search-result-head"
    }, React.createElement("span", {
      className: "search-result-title"
    }, r.title), r.folder && React.createElement("span", {
      className: "search-result-folder"
    }, r.folder)), r.snippets.length > 0 && React.createElement("div", {
      className: "search-result-snips"
    }, r.snippets.slice(0, 2).map((s, j) => React.createElement("div", {
      key: j,
      className: "search-snip search-snip-" + s.field,
      dangerouslySetInnerHTML: {
        __html: s.html
      }
    })))))), results.length > 0 && React.createElement("div", {
      className: "search-footer"
    }, results.length, " ", results.length === 1 ? "Treffer" : "Treffer")));
  }
  Object.assign(window, {
    runSearch,
    rebuildSearchIndex: rebuildIndex,
    SearchModal
  });
})();