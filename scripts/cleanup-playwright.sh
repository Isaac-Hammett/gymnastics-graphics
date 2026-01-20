#!/bin/bash
# cleanup-playwright.sh
# Remove stale Playwright browser lock files that cause "Browser is already in use" errors
#
# Usage: ./scripts/cleanup-playwright.sh
# Run this before Playwright operations if you encounter browser lock errors

CACHE_DIR="$HOME/Library/Caches/ms-playwright"

if [ ! -d "$CACHE_DIR" ]; then
    echo "Playwright cache directory not found: $CACHE_DIR"
    exit 0
fi

cleaned=0

for dir in "$CACHE_DIR"/mcp-chrome-*; do
    if [ -d "$dir" ]; then
        # Remove lock files that can become stale
        for lockfile in "SingletonLock" "SingletonSocket" "SingletonCookie" "RunningChromeVersion"; do
            if [ -e "$dir/$lockfile" ]; then
                rm -f "$dir/$lockfile" 2>/dev/null && ((cleaned++))
            fi
        done
    fi
done

if [ $cleaned -gt 0 ]; then
    echo "Cleaned $cleaned stale Playwright lock files"
else
    echo "No stale Playwright locks found"
fi
