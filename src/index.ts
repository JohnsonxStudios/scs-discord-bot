import { Client, GatewayIntentBits, Partials } from "discord.js"
import { env } from "./lib/env.js"
import { loadCommands, loadEvents, loadInteractionHandlers } from "./lib/loader.js"

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
})

async function boot() {
  await loadCommands()
  await loadInteractionHandlers()
  const events = await loadEvents()
  for (const ev of events) {
    if (ev.once) client.once(ev.name, (...args) => ev.execute(client, ...args))
    else client.on(ev.name, (...args) => ev.execute(client, ...args))
  }
  await client.login(env.DISCORD_TOKEN)
}

boot().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
