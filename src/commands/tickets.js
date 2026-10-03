import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { publishTicketPanel } from '../services/tickets.js';

export const data = new SlashCommandBuilder()
  .setName('tickets')
  .setDescription('Publica a Central de Atendimento do Brasil Mega Lite.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    await publishTicketPanel(interaction.client);
    await interaction.editReply('✅ Central de Atendimento publicada.');
  } catch (error) {
    console.error('Erro ao publicar tickets:', error);
    await interaction.editReply('❌ Não consegui publicar a Central. Confira IDs e permissões.');
  }
}
