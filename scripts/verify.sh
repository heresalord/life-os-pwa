#!/usr/bin/env bash
# Life OS — safety-net verification script
# Runs TypeScript type-check, ESLint, and a Vite production build.
# Wire this as a pre-commit hook via husky.
set -e

echo "▶ tsc --noEmit …"
npx tsc --noEmit

echo "▶ eslint src …"
npx eslint src

echo "▶ vite build …"
npx vite build

echo "✅ All checks passed."
