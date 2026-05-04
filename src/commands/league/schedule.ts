import { SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db } from "../../lib/db.js"
import { scsEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("schedule").setDescription("Upcoming SCS matches.")
    .addStringOption((o) => o.setName("team").setDescription("Filter to a team").setRequired(false)),
  async execute(i) {
    const teamFilter = i.options.getString("team")
    let teamId: string | null = null
    if (teamFilter) {
      const { data: teams } = await db.from("teams").select("id").or(`name.ilike.%${teamFilter}%,abbreviation.ilike.${teamFilter}`).limit(1)
      teamId = ((teams ?? []) as any[])[0]?.id ?? null
    }
    let q = db.from("matches").select("id,match_date,home_team_id,away_team_id,status,home_score,away_score")
      .gte("match_date", new Date().toISOString())
      .order("match_date", { ascending: true })
      .limit(10)
    if (teamId) q = q.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    const { data: matches } = await q
    const rows = (matches ?? []) as Array<any>
    if (!rows.length) { await i.reply({ embeds: [scsEmbed("ice", "Schedule", "No upcoming matches.")] }); return }
    const ids = Array.from(new Set(rows.flatMap((r) => [r.home_team_id, r.away_team_id]).filter(Boolean)))
    const { data: ts } = await db.from("teams").select("id,name,abbreviation").in("id", ids)
    const tname = new Map(((ts ?? []) as any[]).map((t) => [t.id, t.abbreviation || t.name]))
    const lines = rows.map((r) => {
      const ts = Math.floor(new Date(r.match_date).getTime() / 1000)
      return `<t:${ts}:F> — ${tname.get(r.home_team_id) ?? "?"} vs ${tname.get(r.away_team_id) ?? "?"}`
    })
    await i.reply({ embeds: [scsEmbed("aurora", "📅 Upcoming Schedule", lines.join("\n"))] })
  },
} satisfies SlashCommand
