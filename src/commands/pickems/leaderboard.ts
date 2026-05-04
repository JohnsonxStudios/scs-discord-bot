import { SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db } from "../../lib/db.js"
import { scsEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("pickems-leaderboard")
    .setDescription("Top pickem players this season."),
  async execute(i) {
    const { data } = await db
      .from("discord_pickems")
      .select("discord_id,points_awarded")
    const totals = new Map<string, number>()
    for (const r of (data ?? []) as Array<{ discord_id: string; points_awarded: number | null }>) {
      totals.set(r.discord_id, (totals.get(r.discord_id) ?? 0) + (r.points_awarded ?? 0))
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    if (!sorted.length) {
      await i.reply({ embeds: [scsEmbed("ice", "Pickems Leaderboard", "No completed picks yet.")] })
      return
    }
    const lines = sorted.map(([id, pts], idx) => `**#${idx + 1}** <@${id}> — ${pts} pts`)
    await i.reply({ embeds: [scsEmbed("aurora", "🏆 Pickems Leaderboard", lines.join("\n"))] })
  },
} satisfies SlashCommand
