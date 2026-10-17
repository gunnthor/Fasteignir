#!/usr/bin/env bash
# Durable observation state for scripts/fetch-kaupskra.ts, kept as plain files
# on an orphan branch (default: ingest-state) of this repository.
#
#   observation-state.sh fetch <dir>   download the branch tip into <dir>
#   observation-state.sh push <dir>    commit <dir> on top of the fetched tip
#
# fetch exits 0 with an empty <dir>/.base when the branch does not exist
# (first run: ingestion bootstraps) and fails on any other error, so an
# unreachable remote never causes a silent re-bootstrap. push only
# fast-forwards from the commit that was fetched: if the branch moved in the
# meantime, or the state did not change, nothing is overwritten.
set -euo pipefail
cmd=${1:?fetch or push}
dir=${2:?state directory}
remote=${STATE_REMOTE:-origin}
branch=${STATE_BRANCH:-ingest-state}
files=(observations.tsv runs.json)

case $cmd in
fetch)
  mkdir -p "$dir"
  set +e
  heads=$(git ls-remote --exit-code --heads "$remote" "refs/heads/$branch")
  rc=$?
  set -e
  if [ $rc -eq 2 ]; then
    echo "No $branch branch on $remote: ingestion will bootstrap a new state."
    : >"$dir/.base"
    exit 0
  fi
  if [ $rc -ne 0 ]; then
    echo "Cannot read $branch from $remote (exit $rc); refusing to continue." >&2
    exit 1
  fi
  sha=${heads%%[[:space:]]*}
  git fetch --quiet --no-tags --depth=1 "$remote" "refs/heads/$branch"
  if [ "$(git rev-parse FETCH_HEAD)" != "$sha" ]; then
    echo "$branch moved while fetching; retry the run." >&2
    exit 1
  fi
  for f in "${files[@]}"; do
    git show "FETCH_HEAD:$f" >"$dir/$f.tmp"
    mv "$dir/$f.tmp" "$dir/$f"
  done
  echo "$sha" >"$dir/.base"
  echo "Fetched observation state $sha"
  ;;
push)
  base=$(cat "$dir/.base")
  for f in "${files[@]}"; do
    [ -s "$dir/$f" ] || {
      echo "Missing $dir/$f; nothing pushed." >&2
      exit 1
    }
  done
  tree=$(
    for f in "${files[@]}"; do
      printf '100644 blob %s\t%s\n' "$(git hash-object -w --no-filters "$dir/$f")" "$f"
    done | git mktree
  )
  parent=()
  if [ -n "$base" ]; then
    git fetch --quiet --no-tags --depth=1 "$remote" "refs/heads/$branch"
    if [ "$(git rev-parse FETCH_HEAD)" != "$base" ]; then
      echo "$branch moved since this run fetched it; not overwriting." >&2
      exit 1
    fi
    if [ "$(git rev-parse "$base^{tree}")" = "$tree" ]; then
      echo "Observation state unchanged; nothing to push."
      exit 0
    fi
    parent=(-p "$base")
  fi
  commit=$(
    git -c user.name="fasteign-ingest" -c user.email="ingest@fasteign.invalid" \
      commit-tree "$tree" "${parent[@]}" \
      -m "Observation state $(date -u +%Y-%m-%dT%H:%MZ)"
  )
  # Never forced: the remote rejects anything that is not a fast-forward.
  git push --quiet "$remote" "$commit:refs/heads/$branch"
  echo "Pushed observation state $commit"
  ;;
*)
  echo "Unknown command $cmd" >&2
  exit 2
  ;;
esac
