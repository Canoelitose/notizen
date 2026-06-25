// Sidebar + Notes list pane
const { useState, useRef, useEffect, useLayoutEffect } = React;

// Server-only mod: live auto-save status indicator (shown under the brand name).
function SaveStatus({ status }) {
  const map = {
    idle:   { color: "var(--text-subtle)", label: "IT · Allgemein" },
    saving: { color: "var(--warn, #d08770)", label: "Speichert…" },
    saved:  { color: "var(--ok, #8FBF7F)", label: "Gespeichert" },
    error:  { color: "var(--danger, #e06c75)", label: "Speicherfehler" },
  };
  const s = map[status] || map.idle;
  return (
    <div className="brand-sub" title="Auto-Speichern" style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }}></span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
    </div>
  );
}

// Render the folder tree recursively based on parentId.
function renderFolderTree(allFolders, parentId, depth, ctx) {
  const children = allFolders.filter(f => (f.parentId || null) === parentId);
  return children.map(f => (
    <FolderRow
      key={f.id}
      folder={f}
      depth={depth}
      active={ctx.selectedFolderId === f.id}
      count={ctx.counts[f.id] || 0}
      notes={ctx.notes.filter(n => n.folderId === f.id)}
      selectedNoteId={ctx.selectedNoteId}
      onSelectNote={(id) => { ctx.onSelectNote(id); ctx.onMobileClose?.(); }}
      editing={ctx.editing === f.id}
      editName={ctx.editName}
      onEditNameChange={ctx.setEditName}
      onSelect={() => { ctx.onSelectFolder(f.id); ctx.onMobileClose?.(); }}
      onStartEdit={() => { ctx.setEditing(f.id); ctx.setEditName(f.name); }}
      onSubmitEdit={() => ctx.submitEdit(f.id)}
      onCancelEdit={() => ctx.setEditing(null)}
      onChangeIcon={(icon) => ctx.onChangeFolderIcon?.(f.id, icon)}
      onDelete={() => ctx.onDeleteFolder(f.id)}
      onShowContextMenu={ctx.onShowContextMenu}
      onAddSub={(name) => ctx.onAddFolder(name, f.id)}
      onAddNote={() => ctx.onNewNoteInFolder?.(f.id)}
      onMoveNote={ctx.onMoveNote}
      onMoveFolder={ctx.onMoveFolder}
      childTree={renderFolderTree(allFolders, f.id, depth + 1, ctx)}
    />
  ));
}

function Sidebar({ folders, notes, selectedFolderId, selectedNoteId, onSelectFolder, onSelectNote, onMoveNote, onMoveFolder, onAddFolder, onRenameFolder, onChangeFolderIcon, onDeleteFolder, onShowContextMenu, theme, themePref, systemTheme, onSetThemePref, onToggleTheme, onExport, onImport, onNewHermesProject, onOpenDailyNote, onOpenSearch, onNewNoteInFolder, smartFolders = [], trashCount = 0, onCollapse, onLogout, saveStatus = "idle", onMobileClose }) {
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
    setNewName(""); setAdding(false);
  };
  const submitEdit = (id) => {
    if (editName.trim()) onRenameFolder(id, editName.trim());
    setEditing(null);
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">N</div>
        <div>
          <div className="brand-name">Notizen</div>
          <SaveStatus status={saveStatus} />
        </div>
        <ThemePicker themePref={themePref} theme={theme} systemTheme={systemTheme} onChange={onSetThemePref} onToggle={onToggleTheme} />
        {onCollapse && (
          <button
            className="icon-btn sidebar-collapse-btn"
            onClick={onCollapse}
            title="Sidebar einklappen"
          >
            <Icon name="chevron-left" size={14} />
          </button>
        )}
      </div>

      {onOpenSearch && (
        <button className="sidebar-search-trigger" onClick={onOpenSearch} title="Schnellsuche (Strg/Cmd + K)">
          <Icon name="search" size={15} />
          <span>Suchen</span>
          <span className="sidebar-search-kbd">⌘K</span>
        </button>
      )}

      <div className="section-label">Sammlungen</div>
      <div className="folder-list">
        <button
          className={"folder-row " + (selectedFolderId === "dashboard" ? "active" : "")}
          onClick={() => { onSelectFolder("dashboard"); onMobileClose?.(); }}
        >
          <Icon name="home" className="ico" />
          <span>Übersicht</span>
        </button>
        <button
          className={"folder-row " + (selectedFolderId === "all" ? "active" : "")}
          onClick={() => { onSelectFolder("all"); onMobileClose?.(); }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; e.currentTarget.classList.add("drop-over"); }}
          onDragLeave={(e) => e.currentTarget.classList.remove("drop-over")}
          onDrop={(e) => {
            e.preventDefault(); e.currentTarget.classList.remove("drop-over");
            let payload;
            try { payload = JSON.parse(e.dataTransfer.getData("application/x-note-tool") || ""); } catch {
              const plain = e.dataTransfer.getData("text/plain");
              const m = /^(note|folder):(.+)$/.exec(plain);
              if (m) payload = { kind: m[1], id: m[2] };
            }
            if (!payload) return;
            if (payload.kind === "folder") onMoveFolder?.(payload.id, null);
            else if (payload.kind === "note") onMoveNote?.(payload.id, folders[0]?.id || null);
          }}
        >
          <Icon name="inbox" className="ico" />
          <span>Alle Notizen</span>
          <span className="count">{allCount}</span>
        </button>
        <button
          className={"folder-row " + (selectedFolderId === "pinned" ? "active" : "")}
          onClick={() => { onSelectFolder("pinned"); onMobileClose?.(); }}
        >
          <Icon name="star" className="ico" />
          <span>Favoriten</span>
          <span className="count">{pinnedCount}</span>
        </button>
        <button
          className="folder-row"
          onClick={onOpenDailyNote}
          title="Heutige Tagesnotiz öffnen (Strg/Cmd + Shift + T)"
        >
          <Icon name="calendar" className="ico" />
          <span>Heute</span>
        </button>
      </div>

      <div className="section-label">Ansichten</div>
      <div className="folder-list folder-list-icons">
        <button
          className={"folder-row icon-row " + (selectedFolderId === "graph" ? "active" : "")}
          onClick={() => { onSelectFolder("graph"); onMobileClose?.(); }}
          title="Graph — Vernetzte Notizen"
        >
          <Icon name="link" className="ico" />
          <span>Graph</span>
        </button>
        <button
          className={"folder-row icon-row " + (selectedFolderId === "kanban" ? "active" : "")}
          onClick={() => { onSelectFolder("kanban"); onMobileClose?.(); }}
          title="Kanban — Status-Board"
        >
          <Icon name="check-square" className="ico" />
          <span>Kanban</span>
        </button>
        <button
          className={"folder-row icon-row " + (selectedFolderId === "timeline" ? "active" : "")}
          onClick={() => { onSelectFolder("timeline"); onMobileClose?.(); }}
          title="Timeline — Fälligkeiten"
        >
          <Icon name="calendar" className="ico" />
          <span>Timeline</span>
        </button>
      </div>

      <div className="section-label">
        Ordner
        <button
          className="icon-btn"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onShowContextMenu?.({
              preventDefault: () => {},
              stopPropagation: () => {},
              clientX: rect.right,
              clientY: rect.bottom + 4,
            }, [
              { icon: "folder", label: "Neuer Ordner", onClick: () => setAdding(true) },
              { icon: "briefcase", label: "HERMES-Projekt…", onClick: onNewHermesProject },
            ]);
          }}
          title="Hinzufügen"
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="folder-list" style={{ flex: 1 }}
        onContextMenu={(e) => {
          // Only fire on the empty area, not on a folder row
          if (e.target.closest(".folder-row")) return;
          onShowContextMenu?.(e, [
            { icon: "plus", label: "Neuer Ordner", onClick: () => setAdding(true) },
          ]);
        }}
      >
        {renderFolderTree(folders, null, 0, {
          notes, selectedFolderId, selectedNoteId,
          counts, editing, editName, setEditName, setEditing,
          onSelectFolder, onSelectNote, onMobileClose,
          onAddFolder, onRenameFolder, onChangeFolderIcon, onDeleteFolder, onShowContextMenu, submitEdit,
          onMoveNote, onMoveFolder, onNewNoteInFolder,
        })}
        {adding && (
          <div className="folder-row" style={{ paddingLeft: 8 }}>
            <Icon name="folder" className="ico" style={{ color: "var(--text-subtle)" }} />
            <input
              autoFocus
              className="search"
              style={{ padding: "4px 6px", border: "1px solid var(--accent)", fontSize: 13 }}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") submitAdd();
                if (e.key === "Escape") { setAdding(false); setNewName(""); }
              }}
              onBlur={submitAdd}
              placeholder="Ordner-Name"
            />
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button
          className="btn ghost sidebar-util-btn"
          onClick={onNewHermesProject}
          title="Neues HERMES-Projekt anlegen"
        >
          <Icon name="briefcase" size={14} />
        </button>
        <button
          className={"btn ghost sidebar-util-btn" + (selectedFolderId === "help" ? " active" : "")}
          onClick={() => { onSelectFolder("help"); onMobileClose?.(); }}
          title="Anleitung"
        >
          <Icon name="alert" size={14} />
        </button>
        <button
          className={"btn ghost sidebar-util-btn" + (selectedFolderId === "trash" ? " active" : "")}
          onClick={() => { onSelectFolder("trash"); onMobileClose?.(); }}
          title={`Papierkorb${trashCount > 0 ? ` (${trashCount})` : ""}`}
        >
          <Icon name="trash" size={14} />
          {trashCount > 0 && <span className="sidebar-util-badge">{trashCount}</span>}
        </button>
        <div style={{ flex: 1 }}></div>
        <button className="btn ghost sidebar-util-btn" onClick={onExport} title="Export">
          <Icon name="download" size={14} />
        </button>
        <button className="btn ghost sidebar-util-btn" onClick={onImport} title="Import">
          <Icon name="package" size={14} />
        </button>
        {onLogout && (
          <button className="btn ghost sidebar-util-btn" onClick={onLogout} title="Abmelden">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}

function FolderRow({ folder, depth = 0, active, count, notes = [], selectedNoteId, onSelectNote, editing, editName, onEditNameChange, onSelect, onStartEdit, onSubmitEdit, onCancelEdit, onChangeIcon, onDelete, onShowContextMenu, onAddSub, onAddNote, onMoveNote, onMoveFolder, childTree }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [subName, setSubName] = useState("");
  const [dropZone, setDropZone] = useState(null); // 'before' | 'into' | 'after'
  const menuRef = useRef();
  useEffect(() => {
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    if (menuOpen) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  // ---- Drag & Drop ----
  const handleDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-note-tool", JSON.stringify({ kind: "folder", id: folder.id }));
    // Plain-text fallback for browsers that strip custom MIME during drag
    e.dataTransfer.setData("text/plain", `folder:${folder.id}`);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    // Determine drop zone based on cursor position within the row.
    // 35% top → before, 30% middle → into, 35% bottom → after
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    let zone;
    if (y < h * 0.35) zone = "before";
    else if (y > h * 0.65) zone = "after";
    else zone = "into";
    if (zone !== dropZone) setDropZone(zone);
  };
  const handleDragLeave = (e) => {
    // Only clear when leaving the whole row (not child elements)
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDropZone(null);
  };
  const handleDrop = (e) => {
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
      if (m) payload = { kind: m[1], id: m[2] };
    }
    if (!payload) return;
    if (payload.kind === "note") {
      // Notes always drop INTO the folder (no sibling concept).
      onMoveNote?.(payload.id, folder.id);
      setExpanded(true);
    } else if (payload.kind === "folder") {
      if (payload.id === folder.id) return;
      if (zone === "into") {
        onMoveFolder?.(payload.id, folder.id);
        setExpanded(true);
      } else if (zone === "before") {
        onMoveFolder?.(payload.id, folder.parentId || null, { before: folder.id });
      } else if (zone === "after") {
        onMoveFolder?.(payload.id, folder.parentId || null, { after: folder.id });
      }
    }
  };

  if (editing) {
    return (
      <div
        className="folder-row"
        style={{ paddingLeft: 8 + depth * 14, gap: 6 }}
        onBlur={(e) => {
          // Don't submit if focus is still inside the row (e.g. moved to icon picker)
          if (e.currentTarget.contains(e.relatedTarget)) return;
          onSubmitEdit();
        }}
      >
        <window.IconPicker
          value={folder.icon || "folder"}
          onChange={(icon) => onChangeIcon?.(icon)}
          size={26}
        />
        <input
          autoFocus
          className="search"
          style={{ padding: "4px 6px", border: "1px solid var(--accent)", fontSize: 13, flex: 1 }}
          value={editName}
          onChange={e => onEditNameChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") onSubmitEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
        />
      </div>
    );
  }
  const hasChildren = (childTree && childTree.length > 0) || notes.length > 0;
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
  const submitSub = () => {
    const t = subName.trim();
    if (t) { onAddSub(t); setExpanded(true); }
    setSubName(""); setAddingSub(false);
  };
  return (
    <div className="folder-group" ref={menuRef}>
      <div
        className={"folder-row-wrap" + (dropZone ? " drop-" + dropZone : "")}
        style={{ paddingLeft: depth * 14 }}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          className="folder-twist"
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          title={expanded ? "Einklappen" : "Aufklappen"}
          aria-expanded={expanded}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          <Icon name="chevron-right" size={12} style={{ transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 160ms ease" }} />
        </button>
        <button
          className={"folder-row " + (active ? "active" : "")}
          style={{ paddingLeft: 4, paddingRight: 52, flex: 1 }}
          onClick={() => { if (hasChildren) setExpanded(v => !v); else onSelect(); }}
          onDoubleClick={(e) => { if (hasChildren) { e.stopPropagation(); setExpanded(v => !v); } }}
          onContextMenu={(e) => onShowContextMenu?.(e, [
            { icon: "external", label: "Öffnen", onClick: onSelect },
            { icon: "plus", label: "Unterordner hinzufügen", onClick: () => { setAddingSub(true); setExpanded(true); } },
            { icon: "edit", label: "Umbenennen", onClick: onStartEdit },
            { divider: true },
            { icon: "trash", label: "Löschen", danger: true, onClick: onDelete },
          ])}
        >
          <Icon name={folder.icon || "folder"} className="ico" />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
          <span className="count">{count}</span>
        </button>
        {onAddNote && (
          <button
            className="icon-btn folder-add-note"
            onClick={(e) => { e.stopPropagation(); onAddNote(); setExpanded(true); }}
            title="Neue Seite in diesem Ordner"
          >
            <Icon name="plus" size={14} />
          </button>
        )}
        <button
          className="icon-btn folder-more"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
        >
          <Icon name="more" size={14} />
        </button>
        {menuOpen && (
          <div className="dropdown-menu" style={{ position: "absolute", top: 30, right: 4, zIndex: 50 }}>
            <button className="dropdown-item" onClick={() => { setMenuOpen(false); setAddingSub(true); setExpanded(true); }}>
              <Icon name="plus" size={14} /> Unterordner
            </button>
            <button className="dropdown-item" onClick={() => { setMenuOpen(false); onStartEdit(); }}>
              <Icon name="edit" size={14} /> Umbenennen
            </button>
            <button className="dropdown-item danger" onClick={() => { setMenuOpen(false); onDelete(); }}>
              <Icon name="trash" size={14} /> Löschen
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <>
          {childTree}
          {addingSub && (
            <div className="folder-row" style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
              <Icon name="folder" className="ico" style={{ color: "var(--text-subtle)" }} />
              <input
                autoFocus
                className="search"
                style={{ padding: "4px 6px", border: "1px solid var(--accent)", fontSize: 13 }}
                value={subName}
                onChange={e => setSubName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") submitSub();
                  if (e.key === "Escape") { setAddingSub(false); setSubName(""); }
                }}
                onBlur={submitSub}
                placeholder="Unterordner-Name"
              />
            </div>
          )}
          <div className="folder-notes" style={{ marginLeft: 8 + depth * 14 }}>
            {sortedNotes.map(n => (
              <button
                key={n.id}
                className={"folder-note-row " + (n.id === selectedNoteId ? "active" : "")}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/x-note-tool", JSON.stringify({ kind: "note", id: n.id }));
                  e.dataTransfer.setData("text/plain", `note:${n.id}`);
                }}
                onClick={() => onSelectNote(n.id)}
                title={n.title || "Ohne Titel"}
              >
                <Icon name={n.icon || (n.type === "it" ? "terminal" : "doc")} size={12} className="folder-note-ico" />
                <span className="folder-note-title">{n.title || "Ohne Titel"}</span>
                {n.pinned && <Icon name="star-fill" size={10} style={{ color: "var(--accent)", flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NotesList({ notes, folders, selectedFolderId, selectedNoteId, onSelectNote, onNewNote, onNewFromTemplate, templates = [], onManageTemplates, onNewHermesProject, search, onSearchChange, typeFilter, onTypeFilter, tagFilter, onTagFilter, onDeleteNote, onTogglePin, onContextMenu, onSelectFolder, sidebarCollapsed, onShowSidebar, onCollapse, onMobileClose, onOpenSidebar }) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [smartFilter, setSmartFilter] = useState(null);
  const newMenuRef = useRef();
  useEffect(() => {
    const close = (e) => { if (!newMenuRef.current?.contains(e.target)) setNewMenuOpen(false); };
    if (newMenuOpen) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [newMenuOpen]);

  const folder = folders.find(f => f.id === selectedFolderId);
  const smartFolder = selectedFolderId?.startsWith("smart:")
    ? (window.SMART_FOLDERS || []).find(s => s.id === selectedFolderId.slice(6))
    : null;
  const title =
    selectedFolderId === "all" ? "Alle Notizen" :
    selectedFolderId === "pinned" ? "Favoriten" :
    smartFolder?.name ||
    folder?.name || "Notizen";

  // Sort: pinned first, then updatedAt desc; apply smart filter if active
  const smartList = window.SMART_FOLDERS || [];
  const active = smartList.find(s => s.id === smartFilter);
  const baseNotes = active ? notes.filter(active.predicate) : notes;
  const sorted = [...baseNotes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });

  const tagsToShow = allTags(notes).slice(0, 8);

  return (
    <section className="list-pane">
      <div className="list-header">
        {folder?.parentId && onSelectFolder && (() => {
          const parent = folders.find(f => f.id === folder.parentId);
          if (!parent) return null;
          return (
            <button
              className="sublist-up"
              onClick={() => onSelectFolder(parent.id)}
              title={`Zurück zu ${parent.name}`}
            >
              <Icon name="chevron-left" size={14} />
              <span>{parent.name}</span>
            </button>
          );
        })()}
        <div className="list-title-row">
          {sidebarCollapsed && (
            <button className="icon-btn" onClick={onShowSidebar} title="Sidebar einblenden" style={{ marginRight: -4 }}>
              <Icon name="menu" />
            </button>
          )}
          <button className="icon-btn mobile-only" onClick={onOpenSidebar} title="Sammlungen" style={{ marginRight: -4 }}>
            <Icon name="menu" />
          </button>
          <div className="list-title">
            {title}<span className="muted">{sorted.length}</span>
          </div>
          <div className="dropdown" ref={newMenuRef}>
            <button className="btn accent sm" onClick={() => setNewMenuOpen(v => !v)}>
              <Icon name="plus" size={14} />
              Neu
            </button>
            {newMenuOpen && (
              <div className="dropdown-menu" style={{ minWidth: 240, maxHeight: 360, overflowY: "auto" }}>
                {templates.length > 0 && (
                  <>
                    <div style={{ padding: "6px 10px 4px", fontSize: 10, fontWeight: 600, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Templates
                    </div>
                    {templates.map(t => (
                      <button key={t.id} className="dropdown-item" onClick={() => { setNewMenuOpen(false); onNewFromTemplate(t.id); }}>
                        <Icon name={t.icon || "doc"} size={14} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                      </button>
                    ))}
                    <div className="dropdown-divider"></div>
                  </>
                )}
                <button className="dropdown-item" onClick={() => { setNewMenuOpen(false); onManageTemplates(); }}>
                  <Icon name="settings" size={14} /> Templates verwalten
                </button>
                {onNewHermesProject && (
                  <>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item" onClick={() => { setNewMenuOpen(false); onNewHermesProject(); }}>
                      <Icon name="briefcase" size={14} /> HERMES-Projekt anlegen…
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {onCollapse && (
            <button
              className="icon-btn list-collapse-btn"
              onClick={onCollapse}
              title="Notizliste einklappen"
            >
              <Icon name="chevron-left" size={14} />
            </button>
          )}
        </div>

        <div className="search-wrap">
          <Icon name="search" size={14} />
          <input
            className="search"
            placeholder="Suchen…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="filter-row">
          <button className={"chip " + (typeFilter === "all" ? "active" : "")} onClick={() => onTypeFilter("all")}>
            Alle
          </button>
          <button className={"chip " + (typeFilter === "it" ? "active" : "")} onClick={() => onTypeFilter("it")}>
            <Icon name="terminal" size={11} />
            IT
          </button>
          <button className={"chip " + (typeFilter === "normal" ? "active" : "")} onClick={() => onTypeFilter("normal")}>
            <Icon name="doc" size={11} />
            Normal
          </button>
          {tagFilter && (
            <button className="chip active" onClick={() => onTagFilter(null)}>
              #{tagFilter}
              <Icon name="x" size={10} />
            </button>
          )}
        </div>

        {smartList.length > 0 && (() => {
          const visible = smartList
            .map(sf => ({ sf, count: notes.filter(sf.predicate).length }))
            .filter(x => x.count > 0);
          if (visible.length === 0) return null;
          return (
            <div className="filter-row">
              {visible.map(({ sf, count }) => (
                <button
                  key={sf.id}
                  className={"chip chip-smart " + (smartFilter === sf.id ? "active" : "")}
                  onClick={() => setSmartFilter(prev => prev === sf.id ? null : sf.id)}
                  title={`${sf.name} (${count})`}
                >
                  <Icon name={sf.icon || "filter"} size={10} />
                  {sf.name}
                  <span className="chip-count">{count}</span>
                </button>
              ))}
            </div>
          );
        })()}

        {tagsToShow.length > 0 && !tagFilter && (
          <div className="filter-row">
            {tagsToShow.map(([t, c]) => (
              <button key={t} className="chip" onClick={() => onTagFilter(t)}>
                #{t}
                <span style={{ opacity: 0.5 }}>{c}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="notes-list">
        {(() => {
          // Show subfolders of the currently-selected folder as opener cards at the top of the list
          const subfolders = (folder && onSelectFolder)
            ? folders.filter(f => f.parentId === folder.id)
            : [];
          if (subfolders.length === 0) return null;
          return (
            <div className="sublist-folders">
              <div className="sublist-folders-label">Unterordner</div>
              <div className="sublist-folders-grid">
                {subfolders.map(sf => {
                  // Recursive count of all descendant notes
                  const descIds = new Set([sf.id]);
                  let added = true;
                  while (added) {
                    added = false;
                    for (const f of folders) {
                      if (f.parentId && descIds.has(f.parentId) && !descIds.has(f.id)) {
                        descIds.add(f.id); added = true;
                      }
                    }
                  }
                  const total = notes.filter(n => descIds.has(n.folderId)).length;
                  return (
                    <button
                      key={sf.id}
                      className="sublist-folder"
                      onClick={() => onSelectFolder(sf.id)}
                      onDoubleClick={(e) => { e.stopPropagation(); onSelectFolder(sf.id); }}
                      title={`In ${sf.name} öffnen`}
                    >
                      <Icon name={sf.icon || "folder"} size={16} className="sublist-folder-ico" />
                      <span className="sublist-folder-name">{sf.name}</span>
                      <span className="sublist-folder-count">{total}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {sorted.length === 0 ? (
          (() => {
            const hasSub = folder && folders.some(f => f.parentId === folder.id);
            if (hasSub) {
              return (
                <div className="list-empty" style={{ padding: "16px 20px", textAlign: "left" }}>
                  <div style={{ fontSize: 12 }}>Keine Notizen direkt in diesem Ordner.</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Wähle einen Unterordner oben oder leg eine neue Notiz an.</div>
                </div>
              );
            }
            return (
              <div className="list-empty">
                <Icon name="inbox" size={40} />
                <div>Keine Notizen hier.</div>
                <div style={{ marginTop: 6 }}>Klick auf <b>Neu</b>, um zu starten.</div>
              </div>
            );
          })()
        ) : sorted.map(n => (
          <NoteListItem
            key={n.id}
            note={n}
            active={n.id === selectedNoteId}
            onClick={() => { onSelectNote(n.id); onMobileClose?.(); }}
            onDelete={onDeleteNote}
            onTogglePin={onTogglePin}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    </section>
  );
}

function NoteListItem({ note, active, onClick, onDelete, onTogglePin, onContextMenu }) {
  const preview = notePreview(note);
  // Preview badge mirrors the Kanban column (note.kanban)
  const k = note.kanban;
  const statusClass = k === "success" ? "success"
    : k === "error" ? "danger"
    : k === "warning" ? "warning"
    : k === "neutral" ? "neutral" : null;
  const statusText = k === "success" ? "Erledigt"
    : k === "error" ? "Blockiert"
    : k === "warning" ? "In Arbeit"
    : k === "neutral" ? "Offen" : null;
  return (
    <div
      className={"note-item " + (active ? "active" : "")}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu?.(e, note)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); }
      }}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-note-tool", JSON.stringify({ kind: "note", id: note.id }));
        e.dataTransfer.setData("text/plain", `note:${note.id}`);
      }}
    >
      <div className="note-item-row">
        <span className={"note-type-badge " + note.type}>
          {note.type === "it" ? "IT" : "Notiz"}
        </span>
        <div className="note-title">{note.title || "Ohne Titel"}</div>
        {note.pinned && <Icon name="star-fill" size={12} className="note-pin" />}
        {onDelete && (
          <button
            className="note-item-delete"
            title="Notiz löschen"
            onClick={(e) => { e.stopPropagation(); onDelete(note); }}
          >
            <Icon name="trash" size={13} />
          </button>
        )}
      </div>
      {preview && (
        <div className="note-preview" style={note.type === "it" ? { fontFamily: "var(--font-mono)", fontSize: 11 } : {}}>
          {preview}
        </div>
      )}
      <div className="note-meta">
        <span>{formatRel(note.updatedAt)}</span>
        {note.dueAt && (() => {
          const ms = new Date(note.dueAt).getTime() - Date.now();
          const overdue = ms < 0;
          const soon = !overdue && ms < 3 * 24 * 60 * 60 * 1000;
          const cls = overdue ? "overdue" : soon ? "soon" : "";
          const dayStr = new Date(note.dueAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
          return (
            <>
              <span className="dot-sep"></span>
              <span className={"note-due " + cls} title={"Fällig: " + new Date(note.dueAt).toLocaleString("de-DE")}>
                <Icon name="flag" size={10} />
                {overdue ? `Überfällig (${dayStr})` : `Fällig ${dayStr}`}
              </span>
            </>
          );
        })()}
        {statusClass && (
          <>
            <span className="dot-sep"></span>
            <span className={"note-status " + statusClass}>
              <span className={"status-dot " + statusClass}></span>
              {statusText}
            </span>
          </>
        )}
        {note.tags?.length > 0 && (
          <>
            <span className="dot-sep"></span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {note.tags.slice(0, 3).map(t => `#${t}`).join(" ")}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, NotesList });

// Curated icon set for notes & folders
const NOTE_ICONS = [
  "doc", "terminal", "code", "folder", "inbox", "star", "tag", "link", "pin", "bookmark",
  "image", "table", "check-square", "calendar", "alert", "check-circle", "settings", "edit",
  "home", "server", "database", "cloud", "key", "lock", "bell", "zap", "target",
  "package", "globe", "user", "mail", "heart", "flag", "fire", "briefcase",
  "archive", "clock", "eye", "smile", "compass", "wrench", "shield",
];

function IconPicker({ value, onChange, icons = NOTE_ICONS, size = 40, accent }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef();
  const btnRef = useRef();
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);
  return (
    <div className="icon-picker" ref={ref}>
      <button
        ref={btnRef}
        className={"icon-picker-btn" + (accent ? " accent" : "")}
        onClick={() => setOpen(v => !v)}
        title="Icon ändern"
        style={{ width: size, height: size }}
      >
        <Icon name={value || "doc"} size={Math.floor(size * 0.5)} />
      </button>
      {open && (
        <div className="icon-picker-grid" style={{ position: "fixed", top: pos.top, left: pos.left }}>
          {icons.map(name => (
            <button
              key={name}
              className={"icon-picker-item " + (name === value ? "active" : "")}
              onClick={() => { onChange(name); setOpen(false); }}
              title={name}
              type="button"
            >
              <Icon name={name} size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Stylized code-language selector — replaces the native <select>
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
  plain: "Plain text",
};

// Popular ones shown by default (first 8). Search reveals the rest.
const LANG_POPULAR = ["bash", "powershell", "python", "javascript", "typescript", "sql", "json", "yaml"];
const LANG_ALL = Object.keys(LANG_LABELS);

function LangSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [query, setQuery] = useState("");
  const ref = useRef();
  const btnRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Reset & focus the search field when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const cur = value || "bash";
  const q = query.trim().toLowerCase();
  const list = q
    ? LANG_ALL.filter(k => k.includes(q) || (LANG_LABELS[k] || "").toLowerCase().includes(q))
    : LANG_ALL;

  const select = (l) => { onChange(l); setOpen(false); };

  return (
    <div className="lang-select-wrap" ref={ref}>
      <button
        ref={btnRef}
        className="lang-select-btn"
        onClick={() => setOpen(v => !v)}
        title="Sprache wählen"
        type="button"
      >
        <span className={"lang-select-dot lang-" + cur + "-dot"}></span>
        <span className="lang-select-label">{LANG_LABELS[cur] || cur}</span>
        <Icon name="chevron-down" size={10} />
      </button>
      {open && (
        <div
          className="lang-select-menu"
          style={{ position: "fixed", top: pos.top, left: pos.left }}
        >
          <div className="lang-select-search">
            <Icon name="search" size={12} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Sprache suchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); }
                else if (e.key === "Enter" && list[0]) { select(list[0]); }
              }}
            />
            {query && (
              <button className="lang-search-clear" onClick={() => setQuery("")} type="button" title="Suche leeren">
                <Icon name="x" size={11} />
              </button>
            )}
          </div>
          <div className="lang-select-items">
            {list.length === 0 ? (
              <div className="lang-select-empty">Nichts gefunden</div>
            ) : list.map(o => (
              <button
                key={o}
                className={"lang-select-item " + (o === cur ? "active" : "")}
                onClick={() => select(o)}
                type="button"
              >
                <span className={"lang-select-dot lang-" + o + "-dot"}></span>
                <span>{LANG_LABELS[o] || o}</span>
                {o === cur && <Icon name="check" size={11} className="check" style={{ marginLeft: "auto", color: "var(--accent)" }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { IconPicker, LangSelect, NOTE_ICONS, LANG_LABELS });

// Generic styled dropdown — same look as LangSelect, but for arbitrary options.
// Use this instead of native <select>.
function StyledSelect({ value, onChange, options, placeholder, searchable = false, minWidth = 160, disabled }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [query, setQuery] = useState("");
  const ref = useRef();
  const btnRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
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

  // Normalize options: ["a","b"] or [{value, label, hint?}]
  const normOpts = (options || []).map(o => typeof o === "object" ? o : { value: o, label: o || "—" });
  const q = query.trim().toLowerCase();
  const list = q ? normOpts.filter(o => String(o.label).toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q)) : normOpts;

  const current = normOpts.find(o => o.value === value);
  const select = (v) => { onChange(v); setOpen(false); };

  return (
    <div className="lang-select-wrap" ref={ref}>
      <button
        ref={btnRef}
        className="lang-select-btn"
        onClick={() => !disabled && setOpen(v => !v)}
        type="button"
        disabled={disabled}
        style={{ minWidth }}
      >
        <span className="lang-select-label">{current?.label || placeholder || "—"}</span>
        <Icon name="chevron-down" size={10} />
      </button>
      {open && (
        <div className="lang-select-menu" style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(minWidth, 180) }}>
          {searchable && (
            <div className="lang-select-search">
              <Icon name="search" size={12} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Suchen…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  else if (e.key === "Enter" && list[0]) select(list[0].value);
                }}
              />
              {query && (
                <button className="lang-search-clear" onClick={() => setQuery("")} type="button">
                  <Icon name="x" size={11} />
                </button>
              )}
            </div>
          )}
          <div className="lang-select-items">
            {list.length === 0 ? (
              <div className="lang-select-empty">Nichts gefunden</div>
            ) : list.map(o => (
              <button
                key={o.value}
                className={"lang-select-item " + (o.value === value ? "active" : "")}
                onClick={() => select(o.value)}
                type="button"
              >
                <span>{o.label}</span>
                {o.value === value && <Icon name="check" size={11} className="check" style={{ marginLeft: "auto", color: "var(--accent)" }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { StyledSelect });

function ThemePicker({ themePref, theme, systemTheme, onChange, onToggle }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef();
  const btnRef = useRef();
  const menuRef = useRef();
  useEffect(() => {
    const close = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Position the dropdown via fixed coords so it never spills off-screen.
  // The brand row sits in a 240px-wide sidebar and the theme button is near its
  // right edge — a 200px-wide menu right-aligned to the button gets clipped by
  // the viewport. Clamp left to a safe margin.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const recompute = () => {
      const br = btnRef.current.getBoundingClientRect();
      const menuW = menuRef.current?.offsetWidth || 220;
      const margin = 8;
      let left = br.right - menuW;
      if (left < margin) left = margin;
      if (left + menuW > window.innerWidth - margin) left = window.innerWidth - menuW - margin;
      setPos({ top: br.bottom + 6, left });
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
  const options = [
    { value: "light", label: "Hell", icon: "sun" },
    { value: "dark", label: "Dunkel", icon: "moon" },
    { value: "auto", label: "Automatisch", icon: "monitor", hint: `Folgt System · gerade ${systemTheme === "dark" ? "Dunkel" : "Hell"}` },
  ];

  return (
    <div className="theme-picker" ref={ref} style={{ marginLeft: "auto", position: "relative" }}>
      <button
        ref={btnRef}
        className="theme-btn"
        onClick={() => setOpen(v => !v)}
        onDoubleClick={onToggle}
        title="Theme · Doppelklick zum Schnell-Wechseln (⌘⇧D)"
        aria-label="Theme wählen"
      >
        <span className={"theme-btn-bg " + (theme === "dark" ? "dark" : "light")}></span>
        <Icon name={currentIcon} size={15} />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="dropdown-menu"
          style={{
            position: "fixed",
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            right: "auto",
            minWidth: 220,
            visibility: pos ? "visible" : "hidden",
          }}
        >
          <div style={{ padding: "6px 10px 4px", fontSize: 10, fontWeight: 600, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Erscheinungsbild
          </div>
          {options.map(opt => (
            <button
              key={opt.value}
              className="dropdown-item"
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              <Icon name={opt.icon} size={14} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, flex: 1 }}>
                <span>{opt.label}</span>
                {opt.hint && <span style={{ fontSize: 10, color: "var(--text-subtle)", fontWeight: 400 }}>{opt.hint}</span>}
              </div>
              {themePref === opt.value && <Icon name="check" size={13} style={{ color: "var(--accent)" }} />}
            </button>
          ))}
          <div className="dropdown-divider"></div>
          <div style={{ padding: "4px 10px 6px", fontSize: 11, color: "var(--text-subtle)", display: "flex", justifyContent: "space-between" }}>
            <span>Schnell-Toggle</span>
            <span className="kbd" style={{ fontFamily: "var(--font-mono)" }}>⌘⇧D</span>
          </div>
        </div>
      )}
    </div>
  );
}
