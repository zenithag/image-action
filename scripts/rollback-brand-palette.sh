#!/usr/bin/env bash
# Rolls the web console back to the state saved before the brand-palette test.
#
#   scripts/rollback-brand-palette.sh --dry-run   # show what would change
#   scripts/rollback-brand-palette.sh             # restore apps/web from the checkpoint
#
# The checkpoint is the commit at refs/checkpoints/before-brand-palette. It holds apps/web,
# pnpm-lock.yaml and package.json exactly as they were, including files that were still untracked.
# This script never touches your branch, your index or anything outside those paths.
#
# Lighter alternative: set BRAND_PALETTE_ENABLED to false in apps/web/lib/brand-palette.ts.
set -euo pipefail

REF="refs/checkpoints/before-brand-palette"
PATHS=(apps/web pnpm-lock.yaml package.json)
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

cd "$(git rev-parse --show-toplevel)"
git rev-parse --verify -q "$REF" >/dev/null || { echo "Checkpoint $REF not found."; exit 1; }

keep=$(mktemp); extra=$(mktemp)
git ls-tree -r --name-only "$REF" -- "${PATHS[@]}" | sort > "$keep"
# Untracked files that exist now but did not exist at the checkpoint (created by the palette test).
git ls-files -o --exclude-standard -- "${PATHS[@]}" | sort | comm -23 - "$keep" > "$extra"

echo "Files changed since the checkpoint:"
# Compare content, file by file (git diff misreports files that were untracked at the checkpoint).
changed=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if [ ! -e "$f" ]; then echo "  deleted (will be restored): $f"; changed=1; continue; fi
  now=$(git hash-object -- "$f"); then=$(git rev-parse "$REF:$f")
  [ "$now" != "$then" ] && { echo "  modified: $f"; changed=1; }
done < "$keep"
sed 's/^/  added (will be removed): /' "$extra"
[ "$changed" = 0 ] && [ ! -s "$extra" ] && echo "  (none: the working tree already matches the checkpoint)"

if [ "$DRY" = 1 ]; then echo "Dry run: nothing changed."; exit 0; fi

git restore --source="$REF" --worktree -- "${PATHS[@]}"
while IFS= read -r f; do [ -n "$f" ] && rm -f -- "$f"; done < "$extra"
rm -f "$keep" "$extra"
echo "Restored to the checkpoint. Restart the dev server (pnpm dev:web) to see it."
