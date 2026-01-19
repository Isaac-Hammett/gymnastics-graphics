#!/bin/bash

# Ralph Loop Initializer
# Creates a new Ralph loop from template
#
# Usage: ./ralph-new.sh <loop-name> ["Description of what to fix/build"]
#
# Examples:
#   ./ralph-new.sh auth-fix "Fix authentication flow on login page"
#   ./ralph-new.sh dark-mode "Add dark mode toggle to settings"
#   ./ralph-new.sh vm-cleanup "Clean up orphaned VMs in pool"

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ -z "$1" ]; then
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Ralph Loop Initializer"
  echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Usage: $0 <loop-name> [\"description\"]"
  echo ""
  echo "Examples:"
  echo "  $0 auth-fix \"Fix authentication flow on login page\""
  echo "  $0 dark-mode \"Add dark mode toggle to settings\""
  echo "  $0 vm-cleanup \"Clean up orphaned VMs in pool\""
  echo ""
  echo "This will create: ralph-<loop-name>/"
  exit 1
fi

LOOP_NAME="$1"
DESCRIPTION="${2:-Fix or implement $LOOP_NAME}"
DIR_NAME="ralph-$LOOP_NAME"
DATE=$(date '+%Y-%m-%d')
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/ralph-template"

# Check if template exists
if [ ! -d "$TEMPLATE_DIR" ]; then
  echo -e "${RED}Error: Template directory not found at $TEMPLATE_DIR${NC}"
  exit 1
fi

# Check if directory already exists
if [ -d "$SCRIPT_DIR/$DIR_NAME" ]; then
  echo -e "${YELLOW}Warning: Directory $DIR_NAME already exists${NC}"
  read -p "Overwrite? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
  rm -rf "$SCRIPT_DIR/$DIR_NAME"
fi

echo -e "${CYAN}Creating Ralph loop: $DIR_NAME${NC}"
echo "Description: $DESCRIPTION"
echo ""

# Create directory
mkdir -p "$SCRIPT_DIR/$DIR_NAME/screenshots"

# Copy and customize templates
for file in PROMPT.md AGENT.md PRD.md plan.md activity.md ralph.sh; do
  if [ -f "$TEMPLATE_DIR/$file" ]; then
    sed -e "s/{{PROJECT_NAME}}/$LOOP_NAME/g" \
        -e "s/{{ONE_LINE_GOAL}}/$DESCRIPTION/g" \
        -e "s/{{GOAL_DESCRIPTION}}/$DESCRIPTION/g" \
        -e "s/{{DATE}}/$DATE/g" \
        -e "s/{{WORKFLOW_1_NAME}}/Primary Workflow/g" \
        -e "s/{{WORKFLOW_2_NAME}}/Secondary Workflow/g" \
        -e "s/{{STEP_1}}/Step 1 - TBD/g" \
        -e "s/{{STEP_2}}/Step 2 - TBD/g" \
        -e "s/{{STEP_3}}/Step 3 - TBD/g" \
        -e "s/{{KNOWN_ISSUE_1}}/TBD - describe known issues/g" \
        -e "s/{{KNOWN_ISSUE_2}}/TBD/g" \
        -e "s/{{FIRST_FIX_DESCRIPTION}}/TBD - describe first fix/g" \
        -e "s/{{ACTION_STEPS}}/TBD - describe action steps/g" \
        -e "s/{{HOW_TO_VERIFY}}/TBD - describe verification/g" \
        -e "s/{{EXPECTED_RESULT}}/TBD - describe expected result/g" \
        "$TEMPLATE_DIR/$file" > "$SCRIPT_DIR/$DIR_NAME/$file"
  fi
done

# Make ralph.sh executable
chmod +x "$SCRIPT_DIR/$DIR_NAME/ralph.sh"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Created: $DIR_NAME/"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Files created:"
echo "  $DIR_NAME/PRD.md       ← Define success criteria"
echo "  $DIR_NAME/plan.md      ← Add research & execute tasks"
echo "  $DIR_NAME/AGENT.md     ← Environment knowledge"
echo "  $DIR_NAME/PROMPT.md    ← Agent instructions"
echo "  $DIR_NAME/activity.md  ← Activity log"
echo "  $DIR_NAME/ralph.sh     ← Loop runner"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Edit PRD.md to define your success criteria"
echo "  2. Edit plan.md to add your research & execute tasks"
echo "  3. Run: cd $DIR_NAME && ./ralph.sh 20"
echo ""
echo -e "${CYAN}Or let Claude help you set it up:${NC}"
echo "  claude \"Set up the Ralph loop in $DIR_NAME for: $DESCRIPTION\""
