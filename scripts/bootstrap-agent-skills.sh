#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/bootstrap-agent-skills.sh [--copy] [--force] [--check-only]

Installs this repo's bundled agent skills into $CODEX_HOME/skills, or
~/.codex/skills when CODEX_HOME is unset.

Options:
  --copy        Copy skill directories instead of symlinking them.
  --force       Replace an existing bundled skill destination.
  --check-only  Do not install; only report bundled and installed skill status.
  -h, --help    Show this help.
EOF
}

MODE="symlink"
FORCE="false"
CHECK_ONLY="false"

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SOURCE_DIR="$REPO_ROOT/skills"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
DEST_DIR="$CODEX_HOME/skills"

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
  [ -f "$DEST_DIR/$skill/SKILL.md" ] ||
    [ -f "$HOME/.agents/skills/$skill/SKILL.md" ] ||
    [ -n "$(find_bundled_skill_dir "$skill")" ]
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
echo "Codex skills dir: $DEST_DIR"
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

mkdir -p "$DEST_DIR"

found_local="false"
while IFS= read -r skill_file; do
  [ -n "$skill_file" ] || continue
  skill_dir="$(dirname "$skill_file")"

  found_local="true"
  skill_name="$(basename "$skill_dir")"
  dest="$DEST_DIR/$skill_name"

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
done < <(find "$SOURCE_DIR" -mindepth 2 -name SKILL.md -print | sort)

if [ "$found_local" != "true" ]; then
  echo "No bundled skills found under $SOURCE_DIR" >&2
  exit 1
fi

echo
echo "Bootstrap complete. Start a fresh agent session if newly installed skills are not visible yet."
