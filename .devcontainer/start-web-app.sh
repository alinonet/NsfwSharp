#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
log_file="${TMPDIR:-/tmp}/nsfwsharp-web-app.log"
url="http://127.0.0.1:5000/"

if curl --silent --output /dev/null --fail "$url"; then
    exit 0
fi

cd "$repo_root"
nohup env ASPNETCORE_URLS="http://0.0.0.0:5000" \
    dotnet run --no-launch-profile --project NsfwSharp.WebExample/NsfwSharp.WebExample.csproj \
    >"$log_file" 2>&1 < /dev/null &
app_pid=$!

for _ in {1..120}; do
    if curl --silent --output /dev/null --fail "$url"; then
        echo "NsfwSharp Web App is running at $url"
        exit 0
    fi

    if ! kill -0 "$app_pid" 2>/dev/null; then
        echo "NsfwSharp Web App failed to start. Log output:" >&2
        cat "$log_file" >&2
        exit 1
    fi

    sleep 1
done

echo "Timed out waiting for NsfwSharp Web App. Log output:" >&2
cat "$log_file" >&2
exit 1
