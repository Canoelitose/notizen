const {
  useState: useS,
  useEffect: useE,
  useMemo: useM,
  useRef: useR,
  useCallback: useC
} = React;
if (typeof document !== "undefined" && !document.getElementById("floating-menu-btn-styles")) {
  const _stEl = document.createElement("style");
  _stEl.id = "floating-menu-btn-styles";
  _stEl.textContent = `
    .floating-menu-btn {
      position: fixed; top: 12px; left: 12px; z-index: 50;
      width: 40px; height: 40px; border-radius: 10px;
      display: none; align-items: center; justify-content: center;
      background: var(--surface, #1c1a18); color: var(--text, #e8e3dc);
      border: 1px solid var(--border, #33302c); cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .floating-menu-btn:hover { background: var(--surface-hover, #262320); }
    .floating-menu-btn:active { transform: scale(0.94); }
    @media (max-width: 760px) {
      .floating-menu-btn { display: flex; width: 36px; height: 36px; }
    }
  `;
  document.head.appendChild(_stEl);
}
const TWEAK_DEFAULTS = {
  "accent": "#7C6CF0",
  "density": "comfortable",
  "fontScale": 1.0,
  "uiStyle": "clean"
};
const SMART_FOLDERS = [{
  id: "overdue",
  name: "Überfällig",
  icon: "alert",
  predicate: n => n.dueAt && new Date(n.dueAt).getTime() < Date.now()
}, {
  id: "this-week",
  name: "Diese Woche",
  icon: "calendar",
  predicate: n => {
    if (!n.dueAt) return false;
    const ms = new Date(n.dueAt).getTime() - Date.now();
    return ms >= 0 && ms < 7 * 24 * 60 * 60 * 1000;
  }
}, {
  id: "warnings",
  name: "Warnungen",
  icon: "alert",
  predicate: n => {
    const status = n.status || (n.blocks || []).find(b => b.kind === "status")?.value;
    return status === "warning" || status === "error";
  }
}, {
  id: "untagged",
  name: "Ohne Tag",
  icon: "tag",
  predicate: n => !n.tags || n.tags.length === 0
}];
window.SMART_FOLDERS = SMART_FOLDERS;
function App() {
  const [state, setState] = useS(() => emptyState());
  const {
    loaded = false
  } = state;
  const [saveStatus, setSaveStatus] = useS("idle");
  const [loadError, setLoadError] = useS(false);
  useE(() => {
    let cancelled = false,
      attempt = 0;
    const tryLoad = () => {
      api.fetchState().then(remote => {
        if (cancelled) return;
        setLoadError(false);
        setState(prev => ({
          ...prev,
          ...remote,
          loaded: true
        }));
      }).catch(err => {
        if (cancelled) return;
        console.warn("initial load failed (attempt " + (attempt + 1) + ")", err);
        setLoadError(true);
        attempt++;
        setTimeout(tryLoad, Math.min(15000, 1500 * attempt));
      });
    };
    tryLoad();
    return () => {
      cancelled = true;
    };
  }, []);
  useE(() => window.onSaveStatus?.(s => setSaveStatus(s)), []);
  useE(() => {
    const flush = () => window.flushSave?.();
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);
  const {
    folders = [],
    notes = [],
    templates = [],
    trash = [],
    themePref = "dark",
    selectedFolderId = "all",
    selectedNoteId = null
  } = state;
  useE(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    setState(s => {
      if (!s.trash || s.trash.length === 0) return s;
      const kept = s.trash.filter(e => new Date(e.deletedAt).getTime() > cutoff);
      if (kept.length === s.trash.length) return s;
      return {
        ...s,
        trash: kept
      };
    });
  }, []);
  const getSystem = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const [systemTheme, setSystemTheme] = useS(getSystem);
  useE(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = () => setSystemTheme(getSystem());
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  const theme = themePref === "auto" ? systemTheme : themePref;
  const [search, setSearch] = useS("");
  const [typeFilter, setTypeFilter] = useS("all");
  const [tagFilter, setTagFilter] = useS(null);
  const [toast, setToast] = useS(null);
  const [confirmDelete, setConfirmDelete] = useS(null);
  const [confirmAction, setConfirmAction] = useS(null);
  const [contextMenu, setContextMenu] = useS(null);
  const [mobilePane, setMobilePane] = useS("list");
  const [moreOpen, setMoreOpen] = useS(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useS(false);
  const [listCollapsed, setListCollapsed] = useS(false);
  const [editMode, setEditMode] = useS(true);
  const [templatesOpen, setTemplatesOpen] = useS(false);
  const [exportOpen, setExportOpen] = useS(false);
  const [importOpen, setImportOpen] = useS(false);
  const [saveTplPrompt, setSaveTplPrompt] = useS(null);
  const [hermesPrompt, setHermesPrompt] = useS(false);
  const [historyForNoteId, setHistoryForNoteId] = useS(null);
  const [searchOpen, setSearchOpen] = useS(false);
  const [openTabs, setOpenTabs] = useS([]);
  const moreRef = useR();
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  useE(() => {
    saveState(state);
  }, [state]);
  useE(() => {
    if (window.rebuildSearchIndex) window.rebuildSearchIndex(notes, folders);
  }, [notes, folders]);
  useE(() => {
    const onKey = e => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useE(() => {
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    root.dataset.theme = theme;
    const t = setTimeout(() => root.classList.remove("theme-transitioning"), 260);
    return () => clearTimeout(t);
  }, [theme]);
  useE(() => {
    const r = document.documentElement;
    if (tweaks.accent) r.style.setProperty("--accent", tweaks.accent);
    r.style.fontSize = `${(tweaks.fontScale || 1) * 14}px`;
  }, [tweaks.accent, tweaks.fontScale]);
  useE(() => {
    const r = document.documentElement;
    r.classList.add("theme-transitioning");
    r.dataset.style = tweaks.uiStyle || "classic";
    const t = setTimeout(() => r.classList.remove("theme-transitioning"), 260);
    return () => clearTimeout(t);
  }, [tweaks.uiStyle]);
  useE(() => {
    const close = e => {
      if (!moreRef.current?.contains(e.target)) setMoreOpen(false);
    };
    if (moreOpen) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);
  useE(() => {
    const onKey = e => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "n" && !e.shiftKey) {
        e.preventDefault();
        newNote("normal");
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        newNote("it");
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        cycleTheme();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        openDailyNote();
      } else if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document.querySelector(".search")?.focus();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector(".search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };
  const openContextMenu = (e, items) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items
    });
  };
  const closeContextMenu = () => setContextMenu(null);
  const buildNoteMenu = note => [{
    icon: "external",
    label: "Öffnen",
    onClick: () => onSelectNote(note.id)
  }, {
    icon: note.pinned ? "star-fill" : "star",
    label: note.pinned ? "Aus Favoriten" : "Zu Favoriten",
    onClick: () => togglePin(note.id)
  }, {
    icon: "copy",
    label: "Duplizieren",
    onClick: () => duplicateNote(note.id)
  }, {
    icon: "bookmark",
    label: "Als Template speichern",
    onClick: () => setSaveTplPrompt({
      name: note.title || "Eigenes Template"
    })
  }, {
    icon: "download",
    label: "Als Markdown exportieren",
    onClick: () => {
      const md = toMarkdown(note);
      const safe = (note.title || "notiz").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "notiz";
      download(`${safe}.md`, md, "text/markdown");
      showToast("Markdown exportiert");
    }
  }, {
    icon: "download",
    label: "Drucken / als PDF speichern",
    onClick: () => {
      onSelectNote(note.id);
      setTimeout(() => {
        document.body.classList.add("printing-note");
        window.print();
        document.body.classList.remove("printing-note");
      }, 50);
    }
  }, {
    divider: true
  }, {
    icon: "trash",
    label: "Löschen",
    danger: true,
    onClick: () => setConfirmDelete({
      kind: "note",
      id: note.id,
      name: note.title
    })
  }];
  const filteredNotes = useM(() => {
    let arr = notes;
    if (selectedFolderId === "pinned") arr = arr.filter(n => n.pinned);else if (selectedFolderId?.startsWith("smart:")) {
      const sf = SMART_FOLDERS.find(s => s.id === selectedFolderId.slice(6));
      if (sf) arr = arr.filter(sf.predicate);
    } else if (selectedFolderId !== "all") arr = arr.filter(n => n.folderId === selectedFolderId);
    if (typeFilter !== "all") arr = arr.filter(n => n.type === typeFilter);
    if (tagFilter) arr = arr.filter(n => (n.tags || []).includes(tagFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(n => {
        const hay = [n.title, n.description, n.command, n.output, (n.tags || []).join(" "), (n.blocks || []).map(b => b.text || (b.items || []).map(i => i.text).join(" ") || (b.rows || []).flat().join(" ") || "").join(" ")].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return arr;
  }, [notes, selectedFolderId, typeFilter, tagFilter, search]);
  const selectedNote = notes.find(n => n.id === selectedNoteId);
  useE(() => {
    if (selectedNote) window.prewarmOfficeInNote?.(selectedNote);
  }, [selectedNoteId]);
  useAutoSnapshot(selectedNote);
  const restoreVersion = version => {
    if (!selectedNote || !version) return;
    const restored = {
      ...selectedNote,
      title: version.title ?? selectedNote.title,
      icon: version.icon ?? selectedNote.icon,
      tags: [...(version.tags || [])],
      dueDate: version.dueDate ?? null,
      blocks: JSON.parse(JSON.stringify(version.blocks || [])),
      updatedAt: nowIso()
    };
    updateNote(restored);
    showToast("Version wiederhergestellt");
  };
  const updateState = patch => setState(s => ({
    ...s,
    ...patch
  }));
  const updateNote = note => setState(s => ({
    ...s,
    notes: s.notes.map(n => n.id === note.id ? note : n)
  }));
  const newNote = type => {
    const byName = type === "it" ? "IT-Notiz" : type === "normal" ? "Normale Notiz" : null;
    const tpl = byName && templates.find(t => t.name === byName) || templates[0];
    if (tpl) newNoteFromTemplate(tpl.id);
  };
  const newNoteFromTemplate = templateId => {
    const tpl = templates.find(t => t.id === templateId) || templates[0];
    if (!tpl) return;
    const id = uid();
    const folderId = ["all", "pinned"].includes(selectedFolderId) ? folders[0]?.id || null : selectedFolderId;
    const type = /it/i.test(tpl.name) ? "it" : "normal";
    const note = {
      id,
      type,
      folderId,
      pinned: false,
      title: "",
      tags: [],
      icon: tpl.icon || "doc",
      templateId: tpl.id,
      templateName: tpl.name,
      blocks: instantiateBlocks(tpl.blocks, {
        projekt: folders.find(f => f.id === folderId)?.name || ""
      }),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    setState(s => ({
      ...s,
      notes: [note, ...s.notes],
      selectedNoteId: id
    }));
    setEditMode(true);
    setMobilePane("editor");
  };
  const newNoteInFolder = folderId => {
    const tpl = templates.find(t => t.name === "Normale Notiz") || templates[0];
    if (!tpl) return;
    const id = uid();
    const fid = folderId || folders[0]?.id || null;
    const note = {
      id,
      type: "normal",
      folderId: fid,
      pinned: false,
      title: "",
      tags: [],
      icon: tpl.icon || "doc",
      templateId: tpl.id,
      templateName: tpl.name,
      blocks: instantiateBlocks(tpl.blocks, {
        projekt: folders.find(f => f.id === fid)?.name || ""
      }),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    setState(s => ({
      ...s,
      notes: [note, ...s.notes],
      selectedFolderId: fid || s.selectedFolderId,
      selectedNoteId: id
    }));
    setEditMode(true);
    setMobilePane("editor");
  };
  const openDailyNote = () => {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const dailyTitle = `${days[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    let folder = folders.find(f => f.name === "Tagesnotizen" && !f.parentId);
    let existing = folder ? notes.find(n => n.folderId === folder.id && n.title === dailyTitle) : null;
    if (existing) {
      updateState({
        selectedFolderId: existing.folderId,
        selectedNoteId: existing.id
      });
      setMobilePane("editor");
      return;
    }
    const folderId = folder?.id || uid();
    const noteId = uid();
    const ctx = TEMPLATE_VARS({});
    const note = {
      id: noteId,
      type: "normal",
      folderId,
      pinned: false,
      title: dailyTitle,
      icon: "calendar",
      tags: ["daily"],
      blocks: [{
        id: uid(),
        kind: "heading",
        text: `${ctx.wochentag}, ${ctx.datum} — ${ctx.kw}`
      }, {
        id: uid(),
        kind: "subheading",
        text: "Heute geplant"
      }, {
        id: uid(),
        kind: "checklist",
        items: [{
          id: uid(),
          text: "",
          done: false
        }]
      }, {
        id: uid(),
        kind: "subheading",
        text: "Notizen"
      }, {
        id: uid(),
        kind: "text",
        text: ""
      }],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    setState(s => ({
      ...s,
      folders: folder ? s.folders : [...s.folders, {
        id: folderId,
        name: "Tagesnotizen",
        icon: "calendar",
        parentId: null
      }],
      notes: [note, ...s.notes],
      selectedFolderId: folderId,
      selectedNoteId: noteId
    }));
    setEditMode(true);
    setMobilePane("editor");
    showToast(`Tagesnotiz für ${dailyTitle} angelegt`);
  };
  const saveAsTemplate = (note, name) => {
    if (!note) return;
    const tpl = {
      id: uid(),
      name: name || note.title || "Eigenes Template",
      icon: note.icon || "doc",
      blocks: blocksToTemplate(note.blocks)
    };
    setState(s => ({
      ...s,
      templates: [...(s.templates || []), tpl]
    }));
    showToast(`Template "${tpl.name}" gespeichert`);
  };
  const renameTemplate = (id, name) => setState(s => ({
    ...s,
    templates: (s.templates || []).map(t => t.id === id ? {
      ...t,
      name
    } : t)
  }));
  const deleteTemplate = id => setState(s => ({
    ...s,
    templates: (s.templates || []).filter(t => t.id !== id)
  }));
  const changeTemplateIcon = (id, icon) => setState(s => ({
    ...s,
    templates: (s.templates || []).map(t => t.id === id ? {
      ...t,
      icon
    } : t)
  }));
  const deleteNote = id => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const batchId = uid();
    setState(s => ({
      ...s,
      notes: s.notes.filter(n => n.id !== id),
      selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId,
      trash: [...(s.trash || []), {
        id: uid(),
        kind: "note",
        deletedAt: nowIso(),
        batchId,
        note
      }]
    }));
    setConfirmDelete(null);
    showToast("In den Papierkorb verschoben");
  };
  const restoreBatch = batchId => {
    const batch = (trash || []).filter(e => e.batchId === batchId);
    if (batch.length === 0) return;
    const batchFolders = batch.filter(e => e.kind === "folder").map(e => e.folder);
    const batchNotes = batch.filter(e => e.kind === "note").map(e => e.note);
    setState(s => {
      const knownFolderIds = new Set([...s.folders.map(f => f.id), ...batchFolders.map(f => f.id)]);
      const restoredFolders = batchFolders.map(f => ({
        ...f,
        parentId: f.parentId && knownFolderIds.has(f.parentId) ? f.parentId : null
      }));
      const fallbackFolderId = restoredFolders[0]?.id || s.folders[0]?.id || null;
      const restoredNotes = batchNotes.map(n => ({
        ...n,
        folderId: knownFolderIds.has(n.folderId) ? n.folderId : fallbackFolderId
      }));
      return {
        ...s,
        folders: [...s.folders, ...restoredFolders],
        notes: [...restoredNotes, ...s.notes],
        trash: s.trash.filter(e => e.batchId !== batchId)
      };
    });
    showToast(`${batch.length} Element${batch.length !== 1 ? "e" : ""} wiederhergestellt`);
  };
  const purgeTrashEntry = entryId => {
    setState(s => ({
      ...s,
      trash: s.trash.filter(e => e.id !== entryId)
    }));
    showToast("Endgültig gelöscht");
  };
  const emptyTrash = () => {
    if (!trash.length) return;
    setConfirmAction({
      title: "Papierkorb leeren?",
      message: `${trash.length} Element${trash.length !== 1 ? "e" : ""} werden unwiderruflich gelöscht.`,
      confirmLabel: "Leeren",
      danger: true,
      onConfirm: () => {
        setState(s => ({
          ...s,
          trash: []
        }));
        showToast("Papierkorb geleert");
      }
    });
  };
  const togglePin = id => setState(s => ({
    ...s,
    notes: s.notes.map(n => n.id === id ? {
      ...n,
      pinned: !n.pinned
    } : n)
  }));
  const duplicateNote = id => {
    const orig = notes.find(n => n.id === id);
    if (!orig) return;
    const copy = {
      ...orig,
      id: uid(),
      title: (orig.title || "Ohne Titel") + " (Kopie)",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      pinned: false
    };
    setState(s => ({
      ...s,
      notes: [copy, ...s.notes],
      selectedNoteId: copy.id
    }));
    showToast("Dupliziert");
  };
  const moveNote = (id, folderId) => setState(s => ({
    ...s,
    notes: s.notes.map(n => n.id === id ? {
      ...n,
      folderId,
      updatedAt: nowIso()
    } : n)
  }));
  const moveFolder = (id, newParentId, pos) => {
    if (id === newParentId) return;
    const descendants = new Set();
    const walk = pid => {
      folders.filter(f => f.parentId === pid).forEach(f => {
        descendants.add(f.id);
        walk(f.id);
      });
    };
    walk(id);
    if (newParentId && descendants.has(newParentId)) return;
    setState(s => {
      const moved = s.folders.find(f => f.id === id);
      if (!moved) return s;
      const target = newParentId || null;
      const updated = {
        ...moved,
        parentId: target
      };
      const without = s.folders.filter(f => f.id !== id);
      if (pos && (pos.before || pos.after)) {
        const anchorId = pos.before || pos.after;
        const idx = without.findIndex(f => f.id === anchorId);
        if (idx === -1) return {
          ...s,
          folders: [...without, updated]
        };
        const insertAt = pos.before ? idx : idx + 1;
        const next = [...without];
        next.splice(insertAt, 0, updated);
        return {
          ...s,
          folders: next
        };
      }
      return {
        ...s,
        folders: s.folders.map(f => f.id === id ? updated : f)
      };
    });
  };
  const addFolder = (name, parentId = null) => {
    const f = {
      id: uid(),
      name,
      icon: "folder",
      parentId: parentId || null
    };
    setState(s => ({
      ...s,
      folders: [...s.folders, f]
    }));
  };
  const renameFolder = (id, name) => setState(s => ({
    ...s,
    folders: s.folders.map(f => f.id === id ? {
      ...f,
      name
    } : f)
  }));
  const changeFolderIcon = (id, icon) => setState(s => ({
    ...s,
    folders: s.folders.map(f => f.id === id ? {
      ...f,
      icon
    } : f)
  }));
  const deleteFolder = id => {
    setConfirmDelete({
      kind: "folder",
      id,
      name: folders.find(f => f.id === id)?.name
    });
  };
  const collectFolderAndDescendants = id => {
    const ids = new Set([id]);
    let added = true;
    while (added) {
      added = false;
      folders.forEach(f => {
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          added = true;
        }
      });
    }
    return ids;
  };
  const folderDeleteImpact = id => {
    if (!id) return {
      folders: 0,
      notes: 0
    };
    const ids = collectFolderAndDescendants(id);
    return {
      folders: ids.size - 1,
      notes: notes.filter(n => ids.has(n.folderId)).length
    };
  };
  const confirmDeleteFolder = (id, cascade = true) => {
    const batchId = uid();
    const now = nowIso();
    if (cascade) {
      const ids = collectFolderAndDescendants(id);
      const trashedFolders = folders.filter(f => ids.has(f.id));
      const trashedNotes = notes.filter(n => ids.has(n.folderId));
      setState(s => ({
        ...s,
        folders: s.folders.filter(f => !ids.has(f.id)),
        notes: s.notes.filter(n => !ids.has(n.folderId)),
        selectedFolderId: ids.has(s.selectedFolderId) ? "all" : s.selectedFolderId,
        selectedNoteId: (() => {
          const open = trashedNotes.find(n => n.id === s.selectedNoteId);
          return open ? null : s.selectedNoteId;
        })(),
        trash: [...(s.trash || []), ...trashedFolders.map(folder => ({
          id: uid(),
          kind: "folder",
          deletedAt: now,
          batchId,
          folder
        })), ...trashedNotes.map(note => ({
          id: uid(),
          kind: "note",
          deletedAt: now,
          batchId,
          note
        }))]
      }));
      setConfirmDelete(null);
      const parts = [];
      if (trashedFolders.length > 1) parts.push(`+ ${trashedFolders.length - 1} Unterordner`);
      if (trashedNotes.length > 0) parts.push(`+ ${trashedNotes.length} Notiz${trashedNotes.length !== 1 ? "en" : ""}`);
      showToast(parts.length ? `In den Papierkorb (${parts.join(" ")})` : "In den Papierkorb");
    } else {
      const folder = folders.find(f => f.id === id);
      if (!folder) return;
      const parentOfDeleted = folder.parentId || null;
      const fallback = parentOfDeleted || folders.find(f => f.id !== id && (f.parentId || null) === null)?.id || null;
      setState(s => ({
        ...s,
        folders: s.folders.filter(f => f.id !== id).map(f => f.parentId === id ? {
          ...f,
          parentId: parentOfDeleted
        } : f),
        notes: s.notes.map(n => n.folderId === id ? {
          ...n,
          folderId: fallback
        } : n),
        selectedFolderId: s.selectedFolderId === id ? "all" : s.selectedFolderId,
        trash: [...(s.trash || []), {
          id: uid(),
          kind: "folder",
          deletedAt: now,
          batchId,
          folder
        }]
      }));
      setConfirmDelete(null);
      showToast("Ordner in den Papierkorb — Inhalt verschoben");
    }
  };
  const exportAll = () => {
    setExportOpen(true);
  };
  const createHermesProject = (name, selectedIds) => {
    if (!window.createHermesProject) return;
    const {
      folders: newFolders,
      notes: newNotes,
      rootFolderId
    } = window.createHermesProject(name, {
      selectedIds
    });
    setState(s => ({
      ...s,
      folders: [...s.folders, ...newFolders],
      notes: [...newNotes, ...s.notes],
      selectedFolderId: rootFolderId,
      selectedNoteId: null
    }));
    setHermesPrompt(false);
    setMobilePane("list");
    showToast(`HERMES-Projekt „${name}“ angelegt — ${newNotes.length} Vorlagen`);
  };
  const exportSelection = ({
    noteIds,
    folderIds,
    format
  }) => {
    const includedFolderIds = new Set();
    const collect = fid => {
      if (includedFolderIds.has(fid)) return;
      includedFolderIds.add(fid);
      folders.filter(f => f.parentId === fid).forEach(f => collect(f.id));
    };
    (folderIds || []).forEach(collect);
    const includedNotes = notes.filter(n => (noteIds || []).includes(n.id) || includedFolderIds.has(n.folderId));
    if (includedNotes.length === 0) {
      showToast("Keine Notizen ausgewählt");
      return;
    }
    const includedFolders = folders.filter(f => includedFolderIds.has(f.id) || includedNotes.some(n => n.folderId === f.id));
    if (format === "markdown") {
      const md = includedNotes.map(n => toMarkdown(n)).join("\n\n---\n\n");
      download("notizen-export.md", md, "text/markdown");
    } else {
      const bundle = {
        version: 1,
        exportedAt: nowIso(),
        appName: "Note",
        folders: includedFolders,
        notes: includedNotes
      };
      download(`notizen-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2), "application/json");
    }
    showToast(`${includedNotes.length} Notiz(en) exportiert`);
    setExportOpen(false);
  };
  const importBundle = (json, {
    mode
  }) => {
    let data;
    try {
      data = JSON.parse(json);
    } catch (e) {
      showToast("Ungültige JSON-Datei");
      return;
    }
    if (!data || !Array.isArray(data.notes) || !Array.isArray(data.folders)) {
      showToast("Format nicht erkannt — kein gültiger Export");
      return;
    }
    const folderIdMap = {};
    data.folders.forEach(f => {
      folderIdMap[f.id] = uid();
    });
    const newFolders = data.folders.map(f => ({
      ...f,
      id: folderIdMap[f.id],
      parentId: f.parentId && folderIdMap[f.parentId] ? folderIdMap[f.parentId] : null
    }));
    const newNotes = data.notes.map(n => ({
      ...n,
      id: uid(),
      folderId: n.folderId && folderIdMap[n.folderId] ? folderIdMap[n.folderId] : folders[0]?.id || null,
      blocks: (n.blocks || []).map(b => ({
        ...b,
        id: uid(),
        items: b.items ? b.items.map(i => ({
          ...i,
          id: uid()
        })) : b.items
      }))
    }));
    setState(s => mode === "replace" ? {
      ...s,
      folders: newFolders,
      notes: newNotes
    } : {
      ...s,
      folders: [...s.folders, ...newFolders],
      notes: [...s.notes, ...newNotes]
    });
    showToast(`${newNotes.length} Notiz(en) importiert`);
    setImportOpen(false);
  };
  const exportSingle = () => {
    if (!selectedNote) return;
    const md = toMarkdown(selectedNote);
    const safe = (selectedNote.title || "notiz").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "notiz";
    download(`${safe}.md`, md, "text/markdown");
    showToast("Markdown exportiert");
  };
  const toggleTheme = () => updateState({
    themePref: theme === "dark" ? "light" : "dark"
  });
  const setThemePref = p => updateState({
    themePref: p
  });
  const cycleTheme = () => {
    const order = ["light", "dark", "auto"];
    const next = order[(order.indexOf(themePref) + 1) % order.length];
    updateState({
      themePref: next
    });
    showToast(next === "auto" ? `Theme: Automatisch (${systemTheme === "dark" ? "Dunkel" : "Hell"})` : next === "dark" ? "Theme: Dunkel" : "Theme: Hell");
  };
  const onSelectNote = id => {
    const note = notes.find(n => n.id === id);
    const inSpecial = ["dashboard", "graph", "trash", "kanban", "timeline", "help"].includes(selectedFolderId);
    const patch = {
      selectedNoteId: id
    };
    if (inSpecial && note?.folderId) patch.selectedFolderId = note.folderId;
    updateState(patch);
    setMobilePane("editor");
  };
  useE(() => {
    if (selectedNoteId) {
      setOpenTabs(t => t.includes(selectedNoteId) ? t : [...t, selectedNoteId]);
    }
  }, [selectedNoteId]);
  const closeTab = id => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t !== id);
      if (id === selectedNoteId) {
        const idx = prev.indexOf(id);
        const nb = next[Math.min(idx, next.length - 1)] || null;
        updateState({
          selectedNoteId: nb
        });
        if (!nb) setMobilePane("list");
      }
      return next;
    });
  };
  useE(() => {
    setOpenTabs(t => {
      const f = t.filter(id => notes.some(n => n.id === id));
      return f.length === t.length ? t : f;
    });
  }, [notes]);
  const _isSpecialView = ["dashboard", "graph", "trash", "kanban", "timeline", "help"].includes(selectedFolderId);
  const _showFloatingMenu = mobilePane === "sidebar" ? false : sidebarCollapsed || _isSpecialView;
  return React.createElement(React.Fragment, null, loadError && React.createElement("div", {
    style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: "var(--danger, #c0392b)",
      color: "#fff",
      padding: "8px 14px",
      fontSize: 13,
      textAlign: "center",
      fontWeight: 500,
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
    }
  }, "\u26A0 Notizen konnten nicht geladen werden \u2014 Verbindung wird wiederhergestellt\u2026 Bitte jetzt nichts bearbeiten (Speichern ist zum Schutz deiner Daten pausiert)."), _showFloatingMenu && React.createElement("button", {
    className: "floating-menu-btn",
    onClick: () => {
      setSidebarCollapsed(false);
      setMobilePane("sidebar");
    },
    title: "Men\xFC \xF6ffnen",
    "aria-label": "Men\xFC \xF6ffnen"
  }, React.createElement(Icon, {
    name: "menu",
    size: 18
  })), React.createElement("div", {
    className: "app" + (sidebarCollapsed ? " sidebar-collapsed" : "") + (listCollapsed ? " list-collapsed" : "") + (selectedNote ? " has-note" : ""),
    "data-pane": mobilePane
  }, sidebarCollapsed && (listCollapsed || ["dashboard", "graph", "trash", "kanban", "timeline", "help"].includes(selectedFolderId)) && React.createElement("button", {
    className: "floating-sidebar-toggle",
    onClick: () => {
      setSidebarCollapsed(false);
      if (listCollapsed) setListCollapsed(false);
    },
    title: "Seitenleiste einblenden",
    "aria-label": "Seitenleiste einblenden"
  }, React.createElement(Icon, {
    name: "menu"
  })), React.createElement(Sidebar, {
    folders: folders,
    notes: notes,
    selectedFolderId: selectedFolderId,
    selectedNoteId: selectedNoteId,
    onSelectNote: onSelectNote,
    onSelectFolder: id => {
      const special = ["dashboard", "graph", "trash", "kanban", "timeline", "help"].includes(id);
      updateState({
        selectedFolderId: id,
        ...(special ? {
          selectedNoteId: null
        } : {})
      });
    },
    onMoveNote: moveNote,
    onMoveFolder: moveFolder,
    onAddFolder: addFolder,
    onRenameFolder: renameFolder,
    onChangeFolderIcon: changeFolderIcon,
    onDeleteFolder: deleteFolder,
    onShowContextMenu: openContextMenu,
    theme: theme,
    themePref: themePref,
    systemTheme: systemTheme,
    onSetThemePref: setThemePref,
    onToggleTheme: toggleTheme,
    onExport: exportAll,
    onImport: () => setImportOpen(true),
    onNewHermesProject: () => setHermesPrompt(true),
    onOpenDailyNote: openDailyNote,
    onOpenSearch: () => setSearchOpen(true),
    onNewNoteInFolder: newNoteInFolder,
    smartFolders: SMART_FOLDERS,
    trashCount: trash.length,
    onCollapse: () => setSidebarCollapsed(true),
    onLogout: () => window.api?.logout?.(),
    saveStatus: saveStatus,
    onMobileClose: () => setMobilePane("list")
  }), selectedFolderId === "trash" ? React.createElement("section", {
    className: "trash-pane",
    style: {
      gridColumn: "2 / 4"
    }
  }, React.createElement(TrashView, {
    trash: trash,
    folders: folders,
    onRestoreBatch: restoreBatch,
    onPurgeBatch: b => {
      setConfirmAction({
        title: "Endgültig löschen?",
        message: "Dieser Eintrag (inklusive zugehörige Notizen / Ordner) wird unwiderruflich gelöscht.",
        confirmLabel: "Löschen",
        danger: true,
        onConfirm: () => {
          b.entries.forEach(e => purgeTrashEntry(e.id));
        }
      });
    },
    onEmpty: emptyTrash
  })) : selectedFolderId === "graph" ? React.createElement("section", {
    className: "graph-pane",
    style: {
      gridColumn: "2 / 4"
    }
  }, React.createElement(window.GraphView, {
    notes: notes,
    folders: folders,
    onSelectNote: id => {
      const note = notes.find(n => n.id === id);
      updateState({
        selectedFolderId: note?.folderId || "all",
        selectedNoteId: id
      });
      setMobilePane("editor");
    },
    onContextMenu: (e, note) => openContextMenu(e, buildNoteMenu(note))
  })) : selectedFolderId === "kanban" ? React.createElement("section", {
    className: "kanban-pane",
    style: {
      gridColumn: "2 / 4"
    }
  }, React.createElement(KanbanView, {
    notes: notes,
    folders: folders,
    onSelectNote: id => {
      const note = notes.find(n => n.id === id);
      updateState({
        selectedFolderId: note?.folderId || "all",
        selectedNoteId: id
      });
      setMobilePane("editor");
    },
    onUpdateNote: updateNote
  })) : selectedFolderId === "timeline" ? React.createElement("section", {
    className: "timeline-pane",
    style: {
      gridColumn: "2 / 4"
    }
  }, React.createElement(TimelineView, {
    notes: notes,
    folders: folders,
    onSelectNote: id => {
      const note = notes.find(n => n.id === id);
      updateState({
        selectedFolderId: note?.folderId || "all",
        selectedNoteId: id
      });
      setMobilePane("editor");
    },
    onUpdateNote: updateNote
  })) : selectedFolderId === "help" ? React.createElement("section", {
    className: "help-pane",
    style: {
      gridColumn: "2 / 4"
    }
  }, React.createElement(window.HelpView, null)) : React.createElement(React.Fragment, null, selectedFolderId === "dashboard" && !selectedNote ? React.createElement(Dashboard, {
    folders: folders,
    notes: notes,
    templates: templates,
    onSelectNote: onSelectNote,
    onSelectFolder: id => updateState({
      selectedFolderId: id
    }),
    onNewFromTemplate: newNoteFromTemplate,
    onTogglePin: togglePin
  }) : React.createElement(NotesList, {
    notes: filteredNotes,
    folders: folders,
    selectedFolderId: selectedFolderId,
    selectedNoteId: selectedNoteId,
    onSelectNote: onSelectNote,
    onNewNote: newNote,
    onNewFromTemplate: newNoteFromTemplate,
    templates: templates,
    onManageTemplates: () => setTemplatesOpen(true),
    onNewHermesProject: () => setHermesPrompt(true),
    search: search,
    onSearchChange: setSearch,
    typeFilter: typeFilter,
    onTypeFilter: setTypeFilter,
    tagFilter: tagFilter,
    onTagFilter: setTagFilter,
    onDeleteNote: note => setConfirmDelete({
      kind: "note",
      id: note.id,
      name: note.title
    }),
    onTogglePin: togglePin,
    onContextMenu: (e, note) => openContextMenu(e, buildNoteMenu(note)),
    onSelectFolder: id => {
      const special = ["dashboard", "graph", "trash", "kanban", "timeline", "help"].includes(id);
      updateState({
        selectedFolderId: id,
        ...(special ? {
          selectedNoteId: null
        } : {})
      });
    },
    sidebarCollapsed: sidebarCollapsed,
    onShowSidebar: () => setSidebarCollapsed(false),
    onCollapse: () => setListCollapsed(true),
    onOpenSidebar: () => setMobilePane("sidebar")
  }), selectedFolderId !== "dashboard" || selectedNote ? React.createElement("section", {
    className: "editor-pane"
  }, selectedNote ? React.createElement(React.Fragment, null, React.createElement(EditorTabs, {
    tabs: openTabs,
    notes: notes,
    activeId: selectedNoteId,
    onSelect: onSelectNote,
    onClose: closeTab,
    onNew: () => newNote("normal")
  }), React.createElement("div", {
    className: "editor-toolbar"
  }, React.createElement("button", {
    className: "icon-btn mobile-only",
    onClick: () => setMobilePane("list"),
    title: "Zur\xFCck"
  }, React.createElement(Icon, {
    name: "chevron-left"
  })), (listCollapsed || sidebarCollapsed) && React.createElement("button", {
    className: "icon-btn",
    onClick: () => {
      if (sidebarCollapsed) setSidebarCollapsed(false);
      if (listCollapsed) setListCollapsed(false);
    },
    title: "Seitenleiste einblenden"
  }, React.createElement(Icon, {
    name: "menu"
  })), React.createElement(FolderPicker, {
    folders: folders,
    value: selectedNote.folderId,
    onChange: fid => moveNote(selectedNote.id, fid)
  }), React.createElement("div", {
    className: "spacer"
  }), React.createElement("button", {
    className: "icon-btn editor-close-x",
    onClick: () => updateState({
      selectedNoteId: null
    }),
    title: "Notiz schlie\xDFen"
  }, React.createElement(Icon, {
    name: "x"
  })), React.createElement("button", {
    className: "edit-toggle" + (editMode ? " on" : ""),
    onClick: () => setEditMode(v => !v),
    title: editMode ? "Bearbeiten beenden" : "Blöcke bearbeiten"
  }, React.createElement(Icon, {
    name: editMode ? "check" : "edit",
    size: 13
  }), React.createElement("span", null, editMode ? "Fertig" : "Bearbeiten")), React.createElement("button", {
    className: "icon-btn" + (selectedNote.pinned ? " active" : ""),
    onClick: () => togglePin(selectedNote.id),
    title: selectedNote.pinned ? "Aus Favoriten" : "Zu Favoriten"
  }, React.createElement(Icon, {
    name: selectedNote.pinned ? "star-fill" : "star"
  })), React.createElement("div", {
    className: "dropdown",
    ref: moreRef
  }, React.createElement("button", {
    className: "icon-btn",
    onClick: () => setMoreOpen(v => !v)
  }, React.createElement(Icon, {
    name: "more"
  })), moreOpen && React.createElement("div", {
    className: "dropdown-menu"
  }, React.createElement("button", {
    className: "dropdown-item",
    onClick: () => {
      setMoreOpen(false);
      duplicateNote(selectedNote.id);
    }
  }, React.createElement(Icon, {
    name: "copy",
    size: 14
  }), " Duplizieren"), React.createElement("button", {
    className: "dropdown-item",
    onClick: () => {
      setMoreOpen(false);
      setHistoryForNoteId(selectedNote.id);
    }
  }, React.createElement(Icon, {
    name: "history",
    size: 14
  }), " Versionsverlauf"), React.createElement("button", {
    className: "dropdown-item",
    onClick: () => {
      setMoreOpen(false);
      setSaveTplPrompt({
        name: selectedNote.title || "Eigenes Template"
      });
    }
  }, React.createElement(Icon, {
    name: "bookmark",
    size: 14
  }), " Als Template speichern"), React.createElement("button", {
    className: "dropdown-item",
    onClick: () => {
      setMoreOpen(false);
      exportSingle();
    }
  }, React.createElement(Icon, {
    name: "download",
    size: 14
  }), " Als Markdown exportieren"), React.createElement("button", {
    className: "dropdown-item",
    onClick: () => {
      setMoreOpen(false);
      setTimeout(() => {
        document.body.classList.add("printing-note");
        window.print();
        document.body.classList.remove("printing-note");
      }, 50);
    }
  }, React.createElement(Icon, {
    name: "download",
    size: 14
  }), " Drucken / PDF"), React.createElement("div", {
    className: "dropdown-divider"
  }), React.createElement("button", {
    className: "dropdown-item danger",
    onClick: () => {
      setMoreOpen(false);
      setConfirmDelete({
        kind: "note",
        id: selectedNote.id,
        name: selectedNote.title
      });
    }
  }, React.createElement(Icon, {
    name: "trash",
    size: 14
  }), " L\xF6schen")))), React.createElement("div", {
    className: "editor-body"
  }, React.createElement(NormalEditor, {
    note: selectedNote,
    onChange: updateNote,
    onToast: showToast,
    editMode: editMode,
    notes: notes,
    folders: folders,
    onSelectNote: onSelectNote
  }))) : React.createElement(EditorEmpty, {
    onNewNote: newNote
  })) : null), mobilePane === "sidebar" && React.createElement("button", {
    className: "mobile-drawer-backdrop",
    "aria-label": "Sammlungen schlie\xDFen",
    onClick: () => setMobilePane(selectedNote ? "editor" : "list")
  })), React.createElement(MobileTabBar, {
    mobilePane: mobilePane,
    setMobilePane: setMobilePane,
    selectedFolderId: selectedFolderId,
    selectedNoteId: selectedNoteId,
    onGoNotes: () => {
      if (["dashboard", "graph", "trash", "kanban", "timeline", "help"].includes(selectedFolderId)) {
        updateState({
          selectedFolderId: "all",
          selectedNoteId: null
        });
      }
      setMobilePane("list");
    },
    onNewNote: () => newNote("normal"),
    onGoDashboard: () => updateState({
      selectedFolderId: "dashboard",
      selectedNoteId: null
    }),
    onOpenSearch: () => setSearchOpen(true)
  }), exportOpen && React.createElement(ExportModal, {
    folders: folders,
    notes: notes,
    onCancel: () => setExportOpen(false),
    onExport: exportSelection
  }), importOpen && React.createElement(ImportModal, {
    onCancel: () => setImportOpen(false),
    onImport: importBundle
  }), templatesOpen && React.createElement(TemplatesModal, {
    templates: templates,
    onRename: renameTemplate,
    onDelete: id => {
      const t = templates.find(x => x.id === id);
      setConfirmAction({
        title: "Template löschen?",
        message: `„${t?.name || "Template"}“ wird unwiderruflich gelöscht.`,
        confirmLabel: "Löschen",
        danger: true,
        onConfirm: () => deleteTemplate(id)
      });
    },
    onChangeIcon: changeTemplateIcon,
    onClose: () => setTemplatesOpen(false)
  }), saveTplPrompt && React.createElement(SaveTemplatePrompt, {
    defaultName: saveTplPrompt.name,
    onCancel: () => setSaveTplPrompt(null),
    onConfirm: name => {
      saveAsTemplate(selectedNote, name);
      setSaveTplPrompt(null);
    }
  }), hermesPrompt && React.createElement(HermesProjectPrompt, {
    onCancel: () => setHermesPrompt(false),
    onConfirm: createHermesProject
  }), toast && React.createElement("div", {
    className: "toast"
  }, toast), historyForNoteId && (() => {
    const n = notes.find(x => x.id === historyForNoteId);
    if (!n) return null;
    return React.createElement(VersionHistoryModal, {
      note: n,
      onClose: () => setHistoryForNoteId(null),
      onRestore: restoreVersion,
      onShowToast: showToast
    });
  })(), confirmDelete && confirmDelete.kind === "folder" && React.createElement(FolderDeleteModal, {
    name: confirmDelete.name,
    impact: folderDeleteImpact(confirmDelete.id),
    onCancel: () => setConfirmDelete(null),
    onConfirm: cascade => confirmDeleteFolder(confirmDelete.id, cascade)
  }), confirmDelete && confirmDelete.kind === "note" && React.createElement(ConfirmModal, {
    title: "Notiz l\xF6schen?",
    message: `„${confirmDelete.name || "Diese Notiz"}" wird endgültig gelöscht.`,
    onCancel: () => setConfirmDelete(null),
    onConfirm: () => deleteNote(confirmDelete.id)
  }), contextMenu && React.createElement(ContextMenu, {
    x: contextMenu.x,
    y: contextMenu.y,
    items: contextMenu.items,
    onClose: closeContextMenu
  }), searchOpen && window.SearchModal && React.createElement(window.SearchModal, {
    onClose: () => setSearchOpen(false),
    onSelect: noteId => {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        setState(s => ({
          ...s,
          selectedFolderId: note.folderId,
          selectedNoteId: noteId
        }));
        setMobilePane("editor");
      }
    }
  }), confirmAction && React.createElement(ConfirmModal, {
    title: confirmAction.title,
    message: confirmAction.message,
    confirmLabel: confirmAction.confirmLabel,
    danger: confirmAction.danger,
    onCancel: () => setConfirmAction(null),
    onConfirm: () => {
      confirmAction.onConfirm?.();
      setConfirmAction(null);
    }
  }), window.TweaksPanel && React.createElement(window.TweaksPanel, {
    title: "Tweaks"
  }, React.createElement(window.TweakSection, {
    label: "Aussehen"
  }), React.createElement(window.TweakRadio, {
    label: "Stil",
    value: tweaks.uiStyle || "classic",
    onChange: v => setTweak("uiStyle", v),
    options: [{
      value: "classic",
      label: "Klassisch"
    }, {
      value: "clean",
      label: "Clean"
    }]
  }), React.createElement(window.TweakColor, {
    label: "Akzentfarbe",
    value: tweaks.accent,
    onChange: v => setTweak("accent", v),
    options: ["#7C6CF0", "#8B5CF6", "#5B8DEF", "#3FB6A8", "#E0698A"]
  }), React.createElement(window.TweakSlider, {
    label: "Schriftgr\xF6\xDFe",
    value: tweaks.fontScale,
    onChange: v => setTweak("fontScale", v),
    min: 0.85,
    max: 1.2,
    step: 0.05
  }), React.createElement(window.TweakRadio, {
    label: "Dichte",
    value: tweaks.density,
    onChange: v => setTweak("density", v),
    options: [{
      value: "comfortable",
      label: "Komfort"
    }, {
      value: "compact",
      label: "Kompakt"
    }]
  }), React.createElement(window.TweakSection, {
    label: "Daten"
  }), React.createElement(window.TweakButton, {
    label: "Alle Notizen l\xF6schen",
    onClick: () => {
      setConfirmAction({
        title: "Wirklich alle Notizen löschen?",
        message: "Alle Notizen und Ordner werden unwiderruflich gelöscht. Das lässt sich nicht rückgängig machen.",
        confirmLabel: "Endgültig löschen",
        danger: true,
        onConfirm: () => {
          window.api?.saveState?.({
            ...state,
            folders: [],
            notes: [],
            trash: [],
            loaded: true,
            _allowEmpty: true
          });
          setState(s => ({
            ...s,
            folders: [],
            notes: [],
            trash: [],
            selectedNoteId: null,
            selectedFolderId: "dashboard"
          }));
        }
      });
    }
  })));
}
function EditorTabs({
  tabs,
  notes,
  activeId,
  onSelect,
  onClose,
  onNew
}) {
  const items = tabs.map(id => notes.find(n => n.id === id)).filter(Boolean);
  if (items.length === 0) return null;
  return React.createElement("div", {
    className: "editor-tabs desktop-only",
    role: "tablist"
  }, React.createElement("div", {
    className: "editor-tabs-strip"
  }, items.map(n => React.createElement("div", {
    key: n.id,
    className: "editor-tab" + (n.id === activeId ? " active" : ""),
    onClick: () => onSelect(n.id),
    onAuxClick: e => {
      if (e.button === 1) {
        e.preventDefault();
        onClose(n.id);
      }
    },
    role: "tab",
    "aria-selected": n.id === activeId,
    title: n.title || "Ohne Titel"
  }, React.createElement(Icon, {
    name: n.icon || (n.type === "it" ? "terminal" : "doc"),
    size: 13,
    className: "editor-tab-ico"
  }), React.createElement("span", {
    className: "editor-tab-title"
  }, n.title || "Ohne Titel"), React.createElement("button", {
    className: "editor-tab-close",
    onClick: e => {
      e.stopPropagation();
      onClose(n.id);
    },
    title: "Tab schlie\xDFen",
    "aria-label": "Tab schlie\xDFen"
  }, React.createElement(Icon, {
    name: "x",
    size: 12
  }))))), React.createElement("button", {
    className: "editor-tab-new",
    onClick: onNew,
    title: "Neue Notiz (Strg/Cmd + N)",
    "aria-label": "Neue Notiz"
  }, React.createElement(Icon, {
    name: "plus",
    size: 14
  })));
}
function MobileTabBar({
  mobilePane,
  setMobilePane,
  selectedFolderId,
  selectedNoteId,
  onGoNotes,
  onNewNote,
  onGoDashboard,
  onOpenSearch
}) {
  const specials = ["dashboard", "graph", "trash", "kanban", "timeline", "help"];
  const inSpecial = specials.includes(selectedFolderId);
  const inList = mobilePane === "list" && !inSpecial;
  return React.createElement("nav", {
    className: "mobile-tabbar",
    role: "tablist"
  }, React.createElement("button", {
    type: "button",
    className: "mtab" + (mobilePane === "sidebar" ? " active" : ""),
    onClick: () => setMobilePane("sidebar"),
    "aria-label": "Seiten"
  }, React.createElement("span", {
    className: "mtab-ico"
  }, React.createElement(Icon, {
    name: "folder"
  })), React.createElement("span", {
    className: "mtab-label"
  }, "Seiten")), React.createElement("button", {
    type: "button",
    className: "mtab",
    onClick: onOpenSearch,
    "aria-label": "Suchen"
  }, React.createElement("span", {
    className: "mtab-ico"
  }, React.createElement(Icon, {
    name: "search"
  })), React.createElement("span", {
    className: "mtab-label"
  }, "Suchen")), React.createElement("button", {
    type: "button",
    className: "mtab" + (inList ? " active" : ""),
    onClick: onGoNotes,
    "aria-label": "Notizen"
  }, React.createElement("span", {
    className: "mtab-ico"
  }, React.createElement(Icon, {
    name: "inbox"
  })), React.createElement("span", {
    className: "mtab-label"
  }, "Notizen")), React.createElement("button", {
    type: "button",
    className: "mtab mtab-new",
    onClick: onNewNote,
    "aria-label": "Neue Seite"
  }, React.createElement("span", {
    className: "mtab-ico"
  }, React.createElement(Icon, {
    name: "plus"
  })), React.createElement("span", {
    className: "mtab-label"
  }, "Neu")));
}
function FolderPicker({
  folders,
  value,
  onChange
}) {
  const [open, setOpen] = useS(false);
  const [pos, setPos] = useS({
    top: 0,
    left: 0
  });
  const ref = useR();
  const btnRef = useR();
  useE(() => {
    const close = e => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useE(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const r = btnRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + 6,
        left: r.left
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);
  const current = folders.find(f => f.id === value);
  return React.createElement("div", {
    className: "lang-select-wrap",
    ref: ref
  }, React.createElement("button", {
    ref: btnRef,
    className: "lang-select-btn",
    onClick: () => setOpen(v => !v),
    type: "button"
  }, React.createElement(Icon, {
    name: current?.icon || "folder",
    size: 13
  }), React.createElement("span", {
    className: "lang-select-label"
  }, current?.name || "Kein Ordner"), React.createElement(Icon, {
    name: "chevron-down",
    size: 10
  })), open && React.createElement("div", {
    className: "lang-select-menu",
    style: {
      position: "fixed",
      top: pos.top,
      left: pos.left,
      minWidth: 200
    }
  }, React.createElement("div", {
    className: "lang-select-items"
  }, folders.map(f => React.createElement("button", {
    key: f.id,
    className: "lang-select-item " + (f.id === value ? "active" : ""),
    onClick: () => {
      onChange(f.id);
      setOpen(false);
    },
    type: "button"
  }, React.createElement(Icon, {
    name: f.icon || "folder",
    size: 13
  }), React.createElement("span", null, f.name), f.id === value && React.createElement(Icon, {
    name: "check",
    size: 11,
    style: {
      marginLeft: "auto",
      color: "var(--accent)"
    }
  }))))));
}
function TimelineView({
  notes,
  folders,
  onSelectNote,
  onUpdateNote
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const DAY = 24 * 60 * 60 * 1000;
  const PX_PER_DAY = 14;
  const PAST_DAYS = 60;
  const FUTURE_DAYS = 120;
  const totalDays = PAST_DAYS + FUTURE_DAYS;
  const start = new Date(today.getTime() - PAST_DAYS * DAY);
  const xForDate = iso => {
    if (!iso) return null;
    const d = new Date(iso);
    const days = Math.floor((d.getTime() - start.getTime()) / DAY);
    return days * PX_PER_DAY;
  };
  const dueNotes = notes.filter(n => {
    if (!n.dueAt) return false;
    const t = new Date(n.dueAt).getTime();
    return t >= start.getTime() && t < start.getTime() + totalDays * DAY;
  });
  const folderById = Object.fromEntries(folders.map(f => [f.id, f]));
  const rootOf = folderId => {
    let cur = folderById[folderId];
    while (cur && cur.parentId) cur = folderById[cur.parentId];
    return cur;
  };
  const rowMap = new Map();
  dueNotes.forEach(n => {
    const root = rootOf(n.folderId);
    const key = root?.id || "__orphan";
    if (!rowMap.has(key)) {
      rowMap.set(key, {
        id: key,
        name: root?.name || "Ohne Ordner",
        icon: root?.icon || "inbox",
        notes: []
      });
    }
    rowMap.get(key).notes.push(n);
  });
  const rows = [...rowMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const months = [];
  let monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (monthCursor.getTime() < start.getTime() + totalDays * DAY) {
    const x = Math.floor((monthCursor.getTime() - start.getTime()) / DAY) * PX_PER_DAY;
    months.push({
      x,
      label: monthCursor.toLocaleDateString("de-DE", {
        month: "short",
        year: "2-digit"
      })
    });
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
  }
  const todayX = PAST_DAYS * PX_PER_DAY;
  const fullWidth = totalDays * PX_PER_DAY;
  return React.createElement("section", {
    className: "timeline-view"
  }, React.createElement("div", {
    className: "timeline-head"
  }, React.createElement("div", null, React.createElement("h1", null, "Timeline"), React.createElement("div", {
    className: "timeline-sub"
  }, "F\xE4lligkeiten der n\xE4chsten ", FUTURE_DAYS, " Tage \xB7 ", dueNotes.length, " Termin", dueNotes.length !== 1 ? "e" : ""))), dueNotes.length === 0 ? React.createElement("div", {
    className: "timeline-empty"
  }, React.createElement(Icon, {
    name: "calendar",
    size: 36
  }), React.createElement("div", {
    style: {
      marginTop: 12,
      fontWeight: 500
    }
  }, "Keine Termine"), React.createElement("div", {
    style: {
      marginTop: 4,
      color: "var(--text-subtle)"
    }
  }, "Setze ein F\xE4lligkeitsdatum auf Notizen, um sie hier zu sehen.")) : React.createElement("div", {
    className: "timeline-scroll"
  }, React.createElement("div", {
    className: "timeline-months",
    style: {
      width: fullWidth
    }
  }, months.map((m, i) => React.createElement("div", {
    key: i,
    className: "timeline-month",
    style: {
      left: m.x
    }
  }, m.label)), React.createElement("div", {
    className: "timeline-today-line",
    style: {
      left: todayX
    },
    title: "Heute"
  }), React.createElement("div", {
    className: "timeline-today-label",
    style: {
      left: todayX
    }
  }, "Heute")), React.createElement("div", {
    className: "timeline-rows",
    style: {
      width: fullWidth
    }
  }, rows.map(row => React.createElement("div", {
    key: row.id,
    className: "timeline-row"
  }, React.createElement("div", {
    className: "timeline-row-label"
  }, React.createElement(Icon, {
    name: row.icon,
    size: 12
  }), React.createElement("span", null, row.name)), React.createElement("div", {
    className: "timeline-row-track"
  }, Array.from({
    length: Math.floor(totalDays / 7)
  }).map((_, i) => React.createElement("div", {
    key: i,
    className: "timeline-week-stripe",
    style: {
      left: i * 7 * PX_PER_DAY,
      width: 7 * PX_PER_DAY
    }
  })), React.createElement("div", {
    className: "timeline-today-line",
    style: {
      left: todayX
    }
  }), row.notes.map(n => {
    const x = xForDate(n.dueAt);
    const ms = new Date(n.dueAt).getTime() - Date.now();
    const overdue = ms < 0;
    const soon = !overdue && ms < 3 * 24 * 60 * 60 * 1000;
    return React.createElement("button", {
      key: n.id,
      className: "timeline-pill" + (overdue ? " overdue" : soon ? " soon" : ""),
      style: {
        left: x
      },
      onClick: () => onSelectNote(n.id),
      title: `${n.title || "Ohne Titel"} · ${new Date(n.dueAt).toLocaleDateString("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
      })}`
    }, React.createElement(Icon, {
      name: n.icon || (n.type === "it" ? "terminal" : "doc"),
      size: 11
    }), React.createElement("span", null, n.title || "Ohne Titel"));
  })))))));
}
function KanbanView({
  notes,
  folders,
  onSelectNote,
  onUpdateNote
}) {
  const [folderFilter, setFolderFilter] = useS("all");
  const [dragId, setDragId] = useS(null);
  const COLUMNS = [{
    key: "neutral",
    label: "Offen",
    cls: "neutral"
  }, {
    key: "warning",
    label: "In Arbeit",
    cls: "warning"
  }, {
    key: "error",
    label: "Blockiert",
    cls: "danger"
  }, {
    key: "success",
    label: "Erledigt",
    cls: "success"
  }];
  const getStatus = n => n.kanban || "neutral";
  const setStatus = (n, value) => {
    onUpdateNote({
      ...n,
      kanban: value,
      updatedAt: nowIso()
    });
  };
  let visible = notes;
  if (folderFilter !== "all") {
    const ids = new Set([folderFilter]);
    let added = true;
    while (added) {
      added = false;
      folders.forEach(f => {
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          added = true;
        }
      });
    }
    visible = notes.filter(n => ids.has(n.folderId));
  }
  const byCol = {};
  COLUMNS.forEach(c => byCol[c.key] = []);
  visible.forEach(n => {
    const s = getStatus(n);
    (byCol[s] || byCol.neutral).push(n);
  });
  const rootFolders = folders.filter(f => !f.parentId);
  return React.createElement("section", {
    className: "kanban-view"
  }, React.createElement("div", {
    className: "kanban-head"
  }, React.createElement("div", null, React.createElement("h1", null, "Kanban-Board"), React.createElement("div", {
    className: "kanban-sub"
  }, "Karten zwischen Spalten ziehen, um den Status zu \xE4ndern \xB7 Klick \xF6ffnet die Notiz")), React.createElement(window.StyledSelect, {
    value: folderFilter,
    onChange: setFolderFilter,
    minWidth: 220,
    options: [{
      value: "all",
      label: "Alle Ordner"
    }, ...rootFolders.flatMap(f => {
      const subs = folders.filter(s => s.parentId === f.id);
      return [{
        value: f.id,
        label: f.name
      }, ...subs.map(s => ({
        value: s.id,
        label: "— " + s.name
      }))];
    })]
  })), React.createElement("div", {
    className: "kanban-board"
  }, COLUMNS.map(col => React.createElement("div", {
    key: col.key,
    className: "kanban-col kanban-col-" + col.cls,
    onDragOver: e => {
      e.preventDefault();
      e.currentTarget.classList.add("drag-over");
    },
    onDragLeave: e => e.currentTarget.classList.remove("drag-over"),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove("drag-over");
      if (!dragId) return;
      const n = notes.find(x => x.id === dragId);
      if (n && getStatus(n) !== col.key) setStatus(n, col.key);
      setDragId(null);
    }
  }, React.createElement("div", {
    className: "kanban-col-head"
  }, React.createElement("span", {
    className: "status-dot " + (col.cls || "neutral")
  }), React.createElement("span", {
    className: "kanban-col-label"
  }, col.label), React.createElement("span", {
    className: "kanban-col-count"
  }, byCol[col.key].length)), React.createElement("div", {
    className: "kanban-col-cards"
  }, byCol[col.key].length === 0 ? React.createElement("div", {
    className: "kanban-col-empty"
  }, "Keine Notizen") : byCol[col.key].map(n => React.createElement("div", {
    key: n.id,
    className: "kanban-card" + (dragId === n.id ? " dragging" : ""),
    draggable: true,
    onDragStart: () => setDragId(n.id),
    onDragEnd: () => setDragId(null),
    onClick: () => onSelectNote(n.id),
    role: "button",
    tabIndex: 0
  }, React.createElement("div", {
    className: "kanban-card-title"
  }, React.createElement(Icon, {
    name: n.icon || (n.type === "it" ? "terminal" : "doc"),
    size: 13
  }), React.createElement("span", null, n.title || "Ohne Titel")), React.createElement("div", {
    className: "kanban-card-meta"
  }, n.tags?.length > 0 && React.createElement("span", {
    className: "kanban-card-tags"
  }, n.tags.slice(0, 3).map(t => "#" + t).join(" ")), n.dueAt && (() => {
    const ms = new Date(n.dueAt).getTime() - Date.now();
    const overdue = ms < 0;
    const soon = !overdue && ms < 3 * 24 * 60 * 60 * 1000;
    return React.createElement("span", {
      className: "kanban-card-due " + (overdue ? "overdue" : soon ? "soon" : "")
    }, React.createElement(Icon, {
      name: "flag",
      size: 10
    }), new Date(n.dueAt).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short"
    }));
  })()))))))));
}
function ActivityHeatmap({
  notes
}) {
  const dayKey = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const counts = {};
  (notes || []).forEach(n => {
    [n.createdAt, n.updatedAt].forEach(iso => {
      if (!iso) return;
      const k = dayKey(new Date(iso));
      counts[k] = (counts[k] || 0) + 1;
    });
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayWeekday = (today.getDay() + 6) % 7;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - todayWeekday);
  const startMonday = new Date(thisMonday);
  startMonday.setDate(thisMonday.getDate() - 7 * 11);
  const weeks = [];
  for (let w = 0; w < 12; w++) {
    const days = [];
    for (let dRow = 0; dRow < 7; dRow++) {
      const d = new Date(startMonday);
      d.setDate(startMonday.getDate() + w * 7 + dRow);
      const future = d > today;
      const k = dayKey(d);
      const c = counts[k] || 0;
      days.push({
        date: d,
        key: k,
        count: c,
        future
      });
    }
    weeks.push(days);
  }
  const level = c => {
    if (c === 0) return 0;
    if (c <= 2) return 1;
    if (c <= 5) return 2;
    if (c <= 10) return 3;
    return 4;
  };
  const totalThisYear = Object.entries(counts).filter(([k]) => k.startsWith(String(today.getFullYear()))).reduce((a, [, v]) => a + v, 0);
  const activeDays = Object.values(counts).filter(c => c > 0).length;
  const labels = ["Mo", "", "Mi", "", "Fr", "", "So"];
  const monthLabel = d => d.toLocaleDateString("de-DE", {
    month: "short"
  });
  const monthLabels = weeks.map((wk, i) => {
    const first = wk[0].date;
    if (i === 0) return monthLabel(first);
    const prev = weeks[i - 1][0].date;
    return first.getMonth() !== prev.getMonth() ? monthLabel(first) : "";
  });
  return React.createElement("section", {
    className: "heatmap"
  }, React.createElement("div", {
    className: "heatmap-head"
  }, React.createElement("h2", null, React.createElement(Icon, {
    name: "zap",
    size: 14
  }), " Aktivit\xE4t"), React.createElement("div", {
    className: "heatmap-stats"
  }, React.createElement("span", null, React.createElement("b", null, activeDays), " aktive Tag", activeDays !== 1 ? "e" : ""), React.createElement("span", {
    className: "dot-sep"
  }), React.createElement("span", null, React.createElement("b", null, totalThisYear), " Aktivit\xE4ten ", today.getFullYear()))), React.createElement("div", {
    className: "heatmap-grid"
  }, React.createElement("div", {
    className: "heatmap-rowlabels"
  }, labels.map((l, i) => React.createElement("div", {
    key: i,
    className: "heatmap-rowlabel"
  }, l))), React.createElement("div", {
    className: "heatmap-cols"
  }, React.createElement("div", {
    className: "heatmap-monthrow"
  }, monthLabels.map((m, i) => React.createElement("div", {
    key: i,
    className: "heatmap-monthlabel"
  }, m))), React.createElement("div", {
    className: "heatmap-weeks"
  }, weeks.map((wk, wi) => React.createElement("div", {
    key: wi,
    className: "heatmap-week"
  }, wk.map((d, di) => React.createElement("div", {
    key: di,
    className: "heatmap-cell" + (d.future ? " future" : "") + " lv-" + level(d.count),
    title: d.future ? "" : `${d.date.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "short"
    })} · ${d.count} Aktivität${d.count !== 1 ? "en" : ""}`
  })))))), React.createElement("div", {
    className: "heatmap-legend"
  }, React.createElement("span", null, "weniger"), [0, 1, 2, 3, 4].map(l => React.createElement("div", {
    key: l,
    className: "heatmap-cell lv-" + l
  })), React.createElement("span", null, "mehr"))));
}
function Dashboard({
  folders,
  notes,
  templates,
  onSelectNote,
  onSelectFolder,
  onNewFromTemplate,
  onTogglePin
}) {
  const totalNotes = notes.length;
  const itCount = notes.filter(n => n.type === "it").length;
  const normalCount = notes.filter(n => n.type === "normal").length;
  const pinnedCount = notes.filter(n => n.pinned).length;
  const recent = [...notes].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 6);
  const pinned = notes.filter(n => n.pinned).slice(0, 6);
  const rootFolders = folders.filter(f => !f.parentId);
  const dueNotes = notes.filter(n => n.dueAt).sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || "")).slice(0, 6);
  const overdueCount = notes.filter(n => n.dueAt && new Date(n.dueAt).getTime() < Date.now()).length;
  const countDeep = folderId => {
    const ids = new Set([folderId]);
    let added = true;
    while (added) {
      added = false;
      folders.forEach(f => {
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          added = true;
        }
      });
    }
    return notes.filter(n => ids.has(n.folderId)).length;
  };
  return React.createElement("section", {
    className: "dashboard"
  }, React.createElement("div", {
    className: "dashboard-inner"
  }, React.createElement("header", {
    className: "dashboard-head"
  }, React.createElement("div", null, React.createElement("h1", null, "\xDCbersicht"), React.createElement("div", {
    className: "dashboard-sub"
  }, formatGreeting(), " \xB7 ", totalNotes, " Notiz", totalNotes !== 1 ? "en" : "", " gesamt"))), React.createElement("div", {
    className: "dashboard-stats"
  }, React.createElement("div", {
    className: "dashboard-stat"
  }, React.createElement("div", {
    className: "dashboard-stat-val"
  }, totalNotes), React.createElement("div", {
    className: "dashboard-stat-label"
  }, React.createElement(Icon, {
    name: "inbox",
    size: 11
  }), " Notizen")), React.createElement("div", {
    className: "dashboard-stat"
  }, React.createElement("div", {
    className: "dashboard-stat-val"
  }, itCount), React.createElement("div", {
    className: "dashboard-stat-label"
  }, React.createElement(Icon, {
    name: "terminal",
    size: 11
  }), " IT-Notizen")), React.createElement("div", {
    className: "dashboard-stat"
  }, React.createElement("div", {
    className: "dashboard-stat-val"
  }, normalCount), React.createElement("div", {
    className: "dashboard-stat-label"
  }, React.createElement(Icon, {
    name: "doc",
    size: 11
  }), " Normale")), React.createElement("div", {
    className: "dashboard-stat"
  }, React.createElement("div", {
    className: "dashboard-stat-val"
  }, pinnedCount), React.createElement("div", {
    className: "dashboard-stat-label"
  }, React.createElement(Icon, {
    name: "star-fill",
    size: 11
  }), " Favoriten")), React.createElement("div", {
    className: "dashboard-stat"
  }, React.createElement("div", {
    className: "dashboard-stat-val"
  }, folders.length), React.createElement("div", {
    className: "dashboard-stat-label"
  }, React.createElement(Icon, {
    name: "folder",
    size: 11
  }), " Ordner"))), React.createElement(ActivityHeatmap, {
    notes: notes
  }), React.createElement("div", {
    className: "dashboard-grid"
  }, React.createElement("section", {
    className: "dashboard-card"
  }, React.createElement("div", {
    className: "dashboard-card-head"
  }, React.createElement("h2", null, React.createElement(Icon, {
    name: "clock",
    size: 14
  }), " Zuletzt bearbeitet"), React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => onSelectFolder("all")
  }, "Alle anzeigen")), React.createElement("div", {
    className: "dashboard-list"
  }, recent.length === 0 ? React.createElement("div", {
    className: "dashboard-empty"
  }, "Noch keine Notizen.") : recent.map(n => React.createElement("div", {
    key: n.id,
    className: "dashboard-note",
    onClick: () => onSelectNote(n.id),
    role: "button",
    tabIndex: 0
  }, React.createElement(Icon, {
    name: n.icon || (n.type === "it" ? "terminal" : "doc"),
    size: 14,
    style: {
      color: "var(--text-muted)",
      flexShrink: 0
    }
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "dashboard-note-title"
  }, n.title || "Ohne Titel"), React.createElement("div", {
    className: "dashboard-note-meta"
  }, React.createElement("span", null, formatRel(n.updatedAt)), n.tags?.length > 0 && React.createElement(React.Fragment, null, React.createElement("span", {
    className: "dot-sep"
  }), React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, n.tags.slice(0, 2).map(t => `#${t}`).join(" "))))), React.createElement("button", {
    className: "icon-btn",
    style: {
      width: 26,
      height: 26,
      opacity: n.pinned ? 1 : 0.4
    },
    onClick: e => {
      e.stopPropagation();
      onTogglePin(n.id);
    },
    title: n.pinned ? "Aus Favoriten" : "Zu Favoriten"
  }, React.createElement(Icon, {
    name: n.pinned ? "star-fill" : "star",
    size: 13,
    style: n.pinned ? {
      color: "var(--accent)"
    } : {}
  })))))), dueNotes.length > 0 && React.createElement("section", {
    className: "dashboard-card"
  }, React.createElement("div", {
    className: "dashboard-card-head"
  }, React.createElement("h2", null, React.createElement(Icon, {
    name: "flag",
    size: 14
  }), " F\xE4llig", overdueCount > 0 && React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 7px",
      borderRadius: 999,
      background: "var(--danger-soft)",
      color: "var(--danger)"
    }
  }, overdueCount, " \xFCberf\xE4llig"))), React.createElement("div", {
    className: "dashboard-list"
  }, dueNotes.map(n => {
    const ms = new Date(n.dueAt).getTime() - Date.now();
    const overdue = ms < 0;
    const soon = !overdue && ms < 3 * 24 * 60 * 60 * 1000;
    const dayStr = new Date(n.dueAt).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "short"
    });
    const cls = overdue ? "overdue" : soon ? "soon" : "";
    return React.createElement("div", {
      key: n.id,
      className: "dashboard-note",
      onClick: () => onSelectNote(n.id),
      role: "button",
      tabIndex: 0
    }, React.createElement(Icon, {
      name: "flag",
      size: 14,
      className: "note-due " + cls,
      style: {
        flexShrink: 0
      }
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "dashboard-note-title"
    }, n.title || "Ohne Titel"), React.createElement("div", {
      className: "dashboard-note-meta"
    }, React.createElement("span", {
      className: "note-due " + cls
    }, overdue ? "Überfällig seit " : "Fällig ", dayStr))));
  }))), React.createElement("section", {
    className: "dashboard-card"
  }, React.createElement("div", {
    className: "dashboard-card-head"
  }, React.createElement("h2", null, React.createElement(Icon, {
    name: "star-fill",
    size: 14
  }), " Favoriten"), pinnedCount > pinned.length && React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => onSelectFolder("pinned")
  }, "Alle (", pinnedCount, ")")), React.createElement("div", {
    className: "dashboard-list"
  }, pinned.length === 0 ? React.createElement("div", {
    className: "dashboard-empty"
  }, "Keine Favoriten. Mit dem Stern markieren.") : pinned.map(n => React.createElement("button", {
    key: n.id,
    className: "dashboard-note",
    onClick: () => onSelectNote(n.id)
  }, React.createElement(Icon, {
    name: n.icon || (n.type === "it" ? "terminal" : "doc"),
    size: 14,
    style: {
      color: "var(--accent)",
      flexShrink: 0
    }
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "dashboard-note-title"
  }, n.title || "Ohne Titel"), React.createElement("div", {
    className: "dashboard-note-meta"
  }, formatRel(n.updatedAt))))))), React.createElement("section", {
    className: "dashboard-card dashboard-folders"
  }, React.createElement("div", {
    className: "dashboard-card-head"
  }, React.createElement("h2", null, React.createElement(Icon, {
    name: "folder",
    size: 14
  }), " Ordner")), React.createElement("div", {
    className: "dashboard-folder-grid"
  }, rootFolders.map(f => {
    const direct = notes.filter(n => n.folderId === f.id).length;
    const total = countDeep(f.id);
    const subs = folders.filter(s => s.parentId === f.id);
    return React.createElement("button", {
      key: f.id,
      className: "dashboard-folder-card",
      onClick: () => onSelectFolder(f.id)
    }, React.createElement("div", {
      className: "dashboard-folder-icon"
    }, React.createElement(Icon, {
      name: f.icon || "folder",
      size: 18
    })), React.createElement("div", {
      className: "dashboard-folder-name"
    }, f.name), React.createElement("div", {
      className: "dashboard-folder-meta"
    }, React.createElement("b", null, total), " Notiz", total !== 1 ? "en" : "", subs.length > 0 && React.createElement(React.Fragment, null, " \xB7 ", subs.length, " Unterordner")), subs.length > 0 && React.createElement("div", {
      className: "dashboard-folder-subs"
    }, subs.slice(0, 4).map(s => React.createElement("span", {
      key: s.id,
      className: "dashboard-folder-sub",
      onClick: e => {
        e.stopPropagation();
        onSelectFolder(s.id);
      }
    }, React.createElement(Icon, {
      name: s.icon || "folder",
      size: 10
    }), s.name)), subs.length > 4 && React.createElement("span", {
      className: "dashboard-folder-sub muted"
    }, "+", subs.length - 4)));
  }))), React.createElement("section", {
    className: "dashboard-card"
  }, React.createElement("div", {
    className: "dashboard-card-head"
  }, React.createElement("h2", null, React.createElement(Icon, {
    name: "plus",
    size: 14
  }), " Schnell anfangen")), React.createElement("div", {
    className: "dashboard-templates"
  }, templates.slice(0, 6).map(t => React.createElement("button", {
    key: t.id,
    className: "dashboard-template",
    onClick: () => onNewFromTemplate(t.id)
  }, React.createElement(Icon, {
    name: t.icon || "doc",
    size: 16
  }), React.createElement("span", null, t.name))))))));
}
function formatGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Hallo";
  return "Guten Abend";
}
function TrashView({
  trash,
  folders,
  onRestoreBatch,
  onPurgeBatch,
  onEmpty
}) {
  const batches = {};
  (trash || []).forEach(e => {
    if (!batches[e.batchId]) batches[e.batchId] = {
      batchId: e.batchId,
      deletedAt: e.deletedAt,
      entries: []
    };
    batches[e.batchId].entries.push(e);
    if (e.deletedAt > batches[e.batchId].deletedAt) batches[e.batchId].deletedAt = e.deletedAt;
  });
  const sortedBatches = Object.values(batches).sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""));
  const daysLeft = iso => {
    const ms = new Date(iso).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  };
  return React.createElement("section", {
    className: "trash-view"
  }, React.createElement("div", {
    className: "trash-head"
  }, React.createElement("div", null, React.createElement("h1", null, "Papierkorb"), React.createElement("div", {
    className: "trash-sub"
  }, sortedBatches.length === 0 ? "Leer — gelöschte Elemente landen hier." : React.createElement(React.Fragment, null, "Gel\xF6schte Elemente werden nach ", React.createElement("b", null, "30 Tagen"), " automatisch endg\xFCltig entfernt."))), sortedBatches.length > 0 && React.createElement("button", {
    className: "btn danger",
    onClick: onEmpty,
    style: {
      background: "var(--danger)",
      color: "white",
      borderColor: "var(--danger)"
    }
  }, React.createElement(Icon, {
    name: "trash",
    size: 13
  }), " Leeren")), sortedBatches.length === 0 ? React.createElement("div", {
    className: "trash-empty"
  }, React.createElement(Icon, {
    name: "trash",
    size: 36
  }), React.createElement("div", {
    style: {
      marginTop: 10,
      fontWeight: 500
    }
  }, "Papierkorb ist leer"), React.createElement("div", {
    style: {
      marginTop: 4,
      color: "var(--text-subtle)"
    }
  }, "Hier siehst du alles, was du in den letzten 30 Tagen gel\xF6scht hast.")) : React.createElement("div", {
    className: "trash-list"
  }, sortedBatches.map(b => {
    const noteEntries = b.entries.filter(e => e.kind === "note");
    const folderEntries = b.entries.filter(e => e.kind === "folder");
    const primaryFolder = folderEntries[0]?.folder;
    const primaryNote = noteEntries[0]?.note;
    const isFolderBatch = !!primaryFolder;
    const title = isFolderBatch ? primaryFolder.name || "Ordner" : primaryNote.title || "Ohne Titel";
    const icon = isFolderBatch ? primaryFolder.icon || "folder" : primaryNote.icon || (primaryNote.type === "it" ? "terminal" : "doc");
    const extra = [];
    if (folderEntries.length > 1) extra.push(`${folderEntries.length - 1} Unterordner`);
    if (isFolderBatch && noteEntries.length > 0) extra.push(`${noteEntries.length} Notiz${noteEntries.length !== 1 ? "en" : ""}`);
    return React.createElement("div", {
      key: b.batchId,
      className: "trash-card"
    }, React.createElement("div", {
      className: "trash-card-main"
    }, React.createElement("div", {
      className: "trash-card-icon"
    }, React.createElement(Icon, {
      name: icon,
      size: 18
    })), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "trash-card-title"
    }, title), React.createElement("div", {
      className: "trash-card-meta"
    }, React.createElement("span", {
      className: "trash-card-kind"
    }, isFolderBatch ? "Ordner" : primaryNote.type === "it" ? "IT-Notiz" : "Notiz"), extra.length > 0 && React.createElement(React.Fragment, null, React.createElement("span", {
      className: "dot-sep"
    }), React.createElement("span", null, extra.join(" + "))), React.createElement("span", {
      className: "dot-sep"
    }), React.createElement("span", null, "gel\xF6scht ", formatRel(b.deletedAt)), React.createElement("span", {
      className: "dot-sep"
    }), React.createElement("span", {
      className: "trash-card-countdown"
    }, "noch ", daysLeft(b.deletedAt), " Tag", daysLeft(b.deletedAt) !== 1 ? "e" : ""))), React.createElement("div", {
      className: "trash-card-actions"
    }, React.createElement("button", {
      className: "btn sm",
      onClick: () => onRestoreBatch(b.batchId),
      title: "Wiederherstellen"
    }, React.createElement(Icon, {
      name: "undo",
      size: 12
    }), " Wiederherstellen"), React.createElement("button", {
      className: "icon-btn",
      title: "Endg\xFCltig l\xF6schen",
      onClick: () => onPurgeBatch?.(b)
    }, React.createElement(Icon, {
      name: "trash",
      size: 13
    })))));
  })));
}
function EditorEmpty({
  onNewNote
}) {
  return React.createElement("div", {
    className: "editor-empty"
  }, React.createElement("div", {
    className: "empty-mark"
  }, React.createElement(Icon, {
    name: "doc",
    size: 32
  })), React.createElement("div", null, React.createElement("h2", null, "W\xE4hle eine Notiz aus"), React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, "Oder erstelle eine neue Notiz, um zu starten.")), React.createElement("div", {
    className: "actions"
  }, React.createElement("button", {
    className: "btn accent",
    onClick: () => onNewNote("it")
  }, React.createElement(Icon, {
    name: "terminal",
    size: 14
  }), " IT-Notiz"), React.createElement("button", {
    className: "btn",
    onClick: () => onNewNote("normal")
  }, React.createElement(Icon, {
    name: "doc",
    size: 14
  }), " Normale Notiz")));
}
function TemplatesModal({
  templates,
  onRename,
  onDelete,
  onChangeIcon,
  onClose
}) {
  return React.createElement("div", {
    className: "modal-backdrop",
    onClick: onClose
  }, React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 560
    }
  }, React.createElement("h3", null, "Templates verwalten"), React.createElement("div", {
    style: {
      color: "var(--text-muted)",
      fontSize: 13,
      marginBottom: 14
    }
  }, "Alle Templates lassen sich umbenennen, das Icon \xE4ndern oder l\xF6schen."), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      maxHeight: 440,
      overflow: "visible"
    }
  }, templates.length === 0 ? React.createElement("div", {
    style: {
      padding: 22,
      textAlign: "center",
      color: "var(--text-subtle)",
      fontSize: 13,
      background: "var(--surface-2)",
      borderRadius: "var(--radius)"
    }
  }, "Keine Templates vorhanden. Speichere eine Notiz \xFCber das \u22EF-Men\xFC als Template.") : templates.map(t => React.createElement(TemplateRow, {
    key: t.id,
    template: t,
    onRename: name => onRename(t.id, name),
    onDelete: () => onDelete(t.id),
    onChangeIcon: icon => onChangeIcon(t.id, icon)
  }))), React.createElement("div", {
    className: "actions"
  }, React.createElement("button", {
    className: "btn",
    onClick: onClose
  }, "Schlie\xDFen"))));
}
function TemplateRow({
  template,
  onRename,
  onDelete,
  onChangeIcon
}) {
  const [editing, setEditing] = useS(false);
  const [name, setName] = useS(template.name);
  const submit = () => {
    if (name.trim() && name !== template.name) onRename(name.trim());
    setEditing(false);
  };
  return React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 10px",
      background: "var(--surface-2)",
      borderRadius: "var(--radius-sm)"
    }
  }, React.createElement(window.IconPicker, {
    value: template.icon || "doc",
    onChange: icon => onChangeIcon(icon),
    size: 32
  }), editing ? React.createElement("input", {
    autoFocus: true,
    className: "field-input",
    style: {
      flex: 1,
      padding: "6px 8px"
    },
    value: name,
    onChange: e => setName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") submit();
      if (e.key === "Escape") {
        setName(template.name);
        setEditing(false);
      }
    },
    onBlur: submit
  }) : React.createElement("div", {
    style: {
      flex: 1,
      fontWeight: 500,
      fontSize: 14,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, template.name), React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-subtle)"
    }
  }, (template.blocks || []).length, " Bl\xF6cke"), React.createElement("button", {
    className: "icon-btn",
    onClick: () => setEditing(true),
    title: "Umbenennen"
  }, React.createElement(Icon, {
    name: "edit",
    size: 13
  })), React.createElement("button", {
    className: "icon-btn",
    onClick: () => onDelete(),
    title: "L\xF6schen"
  }, React.createElement(Icon, {
    name: "trash",
    size: 13
  })));
}
function SaveTemplatePrompt({
  defaultName,
  onCancel,
  onConfirm
}) {
  const [name, setName] = useS(defaultName || "");
  return React.createElement("div", {
    className: "modal-backdrop",
    onClick: onCancel
  }, React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("h3", null, "Als Template speichern"), React.createElement("div", {
    style: {
      color: "var(--text-muted)",
      fontSize: 13,
      marginBottom: 12
    }
  }, "Die Struktur dieser Notiz wird als wiederverwendbares Template gespeichert. Inhalte werden geleert, das Ger\xFCst bleibt."), React.createElement("input", {
    autoFocus: true,
    className: "field-input",
    placeholder: "Template-Name\u2026",
    value: name,
    onChange: e => setName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
    }
  }), React.createElement("div", {
    className: "actions"
  }, React.createElement("button", {
    className: "btn",
    onClick: onCancel
  }, "Abbrechen"), React.createElement("button", {
    className: "btn accent",
    onClick: () => onConfirm(name.trim()),
    disabled: !name.trim()
  }, React.createElement(Icon, {
    name: "bookmark",
    size: 13
  }), " Speichern"))));
}
function HermesProjectPrompt({
  onCancel,
  onConfirm
}) {
  const [name, setName] = useS("");
  const catalog = window.HERMES_CATALOG || {
    phases: [],
    docs: []
  };
  const [selected, setSelected] = useS(() => new Set(catalog.docs.map(d => d.id)));
  const valid = name.trim().length > 0 && selected.size > 0;
  const toggle = id => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);else next.add(id);
    setSelected(next);
  };
  const togglePhase = phaseKey => {
    const ids = catalog.docs.filter(d => d.phase === phaseKey).map(d => d.id);
    const allOn = ids.every(id => selected.has(id));
    const next = new Set(selected);
    if (allOn) ids.forEach(id => next.delete(id));else ids.forEach(id => next.add(id));
    setSelected(next);
  };
  const selectAll = () => setSelected(new Set(catalog.docs.map(d => d.id)));
  const selectNone = () => setSelected(new Set());
  const selectRecommended = () => {
    const rec = new Set(["02", "03", "04", "05", "06", "10", "18", "20"]);
    setSelected(rec);
  };
  return React.createElement("div", {
    className: "modal-backdrop",
    onClick: onCancel
  }, React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 640
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 4
    }
  }, React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 10,
      background: "var(--accent-soft)",
      color: "var(--accent-text)",
      display: "grid",
      placeItems: "center",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.08em"
    }
  }, "HERMES"), React.createElement("div", null, React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "Neues HERMES-Projekt"), React.createElement("div", {
    style: {
      color: "var(--text-muted)",
      fontSize: 12,
      marginTop: 2
    }
  }, "Projektname festlegen und Vorlagen ausw\xE4hlen"))), React.createElement("label", {
    className: "field-label",
    style: {
      marginTop: 16,
      marginBottom: 6
    }
  }, "Projektname"), React.createElement("input", {
    autoFocus: true,
    className: "field-input",
    placeholder: "z. B. Fachanwendung XY 2026",
    value: name,
    onChange: e => setName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && valid) onConfirm(name.trim(), [...selected]);
    }
  }), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 18,
      marginBottom: 8
    }
  }, React.createElement("label", {
    className: "field-label",
    style: {
      margin: 0
    }
  }, "Vorlagen ", React.createElement("span", {
    style: {
      color: "var(--text-muted)",
      fontWeight: 400,
      textTransform: "none",
      letterSpacing: 0,
      marginLeft: 4
    }
  }, "\xB7 ", selected.size, "/", catalog.docs.length, " gew\xE4hlt")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 4
    }
  }, React.createElement("button", {
    type: "button",
    className: "btn sm ghost",
    onClick: selectRecommended,
    title: "Schlanker Starter-Set (8 Dokumente)"
  }, React.createElement(Icon, {
    name: "star",
    size: 11
  }), " Empfohlen"), React.createElement("button", {
    type: "button",
    className: "btn sm ghost",
    onClick: selectAll
  }, "Alle"), React.createElement("button", {
    type: "button",
    className: "btn sm ghost",
    onClick: selectNone
  }, "Keine"))), React.createElement("div", {
    style: {
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      background: "var(--surface-2)",
      maxHeight: 360,
      overflowY: "auto",
      padding: 4
    }
  }, catalog.phases.map(ph => {
    const docs = catalog.docs.filter(d => d.phase === ph.key);
    if (docs.length === 0) return null;
    const onCount = docs.filter(d => selected.has(d.id)).length;
    const allOn = onCount === docs.length;
    const noneOn = onCount === 0;
    return React.createElement("div", {
      key: ph.key,
      style: {
        marginBottom: 4
      }
    }, React.createElement("button", {
      type: "button",
      onClick: () => togglePhase(ph.key),
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: "var(--text-muted)",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        borderRadius: 6
      },
      onMouseEnter: e => e.currentTarget.style.background = "var(--surface)",
      onMouseLeave: e => e.currentTarget.style.background = "transparent",
      title: allOn ? "Alle in dieser Phase abwählen" : "Alle in dieser Phase auswählen"
    }, React.createElement(Icon, {
      name: ph.icon,
      size: 12
    }), React.createElement("span", {
      style: {
        flex: 1,
        textAlign: "left"
      }
    }, ph.name), React.createElement("span", {
      style: {
        fontSize: 10,
        color: allOn ? "var(--accent)" : noneOn ? "var(--text-subtle)" : "var(--text-muted)",
        fontWeight: 500,
        letterSpacing: 0
      }
    }, onCount, "/", docs.length)), React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 1,
        padding: "0 4px 4px"
      }
    }, docs.map(d => {
      const on = selected.has(d.id);
      return React.createElement("label", {
        key: d.id,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 6,
          background: on ? "var(--surface)" : "transparent",
          cursor: "pointer",
          fontSize: 13,
          border: "1px solid " + (on ? "var(--border)" : "transparent"),
          transition: "all 100ms"
        }
      }, React.createElement("span", {
        style: {
          position: "relative",
          width: 16,
          height: 16,
          borderRadius: 4,
          border: "1.5px solid " + (on ? "var(--accent)" : "var(--border-strong)"),
          background: on ? "var(--accent)" : "var(--surface)",
          flexShrink: 0,
          display: "inline-block",
          transition: "all 120ms"
        }
      }, React.createElement("input", {
        type: "checkbox",
        checked: on,
        onChange: () => toggle(d.id),
        style: {
          position: "absolute",
          inset: 0,
          opacity: 0,
          margin: 0,
          cursor: "pointer"
        }
      }), on && React.createElement("span", {
        style: {
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 8,
          height: 4,
          borderLeft: "2px solid white",
          borderBottom: "2px solid white",
          transform: "translate(-50%, -65%) rotate(-45deg)",
          pointerEvents: "none"
        }
      })), React.createElement(Icon, {
        name: d.icon || "doc",
        size: 13,
        style: {
          color: "var(--text-muted)",
          flexShrink: 0
        }
      }), React.createElement("span", {
        style: {
          flex: 1,
          color: on ? "var(--text)" : "var(--text-muted)"
        }
      }, d.title));
    })));
  })), React.createElement("div", {
    className: "actions"
  }, React.createElement("button", {
    className: "btn",
    onClick: onCancel
  }, "Abbrechen"), React.createElement("button", {
    className: "btn accent",
    disabled: !valid,
    onClick: () => onConfirm(name.trim(), [...selected])
  }, React.createElement(Icon, {
    name: "plus",
    size: 13
  }), " Projekt anlegen (", selected.size, ")"))));
}
function ExportModal({
  folders,
  notes,
  onCancel,
  onExport
}) {
  const [format, setFormat] = useS("json");
  const [selectedFolders, setSelectedFolders] = useS(() => new Set(folders.map(f => f.id)));
  const [selectedNotes, setSelectedNotes] = useS(new Set());
  const [search, setSearch] = useS("");
  const toggleFolder = id => {
    const next = new Set(selectedFolders);
    if (next.has(id)) next.delete(id);else next.add(id);
    setSelectedFolders(next);
  };
  const toggleNote = id => {
    const next = new Set(selectedNotes);
    if (next.has(id)) next.delete(id);else next.add(id);
    setSelectedNotes(next);
  };
  const selectAll = () => {
    setSelectedFolders(new Set(folders.map(f => f.id)));
    setSelectedNotes(new Set(notes.map(n => n.id)));
  };
  const deselectAll = () => {
    setSelectedFolders(new Set());
    setSelectedNotes(new Set());
  };
  const includedFolderIds = new Set();
  const collect = fid => {
    if (includedFolderIds.has(fid)) return;
    includedFolderIds.add(fid);
    folders.filter(f => f.parentId === fid).forEach(f => collect(f.id));
  };
  [...selectedFolders].forEach(collect);
  const willExport = notes.filter(n => selectedNotes.has(n.id) || includedFolderIds.has(n.folderId));
  const q = search.trim().toLowerCase();
  const filteredNotes = q ? notes.filter(n => (n.title || "").toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q))) : notes;
  const renderFolderTree = (parentId, depth) => {
    return folders.filter(f => (f.parentId || null) === parentId).map(f => {
      const folderNotes = notes.filter(n => n.folderId === f.id);
      const subCount = folders.filter(sf => sf.parentId === f.id).length;
      const matchesQ = !q || f.name.toLowerCase().includes(q) || folderNotes.some(n => (n.title || "").toLowerCase().includes(q));
      const childrenRendered = renderFolderTree(f.id, depth + 1);
      if (q && !matchesQ && childrenRendered.length === 0) return null;
      const visibleNotes = q ? folderNotes.filter(n => (n.title || "").toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q))) : folderNotes;
      const isImplicit = includedFolderIds.has(f.id) && !selectedFolders.has(f.id);
      return React.createElement(React.Fragment, {
        key: f.id
      }, React.createElement("label", {
        className: "export-row export-folder-row" + (isImplicit ? " implicit" : ""),
        style: {
          paddingLeft: 8 + depth * 18
        }
      }, React.createElement("input", {
        type: "checkbox",
        checked: selectedFolders.has(f.id) || isImplicit,
        disabled: isImplicit,
        onChange: () => toggleFolder(f.id)
      }), React.createElement(Icon, {
        name: f.icon || "folder",
        size: 14,
        style: {
          color: "var(--text-muted)"
        }
      }), React.createElement("span", {
        className: "export-row-name"
      }, React.createElement("b", null, f.name)), React.createElement("span", {
        className: "export-row-meta"
      }, folderNotes.length, " Notiz", folderNotes.length !== 1 ? "en" : "", subCount > 0 && ` · ${subCount} Unterordner`)), visibleNotes.map(n => {
        const inFolder = includedFolderIds.has(n.folderId);
        return React.createElement("label", {
          key: n.id,
          className: "export-row export-note-row" + (inFolder ? " implicit" : ""),
          style: {
            paddingLeft: 8 + (depth + 1) * 18 + 8
          },
          title: inFolder ? "Über Ordner inkludiert" : ""
        }, React.createElement("input", {
          type: "checkbox",
          checked: selectedNotes.has(n.id) || inFolder,
          disabled: inFolder,
          onChange: () => toggleNote(n.id)
        }), React.createElement(Icon, {
          name: n.icon || (n.type === "it" ? "terminal" : "doc"),
          size: 12,
          style: {
            color: "var(--text-subtle)"
          }
        }), React.createElement("span", {
          className: "export-row-name"
        }, n.title || "Ohne Titel"), n.tags?.length > 0 && React.createElement("span", {
          className: "export-row-meta"
        }, "#", n.tags.slice(0, 2).join(" #")));
      }), childrenRendered);
    }).filter(Boolean);
  };
  const orphanNotes = notes.filter(n => !folders.some(f => f.id === n.folderId));
  const visibleOrphans = q ? orphanNotes.filter(n => (n.title || "").toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q))) : orphanNotes;
  return React.createElement("div", {
    className: "modal-backdrop",
    onClick: onCancel
  }, React.createElement("div", {
    className: "modal export-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("h3", null, "Exportieren"), React.createElement("div", {
    style: {
      color: "var(--text-muted)",
      fontSize: 13,
      marginBottom: 14
    }
  }, "W\xE4hle Ordner und einzelne Notizen aus. Ein Ordner schlie\xDFt alle Unterordner und ihre Notizen automatisch mit ein."), React.createElement("div", {
    className: "export-format"
  }, React.createElement("button", {
    className: "export-format-opt " + (format === "json" ? "active" : ""),
    onClick: () => setFormat("json")
  }, React.createElement(Icon, {
    name: "package",
    size: 14
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, "JSON-Bundle"), React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-muted)"
    }
  }, "Komplett \u2014 Struktur, Tags, Bl\xF6cke. Re-importierbar."))), React.createElement("button", {
    className: "export-format-opt " + (format === "markdown" ? "active" : ""),
    onClick: () => setFormat("markdown")
  }, React.createElement(Icon, {
    name: "doc",
    size: 14
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, "Markdown"), React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-muted)"
    }
  }, "Nur Inhalt \u2014 lesbar \xFCberall, aber nicht re-importierbar.")))), React.createElement("div", {
    className: "export-tree-pane"
  }, React.createElement("div", {
    className: "export-pane-search"
  }, React.createElement(Icon, {
    name: "search",
    size: 12
  }), React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Ordner oder Notiz suchen\u2026"
  })), React.createElement("div", {
    className: "export-pane-list"
  }, folders.length === 0 && orphanNotes.length === 0 ? React.createElement("div", {
    className: "export-pane-empty"
  }, "Keine Notizen oder Ordner") : React.createElement(React.Fragment, null, renderFolderTree(null, 0), visibleOrphans.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "export-folder-row",
    style: {
      paddingLeft: 8,
      fontSize: 11,
      fontWeight: 600,
      color: "var(--text-subtle)",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      paddingTop: 8
    }
  }, "Ohne Ordner"), visibleOrphans.map(n => React.createElement("label", {
    key: n.id,
    className: "export-row export-note-row",
    style: {
      paddingLeft: 26
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: selectedNotes.has(n.id),
    onChange: () => toggleNote(n.id)
  }), React.createElement(Icon, {
    name: n.icon || (n.type === "it" ? "terminal" : "doc"),
    size: 12,
    style: {
      color: "var(--text-subtle)"
    }
  }), React.createElement("span", {
    className: "export-row-name"
  }, n.title || "Ohne Titel"))))))), React.createElement("div", {
    className: "export-summary"
  }, React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("b", null, willExport.length), " Notiz(en) werden exportiert"), React.createElement("button", {
    className: "btn sm ghost",
    onClick: selectAll
  }, "Alle"), React.createElement("button", {
    className: "btn sm ghost",
    onClick: deselectAll
  }, "Keine")), React.createElement("div", {
    className: "actions"
  }, React.createElement("button", {
    className: "btn",
    onClick: onCancel
  }, "Abbrechen"), React.createElement("button", {
    className: "btn accent",
    disabled: willExport.length === 0,
    onClick: () => onExport({
      noteIds: [...selectedNotes],
      folderIds: [...selectedFolders],
      format
    })
  }, React.createElement(Icon, {
    name: "download",
    size: 13
  }), " Exportieren (", willExport.length, ")"))));
}
function ImportModal({
  onCancel,
  onImport
}) {
  const [file, setFile] = useS(null);
  const [json, setJson] = useS(null);
  const [error, setError] = useS(null);
  const [mode, setMode] = useS("merge");
  const inputRef = useR();
  const readFile = f => {
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = e => {
      const txt = e.target.result;
      setJson(txt);
      try {
        const d = JSON.parse(txt);
        if (!d.folders || !d.notes) setError("Datei enthält keine Notizen/Ordner.");
      } catch {
        setError("Datei ist kein gültiges JSON.");
      }
    };
    reader.readAsText(f);
  };
  let stats = null;
  if (json && !error) {
    try {
      const d = JSON.parse(json);
      stats = {
        notes: d.notes?.length || 0,
        folders: d.folders?.length || 0,
        exportedAt: d.exportedAt
      };
    } catch {}
  }
  return React.createElement("div", {
    className: "modal-backdrop",
    onClick: onCancel
  }, React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 480
    }
  }, React.createElement("h3", null, "Importieren"), React.createElement("div", {
    style: {
      color: "var(--text-muted)",
      fontSize: 13,
      marginBottom: 14
    }
  }, "W\xE4hle eine JSON-Datei aus einem fr\xFCheren Export. Alle Ordner, Unterordner, Notizen, Tags und Bl\xF6cke werden wiederhergestellt."), !file ? React.createElement("div", {
    className: "import-drop",
    onClick: () => inputRef.current?.click(),
    onDragOver: e => {
      e.preventDefault();
      e.currentTarget.classList.add("dragover");
    },
    onDragLeave: e => e.currentTarget.classList.remove("dragover"),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove("dragover");
      readFile(e.dataTransfer.files?.[0]);
    }
  }, React.createElement(Icon, {
    name: "download",
    size: 28,
    style: {
      transform: "rotate(180deg)"
    }
  }), React.createElement("div", null, React.createElement("b", null, "JSON-Datei ablegen"), " oder klicken zum Ausw\xE4hlen"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--text-subtle)",
      marginTop: 4
    }
  }, "aus einem Notizen-Export"), React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: ".json,application/json",
    style: {
      display: "none"
    },
    onChange: e => readFile(e.target.files?.[0])
  })) : React.createElement("div", {
    className: "import-file"
  }, React.createElement(Icon, {
    name: "doc",
    size: 18
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 500
    }
  }, file.name), error ? React.createElement("div", {
    style: {
      color: "var(--danger)",
      fontSize: 12
    }
  }, error) : stats ? React.createElement("div", {
    style: {
      color: "var(--text-muted)",
      fontSize: 12
    }
  }, stats.notes, " Notiz(en), ", stats.folders, " Ordner", stats.exportedAt && ` · exportiert ${new Date(stats.exportedAt).toLocaleDateString("de-DE")}`) : null), React.createElement("button", {
    className: "icon-btn",
    onClick: () => {
      setFile(null);
      setJson(null);
      setError(null);
    }
  }, React.createElement(Icon, {
    name: "x",
    size: 14
  }))), file && !error && React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, React.createElement("div", {
    className: "field-label",
    style: {
      marginBottom: 6
    }
  }, "Modus"), React.createElement("div", {
    className: "seg",
    style: {
      width: "100%"
    }
  }, React.createElement("button", {
    className: mode === "merge" ? "active" : "",
    onClick: () => setMode("merge"),
    style: {
      flex: 1
    }
  }, "Hinzuf\xFCgen"), React.createElement("button", {
    className: mode === "replace" ? "active danger" : "",
    onClick: () => setMode("replace"),
    style: {
      flex: 1
    }
  }, "Alles ersetzen")), React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-subtle)",
      marginTop: 6
    }
  }, mode === "merge" ? "Neue IDs werden vergeben — Bestehendes bleibt erhalten." : "⚠ Aktuelle Ordner und Notizen werden komplett ersetzt.")), React.createElement("div", {
    className: "actions"
  }, React.createElement("button", {
    className: "btn",
    onClick: onCancel
  }, "Abbrechen"), React.createElement("button", {
    className: "btn accent",
    disabled: !json || error,
    onClick: () => onImport(json, {
      mode
    })
  }, React.createElement(Icon, {
    name: "package",
    size: 13
  }), " Importieren"))));
}
function FolderDeleteModal({
  name,
  impact,
  onCancel,
  onConfirm
}) {
  const [cascade, setCascade] = useS(true);
  const hasContents = (impact?.folders || 0) > 0 || (impact?.notes || 0) > 0;
  const parts = [];
  if (impact?.folders > 0) parts.push(`${impact.folders} Unterordner`);
  if (impact?.notes > 0) parts.push(`${impact.notes} Notiz${impact.notes !== 1 ? "en" : ""}`);
  return React.createElement("div", {
    className: "modal-backdrop",
    onClick: onCancel
  }, React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("h3", null, "Ordner l\xF6schen?"), React.createElement("div", {
    style: {
      color: "var(--text-muted)"
    }
  }, "Der Ordner \u201E", name || "", "\" wird gel\xF6scht."), hasContents && React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 16,
      padding: "12px 14px",
      background: cascade ? "var(--danger-soft)" : "var(--surface-2)",
      border: "1px solid " + (cascade ? "var(--danger-soft)" : "var(--border)"),
      borderRadius: "var(--radius)",
      cursor: "pointer",
      transition: "all 140ms"
    }
  }, React.createElement("span", {
    style: {
      position: "relative",
      width: 16,
      height: 16,
      borderRadius: 4,
      marginTop: 1,
      border: "1.5px solid " + (cascade ? "var(--danger)" : "var(--border-strong)"),
      background: cascade ? "var(--danger)" : "var(--surface)",
      flexShrink: 0,
      display: "inline-block",
      transition: "all 120ms"
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: cascade,
    onChange: e => setCascade(e.target.checked),
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      margin: 0,
      cursor: "pointer"
    }
  }), cascade && React.createElement("span", {
    style: {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: 8,
      height: 4,
      borderLeft: "2px solid white",
      borderBottom: "2px solid white",
      transform: "translate(-50%, -65%) rotate(-45deg)",
      pointerEvents: "none"
    }
  })), React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 13,
      lineHeight: 1.5
    }
  }, React.createElement("span", {
    style: {
      fontWeight: 600,
      color: cascade ? "var(--danger)" : "var(--text)"
    }
  }, "Inhalt ebenfalls l\xF6schen"), React.createElement("span", {
    style: {
      display: "block",
      color: "var(--text-muted)",
      marginTop: 2
    }
  }, cascade ? React.createElement(React.Fragment, null, "Auch ", parts.join(" und "), " werden unwiderruflich gel\xF6scht.") : React.createElement(React.Fragment, null, parts.join(" und "), " bleiben erhalten und werden in den \xFCbergeordneten Ordner verschoben.")))), React.createElement("div", {
    className: "actions"
  }, React.createElement("button", {
    className: "btn",
    onClick: onCancel
  }, "Abbrechen"), React.createElement("button", {
    className: "btn",
    onClick: () => onConfirm(cascade),
    style: {
      background: "var(--danger)",
      color: "white",
      borderColor: "var(--danger)"
    }
  }, React.createElement(Icon, {
    name: "trash",
    size: 13
  }), " L\xF6schen"))));
}
function ContextMenu({
  x,
  y,
  items,
  onClose
}) {
  const ref = useR();
  const [pos, setPos] = useS({
    x,
    y
  });
  useE(() => {
    const close = e => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  useE(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = x,
      ny = y;
    if (x + r.width > window.innerWidth - 8) nx = window.innerWidth - r.width - 8;
    if (y + r.height > window.innerHeight - 8) ny = window.innerHeight - r.height - 8;
    if (nx !== x || ny !== y) setPos({
      x: nx,
      y: ny
    });
  }, [x, y]);
  return React.createElement("div", {
    ref: ref,
    className: "context-menu",
    style: {
      position: "fixed",
      top: pos.y,
      left: pos.x,
      zIndex: 9999
    },
    onContextMenu: e => e.preventDefault()
  }, items.map((it, i) => {
    if (it.divider) return React.createElement("div", {
      key: "d" + i,
      className: "context-menu-divider"
    });
    if (it.heading) return React.createElement("div", {
      key: "h" + i,
      className: "context-menu-heading"
    }, it.heading);
    if (it.shapes) return React.createElement("div", {
      key: "sh" + i,
      className: "context-menu-shapes"
    }, it.shapes.map((s, j) => React.createElement("button", {
      key: j,
      className: "diagram-shape-swatch" + (s.active ? " active" : ""),
      onClick: () => {
        s.onClick?.();
        onClose();
      },
      title: s.label
    }, React.createElement("span", {
      className: "diagram-shape-mini shape-" + s.value
    }))));
    if (it.swatches) return React.createElement("div", {
      key: "sw" + i,
      className: "context-menu-swatches"
    }, it.swatches.map((s, j) => React.createElement("button", {
      key: j,
      className: "diagram-color-swatch color-" + (s.value || "default") + (s.active ? " active" : ""),
      onClick: () => {
        s.onClick?.();
        onClose();
      },
      title: s.label
    })));
    return React.createElement("button", {
      key: i,
      className: "context-menu-item" + (it.danger ? " danger" : ""),
      onClick: () => {
        it.onClick?.();
        onClose();
      },
      disabled: it.disabled
    }, it.icon && React.createElement(Icon, {
      name: it.icon,
      size: 13
    }), React.createElement("span", null, it.label), it.kbd && React.createElement("span", {
      className: "kbd"
    }, it.kbd));
  }));
}
function ConfirmModal({
  title,
  message,
  confirmLabel = "Löschen",
  danger = true,
  onCancel,
  onConfirm
}) {
  return React.createElement("div", {
    className: "modal-backdrop",
    onClick: onCancel
  }, React.createElement("div", {
    className: "modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("h3", null, title), React.createElement("div", {
    style: {
      color: "var(--text-muted)"
    }
  }, message), React.createElement("div", {
    className: "actions"
  }, React.createElement("button", {
    className: "btn",
    onClick: onCancel
  }, "Abbrechen"), React.createElement("button", {
    className: "btn",
    onClick: onConfirm,
    style: danger ? {
      background: "var(--danger)",
      color: "white",
      borderColor: "var(--danger)"
    } : {
      background: "var(--accent)",
      color: "white",
      borderColor: "var(--accent)"
    }
  }, confirmLabel))));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));