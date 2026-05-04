import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { logModAction } from "../../lib/modlog.js"
import { errorEmbed, successEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("ban").setDescription("Ban a user.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false))
    .addIntegerOption((o) => o.setName("delete_days").setDescription("Delete N days of messages (0–7)").setMinValue(0).setMaxValue(7).setRequired(false)),
  async execute(i) {
    if (!i.guild) return
    const target = i.options.getUser("user", true)
    const reason = i.options.getString("reason") ?? ""
    const days = i.options.getInteger("delete_days") ?? 0
    try { await i.guild.members.ban(target.id, { reason: reason || `By ${i.user.tag}`, deleteMessageSeconds: days * 86400 }) }
    catch (err: any) { await i.reply({ embeds: [errorEmbed(err?.message ?? "Failed to ban.")], ephemeral: true }); return }
    await logModAction({
      guild: i.guild, target: { id: target.id, username: target.username },
      moderator: { id: i.user.id, username: i.user.username }, action: "ban", reason,
    })
    await i.reply({ embeds: [successEmbed(`Banned <@${target.id}>.`)] })
  },
} satisfies SlashCommand
