#!/bin/bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Fetching latest from main..."
cd "$REPO_DIR"

git fetch origin main
git pull origin main

echo "Done. Assets are up to date in: $REPO_DIR/Context/assets/"
