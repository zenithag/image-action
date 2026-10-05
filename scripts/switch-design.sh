#!/usr/bin/env bash
# Switch the web console between its designs, and always get back.
#
#   scripts/switch-design.sh status                 # what is saved, and what matches the working tree
#   scripts/switch-design.sh original               # the original design (the committed code, HEAD)
#   scripts/switch-design.sh spectrum               # Spectrum design with the brand theme as default
#   scripts/switch-design.sh spectrum-no-white      # same, before the white menu and header experiment
#   scripts/switch-design.sh spectrum-classic       # Spectrum design as it was before the brand palette
#   add --dry-run to any of them to see what would change without touching anything
#
# Before every switch the current state of apps/web is saved to refs/checkpoints/auto-<time>, so no
# switch can lose work. Only apps/web, pnpm-lock.yaml and package.json are touched; your branch, your
# index, .env.local, node_modules and every file outside those paths stay as they are.
# After switching back to a design that needs Spectrum, run `pnpm install` if the packages are missing.
set -euo pipefail

PATHS=(apps/web pnpm-lock.yaml package.json)
DRY=0
ARGS=()
for a in "$@"; do [ "$a" = "--dry-run" ] && DRY=1 || ARGS+=("$a"); done
TARGET="${ARGS[0]:-status}"

cd "$(git rev-parse --show-toplevel)"

ref_for() {
  case "$1" in
    original)          echo "HEAD" ;;
    spectrum)          echo "refs/checkpoints/spectrum-brand-theme" ;;
    spectrum-no-white) echo "refs/checkpoints/before-white-chrome" ;;
    spectrum-classic)  echo "refs/checkpoints/before-brand-palette" ;;
    *) echo ""; return 1 ;;
  esac
}

# Files that differ between the working tree and REF (content compared, not index state).
diff_against() {
  local ref="$1" keep extra
  keep=$(mktemp); extra=$(mktemp)
  git ls-tree -r --name-only "$ref" -- "${PATHS[@]}" | sort > "$keep"
  git ls-files -o --exclude-standard -- "${PATHS[@]}" | sort | comm -23 - "$keep" > "$extra"
  # also tracked files that exist now but not in REF
  git ls-files -- "${PATHS[@]}" | sort | comm -23 - "$keep" >> "$extra"
  sort -u "$extra" -o "$extra"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if [ ! -e "$f" ]; then echo "restore  $f"; continue; fi
    [ "$(git hash-object -- "$f")" != "$(git rev-parse "$ref:$f")" ] && echo "change   $f"
  done < "$keep"
  sed 's/^/remove   /' "$extra"
  rm -f "$keep" "$extra"
}

save_current() {
  local idx tree commit name
  idx=$(mktemp -u)
  GIT_INDEX_FILE="$idx" git read-tree HEAD
  GIT_INDEX_FILE="$idx" git add -A -- "${PATHS[@]}" 2>/dev/null || true
  tree=$(GIT_INDEX_FILE="$idx" git write-tree)
  commit=$(git commit-tree "$tree" -p HEAD -m "Auto checkpoint before switching design")
  name="refs/checkpoints/auto-$(date +%Y%m%d-%H%M%S)"
  git update-ref "$name" "$commit"
  rm -f "$idx"
  echo "Current state saved as $name"
}

if [ "$TARGET" = "status" ]; then
  echo "Saved designs:"
  for t in original spectrum spectrum-no-white spectrum-classic; do
    r=$(ref_for "$t")
    if git rev-parse --verify -q "$r" >/dev/null; then
      n=$(diff_against "$r" | wc -l | tr -d ' ')
      [ "$n" = 0 ] && echo "  $t   <- the working tree is exactly this" || echo "  $t   ($n files differ from the working tree)"
    else
      echo "  $t   (missing: $r)"
    fi
  done
  echo "Automatic checkpoints:"; git for-each-ref refs/checkpoints --format='  %(refname:short)  %(subject)' | grep auto- || echo "  (none)"
  exit 0
fi

REF=$(ref_for "$TARGET") || { echo "Unknown design '$TARGET'. Use: original | spectrum | spectrum-no-white | spectrum-classic | status"; exit 1; }
git rev-parse --verify -q "$REF" >/dev/null || { echo "Saved design not found: $REF"; exit 1; }

echo "Switching to: $TARGET ($REF)"
changes=$(diff_against "$REF")
if [ -z "$changes" ]; then echo "Already exactly this design."; exit 0; fi
echo "$changes" | sed 's/^/  /'

if [ "$DRY" = 1 ]; then echo "Dry run: nothing changed."; exit 0; fi

save_current
git restore --source="$REF" --worktree -- "${PATHS[@]}"
echo "$changes" | awk '$1=="remove"{ $1=""; sub(/^ /,""); print }' | while IFS= read -r f; do [ -n "$f" ] && rm -f -- "$f"; done
echo "Done: $TARGET. The dev server picks it up on its own; if it looks stale, restart pnpm dev:web."
