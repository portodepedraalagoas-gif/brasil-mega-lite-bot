import { getInviteTotals, inviteChannelId, startInviteTracking } from '../services/invites.js';

const number = new Intl.NumberFormat('pt-BR');
const color = 0xb15cff;
const medals = ['🥇', '🥈', '🥉'];

function command(name, description, isRanking) {
  return {
    data: { name, toJSON: () => ({ name, description }) },
    async execute(interaction) {
      await interaction.deferReply(isRanking ? {} : { flags: 64 });
      let totals;
      try {
        totals = await getInviteTotals(interaction.guildId);
      } catch (error) {
        console.error('[BML Convites] Consulta:', error.code || error.message);
      }
      if (!totals) {
        await interaction.editReply('A contagem de convites está indisponível aqui no momento.');
        return;
      }
      const ranking = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const rank = ranking.findIndex(([id]) => id === interaction.user.id);
      const total = totals.get(interaction.user.id) || 0;
      const embed = isRanking ? {
        title: '🏆 Top 10 de convites',
        description: ranking.slice(0, 10).map(([id, count], index) =>
          `${medals[index] || `**${index + 1}.**`} <@${id}> · **${number.format(count)}** ${count === 1 ? 'convite' : 'convites'}`
        ).join('\n') || 'O ranking aparece assim que o primeiro convite for identificado.',
        footer: { text: 'BML • Convidados que ainda estão no servidor' }
      } : {
        title: '🎟️ Seus convites no BML',
        fields: [
          { name: 'Convites ativos', value: number.format(total), inline: true },
          { name: 'Posição no ranking', value: rank < 0 ? 'Sem posição' : `${rank + 1}º lugar`, inline: true }
        ],
        footer: { text: 'Cada convidado que está no servidor conta uma vez.' }
      };
      await interaction.editReply({ embeds: [{ ...embed, color }], allowedMentions: { parse: [] } });
    }
  };
}

export const invitesCommand = command('convites', 'Consulte seus convites e sua posição no ranking.', false);
export const topInvitesCommand = command('topconvites', 'Veja quem mais convidou pessoas para o BML.', true);

export async function initializeInviteCommands(client, guildId) {
  let channel;
  try {
    channel = await client.channels.fetch(inviteChannelId());
  } catch (error) {
    console.warn('[BML Convites] Canal de avisos indisponível:', error.code || error.message);
  }
  const guild = channel?.guild || client.guilds.cache.get(guildId);
  if (!guild) {
    console.error('[BML Convites] Servidor indisponível. Confira GUILD_ID e INVITES_CHANNEL_ID.');
    return;
  }
  startInviteTracking(client, guild.id);
  try {
    const registered = await guild.commands.fetch();
    const names = new Set();
    for (const existing of registered.values()) {
      if (existing.type === 1) names.add(existing.name);
    }
    for (const command of [invitesCommand, topInvitesCommand]) {
      const definition = command.data.toJSON();
      if (!names.has(definition.name)) {
        await guild.commands.create(definition);
      }
    }
    console.log(`[BML Convites] /convites e /topconvites registrados no servidor ${guild.id}.`);
  } catch (error) {
    console.error(`[BML Convites] Falha ao registrar comandos no servidor ${guild.id}:`, error.code || error.message);
  }
}
