import { Events } from "discord.js"
import type { BotEvent } from "../types.js"

export default {
  name: Events.ClientReady,
  once: true,
  async execute(_client, c) {
    console.log(`✓ Logged in as ${c.user.tag} (${c.guilds.cache.size} guild(s))`)
  },
} satisfies BotEvent<typeof Events.ClientReady>
