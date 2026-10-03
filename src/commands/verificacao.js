import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('verificacao')
  .setDescription('Envia o painel de verificação de novos membros.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (!config.verifiedRoleId) {
    return interaction.reply({ content: '❌ Configure `VERIFIED_ROLE_ID` no arquivo `.env` primeiro.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`✅ Verificação — ${config.serverName}`)
    .setDescription('Bem-vindo(a)! Para liberar seu acesso ao servidor, clique no botão **Verificar** abaixo.\n\nAo verificar, você receberá automaticamente o cargo configurado pela administração.')
    .setFooter({ text: 'Brasil Mega Lite • Sistema de Verificação' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bml_verify').setLabel('Verificar').setEmoji('✅').setStyle(ButtonStyle.Success),
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ Painel de verificação enviado.', ephemeral: true });
}
