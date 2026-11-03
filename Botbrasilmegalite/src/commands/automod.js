import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { showAutoModPanel } from '../services/automod.js';

export const data = new SlashCommandBuilder()
  .setName('automod')
  .setDescription('Configurar antiflood, antilinks e antispam do BML')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export async function execute(interaction) {
  await showAutoModPanel(interaction);
}
