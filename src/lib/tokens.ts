import { db } from "./db.js"

/** Get a user's token balance (creates row if missing). */
export async function getBalance(userId: string): Promise<number> {
  const { data } = await db.from("tokens").select("balance").eq("user_id", userId).maybeSingle()
  if (data) return Number(data.balance ?? 0)
  await db.from("tokens").insert({ user_id: userId, balance: 0 } as never)
  return 0
}

/** Atomically apply a balance delta. Returns the new balance, or null if insufficient. */
export async function adjustBalance(userId: string, delta: number): Promise<number | null> {
  const current = await getBalance(userId)
  const next = current + delta
  if (next < 0) return null
  const { error } = await db.from("tokens").update({ balance: next } as never).eq("user_id", userId)
  if (error) throw new Error(error.message)
  return next
}

/** Log a casino round. */
export async function logCasino(args: {
  userId: string; discordId: string; game: string; wager: number; payout: number; meta?: any
}) {
  await db.from("discord_casino_log").insert({
    user_id: args.userId,
    discord_id: args.discordId,
    game: args.game,
    wager: args.wager,
    payout: args.payout,
    net: args.payout - args.wager,
    meta: args.meta ?? {},
  } as never)
}
