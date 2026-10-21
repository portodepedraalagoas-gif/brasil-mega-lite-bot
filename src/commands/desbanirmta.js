
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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const data = new SlashCommandBuilder()
  .setName('desbanirmta')
  .setDescription('Remover banimento do MTA (exclusivo Fundador)')
  .addStringOption(option =>
    option
      .setName('tipo')
      .setDescription('Identificar banimento')
      .setRequired(true)
      .addChoices(
        { name: 'Protocolo', value: 'protocol' },
        { name: 'Serial', value: 'serial' }
      )
  )
  .addStringOption(option =>
    option
      .setName('valor')
      .setDescription('Número do protocolo ou serial hexadecimal de 32 caracteres')
      .setRequired(true)
      .setMaxLength(32)
  )
  .addStringOption(option =>
    option
      .setName('motivo')
      .setDescription('Motivo da retirada')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(220)
  );

async function sendUnbanLog(interaction, details) {
  try {
    const channel = await interaction.client.channels.fetch(
      LOG_CHANNEL_ID
    );

    if (!channel?.isTextBased() || typeof channel.send !== 'function') {
      console.error('[BML Logs] Canal de logs indisponivel.');
      return;
    }

    const {
      type,
      value,
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
      ? '🔓 DESBANIMENTO MTA CONFIRMADO'
      : failed
        ? '❌ DESBANIMENTO MTA RECUSADO'
        : '⏳ DESBANIMENTO MTA SEM CONFIRMAÇÃO';

    const color = success
      ? 0x2ecc71
      : failed
        ? 0xe74c3c
        : 0xf1c40f;

    const identification = type === 'protocol'
      ? `Protocolo #${value}`
      : `Serial: ${value.toUpperCase()}`;

    const protocol = result?.protocol
      ? `#${result.protocol}`
      : type === 'protocol'
        ? `#${value} (informado no comando)`
        : 'Não informado';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .addFields(
        {
          name: '🎮 Identificação do banimento',
          value: identification
        },
        {
          name: '📋 Protocolo',
          value: protocol,
          inline: true
        },
        {
          name: '👑 Responsável',
          value: `<@${interaction.user.id}>`,
          inline: true
        },
        {
          name: '📝 Motivo da retirada',
          value: reason
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
      `[BML Logs] Registro de desbanimento enviado: ${jobId}`
    );

  } catch (error) {
    console.error(
      '[BML Logs] Erro ao enviar log de desbanimento:',
      error
    );
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
      content: '🔒 Desbanimentos pelo Discord estão desativados.',
      flags: MessageFlags.Ephemeral
    });
  }

  const type = interaction.options.getString('tipo', true);
  const value = interaction.options.getString('valor', true).trim();
  const reason = interaction.options.getString('motivo', true).trim();

  if (
    (
      type === 'protocol' &&
      (
        !/^[1-9]\d{0,9}$/.test(value) ||
        Number(value) > 2147483647
      )
    ) ||
    (
      type === 'serial' &&
      !/^[a-f\d]{32}$/i.test(value)
    ) ||
    !['protocol', 'serial'].includes(type) ||
    reason.length < 3
  ) {
    return interaction.reply({
      content: '❌ Protocolo, serial ou motivo inválido.',
      flags: MessageFlags.Ephemeral
    });
  }

  const payload = type === 'protocol'
    ? {
        protocol: Number(value),
        reason
      }
    : {
        serial: value.toUpperCase(),
        reason
      };

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  let jobId = null;

  try {
    const created = await createMtaPunishment({
      action: 'unban',
      payload,
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

        await sendUnbanLog(interaction, {
          type,
          value,
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

    // Não afirmar sucesso ou falha sem confirmação.
    await sendUnbanLog(interaction, {
      type,
      value,
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
    console.error('[BML desbanirmta]', error);

    return interaction.editReply({
      content:
        '❌ Não foi possível registrar ou confirmar o comando. ' +
        'Verifique os logs antes de tentar novamente.' +
        (jobId ? `\nID: \`${jobId}\`` : '')
    });
  }
}
