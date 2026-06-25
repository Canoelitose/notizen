#!/bin/bash
set -e
JAR=/tmp/v2jar.txt
rm -f "$JAR"

curl -fsS -c "$JAR" -H "Content-Type: application/json" \
  -d '{"email":"${APP_EMAIL}","password":"${APP_PASS}"}' \
  http://127.0.0.1:3000/api/login >/dev/null

cat >/tmp/v2state.json <<'JSON'
{
  "folders":[{"id":"f-test2","name":"v2-Test","icon":"folder"}],
  "templates":[
    {"id":"t-mycustom","name":"Mein Custom","icon":"heart","blocks":[{"kind":"text","text":""}]}
  ],
  "notes":[
    {
      "id":"n-v2","folderId":"f-test2","type":"normal","pinned":false,
      "title":"v2 Smoke","tags":["v2"],
      "templateId":"t-mycustom","templateName":"Mein Custom",
      "blocks":[
        {"id":"b1","kind":"heading","text":"Rezept-Test"},
        {"id":"b2","kind":"recipe-meta","servings":2,"prepTime":"5","cookTime":"10","difficulty":"einfach"},
        {"id":"b3","kind":"ingredients","items":[{"id":"i1","amount":"100","unit":"g","name":"Mehl"}]},
        {"id":"b4","kind":"status","value":"success"}
      ],
      "createdAt":"2026-05-22T00:00:00Z","updatedAt":"2026-05-22T00:00:00Z"
    }
  ],
  "themePref":"auto",
  "selectedFolderId":"f-test2",
  "selectedNoteId":"n-v2"
}
JSON

echo "=== PUT v2 state with templates + new block kinds ==="
curl -fsS -X PUT -b "$JAR" -H "Content-Type: application/json" \
  --data-binary @/tmp/v2state.json http://127.0.0.1:3000/api/state
echo

echo "=== GET it back ==="
curl -fsS -b "$JAR" http://127.0.0.1:3000/api/state
echo

rm -f "$JAR" /tmp/v2state.json
