// Self-bootstrapping entry point for hosts that don't auto-clone repos.
// Set BOT JS FILE = bootstrap.js — that's all you have to upload.
// First boot: clones the repo, installs deps, builds, and starts.
// Subsequent boots: pulls latest, rebuilds if needed, starts.

const { execSync } = require("node:child_process")
const { existsSync } = require("node:fs")

const REPO = "https://github.com/JohnsonxStudios/scs-discord-bot.git"
const ROOT = process.cwd()

function run(cmd) {
  console.log(`▶ ${cmd}`)
  execSync(cmd, { stdio: "inherit", cwd: ROOT })
}

try {
  if (!existsSync(`${ROOT}/.git`)) {
    console.log("▶ No .git — cloning repo into existing directory…")
    // Use a temp folder then move .git so we don't blow away bootstrap.js itself
    run(`git clone --depth 1 ${REPO} /tmp/scs-bot`)
    run(`cp -rn /tmp/scs-bot/. ${ROOT}/`)
    run(`mv /tmp/scs-bot/.git ${ROOT}/.git`)
    run(`rm -rf /tmp/scs-bot`)
  } else {
    run(`git pull --ff-only || true`)
  }

  if (existsSync(`${ROOT}/package.json`)) {
    run(`npm install --no-audit --no-fund`)
  }

  if (existsSync(`${ROOT}/tsconfig.json`)) {
    run(`npm run build`)
  }

  console.log("▶ Deploying slash commands (one-shot)…")
  try { run(`npm run deploy`) } catch { console.log("  deploy step skipped") }

  console.log("▶ Starting bot…")
  require(`${ROOT}/dist/index.js`)
} catch (err) {
  console.error("[bootstrap] Fatal:", err)
  process.exit(1)
}
