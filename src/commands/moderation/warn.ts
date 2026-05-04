import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { logModAction } from "../../lib/modlog.js"
import { successEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("user").setDescription("Member to warn").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),
  async execute(i) {
    if (!i.guild) return
    const target = i.options.getUser("user", true)
    const reason = i.options.getString("reason", true)
    await logModAction({
      guild: i.guild,
      target: { id: target.id, username: target.username },
      moderator: { id: i.user.id, username: i.user.username },
      action: "warn",
      reason,
    })
    try { await target.send(`⚠️ You were warned in **${i.guild.name}**: ${reason}`) } catch {}
    await i.reply({ embeds: [successEmbed(`<@${target.id}> warned.`)] })
  },
} satisfies SlashCommand
