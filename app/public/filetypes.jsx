// File type registry — 200+ common extensions with category, label, accent color.
// Used by the file block + preview modal.

const FILE_CATEGORIES = {
  image:        { label: "Bild",         color: "#10B981", icon: "image",   preview: "image"  },
  vector:       { label: "Vektor",       color: "#10B981", icon: "image",   preview: "image"  },
  raw:          { label: "Raw-Foto",     color: "#10B981", icon: "image",   preview: "none"   },
  video:        { label: "Video",        color: "#F472B6", icon: "image",   preview: "video"  },
  audio:        { label: "Audio",        color: "#FBBF24", icon: "image",   preview: "audio"  },
  pdf:          { label: "PDF",          color: "#EF4444", icon: "doc",     preview: "pdf"    },
  document:     { label: "Dokument",     color: "#3B82F6", icon: "doc",     preview: "word"   },
  spreadsheet:  { label: "Tabelle",      color: "#22C55E", icon: "table",   preview: "excel"  },
  presentation: { label: "Präsentation", color: "#F97316", icon: "doc",     preview: "powerpoint" },
  text:         { label: "Text",         color: "#94A3B8", icon: "doc",     preview: "text"   },
  markdown:     { label: "Markdown",     color: "#94A3B8", icon: "doc",     preview: "markdown" },
  code:         { label: "Code",         color: "#A78BFA", icon: "code",    preview: "code"   },
  web:          { label: "Web",          color: "#A78BFA", icon: "code",    preview: "html"   },
  data:         { label: "Daten",        color: "#06B6D4", icon: "code",    preview: "json"   },
  csv:          { label: "Tabelle",      color: "#0EA5E9", icon: "table",   preview: "csv"    },
  database:     { label: "Datenbank",    color: "#06B6D4", icon: "database",preview: "none"   },
  archive:      { label: "Archiv",       color: "#F59E0B", icon: "archive", preview: "archive"},
  exec:         { label: "Programm",     color: "#DC2626", icon: "package", preview: "none"   },
  font:         { label: "Schrift",      color: "#8B5CF6", icon: "type",    preview: "font"   },
  design:       { label: "Design",       color: "#EC4899", icon: "image",   preview: "none"   },
  threed:       { label: "3D-Modell",    color: "#8B5CF6", icon: "package", preview: "none"   },
  cad:          { label: "CAD",          color: "#8B5CF6", icon: "package", preview: "none"   },
  ebook:        { label: "E-Book",       color: "#3B82F6", icon: "doc",     preview: "archive"},
  contact:      { label: "Kontakt",      color: "#06B6D4", icon: "user",    preview: "text"   },
  calendar:     { label: "Kalender",     color: "#06B6D4", icon: "calendar",preview: "text"   },
  log:          { label: "Log",          color: "#64748B", icon: "doc",     preview: "text"   },
  config:       { label: "Konfig",       color: "#A78BFA", icon: "settings",preview: "code"   },
  other:        { label: "Datei",        color: "#94A3B8", icon: "doc",     preview: "none"   },
};

// ext → category (no dot prefix). Lowercase.
const FILE_EXT_MAP = (() => {
  const m = {};
  const add = (cat, exts) => exts.forEach(e => { m[e] = cat; });

  // Images
  add("image", ["png", "jpg", "jpeg", "jfif", "gif", "webp", "bmp", "tiff", "tif", "ico", "heic", "heif", "avif", "apng"]);
  add("vector", ["svg"]);
  add("raw",   ["raw", "cr2", "cr3", "nef", "arw", "dng", "orf", "rw2", "raf", "pef", "srw", "x3f"]);
  // Video
  add("video", ["mp4", "m4v", "mov", "avi", "mkv", "webm", "wmv", "flv", "mpg", "mpeg", "3gp", "3g2", "ogv", "vob", "ts", "mts", "m2ts", "asf"]);
  // Audio
  add("audio", ["mp3", "wav", "flac", "aac", "ogg", "oga", "m4a", "wma", "opus", "aiff", "aif", "alac", "amr", "mid", "midi", "ape"]);
  // PDF
  add("pdf", ["pdf"]);
  // Documents
  add("document", ["doc", "docx", "docm", "dot", "dotx", "dotm", "odt", "ott", "rtf", "pages", "wpd", "wps", "abw", "lwp", "tex"]);
  // Spreadsheets
  add("spreadsheet", ["xls", "xlsx", "xlsm", "xlsb", "xlt", "xltx", "xltm", "ods", "ots", "numbers", "fods", "gsheet"]);
  // Presentations
  add("presentation", ["ppt", "pptx", "pptm", "pot", "potx", "potm", "pps", "ppsx", "ppsm", "odp", "otp", "key", "fodp", "gslides"]);
  // Plain text
  add("text", ["txt", "text", "log", "diff", "patch", "asc"]);
  // Markdown
  add("markdown", ["md", "markdown", "mdx", "rst", "adoc", "asciidoc"]);
  // Code
  add("code", [
    "js", "mjs", "cjs", "jsx", "ts", "tsx", "py", "pyc", "pyi", "pyw",
    "java", "class", "kt", "kts", "scala", "groovy", "gradle",
    "c", "h", "cpp", "cc", "cxx", "hpp", "hh", "hxx", "ino",
    "cs", "vb", "fs", "fsx", "fsi",
    "rb", "erb", "rake", "gemspec",
    "go", "rs", "php", "phtml", "php3", "php4", "php5",
    "swift", "m", "mm",
    "lua", "r", "rmd", "jl", "pl", "pm", "t",
    "sh", "bash", "zsh", "fish", "ksh", "csh", "bat", "cmd", "ps1", "psm1",
    "dart", "ex", "exs", "erl", "hrl", "elm", "clj", "cljs", "cljc", "edn",
    "lisp", "lsp", "scm", "rkt", "ml", "mli", "hs", "lhs",
    "nim", "cr", "zig", "v", "vh", "vhdl", "sv", "svh",
    "asm", "s",
  ]);
  // Web
  add("web", ["html", "htm", "xhtml", "css", "scss", "sass", "less", "styl", "vue", "svelte", "astro", "ejs", "pug", "jade", "hbs", "mustache", "twig"]);
  // Data / serialization
  add("data", ["json", "json5", "jsonc", "ndjson", "xml", "yaml", "yml", "toml", "proto", "graphql", "gql", "geojson", "drawio", "vsdx", "vdx"]);
  add("csv", ["csv", "tsv"]);
  // Database
  add("database", ["sql", "sqlite", "sqlite3", "db", "db3", "mdb", "accdb", "dump", "bak"]);
  // Archive
  add("archive", ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "tbz", "tbz2", "xz", "txz", "zst", "lz", "lzma", "z", "iso", "dmg", "img"]);
  // Executables / installers
  add("exec", ["exe", "msi", "msix", "appx", "deb", "rpm", "pkg", "apk", "aab", "ipa", "app", "jar", "war", "ear"]);
  // Fonts
  add("font", ["ttf", "otf", "woff", "woff2", "eot"]);
  // Design files
  add("design", ["psd", "psb", "ai", "indd", "idml", "sketch", "fig", "xd", "afdesign", "afphoto", "afpub", "procreate"]);
  // 3D
  add("threed", ["obj", "stl", "fbx", "dae", "blend", "3ds", "ply", "gltf", "glb", "usdz", "usd", "3mf"]);
  // CAD
  add("cad", ["dwg", "dxf", "step", "stp", "iges", "igs", "sldprt", "sldasm", "f3d", "skp"]);
  // E-books
  add("ebook", ["epub", "mobi", "azw", "azw3", "fb2", "lit", "cbz", "cbr"]);
  // Contact / calendar
  add("contact", ["vcf", "vcard"]);
  add("calendar", ["ics", "ical", "ifb", "vcs"]);
  // Config
  add("config", ["ini", "cfg", "conf", "env", "properties", "plist", "rc", "lock", "editorconfig", "gitignore", "gitattributes", "dockerignore", "npmignore", "babelrc", "eslintrc", "prettierrc"]);

  return m;
})();

const getExt = (filename) => {
  if (!filename) return "";
  const parts = String(filename).toLowerCase().split(".");
  if (parts.length < 2) return "";
  // Special cases for compound extensions like .tar.gz
  const last = parts[parts.length - 1];
  const second = parts[parts.length - 2];
  if (last === "gz" && (second === "tar")) return "tgz";
  if (last === "bz2" && (second === "tar")) return "tbz";
  return last;
};

const getFileType = (filename) => {
  const ext = getExt(filename);
  const category = FILE_EXT_MAP[ext] || "other";
  return { ext, category, ...FILE_CATEGORIES[category] };
};

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
};

// Maps file extensions to Prism language identifiers for code previews
const FILE_EXT_TO_LANG = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
  ts: "typescript", tsx: "typescript",
  py: "python", rb: "ruby", go: "go", rs: "rust", php: "php",
  java: "java", kt: "kotlin", swift: "swift",
  c: "c", cpp: "cpp", cc: "cpp", h: "c", hpp: "cpp",
  cs: "csharp",
  sh: "bash", bash: "bash", zsh: "bash", fish: "bash",
  ps1: "powershell", psm1: "powershell",
  sql: "sql", html: "html", htm: "html", xml: "xml",
  css: "css", scss: "scss", sass: "sass", less: "less",
  json: "json", json5: "json", jsonc: "json",
  yaml: "yaml", yml: "yaml", toml: "toml",
  md: "markdown", markdown: "markdown",
  ini: "ini", conf: "ini", env: "ini", properties: "ini",
  dockerfile: "docker",
};

Object.assign(window, {
  FILE_CATEGORIES, FILE_EXT_MAP, FILE_EXT_TO_LANG,
  getExt, getFileType, formatBytes,
});
