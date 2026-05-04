import { SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { findScsUserByDiscord } from "../../lib/db.js"
import { adjustBalance, getBalance, logCasino } from "../../lib/tokens.js"
import { errorEmbed, scsEmbed } from "../../lib/embed.js"

const SYMBOLS = ["🍒", "🍋", "🔔", "🍇", "⭐", "💎", "7️⃣"]
const PAYOUT_TABLE: Record<string, number> = {
  "7️⃣7️⃣7️⃣": 50,
  "💎💎💎": 25,
  "⭐⭐⭐": 10,
  "🔔🔔🔔": 6,
  "🍇🍇🍇": 4,
  "🍋🍋🍋": 3,
  "🍒🍒🍒": 2,
}

export default {
  data: new SlashCommandBuilder()
    .setName("slots")
    .setDescription("Spin the SCS slot machine.")
    .addIntegerOption((o) => o.setName("wager").setDescription("Tokens to wager").setRequired(true).setMinValue(10)),
  async execute(i) {
    await i.deferReply()
    const wager = i.options.getInteger("wager", true)
    const userId = await findScsUserByDiscord(i.user.id)
    if (!userId) { await i.editReply({ embeds: [errorEmbed("Run `/link` first.")] }); return }
    const bal = await getBalance(userId)
    if (bal < wager) { await i.editReply({ embeds: [errorEmbed(`Insufficient tokens (${bal}).`)] }); return }

    await adjustBalance(userId, -wager)
    const reels = [SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]]
    const line = reels.join("")
    const mult = PAYOUT_TABLE[line] ?? (reels[0] === reels[1] || reels[1] === reels[2] ? 1 : 0)
    const payout = wager * mult
    if (payout) await adjustBalance(userId, payout)
    await logCasino({ userId, discordId: i.user.id, game: "slots", wager, payout, meta: { reels } })

    const newBal = await getBalance(userId)
    await i.editReply({
      embeds: [
        scsEmbed(payout > 0 ? "emerald" : "rose", "🎰 Slots", [
          `\`[ ${reels.join(" │ ")} ]\``,
          payout > 0 ? `**${mult}× payout — won ${payout} tokens!**` : `No combo — better luck next spin.`,
          `Balance: **${newBal}** tokens`,
        ].join("\n")),
      ],
    })
  },
} satisfies SlashCommand
