import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { logModAction } from "../../lib/modlog.js"
import { errorEmbed, successEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member for N minutes.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    .addIntegerOption((o) => o.setName("minutes").setDescription("Duration (max 40320 = 28 days)").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false)),
  async execute(i) {
    if (!i.guild) return
    const target = i.options.getUser("user", true)
    const mins = i.options.getInteger("minutes", true)
    const reason = i.options.getString("reason") ?? ""
    const member = await i.guild.members.fetch(target.id).catch(() => null)
    if (!member) { await i.reply({ embeds: [errorEmbed("Member not found.")], ephemeral: true }); return }
    try { await member.timeout(mins * 60_000, reason || `By ${i.user.tag}`) }
    catch (err: any) { await i.reply({ embeds: [errorEmbed(err?.message ?? "Failed to timeout.")], ephemeral: true }); return }

    await logModAction({
      guild: i.guild, target: { id: target.id, username: target.username },
      moderator: { id: i.user.id, username: i.user.username },
      action: "timeout", reason, durationSeconds: mins * 60,
    })
    await i.reply({ embeds: [successEmbed(`Timed out <@${target.id}> for ${mins}m.`)] })
  },
} satisfies SlashCommand
