import {
  SlashCommandBuilder,
  EmbedBuilder
} from 'discord.js';

const REPORT_ROLE_ID = '1555910336820027472';
const PUNISHMENT_LOG_CHANNEL_ID = '1555949299597049936';

export const data = new SlashCommandBuilder()
  .setName('revogarpunicao')
  .setDescription('Revoga uma punição registrada no histórico.')

  .addStringOption(option =>
    option
      .setName('punicao')
      .setDescription('ID da punição. Ex: PUN-0014')
      .setRequired(true)
  )

  .addStringOption(option =>
    option
      .setName('motivo')
      .setDescription('Motivo da revogação')
      .setRequired(true)
      .setMaxLength(1000)
  );


export async function execute(interaction) {

  // ==========================================
  // SOMENTE EQUIPE DE DENÚNCIAS
  // ==========================================

  const authorized =
    interaction.member?.roles?.cache?.has(
      REPORT_ROLE_ID
    );

  if (!authorized) {
    return interaction.reply({
      content:
        '❌ Apenas a **Equipe de Denúncias** pode revogar punições.',
      ephemeral: true
    });
  }

  await interaction.deferReply({
    ephemeral: true
  });

  try {

    // ==========================================
    // PEGAR DADOS DO COMANDO
    // ==========================================

    const punishmentInput =
      interaction.options.getString(
        'punicao',
        true
      );

    const motivo =
      interaction.options
        .getString('motivo', true)
        .trim();

    // ==========================================
    // NORMALIZAR ID
    // ==========================================

    const punishmentId =
      punishmentInput
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');

    // Aceita:
    // PUN-0014
    // pun-0014
    // PUN0014
    // pun0014

    const idMatch =
      punishmentId.match(
        /^PUN-?(\d+)$/
      );

    if (!idMatch) {
      return interaction.editReply(
        `❌ ID inválido.\n\n` +
        `ID recebido pelo bot: \`${punishmentInput}\`\n\n` +
        `Use um ID como: \`PUN-0014\``
      );
    }

    // TRANSFORMA SEMPRE NO PADRÃO PUN-XXXX
    const normalizedPunishmentId =
      `PUN-${idMatch[1].padStart(4, '0')}`;

    // ==========================================
    // BUSCAR CANAL DE PUNIÇÕES
    // ==========================================

    const logChannel =
      await interaction.guild.channels.fetch(
        PUNISHMENT_LOG_CHANNEL_ID
      );

    if (!logChannel?.isTextBased()) {
      return interaction.editReply(
        '❌ O canal de punições não foi encontrado.'
      );
    }

    // ==========================================
    // BUSCAR PUNIÇÃO
    // ==========================================

    const messages =
      await logChannel.messages.fetch({
        limit: 100
      });

    let punishmentMessage = null;
    let punishmentEmbed = null;

    for (const message of messages.values()) {

      for (const embed of message.embeds) {

        if (
          embed.title?.includes(
            normalizedPunishmentId
          )
        ) {
          punishmentMessage = message;
          punishmentEmbed = embed;
          break;
        }
      }

      if (punishmentMessage) {
        break;
      }
    }

    // ==========================================
    // PUNIÇÃO NÃO ENCONTRADA
    // ==========================================

    if (
      !punishmentMessage ||
      !punishmentEmbed
    ) {
      return interaction.editReply(
        `❌ Não encontrei a punição **${normalizedPunishmentId}** nas últimas 100 mensagens do histórico.`
      );
    }

    // ==========================================
    // VERIFICAR SE JÁ FOI REVOGADA
    // ==========================================

    const alreadyRevoked =
      punishmentEmbed.fields?.some(
        field =>
          field.name
            ?.toLowerCase()
            .includes('status') &&
          field.value
            ?.toUpperCase()
            .includes('REVOGADA')
      );

    if (
      alreadyRevoked ||
      punishmentEmbed.title
        ?.toUpperCase()
        .includes('PUNIÇÃO REVOGADA')
    ) {
      return interaction.editReply(
        `❌ A punição **${normalizedPunishmentId}** já foi revogada.`
      );
    }

    // ==========================================
    // COPIAR CAMPOS DA PUNIÇÃO ORIGINAL
    // ==========================================

    const fields =
      punishmentEmbed.fields.map(
        field => ({
          name: field.name,
          value: field.value,
          inline: field.inline
        })
      );

    // ==========================================
    // ADICIONAR INFORMAÇÕES DA REVOGAÇÃO
    // ==========================================

    fields.push(
      {
        name: '📌 Status',
        value: '↩️ REVOGADA',
        inline: true
      },

      {
        name: '🛡️ Revogada por',
        value: `${interaction.user}`,
        inline: true
      },

      {
        name: '📝 Motivo da revogação',
        value: motivo,
        inline: false
      }
    );

    // ==========================================
    // CRIAR NOVO EMBED
    // ==========================================

    const revokedEmbed =
      new EmbedBuilder()

        .setColor(0x95a5a6)

        .setTitle(
          `↩️ PUNIÇÃO REVOGADA — ${normalizedPunishmentId}`
        )

        .addFields(fields)

        .setFooter({
          text:
            'Brasil Mega Lite • Sistema de Punições'
        })

        .setTimestamp();

    // ==========================================
    // EDITAR PUNIÇÃO ORIGINAL
    // ==========================================

    await punishmentMessage.edit({
      embeds: [revokedEmbed]
    });

    // ==========================================
    // CONFIRMAÇÃO
    // ==========================================

    await interaction.editReply(
      `✅ A punição **${normalizedPunishmentId}** foi revogada com sucesso.\n\n` +
      `📝 **Motivo:** ${motivo}`
    );

  } catch (error) {

    console.error(
      'Erro ao revogar punição:',
      error
    );

    if (
      interaction.deferred ||
      interaction.replied
    ) {
      await interaction.editReply(
        '❌ Ocorreu um erro ao revogar a punição.'
      ).catch(() => {});
    }
  }
}
