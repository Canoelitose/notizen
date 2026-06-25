#!/bin/bash
# Runs inside LXC 104. Tests docx/odt/rtf conversion through the endpoint.
cd /tmp
export HOME=/tmp/lohome
mkdir -p "$HOME"
printf 'Word Test Dokument\nZweite Zeile mit Inhalt\n' > w.txt
soffice --headless --convert-to odt  --outdir /tmp w.txt >/dev/null 2>&1
soffice --headless --convert-to docx --outdir /tmp w.txt >/dev/null 2>&1
soffice --headless --convert-to rtf  --outdir /tmp w.txt >/dev/null 2>&1

JAR=/tmp/cj.txt; rm -f "$JAR"
curl -fsS -c "$JAR" -H 'Content-Type: application/json' \
  -d '{"email":"${APP_EMAIL}","password":"${APP_PASS}"}' \
  http://127.0.0.1:3000/api/login >/dev/null

for f in w.odt w.docx w.rtf; do
  [ -f "/tmp/$f" ] || { echo "$f NOT CREATED"; continue; }
  ext="${f##*.}"
  printf '%s -> ' "$f"
  curl -s -o /tmp/o.pdf -w 'HTTP=%{http_code} type=%{content_type} time=%{time_total}s\n' \
    -b "$JAR" -X POST -H 'Content-Type: application/octet-stream' \
    --data-binary "@/tmp/$f" "http://127.0.0.1:3000/api/convert/office?ext=$ext"
  printf '   magic: '; head -c 5 /tmp/o.pdf; echo
done
rm -f /tmp/w.txt /tmp/w.odt /tmp/w.docx /tmp/w.rtf /tmp/o.pdf
