import { SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db } from "../../lib/db.js"
import { scsEmbed, errorEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("roster").setDescription("Show a team's roster.")
    .addStringOption((o) => o.setName("team").setDescription("Team name or abbreviation").setRequired(true)),
  async execute(i) {
    const q = i.options.getString("team", true)
    const { data: teams } = await db.from("teams").select("id,name,abbreviation").or(`name.ilike.%${q}%,abbreviation.ilike.${q}`)
    const team = ((teams ?? []) as any[])[0]
    if (!team) { await i.reply({ embeds: [errorEmbed(`No team matched "${q}".`)] }); return }
    const { data: players } = await db.from("players").select("id,user_id,role,position,salary").eq("team_id", team.id)
    const rows = (players ?? []) as Array<any>
    if (!rows.length) { await i.reply({ embeds: [scsEmbed("ice", `${team.name} — Roster`, "No players.")] }); return }
    const userIds = rows.map((p) => p.user_id).filter(Boolean)
    const { data: us } = userIds.length ? await db.from("users").select("id,gamer_tag").in("id", userIds) : { data: [] as any[] }
    const tag = new Map(((us ?? []) as any[]).map((u) => [u.id, u.gamer_tag]))
    const lines = rows.map((p) => `**${tag.get(p.user_id) ?? "Unknown"}** — ${p.position ?? "?"} · ${p.role ?? "Player"}`)
    await i.reply({ embeds: [scsEmbed("ice", `🏒 ${team.name} Roster (${rows.length})`, lines.join("\n"))] })
  },
} satisfies SlashCommand
