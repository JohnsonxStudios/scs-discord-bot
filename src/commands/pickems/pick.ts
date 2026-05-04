import { SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db, findScsUserByDiscord } from "../../lib/db.js"
import { scsEmbed, errorEmbed, successEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("pick")
    .setDescription("Pick a winner for an upcoming SCSHL match.")
    .addSubcommand((s) =>
      s.setName("upcoming").setDescription("List upcoming matches you can pick"))
    .addSubcommand((s) =>
      s.setName("set").setDescription("Set your pick for a match")
        .addStringOption((o) => o.setName("match_id").setDescription("Match UUID (from /pick upcoming)").setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName("team").setDescription("home or away").setRequired(true).addChoices({ name: "Home", value: "home" }, { name: "Away", value: "away" }))),
  async execute(i) {
    const sub = i.options.getSubcommand()
    if (sub === "upcoming") {
      const { data } = await db
        .from("matches")
        .select("id,match_date,home_team_id,away_team_id,status,home_score,away_score")
        .eq("status", "scheduled")
        .gte("match_date", new Date().toISOString())
        .order("match_date", { ascending: true })
        .limit(8)
      const rows = (data ?? []) as Array<any>
      if (!rows.length) {
        await i.reply({ embeds: [scsEmbed("ice", "Upcoming matches", "No upcoming matches found.")] })
        return
      }
      const teamIds = Array.from(new Set(rows.flatMap((r) => [r.home_team_id, r.away_team_id]).filter(Boolean)))
      const { data: teams } = await db.from("teams").select("id,name,abbreviation").in("id", teamIds)
      const tname = new Map(((teams ?? []) as any[]).map((t) => [t.id, t.abbreviation || t.name]))
      const lines = rows.map((r) =>
        `\`${r.id.slice(0, 8)}\` — ${tname.get(r.home_team_id) ?? "?"} vs ${tname.get(r.away_team_id) ?? "?"} · <t:${Math.floor(new Date(r.match_date).getTime() / 1000)}:R>`,
      )
      await i.reply({ embeds: [scsEmbed("aurora", "Upcoming matches", lines.join("\n"))] })
      return
    }

    if (sub === "set") {
      await i.deferReply({ ephemeral: true })
      const matchId = i.options.getString("match_id", true)
      const side = i.options.getString("team", true)

      const userId = await findScsUserByDiscord(i.user.id)
      if (!userId) {
        await i.editReply({ embeds: [errorEmbed("Run `/link` first to connect your Discord to your SCS account.")] })
        return
      }
      const { data: m } = await db
        .from("matches")
        .select("id,home_team_id,away_team_id,status,match_date")
        .eq("id", matchId)
        .maybeSingle()
      if (!m) {
        await i.editReply({ embeds: [errorEmbed("Match not found.")] })
        return
      }
      if (m.status !== "scheduled") {
        await i.editReply({ embeds: [errorEmbed("Picks are closed — match already started.")] })
        return
      }
      const pickedTeamId = side === "home" ? m.home_team_id : m.away_team_id

      const { error } = await db.from("discord_pickems").upsert({
        user_id: userId,
        discord_id: i.user.id,
        match_id: matchId,
        picked_team_id: pickedTeamId,
      } as never, { onConflict: "discord_id,match_id" })
      if (error) {
        await i.editReply({ embeds: [errorEmbed(error.message)] })
        return
      }
      await i.editReply({ embeds: [successEmbed(`Pick saved: ${side.toUpperCase()} side.`)] })
    }
  },
} satisfies SlashCommand
