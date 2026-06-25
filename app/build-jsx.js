#!/usr/bin/env node
// build-jsx.js — Pre-compiles all in-browser-Babel JSX to plain JS so the app
// loads without @babel/standalone (no ~3MB download + no per-load compile).
//
// Reads public/index.html (the Claude-Design source with type="text/babel"
// scripts), compiles each referenced *.jsx -> public/dist/*.js, and writes
// public/index.prod.html that loads the compiled JS and drops Babel.
//
// Run after every deploy/new bundle:  node build-jsx.js
// Needs devDeps: @babel/core @babel/preset-react
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const pub = path.join(__dirname, "public");
const dist = path.join(pub, "dist");
fs.mkdirSync(dist, { recursive: true });

let html = fs.readFileSync(path.join(pub, "index.html"), "utf8");

// 1) Drop the @babel/standalone loader (no longer needed)
html = html.replace(/[ \t]*<script[^>]*@babel\/standalone[^>]*><\/script>\r?\n?/g, "");

// 2) Compile every text/babel JSX script and rewrite the tag to the compiled JS
let count = 0;
html = html.replace(/<script type="text\/babel" src="([^"]+)\.jsx"><\/script>/g, (m, name) => {
  const srcFile = path.join(pub, name + ".jsx");
  const code = fs.readFileSync(srcFile, "utf8");
  const out = babel.transform(code, {
    filename: name + ".jsx",
    presets: [["@babel/preset-react", { runtime: "classic" }]],
    compact: false,
    comments: false,
  }).code;
  fs.writeFileSync(path.join(dist, name + ".js"), out);
  count++;
  return `<script src="dist/${name}.js"></script>`;
});

fs.writeFileSync(path.join(pub, "index.prod.html"), html);
console.log(`Compiled ${count} JSX files -> public/dist/, wrote index.prod.html`);
