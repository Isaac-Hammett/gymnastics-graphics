#!/bin/bash
# Scaffold a new PRD folder from templates
#
# Usage: bash docs/new-prd.sh FeatureName
# Example: bash docs/new-prd.sh Meet-Themes
#
# Creates docs/PRD-{FeatureName}/ with all 6 files + logs/ + screenshots/

FEATURE_NAME="$1"
DATE=$(date +%Y-%m-%d)

if [ -z "$FEATURE_NAME" ]; then
    echo "Usage: bash docs/new-prd.sh FeatureName"
    echo "Example: bash docs/new-prd.sh Meet-Themes"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/_template"
PRD_DIR="$SCRIPT_DIR/PRD-$FEATURE_NAME"

if [ -d "$PRD_DIR" ]; then
    echo "Error: $PRD_DIR already exists"
    exit 1
fi

mkdir -p "$PRD_DIR/logs"
mkdir -p "$PRD_DIR/screenshots"

# Copy and customize each template file
for TEMPLATE_FILE in "$TEMPLATE_DIR"/PRD-TEMPLATE.md \
                      "$TEMPLATE_DIR"/implementation-plan-TEMPLATE.md \
                      "$TEMPLATE_DIR"/prompt-TEMPLATE-Discovery.md \
                      "$TEMPLATE_DIR"/prompt-TEMPLATE.md \
                      "$TEMPLATE_DIR"/run-TEMPLATE-Discovery.sh \
                      "$TEMPLATE_DIR"/run-TEMPLATE.sh; do

    BASENAME=$(basename "$TEMPLATE_FILE")

    # Rename: TEMPLATE → FeatureName, resolve date
    NEW_NAME="${BASENAME//TEMPLATE/$FEATURE_NAME}"
    NEW_NAME="${NEW_NAME//\{date\}/$DATE}"

    # Copy with placeholder substitutions
    sed \
        -e "s/{FeatureName}/$FEATURE_NAME/g" \
        -e "s/{Feature Name}/$FEATURE_NAME/g" \
        -e "s/{date}/$DATE/g" \
        -e "s/{YYYY-MM-DD}/$DATE/g" \
        "$TEMPLATE_FILE" > "$PRD_DIR/$NEW_NAME"

    # Make shell scripts executable
    if [[ "$NEW_NAME" == *.sh ]]; then
        chmod +x "$PRD_DIR/$NEW_NAME"
    fi
done

echo ""
echo "✓ Created: $PRD_DIR"
echo ""
echo "Files:"
ls "$PRD_DIR" | sed 's/^/  /'
echo ""
echo "Next steps:"
echo "  1. Start a planning session — paste docs/_template/KICKOFF.md into Claude plan mode"
echo "  2. Fill in $PRD_DIR/PRD-$FEATURE_NAME-$DATE.md with requirements"
echo "  3. Fill in $PRD_DIR/implementation-plan.md with tasks"
echo "  4. Run discovery:   bash $PRD_DIR/run-$FEATURE_NAME-Discovery.sh"
echo "  5. Manual first run: cat $PRD_DIR/prompt-$FEATURE_NAME.md | claude -p --dangerously-skip-permissions --mcp-config .mcp.json"
echo "  6. Start the loop:  bash $PRD_DIR/run-$FEATURE_NAME.sh"
