import type { Guild } from "discord.js"
import { getGuildSettings } from "./db.js"

export async function updateMemberCounter(guild: Guild) {
  const settings = await getGuildSettings(guild.id)
  const channelId = settings?.member_counter_channel_id as string | null
  if (!channelId) return
  const ch = await guild.channels.fetch(channelId).catch(() => null)
  if (!ch || !("setName" in ch)) return
  const count = guild.memberCount
  const newName = `📊 Members: ${count.toLocaleString()}`
  if (ch.name !== newName) await ch.setName(newName).catch(() => {})
}
