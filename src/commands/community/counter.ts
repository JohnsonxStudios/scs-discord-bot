import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db } from "../../lib/db.js"
import { updateMemberCounter } from "../../lib/counter.js"
import { successEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("counter")
    .setDescription("Set up a self-updating member counter channel.")
    .addChannelOption((o) => o.setName("channel").setDescription("Voice channel to use as the counter").addChannelTypes(ChannelType.GuildVoice).setRequired(true)),
  async execute(i) {
    if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await i.reply({ ephemeral: true, content: "Manage Server permission required." }); return
    }
    const ch = i.options.getChannel("channel", true)
    await db.from("discord_settings").upsert({
      guild_id: i.guildId, member_counter_channel_id: ch.id,
    } as never, { onConflict: "guild_id" })
    if (i.guild) await updateMemberCounter(i.guild)
    await i.reply({ embeds: [successEmbed(`Member counter bound to <#${ch.id}>.`)] })
  },
} satisfies SlashCommand
