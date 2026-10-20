#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR/../NsfwSharp.WebExample"
dotnet run --project "NsfwSharp.WebExample.csproj"
