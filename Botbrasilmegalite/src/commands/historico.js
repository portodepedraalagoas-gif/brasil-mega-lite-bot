import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';

const REPORT_ROLE_ID = '1555910336820027472';
const STAFF_ROLE_ID = '1554536183457906709';
const PUNISHMENT_LOG_CHANNEL_ID = '1555949299597049936';

export const data = new SlashCommandBuilder()
  .setName('historico')
  .setDescription('Consulta o histórico de punições de um jogador.')
  .addStringOption(option =>
    option
      .setName('jogador')
      .setDescription('Nome do jogador ou identificador')
      .setRequired(true)
  );

export async function execute(interaction) {

  const authorized =
    interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    ) ||
    interaction.member?.roles?.cache?.has(
      REPORT_ROLE_ID
    ) ||
    interaction.member?.roles?.cache?.has(
      STAFF_ROLE_ID
    );

  if (!authorized) {
    return interaction.reply({
      content:
        '❌ Apenas membros da equipe podem consultar históricos.',
      ephemeral: true
    });
  }

  await interaction.deferReply({
    ephemeral: true
  });

  try {

    const search =
      interaction.options
        .getString('jogador', true)
        .trim()
        .toLowerCase();

    const logChannel =
      await interaction.guild.channels.fetch(
        PUNISHMENT_LOG_CHANNEL_ID
      );

    if (!logChannel?.isTextBased()) {
      return interaction.editReply(
        '❌ O canal de logs de punições não foi encontrado.'
      );
    }

    const punishments = [];

    let before;

    // Procura também além das últimas 100 mensagens.
    while (true) {

      const messages =
        await logChannel.messages.fetch({
          limit: 100,
          ...(before ? { before } : {})
        });

      if (!messages.size) break;

      for (const message of messages.values()) {

        for (const embed of message.embeds) {

          if (
            !embed.title?.includes(
              'PUNIÇÃO REGISTRADA'
            )
          ) {
            continue;
          }

          const playerField =
            embed.fields?.find(
              field =>
                field.name === '👤 Jogador'
            );

          const identifierField =
            embed.fields?.find(
              field =>
                field.name === '🆔 Identificador'
            );

          const player =
            playerField?.value || '';

          const identifier =
            identifierField?.value || '';

          const matches =
            player
              .toLowerCase()
              .includes(search) ||
            identifier
              .toLowerCase()
              .includes(search);

          if (!matches) continue;

          punishments.push({
            embed,
            createdTimestamp:
              message.createdTimestamp
          });
        }
      }

      before = messages.last().id;

      if (messages.size < 100) {
        break;
      }
    }

    if (!punishments.length) {

      return interaction.editReply(
        `✅ Nenhuma punição encontrada para **${interaction.options.getString('jogador')}**.`
      );

    }

    punishments.sort(
      (a, b) =>
        b.createdTimestamp -
        a.createdTimestamp
    );

    const first =
      punishments[0].embed;

    const player =
      first.fields?.find(
        field =>
          field.name === '👤 Jogador'
      )?.value ||
      interaction.options.getString(
        'jogador'
      );

    const identifier =
      first.fields?.find(
        field =>
          field.name ===
          '🆔 Identificador'
      )?.value ||
      'Não informado';

    const counts = {
      advertencia: 0,
      kick: 0,
      temporario: 0,
      permanente: 0
    };

    for (const punishment of punishments) {

      const type =
        punishment.embed.fields?.find(
          field =>
            field.name === '⚖️ Punição'
        )?.value || '';

      if (
        type.includes('Advertência')
      ) {
        counts.advertencia++;
      }

      if (type.includes('Kick')) {
        counts.kick++;
      }

      if (
        type.includes('Ban temporário')
      ) {
        counts.temporario++;
      }

      if (
        type.includes('Ban permanente')
      ) {
        counts.permanente++;
      }
    }

    // Discord limita embeds, então mostramos
    // as 10 punições mais recentes.
    const recent =
      punishments
        .slice(0, 10)
        .map((punishment, index) => {

          const embed =
            punishment.embed;

          const id =
            embed.title?.match(
              /PUN-\d+/
            )?.[0] ||
            'PUN-????';

          const type =
            embed.fields?.find(
              field =>
                field.name ===
                '⚖️ Punição'
            )?.value ||
            'Não informado';

          const duration =
            embed.fields?.find(
              field =>
                field.name ===
                '⏱️ Duração'
            )?.value ||
            'Não informado';

          const reason =
            embed.fields?.find(
              field =>
                field.name ===
                '📝 Motivo'
            )?.value ||
            'Não informado';

          const staff =
            embed.fields?.find(
              field =>
                field.name ===
                '🛡️ Staff responsável'
            )?.value ||
            'Não informado';

          const timestamp =
            Math.floor(
              punishment.createdTimestamp /
              1000
            );

          return (
            `**${index + 1}. ${id} — ${type}**\n` +
            `⏱️ ${duration}\n` +
            `📝 ${reason}\n` +
            `🛡️ ${staff}\n` +
            `📅 <t:${timestamp}:d>`
          );

        })
        .join('\n\n');

    const result =
      new EmbedBuilder()

        .setColor(0x8e44ad)

        .setTitle(
          `📋 HISTÓRICO — ${player}`
        )

        .setDescription(
          recent
        )

        .addFields(
          {
            name: '🆔 Identificador',
            value: identifier,
            inline: true
          },

          {
            name: '⚖️ Total de punições',
            value:
              String(
                punishments.length
              ),
            inline: true
          },

          {
            name: '🟨 Advertências',
            value:
              String(
                counts.advertencia
              ),
            inline: true
          },

          {
            name: '👢 Kicks',
            value:
              String(
                counts.kick
              ),
            inline: true
          },

          {
            name: '⏱️ Bans temporários',
            value:
              String(
                counts.temporario
              ),
            inline: true
          },

          {
            name: '🔨 Bans permanentes',
            value:
              String(
                counts.permanente
              ),
            inline: true
          }
        )

        .setFooter({
          text:
            punishments.length > 10
              ? `Brasil Mega Lite • Exibindo as 10 mais recentes de ${punishments.length}`
              : 'Brasil Mega Lite • Sistema de Punições'
        })

        .setTimestamp();

    await interaction.editReply({
      embeds: [result]
    });

  } catch (error) {

    console.error(
      'Erro ao consultar histórico:',
      error
    );

    await interaction.editReply(
      '❌ Ocorreu um erro ao consultar o histórico.'
    );

  }
}
