import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  SlashCommandBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} from "discord.js"
import type { SlashCommand, ButtonHandler, ModalHandler } from "../../types.js"
import { db, getGuildSettings } from "../../lib/db.js"
import { errorEmbed, scsEmbed, successEmbed } from "../../lib/embed.js"

const TYPES = [
  { name: "Staff",        value: "staff" },
  { name: "Team Manager", value: "team-manager" },
  { name: "Media",        value: "media" },
  { name: "Stats",        value: "stats" },
]

export default {
  data: new SlashCommandBuilder()
    .setName("apply").setDescription("Apply for a league role.")
    .addStringOption((o) => o.setName("type").setDescription("Application type").setRequired(true).addChoices(...TYPES)),
  async execute(i) {
    const type = i.options.getString("type", true)
    const modal = new ModalBuilder()
      .setCustomId(`apply:${type}`)
      .setTitle(`${type.toUpperCase()} Application`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("experience").setLabel("Relevant experience").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("availability").setLabel("Availability (timezone + hours/week)").setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("why").setLabel("Why do you want this role?").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("references").setLabel("References / past leagues (optional)").setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(false),
        ),
      )
    await i.showModal(modal)
  },
} satisfies SlashCommand

export const modal: ModalHandler = {
  customId: /^apply:/,
  async execute(i) {
    if (!i.guild) return
    const type = i.customId.split(":")[1] ?? "staff"
    const payload = {
      experience: i.fields.getTextInputValue("experience"),
      availability: i.fields.getTextInputValue("availability"),
      why: i.fields.getTextInputValue("why"),
      references: i.fields.getTextInputValue("references"),
    }
    const { data: app } = await db.from("discord_applications").insert({
      guild_id: i.guild.id, type,
      applicant_discord_id: i.user.id, applicant_username: i.user.username,
      payload, status: "pending",
    } as never).select("id").single()

    const settings = await getGuildSettings(i.guild.id)
    const channelId = (settings.application_channel_id as string | null) ?? settings.log_channel_id
    if (channelId) {
      const ch = await i.guild.channels.fetch(channelId).catch(() => null)
      if (ch?.isTextBased() && "send" in ch) {
        await ch.send({
          embeds: [
            scsEmbed("aurora", `📝 ${type.toUpperCase()} application — ${i.user.username}`)
              .addFields(
                { name: "Experience",  value: payload.experience.slice(0, 1000) },
                { name: "Availability", value: payload.availability },
                { name: "Why",          value: payload.why.slice(0, 1000) },
                ...(payload.references ? [{ name: "References", value: payload.references.slice(0, 1000) }] : []),
              )
              .setFooter({ text: `Application ${app?.id ?? "?"}` }),
          ],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId(`apply:approve:${app?.id}`).setLabel("Approve").setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`apply:deny:${app?.id}`).setLabel("Deny").setStyle(ButtonStyle.Danger),
            ),
          ],
        }).catch(() => {})
      }
    }
    await i.reply({ embeds: [successEmbed("Application submitted — staff will review.")], flags: MessageFlags.Ephemeral })
  },
}

export const button: ButtonHandler = {
  customId: /^apply:(approve|deny):/,
  async execute(i) {
    const [, action, appId] = i.customId.split(":")
    if (!i.memberPermissions?.has("ManageGuild")) {
      await i.reply({ embeds: [errorEmbed("Manage Server permission required.")], flags: MessageFlags.Ephemeral }); return
    }
    const status = action === "approve" ? "approved" : "denied"
    const { data: app } = await db.from("discord_applications").select("applicant_discord_id,type").eq("id", appId).maybeSingle()
    await db.from("discord_applications").update({
      status, reviewer_discord_id: i.user.id, reviewed_at: new Date().toISOString(),
    } as never).eq("id", appId)
    await i.update({
      content: `Application ${status} by <@${i.user.id}>.`,
      components: [],
    })
    if (app?.applicant_discord_id) {
      try {
        const user = await i.client.users.fetch(app.applicant_discord_id as string)
        await user.send({ embeds: [scsEmbed(status === "approved" ? "emerald" : "rose", `Your ${app.type} application was ${status}.`)] })
      } catch { /* DMs disabled */ }
    }
  },
}
