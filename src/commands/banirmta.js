
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import {
  createMtaPunishment,
  getMtaPunishment
} from '../services/mtaPunishmentQueue.js';

const FOUNDER_ROLE = '1554346778801995866';
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

  try {
    const { id } = await createMtaPunishment({
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

    for (let i = 0; i < 24; i++) {
      await sleep(2000);

      const job = getMtaPunishment(id);

      if (job?.status === 'done' || job?.status === 'failed') {
        const result = job.result;

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

    return interaction.editReply({
      content:
        '⏳ MTA não confirmou a execução dentro do prazo. ' +
        '**Não repita o comando.** Consulte os registros. ' +
        `ID: \`${id}\`.`
    });

  } catch (error) {
    console.error('[BML banirmta]', error);

    return interaction.editReply({
      content:
        '❌ Não foi possível registrar ou confirmar o comando. ' +
        'Verifique os logs antes de tentar novamente.'
    });
  }
}
