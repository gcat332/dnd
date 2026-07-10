#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/bootstrap-agent-skills.sh [--copy] [--force] [--check-only]

Installs this repo's local agent skills into $CODEX_HOME/skills, or
~/.codex/skills when CODEX_HOME is unset.

Options:
  --copy        Copy skill directories instead of symlinking them.
  --force       Replace an existing repo-local skill destination.
  --check-only  Do not install; only report local and external skill status.
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

REQUIRED_EXTERNAL_SKILLS=(
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
)

OPTIONAL_EXTERNAL_SKILLS=(
  "setup-pre-commit"
  "post-mortem"
  "ubiquitous-language"
)

has_skill() {
  local skill="$1"
  [ -f "$DEST_DIR/$skill/SKILL.md" ] ||
    [ -f "$HOME/.agents/skills/$skill/SKILL.md" ] ||
    [ -f "$REPO_ROOT/skills/$skill/SKILL.md" ]
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
  echo "No repo-local skills directory found: $SOURCE_DIR" >&2
  exit 1
fi

print_skill_status "Required external skills:" "${REQUIRED_EXTERNAL_SKILLS[@]}" || true
echo
print_skill_status "Optional external skills:" "${OPTIONAL_EXTERNAL_SKILLS[@]}" || true
echo

if [ "$CHECK_ONLY" = "true" ]; then
  exit 0
fi

mkdir -p "$DEST_DIR"

found_local="false"
for skill_dir in "$SOURCE_DIR"/*; do
  [ -d "$skill_dir" ] || continue
  [ -f "$skill_dir/SKILL.md" ] || continue

  found_local="true"
  skill_name="$(basename "$skill_dir")"
  dest="$DEST_DIR/$skill_name"

  if [ -e "$dest" ] || [ -L "$dest" ]; then
    if [ "$FORCE" != "true" ]; then
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

if [ "$found_local" != "true" ]; then
  echo "No repo-local skills found under $SOURCE_DIR" >&2
  exit 1
fi

echo
echo "Bootstrap complete. Start a fresh agent session if newly installed skills are not visible yet."
