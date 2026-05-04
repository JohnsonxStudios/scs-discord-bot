import type { Guild } from "discord.js"
import { db, getGuildSettings } from "./db.js"
import { scsEmbed } from "./embed.js"

export async function logModAction(args: {
  guild: Guild
  target: { id: string; username: string }
  moderator: { id: string; username: string }
  action: string
  reason?: string
  durationSeconds?: number
}) {
  await db.from("discord_mod_log").insert({
    guild_id: args.guild.id,
    target_discord_id: args.target.id,
    target_username: args.target.username,
    moderator_discord_id: args.moderator.id,
    moderator_username: args.moderator.username,
    action: args.action,
    reason: args.reason ?? null,
    duration_seconds: args.durationSeconds ?? null,
  } as never)

  const settings = await getGuildSettings(args.guild.id)
  const channelId = settings.log_channel_id as string | null
  if (!channelId) return
  const ch = await args.guild.channels.fetch(channelId).catch(() => null)
  if (!ch?.isTextBased() || !("send" in ch)) return
  await ch.send({
    embeds: [
      scsEmbed("rose", `🛡️ ${args.action.toUpperCase()}`)
        .addFields(
          { name: "Target",    value: `<@${args.target.id}> (${args.target.username})`, inline: true },
          { name: "Moderator", value: `<@${args.moderator.id}>`, inline: true },
          ...(args.durationSeconds ? [{ name: "Duration", value: `${args.durationSeconds}s`, inline: true }] : []),
          { name: "Reason",    value: args.reason || "—" },
        ),
    ],
  }).catch(() => {})
}
