import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  ClientEvents,
  Client,
} from "discord.js"

export interface SlashCommand {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder
    | ReturnType<SlashCommandBuilder["toJSON"]>
  /** Optional permission level: "user" | "mod" | "admin". Default: user. */
  level?: "user" | "mod" | "admin"
  execute(interaction: ChatInputCommandInteraction): Promise<unknown>
}

export interface ButtonHandler {
  customId: string | RegExp
  execute(interaction: ButtonInteraction): Promise<unknown>
}

export interface ModalHandler {
  customId: string | RegExp
  execute(interaction: ModalSubmitInteraction): Promise<unknown>
}

export interface SelectHandler {
  customId: string | RegExp
  execute(interaction: StringSelectMenuInteraction): Promise<unknown>
}

export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K
  once?: boolean
  execute(client: Client, ...args: ClientEvents[K]): Promise<unknown>
}
