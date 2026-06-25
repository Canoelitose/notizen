// Editors — IT editor + Normal editor with blocks
const { useState: useStateE, useRef: useRefE, useEffect: useEffectE, useMemo: useMemoE } = React;

// Wiki-link context: lets text blocks navigate to other notes via [[Notizname]]
const NotesNavContext = React.createContext({ notes: [], onSelectNote: () => {} });

// Parse text and render with [[Notizname]] tokens turned into clickable links.
// Existing notes -> accent-colored link.  Missing notes -> dashed gray placeholder.
function renderWithWikiLinks(text, notes, onSelectNote) {
  if (!text) return null;
  const re = /\[\[([^\]\n]+)\]\]/g;
  const parts = [];
  let lastIdx = 0;
  let m;
  let i = 0;
  const findTarget = (name) => {
    const n = name.trim().toLowerCase();
    return notes.find(note => {
      const t = (note.title || "").trim().toLowerCase();
      if (t === n) return true;
      // Match without leading "NN — " or "NN - " prefix (e.g. "05 — Risikoliste")
      const stripped = t.replace(/^\d+\s*[—–\-]\s*/, "").trim();
      return stripped === n;
    });
  };
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    const name = m[1].trim();
    const target = findTarget(name);
    parts.push(
      <button
        key={"wiki-" + (i++)}
        type="button"
        className={"wiki-link" + (target ? "" : " missing")}
        onClick={(e) => { e.preventDefault(); if (target) onSelectNote(target.id); }}
        title={target ? `Zu „${target.title}" springen` : `Keine Notiz mit dem Titel „${name}"`}
      >
        <Icon name={target ? "link" : "alert"} size={10} />
        {name}
      </button>
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

// ---------- Shared bits ----------

function TagsEditor({ tags, onChange }) {
  const [draft, setDraft] = useStateE("");
  const add = (val) => {
    const t = val.trim().replace(/^#/, "").toLowerCase();
    if (!t || (tags || []).includes(t)) return;
    onChange([...(tags || []), t]);
    setDraft("");
  };
  return (
    <div className="tag-input-wrap">
      {(tags || []).map(t => (
        <span className="tag" key={t}>
          #{t}
          <button onClick={() => onChange(tags.filter(x => x !== t))} aria-label="Tag entfernen">
            <Icon name="x" size={10} />
          </button>
        </span>
      ))}
      <input
        className="tag-input"
        placeholder={(tags || []).length === 0 ? "Tag hinzufügen, Enter zum bestätigen…" : ""}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
          if (e.key === "Backspace" && !draft && tags?.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => add(draft)}
      />
    </div>
  );
}

function CodeBlock({
  value, onChange,
  lang, onLangChange,
  output, onOutputChange,             // attached output text
  hasOutput,                          // render the attached output section
  canToggleOutput, onToggleOutput,    // show "+ Output" / "Output entfernen" button
  outputLabel,
  languages, onCopy,
  placeholder,
}) {
  const [copied, setCopied] = useStateE(false);
  const [outputCopied, setOutputCopied] = useStateE(false);
  const [viewing, setViewing] = useStateE(false);
  const taRef = useRefE();
  const outRef = useRefE();
  const preRef = useRefE();

  const copy = async (text, which) => {
    const ok = await copyToClipboard(text || "");
    if (!ok) return;
    if (which === "output") {
      setOutputCopied(true);
      setTimeout(() => setOutputCopied(false), 1500);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
    onCopy?.();
  };

  // Auto-grow command (cap at 480px so it scrolls past that)
  useEffectE(() => {
    if (!taRef.current || viewing) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.min(480, Math.max(60, taRef.current.scrollHeight)) + "px";
  }, [value, viewing]);

  // Auto-grow output (cap at 360px)
  useEffectE(() => {
    if (!outRef.current) return;
    outRef.current.style.height = "auto";
    outRef.current.style.height = Math.min(360, Math.max(60, outRef.current.scrollHeight)) + "px";
  }, [output, hasOutput]);

  // Highlight command preview
  useEffectE(() => {
    if (viewing && preRef.current && window.Prism) {
      window.Prism.highlightElement(preRef.current.querySelector("code"));
    }
  }, [viewing, value, lang]);

  const langs = languages || ["bash", "powershell", "python", "javascript", "typescript", "sql", "json", "yaml", "docker"];

  return (
    <div className="code-block">
      <div className="code-block-header">
        {window.LangSelect ? (
          <window.LangSelect value={lang || "bash"} onChange={onLangChange} options={langs} />
        ) : window.StyledSelect ? (
          <window.StyledSelect value={lang || "bash"} onChange={onLangChange} options={langs} minWidth={120} />
        ) : (
          <select className="lang-select" value={lang || "bash"} onChange={(e) => onLangChange?.(e.target.value)}>
            {langs.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        {canToggleOutput && (
          <button
            className={"copy-btn output-toggle" + (hasOutput ? " on" : "")}
            onClick={onToggleOutput}
            title={hasOutput ? "Output entfernen" : "Output unten anhängen"}
          >
            <Icon name={hasOutput ? "x" : "plus"} size={11} />
            <span className="label">Output</span>
          </button>
        )}
        <button className="copy-btn" onClick={() => setViewing(v => !v)} title={viewing ? "Bearbeiten" : "Vorschau mit Highlighting"}>
          <Icon name={viewing ? "edit" : "code"} size={11} />
          <span className="label">{viewing ? "Bearbeiten" : "Highlight"}</span>
        </button>
        <button className={"copy-btn" + (copied ? " copied" : "")} onClick={() => copy(value, "cmd")} title="Befehl kopieren">
          <Icon name={copied ? "check" : "copy"} size={11} />
          <span className="label">{copied ? "Kopiert" : "Kopieren"}</span>
        </button>
      </div>
      {viewing ? (
        <pre ref={preRef}><code className={"language-" + (lang || "bash")}>{value || ""}</code></pre>
      ) : (
        <textarea
          ref={taRef}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Befehl hier eingeben…"}
          spellCheck={false}
        />
      )}
      {hasOutput && (
        <>
          <div className="code-block-divider">
            <span>{outputLabel || "Output"}</span>
            <button className={"copy-btn" + (outputCopied ? " copied" : "")} style={{ marginLeft: "auto" }} onClick={() => copy(output, "output")} title="Output kopieren">
              <Icon name={outputCopied ? "check" : "copy"} size={11} />
              <span className="label">{outputCopied ? "Kopiert" : "Kopieren"}</span>
            </button>
          </div>
          <textarea
            ref={outRef}
            className="code-output"
            value={output || ""}
            onChange={(e) => onOutputChange?.(e.target.value)}
            placeholder="Output / Resultat hier einfügen…"
            spellCheck={false}
          />
        </>
      )}
    </div>
  );
}

function LinksEditor({ links, onChange }) {
  const update = (id, key, val) => onChange(links.map(l => l.id === id ? { ...l, [key]: val } : l));
  const remove = (id) => onChange(links.filter(l => l.id !== id));
  const add = () => onChange([...(links || []), { id: uid(), label: "", url: "" }]);
  return (
    <div className="links-list">
      {(links || []).map(l => (
        <div className="link-row" key={l.id}>
          <Icon name="link" size={14} style={{ color: "var(--text-subtle)" }} />
          <input
            placeholder="Beschriftung"
            value={l.label}
            onChange={(e) => update(l.id, "label", e.target.value)}
            style={{ maxWidth: 180 }}
          />
          <input
            placeholder="https://…"
            value={l.url}
            onChange={(e) => update(l.id, "url", e.target.value)}
          />
          {l.url && (
            <a href={l.url} target="_blank" rel="noreferrer" title="Öffnen" style={{ color: "var(--text-muted)" }}>
              <Icon name="external" size={14} />
            </a>
          )}
          <button className="icon-btn" onClick={() => remove(l.id)} title="Entfernen">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <button className="btn ghost sm" onClick={add} style={{ alignSelf: "flex-start" }}>
        <Icon name="plus" size={12} /> Link hinzufügen
      </button>
    </div>
  );
}

// ---------- DateTime editor (compact popover + custom calendar) ----------
const MONTH_NAMES_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const WEEKDAYS_DE = ["Mo","Di","Mi","Do","Fr","Sa","So"];

function DueDateBadge({ note, update }) {
  const due = note.dueAt;
  let stateCls = "";
  if (due) {
    const ms = new Date(due).getTime() - Date.now();
    if (ms < 0) stateCls = " overdue";
    else if (ms < 3 * 24 * 60 * 60 * 1000) stateCls = " soon";
  }
  return (
    <>
      <span className="sep"></span>
      <span className={"due-badge" + stateCls + (due ? " set" : "")}>
        <DateTimeEditor
          value={due || null}
          onChange={(iso) => update({ dueAt: iso })}
          label="Fällig am"
          clearable
          placeholder="+ Fälligkeit"
          icon="flag"
        />
      </span>
    </>
  );
}

function DateTimeEditor({ value, onChange, label = "Erstellt am", clearable = false, placeholder = "—", icon = "calendar" }) {
  const [open, setOpen] = useStateE(false);
  const [calOpen, setCalOpen] = useStateE(false);
  const [alignRight, setAlignRight] = useStateE(false);
  const ref = useRefE();
  const popRef = useRefE();

  useEffectE(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) { setOpen(false); setCalOpen(false); } };
    const key = (e) => { if (e.key === "Escape") { setOpen(false); setCalOpen(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  // Reset calOpen when closing
  useEffectE(() => { if (!open) setCalOpen(false); }, [open]);

  // Flip popover to right-anchor when it would overflow the viewport
  useEffectE(() => {
    if (!open) return;
    const measure = () => {
      const pop = popRef.current;
      if (!pop) return;
      const rect = pop.getBoundingClientRect();
      const overflow = rect.right > window.innerWidth - 8;
      setAlignRight(prev => overflow || prev && rect.left < 8 ? overflow : prev);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  const current = value ? new Date(value) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${pad(current.getDate())}.${pad(current.getMonth() + 1)}.${current.getFullYear()}`;
  const timeStr = `${pad(current.getHours())}:${pad(current.getMinutes())}`;

  // Try to parse user-typed strings; if invalid, leave value untouched
  const tryUpdate = (newDateStr, newTimeStr) => {
    const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(newDateStr.trim());
    const tm = /^(\d{1,2}):(\d{1,2})$/.exec(newTimeStr.trim());
    if (!dm || !tm) return false;
    const day = +dm[1], mon = +dm[2] - 1, yr = +dm[3];
    const h = +tm[1], mi = +tm[2];
    if (mon < 0 || mon > 11 || day < 1 || day > 31 || h > 23 || mi > 59) return false;
    const d = new Date(yr, mon, day, h, mi, 0, 0);
    if (isNaN(d.getTime())) return false;
    onChange(d.toISOString());
    return true;
  };

  return (
    <span className="datetime-editor" ref={ref}>
      <button
        type="button"
        className="datetime-trigger"
        onClick={() => setOpen(v => !v)}
        title="Datum & Uhrzeit ändern"
      >
        <Icon name={icon} size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        {value ? formatDateTime(value) : placeholder}
      </button>
      {open && (
        <div ref={popRef} className={"dt-popover" + (alignRight ? " right" : "")}>
          <div className="dt-popover-label">{label}</div>
          <DTInlineInput
            dateStr={dateStr}
            timeStr={timeStr}
            onCommit={tryUpdate}
            onToggleCal={() => setCalOpen(v => !v)}
            calOpen={calOpen}
          />
          {calOpen && (
            <DateTimeCalendar
              value={value || new Date().toISOString()}
              onPick={(iso) => onChange(iso)}
            />
          )}
          <div className="dt-popover-actions">
            {clearable && value && (
              <button
                type="button"
                className="btn sm danger"
                onClick={() => { onChange(null); setOpen(false); setCalOpen(false); }}
                style={{ marginRight: "auto" }}
                title="Datum entfernen"
              >
                <Icon name="x" size={12} /> Entfernen
              </button>
            )}
            <button
              type="button"
              className="btn sm"
              onClick={() => { onChange(nowIso()); }}
            >
              <Icon name="zap" size={12} /> Jetzt
            </button>
            <button
              type="button"
              className="btn sm accent"
              onClick={() => { setOpen(false); setCalOpen(false); }}
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

function DTInlineInput({ dateStr, timeStr, onCommit, onToggleCal, calOpen }) {
  // Parse current value into segments
  const parse = () => {
    const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(dateStr);
    const tm = /^(\d{1,2}):(\d{1,2})$/.exec(timeStr);
    return {
      day: dm ? dm[1].padStart(2, "0") : "01",
      month: dm ? dm[2].padStart(2, "0") : "01",
      year: dm ? dm[3] : "2025",
      hour: tm ? tm[1].padStart(2, "0") : "00",
      minute: tm ? tm[2].padStart(2, "0") : "00",
    };
  };
  const [seg, setSeg] = useStateE(parse);
  useEffectE(() => { setSeg(parse()); }, [dateStr, timeStr]);

  const refs = {
    day: useRefE(), month: useRefE(), year: useRefE(),
    hour: useRefE(), minute: useRefE(),
  };
  const order = ["day", "month", "year", "hour", "minute"];
  const maxLen = { day: 2, month: 2, year: 4, hour: 2, minute: 2 };

  const commit = (s = seg) => {
    const d = `${s.day}.${s.month}.${s.year}`;
    const t = `${s.hour}:${s.minute}`;
    onCommit(d, t);
  };

  const handleChange = (key) => (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, maxLen[key]);
    const next = { ...seg, [key]: v };
    setSeg(next);
    // Auto-advance when this segment is full
    if (v.length === maxLen[key]) {
      const idx = order.indexOf(key);
      const nextKey = order[idx + 1];
      if (nextKey) {
        // Defer focus so React finishes the update first
        setTimeout(() => {
          refs[nextKey].current?.focus();
          refs[nextKey].current?.select();
        }, 0);
      }
    }
  };

  const handleKey = (key) => (e) => {
    const idx = order.indexOf(key);
    if (e.key === "Enter") { e.preventDefault(); pad(); commit(); }
    else if (e.key === "ArrowRight" && e.target.selectionStart === e.target.value.length) {
      const nk = order[idx + 1];
      if (nk) { e.preventDefault(); refs[nk].current?.focus(); refs[nk].current?.select(); }
    } else if (e.key === "ArrowLeft" && e.target.selectionStart === 0) {
      const pk = order[idx - 1];
      if (pk) { e.preventDefault(); refs[pk].current?.focus(); refs[pk].current?.select(); }
    } else if (e.key === "Backspace" && e.target.value === "") {
      const pk = order[idx - 1];
      if (pk) { e.preventDefault(); refs[pk].current?.focus(); refs[pk].current?.select(); }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const v = parseInt(seg[key] || "0", 10);
      const delta = e.key === "ArrowUp" ? 1 : -1;
      let max = 99, min = 0;
      if (key === "day") { max = 31; min = 1; }
      else if (key === "month") { max = 12; min = 1; }
      else if (key === "year") { max = 9999; min = 1900; }
      else if (key === "hour") { max = 23; min = 0; }
      else if (key === "minute") { max = 59; min = 0; }
      let nv = v + delta;
      if (nv > max) nv = min;
      if (nv < min) nv = max;
      const padded = String(nv).padStart(maxLen[key], "0");
      const next = { ...seg, [key]: padded };
      setSeg(next);
      commit(next);
    }
  };

  // Normalize on blur and commit
  const pad = () => {
    setSeg(s => {
      const next = {
        day: s.day.padStart(2, "0") || "01",
        month: s.month.padStart(2, "0") || "01",
        year: (s.year || "2025").padStart(4, "0"),
        hour: s.hour.padStart(2, "0") || "00",
        minute: s.minute.padStart(2, "0") || "00",
      };
      onCommit(`${next.day}.${next.month}.${next.year}`, `${next.hour}:${next.minute}`);
      return next;
    });
  };

  const segInput = (key, width) => (
    <input
      ref={refs[key]}
      type="text"
      className="dt-seg"
      style={{ width }}
      value={seg[key]}
      onChange={handleChange(key)}
      onKeyDown={handleKey(key)}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.target.select()}
      onBlur={pad}
      inputMode="numeric"
      aria-label={key}
    />
  );

  return (
    <div className="dt-field">
      <div className="dt-seg-group">
        {segInput("day", 26)}
        <span className="dt-seg-sep">.</span>
        {segInput("month", 26)}
        <span className="dt-seg-sep">.</span>
        {segInput("year", 44)}
      </div>
      <div className="dt-seg-group">
        {segInput("hour", 26)}
        <span className="dt-seg-sep">:</span>
        {segInput("minute", 26)}
      </div>
      <button
        type="button"
        className={"dt-cal-btn" + (calOpen ? " active" : "")}
        onClick={onToggleCal}
        title={calOpen ? "Kalender schließen" : "Kalender öffnen"}
        aria-pressed={calOpen}
      >
        <Icon name="calendar" size={14} />
      </button>
    </div>
  );
}

function DateTimeCalendar({ value, onPick }) {
  const d = new Date(value);
  const [viewMonth, setViewMonth] = useStateE(d.getMonth());
  const [viewYear, setViewYear] = useStateE(d.getFullYear());

  useEffectE(() => {
    const dd = new Date(value);
    setViewMonth(dd.getMonth());
    setViewYear(dd.getFullYear());
  }, [value]);

  const selected = new Date(value);
  const now = new Date();
  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastOfMonth.getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  for (let i = 0; i < 42; i++) {
    let day, m, y, outside;
    if (i < startWeekday) {
      day = prevMonthDays - (startWeekday - 1 - i);
      m = viewMonth === 0 ? 11 : viewMonth - 1;
      y = viewMonth === 0 ? viewYear - 1 : viewYear;
      outside = true;
    } else if (i >= startWeekday + daysInMonth) {
      day = i - startWeekday - daysInMonth + 1;
      m = viewMonth === 11 ? 0 : viewMonth + 1;
      y = viewMonth === 11 ? viewYear + 1 : viewYear;
      outside = true;
    } else {
      day = i - startWeekday + 1;
      m = viewMonth;
      y = viewYear;
      outside = false;
    }
    cells.push({ day, m, y, outside });
  }

  const pickDay = (cell) => {
    const dd = new Date(cell.y, cell.m, cell.day, selected.getHours(), selected.getMinutes(), 0, 0);
    onPick(dd.toISOString());
    if (cell.outside) {
      setViewMonth(cell.m);
      setViewYear(cell.y);
    }
  };

  return (
    <div className="dtp-cal">
      <div className="dtp-header">
        <div className="dtp-month-label">{MONTH_NAMES_DE[viewMonth]} {viewYear}</div>
        <div className="dtp-nav">
          <button type="button" className="dtp-nav-btn" onClick={goPrev} aria-label="Vorheriger Monat">
            <Icon name="chevron-left" size={14} />
          </button>
          <button type="button" className="dtp-nav-btn" onClick={goNext} aria-label="Nächster Monat">
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </div>
      <div className="dtp-weekdays">
        {WEEKDAYS_DE.map((w) => <div key={w} className="dtp-weekday">{w}</div>)}
      </div>
      <div className="dtp-grid">
        {cells.map((c, i) => {
          const isToday = c.y === today.y && c.m === today.m && c.day === today.d;
          const isSel = c.y === selected.getFullYear() && c.m === selected.getMonth() && c.day === selected.getDate();
          return (
            <button
              key={i}
              type="button"
              className={
                "dtp-cell"
                + (c.outside ? " outside" : "")
                + (isToday ? " today" : "")
                + (isSel ? " selected" : "")
              }
              onClick={() => pickDay(c)}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- IT editor ----------

// ---------- IT editor ----------

function ITEditor({ note, onChange, onToast, editMode }) {
  const update = (patch) => onChange({ ...note, ...patch, updatedAt: nowIso() });

  return (
    <div className="editor-inner">
      <div className="editor-header-row">
        <window.IconPicker
          value={note.icon || "terminal"}
          onChange={(icon) => update({ icon })}
          size={48}
          accent
        />
        <input
          className="editor-title"
          placeholder="Titel der IT-Notiz…"
          value={note.title || ""}
          onChange={(e) => update({ title: e.target.value })}
        />
      </div>
      <div className="editor-meta-row">
        <span className="note-type-badge it">IT-Notiz</span>
        <span className="sep"></span>
        <DateTimeEditor value={note.createdAt} onChange={(iso) => update({ createdAt: iso })} />
        <span className="sep"></span>
        <span>Aktualisiert {formatRel(note.updatedAt)}</span>
        <DueDateBadge note={note} update={update} />
      </div>

      {window.NoteAttributesBar && <window.NoteAttributesBar note={note} onChange={onChange} />}

      <div className="field">
        <div className="field-label">Status</div>
        <div className="seg">
          {[
            { val: "success", label: "Erfolgreich", cls: "success" },
            { val: "warning", label: "Warnung", cls: "warning" },
            { val: "error", label: "Fehler", cls: "danger" },
            { val: "neutral", label: "Hinweis", cls: "" },
          ].map(opt => (
            <button
              key={opt.val}
              className={(note.status === opt.val ? "active " + opt.cls : "")}
              onClick={() => update({ status: opt.val })}
            >
              <span className={"status-dot " + (opt.cls || "neutral")}></span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="field-label"><Icon name="terminal" size={12} /> Befehl & Output</div>
        <CodeBlock
          value={note.command || ""}
          onChange={(v) => update({ command: v })}
          lang={note.commandLang || "bash"}
          onLangChange={(l) => update({ commandLang: l })}
          hasOutput
          output={note.output || ""}
          onOutputChange={(v) => update({ output: v })}
          outputLabel="Output / Resultat"
          onCopy={() => onToast("Kopiert")}
        />
      </div>

      <div className="field">
        <div className="field-label">Beschreibung / Kontext</div>
        <textarea
          className="field-textarea"
          placeholder="Was macht der Befehl? Warum hast du ihn gebraucht? Was solltest du beim nächsten Mal beachten?"
          value={note.description || ""}
          onChange={(e) => update({ description: e.target.value })}
        />
      </div>

      <div className="field">
        <div className="field-label"><Icon name="tag" size={12} /> Tags</div>
        <TagsEditor tags={note.tags} onChange={(t) => update({ tags: t })} />
      </div>

      <div className="field">
        <div className="field-label"><Icon name="link" size={12} /> Verwandte Links</div>
        <LinksEditor links={note.links || []} onChange={(l) => update({ links: l })} />
      </div>
    </div>
  );
}

// ---------- Normal editor ----------

function NormalEditor({ note, onChange, onToast, editMode, notes: allNotes = [], folders: allFolders = [], onSelectNote = () => {} }) {
  const update = (patch) => onChange({ ...note, ...patch, updatedAt: nowIso() });
  const blocks = note.blocks || [];
  const [dragId, setDragId] = useStateE(null);
  const [overId, setOverId] = useStateE(null);
  const [overPos, setOverPos] = useStateE(null); // 'before' | 'after'

  const setBlock = (id, patch) => update({ blocks: blocks.map(b => b.id === id ? { ...b, ...patch } : b) });
  const removeBlock = (id) => update({ blocks: blocks.filter(b => b.id !== id) });
  const reorderBlock = (srcId, targetId, pos) => {
    if (!srcId || !targetId || srcId === targetId) return;
    const src = blocks.find(b => b.id === srcId);
    if (!src) return;
    const without = blocks.filter(b => b.id !== srcId);
    const targetIdx = without.findIndex(b => b.id === targetId);
    if (targetIdx < 0) return;
    const insertAt = pos === "after" ? targetIdx + 1 : targetIdx;
    const next = [...without.slice(0, insertAt), src, ...without.slice(insertAt)];
    update({ blocks: next });
  };
  const addBlock = (kind, afterId = null) => {
    const newBlock = makeBlock(kind);
    if (!afterId) {
      update({ blocks: [...blocks, newBlock] });
    } else {
      const i = blocks.findIndex(b => b.id === afterId);
      const arr = [...blocks];
      arr.splice(i + 1, 0, newBlock);
      update({ blocks: arr });
    }
    return newBlock.id;
  };

  return (
    <NotesNavContext.Provider value={{ notes: allNotes, folders: allFolders, onSelectNote }}>
    <div className="editor-inner">
      <div className="editor-header-row">
        <window.IconPicker
          value={note.icon || "doc"}
          onChange={(icon) => update({ icon })}
          size={48}
        />
        <input
          className="editor-title"
          placeholder="Notiztitel…"
          value={note.title || ""}
          onChange={(e) => update({ title: e.target.value })}
        />
      </div>
      <div className="editor-meta-row">
        <span className="note-type-badge normal">Notiz</span>
        <span className="sep"></span>
        <DateTimeEditor value={note.createdAt} onChange={(iso) => update({ createdAt: iso })} />
        <span className="sep"></span>
        <span>Aktualisiert {formatRel(note.updatedAt)}</span>
        <DueDateBadge note={note} update={update} />
      </div>

      {window.NoteAttributesBar && <window.NoteAttributesBar note={note} onChange={onChange} />}

      <div className="field" style={{ marginBottom: 28 }}>
        <TagsEditor tags={note.tags} onChange={(t) => update({ tags: t })} />
      </div>

      {blocks.length === 0 && !editMode && (
        <div className="ro-empty" style={{ padding: 20, textAlign: "center" }}>
          Diese Notiz ist leer. Aktiviere <b>Bearbeiten</b>, um Blöcke hinzuzufügen.
        </div>
      )}

      <div className="blocks">
        {blocks.map((b, i) => (
          <Block
            key={b.id}
            block={b}
            onChange={(patch) => setBlock(b.id, patch)}
            onRemove={() => removeBlock(b.id)}
            isFirst={i === 0}
            isLast={i === blocks.length - 1}
            onCopy={onToast}
            editMode={editMode}
            dragging={dragId === b.id}
            draggedOver={overId === b.id ? overPos : null}
            onDragStart={() => setDragId(b.id)}
            onDragEnd={() => { setDragId(null); setOverId(null); setOverPos(null); }}
            onDragOver={(pos) => { if (dragId && dragId !== b.id) { setOverId(b.id); setOverPos(pos); } }}
            onDrop={() => { if (dragId) { reorderBlock(dragId, b.id, overPos || "before"); } setDragId(null); setOverId(null); setOverPos(null); }}
          />
        ))}
      </div>

      {editMode && (
        <div className="add-block-row">
          <span className="label">Block hinzufügen:</span>
          <button className="btn sm" onClick={() => addBlock("text")}><Icon name="type" size={12}/> Text</button>
          <button className="btn sm" onClick={() => addBlock("heading")}><Icon name="heading" size={12}/> Überschrift</button>
          <button className="btn sm" onClick={() => addBlock("subheading")}><Icon name="heading" size={12}/> Zwischenüberschrift</button>
          <button className="btn sm" onClick={() => addBlock("checklist")}><Icon name="check-square" size={12}/> Checkliste</button>
          <button className="btn sm" onClick={() => addBlock("code")}><Icon name="code" size={12}/> Code</button>
          <button className="btn sm" onClick={() => addBlock("mermaid")}><Icon name="git-branch" size={12}/> Diagramm</button>
          <button className="btn sm" onClick={() => addBlock("table")}><Icon name="table" size={12}/> Tabelle</button>
          <button className="btn sm" onClick={() => addBlock("image")}><Icon name="image" size={12}/> Bild</button>
          <button className="btn sm" onClick={() => addBlock("file")}><Icon name="package" size={12}/> Datei</button>
          <button className="btn sm" onClick={() => addBlock("status")}><Icon name="check-circle" size={12}/> Status</button>
          <button className="btn sm" onClick={() => addBlock("links")}><Icon name="link" size={12}/> Links</button>
          <button className="btn sm" onClick={() => addBlock("noteref")}><Icon name="link" size={12}/> Notiz-Link</button>
          <button className="btn sm" onClick={() => addBlock("recipe-meta")}><Icon name="heart" size={12}/> Rezept-Info</button>
          <button className="btn sm" onClick={() => addBlock("ingredients")}><Icon name="check-square" size={12}/> Zutaten</button>
        </div>
      )}
    </div>
    </NotesNavContext.Provider>
  );
}

function makeBlock(kind) {
  const id = uid();
  switch (kind) {
    case "text": return { id, kind, text: "" };
    case "heading": return { id, kind, text: "" };
    case "subheading": return { id, kind, text: "" };
    case "checklist": return { id, kind, items: [{ id: uid(), text: "", done: false }] };
    case "code": return { id, kind, text: "", lang: "bash" };
    case "mermaid": return { id, kind, nodes: [], edges: [], view: undefined, height: 360 };
    case "table": return { id, kind, headers: ["Spalte 1", "Spalte 2"], rows: [["", ""], ["", ""]] };
    case "image": return { id, kind, src: "", caption: "" };
    case "file": return { id, kind, name: "", mime: "", size: 0, src: "" };
    case "status": return { id, kind, value: "neutral" };
    case "links": return { id, kind, items: [] };
    case "noteref": return { id, kind, targetId: "", label: "" };
    case "recipe-meta": return { id, kind, servings: 2, prepTime: "", cookTime: "", difficulty: "einfach" };
    case "ingredients": return { id, kind, items: [{ id: uid(), amount: "", unit: "", name: "" }] };
    default: return { id, kind: "text", text: "" };
  }
}

function Block({ block, onChange, onRemove, isFirst, isLast, onCopy, editMode,
                dragging, draggedOver, onDragStart, onDragEnd, onDragOver, onDrop }) {
  const handleDragOver = (e) => {
    if (!editMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientY - rect.top) < rect.height / 2 ? "before" : "after";
    onDragOver?.(pos);
  };
  return (
    <div
      className={"block" + (editMode ? " editing" : "") + (dragging ? " dragging" : "") + (draggedOver ? " drop-" + draggedOver : "")}
      onDragOver={handleDragOver}
      onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
      onDragLeave={(e) => {
        // only clear if leaving the block (not entering a child)
        if (!e.currentTarget.contains(e.relatedTarget)) onDragOver?.(null);
      }}
    >
      {editMode && (
        <div className="block-controls">
          <button
            className="icon-btn drag-handle"
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "block"); onDragStart?.(); }}
            onDragEnd={onDragEnd}
            title="Verschieben (ziehen)"
          >
            <Icon name="grip" size={14} />
          </button>
        </div>
      )}
      {editMode && (
        <button className="icon-btn block-remove" onClick={onRemove} title="Block entfernen">
          <Icon name="trash" size={13} />
        </button>
      )}
      <BlockBody block={block} onChange={onChange} onRemove={onRemove} onCopy={onCopy} editMode={editMode} />
    </div>
  );
}

function RenderedTextBlock({ cls, text }) {
  const { notes, onSelectNote } = React.useContext(NotesNavContext);
  // Preserve line breaks; render wiki-links as clickable buttons
  return (
    <div className={cls} style={{ whiteSpace: "pre-wrap" }}>
      {renderWithWikiLinks(text, notes, onSelectNote)}
    </div>
  );
}

function BlockBody({ block, onChange, onRemove, onCopy, editMode = true }) {
  if (block.kind === "text" || block.kind === "heading" || block.kind === "subheading") {
    const cls = block.kind === "heading" ? "text-block heading"
      : block.kind === "subheading" ? "text-block subheading"
      : "text-block";
    const ph = block.kind === "heading" ? "Überschrift…"
      : block.kind === "subheading" ? "Zwischenüberschrift…"
      : "Tippe hier…";
    // Always editable. Wiki-links render as plain text here; they remain clickable
    // in dedicated Notiz-Link blocks. This means you can edit text any time.
    return (
      <AutoTextarea
        className={cls}
        placeholder={ph}
        value={block.text || ""}
        onChange={(v) => onChange({ text: v })}
      />
    );
  }
  if (block.kind === "checklist") {
    return <ChecklistBlock block={block} onChange={onChange} />;
  }
  if (block.kind === "code") {
    return (
      <CodeBlock
        value={block.text || ""}
        onChange={(v) => onChange({ text: v })}
        lang={block.lang || "bash"}
        onLangChange={(l) => onChange({ lang: l })}
        hasOutput={block.output != null}
        output={block.output || ""}
        onOutputChange={(v) => onChange({ output: v })}
        canToggleOutput
        onToggleOutput={() => onChange({ output: block.output == null ? "" : null })}
        onCopy={() => onCopy?.("Kopiert")}
      />
    );
  }
  if (block.kind === "mermaid") {
    return <MermaidBlock block={block} onChange={onChange} onCopy={onCopy} />;
  }
  if (block.kind === "table") {
    return <TableBlock block={block} onChange={onChange} />;
  }
  if (block.kind === "image") {
    return <ImageBlock block={block} onChange={onChange} />;
  }
  if (block.kind === "file") {
    return <FileBlock block={block} onChange={onChange} />;
  }
  if (block.kind === "status") {
    return <StatusBlock block={block} onChange={onChange} />;
  }
  if (block.kind === "links") {
    return <LinksBlock block={block} onChange={onChange} />;
  }
  if (block.kind === "noteref") {
    return <NoteRefBlock block={block} onChange={onChange} editMode={editMode} />;
  }
  if (block.kind === "recipe-meta") {
    return <RecipeMetaBlock block={block} onChange={onChange} />;
  }
  if (block.kind === "ingredients") {
    return <IngredientsBlock block={block} onChange={onChange} />;
  }
  return null;
}

function AutoTextarea({ value, onChange, onEmptyBackspace, className, placeholder }) {
  const ref = useRefE();
  useEffectE(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      placeholder={placeholder}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Backspace" && !value && onEmptyBackspace) {
          e.preventDefault(); onEmptyBackspace();
        }
      }}
    />
  );
}

function ChecklistBlock({ block, onChange }) {
  const setItem = (id, patch) => onChange({ items: block.items.map(i => i.id === id ? { ...i, ...patch } : i) });
  const removeItem = (id) => {
    const next = block.items.filter(i => i.id !== id);
    onChange({ items: next.length ? next : [{ id: uid(), text: "", done: false }] });
  };
  const addAfter = (id) => {
    const i = block.items.findIndex(x => x.id === id);
    const arr = [...block.items];
    arr.splice(i + 1, 0, { id: uid(), text: "", done: false });
    onChange({ items: arr });
  };
  const cycleRepeat = (id) => {
    const item = block.items.find(i => i.id === id);
    const order = [undefined, "daily", "weekly", "monthly"];
    const idx = order.indexOf(item?.repeat);
    const next = order[(idx + 1) % order.length];
    setItem(id, { repeat: next });
  };
  // When a recurring item is checked, briefly show the checkmark and then auto-uncheck.
  // Stores lastDone so we have history.
  const toggleDone = (item) => {
    const willBeDone = !item.done;
    setItem(item.id, { done: willBeDone, ...(willBeDone && item.repeat ? { lastDone: nowIso() } : {}) });
    if (willBeDone && item.repeat) {
      setTimeout(() => setItem(item.id, { done: false }), 1400);
    }
  };
  const repeatLabel = (r) => r === "daily" ? "täglich" : r === "weekly" ? "wöchentlich" : r === "monthly" ? "monatlich" : null;
  return (
    <div>
      {block.items.map(item => (
        <div className={"checklist-row" + (item.done ? " done" : "") + (item.repeat ? " recurring" : "")} key={item.id}>
          <input type="checkbox" checked={!!item.done} onChange={() => toggleDone(item)} />
          <AutoTextarea
            className="text-block"
            placeholder="Aufgabe…"
            value={item.text}
            onChange={(v) => setItem(item.id, { text: v })}
            onEmptyBackspace={() => removeItem(item.id)}
          />
          <button
            className={"icon-btn remove-btn checklist-repeat-btn" + (item.repeat ? " on" : "")}
            onClick={() => cycleRepeat(item.id)}
            title={item.repeat
              ? `Wiederholt ${repeatLabel(item.repeat)} — klicken zum Ändern`
              : "Wiederholung aktivieren"}
          >
            <Icon name="undo" size={12} />
            {item.repeat && <span className="checklist-repeat-label">{repeatLabel(item.repeat).slice(0, 4)}</span>}
          </button>
          <button className="icon-btn remove-btn" onClick={() => addAfter(item.id)} title="Neuer Eintrag">
            <Icon name="plus" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- Formula evaluation for table cells ----------
// Supports: =A1+B1, =SUM(A1:A3), =AVG(B1:B5), =MIN/MAX/COUNT/PRODUCT,
//           cell references like A1, plain numbers, +-*/, parentheses.
function evalCellFormula(raw, rows) {
  if (typeof raw !== "string" || !raw.startsWith("=")) return raw;
  try {
    let expr = raw.slice(1).trim();
    const getCell = (col, row) => {
      const r = rows[row]?.[col];
      if (r == null || r === "") return 0;
      if (typeof r === "string" && r.startsWith("=")) {
        // Recursive evaluation
        const v = evalCellFormula(r, rows);
        const num = parseFloat(String(v).replace(",", "."));
        return isNaN(num) ? 0 : num;
      }
      const num = parseFloat(String(r).replace(",", "."));
      return isNaN(num) ? 0 : num;
    };
    // Helpers for ranges A1:A5
    const refToColRow = (ref) => {
      const m = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!m) return null;
      let col = 0;
      for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
      return { col: col - 1, row: parseInt(m[2], 10) - 1 };
    };
    const expandRange = (a, b) => {
      const A = refToColRow(a), B = refToColRow(b);
      if (!A || !B) return [];
      const out = [];
      const c0 = Math.min(A.col, B.col), c1 = Math.max(A.col, B.col);
      const r0 = Math.min(A.row, B.row), r1 = Math.max(A.row, B.row);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(getCell(c, r));
      return out;
    };
    // Replace functions first: SUM(A1:A5), AVG(...), MIN, MAX, COUNT, PRODUCT
    expr = expr.replace(/(SUM|AVG|AVERAGE|MIN|MAX|COUNT|PRODUCT)\s*\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)/gi, (m, fn, a, b) => {
      const vals = expandRange(a, b);
      const F = fn.toUpperCase();
      if (F === "SUM") return String(vals.reduce((s, v) => s + v, 0));
      if (F === "AVG" || F === "AVERAGE") return String(vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0);
      if (F === "MIN") return String(vals.length ? Math.min(...vals) : 0);
      if (F === "MAX") return String(vals.length ? Math.max(...vals) : 0);
      if (F === "COUNT") return String(vals.filter(v => v !== 0 || rows.length > 0).length); // simple
      if (F === "PRODUCT") return String(vals.reduce((s, v) => s * v, 1));
      return "0";
    });
    // Replace cell refs A1 etc
    expr = expr.replace(/([A-Z]+)(\d+)/g, (m, col, row) => {
      const ref = refToColRow(m);
      if (!ref) return "0";
      return String(getCell(ref.col, ref.row));
    });
    // Sanity guard: only allow safe characters
    if (!/^[0-9+\-*/.()\s,]*$/.test(expr)) return "#ERR";
    // German decimal: also allow commas
    expr = expr.replace(/,/g, ".");
    // eslint-disable-next-line no-new-func
    const v = Function('"use strict"; return (' + expr + ')')();
    if (typeof v !== "number" || !isFinite(v)) return "#ERR";
    // Format: integer if whole, else up to 4 decimals
    return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(4)));
  } catch {
    return "#ERR";
  }
}

function TableBlock({ block, onChange }) {
  const [focused, setFocused] = useStateE(null); // "r-c" key
  const setCell = (r, c, val) => {
    const rows = block.rows.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? val : cell) : row);
    onChange({ rows });
  };
  const setHeader = (c, val) => onChange({ headers: block.headers.map((h, i) => i === c ? val : h) });
  const addRow = () => onChange({ rows: [...block.rows, block.headers.map(() => "")] });
  const addCol = () => onChange({
    headers: [...block.headers, `Spalte ${block.headers.length + 1}`],
    rows: block.rows.map(r => [...r, ""]),
  });
  const removeRow = () => block.rows.length > 1 && onChange({ rows: block.rows.slice(0, -1) });
  const removeCol = () => block.headers.length > 1 && onChange({
    headers: block.headers.slice(0, -1),
    rows: block.rows.map(r => r.slice(0, -1)),
  });
  // Display value: if cell starts with =, show evaluated unless focused
  const displayValue = (cell, r, c) => {
    const k = r + "-" + c;
    if (focused === k) return cell; // show raw formula when editing
    if (typeof cell === "string" && cell.startsWith("=")) return evalCellFormula(cell, block.rows);
    return cell;
  };

  return (
    <div className="table-block">
      <table>
        <thead>
          <tr>
            {block.headers.map((h, c) => (
              <th key={c}>
                <input value={h} onChange={(e) => setHeader(c, e.target.value)} placeholder={`Spalte ${c+1}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                const k = r + "-" + c;
                const isFormula = typeof cell === "string" && cell.startsWith("=");
                return (
                  <td key={c} className={isFormula ? "table-cell-formula" : ""}>
                    <input
                      value={displayValue(cell, r, c) || ""}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      onFocus={() => setFocused(k)}
                      onBlur={() => setFocused(null)}
                      placeholder="—"
                      title={isFormula && focused !== k ? `Formel: ${cell}` : undefined}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-controls">
        <button className="btn ghost sm" onClick={addRow}><Icon name="plus" size={12}/> Zeile</button>
        <button className="btn ghost sm" onClick={addCol}><Icon name="plus" size={12}/> Spalte</button>
        <button className="btn ghost sm" onClick={removeRow}><Icon name="x" size={12}/> Zeile</button>
        <button className="btn ghost sm" onClick={removeCol}><Icon name="x" size={12}/> Spalte</button>
      </div>
    </div>
  );
}

function ImageBlock({ block, onChange }) {
  const inputRef = useRefE();
  const onFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange({ src: e.target.result });
    reader.readAsDataURL(file);
  };
  if (!block.src) {
    return (
      <div className="image-block empty" onClick={() => inputRef.current?.click()}
           onDragOver={(e) => e.preventDefault()}
           onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}>
        <Icon name="image" size={28} />
        <div style={{ marginTop: 8 }}>Bild ablegen oder klicken zum Auswählen</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
    );
  }
  return (
    <div className="image-block">
      <img src={block.src} alt={block.caption || ""} />
      <div className="image-block-cap">
        <Icon name="image" size={12} />
        <input
          placeholder="Bildunterschrift…"
          value={block.caption || ""}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
        <button className="icon-btn" onClick={() => onChange({ src: "", caption: "" })} title="Entfernen">
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------- File block ----------

function FileBlock({ block, onChange }) {
  const inputRef = useRefE();
  const [preview, setPreview] = useStateE(false);
  const [mode, setMode] = useStateE("upload"); // upload | url
  const [urlDraft, setUrlDraft] = useStateE("");
  const [nameDraft, setNameDraft] = useStateE("");

  const onFile = (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert(`Datei zu groß (${formatBytes(file.size)}). Maximum 8 MB — Browser-Speicher ist begrenzt.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => onChange({
      name: file.name,
      mime: file.type || "",
      size: file.size,
      src: e.target.result,
      isLink: false,
    });
    reader.readAsDataURL(file);
  };

  const submitUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    let name = nameDraft.trim();
    if (!name) {
      try {
        const u = new URL(url);
        name = decodeURIComponent(u.pathname.split("/").pop() || "datei");
      } catch { name = "datei"; }
    }
    onChange({
      name, mime: "", size: 0,
      src: url, isLink: true,
    });
    setUrlDraft(""); setNameDraft("");
  };

  const remove = (e) => { e.stopPropagation(); onChange({ name: "", mime: "", size: 0, src: "", isLink: false }); };
  const download = (e) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = block.src;
    if (!block.isLink) a.download = block.name;
    if (block.isLink) a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };

  if (!block.src) {
    return (
      <div className="file-block-empty-wrap">
        <div className="file-block-mode-tabs">
          <button className={"file-block-tab " + (mode === "upload" ? "active" : "")} onClick={() => setMode("upload")}>
            <Icon name="package" size={12} /> Datei hochladen
          </button>
          <button className={"file-block-tab " + (mode === "url" ? "active" : "")} onClick={() => setMode("url")}>
            <Icon name="link" size={12} /> Per URL einbetten
          </button>
        </div>
        {mode === "upload" ? (
          <div
            className="file-block empty"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("dragover"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("dragover")}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("dragover");
              onFile(e.dataTransfer.files?.[0]);
            }}
          >
            <Icon name="package" size={26} />
            <div className="file-block-empty-text">
              <div><b>Datei ablegen</b> oder klicken zum Auswählen</div>
              <div className="file-block-empty-hint">Alle Formate · bis 8 MB · gespeichert im Browser</div>
            </div>
            <input ref={inputRef} type="file" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        ) : (
          <div className="file-block-url">
            <div className="file-block-url-hint">
              <Icon name="alert" size={12} />
              Funktioniert nur mit <b>öffentlich erreichbaren URLs</b> (Google Drive Share-Link, Dropbox, S3, eigene Domain …). Office-Dateien werden via Microsoft Office Viewer dargestellt.
            </div>
            <input
              className="field-input"
              type="url"
              placeholder="https://… (Direkt-Link zur Datei)"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitUrl(); }}
            />
            <input
              className="field-input"
              type="text"
              placeholder="Anzeigename (optional)"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitUrl(); }}
            />
            <button className="btn accent" onClick={submitUrl} disabled={!urlDraft.trim()}>
              <Icon name="link" size={13} /> Einbetten
            </button>
          </div>
        )}
      </div>
    );
  }

  const ft = getFileType(block.name);
  return (
    <>
      <div className="file-block filled" onClick={() => setPreview(true)} title="Vorschau öffnen" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPreview(true); } }}>
        <div className="file-block-icon" style={{ background: ft.color + "22", color: ft.color }}>
          <Icon name={ft.icon || "doc"} size={20} />
        </div>
        <div className="file-block-info">
          <div className="file-block-name">
            <MiddleTruncate text={block.name} />
            {block.isLink && <span className="file-block-link-badge"><Icon name="link" size={10} /> URL</span>}
          </div>
          <div className="file-block-meta">
            <span className="file-block-ext">{ft.ext.toUpperCase() || "FILE"}</span>
            <span className="file-block-cat" style={{ color: ft.color }}>· {ft.label}</span>
            {!block.isLink && block.size > 0 && <span>· {formatBytes(block.size)}</span>}
          </div>
        </div>
        <div className="file-block-actions" onClick={(e) => e.stopPropagation()}>
          <button className="icon-btn" onClick={download} title={block.isLink ? "Original öffnen" : "Herunterladen"}>
            <Icon name={block.isLink ? "external" : "download"} size={14} />
          </button>
          <button className="icon-btn" onClick={remove} title="Datei entfernen">
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>
      {preview && (
        <FilePreviewModal file={block} fileType={ft} onClose={() => setPreview(false)} onDownload={(e) => download(e || { stopPropagation: () => {} })} />
      )}
    </>
  );
}

function FilePreviewModal({ file, fileType, onClose, onDownload }) {
  const [textContent, setTextContent] = useStateE(null);
  const [textError, setTextError] = useStateE(null);
  const [officeHtml, setOfficeHtml] = useStateE(null);
  const [officeError, setOfficeError] = useStateE(null);
  const [officeLoading, setOfficeLoading] = useStateE(false);

  // Helper: convert data URL to ArrayBuffer (used by mammoth/xlsx/jszip)
  const dataUrlToArrayBuffer = (dataUrl) => {
    if (!dataUrl) return null;
    const m = /^data:[^;]+;base64,(.*)$/.exec(dataUrl);
    if (!m) return null;
    const binary = atob(m[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  };

  // Convert the data URL into a blob URL — Chrome refuses to render data: URLs
  // inside iframes (PDF preview), but Blob URLs are fine.
  const blobUrl = useMemoE(() => {
    if (!file.src) return "";
    if (file.isLink) return file.src;
    if (!file.src.startsWith("data:")) return file.src;
    try {
      const m = /^data:([^;]+);base64,(.*)$/.exec(file.src);
      if (!m) return file.src;
      const binary = atob(m[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: m[1] }));
    } catch { return file.src; }
  }, [file.src, file.isLink]);
  useEffectE(() => {
    return () => { if (blobUrl && blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  // Text/code/csv/json/markdown/html/svg preview: decode the data URL into a string
  useEffectE(() => {
    const p = fileType.preview;
    const isTextual = p === "text" || p === "code" || p === "csv" || p === "json" || p === "markdown" || p === "html";
    const isSvg = p === "image" && fileType.ext === "svg";
    if (!isTextual && !isSvg) return;
    try {
      const m = /^data:[^;]+;base64,(.*)$/.exec(file.src || "");
      if (!m) { setTextError("Kann Inhalt nicht lesen."); return; }
      const decoded = atob(m[1]);
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      setTextContent(utf8);
    } catch (e) { setTextError("Fehler beim Lesen: " + e.message); }
  }, [file.src, fileType.preview, fileType.ext]);

  // Word (.docx, .docm, .dotx, .dotm) preview via mammoth
  const DOCX_LIKE = new Set(["docx", "docm", "dotx", "dotm"]);
  const XLSX_LIKE = new Set(["xlsx", "xlsm", "xlsb", "xltx", "xltm"]);
  const PPTX_LIKE = new Set(["pptx", "pptm", "potx", "potm", "ppsx", "ppsm"]);
  useEffectE(() => {
    if (fileType.preview !== "word" || !DOCX_LIKE.has(fileType.ext)) return;
    if (!window.mammoth) { setOfficeError("Mammoth-Bibliothek nicht geladen."); return; }
    setOfficeLoading(true);
    const buf = dataUrlToArrayBuffer(file.src);
    if (!buf) { setOfficeError("Datei kann nicht gelesen werden."); setOfficeLoading(false); return; }
    window.mammoth.convertToHtml({ arrayBuffer: buf })
      .then((res) => { setOfficeHtml(res.value || "<p><em>Leeres Dokument</em></p>"); })
      .catch((e) => { setOfficeError("Fehler beim Konvertieren: " + e.message); })
      .finally(() => setOfficeLoading(false));
  }, [file.src, fileType.preview, fileType.ext]);

  // Word (.doc) best-effort text extraction from binary
  useEffectE(() => {
    if (fileType.preview !== "word" || fileType.ext !== "doc") return;
    setOfficeLoading(true);
    try {
      const buf = dataUrlToArrayBuffer(file.src);
      if (!buf) throw new Error("Datei kann nicht gelesen werden");
      const text = extractTextFromBinary(buf);
      const paragraphs = splitParagraphs(text);
      const html = paragraphs.length
        ? paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join("\n")
        : `<p><em>Kein lesbarer Text gefunden.</em></p>`;
      setOfficeHtml(html);
    } catch (e) {
      setOfficeError("Fehler: " + e.message);
    } finally {
      setOfficeLoading(false);
    }
  }, [file.src, fileType.preview, fileType.ext]);

  // Excel (.xlsx, .xls) preview via SheetJS
  const [excelSheets, setExcelSheets] = useStateE(null);
  const [excelActive, setExcelActive] = useStateE(0);
  useEffectE(() => {
    if (fileType.preview !== "excel") return;
    if (!window.XLSX) { setOfficeError("SheetJS nicht geladen."); return; }
    setOfficeLoading(true);
    try {
      const buf = dataUrlToArrayBuffer(file.src);
      if (!buf) { setOfficeError("Datei kann nicht gelesen werden."); setOfficeLoading(false); return; }
      const wb = window.XLSX.read(buf, { type: "array" });
      const sheets = wb.SheetNames.map((name) => ({
        name,
        html: window.XLSX.utils.sheet_to_html(wb.Sheets[name], { header: "" }),
      }));
      setExcelSheets(sheets);
      setExcelActive(0);
    } catch (e) {
      setOfficeError("Fehler beim Lesen: " + e.message);
    } finally {
      setOfficeLoading(false);
    }
  }, [file.src, fileType.preview]);

  // PowerPoint (.ppt) best-effort text extraction
  const [pptSlides, setPptSlides] = useStateE(null);
  useEffectE(() => {
    if (fileType.preview !== "powerpoint" || fileType.ext !== "ppt") return;
    setOfficeLoading(true);
    try {
      const buf = dataUrlToArrayBuffer(file.src);
      if (!buf) throw new Error("Datei kann nicht gelesen werden");
      const text = extractTextFromBinary(buf);
      const paragraphs = splitParagraphs(text);
      // Chunk roughly into "slides" — 8 paragraphs each
      const slides = [];
      const PER = 6;
      for (let i = 0; i < paragraphs.length; i += PER) {
        slides.push({ index: slides.length + 1, paragraphs: paragraphs.slice(i, i + PER) });
      }
      if (slides.length === 0) slides.push({ index: 1, paragraphs: ["(Kein lesbarer Text gefunden)"] });
      setPptSlides(slides);
    } catch (e) {
      setOfficeError("Fehler: " + e.message);
    } finally {
      setOfficeLoading(false);
    }
  }, [file.src, fileType.preview, fileType.ext]);
  useEffectE(() => {
    if (fileType.preview !== "powerpoint" || !PPTX_LIKE.has(fileType.ext)) return;    if (!window.JSZip) { setOfficeError("JSZip nicht geladen."); return; }
    setOfficeLoading(true);
    (async () => {
      try {
        const buf = dataUrlToArrayBuffer(file.src);
        if (!buf) throw new Error("Datei kann nicht gelesen werden");
        const zip = await window.JSZip.loadAsync(buf);
        const slideNames = Object.keys(zip.files)
          .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
          .sort((a, b) => {
            const na = parseInt(a.match(/slide(\d+)/)[1], 10);
            const nb = parseInt(b.match(/slide(\d+)/)[1], 10);
            return na - nb;
          });
        const parser = new DOMParser();
        const slides = [];
        for (const name of slideNames) {
          const xml = await zip.files[name].async("string");
          const doc = parser.parseFromString(xml, "application/xml");
          // <a:t> elements contain the actual visible text
          const texts = [...doc.getElementsByTagName("a:t")].map(t => t.textContent).filter(Boolean);
          // Group lines by paragraph (<a:p>)
          const paragraphs = [...doc.getElementsByTagName("a:p")].map(p =>
            [...p.getElementsByTagName("a:t")].map(t => t.textContent).join("")
          ).filter(s => s.trim());
          slides.push({
            index: slides.length + 1,
            paragraphs: paragraphs.length ? paragraphs : texts,
          });
        }
        setPptSlides(slides);
      } catch (e) {
        setOfficeError("Fehler: " + e.message);
      } finally {
        setOfficeLoading(false);
      }
    })();
  }, [file.src, fileType.preview, fileType.ext]);

  // Esc to close
  useEffectE(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prism highlight for code preview
  const codeRef = useRefE();
  useEffectE(() => {
    if (fileType.preview === "code" && codeRef.current && window.Prism && textContent != null) {
      window.Prism.highlightElement(codeRef.current);
    }
  }, [textContent, fileType.preview]);

  const lang = FILE_EXT_TO_LANG[fileType.ext] || "plain";

  const renderBody = () => {
    // Linked office files → Microsoft Office Online Viewer (renders perfectly)
    if (file.isLink && (fileType.preview === "word" || fileType.preview === "excel" || fileType.preview === "powerpoint")) {
      const viewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.src)}`;
      return <iframe src={viewer} className="preview-iframe" title={file.name}></iframe>;
    }
    // Server-only mod: route extra LibreOffice-convertible formats through the
    // server PDF converter (Visio, Publisher, CorelDraw, OpenDocument Draw,
    // CAD-DXF, Metafiles). Takes precedence — z.B. Visio läge sonst falsch unter "Daten/JSON".
    const LO_EXTRA = new Set(["vsd","vsdx","vsdm","vdx","pub","cdr","odg","otg","fodg","std","sxd","dxf","wpg","svm","wmf","emf"]);
    if (!file.isLink && LO_EXTRA.has(fileType.ext)) {
      return <window.OfficeServerPreview dataUrl={file.src} fileName={file.name} />;
    }
    if (fileType.preview === "image") return <img src={blobUrl} alt={file.name} className="preview-image" />;
    if (fileType.preview === "pdf") {
      if (file.isLink) return <iframe src={blobUrl} className="preview-iframe" title={file.name}></iframe>;
      return <window.PDFPreview dataUrl={file.src} fileName={file.name} />;
    }
    if (fileType.preview === "video") return <video src={blobUrl} controls className="preview-video" />;
    if (fileType.preview === "audio") return (
      <div className="preview-audio-wrap">
        <div className="file-block-icon" style={{ background: fileType.color + "22", color: fileType.color, width: 80, height: 80 }}>
          <Icon name="image" size={36} />
        </div>
        <audio src={blobUrl} controls className="preview-audio" />
      </div>
    );
    if (fileType.preview === "text" || fileType.preview === "code") {
      if (textError) return <PreviewUnsupported fileType={fileType} message={textError} onDownload={onDownload} />;
      if (textContent == null) return <div className="preview-loading">Lade…</div>;
      if (fileType.preview === "code") return <pre className="preview-code"><code ref={codeRef} className={"language-" + lang}>{textContent}</code></pre>;
      return <pre className="preview-text">{textContent}</pre>;
    }
    if (fileType.preview === "csv") {
      if (textError) return <PreviewUnsupported fileType={fileType} message={textError} onDownload={onDownload} />;
      if (textContent == null) return <div className="preview-loading">Lade…</div>;
      return <CSVTablePreview text={textContent} ext={fileType.ext} />;
    }
    if (fileType.preview === "json") {
      if (textError) return <PreviewUnsupported fileType={fileType} message={textError} onDownload={onDownload} />;
      if (textContent == null) return <div className="preview-loading">Lade…</div>;
      // .drawio is XML, route to the dedicated drawio viewer
      if (fileType.ext === "drawio") return <window.DrawioPreview text={textContent} dataUrl={file.src} fileName={file.name} />;
      return <window.JSONTreePreview text={textContent} ext={fileType.ext} />;
    }
    if (fileType.preview === "markdown") {
      if (textError) return <PreviewUnsupported fileType={fileType} message={textError} onDownload={onDownload} />;
      if (textContent == null) return <div className="preview-loading">Lade…</div>;
      return <window.MarkdownPreview text={textContent} />;
    }
    if (fileType.preview === "html") {
      if (textError) return <PreviewUnsupported fileType={fileType} message={textError} onDownload={onDownload} />;
      if (textContent == null) return <div className="preview-loading">Lade…</div>;
      return <window.HTMLPreview text={textContent} ext={fileType.ext} />;
    }
    if (fileType.preview === "font") {
      return <window.FontPreview blobUrl={blobUrl} fileName={file.name} />;
    }
    if (fileType.preview === "archive") {
      return <window.ArchivePreview dataUrl={file.src} fileName={file.name} fileType={fileType} />;
    }
    if (fileType.preview === "image" && fileType.ext === "svg") {
      // SVG: show rendered + source toggle
      const txt = textContent != null ? textContent : null;
      if (txt != null) return <window.SVGPreview text={txt} blobUrl={blobUrl} />;
      // fall through to plain image
    }
    if (fileType.preview === "word") {
      // Server-only mod: render Word/ODT/RTF/.doc via LibreOffice→PDF (high
      // fidelity, and odt/rtf work at all now — Mammoth only handled docx).
      return <window.OfficeServerPreview dataUrl={file.src} fileName={file.name} />;
    }
    if (fileType.preview === "excel") {
      // Server-only mod: render Excel/ODS via LibreOffice→PDF (pixelgenau,
      // konsistent mit Word/PowerPoint). Ersetzt die SheetJS-Vorschau.
      return <window.OfficeServerPreview dataUrl={file.src} fileName={file.name} />;
    }
    if (fileType.preview === "powerpoint") {
      if (fileType.ext === "ppt") {
        if (officeError) return <PreviewUnsupported fileType={fileType} message={officeError} onDownload={onDownload} />;
        if (officeLoading || !pptSlides) return <div className="preview-loading">Text wird extrahiert…</div>;
        return (
          <div className="preview-ppt">
            <div className="preview-ppt-notice">
              <Icon name="alert" size={13} />
              Altes PowerPoint-Format (.ppt) — nur Text-Extraktion ohne Layout/Bilder.
            </div>
            {pptSlides.map((s) => (
              <div className="preview-ppt-slide" key={s.index}>
                <div className="preview-ppt-num">Block {s.index}</div>
                <div className="preview-ppt-body">
                  {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            ))}
          </div>
        );
      }
      // Modern .pptx — render slides visually with positioned shapes
      return <window.PPTXVisualPreview dataUrl={file.src} fileName={file.name} />;
    }
    return <PreviewUnsupported fileType={fileType} onDownload={onDownload} />;
  };

  return (
    <div className="modal-backdrop preview-backdrop" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-head">
          <div className="file-block-icon" style={{ background: fileType.color + "22", color: fileType.color, width: 36, height: 36 }}>
            <Icon name={fileType.icon || "doc"} size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="preview-title">{file.name}</div>
            <div className="preview-sub">
              {fileType.ext.toUpperCase() || "FILE"} · {fileType.label} · {formatBytes(file.size)}
            </div>
          </div>
          <button className="btn sm" onClick={onDownload}><Icon name="download" size={13} /> Download</button>
          <button className="icon-btn" onClick={onClose} title="Schließen (Esc)">
            <Icon name="x" />
          </button>
        </div>
        <div className="preview-body">{renderBody()}</div>
      </div>
    </div>
  );
}

// ── CSV / TSV preview ──────────────────────────────────────────────────────
// Simple RFC-4180-ish parser: handles quoted fields, embedded separators,
// escaped quotes (""), and \r\n / \n / \r line endings. Sniffs the separator
// from the first 4 KB if the extension is csv (could be comma or semicolon).
function parseCSV(text, sepHint) {
  let sep = sepHint;
  if (!sep) {
    const sample = text.slice(0, 4096);
    const candidates = [",", ";", "\t", "|"];
    const lines = sample.split(/\r?\n/).filter(l => l.length > 0).slice(0, 5);
    let best = ",", bestScore = -1;
    for (const c of candidates) {
      const counts = lines.map(l => (l.match(new RegExp(c === "|" ? "\\|" : (c === "\t" ? "\\t" : c), "g")) || []).length);
      if (counts.length === 0) continue;
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((a, b) => a + (b - avg) ** 2, 0) / counts.length;
      const score = avg * (1 / (1 + variance));
      if (score > bestScore && avg >= 1) { bestScore = score; best = c; }
    }
    sep = best;
  }
  const rows = [];
  let cur = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === sep) { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        rows.push(cur); cur = [];
      } else { field += c; }
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  for (const r of rows) { while (r.length < maxCols) r.push(""); }
  return { rows, sep };
}

const CSV_MAX_VISIBLE_ROWS = 2000;

function CSVTablePreview({ text, ext }) {
  const sepHint = ext === "tsv" ? "\t" : null;
  const [filter, setFilter] = useStateE("");
  const [showRaw, setShowRaw] = useStateE(false);
  const [sort, setSort] = useStateE(null);

  const parsed = useMemoE(() => {
    try {
      const { rows, sep } = parseCSV(text || "", sepHint);
      if (rows.length === 0) return { headers: [], data: [], sep, error: null };
      const [head, ...rest] = rows;
      return { headers: head, data: rest, sep, error: null };
    } catch (e) {
      return { headers: [], data: [], sep: ",", error: e.message };
    }
  }, [text, sepHint]);

  const filtered = useMemoE(() => {
    let rows = parsed.data;
    if (filter) {
      const q = filter.toLowerCase();
      rows = rows.filter(r => r.some(c => String(c).toLowerCase().includes(q)));
    }
    if (sort) {
      const { col, dir } = sort;
      rows = [...rows].sort((a, b) => {
        const av = a[col] ?? "", bv = b[col] ?? "";
        const an = parseFloat(av), bn = parseFloat(bv);
        const bothNum = !isNaN(an) && !isNaN(bn) && String(an) === String(av).trim() && String(bn) === String(bv).trim();
        if (bothNum) return dir === "asc" ? an - bn : bn - an;
        return dir === "asc" ? String(av).localeCompare(String(bv), "de") : String(bv).localeCompare(String(av), "de");
      });
    }
    return rows;
  }, [parsed.data, filter, sort]);

  if (parsed.error) {
    return <div className="preview-loading">Konnte CSV nicht lesen: {parsed.error}</div>;
  }
  if (parsed.headers.length === 0) {
    return <div className="preview-loading">Leere Tabelle.</div>;
  }

  const truncated = filtered.length > CSV_MAX_VISIBLE_ROWS;
  const visible = truncated ? filtered.slice(0, CSV_MAX_VISIBLE_ROWS) : filtered;
  const sepLabel = parsed.sep === "\t" ? "Tab" : parsed.sep === ";" ? "Semikolon" : parsed.sep === "|" ? "Pipe" : "Komma";

  return (
    <div className="csv-preview">
      <div className="csv-preview-toolbar">
        <input
          className="field-input csv-preview-search"
          type="text"
          placeholder="Tabelle durchsuchen…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="csv-preview-stats">
          <span>{parsed.data.length.toLocaleString("de")} Zeilen</span>
          <span>·</span>
          <span>{parsed.headers.length} Spalten</span>
          <span>·</span>
          <span>{sepLabel}</span>
          {filter && (
            <>
              <span>·</span>
              <span>{filtered.length.toLocaleString("de")} Treffer</span>
            </>
          )}
        </div>
        <button
          type="button"
          className={"btn sm " + (showRaw ? "primary" : "ghost")}
          onClick={() => setShowRaw(v => !v)}
        >
          {showRaw ? "Tabelle" : "Roh"}
        </button>
      </div>

      {showRaw ? (
        <pre className="preview-text csv-preview-raw">{text}</pre>
      ) : (
        <div className="csv-preview-scroll">
          <table className="csv-preview-table" ref={(el) => { if (el) requestAnimationFrame(() => attachColumnResize(el.parentElement)); }}>
            <thead>
              <tr>
                <th className="csv-rownum-h" aria-label="Zeilennummer">#</th>
                {parsed.headers.map((h, i) => {
                  const active = sort?.col === i;
                  const dir = active ? sort.dir : null;
                  return (
                    <th
                      key={i}
                      onClick={() => setSort(s => {
                        if (!s || s.col !== i) return { col: i, dir: "asc" };
                        if (s.dir === "asc") return { col: i, dir: "desc" };
                        return null;
                      })}
                      className={active ? "sorted" : ""}
                      title="Klick zum Sortieren"
                    >
                      <span className="csv-th-inner">
                        <span>{h || `Spalte ${i + 1}`}</span>
                        <span className="csv-sort-icon">{dir === "asc" ? "▲" : dir === "desc" ? "▼" : ""}</span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, ri) => (
                <tr key={ri}>
                  <td className="csv-rownum">{ri + 1}</td>
                  {parsed.headers.map((_, ci) => {
                    const v = row[ci] ?? "";
                    const num = v !== "" && !isNaN(parseFloat(v)) && String(parseFloat(v)) === String(v).trim();
                    return (
                      <td key={ci} className={num ? "csv-num" : ""}>{v}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {truncated && (
            <div className="csv-preview-truncated">
              Nur die ersten {CSV_MAX_VISIBLE_ROWS.toLocaleString("de")} Zeilen werden angezeigt. Such- oder Roh-Ansicht für vollständige Daten verwenden.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Attaches drag-resize handles to <th> elements inside a container.
// Works with arbitrary HTML tables (e.g. SheetJS sheet_to_html output).
function attachColumnResize(container) {
  if (!container || container._resizeAttached) return;
  container._resizeAttached = true;
  const table = container.querySelector("table");
  if (!table) return;
  table.style.tableLayout = "fixed";

  // Use first row as the header for resize purposes (SheetJS doesn't emit thead).
  const firstRow = table.rows[0];
  if (!firstRow) return;
  const cells = [...firstRow.cells];

  // Build a colgroup so width changes affect every row's column
  let colgroup = table.querySelector("colgroup");
  if (!colgroup) {
    colgroup = document.createElement("colgroup");
    cells.forEach(() => colgroup.appendChild(document.createElement("col")));
    table.insertBefore(colgroup, table.firstChild);
  }
  const cols = [...colgroup.querySelectorAll("col")];

  // Set initial widths from current rendered widths
  cells.forEach((cell, i) => {
    const w = cell.getBoundingClientRect().width;
    if (cols[i] && !cols[i].style.width) cols[i].style.width = Math.max(60, Math.round(w)) + "px";
  });

  // Attach a 6px-wide resize handle to each header cell
  cells.forEach((cell, i) => {
    if (cell._hasResizer) return;
    cell._hasResizer = true;
    cell.style.position = "relative";
    cell.style.overflow = "hidden";
    cell.style.textOverflow = "ellipsis";
    const handle = document.createElement("div");
    handle.className = "col-resize-handle";
    handle.style.cssText = "position:absolute;top:0;right:0;width:6px;height:100%;cursor:col-resize;user-select:none;z-index:5;";
    cell.appendChild(handle);

    let startX = 0;
    let startW = 0;
    const onMove = (e) => {
      const dx = e.clientX - startX;
      const next = Math.max(40, startW + dx);
      if (cols[i]) cols[i].style.width = next + "px";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startW = cols[i] ? parseFloat(cols[i].style.width || cell.getBoundingClientRect().width) : cell.getBoundingClientRect().width;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
    });
    // Double-click to autosize this column to fit longest cell
    handle.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      let max = 60;
      for (const row of table.rows) {
        const c = row.cells[i];
        if (!c) continue;
        // Estimate by content length, capped
        const w = Math.min(600, (c.textContent || "").length * 8 + 24);
        if (w > max) max = w;
      }
      if (cols[i]) cols[i].style.width = max + "px";
    });
  });
}

// Middle-truncate a filename to fit inside `containerEl`. Keeps the extension
// visible by inserting "…" near the middle when the name overflows.
// Also enforces an absolute max character count so very long names get cut
// even if there's pixel-room (useful for cards / list rows).
function MiddleTruncate({ text, maxChars = 56 }) {
  const ref = useRefE(null);
  const [out, setOut] = useStateE(text);

  useEffectE(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      // Start from the hard-char-limit version so we never display more
      // than maxChars even if the container is wide.
      const baseText = absoluteMiddleTruncate(text, maxChars);
      el.textContent = baseText;
      if (el.scrollWidth <= el.clientWidth + 1) { setOut(baseText); return; }
      // Container is narrower than even the char-limit version → shrink further by width
      const dotIdx = text.lastIndexOf(".");
      const ext = dotIdx > 0 && text.length - dotIdx <= 8 ? text.slice(dotIdx) : "";
      const base = ext ? text.slice(0, -ext.length) : text;
      let lo = 0, hi = base.length;
      let best = ext;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const prefixLen = Math.ceil(mid * 0.6);
        const suffixLen = mid - prefixLen;
        const candidate = base.slice(0, prefixLen) + "…" + base.slice(base.length - suffixLen) + ext;
        el.textContent = candidate;
        if (el.scrollWidth <= el.clientWidth + 1) {
          best = candidate;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      el.textContent = best;
      setOut(best);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, maxChars]);

  return <span ref={ref} className="middle-truncate" title={text}>{out}</span>;
}

// Synchronous helper: shorten a string to roughly `max` chars by inserting
// "…" toward the middle while keeping the extension visible.
function absoluteMiddleTruncate(s, max) {
  if (!s || s.length <= max) return s;
  const dotIdx = s.lastIndexOf(".");
  const ext = dotIdx > 0 && s.length - dotIdx <= 8 ? s.slice(dotIdx) : "";
  const base = ext ? s.slice(0, -ext.length) : s;
  const budget = Math.max(8, max - ext.length - 1); // 1 for the ellipsis
  const prefixLen = Math.ceil(budget * 0.6);
  const suffixLen = budget - prefixLen;
  return base.slice(0, prefixLen) + "…" + base.slice(base.length - suffixLen) + ext;
}

function PreviewUnsupported({ fileType, message, onDownload }) {
  return (
    <div className="preview-unsupported">
      <div className="file-block-icon" style={{ background: fileType.color + "22", color: fileType.color, width: 64, height: 64 }}>
        <Icon name={fileType.icon || "doc"} size={28} />
      </div>
      <div className="preview-unsupported-title">
        {message || "Keine Vorschau verfügbar"}
      </div>
      <div className="preview-unsupported-sub">
        Für <b>{fileType.label}</b>-Dateien ({fileType.ext.toUpperCase()}) kann der Browser keine Inline-Vorschau anzeigen.
      </div>
      <button className="btn primary" onClick={onDownload}>
        <Icon name="download" size={13} /> Herunterladen
      </button>
    </div>
  );
}

Object.assign(window, { FileBlock, FilePreviewModal, ITEditor, NormalEditor });

// ---------- Status + Links blocks (used by IT-Notiz template) ----------

function StatusBlock({ block, onChange }) {
  const options = [
    { val: "success", label: "Erfolgreich", cls: "success" },
    { val: "warning", label: "Warnung",     cls: "warning" },
    { val: "error",   label: "Fehler",      cls: "danger"  },
    { val: "neutral", label: "Hinweis",     cls: ""        },
  ];
  return (
    <div className="status-block">
      <div className="status-block-label">Status</div>
      <div className="seg">
        {options.map(opt => (
          <button
            key={opt.val}
            className={(block.value === opt.val ? "active " + opt.cls : "")}
            onClick={() => onChange({ value: opt.val })}
          >
            <span className={"status-dot " + (opt.cls || "neutral")}></span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LinksBlock({ block, onChange }) {
  const items = block.items || [];
  const update = (id, key, val) => onChange({ items: items.map(l => l.id === id ? { ...l, [key]: val } : l) });
  const remove = (id) => onChange({ items: items.filter(l => l.id !== id) });
  const add = () => onChange({ items: [...items, { id: uid(), label: "", url: "" }] });
  return (
    <div className="links-block">
      <div className="links-block-label"><Icon name="link" size={12} /> Verwandte Links</div>
      <div className="links-list">
        {items.map(l => (
          <div className="link-row" key={l.id}>
            <Icon name="link" size={14} style={{ color: "var(--text-subtle)" }} />
            <input
              placeholder="Beschriftung"
              value={l.label}
              onChange={(e) => update(l.id, "label", e.target.value)}
              style={{ maxWidth: 180 }}
            />
            <input
              placeholder="https://…"
              value={l.url}
              onChange={(e) => update(l.id, "url", e.target.value)}
            />
            {l.url && (
              <a href={l.url} target="_blank" rel="noreferrer" title="Öffnen" style={{ color: "var(--text-muted)" }}>
                <Icon name="external" size={14} />
              </a>
            )}
            <button className="icon-btn" onClick={() => remove(l.id)} title="Entfernen">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
        <button className="btn ghost sm" onClick={add} style={{ alignSelf: "flex-start" }}>
          <Icon name="plus" size={12} /> Link hinzufügen
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { StatusBlock, LinksBlock });

// ---------- Note reference block ----------

function NoteRefBlock({ block, onChange, editMode }) {
  const { notes, folders, onSelectNote } = React.useContext(NotesNavContext);
  const [pickerOpen, setPickerOpen] = useStateE(false);
  const [search, setSearch] = useStateE("");
  const pickerRef = useRefE();
  const target = notes.find(n => n.id === block.targetId);
  const targetTitle = target?.title || "";
  const displayLabel = (block.label || "").trim() || targetTitle || "Notiz wählen…";

  useEffectE(() => {
    if (!pickerOpen) return;
    const close = (e) => { if (!pickerRef.current?.contains(e.target)) setPickerOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pickerOpen]);

  // Build folder path (e.g. "Server-Admin › Linux") for the target's home folder
  const folderPath = (folderId) => {
    if (!folderId || !folders) return "";
    const chain = [];
    let cur = folders.find(f => f.id === folderId);
    while (cur) {
      chain.unshift(cur.name);
      cur = cur.parentId ? folders.find(f => f.id === cur.parentId) : null;
    }
    return chain.join(" › ");
  };
  const targetFolderPath = target ? folderPath(target.folderId) : "";

  // Filter notes by search query
  const q = search.trim().toLowerCase();
  const matches = (n) =>
    (n.title || "").toLowerCase().includes(q)
    || (n.tags || []).some(t => t.toLowerCase().includes(q));
  const visibleNotes = q ? notes.filter(matches) : notes;

  // Build the tree to render: recursive walk over folders
  // Returns flat list of { kind: "folder", folder, depth } | { kind: "note", note, depth }
  const buildList = () => {
    const out = [];
    const noteByFolder = {};
    visibleNotes.forEach(n => {
      (noteByFolder[n.folderId || "__orphan"] = noteByFolder[n.folderId || "__orphan"] || []).push(n);
    });
    const walk = (parentId, depth) => {
      const children = (folders || []).filter(f => (f.parentId || null) === parentId);
      children.forEach(f => {
        // Collect notes for this folder + descendants
        const collectIds = (id) => {
          const ids = new Set([id]);
          let added = true;
          while (added) {
            added = false;
            (folders || []).forEach(sub => {
              if (sub.parentId && ids.has(sub.parentId) && !ids.has(sub.id)) { ids.add(sub.id); added = true; }
            });
          }
          return ids;
        };
        const idsInTree = collectIds(f.id);
        const hasAnyMatch = [...idsInTree].some(id => (noteByFolder[id] || []).length > 0);
        if (!hasAnyMatch) return;
        out.push({ kind: "folder", folder: f, depth });
        (noteByFolder[f.id] || []).forEach(n => out.push({ kind: "note", note: n, depth: depth + 1 }));
        walk(f.id, depth + 1);
      });
    };
    walk(null, 0);
    // Orphan notes (no folder)
    if ((noteByFolder["__orphan"] || []).length > 0) {
      out.push({ kind: "folder", folder: { id: "__orphan", name: "Ohne Ordner", icon: "inbox" }, depth: 0 });
      noteByFolder["__orphan"].forEach(n => out.push({ kind: "note", note: n, depth: 1 }));
    }
    return out;
  };

  const list = buildList();

  // ---- Read-only view ----
  if (!editMode) {
    if (!target) {
      return (
        <div className="noteref-block missing">
          <Icon name="alert" size={14} />
          <span style={{ flex: 1 }}>Notiz-Link ohne Ziel</span>
        </div>
      );
    }
    return (
      <button
        type="button"
        className="noteref-block"
        onClick={() => onSelectNote(target.id)}
        title={`Zu „${target.title || "Ohne Titel"}" springen`}
      >
        <span className="noteref-icon">
          <Icon name={target.icon || (target.type === "it" ? "terminal" : "doc")} size={16} />
        </span>
        <span className="noteref-body">
          <span className="noteref-title">{displayLabel}</span>
          {block.label && target.title && (
            <span className="noteref-sub">→ {target.title}</span>
          )}
          {targetFolderPath && (
            <span className="noteref-sub">📂 {targetFolderPath}</span>
          )}
        </span>
        <Icon name="external" size={13} className="noteref-arrow" />
      </button>
    );
  }

  // ---- Edit view ----
  return (
    <div className="noteref-edit">
      <div className="noteref-edit-row">
        <div className="noteref-edit-label">
          <Icon name="link" size={12} /> Notiz-Link
        </div>
        <div className="noteref-picker-wrap" ref={pickerRef}>
          <button
            type="button"
            className={"noteref-picker-btn" + (target ? " set" : "")}
            onClick={() => setPickerOpen(v => !v)}
          >
            {target ? (
              <>
                <Icon name={target.icon || "doc"} size={13} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                  {targetFolderPath && <span style={{ color: "var(--text-subtle)", fontSize: 11, marginRight: 6 }}>{targetFolderPath} ›</span>}
                  {target.title || "Ohne Titel"}
                </span>
              </>
            ) : (
              <>
                <Icon name="search" size={13} />
                <span style={{ flex: 1, textAlign: "left", color: "var(--text-subtle)" }}>Notiz wählen…</span>
              </>
            )}
            <Icon name="chevron-down" size={10} />
          </button>
          {pickerOpen && (
            <div className="noteref-picker-menu">
              <div className="noteref-picker-search">
                <Icon name="search" size={12} />
                <input
                  autoFocus
                  placeholder="Notiz oder Ordner suchen…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="noteref-picker-list">
                {list.length === 0 ? (
                  <div className="noteref-picker-empty">Keine Notiz gefunden</div>
                ) : list.map((item, i) => {
                  if (item.kind === "folder") {
                    return (
                      <div
                        key={"f-" + item.folder.id + "-" + i}
                        className="noteref-picker-folder"
                        style={{ paddingLeft: 8 + item.depth * 14 }}
                      >
                        <Icon name={item.folder.icon || "folder"} size={11} />
                        <span>{item.folder.name}</span>
                      </div>
                    );
                  }
                  const n = item.note;
                  return (
                    <button
                      key={"n-" + n.id}
                      type="button"
                      className={"noteref-picker-item" + (n.id === block.targetId ? " active" : "")}
                      style={{ paddingLeft: 12 + item.depth * 14 }}
                      onClick={() => { onChange({ targetId: n.id }); setPickerOpen(false); setSearch(""); }}
                    >
                      <Icon name={n.icon || (n.type === "it" ? "terminal" : "doc")} size={13} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                        {n.title || "Ohne Titel"}
                      </span>
                      {n.id === block.targetId && <Icon name="check" size={11} style={{ color: "var(--accent)" }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {target && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => onSelectNote(target.id)}
            title="Notiz öffnen"
          >
            <Icon name="external" size={13} />
          </button>
        )}
      </div>
      <input
        className="noteref-label-input"
        placeholder={target ? `Eigener Linktext (optional, sonst: „${target.title || "Ohne Titel"}")` : "Eigener Linktext (optional)"}
        value={block.label || ""}
        onChange={(e) => onChange({ label: e.target.value })}
      />
    </div>
  );
}

// ---------- Recipe blocks ----------

function RecipeMetaBlock({ block, onChange }) {
  return (
    <div className="recipe-meta">
      <div className="recipe-meta-cell">
        <div className="recipe-meta-label"><Icon name="user" size={11} /> Portionen</div>
        <input
          type="number" min={1} className="recipe-meta-input"
          value={block.servings || ""}
          onChange={(e) => onChange({ servings: Number(e.target.value) || 1 })}
        />
      </div>
      <div className="recipe-meta-cell">
        <div className="recipe-meta-label"><Icon name="clock" size={11} /> Vorbereitung</div>
        <input
          className="recipe-meta-input" placeholder="15 Min"
          value={block.prepTime || ""}
          onChange={(e) => onChange({ prepTime: e.target.value })}
        />
      </div>
      <div className="recipe-meta-cell">
        <div className="recipe-meta-label"><Icon name="fire" size={11} /> Kochen</div>
        <input
          className="recipe-meta-input" placeholder="30 Min"
          value={block.cookTime || ""}
          onChange={(e) => onChange({ cookTime: e.target.value })}
        />
      </div>
      <div className="recipe-meta-cell">
        <div className="recipe-meta-label"><Icon name="zap" size={11} /> Schwierigkeit</div>
        <window.StyledSelect
          value={block.difficulty || "einfach"}
          onChange={(v) => onChange({ difficulty: v })}
          options={[
            { value: "einfach", label: "Einfach" },
            { value: "mittel", label: "Mittel" },
            { value: "schwer", label: "Schwer" },
          ]}
        />
      </div>
    </div>
  );
}

function IngredientsBlock({ block, onChange }) {
  const items = block.items || [];
  const setItem = (id, patch) => onChange({ items: items.map(i => i.id === id ? { ...i, ...patch } : i) });
  const removeItem = (id) => {
    const next = items.filter(i => i.id !== id);
    onChange({ items: next.length ? next : [{ id: uid(), amount: "", unit: "", name: "" }] });
  };
  const addAfter = (id) => {
    const i = items.findIndex(x => x.id === id);
    const arr = [...items];
    arr.splice(i + 1, 0, { id: uid(), amount: "", unit: "", name: "" });
    onChange({ items: arr });
  };
  const UNITS = ["", "g", "kg", "ml", "l", "TL", "EL", "Stk", "Prise", "Tasse", "Bund", "Dose"];
  const UNIT_OPTS = UNITS.map(u => ({ value: u, label: u || "—" }));
  return (
    <div className="ingredients-block">
      {items.map(item => (
        <div className="ingredient-row" key={item.id}>
          <input
            className="ingredient-amount"
            placeholder="200"
            value={item.amount}
            onChange={(e) => setItem(item.id, { amount: e.target.value })}
          />
          <window.StyledSelect
            value={item.unit || ""}
            onChange={(v) => setItem(item.id, { unit: v })}
            options={UNIT_OPTS}
            minWidth={70}
          />
          <input
            className="ingredient-name"
            placeholder="Zutat…"
            value={item.name}
            onChange={(e) => setItem(item.id, { name: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAfter(item.id); } }}
          />
          <button className="icon-btn ingredient-remove" onClick={() => removeItem(item.id)} title="Entfernen">
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
      <button className="btn ghost sm" onClick={() => addAfter(items[items.length - 1]?.id)} style={{ marginTop: 6 }}>
        <Icon name="plus" size={12} /> Zutat hinzufügen
      </button>
    </div>
  );
}

Object.assign(window, { RecipeMetaBlock, IngredientsBlock });

// ---------- Helpers for legacy Office (.doc / .ppt) ----------

// Scan the binary for runs of readable text. The old binary formats embed
// the document text as UTF-16-LE strings interleaved with format records.
function extractTextFromBinary(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  // First, try UTF-16 LE (most common for .doc / .ppt)
  const utf16 = decodeRunsUtf16LE(bytes);
  // Then, try plain ASCII / Latin-1 for filename, embedded metadata, etc.
  const ascii = decodeRunsAscii(bytes);
  // Concatenate, dedupe consecutive lines
  const combined = [utf16, ascii].filter(Boolean).join("\n");
  return combined;
}

function decodeRunsUtf16LE(bytes) {
  const runs = [];
  let cur = [];
  const flush = () => {
    if (cur.length >= 4) {
      const s = String.fromCharCode(...cur).replace(/\s+/g, " ").trim();
      if (s.length >= 4 && /[A-Za-zÄÖÜäöüß]/.test(s)) runs.push(s);
    }
    cur = [];
  };
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    // Common printable + German umlauts + whitespace
    if ((code >= 32 && code < 127) || code === 9 || code === 10 || code === 13 ||
        (code >= 160 && code <= 0x017F) || (code >= 0x2000 && code <= 0x206F)) {
      cur.push(code);
    } else {
      flush();
    }
  }
  flush();
  return runs.join("\n");
}

function decodeRunsAscii(bytes) {
  const runs = [];
  let cur = [];
  const flush = () => {
    if (cur.length >= 6) {
      const s = String.fromCharCode(...cur).replace(/\s+/g, " ").trim();
      if (s.length >= 6 && /[A-Za-z]{3,}/.test(s)) runs.push(s);
    }
    cur = [];
  };
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if ((c >= 32 && c < 127) || c === 9) cur.push(c);
    else flush();
  }
  flush();
  // Filter out obviously XML-like or PK header garbage
  return runs.filter(s => !/^<\?xml|^PK|^MSCF|^\$\{/.test(s)).join("\n");
}

function splitParagraphs(text) {
  if (!text) return [];
  const lines = text.split(/\n+/)
    .map(s => s.replace(/[\x00-\x1F]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(s => s.length >= 3 && /[A-Za-zÄÖÜäöüß]/.test(s));
  // Deduplicate adjacent duplicates
  const out = [];
  for (const l of lines) {
    if (out[out.length - 1] !== l) out.push(l);
  }
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
}

