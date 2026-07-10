#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/bootstrap-agent-skills.sh [--copy] [--force] [--check-only] [--target TARGET]

Installs this repo's bundled agent skills into the local skill directories of
the AI runtimes you use. By default it installs into BOTH Claude Code and Codex.

Target directories:
  Claude Code:  $CLAUDE_HOME/skills, or ~/.claude/skills when CLAUDE_HOME is unset
  Codex:        $CODEX_HOME/skills,  or ~/.codex/skills  when CODEX_HOME is unset

Options:
  --target TARGET  Where to install: claude, codex, or both (default: both).
  --copy           Copy skill directories instead of symlinking them.
  --force          Replace an existing bundled skill destination.
  --check-only     Do not install; only report bundled and installed skill status.
  -h, --help       Show this help.
EOF
}

MODE="symlink"
FORCE="false"
CHECK_ONLY="false"
TARGET="both"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --copy)
      MODE="copy"
      ;;
    --force)
      FORCE="true"
      ;;
    --check-only)
      CHECK_ONLY="true"
      ;;
    --target)
      shift
      TARGET="${1:-}"
      ;;
    --target=*)
      TARGET="${1#--target=}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

case "$TARGET" in
  claude|codex|both) ;;
  *)
    echo "Invalid --target: $TARGET (expected claude, codex, or both)" >&2
    exit 2
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SOURCE_DIR="$REPO_ROOT/skills"

CLAUDE_DEST="${CLAUDE_HOME:-$HOME/.claude}/skills"
CODEX_DEST="${CODEX_HOME:-$HOME/.codex}/skills"

DEST_DIRS=()
case "$TARGET" in
  claude) DEST_DIRS=("$CLAUDE_DEST") ;;
  codex)  DEST_DIRS=("$CODEX_DEST") ;;
  both)   DEST_DIRS=("$CLAUDE_DEST" "$CODEX_DEST") ;;
esac

REQUIRED_SKILLS=(
  "dnd-project-dev"
  "dnd-wayfinder"
  "wayfinder"
  "grilling"
  "domain-modeling"
  "research"
  "prototype"
  "to-spec"
  "to-tickets"
  "implement"
  "tdd"
  "diagnosing-bugs"
  "codebase-design"
  "design-an-interface"
  "brainstorming"
  "writing-plans"
  "test-driven-development"
  "systematic-debugging"
  "verification-before-completion"
  "requesting-code-review"
  "using-superpowers"
  "writing-skills"
)

OPTIONAL_SKILLS=(
  "setup-pre-commit"
  "post-mortem"
  "ubiquitous-language"
  "using-git-worktrees"
  "ux-design"
  "ux-review"
  "feature-design"
  "design-review"
  "quick-design"
)

find_bundled_skill_dir() {
  local skill="$1"
  local skill_file
  skill_file="$(find "$SOURCE_DIR" -type f -path "*/$skill/SKILL.md" -print -quit)"
  if [ -n "$skill_file" ]; then
    dirname "$skill_file"
  fi
}

has_skill() {
  local skill="$1"
  local dest
  for dest in "${DEST_DIRS[@]}"; do
    [ -f "$dest/$skill/SKILL.md" ] && return 0
  done
  [ -f "$HOME/.agents/skills/$skill/SKILL.md" ] && return 0
  [ -n "$(find_bundled_skill_dir "$skill")" ] && return 0
  return 1
}

print_skill_status() {
  local label="$1"
  shift
  local missing=0

  echo "$label"
  for skill in "$@"; do
    if has_skill "$skill"; then
      echo "  ok      $skill"
    else
      echo "  missing $skill"
      missing=1
    fi
  done

  return "$missing"
}

echo "Repo: $REPO_ROOT"
echo "Target: $TARGET"
for dest in "${DEST_DIRS[@]}"; do
  echo "  skills dir: $dest"
done
echo

if [ ! -d "$SOURCE_DIR" ]; then
  echo "No bundled skills directory found: $SOURCE_DIR" >&2
  exit 1
fi

print_skill_status "Required skills:" "${REQUIRED_SKILLS[@]}" || true
echo
print_skill_status "Optional skills:" "${OPTIONAL_SKILLS[@]}" || true
echo

if [ "$CHECK_ONLY" = "true" ]; then
  exit 0
fi

for dest in "${DEST_DIRS[@]}"; do
  mkdir -p "$dest"
done

found_local="false"
while IFS= read -r skill_file; do
  [ -n "$skill_file" ] || continue
  skill_dir="$(dirname "$skill_file")"
  found_local="true"
  skill_name="$(basename "$skill_dir")"

  for dest_root in "${DEST_DIRS[@]}"; do
    dest="$dest_root/$skill_name"

    if [ -e "$dest" ] || [ -L "$dest" ]; then
      if [ "$FORCE" != "true" ] && [ -e "$dest" ]; then
        echo "skip    $skill_name already exists at $dest"
        continue
      fi
      rm -rf "$dest"
    fi

    if [ "$MODE" = "copy" ]; then
      cp -R "$skill_dir" "$dest"
      echo "copy    $skill_name -> $dest"
    else
      ln -s "$skill_dir" "$dest"
      echo "symlink $skill_name -> $dest"
    fi
  done
done < <(find "$SOURCE_DIR" -mindepth 2 -name SKILL.md -print | sort)

if [ "$found_local" != "true" ]; then
  echo "No bundled skills found under $SOURCE_DIR" >&2
  exit 1
fi

echo
echo "Bootstrap complete. Start a fresh agent session if newly installed skills are not visible yet."
