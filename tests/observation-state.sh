#!/usr/bin/env bash
# Exercises scripts/observation-state.sh against a throwaway bare remote:
# bootstrap, fetch/push round trip, idempotent retry, concurrent run rejection,
# unreachable remote. Run: bash tests/observation-state.sh
set -euo pipefail
script=$(cd "$(dirname "$0")/.." && pwd)/scripts/observation-state.sh
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git init -q --bare "$tmp/remote.git"
work() { git init -q "$tmp/$1"; git -C "$tmp/$1" remote add origin "$tmp/remote.git"; }
run() { (cd "$tmp/$1" && bash "$script" "$2" "$tmp/$1/state"); }
fail() { echo "FAIL: $*" >&2; exit 1; }
work a; work b
# 1. Missing branch: empty base, no files.
run a fetch | grep -q bootstrap || fail "bootstrap message"
[ ! -s "$tmp/a/state/.base" ] || fail "base should be empty"
# 2. First push creates the branch.
printf '#fasteign-observations\tv1\ttrackingSince=2026-09-20\n' >"$tmp/a/state/observations.tsv"
echo '[]' >"$tmp/a/state/runs.json"
run a push | grep -q Pushed || fail "first push"
# 3. Another runner fetches exactly that state.
run b fetch >/dev/null
cmp "$tmp/a/state/observations.tsv" "$tmp/b/state/observations.tsv" || fail "round trip"
# 4. Retrying a push with unchanged state is a no-op.
run b push | grep -q unchanged || fail "idempotent retry"
# 5. Runner a still holds an old base; b advances the branch; a must be rejected.
run a fetch >/dev/null
run b fetch >/dev/null
echo "1|2000001	0123456789ab	2026-10-01	-	-" >>"$tmp/b/state/observations.tsv"
run b push | grep -q Pushed || fail "second push"
echo "9|2000009	0123456789ab	2026-10-02	-	-" >>"$tmp/a/state/observations.tsv"
if run a push 2>/dev/null; then fail "stale push accepted"; fi
run a fetch >/dev/null
grep -q "^1|2000001" "$tmp/a/state/observations.tsv" || fail "winner's state kept"
grep -q "^9|2000009" "$tmp/a/state/observations.tsv" && fail "loser's state leaked"
# 6. A bootstrap push cannot replace an existing branch.
work c
mkdir -p "$tmp/c/state"; : >"$tmp/c/state/.base"
cp "$tmp/a/state/observations.tsv" "$tmp/a/state/runs.json" "$tmp/c/state/"
echo "x" >>"$tmp/c/state/runs.json"
if run c push 2>/dev/null; then fail "bootstrap overwrote branch"; fi
# 7. Unreachable remote fails instead of bootstrapping.
git -C "$tmp/c" remote set-url origin "$tmp/missing.git"
if run c fetch 2>/dev/null; then fail "unreachable remote treated as empty"; fi
# 8. Missing files are never pushed.
work d; run d fetch >/dev/null; rm "$tmp/d/state/runs.json"
if run d push 2>/dev/null; then fail "partial state pushed"; fi
echo "observation-state: all scenarios passed"
