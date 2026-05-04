import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { logModAction } from "../../lib/modlog.js"
import { errorEmbed, successEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("kick").setDescription("Kick a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(false)),
  async execute(i) {
    if (!i.guild) return
    const target = i.options.getUser("user", true)
    const reason = i.options.getString("reason") ?? ""
    const member = await i.guild.members.fetch(target.id).catch(() => null)
    if (!member) { await i.reply({ embeds: [errorEmbed("Member not found.")], ephemeral: true }); return }
    try { await member.kick(reason || `By ${i.user.tag}`) }
    catch (err: any) { await i.reply({ embeds: [errorEmbed(err?.message ?? "Failed to kick.")], ephemeral: true }); return }
    await logModAction({
      guild: i.guild, target: { id: target.id, username: target.username },
      moderator: { id: i.user.id, username: i.user.username }, action: "kick", reason,
    })
    await i.reply({ embeds: [successEmbed(`Kicked <@${target.id}>.`)] })
  },
} satisfies SlashCommand
