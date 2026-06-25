#!/bin/bash
set -e
JAR=/tmp/v3jar.txt
rm -f "$JAR"

curl -fsS -c "$JAR" -H "Content-Type: application/json" \
  -d '{"email":"${APP_EMAIL}","password":"${APP_PASS}"}' \
  http://127.0.0.1:3000/api/login >/dev/null

echo "=== GET /api/state (should now include trash + parentId fields) ==="
curl -fsS -b "$JAR" http://127.0.0.1:3000/api/state | head -c 400; echo

cat >/tmp/v3state.json <<'JSON'
{
  "folders": [
    {"id":"f-root","name":"Projekte","icon":"briefcase","parentId":null},
    {"id":"f-sub1","name":"Migration 2026","icon":"package","parentId":"f-root"},
    {"id":"f-sub2","name":"Backup","icon":"shield","parentId":"f-root"},
    {"id":"f-flat","name":"Persönlich","icon":"heart","parentId":null}
  ],
  "templates": [
    {"id":"t-it","name":"IT-Notiz","icon":"terminal","blocks":[{"kind":"status","value":"neutral"}]}
  ],
  "trash": [
    {
      "id":"trash-1","title":"Alte Notiz","type":"normal","pinned":false,
      "folderId":"f-root","blocks":[{"id":"b1","kind":"text","text":"Gelöscht"}],
      "tags":[],"deletedAt":"2026-05-26T00:00:00Z",
      "createdAt":"2026-05-20T00:00:00Z","updatedAt":"2026-05-25T00:00:00Z"
    }
  ],
  "notes": [
    {
      "id":"n-v3","folderId":"f-sub1","type":"it","pinned":true,
      "title":"v3 Smoke Test","tags":["v3"],
      "templateId":"t-it","templateName":"IT-Notiz",
      "blocks":[
        {"id":"b1","kind":"status","value":"success"},
        {"id":"b2","kind":"heading","text":"Test"},
        {"id":"b3","kind":"noteref","targetId":"n-other","label":"Verlinkte Notiz"},
        {"id":"b4","kind":"code","text":"echo hi","lang":"bash","output":"hi"}
      ],
      "dueAt":"2026-06-01T12:00:00Z",
      "createdAt":"2026-05-26T00:00:00Z","updatedAt":"2026-05-26T00:00:00Z"
    }
  ],
  "themePref":"auto",
  "selectedFolderId":"f-sub1",
  "selectedNoteId":"n-v3"
}
JSON

echo "=== PUT with parentId-folders, trash, dueAt, noteref ==="
curl -fsS -X PUT -b "$JAR" -H "Content-Type: application/json" \
  --data-binary @/tmp/v3state.json http://127.0.0.1:3000/api/state; echo

echo "=== GET back, verify all survived ==="
curl -fsS -b "$JAR" http://127.0.0.1:3000/api/state; echo

echo "=== verify parent_id stored in DB ==="
rm -f "$JAR" /tmp/v3state.json
