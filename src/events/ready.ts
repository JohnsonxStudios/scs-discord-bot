import { Events } from "discord.js"
import type { BotEvent } from "../types.js"
import { startAnnouncer } from "../lib/announcer.js"

export default {
  name: Events.ClientReady,
  once: true,
  async execute(_client, c) {
    console.log(`✓ Logged in as ${c.user.tag} (${c.guilds.cache.size} guild(s))`)
    startAnnouncer(c)
  },
} satisfies BotEvent<typeof Events.ClientReady>

