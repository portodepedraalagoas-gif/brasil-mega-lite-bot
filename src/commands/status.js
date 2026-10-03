import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { queryMta } from '../services/mta.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Mostra o status do servidor Brasil Mega Lite.');

export async function execute(interaction) {
  await interaction.deferReply();
  try {
    const s = await queryMta();
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`🟢 ${config.serverName} — ONLINE`)
      .setDescription('Informações em tempo real do servidor MTA.')
      .addFields(
        { name: '👥 Jogadores', value: `**${s.players}/${s.max_players}**`, inline: true },
        { name: '🎮 Gamemode', value: s.gamemode || 'Não informado', inline: true },
        { name: '🗺️ Mapa', value: s.map || 'Não informado', inline: true },
        { name: '🌐 IP', value: `\`mtasa://${config.mtaHost}:${config.mtaPort}\``, inline: false },
        { name: '🧩 Versão', value: s.version || 'Não informada', inline: true },
        { name: '🔒 Senha', value: s.private ? 'Sim' : 'Não', inline: true },
      )
      .setFooter({ text: 'Brasil Mega Lite • MTA:SA' })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Falha ao consultar MTA:', error);
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`🔴 ${config.serverName} — SEM RESPOSTA`)
      .setDescription('Não consegui consultar o servidor agora. Isso também pode acontecer se a porta ASE estiver bloqueada/desativada.')
      .addFields({ name: '🌐 IP', value: `\`mtasa://${config.mtaHost}:${config.mtaPort}\`` });
    await interaction.editReply({ embeds: [embed] });
  }
}
