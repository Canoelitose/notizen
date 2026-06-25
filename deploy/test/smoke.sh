#!/bin/bash
# Smoke test executed inside LXC 104
set -e
BASE=http://127.0.0.1:3000

echo "=== health ==="
curl -fsS $BASE/api/health | head -c 200; echo

echo "=== login ==="
COOKIE_FILE=$(mktemp)
HTTP=$(curl -sS -o /tmp/login.out -w "%{http_code}" -c "$COOKIE_FILE" \
  -H "Content-Type: application/json" \
  -d '{"email":"${APP_EMAIL}","password":"${APP_PASS}"}' \
  $BASE/api/login)
echo "status: $HTTP"
echo "body: $(cat /tmp/login.out)"
echo "cookies:"; cat "$COOKIE_FILE" | grep -v '^#' | grep -v '^$'

echo "=== me ==="
curl -fsS -b "$COOKIE_FILE" $BASE/api/me; echo

echo "=== initial state ==="
curl -fsS -b "$COOKIE_FILE" $BASE/api/state | head -c 400; echo

echo "=== PUT state (one folder, one IT note) ==="
cat >/tmp/state.json <<'JSON'
{
  "folders": [
    {"id":"f-test","name":"Test-Ordner","icon":"folder"}
  ],
  "notes": [
    {
      "id":"n-1","folderId":"f-test","type":"it","pinned":false,
      "title":"Mein erster Befehl",
      "command":"ls -la /opt",
      "commandLang":"bash",
      "output":"hello",
      "description":"Smoke test note",
      "status":"success",
      "tags":["test","smoke"],
      "links":[],
      "createdAt":"2026-05-21T20:00:00Z",
      "updatedAt":"2026-05-21T20:00:00Z"
    }
  ],
  "themePref":"auto",
  "selectedFolderId":"f-test",
  "selectedNoteId":"n-1"
}
JSON
curl -fsS -X PUT -b "$COOKIE_FILE" -H "Content-Type: application/json" \
  --data-binary @/tmp/state.json $BASE/api/state; echo

echo "=== state after PUT ==="
curl -fsS -b "$COOKIE_FILE" $BASE/api/state | head -c 600; echo

echo "=== logout ==="
curl -fsS -X POST -b "$COOKIE_FILE" $BASE/api/logout; echo

rm -f "$COOKIE_FILE" /tmp/login.out /tmp/state.json
echo "=== smoke test complete ==="
