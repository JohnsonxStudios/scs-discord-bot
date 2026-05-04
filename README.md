# SCS Discord Bot

One bot for the SCS Hockey League — replaces dischook utils, double counter,
flavibot, ticketking, dyno, pickem, casino, etc.

## Features

| Bot it replaces       | Slash commands |
|-----------------------|----------------|
| dischook utils        | `/embed`        |
| double counter        | `/counter`      |
| flavibot welcome+lvl  | `/setup welcome`, `/setup levelup`, `/setup level-reward` (XP awarded automatically) |
| ticketking            | `/ticket open`, `/ticket panel` |
| website discord auth  | `/link` + `/dashboard?discord=CODE` |
| pickem                | `/pick upcoming`, `/pick set`, `/pickems-leaderboard` |
| the casino            | `/coinflip`, `/slots`, `/blackjack` (uses your existing `tokens` table) |
| dyno (mod basics)     | `/warn`, `/timeout`, `/kick`, `/ban`, `/case` |
| polls                 | `/poll` |

Everything is wired into the same Supabase the website uses, so picks, tokens,
profile lookups, and moderation history live alongside player records — no
parallel data store.

## Local setup

```bash
cd discord-bot
npm install
cp .env.example .env   # fill in DISCORD_TOKEN / DISCORD_CLIENT_ID / SUPABASE_SERVICE_ROLE_KEY
npm run deploy         # registers slash commands (use DISCORD_GUILD_ID for fast guild deploy in dev)
npm run dev
```

## Hosting

This bot is meant to run as a **long-running process** (NOT serverless). Pick one:
- Railway / Fly.io / Render Worker — cheapest, easy
- Hetzner / DO droplet + pm2 / systemd
- Any container host

It cannot run on Vercel (Vercel functions are short-lived; bots need a
persistent gateway connection).

## Splitting into its own repo

When you're ready:

```bash
cd ..
git subtree split --prefix discord-bot -b discord-bot-only
gh repo create JohnsonxStudios/scs-discord-bot --public --source . --remote bot
git push bot discord-bot-only:main
```

After that, `discord-bot/` can be removed from this repo and pulled in as a
git submodule, or just kept here for convenience.
