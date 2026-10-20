#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

dotnet restore "$REPO_ROOT/NsfwSharp.sln"
dotnet build "$REPO_ROOT/NsfwSharp.sln" --no-restore
