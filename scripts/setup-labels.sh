#!/usr/bin/env bash
set -euo pipefail

# Creates (or updates) this repo's canonical issue labels via the gh CLI.
#
# This mirrors the label vocabulary documented in:
#   - docs/agents/triage-labels.md   (triage roles)
#   - docs/agents/issue-tracker.md   (Wayfinder ticket labels)
#
# Idempotent: `gh label create --force` creates a label if missing and updates
# its color/description if it already exists. Run from inside the repo clone so
# gh infers the repository, or pass --repo OWNER/NAME.
#
# Usage: scripts/setup-labels.sh [--repo OWNER/NAME] [--dry-run]

REPO_ARGS=()
DRY_RUN="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      shift
      REPO_ARGS=(--repo "${1:-}")
      ;;
    --repo=*)
      REPO_ARGS=(--repo "${1#--repo=}")
      ;;
    --dry-run)
      DRY_RUN="true"
      ;;
    -h|--help)
      sed -n '3,13p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

# name|color(hex, no #)|description
LABELS=(
  "needs-triage|FFB347|Maintainer needs to evaluate this issue"
  "needs-info|D876E3|Waiting on reporter for more information"
  "ready-for-agent|0E8A16|Fully specified, ready for an AFK agent"
  "ready-for-human|5319E7|Requires human implementation"
  "wontfix|FFFFFF|This will not be worked on"
  "wayfinder:map|1D76DB|Wayfinder map issue"
  "wayfinder:research|0052CC|Wayfinder research ticket"
  "wayfinder:prototype|FBCA04|Wayfinder prototype ticket"
  "wayfinder:grilling|C5DEF5|Wayfinder human decision ticket"
  "wayfinder:task|BFDADC|Wayfinder prerequisite task ticket"
)

for entry in "${LABELS[@]}"; do
  IFS='|' read -r name color desc <<< "$entry"
  if [ "$DRY_RUN" = "true" ]; then
    echo "would set label: $name ($color) — $desc"
    continue
  fi
  gh label create "$name" --color "$color" --description "$desc" --force "${REPO_ARGS[@]}"
done

echo "Labels are in sync."
