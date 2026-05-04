import { REST, Routes } from "discord.js"
import { env } from "./lib/env.js"
import { loadCommands } from "./lib/loader.js"
import { commands } from "./lib/registry.js"

async function main() {
  await loadCommands()
  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN)
  const body = commands.map((c) => (typeof (c.data as any).toJSON === "function" ? (c.data as any).toJSON() : c.data))

  if (env.DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), { body })
    console.log(`Registered ${body.length} guild commands to ${env.DISCORD_GUILD_ID}.`)
  } else {
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body })
    console.log(`Registered ${body.length} global commands.`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
