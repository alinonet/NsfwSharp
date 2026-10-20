#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
EXAMPLE_DIR="$SCRIPT_DIR/../NsfwSharp.Example"

for required_file in yolo_11m_nsfw.onnx test.jpg; do
    if [[ ! -f "$EXAMPLE_DIR/$required_file" ]]; then
        printf 'File richiesto mancante: %s\n' "$EXAMPLE_DIR/$required_file" >&2
        exit 1
    fi
done

cd "$EXAMPLE_DIR"
dotnet run --project "NsfwSharp.Example.csproj"
