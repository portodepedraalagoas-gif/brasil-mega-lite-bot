import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder().setName('ajuda').setDescription('Mostra os comandos disponíveis.');
export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`🤖 ${config.serverName} — Central de Comandos`)
    .setDescription('**/status** — status e quantidade de jogadores\n**/players** — jogadores online\n**/ip** — IP do servidor\n**/ajuda** — abre esta mensagem\n\n**Administração**\n**/painel** — cria o painel automático\n**/verificacao** — cria o painel de verificação')
    .setFooter({ text: 'V2 • Brasil Mega Lite' });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
