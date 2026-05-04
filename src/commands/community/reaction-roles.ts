import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  PermissionFlagsBits, SlashCommandBuilder,
} from "discord.js"
import type { SlashCommand, ButtonHandler } from "../../types.js"
import { db } from "../../lib/db.js"
import { errorEmbed, scsEmbed, successEmbed } from "../../lib/embed.js"

/**
 * /reactionroles create title:"Pick your console" channel:#self-roles \
 *   exclusive:false \
 *   options:"PS5,🎮,@PS5; Xbox,🟢,@Xbox; PC,💻,@PC"
 *
 * options string is `;`-separated; each entry is `label,emoji,@role` (role mention).
 */
export default {
  data: new SlashCommandBuilder()
    .setName("reactionroles").setDescription("Self-assign role panels.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) => s.setName("create").setDescription("Post a new panel")
      .addStringOption((o) => o.setName("title").setDescription("Panel title").setRequired(true))
      .addStringOption((o) => o.setName("options").setDescription("label,emoji,@role; …").setRequired(true))
      .addChannelOption((o) => o.setName("channel").setDescription("Where to post the panel").addChannelTypes(ChannelType.GuildText).setRequired(false))
      .addBooleanOption((o) => o.setName("exclusive").setDescription("Only one role at a time").setRequired(false))
      .addStringOption((o) => o.setName("description").setDescription("Subtitle").setRequired(false))),
  async execute(i) {
    if (!i.guild) return
    const title = i.options.getString("title", true)
    const desc = i.options.getString("description") ?? ""
    const optsRaw = i.options.getString("options", true)
    const channel = (i.options.getChannel("channel") ?? i.channel)!
    const exclusive = i.options.getBoolean("exclusive") ?? false

    const opts = optsRaw.split(";").map((s) => s.trim()).filter(Boolean).map((entry) => {
      const [label, emoji, role] = entry.split(",").map((s) => s.trim())
      const roleId = role?.match(/\d+/)?.[0]
      return { label, emoji, roleId }
    }).filter((o) => o.label && o.roleId)
    if (!opts.length) { await i.reply({ embeds: [errorEmbed("Need at least one valid option.")], ephemeral: true }); return }

    const ch = await i.guild.channels.fetch(channel.id)
    if (!ch?.isTextBased()) { await i.reply({ embeds: [errorEmbed("Bad channel.")] }); return }

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...opts.slice(0, 5).map((o) =>
        new ButtonBuilder()
          .setCustomId(`rr:toggle:placeholder:${o.roleId}`)
          .setLabel(o.label)
          .setEmoji(o.emoji || "🎯")
          .setStyle(ButtonStyle.Secondary),
      ),
    )

    const sent = await ch.send({
      embeds: [scsEmbed("aurora", title, desc || "Click a button to toggle the role.")],
      components: [buttons],
    })

    const { data: panel } = await db.from("discord_reaction_panels").insert({
      guild_id: i.guild.id, channel_id: ch.id, message_id: sent.id, title, description: desc, exclusive, options: opts,
    } as never).select("id").single()

    if (panel) {
      // Replace placeholder customIds with the actual panel id
      await sent.edit({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...opts.slice(0, 5).map((o) =>
              new ButtonBuilder()
                .setCustomId(`rr:toggle:${panel.id}:${o.roleId}`)
                .setLabel(o.label)
                .setEmoji(o.emoji || "🎯")
                .setStyle(ButtonStyle.Secondary),
            ),
          ),
        ],
      })
    }
    await i.reply({ embeds: [successEmbed(`Panel posted in <#${ch.id}>.`)], ephemeral: true })
  },
} satisfies SlashCommand

export const button: ButtonHandler = {
  customId: /^rr:toggle:/,
  async execute(i) {
    if (!i.guild) return
    const [, , panelId, roleId] = i.customId.split(":")
    const member = await i.guild.members.fetch(i.user.id).catch(() => null)
    if (!member) return
    const { data: panel } = await db.from("discord_reaction_panels").select("exclusive,options").eq("id", panelId).maybeSingle()

    if (panel?.exclusive) {
      const otherRoleIds = ((panel.options as Array<{ roleId: string }>) ?? []).map((o) => o.roleId).filter((r) => r && r !== roleId)
      for (const rid of otherRoleIds) {
        if (member.roles.cache.has(rid)) await member.roles.remove(rid).catch(() => {})
      }
    }

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId).catch(() => {})
      await i.reply({ ephemeral: true, content: `Removed <@&${roleId}>.` })
    } else {
      await member.roles.add(roleId).catch(() => {})
      await i.reply({ ephemeral: true, content: `Added <@&${roleId}>.` })
    }
  },
}
