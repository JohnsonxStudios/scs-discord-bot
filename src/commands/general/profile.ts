import { SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db, findScsUserByDiscord } from "../../lib/db.js"
import { scsEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show your SCS profile + Discord level.")
    .addUserOption((o) => o.setName("user").setDescription("Look up someone else").setRequired(false)),
  async execute(i) {
    const target = i.options.getUser("user") ?? i.user
    const userId = await findScsUserByDiscord(target.id)
    const [{ data: lvl }, { data: u }, { data: tok }] = await Promise.all([
      db.from("discord_levels")
        .select("xp,level,messages")
        .eq("guild_id", i.guildId ?? "")
        .eq("discord_id", target.id)
        .maybeSingle(),
      userId ? db.from("users").select("gamer_tag,console,role").eq("id", userId).maybeSingle() : Promise.resolve({ data: null as any }),
      userId ? db.from("tokens").select("balance").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null as any }),
    ])

    const embed = scsEmbed("ice", target.username)
      .setThumbnail(target.displayAvatarURL({ extension: "png" }))
      .addFields(
        { name: "Level",    value: String(lvl?.level ?? 0), inline: true },
        { name: "XP",       value: String(lvl?.xp ?? 0),    inline: true },
        { name: "Messages", value: String(lvl?.messages ?? 0), inline: true },
      )
    if (u) {
      embed.addFields(
        { name: "SCS Gamertag", value: (u.gamer_tag as string) ?? "—", inline: true },
        { name: "Console",      value: (u.console as string) ?? "—",   inline: true },
        { name: "Role",         value: (u.role as string) ?? "Player", inline: true },
      )
    }
    if (tok) {
      embed.addFields({ name: "Tokens", value: `${(tok.balance as number) ?? 0}`, inline: true })
    }
    if (!u) embed.setFooter({ text: "Discord not linked yet — run /link" })

    await i.reply({ embeds: [embed] })
  },
} satisfies SlashCommand
