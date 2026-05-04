#!/bin/bash
# Pterodactyl / generic Node host startup script for the SCS Discord bot.
# Set this file as your panel's "Start Bash File" and leave Bot JS File blank.
set -e

echo "▶ npm install (omit dev when possible)…"
npm install --no-audit --no-fund

echo "▶ tsc build…"
npm run build

echo "▶ Deploying slash commands…"
npm run deploy || echo "  (deploy failed — check DISCORD_TOKEN / DISCORD_CLIENT_ID; continuing)"

echo "▶ Starting bot…"
exec node dist/index.js
