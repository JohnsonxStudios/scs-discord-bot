import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, SlashCommandBuilder, MessageFlags } from "discord.js"
import type { SlashCommand, ButtonHandler } from "../../types.js"
import { db, getGuildSettings } from "../../lib/db.js"
import { errorEmbed, scsEmbed, successEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("clip-of-the-week").setDescription("Clip-of-the-week voting.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName("open").setDescription("Open voting on the past 7 days of clips"))
    .addSubcommand((s) => s.setName("close").setDescription("Close the active poll and announce the winner")),
  async execute(i) {
    if (!i.guild) return
    const sub = i.options.getSubcommand()
    const settings = await getGuildSettings(i.guild.id)
    const channelId = settings.highlights_channel_id as string | null
    if (!channelId) { await i.reply({ embeds: [errorEmbed("Set a highlights channel first: `/setup announce highlights`.")] }); return }
    const ch = await i.guild.channels.fetch(channelId).catch(() => null)
    if (!ch?.isTextBased() || !("send" in ch)) { await i.reply({ embeds: [errorEmbed("Highlights channel not usable.")] }); return }

    if (sub === "open") {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const { data: clips } = await db.from("player_clips").select("id,url,title,user_id,upvotes")
        .gte("created_at", since).order("upvotes", { ascending: false }).limit(5)
      const list = (clips ?? []) as Array<any>
      if (list.length < 2) { await i.reply({ embeds: [errorEmbed("Need at least 2 candidate clips this week.")] }); return }

      const userIds = list.map((c) => c.user_id).filter(Boolean)
      const { data: us } = userIds.length ? await db.from("users").select("id,gamer_tag").in("id", userIds) : { data: [] as any[] }
      const tag = new Map(((us ?? []) as any[]).map((u) => [u.id, u.gamer_tag]))
      const candidates = list.map((c, idx) => ({
        clipId: c.id, url: c.url, title: c.title || `Clip #${idx + 1}`, owner: tag.get(c.user_id) ?? "Unknown",
      }))

      const lines = candidates.map((c, idx) => `**${idx + 1}.** ${c.title} — ${c.owner}\n${c.url}`)
      const sent = await ch.send({
        embeds: [scsEmbed("aurora", "🎬 Clip of the Week — VOTE", lines.join("\n\n")).setFooter({ text: "Voting closes in 24h" })],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...candidates.map((c, idx) =>
            new ButtonBuilder().setCustomId(`cotw:vote:placeholder:${c.clipId}`).setLabel(`${idx + 1}`).setStyle(ButtonStyle.Secondary)),
        )],
      })

      const { data: poll } = await db.from("discord_clip_polls").insert({
        guild_id: i.guild.id, channel_id: ch.id, message_id: sent.id,
        week_start: new Date().toISOString().slice(0, 10),
        candidates,
        closes_at: new Date(Date.now() + 86_400_000).toISOString(),
      } as never).select("id").single()

      if (poll) {
        await sent.edit({
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...candidates.map((c, idx) =>
              new ButtonBuilder().setCustomId(`cotw:vote:${poll.id}:${c.clipId}`).setLabel(`${idx + 1}`).setStyle(ButtonStyle.Secondary)),
          )],
        })
      }
      await i.reply({ embeds: [successEmbed(`Poll posted in <#${ch.id}>.`)], flags: MessageFlags.Ephemeral })
      return
    }

    if (sub === "close") {
      const { data: poll } = await db.from("discord_clip_polls")
        .select("id,candidates,channel_id,message_id").eq("guild_id", i.guild.id).eq("closed", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle()
      if (!poll) { await i.reply({ embeds: [errorEmbed("No open poll.")] }); return }
      const { data: votes } = await db.from("discord_clip_votes").select("clip_id").eq("poll_id", poll.id)
      const tally = new Map<string, number>()
      for (const v of (votes ?? []) as Array<{ clip_id: string }>) tally.set(v.clip_id, (tally.get(v.clip_id) ?? 0) + 1)
      const cands = (poll.candidates as Array<{ clipId: string; title: string; owner: string; url: string }>) ?? []
      const ranked = cands.map((c) => ({ ...c, votes: tally.get(c.clipId) ?? 0 })).sort((a, b) => b.votes - a.votes)
      const winner = ranked[0]
      await db.from("discord_clip_polls").update({ closed: true } as never).eq("id", poll.id)
      await ch.send({
        embeds: [scsEmbed("emerald", "🏆 Clip of the Week", `Winner: **${winner.title}** by ${winner.owner} — ${winner.votes} votes\n${winner.url}`)],
      })
      await i.reply({ embeds: [successEmbed("Poll closed and winner posted.")], flags: MessageFlags.Ephemeral })
    }
  },
} satisfies SlashCommand

export const button: ButtonHandler = {
  customId: /^cotw:vote:/,
  async execute(i) {
    const [, , pollId, clipId] = i.customId.split(":")
    if (pollId === "placeholder") return
    await db.from("discord_clip_votes").upsert({
      poll_id: pollId, discord_id: i.user.id, clip_id: clipId,
    } as never, { onConflict: "poll_id,discord_id" })
    await i.reply({ flags: MessageFlags.Ephemeral, content: "Vote recorded ✓" })
  },
}
