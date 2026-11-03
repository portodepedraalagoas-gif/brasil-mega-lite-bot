import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { upsertStatusPanel } from '../services/panel.js';

export const data = new SlashCommandBuilder()
  .setName('painel')
  .setDescription('Cria ou atualiza o painel automático do servidor.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    await upsertStatusPanel(interaction.client, interaction.channel);
    await interaction.editReply('✅ Painel automático criado/atualizado neste canal.');
  } catch (e) {
    console.error(e);
    await interaction.editReply('❌ Não consegui criar o painel neste canal. Confira minhas permissões.');
  }
}
