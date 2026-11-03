
import {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder
} from 'discord.js';

import {
  createMtaPunishment,
  getMtaPunishment
} from '../services/mtaPunishmentQueue.js';

const FOUNDER_ROLE = '1554346778801995866';
const LOG_CHANNEL_ID = '1562311998564208670';

const MAX_MINUTES = 365 * 24 * 60;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const data = new SlashCommandBuilder()
  .setName('banirmta')
  .setDescription('Banir jogador no MTA (exclusivo Fundador)')

  .addStringOption(option =>
    option
      .setName('tipo')
      .setDescription('Localizar por ID online ou conta cadastrada')
      .setRequired(true)
      .addChoices(
        { name: 'ID online', value: 'id' },
        { name: 'Conta', value: 'account' }
      )
  )

  .addStringOption(option =>
    option
      .setName('alvo')
      .setDescription('ID numérico ou nome da conta')
      .setRequired(true)
      .setMaxLength(64)
  )

  .addStringOption(option =>
    option
      .setName('duracao')
      .setDescription('Escolha minutos, horas ou permanente')
      .setRequired(true)
      .addChoices(
        { name: 'Minutos', value: 'minutos' },
        { name: 'Horas', value: 'horas' },
        { name: 'Permanente', value: 'permanente' }
      )
  )

  .addStringOption(option =>
    option
      .setName('motivo')
      .setDescription('Motivo do banimento')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(220)
  )

  .addIntegerOption(option =>
    option
      .setName('quantidade')
      .setDescription('Quantidade de minutos ou horas; deixe vazio se for permanente')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(MAX_MINUTES)
  );

function formatDuration(minutes) {
  if (minutes === 0) return 'Permanente';

  if (minutes % 1440 === 0) {
    return `${minutes / 1440} dia(s)`;
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60} hora(s)`;
  }

  return `${minutes} minuto(s)`;
}

async function sendBanLog(interaction, details) {
  try {
    const channel = await interaction.client.channels.fetch(
      LOG_CHANNEL_ID
    );

    if (!channel?.isTextBased() || typeof channel.send !== 'function') {
      console.error('[BML Logs] Canal de logs indisponivel.');
      return;
    }

    const {
      targetType,
      target,
      minutes,
      reason,
      jobId,
      result,
      status
    } = details;

    const success = status === 'done' && result?.ok === true;
    const failed = status === 'failed' || (
      status === 'done' && result?.ok === false
    );

    const title = success
      ? '🔨 BANIMENTO MTA APLICADO'
      : failed
        ? '❌ FALHA NO BANIMENTO MTA'
        : '⏳ BANIMENTO MTA SEM CONFIRMAÇÃO';

    const color = success
      ? 0xe74c3c
      : failed
        ? 0x95a5a6
        : 0xf1c40f;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .addFields(
        {
          name: '🎮 Jogador / Alvo',
          value: `\`${target}\``,
          inline: true
        },
        {
          name: '🔎 Tipo de identificação',
          value: targetType === 'id' ? 'ID online' : 'Conta MTA',
          inline: true
        },
        {
          name: '⏱️ Duração',
          value: formatDuration(minutes),
          inline: true
        },
        {
          name: '📝 Motivo',
          value: reason
        },
        {
          name: '👑 Responsável',
          value: `<@${interaction.user.id}>`,
          inline: true
        },
        {
          name: '📋 Protocolo',
          value: result?.protocol
            ? `#${result.protocol}`
            : 'Não informado',
          inline: true
        },
        {
          name: '📡 Resultado do MTA',
          value: result?.message ||
            'Aguardando confirmação. Não repetir automaticamente.'
        },
        {
          name: '🔐 ID da operação',
          value: `\`${jobId}\``
        }
      )
      .setFooter({
        text: 'Brasil Mega Lite • Registro de punições MTA'
      })
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      allowedMentions: {
        parse: []
      }
    });

    console.log(
      `[BML Logs] Registro de banimento enviado: ${jobId}`
    );

  } catch (error) {
    console.error('[BML Logs] Erro ao enviar log de banimento:', error);
  }
}

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: '❌ Use este comando no servidor Discord.',
      flags: MessageFlags.Ephemeral
    });
  }

  const member = await interaction.guild.members.fetch(
    interaction.user.id
  );

  if (!member.roles.cache.has(FOUNDER_ROLE)) {
    return interaction.reply({
      content: '❌ Apenas o cargo Fundador pode usar este comando.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (process.env.MTA_PUNISHMENTS_ENABLED !== 'true') {
    return interaction.reply({
      content: '🔒 Banimentos pelo Discord estão desativados.',
      flags: MessageFlags.Ephemeral
    });
  }

  const targetType = interaction.options.getString('tipo', true);
  const target = interaction.options.getString('alvo', true).trim();
  const duration = interaction.options.getString('duracao', true);
  const quantity = interaction.options.getInteger('quantidade');
  const reason = interaction.options.getString('motivo', true).trim();

  if (
    (targetType === 'id' && !/^\d{1,10}$/.test(target)) ||
    (targetType === 'account' && (!target || target.length > 64)) ||
    reason.length < 3
  ) {
    return interaction.reply({
      content: '❌ Alvo ou motivo inválido.',
      flags: MessageFlags.Ephemeral
    });
  }

  let minutes;

  if (duration === 'permanente') {
    if (quantity !== null) {
      return interaction.reply({
        content: '❌ Para banimento permanente, deixe a quantidade vazia.',
        flags: MessageFlags.Ephemeral
      });
    }

    minutes = 0;

  } else if (duration === 'minutos' || duration === 'horas') {
    if (!Number.isInteger(quantity) || quantity < 1) {
      return interaction.reply({
        content: '❌ Informe uma quantidade válida de minutos ou horas.',
        flags: MessageFlags.Ephemeral
      });
    }

    minutes = duration === 'horas'
      ? quantity * 60
      : quantity;

    if (minutes > MAX_MINUTES) {
      return interaction.reply({
        content: '❌ O tempo máximo permitido é de 365 dias (8.760 horas).',
        flags: MessageFlags.Ephemeral
      });
    }

  } else {
    return interaction.reply({
      content: '❌ Tipo de duração inválido.',
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  let jobId = null;

  try {
    const created = await createMtaPunishment({
      action: 'ban',
      payload: {
        targetType,
        target,
        minutes,
        reason
      },
      actor: {
        id: interaction.user.id
      }
    });

    jobId = created.id;

    for (let i = 0; i < 24; i++) {
      await sleep(2000);

      const job = getMtaPunishment(jobId);

      if (job?.status === 'done' || job?.status === 'failed') {
        const result = job.result;

        await sendBanLog(interaction, {
          targetType,
          target,
          minutes,
          reason,
          jobId,
          result,
          status: job.status
        });

        return interaction.editReply({
          content:
            `${result?.ok ? '✅' : '❌'} ` +
            `${result?.message || 'Resultado sem detalhes.'}` +
            (result?.protocol
              ? `\nProtocolo: #${result.protocol}`
              : '')
        });
      }
    }

    // Resultado desconhecido: nunca afirmar que a punição falhou.
    await sendBanLog(interaction, {
      targetType,
      target,
      minutes,
      reason,
      jobId,
      result: null,
      status: 'pending'
    });

    return interaction.editReply({
      content:
        '⏳ MTA não confirmou a execução dentro do prazo. ' +
        '**Não repita o comando.** Consulte os registros. ' +
        `ID: \`${jobId}\`.`
    });

  } catch (error) {
    console.error('[BML banirmta]', error);

    return interaction.editReply({
      content:
        '❌ Não foi possível registrar ou confirmar o comando. ' +
        'Verifique os logs antes de tentar novamente.' +
        (jobId ? `\nID: \`${jobId}\`` : '')
    });
  }
}
