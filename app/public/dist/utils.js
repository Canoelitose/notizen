const STORAGE_KEY = "notes-app-v1";
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const nowIso = () => new Date().toISOString();
const formatRel = iso => {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std`;
  if (diff < 604800) return `vor ${Math.floor(diff / 86400)} Tagen`;
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};
const formatDateTime = iso => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};
const api = {
  async fetchState() {
    const r = await fetch("/api/state", {
      credentials: "same-origin"
    });
    if (r.status === 401) {
      window.location.href = "/login";
      throw new Error("unauthorized");
    }
    if (!r.ok) throw new Error("fetch state failed: " + r.status);
    const remote = await r.json();
    return migrateState(remote);
  },
  async saveState(state) {
    const {
      loaded,
      _allowEmpty,
      ...payload
    } = state;
    const url = _allowEmpty ? "/api/state?allowEmpty=1" : "/api/state";
    const r = await fetch(url, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (r.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!r.ok) throw new Error("save state failed: " + r.status);
    return r.json();
  },
  async logout() {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin"
      });
    } finally {
      window.location.href = "/login";
    }
  }
};
const emptyState = () => ({
  folders: [],
  notes: [],
  templates: [],
  trash: [],
  themePref: "dark",
  selectedFolderId: "dashboard",
  selectedNoteId: null
});
const loadState = () => null;
const migrateState = state => {
  if (!state || !Array.isArray(state.notes)) return state;
  const seenNoteIds = new Set();
  state.notes = state.notes.map(n => {
    let id = n.id;
    if (!id || seenNoteIds.has(id)) id = uid();
    seenNoteIds.add(id);
    return id === n.id ? n : {
      ...n,
      id
    };
  });
  if (Array.isArray(state.folders)) {
    const seenFolderIds = new Set();
    state.folders = state.folders.map(f => {
      let id = f.id;
      if (!id || seenFolderIds.has(id)) id = uid();
      seenFolderIds.add(id);
      return id === f.id ? f : {
        ...f,
        id
      };
    });
  }
  state.templates = state.templates || [];
  const existingNames = new Set(state.templates.map(t => t.name));
  for (const tpl of BUILTIN_TEMPLATES) {
    if (!existingNames.has(tpl.name)) {
      state.templates.push({
        id: uid(),
        name: tpl.name,
        icon: tpl.icon,
        blocks: tpl.blocks.map(b => ({
          ...b
        }))
      });
    }
  }
  state.notes = state.notes.map(n => {
    if (n.type !== "it") return n;
    if (Array.isArray(n.blocks) && n.blocks.length > 0) return n;
    const blocks = [];
    blocks.push({
      id: uid(),
      kind: "status",
      value: n.status || "neutral"
    });
    if (n.command || n.output) {
      blocks.push({
        id: uid(),
        kind: "heading",
        text: "Befehl"
      });
      blocks.push({
        id: uid(),
        kind: "code",
        text: n.command || "",
        lang: n.commandLang || "bash",
        output: n.output ?? ""
      });
    }
    if (n.description) {
      blocks.push({
        id: uid(),
        kind: "heading",
        text: "Beschreibung / Kontext"
      });
      blocks.push({
        id: uid(),
        kind: "text",
        text: n.description
      });
    }
    if (Array.isArray(n.links) && n.links.length > 0) {
      blocks.push({
        id: uid(),
        kind: "links",
        items: n.links.map(l => ({
          id: l.id || uid(),
          label: l.label || "",
          url: l.url || ""
        }))
      });
    }
    const {
      command,
      commandLang,
      output,
      description,
      status,
      links,
      ...rest
    } = n;
    return {
      ...rest,
      blocks: blocks.length ? blocks : [{
        id: uid(),
        kind: "text",
        text: ""
      }]
    };
  });
  return state;
};
let _saveTimer = null,
  _saveInflight = false,
  _pendingState = null;
const _saveListeners = new Set();
const onSaveStatus = fn => {
  _saveListeners.add(fn);
  return () => _saveListeners.delete(fn);
};
const _emitSave = s => _saveListeners.forEach(fn => {
  try {
    fn(s);
  } catch (e) {}
});
const _doSave = async () => {
  if (_saveInflight || !_pendingState) return;
  const st = _pendingState;
  _pendingState = null;
  _saveInflight = true;
  _emitSave("saving");
  try {
    await api.saveState(st);
    _emitSave(_pendingState ? "saving" : "saved");
  } catch (e) {
    console.warn("save failed", e);
    _emitSave("error");
  } finally {
    _saveInflight = false;
    if (_pendingState) _doSave();
  }
};
const saveState = state => {
  if (!state || !state.loaded) return;
  _pendingState = state;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_doSave, 600);
};
const flushSave = () => {
  clearTimeout(_saveTimer);
  if (_pendingState) _doSave();
};
const BUILTIN_TEMPLATES = [{
  id: "__builtin_normal",
  name: "Normale Notiz",
  icon: "doc",
  builtin: true,
  blocks: [{
    kind: "text",
    text: ""
  }]
}, {
  id: "__builtin_it",
  name: "IT-Notiz",
  icon: "terminal",
  builtin: true,
  blocks: [{
    kind: "status",
    value: "neutral"
  }, {
    kind: "heading",
    text: "Befehl"
  }, {
    kind: "code",
    text: "",
    lang: "bash",
    output: ""
  }, {
    kind: "heading",
    text: "Beschreibung / Kontext"
  }, {
    kind: "text",
    text: ""
  }, {
    kind: "links",
    items: []
  }]
}, {
  id: "__builtin_recipe",
  name: "Rezept",
  icon: "heart",
  builtin: true,
  blocks: [{
    kind: "heading",
    text: "Rezeptname"
  }, {
    kind: "recipe-meta",
    servings: 4,
    prepTime: "15 Min",
    cookTime: "30 Min",
    difficulty: "mittel"
  }, {
    kind: "image",
    src: "",
    caption: ""
  }, {
    kind: "heading",
    text: "Zutaten"
  }, {
    kind: "ingredients",
    items: [{
      id: "__seed1",
      amount: "",
      unit: "",
      name: ""
    }, {
      id: "__seed2",
      amount: "",
      unit: "",
      name: ""
    }, {
      id: "__seed3",
      amount: "",
      unit: "",
      name: ""
    }]
  }, {
    kind: "heading",
    text: "Zubereitung"
  }, {
    kind: "checklist",
    items: [{
      text: ""
    }, {
      text: ""
    }, {
      text: ""
    }]
  }, {
    kind: "subheading",
    text: "Notizen / Variationen"
  }, {
    kind: "text",
    text: ""
  }]
}];
const TEMPLATE_VARS = (ctx = {}) => {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  return {
    datum: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
    zeit: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    wochentag: dayNames[d.getDay()],
    monat: monthNames[d.getMonth()],
    jahr: String(d.getFullYear()),
    kw: `KW ${weekNo}`,
    KW: `KW ${weekNo}`,
    projekt: ctx.projekt || "",
    ich: ctx.ich || localStorage.getItem("notes-app-user") || "",
    ...ctx
  };
};
const substituteVars = (text, ctx) => {
  if (!text || typeof text !== "string" || !text.includes("{{")) return text;
  const vars = TEMPLATE_VARS(ctx || {});
  return text.replace(/\{\{(\w+)\}\}/g, (m, name) => {
    const v = vars[name];
    return v != null ? v : m;
  });
};
const instantiateBlocks = (blocks, ctx) => (blocks || []).map(b => {
  const block = {
    ...b,
    id: uid()
  };
  if (b.text != null) block.text = substituteVars(b.text, ctx);
  if (b.output != null) block.output = substituteVars(b.output, ctx);
  if (b.caption != null) block.caption = substituteVars(b.caption, ctx);
  if (b.items) block.items = b.items.map(i => ({
    ...i,
    id: uid(),
    ...(i.text != null ? {
      text: substituteVars(i.text, ctx)
    } : {}),
    ...(i.label != null ? {
      label: substituteVars(i.label, ctx)
    } : {}),
    ...(i.name != null ? {
      name: substituteVars(i.name, ctx)
    } : {})
  }));
  if (b.rows) block.rows = b.rows.map(r => r.map(c => substituteVars(c, ctx)));
  if (b.headers) block.headers = b.headers.map(h => substituteVars(h, ctx));
  return block;
});
const blocksToTemplate = blocks => (blocks || []).map(b => {
  if (b.kind === "text" || b.kind === "heading" || b.kind === "subheading") return {
    kind: b.kind,
    text: b.text || ""
  };
  if (b.kind === "code") return {
    kind: "code",
    text: "",
    lang: b.lang || "bash",
    ...(b.output != null ? {
      output: ""
    } : {})
  };
  if (b.kind === "mermaid") {
    if (Array.isArray(b.nodes)) {
      return {
        kind: "mermaid",
        nodes: b.nodes.map(n => ({
          ...n
        })),
        edges: (b.edges || []).map(e => ({
          ...e
        })),
        ...(b.height ? {
          height: b.height
        } : {})
      };
    }
    return {
      kind: "mermaid",
      text: b.text || "",
      view: b.view || "split",
      ...(b.height ? {
        height: b.height
      } : {})
    };
  }
  if (b.kind === "checklist") return {
    kind: "checklist",
    items: (b.items || []).map(i => ({
      text: i.text || "",
      done: false
    }))
  };
  if (b.kind === "table") return {
    kind: "table",
    headers: [...(b.headers || [])],
    rows: (b.rows || []).map(r => r.map(() => ""))
  };
  if (b.kind === "image") return {
    kind: "image",
    src: "",
    caption: ""
  };
  if (b.kind === "file") return {
    kind: "file",
    name: "",
    mime: "",
    size: 0,
    src: ""
  };
  if (b.kind === "status") return {
    kind: "status",
    value: "neutral"
  };
  if (b.kind === "links") return {
    kind: "links",
    items: []
  };
  if (b.kind === "noteref") return {
    kind: "noteref",
    targetId: "",
    label: ""
  };
  if (b.kind === "recipe-meta") return {
    kind: "recipe-meta",
    servings: b.servings || 2,
    prepTime: "",
    cookTime: "",
    difficulty: b.difficulty || "einfach"
  };
  if (b.kind === "ingredients") return {
    kind: "ingredients",
    items: (b.items || []).map(i => ({
      amount: "",
      unit: i.unit || "",
      name: ""
    }))
  };
  return {
    ...b
  };
});
const seed = () => {
  const folders = [{
    id: "f1",
    name: "Server-Admin",
    icon: "terminal",
    parentId: null
  }, {
    id: "f1a",
    name: "Linux",
    icon: "server",
    parentId: "f1"
  }, {
    id: "f1b",
    name: "Docker",
    icon: "package",
    parentId: "f1"
  }, {
    id: "f1c",
    name: "Datenbanken",
    icon: "database",
    parentId: "f1"
  }, {
    id: "f1d",
    name: "Netzwerk",
    icon: "globe",
    parentId: "f1"
  }, {
    id: "f2",
    name: "Projekte",
    icon: "briefcase",
    parentId: null
  }, {
    id: "f2a",
    name: "Backup-Strategie",
    icon: "shield",
    parentId: "f2"
  }, {
    id: "f2b",
    name: "Migration 2026",
    icon: "package",
    parentId: "f2"
  }, {
    id: "f3",
    name: "Lernen & Snippets",
    icon: "bookmark",
    parentId: null
  }, {
    id: "f3a",
    name: "Bash & Shell",
    icon: "terminal",
    parentId: "f3"
  }, {
    id: "f3b",
    name: "Kubernetes",
    icon: "package",
    parentId: "f3"
  }, {
    id: "f3c",
    name: "Git",
    icon: "code",
    parentId: "f3"
  }, {
    id: "f4",
    name: "Persönlich",
    icon: "heart",
    parentId: null
  }, {
    id: "f4a",
    name: "Rezepte",
    icon: "fire",
    parentId: "f4"
  }, {
    id: "f4b",
    name: "Wochenplan",
    icon: "calendar",
    parentId: "f4"
  }];
  return {
    theme: "light",
    selectedFolderId: "dashboard",
    selectedNoteId: null,
    templates: [],
    folders,
    notes: [{
      id: "n1",
      type: "it",
      folderId: "f1a",
      pinned: true,
      title: "nginx neu laden nach Config-Änderung",
      command: "sudo nginx -t && sudo systemctl reload nginx",
      commandLang: "bash",
      output: "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful",
      description: "Erst Syntax prüfen, dann reloaden. Reload startet keine neuen Worker — Verbindungen bleiben offen.",
      status: "success",
      tags: ["nginx", "linux", "deploy"],
      links: [{
        id: uid(),
        label: "nginx docs",
        url: "https://nginx.org/en/docs/"
      }],
      createdAt: "2026-05-12T09:14:00Z",
      updatedAt: "2026-05-19T14:22:00Z"
    }, {
      id: "n2",
      type: "it",
      folderId: "f1c",
      pinned: false,
      title: "Postgres Dump mit Komprimierung",
      command: "pg_dump -U app -h db.internal -Fc app_prod > backup_$(date +%F).dump",
      commandLang: "bash",
      output: "pg_dump: warning: there are circular foreign-key constraints on this table:\npg_dump:   audit_log\npg_dump: dumping contents of table \"public.users\"",
      description: "Format -Fc ist binär und komprimiert. Restore mit pg_restore. Bei großen DBs SSH-Tunnel verwenden.",
      status: "warning",
      tags: ["postgres", "backup", "db"],
      links: [],
      createdAt: "2026-05-15T16:02:00Z",
      updatedAt: "2026-05-18T08:45:00Z"
    }, {
      id: "n3",
      type: "it",
      folderId: "f1b",
      pinned: false,
      title: "Docker compose Logs filtern nach Service",
      command: "docker compose logs -f --tail=100 api",
      commandLang: "bash",
      output: "",
      description: "Folgt nur dem API-Service. --tail=100 zeigt die letzten 100 Zeilen vor dem Follow.",
      status: "success",
      tags: ["docker", "logs"],
      links: [],
      createdAt: "2026-05-10T11:30:00Z",
      updatedAt: "2026-05-10T11:30:00Z"
    }, {
      id: "n4",
      type: "normal",
      folderId: "f4b",
      pinned: true,
      title: "Wochenplan KW 21",
      blocks: [{
        id: uid(),
        kind: "heading",
        text: "Ziele dieser Woche"
      }, {
        id: uid(),
        kind: "checklist",
        items: [{
          id: uid(),
          text: "Backup-Strategie dokumentieren",
          done: true
        }, {
          id: uid(),
          text: "Monitoring-Alerts überprüfen",
          done: false
        }, {
          id: uid(),
          text: "Team-Sync vorbereiten",
          done: false
        }]
      }, {
        id: uid(),
        kind: "subheading",
        text: "Notizen aus dem Standup"
      }, {
        id: uid(),
        kind: "text",
        text: "Frontend-Deploy wurde wegen Cache-Header verzögert. Lösung morgen testen."
      }],
      tags: ["wochenplan", "todo"],
      createdAt: "2026-05-18T08:00:00Z",
      updatedAt: "2026-05-19T17:00:00Z"
    }, {
      id: "n5",
      type: "it",
      folderId: "f1d",
      pinned: false,
      title: "SSH Tunnel zur DB öffnen",
      command: "ssh -L 5432:db.internal:5432 -N bastion.example.com",
      commandLang: "bash",
      output: "channel 3: open failed: administratively prohibited: open failed",
      description: "Sollte den lokalen Port 5432 auf die interne DB forwarden. -N = keine Shell. Fehler weil ACL auf Bastion neu war.",
      status: "error",
      tags: ["ssh", "db", "fixed"],
      links: [],
      createdAt: "2026-05-08T10:00:00Z",
      updatedAt: "2026-05-08T10:30:00Z"
    }, {
      id: "n6",
      type: "normal",
      folderId: "f3b",
      pinned: false,
      title: "Kubernetes Cheatsheet",
      blocks: [{
        id: uid(),
        kind: "text",
        text: "Kleine Sammlung Befehle, die ich immer wieder brauche."
      }, {
        id: uid(),
        kind: "table",
        headers: ["Aktion", "Befehl"],
        rows: [["Pods listen", "kubectl get pods"], ["Logs folgen", "kubectl logs -f <pod>"], ["Pod beenden", "kubectl delete pod <name>"], ["Shell in Pod", "kubectl exec -it <pod> -- /bin/sh"]]
      }, {
        id: uid(),
        kind: "subheading",
        text: "Tipps"
      }, {
        id: uid(),
        kind: "text",
        text: "Aliase setzen: alias k=kubectl. Namespace per Default mit kubens."
      }],
      tags: ["kubernetes", "cheatsheet"],
      createdAt: "2026-05-05T12:00:00Z",
      updatedAt: "2026-05-16T09:00:00Z"
    }, {
      id: "n7",
      type: "it",
      folderId: "f2a",
      pinned: false,
      title: "Rsync zu Remote Backup-Server",
      command: "rsync -avzP --delete /var/data/ backup@nas.local:/backups/data/",
      commandLang: "bash",
      output: "",
      description: "Inkrementeller Sync mit --delete (entfernt fehlende Dateien auf dem Ziel). -P zeigt Fortschritt + macht resumable.",
      status: "success",
      tags: ["rsync", "backup"],
      links: [],
      createdAt: "2026-05-14T07:00:00Z",
      updatedAt: "2026-05-14T07:00:00Z"
    }, {
      id: "n8",
      type: "normal",
      folderId: "f3c",
      pinned: false,
      title: "Git Workflow Notizen",
      blocks: [{
        id: uid(),
        kind: "heading",
        text: "Hilfreiche Befehle"
      }, {
        id: uid(),
        kind: "code",
        lang: "bash",
        text: "git log --oneline --graph --all -20\ngit reflog\ngit stash list",
        output: null
      }, {
        id: uid(),
        kind: "text",
        text: "reflog rettet wenn man versehentlich was gelöscht hat — zeigt alle HEAD-Bewegungen."
      }],
      tags: ["git", "workflow"],
      createdAt: "2026-05-06T10:00:00Z",
      updatedAt: "2026-05-17T14:00:00Z"
    }, {
      id: "n9",
      type: "normal",
      folderId: "f4a",
      pinned: false,
      title: "Pasta Aglio e Olio",
      blocks: [{
        id: uid(),
        kind: "recipe-meta",
        servings: 2,
        prepTime: "5 Min",
        cookTime: "15 Min",
        difficulty: "einfach"
      }, {
        id: uid(),
        kind: "heading",
        text: "Zutaten"
      }, {
        id: uid(),
        kind: "ingredients",
        items: [{
          id: uid(),
          amount: "200",
          unit: "g",
          name: "Spaghetti"
        }, {
          id: uid(),
          amount: "4",
          unit: "Stk",
          name: "Knoblauchzehen"
        }, {
          id: uid(),
          amount: "60",
          unit: "ml",
          name: "Olivenöl"
        }, {
          id: uid(),
          amount: "1",
          unit: "Prise",
          name: "Chiliflocken"
        }, {
          id: uid(),
          amount: "1",
          unit: "Bund",
          name: "Petersilie"
        }]
      }, {
        id: uid(),
        kind: "heading",
        text: "Zubereitung"
      }, {
        id: uid(),
        kind: "checklist",
        items: [{
          id: uid(),
          text: "Pasta in Salzwasser kochen",
          done: false
        }, {
          id: uid(),
          text: "Knoblauch in dünne Scheiben schneiden",
          done: false
        }, {
          id: uid(),
          text: "Öl mit Knoblauch + Chili erhitzen (nicht braun!)",
          done: false
        }, {
          id: uid(),
          text: "Pasta mit etwas Kochwasser zum Öl geben",
          done: false
        }, {
          id: uid(),
          text: "Mit Petersilie servieren",
          done: false
        }]
      }],
      tags: ["pasta", "italienisch", "schnell"],
      createdAt: "2026-05-03T18:00:00Z",
      updatedAt: "2026-05-11T19:30:00Z"
    }, {
      id: "n10",
      type: "it",
      folderId: "f3a",
      pinned: false,
      title: "find: Große Dateien finden",
      command: "find /var/log -type f -size +100M -exec ls -lh {} \\;",
      commandLang: "bash",
      output: "",
      description: "Findet Dateien > 100 MB unter /var/log und listet sie mit Größe. -exec ls -lh statt nur -ls für sortierbare Ausgabe.",
      status: "success",
      tags: ["bash", "find", "disk"],
      links: [],
      createdAt: "2026-04-28T15:00:00Z",
      updatedAt: "2026-05-09T11:00:00Z"
    }, {
      id: "n11",
      type: "normal",
      folderId: "f2b",
      pinned: false,
      title: "Migration 2026 — Checkliste",
      blocks: [{
        id: uid(),
        kind: "status",
        value: "warning"
      }, {
        id: uid(),
        kind: "heading",
        text: "Vor Migration"
      }, {
        id: uid(),
        kind: "checklist",
        items: [{
          id: uid(),
          text: "Snapshot der DB erstellen",
          done: true
        }, {
          id: uid(),
          text: "Maintenance-Mode aktivieren",
          done: false
        }, {
          id: uid(),
          text: "DNS-TTL auf 60s senken (24h vorher)",
          done: true
        }]
      }, {
        id: uid(),
        kind: "heading",
        text: "Während Migration"
      }, {
        id: uid(),
        kind: "checklist",
        items: [{
          id: uid(),
          text: "Daten transferieren via rsync",
          done: false
        }, {
          id: uid(),
          text: "Schema migrations laufen lassen",
          done: false
        }, {
          id: uid(),
          text: "Smoke-Tests gegen Staging",
          done: false
        }]
      }],
      tags: ["migration", "checklist"],
      createdAt: "2026-05-01T09:00:00Z",
      updatedAt: "2026-05-20T16:00:00Z"
    }]
  };
};
const allTags = notes => {
  const map = new Map();
  notes.forEach(n => (n.tags || []).forEach(t => map.set(t, (map.get(t) || 0) + 1)));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};
const notePreview = note => {
  if (note.command || note.description) {
    return note.command || note.description || "";
  }
  const blocks = note.blocks || [];
  const codeBlock = blocks.find(b => b.kind === "code" && b.text);
  if (codeBlock) return codeBlock.text;
  const block = blocks.find(b => b.text || b.items || b.rows);
  if (!block) return "";
  if (block.text) return block.text;
  if (block.items) return block.items.map(i => i.text || i.label).filter(Boolean).join(" · ");
  if (block.rows) return block.rows.flat().filter(Boolean).slice(0, 3).join(" · ");
  return "";
};
const getNoteStatus = note => {
  if (note.status) return note.status;
  const statusBlock = (note.blocks || []).find(b => b.kind === "status");
  if (statusBlock && statusBlock.value && statusBlock.value !== "neutral") return statusBlock.value;
  return null;
};
const toMarkdown = note => {
  const lines = [];
  lines.push(`# ${note.title || "Ohne Titel"}`);
  lines.push("");
  if (note.tags?.length) lines.push(`*Tags: ${note.tags.map(t => `#${t}`).join(" ")}*`);
  lines.push(`*Aktualisiert: ${formatDateTime(note.updatedAt)}*`);
  lines.push("");
  if (note.type === "it") {
    if (note.description) {
      lines.push(note.description);
      lines.push("");
    }
    if (note.command) {
      lines.push(`## Befehl`);
      lines.push("```" + (note.commandLang || "bash"));
      lines.push(note.command);
      lines.push("```");
      lines.push("");
    }
    if (note.output) {
      lines.push(`## Output`);
      lines.push("```");
      lines.push(note.output);
      lines.push("```");
      lines.push("");
    }
    if (note.status) lines.push(`**Status:** ${note.status}`);
    if (note.links?.length) {
      lines.push("");
      lines.push(`## Links`);
      note.links.forEach(l => lines.push(`- [${l.label || l.url}](${l.url})`));
    }
  } else {
    (note.blocks || []).forEach(b => {
      if (b.kind === "heading") lines.push(`## ${b.text || ""}`);else if (b.kind === "subheading") lines.push(`### ${b.text || ""}`);else if (b.kind === "text") lines.push(b.text || "");else if (b.kind === "checklist") {
        (b.items || []).forEach(i => lines.push(`- [${i.done ? "x" : " "}] ${i.text || ""}`));
      } else if (b.kind === "code") {
        lines.push("```" + (b.lang || ""));
        lines.push(b.text || "");
        lines.push("```");
        if (b.output != null) {
          lines.push("");
          lines.push("**Output:**");
          lines.push("```");
          lines.push(b.output || "");
          lines.push("```");
        }
      } else if (b.kind === "mermaid") {
        lines.push("```mermaid");
        if (Array.isArray(b.nodes)) {
          if (window.graphToMermaid) lines.push(window.graphToMermaid({
            nodes: b.nodes,
            edges: b.edges || []
          }));else lines.push("flowchart LR");
        } else {
          lines.push(b.text || "");
        }
        lines.push("```");
      } else if (b.kind === "table") {
        if (b.headers) lines.push(`| ${b.headers.join(" | ")} |`);
        if (b.headers) lines.push(`| ${b.headers.map(() => "---").join(" | ")} |`);
        (b.rows || []).forEach(r => lines.push(`| ${r.join(" | ")} |`));
      } else if (b.kind === "image") {
        lines.push(`![${b.caption || ""}](${b.src || ""})`);
      } else if (b.kind === "noteref") {
        const label = (b.label || "").trim() || "Notiz-Link";
        lines.push(`→ **${label}** [[${b.targetId}]]`);
      } else if (b.kind === "recipe-meta") {
        lines.push(`> 🍽️ **${b.servings || "—"} Portionen**  ·  ⏱️ Vorb: ${b.prepTime || "—"}  ·  🔥 Kochen: ${b.cookTime || "—"}  ·  ⚡ ${b.difficulty || "—"}`);
      } else if (b.kind === "ingredients") {
        (b.items || []).forEach(i => {
          const amt = [i.amount, i.unit].filter(Boolean).join(" ");
          lines.push(`- ${amt ? `**${amt}** ` : ""}${i.name || ""}`);
        });
      }
      lines.push("");
    });
  }
  return lines.join("\n");
};
const download = (filename, content, mime = "text/plain") => {
  const blob = new Blob([content], {
    type: mime
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
const copyToClipboard = async text => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
Object.assign(window, {
  uid,
  nowIso,
  formatRel,
  formatDateTime,
  loadState,
  saveState,
  seed,
  api,
  emptyState,
  onSaveStatus,
  flushSave,
  migrateState,
  allTags,
  notePreview,
  getNoteStatus,
  toMarkdown,
  download,
  copyToClipboard,
  BUILTIN_TEMPLATES,
  instantiateBlocks,
  blocksToTemplate,
  substituteVars,
  TEMPLATE_VARS,
  STORAGE_KEY
});