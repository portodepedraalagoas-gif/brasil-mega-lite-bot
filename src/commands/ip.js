import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('ip')
  .setDescription('Mostra o IP para entrar no Brasil Mega Lite.');

export async function execute(interaction) {
  const ip = `${config.mtaHost}:${config.mtaPort}`;
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🌐 ${config.serverName}`)
    .setDescription(`Abra o **MTA:SA** → **Quick Connect / Conexão rápida** e cole:\n\n\`${ip}\`\n\nAtalho MTA: \`mtasa://${ip}\``)
    .setFooter({ text: 'Brasil Mega Lite • MTA:SA' });
  await interaction.reply({ embeds: [embed] });
}
