import { SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db } from "../../lib/db.js"
import { scsEmbed } from "../../lib/embed.js"

const STAT_OPTIONS = [
  { name: "Points",   value: "points" },
  { name: "Goals",    value: "goals" },
  { name: "Assists",  value: "assists" },
  { name: "Hits",     value: "hits" },
  { name: "PIM",      value: "pim" },
  { name: "Plus/Minus", value: "plus_minus" },
]

export default {
  data: new SlashCommandBuilder()
    .setName("leaders").setDescription("Top players by stat.")
    .addStringOption((o) => o.setName("stat").setDescription("Which stat").setRequired(false).addChoices(...STAT_OPTIONS)),
  async execute(i) {
    const stat = (i.options.getString("stat") ?? "points") as "points" | "goals" | "assists" | "hits" | "pim" | "plus_minus"
    const { data } = await db.from("match_player_stats").select(`player_id,ea_persona,${stat}`).limit(2000)
    const sums = new Map<string, { name: string; total: number }>()
    for (const r of (data ?? []) as Array<any>) {
      const key = r.player_id ?? `ea:${r.ea_persona ?? "Unknown"}`
      const cur = sums.get(key) ?? { name: r.ea_persona ?? key, total: 0 }
      cur.total += Number(r[stat] ?? 0)
      sums.set(key, cur)
    }
    // Resolve player_ids to gamer_tags where possible
    const playerIds = Array.from(sums.keys()).filter((k) => !k.startsWith("ea:"))
    const { data: ps } = playerIds.length ? await db.from("players").select("id,user_id").in("id", playerIds) : { data: [] as any[] }
    const userIds = ((ps ?? []) as any[]).map((p) => p.user_id).filter(Boolean)
    const { data: us } = userIds.length ? await db.from("users").select("id,gamer_tag").in("id", userIds) : { data: [] as any[] }
    const tagByPlayer = new Map<string, string>()
    const tagByUser = new Map(((us ?? []) as any[]).map((u) => [u.id, u.gamer_tag]))
    for (const p of (ps ?? []) as Array<any>) tagByPlayer.set(p.id, tagByUser.get(p.user_id) ?? "Unknown")

    const ranked = [...sums.entries()]
      .map(([key, val]) => ({ name: key.startsWith("ea:") ? val.name : (tagByPlayer.get(key) ?? val.name), total: val.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const lines = ranked.map((r, idx) => `**#${idx + 1}** ${r.name} — ${r.total}`)
    await i.reply({ embeds: [scsEmbed("aurora", `🏒 Leaders — ${stat.toUpperCase()}`, lines.join("\n") || "No data yet.")] })
  },
} satisfies SlashCommand
