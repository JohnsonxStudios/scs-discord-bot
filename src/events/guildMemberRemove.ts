import { Events } from "discord.js"
import type { BotEvent } from "../types.js"
import { updateMemberCounter } from "../lib/counter.js"

export default {
  name: Events.GuildMemberRemove,
  async execute(_client, member) {
    if (member.guild) await updateMemberCounter(member.guild)
  },
} satisfies BotEvent<typeof Events.GuildMemberRemove>
