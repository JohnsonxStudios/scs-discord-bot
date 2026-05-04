import {
  ActionRowBuilder, ChannelType, EmbedBuilder, ModalBuilder, PermissionFlagsBits,
  SlashCommandBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js"
import type { SlashCommand, ModalHandler } from "../../types.js"

export default {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Build and send a rich embed.")
    .addChannelOption((o) => o.setName("channel").setDescription("Where to post").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false)),
  async execute(i) {
    if (!i.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await i.reply({ ephemeral: true, content: "Manage Messages permission required." }); return
    }
    const ch = (i.options.getChannel("channel") ?? i.channel)!
    const modal = new ModalBuilder()
      .setCustomId(`embed:build:${ch.id}`)
      .setTitle("Embed builder")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("title").setLabel("Title").setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("description").setLabel("Description (markdown ok)").setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("color").setLabel("Hex color (e.g. #38bdf8)").setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("image").setLabel("Image URL").setStyle(TextInputStyle.Short).setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("footer").setLabel("Footer").setStyle(TextInputStyle.Short).setMaxLength(2048).setRequired(false),
        ),
      )
    await i.showModal(modal)
  },
} satisfies SlashCommand

export const modal: ModalHandler = {
  customId: /^embed:build:/,
  async execute(i) {
    const channelId = i.customId.split(":")[2]
    if (!i.guild) return
    const ch = await i.guild.channels.fetch(channelId).catch(() => null)
    if (!ch?.isTextBased()) { await i.reply({ ephemeral: true, content: "Channel not found." }); return }

    const e = new EmbedBuilder()
    const title = i.fields.getTextInputValue("title").trim()
    const desc = i.fields.getTextInputValue("description").trim()
    const color = i.fields.getTextInputValue("color").trim()
    const image = i.fields.getTextInputValue("image").trim()
    const footer = i.fields.getTextInputValue("footer").trim()
    if (title) e.setTitle(title)
    if (desc) e.setDescription(desc)
    if (color && /^#?[0-9a-fA-F]{6}$/.test(color)) e.setColor(parseInt(color.replace("#", ""), 16))
    if (image) e.setImage(image)
    if (footer) e.setFooter({ text: footer })
    await ch.send({ embeds: [e] }).catch(() => {})
    await i.reply({ ephemeral: true, content: `Posted to <#${channelId}>.` })
  },
}
