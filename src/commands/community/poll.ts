import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js"
import type { SlashCommand, ButtonHandler } from "../../types.js"
import { db } from "../../lib/db.js"
import { scsEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a button-based poll.")
    .addStringOption((o) => o.setName("question").setDescription("Question").setRequired(true))
    .addStringOption((o) => o.setName("options").setDescription("Comma-separated options (max 5)").setRequired(true))
    .addBooleanOption((o) => o.setName("multi").setDescription("Allow multi-vote").setRequired(false)),
  async execute(i) {
    if (!i.guild) return
    const question = i.options.getString("question", true)
    const opts = i.options.getString("options", true).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5)
    if (opts.length < 2) { await i.reply({ ephemeral: true, content: "Need at least 2 options." }); return }
    const multi = i.options.getBoolean("multi") ?? false

    const sent = await i.reply({
      embeds: [scsEmbed("aurora", `📊 ${question}`, opts.map((o, n) => `**${n + 1}.** ${o}  —  0`).join("\n")).setFooter({ text: multi ? "Multi-vote enabled" : "Single vote" })],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...opts.map((o, idx) =>
            new ButtonBuilder().setCustomId(`poll:vote:${idx}`).setLabel(`${idx + 1}`).setStyle(ButtonStyle.Secondary),
          ),
        ),
      ],
      fetchReply: true,
    })

    const { data: poll } = await db.from("discord_polls").insert({
      guild_id: i.guild.id,
      channel_id: i.channelId,
      message_id: sent.id,
      question,
      options: opts,
      multi,
      created_by_discord_id: i.user.id,
    } as never).select("id").single()
    if (poll) {
      // Tag the message_id ↔ poll id link by editing components with the real poll id
      await sent.edit({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...opts.map((_, idx) => new ButtonBuilder().setCustomId(`poll:vote:${poll.id}:${idx}`).setLabel(`${idx + 1}`).setStyle(ButtonStyle.Secondary)),
          ),
        ],
      })
    }
  },
} satisfies SlashCommand

export const button: ButtonHandler = {
  customId: /^poll:vote:/,
  async execute(i) {
    const parts = i.customId.split(":")
    const pollId = parts[2]
    const optIdx = Number(parts[3])
    const { data: poll } = await db.from("discord_polls").select("id,options,multi,question").eq("id", pollId).maybeSingle()
    if (!poll) { await i.reply({ ephemeral: true, content: "Poll not found." }); return }

    if (!poll.multi) {
      await db.from("discord_poll_votes").delete().eq("poll_id", pollId).eq("discord_id", i.user.id)
    }
    const { error } = await db.from("discord_poll_votes").upsert({
      poll_id: pollId, discord_id: i.user.id, option_index: optIdx,
    } as never)
    if (error && !error.message.includes("duplicate")) {
      await i.reply({ ephemeral: true, content: error.message }); return
    }

    const { data: votes } = await db.from("discord_poll_votes").select("option_index").eq("poll_id", pollId)
    const counts = new Array((poll.options as string[]).length).fill(0) as number[]
    for (const v of (votes ?? []) as Array<{ option_index: number }>) counts[v.option_index] = (counts[v.option_index] ?? 0) + 1

    await i.update({
      embeds: [scsEmbed("aurora", `📊 ${poll.question}`,
        (poll.options as string[]).map((o, idx) => `**${idx + 1}.** ${o}  —  ${counts[idx] ?? 0}`).join("\n"),
      )],
    })
  },
}
