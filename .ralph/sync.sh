#!/bin/bash
cat .ralph/prompt.md | \
  claude -p --dangerously-skip-permissions | \
  tee -a .ralph/output.log
