import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db } from "../../lib/db.js"
import { successEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("setup").setDescription("Configure SCS bot for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName("welcome")
      .setDescription("Welcome channel + message")
      .addChannelOption((o) => o.setName("channel").setDescription("Channel for welcome messages").addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Use {user} to mention. Default if blank.").setRequired(false)))
    .addSubcommand((s) => s.setName("logs")
      .setDescription("Mod log channel")
      .addChannelOption((o) => o.setName("channel").setDescription("Channel for mod logs").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName("ticket-category")
      .setDescription("Channel where ticket threads are created")
      .addChannelOption((o) => o.setName("channel").setDescription("Parent channel for ticket threads").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName("autorole")
      .setDescription("Role given to every new member")
      .addRoleOption((o) => o.setName("role").setDescription("Role auto-applied on join").setRequired(true)))
    .addSubcommand((s) => s.setName("levelup")
      .setDescription("Level-up announcement channel")
      .addChannelOption((o) => o.setName("channel").setDescription("Channel for level-up posts").addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Use {user} and {level}").setRequired(false)))
    .addSubcommand((s) => s.setName("level-reward")
      .setDescription("Grant role at level")
      .addIntegerOption((o) => o.setName("level").setDescription("Level threshold").setRequired(true).setMinValue(1))
      .addRoleOption((o) => o.setName("role").setDescription("Role to grant").setRequired(true)))
    .addSubcommand((s) => s.setName("announce")
      .setDescription("Bind a channel for an auto-announcement topic")
      .addStringOption((o) => o.setName("topic").setDescription("Which announcements").setRequired(true).addChoices(
        { name: "New scheduled matches", value: "matches" },
        { name: "Match results",         value: "results" },
        { name: "News stories",          value: "news" },
        { name: "Daily recaps",          value: "recaps" },
        { name: "Trades / waivers / FA", value: "trades" },
        { name: "Highlight clips",       value: "highlights" },
        { name: "Application reviews",   value: "applications" },
      ))
      .addChannelOption((o) => o.setName("channel").setDescription("Destination channel").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName("filter")
      .setDescription("Set blocked words (comma-separated). Empty to clear.")
      .addStringOption((o) => o.setName("words").setDescription("Comma-separated word list").setRequired(true)))
    .addSubcommand((s) => s.setName("notifications-dm")
      .setDescription("Toggle DM bridge for SCS notifications")
      .addBooleanOption((o) => o.setName("enabled").setDescription("On/off").setRequired(true))),
  async execute(i) {
    if (!i.guild) return
    const sub = i.options.getSubcommand()
    const patch: Record<string, any> = { guild_id: i.guild.id }
    let label = ""

    if (sub === "welcome") {
      patch.welcome_channel_id = i.options.getChannel("channel", true).id
      const msg = i.options.getString("message"); if (msg) patch.welcome_message = msg
      label = "Welcome configuration saved."
    } else if (sub === "logs") {
      patch.log_channel_id = i.options.getChannel("channel", true).id
      label = "Log channel saved."
    } else if (sub === "ticket-category") {
      patch.ticket_category_id = i.options.getChannel("channel", true).id
      label = "Ticket parent channel saved."
    } else if (sub === "autorole") {
      patch.autorole_id = i.options.getRole("role", true).id
      label = "Autorole saved."
    } else if (sub === "levelup") {
      patch.level_up_channel_id = i.options.getChannel("channel", true).id
      const msg = i.options.getString("message"); if (msg) patch.level_up_message = msg
      label = "Level-up channel saved."
    } else if (sub === "level-reward") {
      const level = i.options.getInteger("level", true)
      const role = i.options.getRole("role", true)
      await db.from("discord_level_rewards").upsert({ guild_id: i.guild.id, level, role_id: role.id } as never, { onConflict: "guild_id,level" })
      await i.reply({ embeds: [successEmbed(`At level **${level}**, members get <@&${role.id}>.`)] })
      return
    } else if (sub === "announce") {
      const topic = i.options.getString("topic", true)
      const ch = i.options.getChannel("channel", true)
      const colMap: Record<string, string> = {
        matches: "announce_matches_channel_id",
        results: "announce_results_channel_id",
        news:    "announce_news_channel_id",
        recaps:  "announce_recaps_channel_id",
        trades:  "announce_trades_channel_id",
        highlights:   "highlights_channel_id",
        applications: "application_channel_id",
      }
      patch[colMap[topic]] = ch.id
      label = `Announcements bound: ${topic} → <#${ch.id}>`
    } else if (sub === "filter") {
      const raw = i.options.getString("words", true)
      const list = raw.split(",").map((s) => s.trim()).filter(Boolean)
      patch.word_filter = list
      label = list.length ? `Filtering ${list.length} word(s).` : "Word filter cleared."
    } else if (sub === "notifications-dm") {
      patch.notifications_dm = i.options.getBoolean("enabled", true)
      label = `Notification DMs ${patch.notifications_dm ? "enabled" : "disabled"}.`
    }

    await db.from("discord_settings").upsert(patch as never, { onConflict: "guild_id" })
    await i.reply({ embeds: [successEmbed(label)] })
  },
} satisfies SlashCommand
