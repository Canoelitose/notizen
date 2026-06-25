const {
  useState,
  useRef,
  useEffect,
  useLayoutEffect
} = React;
function SaveStatus({
  status
}) {
  const map = {
    idle: {
      color: "var(--text-subtle)",
      label: "IT · Allgemein"
    },
    saving: {
      color: "var(--warn, #d08770)",
      label: "Speichert…"
    },
    saved: {
      color: "var(--ok, #8FBF7F)",
      label: "Gespeichert"
    },
    error: {
      color: "var(--danger, #e06c75)",
      label: "Speicherfehler"
    }
  };
  const s = map[status] || map.idle;
  return React.createElement("div", {
    className: "brand-sub",
    title: "Auto-Speichern",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: s.color,
      flexShrink: 0
    }
  }), React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, s.label));
}
function renderFolderTree(allFolders, parentId, depth, ctx) {
  const children = allFolders.filter(f => (f.parentId || null) === parentId);
  return children.map(f => React.createElement(FolderRow, {
    key: f.id,
    folder: f,
    depth: depth,
    active: ctx.selectedFolderId === f.id,
    count: ctx.counts[f.id] || 0,
    notes: ctx.notes.filter(n => n.folderId === f.id),
    selectedNoteId: ctx.selectedNoteId,
    onSelectNote: id => {
      ctx.onSelectNote(id);
      ctx.onMobileClose?.();
    },
    editing: ctx.editing === f.id,
    editName: ctx.editName,
    onEditNameChange: ctx.setEditName,
    onSelect: () => {
      ctx.onSelectFolder(f.id);
      ctx.onMobileClose?.();
    },
    onStartEdit: () => {
      ctx.setEditing(f.id);
      ctx.setEditName(f.name);
    },
    onSubmitEdit: () => ctx.submitEdit(f.id),
    onCancelEdit: () => ctx.setEditing(null),
    onChangeIcon: icon => ctx.onChangeFolderIcon?.(f.id, icon),
    onDelete: () => ctx.onDeleteFolder(f.id),
    onShowContextMenu: ctx.onShowContextMenu,
    onAddSub: name => ctx.onAddFolder(name, f.id),
    onAddNote: () => ctx.onNewNoteInFolder?.(f.id),
    onMoveNote: ctx.onMoveNote,
    onMoveFolder: ctx.onMoveFolder,
    childTree: renderFolderTree(allFolders, f.id, depth + 1, ctx)
  }));
}
function Sidebar({
  folders,
  notes,
  selectedFolderId,
  selectedNoteId,
  onSelectFolder,
  onSelectNote,
  onMoveNote,
  onMoveFolder,
  onAddFolder,
  onRenameFolder,
  onChangeFolderIcon,
  onDeleteFolder,
  onShowContextMenu,
  theme,
  themePref,
  systemTheme,
  onSetThemePref,
  onToggleTheme,
  onExport,
  onImport,
  onNewHermesProject,
  onOpenDailyNote,
  onOpenSearch,
  onNewNoteInFolder,
  smartFolders = [],
  trashCount = 0,
  onCollapse,
  onLogout,
  saveStatus = "idle",
  onMobileClose
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const counts = folders.reduce((acc, f) => {
    acc[f.id] = notes.filter(n => n.folderId === f.id).length;
    return acc;
  }, {});
  const allCount = notes.length;
  const pinnedCount = notes.filter(n => n.pinned).length;
  const submitAdd = () => {
    if (newName.trim()) onAddFolder(newName.trim());
    setNewName("");
    setAdding(false);
  };
  const submitEdit = id => {
    if (editName.trim()) onRenameFolder(id, editName.trim());
    setEditing(null);
  };
  return React.createElement("aside", {
    className: "sidebar"
  }, React.createElement("div", {
    className: "brand"
  }, React.createElement("div", {
    className: "brand-mark"
  }, "N"), React.createElement("div", null, React.createElement("div", {
    className: "brand-name"
  }, "Notizen"), React.createElement(SaveStatus, {
    status: saveStatus
  })), React.createElement(ThemePicker, {
    themePref: themePref,
    theme: theme,
    systemTheme: systemTheme,
    onChange: onSetThemePref,
    onToggle: onToggleTheme
  }), onCollapse && React.createElement("button", {
    className: "icon-btn sidebar-collapse-btn",
    onClick: onCollapse,
    title: "Sidebar einklappen"
  }, React.createElement(Icon, {
    name: "chevron-left",
    size: 14
  }))), onOpenSearch && React.createElement("button", {
    className: "sidebar-search-trigger",
    onClick: onOpenSearch,
    title: "Schnellsuche (Strg/Cmd + K)"
  }, React.createElement(Icon, {
    name: "search",
    size: 15
  }), React.createElement("span", null, "Suchen"), React.createElement("span", {
    className: "sidebar-search-kbd"
  }, "\u2318K")), React.createElement("div", {
    className: "section-label"
  }, "Sammlungen"), React.createElement("div", {
    className: "folder-list"
  }, React.createElement("button", {
    className: "folder-row " + (selectedFolderId === "dashboard" ? "active" : ""),
    onClick: () => {
      onSelectFolder("dashboard");
      onMobileClose?.();
    }
  }, React.createElement(Icon, {
    name: "home",
    className: "ico"
  }), React.createElement("span", null, "\xDCbersicht")), React.createElement("button", {
    className: "folder-row " + (selectedFolderId === "all" ? "active" : ""),
    onClick: () => {
      onSelectFolder("all");
      onMobileClose?.();
    },
    onDragOver: e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      e.currentTarget.classList.add("drop-over");
    },
    onDragLeave: e => e.currentTarget.classList.remove("drop-over"),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove("drop-over");
      let payload;
      try {
        payload = JSON.parse(e.dataTransfer.getData("application/x-note-tool") || "");
      } catch {
        const plain = e.dataTransfer.getData("text/plain");
        const m = /^(note|folder):(.+)$/.exec(plain);
        if (m) payload = {
          kind: m[1],
          id: m[2]
        };
      }
      if (!payload) return;
      if (payload.kind === "folder") onMoveFolder?.(payload.id, null);else if (payload.kind === "note") onMoveNote?.(payload.id, folders[0]?.id || null);
    }
  }, React.createElement(Icon, {
    name: "inbox",
    className: "ico"
  }), React.createElement("span", null, "Alle Notizen"), React.createElement("span", {
    className: "count"
  }, allCount)), React.createElement("button", {
    className: "folder-row " + (selectedFolderId === "pinned" ? "active" : ""),
    onClick: () => {
      onSelectFolder("pinned");
      onMobileClose?.();
    }
  }, React.createElement(Icon, {
    name: "star",
    className: "ico"
  }), React.createElement("span", null, "Favoriten"), React.createElement("span", {
    className: "count"
  }, pinnedCount)), React.createElement("button", {
    className: "folder-row",
    onClick: onOpenDailyNote,
    title: "Heutige Tagesnotiz \xF6ffnen (Strg/Cmd + Shift + T)"
  }, React.createElement(Icon, {
    name: "calendar",
    className: "ico"
  }), React.createElement("span", null, "Heute"))), React.createElement("div", {
    className: "section-label"
  }, "Ansichten"), React.createElement("div", {
    className: "folder-list folder-list-icons"
  }, React.createElement("button", {
    className: "folder-row icon-row " + (selectedFolderId === "graph" ? "active" : ""),
    onClick: () => {
      onSelectFolder("graph");
      onMobileClose?.();
    },
    title: "Graph \u2014 Vernetzte Notizen"
  }, React.createElement(Icon, {
    name: "link",
    className: "ico"
  }), React.createElement("span", null, "Graph")), React.createElement("button", {
    className: "folder-row icon-row " + (selectedFolderId === "kanban" ? "active" : ""),
    onClick: () => {
      onSelectFolder("kanban");
      onMobileClose?.();
    },
    title: "Kanban \u2014 Status-Board"
  }, React.createElement(Icon, {
    name: "check-square",
    className: "ico"
  }), React.createElement("span", null, "Kanban")), React.createElement("button", {
    className: "folder-row icon-row " + (selectedFolderId === "timeline" ? "active" : ""),
    onClick: () => {
      onSelectFolder("timeline");
      onMobileClose?.();
    },
    title: "Timeline \u2014 F\xE4lligkeiten"
  }, React.createElement(Icon, {
    name: "calendar",
    className: "ico"
  }), React.createElement("span", null, "Timeline"))), React.createElement("div", {
    className: "section-label"
  }, "Ordner", React.createElement("button", {
    className: "icon-btn",
    onClick: e => {
      const rect = e.currentTarget.getBoundingClientRect();
      onShowContextMenu?.({
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: rect.right,
        clientY: rect.bottom + 4
      }, [{
        icon: "folder",
        label: "Neuer Ordner",
        onClick: () => setAdding(true)
      }, {
        icon: "briefcase",
        label: "HERMES-Projekt…",
        onClick: onNewHermesProject
      }]);
    },
    title: "Hinzuf\xFCgen"
  }, React.createElement(Icon, {
    name: "plus",
    size: 14
  }))), React.createElement("div", {
    className: "folder-list",
    style: {
      flex: 1
    },
    onContextMenu: e => {
      if (e.target.closest(".folder-row")) return;
      onShowContextMenu?.(e, [{
        icon: "plus",
        label: "Neuer Ordner",
        onClick: () => setAdding(true)
      }]);
    }
  }, renderFolderTree(folders, null, 0, {
    notes,
    selectedFolderId,
    selectedNoteId,
    counts,
    editing,
    editName,
    setEditName,
    setEditing,
    onSelectFolder,
    onSelectNote,
    onMobileClose,
    onAddFolder,
    onRenameFolder,
    onChangeFolderIcon,
    onDeleteFolder,
    onShowContextMenu,
    submitEdit,
    onMoveNote,
    onMoveFolder,
    onNewNoteInFolder
  }), adding && React.createElement("div", {
    className: "folder-row",
    style: {
      paddingLeft: 8
    }
  }, React.createElement(Icon, {
    name: "folder",
    className: "ico",
    style: {
      color: "var(--text-subtle)"
    }
  }), React.createElement("input", {
    autoFocus: true,
    className: "search",
    style: {
      padding: "4px 6px",
      border: "1px solid var(--accent)",
      fontSize: 13
    },
    value: newName,
    onChange: e => setNewName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") submitAdd();
      if (e.key === "Escape") {
        setAdding(false);
        setNewName("");
      }
    },
    onBlur: submitAdd,
    placeholder: "Ordner-Name"
  }))), React.createElement("div", {
    className: "sidebar-footer"
  }, React.createElement("button", {
    className: "btn ghost sidebar-util-btn",
    onClick: onNewHermesProject,
    title: "Neues HERMES-Projekt anlegen"
  }, React.createElement(Icon, {
    name: "briefcase",
    size: 14
  })), React.createElement("button", {
    className: "btn ghost sidebar-util-btn" + (selectedFolderId === "help" ? " active" : ""),
    onClick: () => {
      onSelectFolder("help");
      onMobileClose?.();
    },
    title: "Anleitung"
  }, React.createElement(Icon, {
    name: "alert",
    size: 14
  })), React.createElement("button", {
    className: "btn ghost sidebar-util-btn" + (selectedFolderId === "trash" ? " active" : ""),
    onClick: () => {
      onSelectFolder("trash");
      onMobileClose?.();
    },
    title: `Papierkorb${trashCount > 0 ? ` (${trashCount})` : ""}`
  }, React.createElement(Icon, {
    name: "trash",
    size: 14
  }), trashCount > 0 && React.createElement("span", {
    className: "sidebar-util-badge"
  }, trashCount)), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn ghost sidebar-util-btn",
    onClick: onExport,
    title: "Export"
  }, React.createElement(Icon, {
    name: "download",
    size: 14
  })), React.createElement("button", {
    className: "btn ghost sidebar-util-btn",
    onClick: onImport,
    title: "Import"
  }, React.createElement(Icon, {
    name: "package",
    size: 14
  })), onLogout && React.createElement("button", {
    className: "btn ghost sidebar-util-btn",
    onClick: onLogout,
    title: "Abmelden"
  }, React.createElement(Icon, {
    name: "x",
    size: 14
  }))));
}
function FolderRow({
  folder,
  depth = 0,
  active,
  count,
  notes = [],
  selectedNoteId,
  onSelectNote,
  editing,
  editName,
  onEditNameChange,
  onSelect,
  onStartEdit,
  onSubmitEdit,
  onCancelEdit,
  onChangeIcon,
  onDelete,
  onShowContextMenu,
  onAddSub,
  onAddNote,
  onMoveNote,
  onMoveFolder,
  childTree
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [subName, setSubName] = useState("");
  const [dropZone, setDropZone] = useState(null);
  const menuRef = useRef();
  useEffect(() => {
    const close = e => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);
  const handleDragStart = e => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-note-tool", JSON.stringify({
      kind: "folder",
      id: folder.id
    }));
    e.dataTransfer.setData("text/plain", `folder:${folder.id}`);
  };
  const handleDragOver = e => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    let zone;
    if (y < h * 0.35) zone = "before";else if (y > h * 0.65) zone = "after";else zone = "into";
    if (zone !== dropZone) setDropZone(zone);
  };
  const handleDragLeave = e => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDropZone(null);
  };
  const handleDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    const zone = dropZone || "into";
    setDropZone(null);
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("application/x-note-tool") || "");
    } catch {
      const plain = e.dataTransfer.getData("text/plain");
      const m = /^(note|folder):(.+)$/.exec(plain);
      if (m) payload = {
        kind: m[1],
        id: m[2]
      };
    }
    if (!payload) return;
    if (payload.kind === "note") {
      onMoveNote?.(payload.id, folder.id);
      setExpanded(true);
    } else if (payload.kind === "folder") {
      if (payload.id === folder.id) return;
      if (zone === "into") {
        onMoveFolder?.(payload.id, folder.id);
        setExpanded(true);
      } else if (zone === "before") {
        onMoveFolder?.(payload.id, folder.parentId || null, {
          before: folder.id
        });
      } else if (zone === "after") {
        onMoveFolder?.(payload.id, folder.parentId || null, {
          after: folder.id
        });
      }
    }
  };
  if (editing) {
    return React.createElement("div", {
      className: "folder-row",
      style: {
        paddingLeft: 8 + depth * 14,
        gap: 6
      },
      onBlur: e => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        onSubmitEdit();
      }
    }, React.createElement(window.IconPicker, {
      value: folder.icon || "folder",
      onChange: icon => onChangeIcon?.(icon),
      size: 26
    }), React.createElement("input", {
      autoFocus: true,
      className: "search",
      style: {
        padding: "4px 6px",
        border: "1px solid var(--accent)",
        fontSize: 13,
        flex: 1
      },
      value: editName,
      onChange: e => onEditNameChange(e.target.value),
      onKeyDown: e => {
        if (e.key === "Enter") onSubmitEdit();
        if (e.key === "Escape") onCancelEdit();
      }
    }));
  }
  const hasChildren = childTree && childTree.length > 0 || notes.length > 0;
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
  const submitSub = () => {
    const t = subName.trim();
    if (t) {
      onAddSub(t);
      setExpanded(true);
    }
    setSubName("");
    setAddingSub(false);
  };
  return React.createElement("div", {
    className: "folder-group",
    ref: menuRef
  }, React.createElement("div", {
    className: "folder-row-wrap" + (dropZone ? " drop-" + dropZone : ""),
    style: {
      paddingLeft: depth * 14
    },
    draggable: true,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop
  }, React.createElement("button", {
    className: "folder-twist",
    onClick: e => {
      e.stopPropagation();
      setExpanded(v => !v);
    },
    title: expanded ? "Einklappen" : "Aufklappen",
    "aria-expanded": expanded,
    style: {
      visibility: hasChildren ? "visible" : "hidden"
    }
  }, React.createElement(Icon, {
    name: "chevron-right",
    size: 12,
    style: {
      transform: expanded ? "rotate(90deg)" : "rotate(0)",
      transition: "transform 160ms ease"
    }
  })), React.createElement("button", {
    className: "folder-row " + (active ? "active" : ""),
    style: {
      paddingLeft: 4,
      paddingRight: 52,
      flex: 1
    },
    onClick: () => {
      if (hasChildren) setExpanded(v => !v);else onSelect();
    },
    onDoubleClick: e => {
      if (hasChildren) {
        e.stopPropagation();
        setExpanded(v => !v);
      }
    },
    onContextMenu: e => onShowContextMenu?.(e, [{
      icon: "external",
      label: "Öffnen",
      onClick: onSelect
    }, {
      icon: "plus",
      label: "Unterordner hinzufügen",
      onClick: () => {
        setAddingSub(true);
        setExpanded(true);
      }
    }, {
      icon: "edit",
      label: "Umbenennen",
      onClick: onStartEdit
    }, {
      divider: true
    }, {
      icon: "trash",
      label: "Löschen",
      danger: true,
      onClick: onDelete
    }])
  }, React.createElement(Icon, {
    name: folder.icon || "folder",
    className: "ico"
  }), React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, folder.name), React.createElement("span", {
    className: "count"
  }, count)), onAddNote && React.createElement("button", {
    className: "icon-btn folder-add-note",
    onClick: e => {
      e.stopPropagation();
      onAddNote();
      setExpanded(true);
    },
    title: "Neue Seite in diesem Ordner"
  }, React.createElement(Icon, {
    name: "plus",
    size: 14
  })), React.createElement("button", {
    className: "icon-btn folder-more",
    onClick: e => {
      e.stopPropagation();
      setMenuOpen(v => !v);
    }
  }, React.createElement(Icon, {
    name: "more",
    size: 14
  })), menuOpen && React.createElement("div", {
    className: "dropdown-menu",
    style: {
      position: "absolute",
      top: 30,
      right: 4,
      zIndex: 50
    }
  }, React.createElement("button", {
    className: "dropdown-item",
    onClick: () => {
      setMenuOpen(false);
      setAddingSub(true);
      setExpanded(true);
    }
  }, React.createElement(Icon, {
    name: "plus",
    size: 14
  }), " Unterordner"), React.createElement("button", {
    className: "dropdown-item",
    onClick: () => {
      setMenuOpen(false);
      onStartEdit();
    }
  }, React.createElement(Icon, {
    name: "edit",
    size: 14
  }), " Umbenennen"), React.createElement("button", {
    className: "dropdown-item danger",
    onClick: () => {
      setMenuOpen(false);
      onDelete();
    }
  }, React.createElement(Icon, {
    name: "trash",
    size: 14
  }), " L\xF6schen"))), expanded && React.createElement(React.Fragment, null, childTree, addingSub && React.createElement("div", {
    className: "folder-row",
    style: {
      paddingLeft: 8 + (depth + 1) * 14
    }
  }, React.createElement(Icon, {
    name: "folder",
    className: "ico",
    style: {
      color: "var(--text-subtle)"
    }
  }), React.createElement("input", {
    autoFocus: true,
    className: "search",
    style: {
      padding: "4px 6px",
      border: "1px solid var(--accent)",
      fontSize: 13
    },
    value: subName,
    onChange: e => setSubName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") submitSub();
      if (e.key === "Escape") {
        setAddingSub(false);
        setSubName("");
      }
    },
    onBlur: submitSub,
    placeholder: "Unterordner-Name"
  })), React.createElement("div", {
    className: "folder-notes",
    style: {
      marginLeft: 8 + depth * 14
    }
  }, sortedNotes.map(n => React.createElement("button", {
    key: n.id,
    className: "folder-note-row " + (n.id === selectedNoteId ? "active" : ""),
    draggable: true,
    onDragStart: e => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/x-note-tool", JSON.stringify({
        kind: "note",
        id: n.id
      }));
      e.dataTransfer.setData("text/plain", `note:${n.id}`);
    },
    onClick: () => onSelectNote(n.id),
    title: n.title || "Ohne Titel"
  }, React.createElement(Icon, {
    name: n.icon || (n.type === "it" ? "terminal" : "doc"),
    size: 12,
    className: "folder-note-ico"
  }), React.createElement("span", {
    className: "folder-note-title"
  }, n.title || "Ohne Titel"), n.pinned && React.createElement(Icon, {
    name: "star-fill",
    size: 10,
    style: {
      color: "var(--accent)",
      flexShrink: 0
    }
  }))))));
}
function NotesList({
  notes,
  folders,
  selectedFolderId,
  selectedNoteId,
  onSelectNote,
  onNewNote,
  onNewFromTemplate,
  templates = [],
  onManageTemplates,
  onNewHermesProject,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilter,
  tagFilter,
  onTagFilter,
  onDeleteNote,
  onTogglePin,
  onContextMenu,
  onSelectFolder,
  sidebarCollapsed,
  onShowSidebar,
  onCollapse,
  onMobileClose,
  onOpenSidebar
}) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [smartFilter, setSmartFilter] = useState(null);
  const newMenuRef = useRef();
  useEffect(() => {
    const close = e => {
      if (!newMenuRef.current?.contains(e.target)) setNewMenuOpen(false);
    };
    if (newMenuOpen) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [newMenuOpen]);
  const folder = folders.find(f => f.id === selectedFolderId);
  const smartFolder = selectedFolderId?.startsWith("smart:") ? (window.SMART_FOLDERS || []).find(s => s.id === selectedFolderId.slice(6)) : null;
  const title = selectedFolderId === "all" ? "Alle Notizen" : selectedFolderId === "pinned" ? "Favoriten" : smartFolder?.name || folder?.name || "Notizen";
  const smartList = window.SMART_FOLDERS || [];
  const active = smartList.find(s => s.id === smartFilter);
  const baseNotes = active ? notes.filter(active.predicate) : notes;
  const sorted = [...baseNotes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
  const tagsToShow = allTags(notes).slice(0, 8);
  return React.createElement("section", {
    className: "list-pane"
  }, React.createElement("div", {
    className: "list-header"
  }, folder?.parentId && onSelectFolder && (() => {
    const parent = folders.find(f => f.id === folder.parentId);
    if (!parent) return null;
    return React.createElement("button", {
      className: "sublist-up",
      onClick: () => onSelectFolder(parent.id),
      title: `Zurück zu ${parent.name}`
    }, React.createElement(Icon, {
      name: "chevron-left",
      size: 14
    }), React.createElement("span", null, parent.name));
  })(), React.createElement("div", {
    className: "list-title-row"
  }, sidebarCollapsed && React.createElement("button", {
    className: "icon-btn",
    onClick: onShowSidebar,
    title: "Sidebar einblenden",
    style: {
      marginRight: -4
    }
  }, React.createElement(Icon, {
    name: "menu"
  })), React.createElement("button", {
    className: "icon-btn mobile-only",
    onClick: onOpenSidebar,
    title: "Sammlungen",
    style: {
      marginRight: -4
    }
  }, React.createElement(Icon, {
    name: "menu"
  })), React.createElement("div", {
    className: "list-title"
  }, title, React.createElement("span", {
    className: "muted"
  }, sorted.length)), React.createElement("div", {
    className: "dropdown",
    ref: newMenuRef
  }, React.createElement("button", {
    className: "btn accent sm",
    onClick: () => setNewMenuOpen(v => !v)
  }, React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Neu"), newMenuOpen && React.createElement("div", {
    className: "dropdown-menu",
    style: {
      minWidth: 240,
      maxHeight: 360,
      overflowY: "auto"
    }
  }, templates.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      padding: "6px 10px 4px",
      fontSize: 10,
      fontWeight: 600,
      color: "var(--text-subtle)",
      textTransform: "uppercase",
      letterSpacing: "0.06em"
    }
  }, "Templates"), templates.map(t => React.createElement("button", {
    key: t.id,
    className: "dropdown-item",
    onClick: () => {
      setNewMenuOpen(false);
      onNewFromTemplate(t.id);
    }
  }, React.createElement(Icon, {
    name: t.icon || "doc",
    size: 14
  }), React.createElement("span", {
    style: {
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, t.name))), React.createElement("div", {
    className: "dropdown-divider"
  })), React.createElement("button", {
    className: "dropdown-item",
    onClick: () => {
      setNewMenuOpen(false);
      onManageTemplates();
    }
  }, React.createElement(Icon, {
    name: "settings",
    size: 14
  }), " Templates verwalten"), onNewHermesProject && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "dropdown-divider"
  }), React.createElement("button", {
    className: "dropdown-item",
    onClick: () => {
      setNewMenuOpen(false);
      onNewHermesProject();
    }
  }, React.createElement(Icon, {
    name: "briefcase",
    size: 14
  }), " HERMES-Projekt anlegen\u2026")))), onCollapse && React.createElement("button", {
    className: "icon-btn list-collapse-btn",
    onClick: onCollapse,
    title: "Notizliste einklappen"
  }, React.createElement(Icon, {
    name: "chevron-left",
    size: 14
  }))), React.createElement("div", {
    className: "search-wrap"
  }, React.createElement(Icon, {
    name: "search",
    size: 14
  }), React.createElement("input", {
    className: "search",
    placeholder: "Suchen\u2026",
    value: search,
    onChange: e => onSearchChange(e.target.value)
  })), React.createElement("div", {
    className: "filter-row"
  }, React.createElement("button", {
    className: "chip " + (typeFilter === "all" ? "active" : ""),
    onClick: () => onTypeFilter("all")
  }, "Alle"), React.createElement("button", {
    className: "chip " + (typeFilter === "it" ? "active" : ""),
    onClick: () => onTypeFilter("it")
  }, React.createElement(Icon, {
    name: "terminal",
    size: 11
  }), "IT"), React.createElement("button", {
    className: "chip " + (typeFilter === "normal" ? "active" : ""),
    onClick: () => onTypeFilter("normal")
  }, React.createElement(Icon, {
    name: "doc",
    size: 11
  }), "Normal"), tagFilter && React.createElement("button", {
    className: "chip active",
    onClick: () => onTagFilter(null)
  }, "#", tagFilter, React.createElement(Icon, {
    name: "x",
    size: 10
  }))), smartList.length > 0 && (() => {
    const visible = smartList.map(sf => ({
      sf,
      count: notes.filter(sf.predicate).length
    })).filter(x => x.count > 0);
    if (visible.length === 0) return null;
    return React.createElement("div", {
      className: "filter-row"
    }, visible.map(({
      sf,
      count
    }) => React.createElement("button", {
      key: sf.id,
      className: "chip chip-smart " + (smartFilter === sf.id ? "active" : ""),
      onClick: () => setSmartFilter(prev => prev === sf.id ? null : sf.id),
      title: `${sf.name} (${count})`
    }, React.createElement(Icon, {
      name: sf.icon || "filter",
      size: 10
    }), sf.name, React.createElement("span", {
      className: "chip-count"
    }, count))));
  })(), tagsToShow.length > 0 && !tagFilter && React.createElement("div", {
    className: "filter-row"
  }, tagsToShow.map(([t, c]) => React.createElement("button", {
    key: t,
    className: "chip",
    onClick: () => onTagFilter(t)
  }, "#", t, React.createElement("span", {
    style: {
      opacity: 0.5
    }
  }, c))))), React.createElement("div", {
    className: "notes-list"
  }, (() => {
    const subfolders = folder && onSelectFolder ? folders.filter(f => f.parentId === folder.id) : [];
    if (subfolders.length === 0) return null;
    return React.createElement("div", {
      className: "sublist-folders"
    }, React.createElement("div", {
      className: "sublist-folders-label"
    }, "Unterordner"), React.createElement("div", {
      className: "sublist-folders-grid"
    }, subfolders.map(sf => {
      const descIds = new Set([sf.id]);
      let added = true;
      while (added) {
        added = false;
        for (const f of folders) {
          if (f.parentId && descIds.has(f.parentId) && !descIds.has(f.id)) {
            descIds.add(f.id);
            added = true;
          }
        }
      }
      const total = notes.filter(n => descIds.has(n.folderId)).length;
      return React.createElement("button", {
        key: sf.id,
        className: "sublist-folder",
        onClick: () => onSelectFolder(sf.id),
        onDoubleClick: e => {
          e.stopPropagation();
          onSelectFolder(sf.id);
        },
        title: `In ${sf.name} öffnen`
      }, React.createElement(Icon, {
        name: sf.icon || "folder",
        size: 16,
        className: "sublist-folder-ico"
      }), React.createElement("span", {
        className: "sublist-folder-name"
      }, sf.name), React.createElement("span", {
        className: "sublist-folder-count"
      }, total));
    })));
  })(), sorted.length === 0 ? (() => {
    const hasSub = folder && folders.some(f => f.parentId === folder.id);
    if (hasSub) {
      return React.createElement("div", {
        className: "list-empty",
        style: {
          padding: "16px 20px",
          textAlign: "left"
        }
      }, React.createElement("div", {
        style: {
          fontSize: 12
        }
      }, "Keine Notizen direkt in diesem Ordner."), React.createElement("div", {
        style: {
          fontSize: 12,
          marginTop: 4
        }
      }, "W\xE4hle einen Unterordner oben oder leg eine neue Notiz an."));
    }
    return React.createElement("div", {
      className: "list-empty"
    }, React.createElement(Icon, {
      name: "inbox",
      size: 40
    }), React.createElement("div", null, "Keine Notizen hier."), React.createElement("div", {
      style: {
        marginTop: 6
      }
    }, "Klick auf ", React.createElement("b", null, "Neu"), ", um zu starten."));
  })() : sorted.map(n => React.createElement(NoteListItem, {
    key: n.id,
    note: n,
    active: n.id === selectedNoteId,
    onClick: () => {
      onSelectNote(n.id);
      onMobileClose?.();
    },
    onDelete: onDeleteNote,
    onTogglePin: onTogglePin,
    onContextMenu: onContextMenu
  }))));
}
function NoteListItem({
  note,
  active,
  onClick,
  onDelete,
  onTogglePin,
  onContextMenu
}) {
  const preview = notePreview(note);
  const k = note.kanban;
  const statusClass = k === "success" ? "success" : k === "error" ? "danger" : k === "warning" ? "warning" : k === "neutral" ? "neutral" : null;
  const statusText = k === "success" ? "Erledigt" : k === "error" ? "Blockiert" : k === "warning" ? "In Arbeit" : k === "neutral" ? "Offen" : null;
  return React.createElement("div", {
    className: "note-item " + (active ? "active" : ""),
    onClick: onClick,
    onContextMenu: e => onContextMenu?.(e, note),
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.();
      }
    },
    role: "button",
    tabIndex: 0,
    draggable: true,
    onDragStart: e => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/x-note-tool", JSON.stringify({
        kind: "note",
        id: note.id
      }));
      e.dataTransfer.setData("text/plain", `note:${note.id}`);
    }
  }, React.createElement("div", {
    className: "note-item-row"
  }, React.createElement("span", {
    className: "note-type-badge " + note.type
  }, note.type === "it" ? "IT" : "Notiz"), React.createElement("div", {
    className: "note-title"
  }, note.title || "Ohne Titel"), note.pinned && React.createElement(Icon, {
    name: "star-fill",
    size: 12,
    className: "note-pin"
  }), onDelete && React.createElement("button", {
    className: "note-item-delete",
    title: "Notiz l\xF6schen",
    onClick: e => {
      e.stopPropagation();
      onDelete(note);
    }
  }, React.createElement(Icon, {
    name: "trash",
    size: 13
  }))), preview && React.createElement("div", {
    className: "note-preview",
    style: note.type === "it" ? {
      fontFamily: "var(--font-mono)",
      fontSize: 11
    } : {}
  }, preview), React.createElement("div", {
    className: "note-meta"
  }, React.createElement("span", null, formatRel(note.updatedAt)), note.dueAt && (() => {
    const ms = new Date(note.dueAt).getTime() - Date.now();
    const overdue = ms < 0;
    const soon = !overdue && ms < 3 * 24 * 60 * 60 * 1000;
    const cls = overdue ? "overdue" : soon ? "soon" : "";
    const dayStr = new Date(note.dueAt).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short"
    });
    return React.createElement(React.Fragment, null, React.createElement("span", {
      className: "dot-sep"
    }), React.createElement("span", {
      className: "note-due " + cls,
      title: "Fällig: " + new Date(note.dueAt).toLocaleString("de-DE")
    }, React.createElement(Icon, {
      name: "flag",
      size: 10
    }), overdue ? `Überfällig (${dayStr})` : `Fällig ${dayStr}`));
  })(), statusClass && React.createElement(React.Fragment, null, React.createElement("span", {
    className: "dot-sep"
  }), React.createElement("span", {
    className: "note-status " + statusClass
  }, React.createElement("span", {
    className: "status-dot " + statusClass
  }), statusText)), note.tags?.length > 0 && React.createElement(React.Fragment, null, React.createElement("span", {
    className: "dot-sep"
  }), React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, note.tags.slice(0, 3).map(t => `#${t}`).join(" ")))));
}
Object.assign(window, {
  Sidebar,
  NotesList
});
const NOTE_ICONS = ["doc", "terminal", "code", "folder", "inbox", "star", "tag", "link", "pin", "bookmark", "image", "table", "check-square", "calendar", "alert", "check-circle", "settings", "edit", "home", "server", "database", "cloud", "key", "lock", "bell", "zap", "target", "package", "globe", "user", "mail", "heart", "flag", "fire", "briefcase", "archive", "clock", "eye", "smile", "compass", "wrench", "shield"];
function IconPicker({
  value,
  onChange,
  icons = NOTE_ICONS,
  size = 40,
  accent
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({
    top: 0,
    left: 0
  });
  const ref = useRef();
  const btnRef = useRef();
  useEffect(() => {
    const close = e => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      if (!btnRef.current) return;
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
  return React.createElement("div", {
    className: "icon-picker",
    ref: ref
  }, React.createElement("button", {
    ref: btnRef,
    className: "icon-picker-btn" + (accent ? " accent" : ""),
    onClick: () => setOpen(v => !v),
    title: "Icon \xE4ndern",
    style: {
      width: size,
      height: size
    }
  }, React.createElement(Icon, {
    name: value || "doc",
    size: Math.floor(size * 0.5)
  })), open && React.createElement("div", {
    className: "icon-picker-grid",
    style: {
      position: "fixed",
      top: pos.top,
      left: pos.left
    }
  }, icons.map(name => React.createElement("button", {
    key: name,
    className: "icon-picker-item " + (name === value ? "active" : ""),
    onClick: () => {
      onChange(name);
      setOpen(false);
    },
    title: name,
    type: "button"
  }, React.createElement(Icon, {
    name: name,
    size: 16
  })))));
}
const LANG_LABELS = {
  bash: "Bash",
  powershell: "PowerShell",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  csharp: "C#",
  cpp: "C++",
  c: "C",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  ruby: "Ruby",
  swift: "Swift",
  kotlin: "Kotlin",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  yaml: "YAML",
  xml: "XML",
  markdown: "Markdown",
  docker: "Dockerfile",
  nginx: "Nginx",
  ini: "INI / Config",
  plain: "Plain text"
};
const LANG_POPULAR = ["bash", "powershell", "python", "javascript", "typescript", "sql", "json", "yaml"];
const LANG_ALL = Object.keys(LANG_LABELS);
function LangSelect({
  value,
  onChange,
  options
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({
    top: 0,
    left: 0
  });
  const [query, setQuery] = useState("");
  const ref = useRef();
  const btnRef = useRef();
  const inputRef = useRef();
  useEffect(() => {
    const close = e => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      if (!btnRef.current) return;
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
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);
  const cur = value || "bash";
  const q = query.trim().toLowerCase();
  const list = q ? LANG_ALL.filter(k => k.includes(q) || (LANG_LABELS[k] || "").toLowerCase().includes(q)) : LANG_ALL;
  const select = l => {
    onChange(l);
    setOpen(false);
  };
  return React.createElement("div", {
    className: "lang-select-wrap",
    ref: ref
  }, React.createElement("button", {
    ref: btnRef,
    className: "lang-select-btn",
    onClick: () => setOpen(v => !v),
    title: "Sprache w\xE4hlen",
    type: "button"
  }, React.createElement("span", {
    className: "lang-select-dot lang-" + cur + "-dot"
  }), React.createElement("span", {
    className: "lang-select-label"
  }, LANG_LABELS[cur] || cur), React.createElement(Icon, {
    name: "chevron-down",
    size: 10
  })), open && React.createElement("div", {
    className: "lang-select-menu",
    style: {
      position: "fixed",
      top: pos.top,
      left: pos.left
    }
  }, React.createElement("div", {
    className: "lang-select-search"
  }, React.createElement(Icon, {
    name: "search",
    size: 12
  }), React.createElement("input", {
    ref: inputRef,
    type: "text",
    placeholder: "Sprache suchen\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    onKeyDown: e => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "Enter" && list[0]) {
        select(list[0]);
      }
    }
  }), query && React.createElement("button", {
    className: "lang-search-clear",
    onClick: () => setQuery(""),
    type: "button",
    title: "Suche leeren"
  }, React.createElement(Icon, {
    name: "x",
    size: 11
  }))), React.createElement("div", {
    className: "lang-select-items"
  }, list.length === 0 ? React.createElement("div", {
    className: "lang-select-empty"
  }, "Nichts gefunden") : list.map(o => React.createElement("button", {
    key: o,
    className: "lang-select-item " + (o === cur ? "active" : ""),
    onClick: () => select(o),
    type: "button"
  }, React.createElement("span", {
    className: "lang-select-dot lang-" + o + "-dot"
  }), React.createElement("span", null, LANG_LABELS[o] || o), o === cur && React.createElement(Icon, {
    name: "check",
    size: 11,
    className: "check",
    style: {
      marginLeft: "auto",
      color: "var(--accent)"
    }
  }))))));
}
Object.assign(window, {
  IconPicker,
  LangSelect,
  NOTE_ICONS,
  LANG_LABELS
});
function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
  searchable = false,
  minWidth = 160,
  disabled
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({
    top: 0,
    left: 0
  });
  const [query, setQuery] = useState("");
  const ref = useRef();
  const btnRef = useRef();
  const inputRef = useRef();
  useEffect(() => {
    const close = e => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      if (!btnRef.current) return;
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
  useEffect(() => {
    if (open && searchable) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, searchable]);
  const normOpts = (options || []).map(o => typeof o === "object" ? o : {
    value: o,
    label: o || "—"
  });
  const q = query.trim().toLowerCase();
  const list = q ? normOpts.filter(o => String(o.label).toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q)) : normOpts;
  const current = normOpts.find(o => o.value === value);
  const select = v => {
    onChange(v);
    setOpen(false);
  };
  return React.createElement("div", {
    className: "lang-select-wrap",
    ref: ref
  }, React.createElement("button", {
    ref: btnRef,
    className: "lang-select-btn",
    onClick: () => !disabled && setOpen(v => !v),
    type: "button",
    disabled: disabled,
    style: {
      minWidth
    }
  }, React.createElement("span", {
    className: "lang-select-label"
  }, current?.label || placeholder || "—"), React.createElement(Icon, {
    name: "chevron-down",
    size: 10
  })), open && React.createElement("div", {
    className: "lang-select-menu",
    style: {
      position: "fixed",
      top: pos.top,
      left: pos.left,
      minWidth: Math.max(minWidth, 180)
    }
  }, searchable && React.createElement("div", {
    className: "lang-select-search"
  }, React.createElement(Icon, {
    name: "search",
    size: 12
  }), React.createElement("input", {
    ref: inputRef,
    type: "text",
    placeholder: "Suchen\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    onKeyDown: e => {
      if (e.key === "Escape") setOpen(false);else if (e.key === "Enter" && list[0]) select(list[0].value);
    }
  }), query && React.createElement("button", {
    className: "lang-search-clear",
    onClick: () => setQuery(""),
    type: "button"
  }, React.createElement(Icon, {
    name: "x",
    size: 11
  }))), React.createElement("div", {
    className: "lang-select-items"
  }, list.length === 0 ? React.createElement("div", {
    className: "lang-select-empty"
  }, "Nichts gefunden") : list.map(o => React.createElement("button", {
    key: o.value,
    className: "lang-select-item " + (o.value === value ? "active" : ""),
    onClick: () => select(o.value),
    type: "button"
  }, React.createElement("span", null, o.label), o.value === value && React.createElement(Icon, {
    name: "check",
    size: 11,
    className: "check",
    style: {
      marginLeft: "auto",
      color: "var(--accent)"
    }
  }))))));
}
Object.assign(window, {
  StyledSelect
});
function ThemePicker({
  themePref,
  theme,
  systemTheme,
  onChange,
  onToggle
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef();
  const btnRef = useRef();
  const menuRef = useRef();
  useEffect(() => {
    const close = e => {
      if (ref.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const recompute = () => {
      const br = btnRef.current.getBoundingClientRect();
      const menuW = menuRef.current?.offsetWidth || 220;
      const margin = 8;
      let left = br.right - menuW;
      if (left < margin) left = margin;
      if (left + menuW > window.innerWidth - margin) left = window.innerWidth - menuW - margin;
      setPos({
        top: br.bottom + 6,
        left
      });
    };
    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open]);
  const currentIcon = themePref === "auto" ? "monitor" : theme === "dark" ? "moon" : "sun";
  const options = [{
    value: "light",
    label: "Hell",
    icon: "sun"
  }, {
    value: "dark",
    label: "Dunkel",
    icon: "moon"
  }, {
    value: "auto",
    label: "Automatisch",
    icon: "monitor",
    hint: `Folgt System · gerade ${systemTheme === "dark" ? "Dunkel" : "Hell"}`
  }];
  return React.createElement("div", {
    className: "theme-picker",
    ref: ref,
    style: {
      marginLeft: "auto",
      position: "relative"
    }
  }, React.createElement("button", {
    ref: btnRef,
    className: "theme-btn",
    onClick: () => setOpen(v => !v),
    onDoubleClick: onToggle,
    title: "Theme \xB7 Doppelklick zum Schnell-Wechseln (\u2318\u21E7D)",
    "aria-label": "Theme w\xE4hlen"
  }, React.createElement("span", {
    className: "theme-btn-bg " + (theme === "dark" ? "dark" : "light")
  }), React.createElement(Icon, {
    name: currentIcon,
    size: 15
  })), open && React.createElement("div", {
    ref: menuRef,
    className: "dropdown-menu",
    style: {
      position: "fixed",
      top: pos?.top ?? -9999,
      left: pos?.left ?? -9999,
      right: "auto",
      minWidth: 220,
      visibility: pos ? "visible" : "hidden"
    }
  }, React.createElement("div", {
    style: {
      padding: "6px 10px 4px",
      fontSize: 10,
      fontWeight: 600,
      color: "var(--text-subtle)",
      textTransform: "uppercase",
      letterSpacing: "0.06em"
    }
  }, "Erscheinungsbild"), options.map(opt => React.createElement("button", {
    key: opt.value,
    className: "dropdown-item",
    onClick: () => {
      onChange(opt.value);
      setOpen(false);
    }
  }, React.createElement(Icon, {
    name: opt.icon,
    size: 14
  }), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 1,
      flex: 1
    }
  }, React.createElement("span", null, opt.label), opt.hint && React.createElement("span", {
    style: {
      fontSize: 10,
      color: "var(--text-subtle)",
      fontWeight: 400
    }
  }, opt.hint)), themePref === opt.value && React.createElement(Icon, {
    name: "check",
    size: 13,
    style: {
      color: "var(--accent)"
    }
  }))), React.createElement("div", {
    className: "dropdown-divider"
  }), React.createElement("div", {
    style: {
      padding: "4px 10px 6px",
      fontSize: 11,
      color: "var(--text-subtle)",
      display: "flex",
      justifyContent: "space-between"
    }
  }, React.createElement("span", null, "Schnell-Toggle"), React.createElement("span", {
    className: "kbd",
    style: {
      fontFamily: "var(--font-mono)"
    }
  }, "\u2318\u21E7D"))));
}