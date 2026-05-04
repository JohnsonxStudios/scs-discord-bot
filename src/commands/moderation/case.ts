import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db } from "../../lib/db.js"
import { scsEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("Look up a member's mod history.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)),
  async execute(i) {
    if (!i.guild) return
    const target = i.options.getUser("user", true)
    const { data } = await db.from("discord_mod_log")
      .select("action,reason,created_at,moderator_username,duration_seconds")
      .eq("guild_id", i.guild.id)
      .eq("target_discord_id", target.id)
      .order("created_at", { ascending: false })
      .limit(20)
    const rows = (data ?? []) as Array<any>
    if (!rows.length) {
      await i.reply({ embeds: [scsEmbed("ice", `No history for ${target.username}`, "Clean record.")] })
      return
    }
    const lines = rows.map((r) =>
      `**${r.action}** · ${new Date(r.created_at).toLocaleDateString()} by ${r.moderator_username ?? "?"}\n› ${r.reason || "—"}${r.duration_seconds ? ` · ${Math.round(r.duration_seconds / 60)}m` : ""}`,
    )
    await i.reply({ embeds: [scsEmbed("rose", `🛡️ Cases for ${target.username} (${rows.length})`, lines.join("\n\n"))] })
  },
} satisfies SlashCommand
