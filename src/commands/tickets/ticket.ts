import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  ModalBuilder, PermissionFlagsBits, SlashCommandBuilder,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db, getGuildSettings } from "../../lib/db.js"
import { scsEmbed, successEmbed } from "../../lib/embed.js"

const CATEGORIES = [
  { value: "support", label: "General Support",    emoji: "🛠️" },
  { value: "report",  label: "Report a Player",    emoji: "🚨" },
  { value: "appeal",  label: "Appeal a Punishment", emoji: "⚖️" },
  { value: "league",  label: "League Question",    emoji: "🏒" },
  { value: "other",   label: "Other",              emoji: "💬" },
]

export default {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Open or manage support tickets.")
    .addSubcommand((s) => s.setName("open").setDescription("Open a new ticket"))
    .addSubcommand((s) => s.setName("panel").setDescription("Post the public ticket panel (mods only)")),
  async execute(i) {
    const sub = i.options.getSubcommand()
    if (sub === "open") {
      await i.reply({
        ephemeral: true,
        embeds: [scsEmbed("ice", "Pick a category", "Choose what your ticket is about — staff will be paged in a private thread.")],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("ticket:category")
              .setPlaceholder("Select a category")
              .addOptions(CATEGORIES.map((c) => ({ label: c.label, value: c.value, emoji: c.emoji }))),
          ),
        ],
      })
      return
    }
    if (sub === "panel") {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await i.reply({ ephemeral: true, content: "Manage Server permission required." })
        return
      }
      await i.reply({
        embeds: [scsEmbed("aurora", "🎫 Open a Ticket", "Click below to open a private ticket. Staff are paged automatically.")],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("ticket:open").setLabel("Open Ticket").setEmoji("🎫").setStyle(ButtonStyle.Primary),
          ),
        ],
      })
    }
  },
} satisfies SlashCommand

// ─── Interactions ──────────────────────────────────────────────────────────
import type { ButtonHandler, ModalHandler, SelectHandler } from "../../types.js"

export const button: ButtonHandler = {
  customId: /^ticket:/,
  async execute(i) {
    const [, action, ...rest] = i.customId.split(":")
    if (action === "open") {
      await i.reply({
        ephemeral: true,
        embeds: [scsEmbed("ice", "Pick a category", "Choose what your ticket is about.")],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("ticket:category")
              .setPlaceholder("Select a category")
              .addOptions(CATEGORIES.map((c) => ({ label: c.label, value: c.value, emoji: c.emoji }))),
          ),
        ],
      })
      return
    }
    if (action === "close") {
      const channelId = rest[0] ?? i.channelId
      if (!i.guild) return
      const ch = await i.guild.channels.fetch(channelId).catch(() => null)
      if (!ch || ch.type !== ChannelType.PrivateThread && ch.type !== ChannelType.PublicThread) {
        await i.reply({ ephemeral: true, content: "Couldn't find ticket thread." })
        return
      }
      await db.from("discord_tickets")
        .update({ status: "closed", closed_at: new Date().toISOString(), closed_by_discord_id: i.user.id } as never)
        .eq("channel_id", channelId)
      await i.reply({ embeds: [successEmbed(`Ticket closed by <@${i.user.id}>.`)] })
      await ch.setLocked(true).catch(() => {})
      await ch.setArchived(true).catch(() => {})
    }
  },
}

export const select: SelectHandler = {
  customId: "ticket:category",
  async execute(i) {
    const [category] = i.values
    const modal = new ModalBuilder()
      .setCustomId(`ticket:create:${category}`)
      .setTitle("Open a Ticket")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("subject").setLabel("Subject").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("details").setLabel("Details").setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true),
        ),
      )
    await i.showModal(modal)
  },
}

export const modal: ModalHandler = {
  customId: /^ticket:create:/,
  async execute(i) {
    if (!i.guild) return
    const category = i.customId.split(":")[2] ?? "support"
    const subject = i.fields.getTextInputValue("subject")
    const details = i.fields.getTextInputValue("details")
    await i.deferReply({ flags: MessageFlags.Ephemeral })

    const settings = await getGuildSettings(i.guild.id)
    const parentId = settings.ticket_category_id as string | null
    const parent = parentId ? await i.guild.channels.fetch(parentId).catch(() => null) : null
    const baseChannel = parent && "threads" in parent ? parent : i.channel
    if (!baseChannel || !("threads" in baseChannel)) {
      await i.editReply({ embeds: [scsEmbed("rose", "No ticket channel configured", "An admin must run `/setup ticket-category` first.")] })
      return
    }

    const thread = await baseChannel.threads.create({
      name: `ticket-${i.user.username}-${Date.now().toString(36).slice(-4)}`,
      type: ChannelType.PrivateThread,
      autoArchiveDuration: 1440,
      reason: `Ticket from ${i.user.tag}`,
      invitable: false,
    })
    await thread.members.add(i.user.id).catch(() => {})

    await db.from("discord_tickets").insert({
      guild_id: i.guild.id,
      channel_id: thread.id,
      opener_discord_id: i.user.id,
      category, reason: subject,
      status: "open",
    } as never)

    await thread.send({
      content: `<@${i.user.id}> ${settings.ticket_log_channel_id ? `<@&${settings.ticket_log_channel_id}>` : ""}`,
      embeds: [scsEmbed("aurora", `🎫 ${subject}`, details)
        .addFields({ name: "Category", value: category, inline: true }, { name: "Opener", value: `<@${i.user.id}>`, inline: true })],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`ticket:close:${thread.id}`).setLabel("Close").setStyle(ButtonStyle.Danger),
        ),
      ],
    })
    await i.editReply({ embeds: [successEmbed(`Ticket opened: <#${thread.id}>`)] })
  },
}
