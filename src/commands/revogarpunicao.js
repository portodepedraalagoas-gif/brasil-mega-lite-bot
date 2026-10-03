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

  // SOMENTE O CARGO DE DENÚNCIAS
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

    const punishmentId =
      interaction.options
        .getString('punicao', true)
        .trim()
        .toUpperCase();

    const motivo =
      interaction.options
        .getString('motivo', true)
        .trim();

    // VALIDA O FORMATO PUN-XXXX
    if (!/^PUN-\d+$/.test(punishmentId)) {
      return interaction.editReply(
        '❌ ID inválido. Use um ID como `PUN-0014`.'
      );
    }

    const logChannel =
      await interaction.guild.channels.fetch(
        PUNISHMENT_LOG_CHANNEL_ID
      );

    if (!logChannel?.isTextBased()) {
      return interaction.editReply(
        '❌ O canal de punições não foi encontrado.'
      );
    }

    // BUSCAR PUNIÇÃO NAS ÚLTIMAS 100 MENSAGENS
    const messages =
      await logChannel.messages.fetch({
        limit: 100
      });

    let punishmentMessage = null;
    let punishmentEmbed = null;

    for (const message of messages.values()) {

      const embed =
        message.embeds?.find(embed =>
          embed.title?.includes(punishmentId)
        );

      if (embed) {
        punishmentMessage = message;
        punishmentEmbed = embed;
        break;
      }
    }

    if (
      !punishmentMessage ||
      !punishmentEmbed
    ) {
      return interaction.editReply(
        `❌ Não encontrei a punição **${punishmentId}** nas últimas 100 mensagens do histórico.`
      );
    }

    // IMPEDE REVOGAÇÃO DUPLA
    const alreadyRevoked =
      punishmentEmbed.fields?.some(
        field =>
          field.name.includes('Status') &&
          field.value.includes('REVOGADA')
      );

    if (alreadyRevoked) {
      return interaction.editReply(
        `❌ A punição **${punishmentId}** já foi revogada.`
      );
    }

    // COPIA OS CAMPOS ORIGINAIS
    const fields =
      punishmentEmbed.fields.map(field => ({
        name: field.name,
        value: field.value,
        inline: field.inline
      }));

    // ADICIONA STATUS DA REVOGAÇÃO
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

    const revokedEmbed =
      new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle(
          `↩️ PUNIÇÃO REVOGADA — ${punishmentId}`
        )
        .addFields(fields)
        .setFooter({
          text:
            'Brasil Mega Lite • Sistema de Punições'
        })
        .setTimestamp();

    // EDITA A PUNIÇÃO ORIGINAL
    await punishmentMessage.edit({
      embeds: [revokedEmbed]
    });

    await interaction.editReply(
      `✅ A punição **${punishmentId}** foi revogada com sucesso.`
    );

  } catch (error) {

    console.error(
      'Erro ao revogar punição:',
      error
    );

    await interaction.editReply(
      '❌ Ocorreu um erro ao revogar a punição.'
    );
  }
}
