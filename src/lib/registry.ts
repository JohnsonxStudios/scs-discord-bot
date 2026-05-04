import { Collection } from "discord.js"
import type { ButtonHandler, ModalHandler, SelectHandler, SlashCommand } from "../types.js"

export const commands = new Collection<string, SlashCommand>()
export const buttons: ButtonHandler[] = []
export const modals: ModalHandler[] = []
export const selects: SelectHandler[] = []

export function registerCommand(cmd: SlashCommand) {
  const name = (cmd.data as any).name as string
  commands.set(name, cmd)
}

export function registerButton(h: ButtonHandler) { buttons.push(h) }
export function registerModal(h: ModalHandler)   { modals.push(h) }
export function registerSelect(h: SelectHandler) { selects.push(h) }

function matches(id: string, customId: string | RegExp) {
  return typeof customId === "string" ? id === customId || id.startsWith(`${customId}:`) : customId.test(id)
}

export function findButton(id: string)  { return buttons.find((h) => matches(id, h.customId)) }
export function findModal(id: string)   { return modals.find((h) => matches(id, h.customId)) }
export function findSelect(id: string)  { return selects.find((h) => matches(id, h.customId)) }
