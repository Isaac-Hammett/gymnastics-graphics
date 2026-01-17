#!/bin/bash
echo "Starting Ralph loop..."
while :; do
  echo "=== $(date) - Starting iteration ==="
  ./.ralph/sync.sh
  echo "=== $(date) - Iteration complete, sleeping 10s ==="
  sleep 10
done
