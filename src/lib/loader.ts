import { readdir } from "node:fs/promises"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join } from "node:path"
import type { BotEvent } from "../types.js"
import { registerButton, registerCommand, registerModal, registerSelect } from "./registry.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = join(__dirname, "..")

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) yield* walk(full)
    else if (e.isFile() && (e.name.endsWith(".js") || e.name.endsWith(".ts"))) yield full
  }
}

export async function loadCommands() {
  const dir = join(SRC_ROOT, "commands")
  for await (const file of walk(dir)) {
    const mod = await import(pathToFileURL(file).href)
    const cmd = mod.default ?? mod.command
    if (cmd?.data && typeof cmd.execute === "function") registerCommand(cmd)
    // Co-located interaction handlers
    if (mod.button) registerButton(mod.button)
    if (mod.modal) registerModal(mod.modal)
    if (mod.select) registerSelect(mod.select)
  }
}

export async function loadInteractionHandlers() {
  const dir = join(SRC_ROOT, "interactions")
  try {
    for await (const file of walk(dir)) {
      const mod = await import(pathToFileURL(file).href)
      if (mod.button) registerButton(mod.button)
      if (mod.modal) registerModal(mod.modal)
      if (mod.select) registerSelect(mod.select)
    }
  } catch (err: any) {
    if (err?.code !== "ENOENT") throw err
  }
}

export async function loadEvents(): Promise<BotEvent[]> {
  const dir = join(SRC_ROOT, "events")
  const events: BotEvent[] = []
  for await (const file of walk(dir)) {
    const mod = await import(pathToFileURL(file).href)
    const ev = mod.default ?? mod.event
    if (ev?.name && typeof ev.execute === "function") events.push(ev as BotEvent)
  }
  return events
}
