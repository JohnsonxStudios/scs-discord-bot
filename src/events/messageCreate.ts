import { Events } from "discord.js"
import type { BotEvent } from "../types.js"
import { db, getGuildSettings } from "../lib/db.js"
import { scsEmbed } from "../lib/embed.js"

const COOLDOWN_MS = 60_000  // one XP grant per minute per user
const XP_MIN = 8
const XP_MAX = 18

function xpForLevel(level: number) {
  // Standard quadratic curve, similar to mee6 / flavibot
  return 5 * level ** 2 + 50 * level + 100
}

export default {
  name: Events.MessageCreate,
  async execute(_client, message) {
    if (message.author.bot || !message.guild) return
    if (message.content.startsWith("!") || message.content.startsWith("/")) return

    const { data: existing } = await db
      .from("discord_levels")
      .select("xp,level,messages,last_message_at")
      .eq("guild_id", message.guild.id)
      .eq("discord_id", message.author.id)
      .maybeSingle()

    const now = Date.now()
    const lastMs = existing?.last_message_at ? new Date(existing.last_message_at as string).getTime() : 0
    if (existing && now - lastMs < COOLDOWN_MS) {
      // Still increment the message counter but no XP
      await db
        .from("discord_levels")
        .update({ messages: (existing.messages as number) + 1 } as never)
        .eq("guild_id", message.guild.id)
        .eq("discord_id", message.author.id)
      return
    }

    const gain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN
    let xp = (existing?.xp as number | undefined) ?? 0
    let level = (existing?.level as number | undefined) ?? 0
    const messages = ((existing?.messages as number | undefined) ?? 0) + 1
    xp += gain

    let leveledUp = false
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level)
      level += 1
      leveledUp = true
    }

    if (existing) {
      await db
        .from("discord_levels")
        .update({ xp, level, messages, last_message_at: new Date().toISOString() } as never)
        .eq("guild_id", message.guild.id)
        .eq("discord_id", message.author.id)
    } else {
      await db.from("discord_levels").insert({
        guild_id: message.guild.id,
        discord_id: message.author.id,
        xp, level, messages,
        last_message_at: new Date().toISOString(),
      } as never)
    }

    if (leveledUp) {
      const settings = await getGuildSettings(message.guild.id)
      const channelId = (settings?.level_up_channel_id as string | null) ?? message.channelId
      const text =
        (settings?.level_up_message as string | null)?.replace("{user}", `<@${message.author.id}>`).replace("{level}", String(level)) ??
        `🎉 GG <@${message.author.id}> — you just reached **Level ${level}**!`

      try {
        const ch = await message.guild.channels.fetch(channelId)
        if (ch?.isTextBased() && "send" in ch) {
          await ch.send({ embeds: [scsEmbed("aurora", "Level up", text)] })
        }
      } catch { /* ignore */ }

      // Role rewards
      const { data: rewards } = await db
        .from("discord_level_rewards")
        .select("role_id,level")
        .eq("guild_id", message.guild.id)
        .lte("level", level)
        .order("level", { ascending: true })
      if (rewards?.length) {
        const member = await message.guild.members.fetch(message.author.id).catch(() => null)
        if (member) {
          for (const r of rewards as Array<{ role_id: string }>) {
            await member.roles.add(r.role_id).catch(() => {})
          }
        }
      }
    }
  },
} satisfies BotEvent<typeof Events.MessageCreate>
