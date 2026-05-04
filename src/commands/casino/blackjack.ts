import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js"
import type { SlashCommand, ButtonHandler } from "../../types.js"
import { findScsUserByDiscord } from "../../lib/db.js"
import { adjustBalance, getBalance, logCasino } from "../../lib/tokens.js"
import { errorEmbed, scsEmbed } from "../../lib/embed.js"

const SUITS = ["♠", "♥", "♦", "♣"]
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"]
type Card = { rank: string; suit: string }

function newDeck(): Card[] {
  const d: Card[] = []
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s })
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

function score(hand: Card[]): number {
  let total = 0, aces = 0
  for (const c of hand) {
    if (c.rank === "A") { aces += 1; total += 11 }
    else if (["J","Q","K"].includes(c.rank)) total += 10
    else total += Number(c.rank)
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1 }
  return total
}

function show(hand: Card[]) {
  return hand.map((c) => `\`${c.rank}${c.suit}\``).join(" ")
}

// In-memory game state (per Discord user). Survives until /restart.
const games = new Map<string, { deck: Card[]; player: Card[]; dealer: Card[]; wager: number; userId: string }>()

export default {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Play a hand of blackjack.")
    .addIntegerOption((o) => o.setName("wager").setDescription("Tokens to wager").setRequired(true).setMinValue(10)),
  async execute(i) {
    await i.deferReply()
    const wager = i.options.getInteger("wager", true)
    const userId = await findScsUserByDiscord(i.user.id)
    if (!userId) { await i.editReply({ embeds: [errorEmbed("Run `/link` first.")] }); return }
    const bal = await getBalance(userId)
    if (bal < wager) { await i.editReply({ embeds: [errorEmbed(`Insufficient tokens (${bal}).`)] }); return }

    await adjustBalance(userId, -wager)
    const deck = newDeck()
    const player = [deck.pop()!, deck.pop()!]
    const dealer = [deck.pop()!, deck.pop()!]
    games.set(i.user.id, { deck, player, dealer, wager, userId })

    await i.editReply({
      embeds: [
        scsEmbed("aurora", "🃏 Blackjack", [
          `Your hand: ${show(player)} (**${score(player)}**)`,
          `Dealer shows: \`${dealer[0].rank}${dealer[0].suit}\` ?`,
        ].join("\n")),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`bj:hit`).setLabel("Hit").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`bj:stand`).setLabel("Stand").setStyle(ButtonStyle.Success),
        ),
      ],
    })
  },
} satisfies SlashCommand

export const button: ButtonHandler = {
  customId: /^bj:/,
  async execute(i) {
    const game = games.get(i.user.id)
    if (!game) { await i.reply({ ephemeral: true, content: "No active hand. Run `/blackjack` first." }); return }
    const action = i.customId.split(":")[1]

    if (action === "hit") {
      game.player.push(game.deck.pop()!)
      const s = score(game.player)
      if (s > 21) return finish(i, "bust")
      await i.update({
        embeds: [scsEmbed("aurora", "🃏 Blackjack", [
          `Your hand: ${show(game.player)} (**${s}**)`,
          `Dealer shows: \`${game.dealer[0].rank}${game.dealer[0].suit}\` ?`,
        ].join("\n"))],
        components: i.message.components,
      })
      return
    }
    if (action === "stand") return finish(i, "stand")
  },
}

async function finish(i: any, mode: "bust" | "stand") {
  const game = games.get(i.user.id)!
  let dealerScore = score(game.dealer)
  if (mode === "stand") {
    while (dealerScore < 17) {
      game.dealer.push(game.deck.pop()!)
      dealerScore = score(game.dealer)
    }
  }
  const playerScore = score(game.player)
  let payout = 0, outcome = ""
  if (mode === "bust") { outcome = `You busted at **${playerScore}**` }
  else if (dealerScore > 21 || playerScore > dealerScore) { payout = game.wager * 2; outcome = `You win!` }
  else if (playerScore === dealerScore) { payout = game.wager; outcome = `Push.` }
  else { outcome = `Dealer wins.` }

  if (payout) await adjustBalance(game.userId, payout)
  await logCasino({ userId: game.userId, discordId: i.user.id, game: "blackjack", wager: game.wager, payout, meta: { player: game.player, dealer: game.dealer } })
  const bal = await getBalance(game.userId)
  games.delete(i.user.id)

  await i.update({
    embeds: [scsEmbed(payout > game.wager ? "emerald" : payout === game.wager ? "amber" : "rose", "🃏 Final", [
      `You: ${game.player.map((c) => `\`${c.rank}${c.suit}\``).join(" ")} (**${playerScore}**)`,
      `Dealer: ${game.dealer.map((c) => `\`${c.rank}${c.suit}\``).join(" ")} (**${dealerScore}**)`,
      ``,
      `**${outcome}** — payout ${payout}`,
      `Balance: **${bal}** tokens`,
    ].join("\n"))],
    components: [],
  })
}
