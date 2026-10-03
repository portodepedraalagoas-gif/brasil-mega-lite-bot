import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';

const REPORT_ROLE_ID = '1555910336820027472';
const PUNISHMENT_LOG_CHANNEL_ID = '1555949299597049936';

export const data = new SlashCommandBuilder()
  .setName('punir')
  .setDescription('Registra uma punição no histórico do Brasil Mega Lite.')

  // OBRIGATÓRIOS PRIMEIRO
  .addStringOption(option =>
    option
      .setName('jogador')
      .setDescription('Nome do jogador punido')
      .setRequired(true)
  )

  .addStringOption(option =>
    option
      .setName('punicao')
      .setDescription('Tipo da punição aplicada')
      .setRequired(true)
      .addChoices(
        {
          name: '🟨 Advertência',
          value: 'advertencia'
        },
        {
          name: '👢 Kick',
          value: 'kick'
        },
        {
          name: '⏱️ Ban temporário',
          value: 'ban_temporario'
        },
        {
          name: '🔨 Ban permanente',
          value: 'ban_permanente'
        }
      )
  )

  .addStringOption(option =>
    option
      .setName('motivo')
      .setDescription('Motivo da punição')
      .setRequired(true)
      .setMaxLength(1000)
  )

  // OPCIONAIS DEPOIS
  .addStringOption(option =>
    option
      .setName('identificador')
      .setDescription('ID, conta ou serial do jogador')
      .setRequired(false)
  )

  .addStringOption(option =>
    option
      .setName('duracao')
      .setDescription('Duração da punição. Ex: 3 dias, 7 dias, 30 dias')
      .setRequired(false)
  )

  .addStringOption(option =>
    option
      .setName('denuncia')
      .setDescription('ID da denúncia relacionada, se existir. Ex: DEN-0042')
      .setRequired(false)
  );


function punishmentName(type) {
  switch (type) {
    case 'advertencia':
      return '🟨 Advertência';

    case 'kick':
      return '👢 Kick';

    case 'ban_temporario':
      return '⏱️ Ban temporário';

    case 'ban_permanente':
      return '🔨 Ban permanente';

    default:
      return type;
  }
}


export async function getNextPunishmentId(channel) {
  const messages = await channel.messages.fetch({
    limit: 100
  });

  let highest = 0;

  for (const message of messages.values()) {
    for (const embed of message.embeds) {
      const match = embed.title?.match(/PUN-(\d+)/);

      if (!match) continue;

      const number = Number(match[1]);

      if (number > highest) {
        highest = number;
      }
    }
  }

  return `PUN-${String(highest + 1).padStart(4, '0')}`;
}


export async function execute(interaction) {
  const authorized =
    interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    ) ||
    interaction.member?.roles?.cache?.has(
      REPORT_ROLE_ID
    );

  if (!authorized) {
    return interaction.reply({
      content:
        '❌ Apenas a **Equipe de Denúncias** ou administradores podem registrar punições.',
      ephemeral: true
    });
  }

  await interaction.deferReply({
    ephemeral: true
  });

  try {
    const jogador =
      interaction.options.getString(
        'jogador',
        true
      );

    const punicao =
      interaction.options.getString(
        'punicao',
        true
      );

    const motivo =
      interaction.options.getString(
        'motivo',
        true
      );

    const identificador =
      interaction.options.getString(
        'identificador'
      );

    const duracao =
      interaction.options.getString(
        'duracao'
      );

    const denuncia =
      interaction.options.getString(
        'denuncia'
      );

    if (
      punicao === 'ban_temporario' &&
      !duracao
    ) {
      return interaction.editReply(
        '❌ Para um **ban temporário**, informe a duração da punição.'
      );
    }

    const logChannel =
      await interaction.guild.channels.fetch(
        PUNISHMENT_LOG_CHANNEL_ID
      );

    if (!logChannel?.isTextBased()) {
      return interaction.editReply(
        '❌ O canal de logs de punições não foi encontrado.'
      );
    }

    const punishmentId =
      await getNextPunishmentId(
        logChannel
      );

    // ==========================================
    // VERIFICAR REINCIDÊNCIA PELO NOME DO JOGADOR
    // ==========================================

    let previousPunishments = [];

    const messages =
      await logChannel.messages.fetch({
        limit: 100
      });

    const jogadorNormalizado =
      jogador.trim().toLowerCase();

    for (const message of messages.values()) {
      for (const oldEmbed of message.embeds) {

        const jogadorField =
          oldEmbed.fields?.find(
            field =>
              field.name.includes('Jogador')
          );

        if (!jogadorField?.value) {
          continue;
        }

        const jogadorAnterior =
          jogadorField.value
            .trim()
            .toLowerCase();

        if (
          jogadorAnterior === jogadorNormalizado
        ) {
          previousPunishments.push(
            oldEmbed.title ||
            'Punição anterior'
          );
        }
      }
    }

    const reincidencia =
      previousPunishments.length;

    // ==========================================
    // CRIAR EMBED DA PUNIÇÃO
    // ==========================================

    const embed =
      new EmbedBuilder()

        .setColor(0xe74c3c)

        .setTitle(
          `🔨 PUNIÇÃO REGISTRADA — ${punishmentId}`
        )

        .addFields(
          {
            name: '👤 Jogador',
            value: jogador,
            inline: true
          },

          {
            name: '🆔 Identificador',
            value:
              identificador ||
              'Não informado',
            inline: true
          },

          {
            name: '⚖️ Punição',
            value:
              punishmentName(
                punicao
              ),
            inline: true
          },

          {
            name: '⏱️ Duração',
            value:
              punicao === 'ban_permanente'
                ? 'Permanente'
                : duracao ||
                  'Não se aplica',
            inline: true
          },

          {
            name: '🛡️ Staff responsável',
            value:
              `${interaction.user}`,
            inline: true
          },

          {
            name: '📡 Origem',
            value: 'MANUAL',
            inline: true
          },

          {
            name: '🚨 Denúncia relacionada',
            value:
              denuncia ||
              'Nenhuma',
            inline: true
          },

          {
            name: '⚠️ Reincidência',
            value:
              reincidencia > 0
                ? `🚨 REINCIDENTE — ${reincidencia} punição(ões) anterior(es)`
                : '✅ Nenhuma punição anterior',
            inline: false
          },

          {
            name: '📝 Motivo',
            value: motivo,
            inline: false
          }
        )

        .setFooter({
          text:
            'Brasil Mega Lite • Sistema de Punições'
        })

        .setTimestamp();

    await logChannel.send({
      embeds: [embed]
    });

    await interaction.editReply(
      `✅ Punição **${punishmentId}** registrada com sucesso em <#${PUNISHMENT_LOG_CHANNEL_ID}>.`
    );

  } catch (error) {
    console.error(
      'Erro ao registrar punição:',
      error
    );

    await interaction.editReply(
      '❌ Ocorreu um erro ao registrar a punição.'
    );
  }
}
