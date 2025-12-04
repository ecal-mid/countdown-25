#!/usr/bin/env bash

# Folder to search (relative to script directory)
SEARCH_FOLDER="sketches"

# Output JSON file path (relative to script directory)
OUTPUT_PATH="sequence.json"

# Ignore patterns (Bash regex patterns for `! -name`)
IGNORE_PATTERNS=(
    "sample*"
    "_*"
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/$SEARCH_FOLDER"
OUTPUT_FILE="$SCRIPT_DIR/$OUTPUT_PATH"

# Build ignore flags for the `find` command
IGNORE_ARGS=()
for pattern in "${IGNORE_PATTERNS[@]}"; do
    IGNORE_ARGS+=( ! -name "$pattern" )
done

# Collect folder names
folders=()
while IFS= read -r dir; do
    rel="${dir#$SCRIPT_DIR/}"
    folders+=("\"$rel\"")
done < <(
    find "$TARGET_DIR" -maxdepth 1 -mindepth 1 -type d \
        "${IGNORE_ARGS[@]}"
)

# Write JSON file with line breaks after each element
{
    echo "["
    for i in "${!folders[@]}"; do
        if [ "$i" -lt $((${#folders[@]} - 1)) ]; then
            echo "  ${folders[i]},"
        else
            echo "  ${folders[i]}"
        fi
    done
    echo "]"
} > "$OUTPUT_FILE"

echo "Written to: $OUTPUT_FILE"
