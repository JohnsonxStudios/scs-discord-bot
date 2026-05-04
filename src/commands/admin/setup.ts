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
      .addChannelOption((o) => o.setName("channel").addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Use {user} to mention. Default if blank.").setRequired(false)))
    .addSubcommand((s) => s.setName("logs")
      .setDescription("Mod log channel")
      .addChannelOption((o) => o.setName("channel").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName("ticket-category")
      .setDescription("Channel where ticket threads are created")
      .addChannelOption((o) => o.setName("channel").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName("autorole")
      .setDescription("Role given to every new member")
      .addRoleOption((o) => o.setName("role").setRequired(true)))
    .addSubcommand((s) => s.setName("levelup")
      .setDescription("Level-up announcement channel")
      .addChannelOption((o) => o.setName("channel").addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Use {user} and {level}").setRequired(false)))
    .addSubcommand((s) => s.setName("level-reward")
      .setDescription("Grant role at level")
      .addIntegerOption((o) => o.setName("level").setRequired(true).setMinValue(1))
      .addRoleOption((o) => o.setName("role").setRequired(true))),
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
    }

    await db.from("discord_settings").upsert(patch as never, { onConflict: "guild_id" })
    await i.reply({ embeds: [successEmbed(label)] })
  },
} satisfies SlashCommand
