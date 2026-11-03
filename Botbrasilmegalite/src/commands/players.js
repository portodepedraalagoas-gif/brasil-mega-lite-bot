import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { queryMta } from '../services/mta.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('players')
  .setDescription('Lista os jogadores online no Brasil Mega Lite.');

export async function execute(interaction) {
  await interaction.deferReply();
  try {
    const s = await queryMta();
    const list = s.players_list || [];
    const text = list.length
      ? list.slice(0, 50).map((p, i) => `**${i + 1}.** ${p.name} — ${p.ping}ms`).join('\n')
      : 'Nenhum jogador online no momento.';
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`👥 Jogadores — ${config.serverName}`)
      .setDescription(text)
      .addFields({ name: 'Online', value: `**${s.players}/${s.max_players}**` })
      .setTimestamp();
    if (list.length > 50) embed.setFooter({ text: `Mostrando 50 de ${list.length} jogadores.` });
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.editReply('❌ Não consegui consultar a lista de jogadores agora.');
  }
}
