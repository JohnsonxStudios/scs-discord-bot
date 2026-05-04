import { SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db } from "../../lib/db.js"
import { scsEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("standings").setDescription("Current SCSHL standings.")
    .addStringOption((o) => o.setName("league").setDescription("scshl (default) or scsdhl")
      .addChoices({ name: "SCSHL", value: "scshl" }, { name: "SCSDHL", value: "scsdhl" })),
  async execute(i) {
    const league = i.options.getString("league") ?? "scshl"
    const table = league === "scsdhl" ? "teams_ahl" : "teams"
    const { data } = await db
      .from(table)
      .select("name,abbreviation,wins,losses,otl,points,goals_for,goals_against")
      .eq("is_active", true)
      .order("points", { ascending: false })
      .limit(32)

    const rows = (data ?? []) as Array<any>
    if (!rows.length) { await i.reply({ embeds: [scsEmbed("ice", "Standings", "No active teams.")] }); return }
    const header = "`Rk Team       GP  W  L OT PTS  GF  GA`"
    const lines = rows.map((t, idx) => {
      const gp = (t.wins ?? 0) + (t.losses ?? 0) + (t.otl ?? 0)
      const ab = (t.abbreviation ?? t.name).padEnd(10).slice(0, 10)
      return `\`${String(idx + 1).padStart(2)} ${ab} ${String(gp).padStart(2)} ${String(t.wins ?? 0).padStart(2)} ${String(t.losses ?? 0).padStart(2)} ${String(t.otl ?? 0).padStart(2)} ${String(t.points ?? 0).padStart(3)} ${String(t.goals_for ?? 0).padStart(3)} ${String(t.goals_against ?? 0).padStart(3)}\``
    })
    await i.reply({ embeds: [scsEmbed("ice", `🏒 ${league.toUpperCase()} Standings`, [header, ...lines].join("\n"))] })
  },
} satisfies SlashCommand
