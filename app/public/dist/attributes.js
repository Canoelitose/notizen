(function () {
  const {
    useState,
    useEffect,
    useMemo,
    useRef
  } = React;
  const STATUS_OPTIONS = [{
    value: "neutral",
    label: "Offen",
    dot: "neutral"
  }, {
    value: "warning",
    label: "In Arbeit",
    dot: "warning"
  }, {
    value: "success",
    label: "Erledigt",
    dot: "success"
  }, {
    value: "error",
    label: "Blockiert",
    dot: "danger"
  }];
  const PRIORITY_OPTIONS = [{
    value: "low",
    label: "Niedrig",
    color: "var(--text-subtle)"
  }, {
    value: "normal",
    label: "Normal",
    color: "var(--info)"
  }, {
    value: "high",
    label: "Hoch",
    color: "var(--warning)"
  }, {
    value: "urgent",
    label: "Dringend",
    color: "var(--danger)"
  }];
  function getNoteStatus(note) {
    return note.kanban || null;
  }
  function setNoteStatus(note, value) {
    return {
      ...note,
      kanban: value
    };
  }
  function ChipPopover({
    open,
    onClose,
    anchorRef,
    children,
    width = 200
  }) {
    const popRef = useRef(null);
    const [pos, setPos] = useState(null);
    useEffect(() => {
      if (!open || !anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + 4,
        left: Math.min(r.left, window.innerWidth - width - 12)
      });
    }, [open, anchorRef, width]);
    useEffect(() => {
      if (!open) return;
      const onDoc = e => {
        if (popRef.current?.contains(e.target)) return;
        if (anchorRef.current?.contains(e.target)) return;
        onClose();
      };
      const onKey = e => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDoc);
        document.removeEventListener("keydown", onKey);
      };
    }, [open, onClose, anchorRef]);
    if (!open || !pos) return null;
    return ReactDOM.createPortal(React.createElement("div", {
      ref: popRef,
      className: "note-attr-pop",
      style: {
        top: pos.top,
        left: pos.left,
        width
      }
    }, children), document.body);
  }
  function InlineCalendar({
    value,
    onChange,
    onClear
  }) {
    const today = new Date();
    const [view, setView] = useState(() => {
      const d = value ? new Date(value) : today;
      return {
        y: d.getFullYear(),
        m: d.getMonth()
      };
    });
    const selected = value ? new Date(value) : null;
    const days = useMemo(() => {
      const first = new Date(view.y, view.m, 1);
      const firstWeekday = (first.getDay() + 6) % 7;
      const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
      const cells = [];
      for (let i = firstWeekday - 1; i >= 0; i--) {
        const d = new Date(view.y, view.m, -i);
        cells.push({
          day: d.getDate(),
          date: d,
          outside: true
        });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        cells.push({
          day: d,
          date: new Date(view.y, view.m, d)
        });
      }
      while (cells.length % 7 !== 0) {
        const d = cells[cells.length - 1].date;
        const next = new Date(d);
        next.setDate(d.getDate() + 1);
        cells.push({
          day: next.getDate(),
          date: next,
          outside: true
        });
      }
      return cells;
    }, [view]);
    const monthLabel = new Date(view.y, view.m).toLocaleDateString("de", {
      month: "long",
      year: "numeric"
    });
    const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    return React.createElement("div", {
      className: "note-attr-cal"
    }, React.createElement("div", {
      className: "note-attr-cal-head"
    }, React.createElement("button", {
      type: "button",
      className: "dtp-nav-btn",
      onClick: () => setView(v => ({
        y: v.m === 0 ? v.y - 1 : v.y,
        m: (v.m + 11) % 12
      }))
    }, React.createElement(Icon, {
      name: "chevron-left",
      size: 12
    })), React.createElement("span", null, monthLabel), React.createElement("button", {
      type: "button",
      className: "dtp-nav-btn",
      onClick: () => setView(v => ({
        y: v.m === 11 ? v.y + 1 : v.y,
        m: (v.m + 1) % 12
      }))
    }, React.createElement(Icon, {
      name: "chevron-right",
      size: 12
    }))), React.createElement("div", {
      className: "note-attr-cal-weekdays"
    }, ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(w => React.createElement("div", {
      key: w
    }, w))), React.createElement("div", {
      className: "note-attr-cal-grid"
    }, days.map((c, i) => {
      const isToday = sameDay(c.date, today);
      const isSel = sameDay(c.date, selected);
      return React.createElement("button", {
        key: i,
        type: "button",
        className: "note-attr-cal-cell" + (c.outside ? " outside" : "") + (isToday ? " today" : "") + (isSel ? " selected" : ""),
        onClick: () => onChange(c.date.toISOString())
      }, c.day);
    })), React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 6,
        padding: "8px 4px 0",
        borderTop: "1px solid var(--border)",
        marginTop: 4
      }
    }, React.createElement("button", {
      type: "button",
      className: "btn sm ghost",
      onClick: () => onChange(today.toISOString())
    }, "Heute"), value && React.createElement("button", {
      type: "button",
      className: "btn sm ghost",
      onClick: onClear,
      style: {
        color: "var(--danger)"
      }
    }, "Entfernen")));
  }
  function NoteAttributesBar({
    note,
    onChange
  }) {
    const update = patch => onChange({
      ...note,
      ...patch,
      updatedAt: new Date().toISOString()
    });
    const [openKey, setOpenKey] = useState(null);
    const statusRef = useRef(null);
    const prioRef = useRef(null);
    const dueRef = useRef(null);
    const assigneeRef = useRef(null);
    const [assigneeDraft, setAssigneeDraft] = useState(note.assignee || "");
    useEffect(() => {
      setAssigneeDraft(note.assignee || "");
    }, [note.id, note.assignee]);
    const status = getNoteStatus(note);
    const statusOpt = STATUS_OPTIONS.find(s => s.value === status);
    const priority = note.priority || null;
    const prioOpt = PRIORITY_OPTIONS.find(p => p.value === priority);
    const due = note.dueAt;
    let dueLabel = "Fällig",
      dueState = "";
    if (due) {
      const d = new Date(due);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dd = new Date(d);
      dd.setHours(0, 0, 0, 0);
      const diffDays = Math.round((dd - today) / (24 * 3600 * 1000));
      if (diffDays < 0) {
        dueLabel = d.toLocaleDateString("de", {
          day: "2-digit",
          month: "short"
        });
        dueState = "overdue";
      } else if (diffDays === 0) {
        dueLabel = "Heute";
        dueState = "today";
      } else if (diffDays === 1) {
        dueLabel = "Morgen";
        dueState = "soon";
      } else if (diffDays < 7) {
        dueLabel = `In ${diffDays} Tagen`;
        dueState = "soon";
      } else {
        dueLabel = d.toLocaleDateString("de", {
          day: "2-digit",
          month: "short",
          year: "2-digit"
        });
      }
    }
    return React.createElement("div", {
      className: "note-attrs"
    }, React.createElement("button", {
      ref: statusRef,
      type: "button",
      className: "note-attr-chip" + (status ? " filled" : ""),
      onClick: () => setOpenKey(k => k === "status" ? null : "status"),
      title: "Kanban-Status"
    }, React.createElement("span", {
      className: "status-dot " + (statusOpt?.dot || "neutral")
    }), React.createElement("span", null, statusOpt?.label || "Kanban")), React.createElement(ChipPopover, {
      open: openKey === "status",
      onClose: () => setOpenKey(null),
      anchorRef: statusRef,
      width: 180
    }, React.createElement("div", {
      className: "note-attr-pop-list"
    }, STATUS_OPTIONS.map(s => React.createElement("button", {
      key: s.value,
      type: "button",
      className: "note-attr-pop-item" + (s.value === status ? " active" : ""),
      onClick: () => {
        onChange(setNoteStatus(note, s.value));
        setOpenKey(null);
      }
    }, React.createElement("span", {
      className: "status-dot " + s.dot
    }), React.createElement("span", null, s.label))), status && React.createElement("button", {
      type: "button",
      className: "note-attr-pop-item note-attr-pop-clear",
      onClick: () => {
        onChange(setNoteStatus(note, null));
        setOpenKey(null);
      }
    }, React.createElement(Icon, {
      name: "x",
      size: 10
    }), " Status entfernen"))), React.createElement("button", {
      ref: prioRef,
      type: "button",
      className: "note-attr-chip" + (priority ? " filled" : ""),
      onClick: () => setOpenKey(k => k === "prio" ? null : "prio"),
      title: "Priorit\xE4t"
    }, React.createElement(Icon, {
      name: "flag",
      size: 11,
      style: {
        color: prioOpt?.color
      }
    }), React.createElement("span", null, prioOpt?.label || "Priorität")), React.createElement(ChipPopover, {
      open: openKey === "prio",
      onClose: () => setOpenKey(null),
      anchorRef: prioRef,
      width: 180
    }, React.createElement("div", {
      className: "note-attr-pop-list"
    }, PRIORITY_OPTIONS.map(p => React.createElement("button", {
      key: p.value,
      type: "button",
      className: "note-attr-pop-item" + (p.value === priority ? " active" : ""),
      onClick: () => {
        update({
          priority: p.value
        });
        setOpenKey(null);
      }
    }, React.createElement(Icon, {
      name: "flag",
      size: 11,
      style: {
        color: p.color
      }
    }), React.createElement("span", null, p.label))), priority && React.createElement("button", {
      type: "button",
      className: "note-attr-pop-item note-attr-pop-clear",
      onClick: () => {
        update({
          priority: null
        });
        setOpenKey(null);
      }
    }, React.createElement(Icon, {
      name: "x",
      size: 10
    }), " Priorit\xE4t entfernen"))), React.createElement("button", {
      ref: dueRef,
      type: "button",
      className: "note-attr-chip" + (due ? " filled due-" + dueState : ""),
      onClick: () => setOpenKey(k => k === "due" ? null : "due"),
      title: "F\xE4llig am"
    }, React.createElement(Icon, {
      name: "calendar",
      size: 11
    }), React.createElement("span", null, dueLabel)), React.createElement(ChipPopover, {
      open: openKey === "due",
      onClose: () => setOpenKey(null),
      anchorRef: dueRef,
      width: 260
    }, React.createElement(InlineCalendar, {
      value: due || null,
      onChange: iso => {
        update({
          dueAt: iso
        });
        setOpenKey(null);
      },
      onClear: () => {
        update({
          dueAt: null
        });
        setOpenKey(null);
      }
    })), React.createElement("button", {
      ref: assigneeRef,
      type: "button",
      className: "note-attr-chip" + (note.assignee ? " filled" : ""),
      onClick: () => setOpenKey(k => k === "ass" ? null : "ass"),
      title: "Zust\xE4ndige Person"
    }, React.createElement(Icon, {
      name: "user",
      size: 11
    }), React.createElement("span", null, note.assignee || "Zuständig")), React.createElement(ChipPopover, {
      open: openKey === "ass",
      onClose: () => {
        update({
          assignee: assigneeDraft.trim() || null
        });
        setOpenKey(null);
      },
      anchorRef: assigneeRef,
      width: 220
    }, React.createElement("div", {
      style: {
        padding: 8
      }
    }, React.createElement("input", {
      autoFocus: true,
      className: "field-input",
      placeholder: "Name eingeben\u2026",
      value: assigneeDraft,
      onChange: e => setAssigneeDraft(e.target.value),
      onKeyDown: e => {
        if (e.key === "Enter") {
          update({
            assignee: assigneeDraft.trim() || null
          });
          setOpenKey(null);
        }
      },
      style: {
        width: "100%"
      }
    }))));
  }
  Object.assign(window, {
    NoteAttributesBar,
    getNoteStatus,
    setNoteStatus,
    STATUS_OPTIONS,
    PRIORITY_OPTIONS
  });
})();