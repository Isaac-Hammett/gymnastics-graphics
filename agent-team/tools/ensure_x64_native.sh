#!/bin/bash
# ensure_x64_native.sh: give show-controller's native build packages an Intel (x86_64) copy next to the arm64 one.
#
# Why: tmux on this Mac is an Intel-only build, so agent runs inherit Rosetta and their node runs as x64.
# npm installs only the host's native packages (arm64), so `npm run build` inside a run failed with
# "Cannot find module @rollup/rollup-darwin-x64" (ISA2-303 verify, 2026-09-27). This unpacks the x64 builds at
# the exact installed versions, without touching package.json or the lockfile. An `npm install` may drop them
# again; agent_run.sh calls this before every run, so they come back. Needs registry.npmjs.org when missing.
set -u
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NM="$ROOT/show-controller/node_modules"
[ -d "$NM" ] || exit 0
[ "$(uname -s)" = "Darwin" ] || exit 0

# arm64 package dir  ->  x64 package name
PAIRS=(
  "@rollup/rollup-darwin-arm64:@rollup/rollup-darwin-x64"
  "@esbuild/darwin-arm64:@esbuild/darwin-x64"
  "@tailwindcss/oxide-darwin-arm64:@tailwindcss/oxide-darwin-x64"
  "lightningcss-darwin-arm64:lightningcss-darwin-x64"
)
TMP=""
trap '[ -n "$TMP" ] && rm -rf "$TMP"' EXIT
for pair in "${PAIRS[@]}"; do
  arm="${pair%%:*}"; x64="${pair#*:}"
  [ -f "$NM/$arm/package.json" ] || continue
  ver="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$NM/$arm/package.json")"
  if [ -f "$NM/$x64/package.json" ] && \
     [ "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$NM/$x64/package.json")" = "$ver" ]; then
    continue
  fi
  [ -n "$TMP" ] || TMP="$(mktemp -d "${TMPDIR:-/tmp}/x64native.XXXXXX")"
  tgz="$(cd "$TMP" && npm pack "$x64@$ver" --silent 2>/dev/null | tail -1)"
  if [ -z "$tgz" ] || [ ! -f "$TMP/$tgz" ]; then
    echo "ensure_x64_native: could not fetch $x64@$ver" >&2
    continue
  fi
  rm -rf "$NM/$x64"; mkdir -p "$NM/$x64"
  tar -xzf "$TMP/$tgz" -C "$NM/$x64" --strip-components=1 && echo "ensure_x64_native: installed $x64@$ver"
done
exit 0
