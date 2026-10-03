import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
 ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

import { config } from '../config.js';
import { getNextPunishmentId } from '../commands/punir.js';

const TICKET_LOG_CHANNEL_ID = '1555924703695339581';
const PUNISHMENT_LOG_CHANNEL_ID = '1555949299597049936';

const TYPE = {
  suporte: {
    label: 'Suporte / Dúvidas',
    emoji: '🛠️',
    roles: () => [config.staffRoleId]
  },

  financeiro: {
    label: 'Financeiro',
    emoji: '💰',
    roles: () => [config.financeRoleId]
  },

  denuncia: {
    label: 'Denúncia',
    emoji: '🚨',
    roles: () => [config.staffRoleId, config.reportRoleId]
  },
};

const hasRole = (i, id) =>
  Boolean(id && i.member?.roles?.cache?.has(id));

const canManage = (i, type) =>
  i.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
  TYPE[type]?.roles().some(id => hasRole(i, id));

const safeName = v =>
  v.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 35);


// ======================================================
// TRANSCRIPT / LOGS
// ======================================================

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function fetchAllMessages(channel) {
  const messages = [];
  let before;

  while (true) {
    const batch = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {})
    });

    if (!batch.size) break;

    messages.push(...batch.values());

    before = batch.last().id;

    if (batch.size < 100) break;
  }

  return messages.sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );
}

function buildTranscriptHtml(
  channel,
  messages,
  ownerId,
  type,
  closedBy
) {

  const messageHtml = messages.map(message => {

    const date = new Date(
      message.createdTimestamp
    ).toLocaleString('pt-BR', {
      timeZone: 'America/Maceio'
    });

    const avatar =
      message.author?.displayAvatarURL?.({
        extension: 'png',
        size: 64
      }) || '';

    const attachments =
      [...message.attachments.values()]
        .map(attachment => `
          <div class="attachment">
            📎 <a
              href="${escapeHtml(attachment.url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${escapeHtml(
                attachment.name || 'Abrir anexo'
              )}
            </a>
          </div>
        `)
        .join('');

    const embeds = message.embeds.length
      ? `
        <div class="embed-info">
          📋 ${message.embeds.length} embed(s)
          presente(s) nesta mensagem
        </div>
      `
      : '';

    return `
      <div class="message">

        ${
          avatar
            ? `<img class="avatar" src="${escapeHtml(avatar)}">`
            : ''
        }

        <div class="message-data">

          <div class="meta">

            <strong>
              ${escapeHtml(
                message.author?.tag ||
                message.author?.username ||
                'Desconhecido'
              )}
            </strong>

            <span>
              ${escapeHtml(date)}
            </span>

          </div>

          <div class="content">
            ${
              escapeHtml(
                message.content || ''
              ).replaceAll('\n', '<br>')
            }
          </div>

          ${attachments}

          ${embeds}

        </div>

      </div>
    `;
  }).join('\n');


  return `
<!DOCTYPE html>

<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
Brasil Mega Lite - ${escapeHtml(channel.name)}
</title>

<style>

body {
  margin: 0;
  padding: 30px;
  background: #111318;
  color: #eeeeee;
  font-family:
    Arial,
    Helvetica,
    sans-serif;
}

.container {
  max-width: 1000px;
  margin: auto;
}

.header {
  background: #1c1f27;
  border-left: 5px solid #8e44ad;
  padding: 22px;
  border-radius: 10px;
  margin-bottom: 20px;
}

.header h1 {
  margin-top: 0;
  color: #ffffff;
}

.info {
  color: #b8bcc8;
  margin: 6px 0;
}

.messages {
  background: #181b22;
  border-radius: 10px;
  overflow: hidden;
}

.message {
  display: flex;
  gap: 12px;
  padding: 15px;
  border-bottom:
    1px solid #292d37;
}

.message:last-child {
  border-bottom: none;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
}

.message-data {
  flex: 1;
  min-width: 0;
}

.meta {
  margin-bottom: 6px;
}

.meta strong {
  color: #ffffff;
}

.meta span {
  margin-left: 8px;
  color: #8e94a3;
  font-size: 12px;
}

.content {
  line-height: 1.45;
  word-break: break-word;
}

.attachment {
  margin-top: 8px;
}

.attachment a {
  color: #72a7ff;
  text-decoration: none;
}

.embed-info {
  margin-top: 8px;
  color: #bda7ff;
}

.footer {
  text-align: center;
  color: #777d8b;
  font-size: 12px;
  margin-top: 20px;
}

</style>

</head>

<body>

<div class="container">

  <div class="header">

    <h1>
      🦊 Brasil Mega Lite — Transcript
    </h1>

    <div class="info">
      <strong>Ticket:</strong>
      #${escapeHtml(channel.name)}
    </div>

    <div class="info">
      <strong>Setor:</strong>
      ${escapeHtml(
        TYPE[type]?.label ||
        type ||
        'Não identificado'
      )}
    </div>

    <div class="info">
      <strong>Criado por:</strong>
      ${escapeHtml(ownerId || 'Não identificado')}
    </div>

    <div class="info">
      <strong>Fechado por:</strong>
      ${escapeHtml(
        closedBy.tag ||
        closedBy.username
      )}
    </div>

    <div class="info">
      <strong>Total de mensagens:</strong>
      ${messages.length}
    </div>

  </div>

  <div class="messages">

    ${messageHtml}

  </div>

  <div class="footer">
    Brasil Mega Lite • Sistema de Atendimento
  </div>

</div>

</body>

</html>
`;
}


async function archiveTicket(
  interaction,
  type,
  ownerId
) {

  const logChannel =
    await interaction.guild.channels.fetch(
      TICKET_LOG_CHANNEL_ID
    );

  if (!logChannel?.isTextBased()) {
    throw new Error(
      'Canal de logs de tickets inválido.'
    );
  }

  const messages =
    await fetchAllMessages(
      interaction.channel
    );

  const html =
    buildTranscriptHtml(
      interaction.channel,
      messages,
      ownerId,
      type,
      interaction.user
    );

  const transcript =
    new AttachmentBuilder(
      Buffer.from(html, 'utf8'),
      {
        name:
          `transcript-${interaction.channel.name}-${Date.now()}.html`
      }
    );

  const logEmbed =
    new EmbedBuilder()

      .setColor(0x8e44ad)

      .setTitle(
        '📜 TICKET ENCERRADO'
      )

      .setDescription(
        'O histórico completo do atendimento está anexado abaixo.'
      )

      .addFields(

        {
          name: '👤 Criado por',
          value: ownerId
            ? `<@${ownerId}>`
            : 'Não identificado',
          inline: true
        },

        {
          name: '🛡️ Fechado por',
          value: `${interaction.user}`,
          inline: true
        },

        {
          name: '📂 Setor',
          value:
            TYPE[type]?.label ||
            type ||
            'Não identificado',
          inline: true
        },

        {
          name: '🕐 Aberto em',
          value:
            `<t:${Math.floor(
              interaction.channel.createdTimestamp / 1000
            )}:F>`,
          inline: true
        },

        {
          name: '💬 Mensagens',
          value: String(messages.length),
          inline: true
        },

        {
          name: '📁 Canal',
          value:
            `#${interaction.channel.name}`,
          inline: true
        }

      )

      .setFooter({
        text:
          'Brasil Mega Lite • Sistema de Atendimento'
      })

      .setTimestamp();

  await logChannel.send({
    embeds: [logEmbed],
    files: [transcript]
  });
}


// ======================================================
// BOTÕES DO TICKET
// ======================================================

function ticketButtons(type) {

  const row =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `ticket_claim:${type}`
          )
          .setLabel('Assumir')
          .setEmoji('🛡️')
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            `ticket_close:${type}`
          )
          .setLabel('Fechar')
          .setEmoji('🔒')
          .setStyle(
            ButtonStyle.Secondary
          )

      );

  if (type === 'denuncia') {

    row.addComponents(

      new ButtonBuilder()
        .setCustomId(
          'report_accept'
        )
        .setLabel('Aceitar')
        .setEmoji('✅')
        .setStyle(
          ButtonStyle.Success
        ),

      new ButtonBuilder()
        .setCustomId(
          'report_deny'
        )
        .setLabel('Negar')
        .setEmoji('❌')
        .setStyle(
          ButtonStyle.Danger
        )

    );

  }

  return row;
}


// ======================================================
// PAINEL
// ======================================================

export async function publishTicketPanel(client) {

  const channel =
    await client.channels.fetch(
      config.ticketPanelChannelId
    );

  if (!channel?.isTextBased()) {
    throw new Error(
      'Canal de tickets inválido'
    );
  }

  const embed =
    new EmbedBuilder()

      .setColor(0x8e44ad)

      .setTitle(
        '🎫 CENTRAL DE ATENDIMENTO — BRASIL MEGA LITE'
      )

      .setDescription(
        'Selecione o setor desejado.\n\n' +
        '🛠️ **Suporte / Dúvidas** — ajuda geral.\n' +
        '💰 **Financeiro** — pagamentos e compras.\n' +
        '🚨 **Denúncia** — denúncias de jogadores com provas.\n\n' +
        'Abra apenas um ticket por assunto.'
      )

      .setFooter({
        text:
          'Brasil Mega Lite • Sistema de Atendimento'
      });

  const row =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            'ticket_open:suporte'
          )
          .setLabel(
            'Suporte / Dúvidas'
          )
          .setEmoji('🛠️')
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            'ticket_open:financeiro'
          )
          .setLabel(
            'Financeiro'
          )
          .setEmoji('💰')
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            'ticket_open:denuncia'
          )
          .setLabel(
            'Denúncia'
          )
          .setEmoji('🚨')
          .setStyle(
            ButtonStyle.Danger
          )

      );

  await channel.send({
    embeds: [embed],
    components: [row]
  });
}


// ======================================================
// MODAL DE ABERTURA
// ======================================================

function openModal(type) {

  const modal =
    new ModalBuilder()

      .setCustomId(
        `ticket_modal:${type}`
      )

      .setTitle(
        type === 'denuncia'
          ? 'Abrir denúncia'
          : `Abrir ${TYPE[type].label}`
      );

  const rows = [];

  if (type === 'denuncia') {

    rows.push(

      new ActionRowBuilder()
        .addComponents(
          new TextInputBuilder()
            .setCustomId(
              'denunciado'
            )
            .setLabel(
              'Nome/ID do jogador denunciado'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setMaxLength(100)
        ),

      new ActionRowBuilder()
        .addComponents(
          new TextInputBuilder()
            .setCustomId(
              'motivo'
            )
            .setLabel(
              'Motivo da denúncia'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setMaxLength(150)
        ),

      new ActionRowBuilder()
        .addComponents(
          new TextInputBuilder()
            .setCustomId(
              'descricao'
            )
            .setLabel(
              'Descreva o ocorrido'
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setRequired(true)
            .setMaxLength(1000)
        ),

      new ActionRowBuilder()
        .addComponents(
          new TextInputBuilder()
            .setCustomId(
              'provas'
            )
            .setLabel(
              'Provas (links de imagem/vídeo)'
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setRequired(true)
            .setMaxLength(1000)
        )

    );

  } else {

    rows.push(

      new ActionRowBuilder()
        .addComponents(
          new TextInputBuilder()
            .setCustomId(
              'assunto'
            )
            .setLabel('Assunto')
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setMaxLength(150)
        ),

      new ActionRowBuilder()
        .addComponents(
          new TextInputBuilder()
            .setCustomId(
              'descricao'
            )
            .setLabel(
              'Explique como podemos ajudar'
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setRequired(true)
            .setMaxLength(1200)
        )

    );

  }

  return modal.addComponents(
    ...rows
  );
}


// ======================================================
// VERIFICA TICKET EXISTENTE
// ======================================================

async function existingTicket(
  guild,
  userId,
  type
) {

  await guild.channels.fetch();

  return guild.channels.cache.find(
    ch =>
      ch.parentId ===
        config.ticketCategoryId &&

      ch.topic?.includes(
        `owner=${userId}`
      ) &&

      ch.topic?.includes(
        `type=${type}`
      )
  );
}


// ======================================================
// CRIA TICKET
// ======================================================

async function createTicket(
  interaction,
  type
) {

  const old =
    await existingTicket(
      interaction.guild,
      interaction.user.id,
      type
    );

  if (old) {

    return interaction.reply({
      content:
        `❌ Você já possui um ticket de **${TYPE[type].label}** aberto: ${old}`,
      ephemeral: true
    });

  }

  const roleIds =
    [
      ...new Set(
        TYPE[type]
          .roles()
          .filter(Boolean)
      )
    ];

  const channel =
    await interaction.guild.channels.create({

      name:
        `${type}-${safeName(
          interaction.user.username
        )}`,

      type:
        ChannelType.GuildText,

      parent:
        config.ticketCategoryId,

      topic:
        `BML ticket | owner=${interaction.user.id} | type=${type}`,

      permissionOverwrites: [

        {
          id:
            interaction.guild.roles.everyone.id,

          deny: [
            PermissionFlagsBits.ViewChannel
          ]
        },

        {
          id:
            interaction.user.id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles
          ]
        },

        ...roleIds.map(id => ({
          id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles
          ]

        }))

      ]

    });


  const embed =
    new EmbedBuilder()

      .setColor(
        type === 'denuncia'
          ? 0xe74c3c
          : type === 'financeiro'
            ? 0x2ecc71
            : 0x3498db
      )

      .setTitle(
        `${TYPE[type].emoji} ${TYPE[type].label} — ${interaction.user.username}`
      )

      .setDescription(
        `Ticket aberto por ${interaction.user}.`
      )

      .setTimestamp();


  if (type === 'denuncia') {

    embed.addFields(

      {
        name:
          '👤 Denunciado',

        value:
          interaction.fields
            .getTextInputValue(
              'denunciado'
            )
      },

      {
        name:
          '🚨 Motivo',

        value:
          interaction.fields
            .getTextInputValue(
              'motivo'
            )
      },

      {
        name:
          '📝 Descrição',

        value:
          interaction.fields
            .getTextInputValue(
              'descricao'
            )
      },

      {
        name:
          '🔗 Provas',

        value:
          interaction.fields
            .getTextInputValue(
              'provas'
            )
      }

    );

  } else {

    embed.addFields(

      {
        name:
          '📌 Assunto',

        value:
          interaction.fields
            .getTextInputValue(
              'assunto'
            )
      },

      {
        name:
          '📝 Descrição',

        value:
          interaction.fields
            .getTextInputValue(
              'descricao'
            )
      }

    );

  }


  await channel.send({

    content:
      `${interaction.user} ` +
      roleIds
        .map(id => `<@&${id}>`)
        .join(' '),

    embeds: [embed],

    components: [
      ticketButtons(type)
    ],

    allowedMentions: {
      users: [
        interaction.user.id
      ],
      roles: roleIds
    }

  });


  await interaction.reply({

    content:
      `✅ Seu ticket foi criado: ${channel}`,

    ephemeral: true

  });

}


// ======================================================
// DECISÃO DA DENÚNCIA
// ======================================================

function decisionModal(decision) {

  const ok =
    decision === 'accept';

  return new ModalBuilder()

    .setCustomId(
      `report_decision:${decision}`
    )

    .setTitle(
      ok
        ? 'Aceitar denúncia'
        : 'Negar denúncia'
    )

    .addComponents(

      new ActionRowBuilder()
        .addComponents(

          new TextInputBuilder()

            .setCustomId(
              'decisao'
            )

            .setLabel(
              ok
                ? 'Motivo / punição aplicada'
                : 'Motivo da recusa'
            )

            .setStyle(
              TextInputStyle.Paragraph
            )

            .setRequired(true)

            .setMaxLength(1000)

        )

    );
}


async function decide(
  interaction,
  decision
) {

  if (
    !hasRole(
      interaction,
      config.reportRoleId
    ) &&
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    )
  ) {

    return interaction.reply({
      content:
        '❌ Apenas a equipe de denúncias pode decidir.',
      ephemeral: true
    });

  }


  if (
    !interaction.channel?.topic?.includes(
      'type=denuncia'
    )
  ) {

    return interaction.reply({
      content:
        '❌ Este canal não é uma denúncia.',
      ephemeral: true
    });

  }


  if (
    interaction.channel.topic.includes(
      'decision='
    )
  ) {

    return interaction.reply({
      content:
        '❌ Esta denúncia já recebeu uma decisão.',
      ephemeral: true
    });

  }


  const ownerId =
    interaction.channel.topic
      .match(/owner=(\d+)/)?.[1] ||
    '0';


  const accepted =
    decision === 'accept';


  const targetId =
    accepted
      ? config.reportAcceptedChannelId
      : config.reportDeniedChannelId;


  const target =
    await interaction.guild.channels.fetch(
      targetId
    );


  const messages =
    await interaction.channel.messages.fetch({
      limit: 20
    });


  const original =
    messages
      .find(
        m =>
          m.author.id ===
            interaction.client.user.id &&
          m.embeds.length
      )
      ?.embeds?.[0];


  const result =
    new EmbedBuilder()

      .setColor(
        accepted
          ? 0x2ecc71
          : 0xe74c3c
      )

      .setTitle(
        accepted
          ? '✅ DENÚNCIA ACEITA'
          : '❌ DENÚNCIA NEGADA'
      )

      .addFields(

        {
          name:
            '👤 Denunciante',

          value:
            `<@${ownerId}>`,

          inline: true
        },

        {
          name:
            '🛡️ Analisada por',

          value:
            `${interaction.user}`,

          inline: true
        },

        {
          name:
            accepted
              ? '⚖️ Decisão / Punição'
              : '📝 Motivo da recusa',

          value:
            interaction.fields
              .getTextInputValue(
                'decisao'
              )
        }

      )

      .setFooter({
        text:
          `Ticket: #${interaction.channel.name}`
      })

      .setTimestamp();


  for (
    const name of [
      '👤 Denunciado',
      '🚨 Motivo',
      '📝 Descrição',
      '🔗 Provas'
    ]
  ) {

    const field =
      original?.fields?.find(
        x => x.name === name
      );

    if (field) {

      result.addFields({
        name: field.name,
        value: field.value
      });

    }

  }


const sentResult = await target.send({
  embeds: [result]
});

if (accepted) {
  const punishmentRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`report_punish:${sentResult.id}`)
      .setLabel('Registrar punição')
      .setEmoji('🔨')
      .setStyle(ButtonStyle.Danger)
  );

  await sentResult.edit({
    components: [punishmentRow]
  });
}


  await interaction.channel.setTopic(
    `${interaction.channel.topic} | decision=${
      accepted
        ? 'accepted'
        : 'denied'
    } | by=${interaction.user.id}`
  );


  await interaction.reply(
    `${
      accepted
        ? '✅ Denúncia aceita'
        : '❌ Denúncia negada'
    } por ${interaction.user}. Resultado enviado para <#${targetId}>.`
  );

}


// ======================================================
// INTERAÇÕES
// ======================================================

export async function handleTicketInteraction(
  interaction
) {

  if (interaction.isButton()) {
        // REGISTRAR PUNIÇÃO DE UMA DENÚNCIA ACEITA
    if (interaction.customId.startsWith('report_punish:')) {
      const REPORT_ROLE_ID = '1555910336820027472';

const authorized =
  interaction.member?.roles?.cache?.has(REPORT_ROLE_ID);

if (!authorized) {
  await interaction.reply({
    content: '❌ Apenas a **Equipe de Denúncias** pode registrar punições.',
    ephemeral: true
  });

  return true;
}
      const reportMessageId = interaction.customId.split(':')[1];
      const modal = new ModalBuilder()
        .setCustomId(`report_punish_modal:${reportMessageId}`)
        .setTitle('Registrar punição');

      const jogadorInput = new TextInputBuilder()
        .setCustomId('jogador')
        .setLabel('Nome do jogador')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Lucas_Maciel')
        .setRequired(true)
        .setMaxLength(100);

      const identificadorInput = new TextInputBuilder()
        .setCustomId('identificador')
        .setLabel('ID / Conta / Serial')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Opcional')
        .setRequired(false)
        .setMaxLength(100);

      const punicaoInput = new TextInputBuilder()
        .setCustomId('punicao')
        .setLabel('Punição')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('advertencia, kick, ban_temporario ou ban_permanente')
        .setRequired(true)
        .setMaxLength(50);

      const duracaoInput = new TextInputBuilder()
        .setCustomId('duracao')
        .setLabel('Duração')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 7 dias. Deixe vazio se não se aplicar')
        .setRequired(false)
        .setMaxLength(100);

      const motivoInput = new TextInputBuilder()
        .setCustomId('motivo')
        .setLabel('Motivo da punição')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Informe o motivo da punição')
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(jogadorInput),
        new ActionRowBuilder().addComponents(identificadorInput),
        new ActionRowBuilder().addComponents(punicaoInput),
        new ActionRowBuilder().addComponents(duracaoInput),
        new ActionRowBuilder().addComponents(motivoInput)
      );

      await interaction.showModal(modal);

      return true;
    }
    // ABRIR

    if (
      interaction.customId.startsWith(
        'ticket_open:'
      )
    ) {

      const type =
        interaction.customId.split(':')[1];

      if (!TYPE[type]) {
        return false;
      }

      await interaction.showModal(
        openModal(type)
      );

      return true;
    }


    // ASSUMIR

    if (
      interaction.customId.startsWith(
        'ticket_claim:'
      )
    ) {

      const type =
        interaction.customId.split(':')[1];

      if (
        !canManage(
          interaction,
          type
        )
      ) {

        await interaction.reply({
          content:
            '❌ Sem permissão para assumir.',
          ephemeral: true
        });

      } else {

        await interaction.reply(
          `🛡️ Atendimento assumido por ${interaction.user}.`
        );

      }

      return true;
    }


    // FECHAR + SALVAR TRANSCRIPT

    if (
      interaction.customId.startsWith(
        'ticket_close:'
      )
    ) {

      const type =
        interaction.customId.split(':')[1];


      const owner =
        interaction.channel?.topic
          ?.match(/owner=(\d+)/)?.[1];


      if (
        owner !==
          interaction.user.id &&
        !canManage(
          interaction,
          type
        )
      ) {

        await interaction.reply({

          content:
            '❌ Sem permissão para fechar.',

          ephemeral: true

        });

        return true;
      }


      await interaction.deferReply({
        ephemeral: true
      });


      try {

        await archiveTicket(
          interaction,
          type,
          owner
        );

      } catch (error) {

        console.error(
          'Falha ao salvar transcript:',
          error
        );


        await interaction.editReply(
          '❌ Não consegui salvar o transcript. O ticket NÃO foi apagado para evitar perda do histórico.'
        );


        return true;
      }


      await interaction.editReply(
        '✅ Transcript salvo nos logs. O ticket será excluído em 5 segundos.'
      );


      setTimeout(() => {

        interaction.channel
          .delete(
            `Ticket encerrado por ${interaction.user.tag}`
          )
          .catch(
            console.error
          );

      }, 5000);


      return true;
    }


    // ACEITAR / NEGAR DENÚNCIA

    if (
      interaction.customId ===
        'report_accept' ||
      interaction.customId ===
        'report_deny'
    ) {

      if (
        !hasRole(
          interaction,
          config.reportRoleId
        ) &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.Administrator
        )
      ) {

        await interaction.reply({

          content:
            '❌ Apenas a equipe de denúncias pode decidir.',

          ephemeral: true

        });

      } else {

        await interaction.showModal(

          decisionModal(
            interaction.customId ===
              'report_accept'
              ? 'accept'
              : 'deny'
          )

        );

      }

      return true;
    }

  }


  // MODAIS

  if (
    interaction.isModalSubmit()
  ) {
    // REGISTRAR PUNIÇÃO PELO MODAL DA DENÚNCIA
    if (
      interaction.customId.startsWith(
        'report_punish_modal:'
      )
    ) {
      const reportMessageId =
        interaction.customId.split(':')[1];

      await interaction.deferReply({
        ephemeral: true
      });

      try {
        const jogador =
          interaction.fields.getTextInputValue('jogador');

        const identificador =
          interaction.fields.getTextInputValue('identificador') || null;

        const punicao =
          interaction.fields.getTextInputValue('punicao')
            .trim()
            .toLowerCase();

        const duracao =
          interaction.fields.getTextInputValue('duracao') || null;

        const motivo =
          interaction.fields.getTextInputValue('motivo');

        const punishmentNames = {
          advertencia: '🟨 Advertência',
          kick: '👢 Kick',
          ban_temporario: '⏱️ Ban temporário',
          ban_permanente: '🔨 Ban permanente'
        };

        if (!punishmentNames[punicao]) {
          await interaction.editReply(
            '❌ Punição inválida. Use: `advertencia`, `kick`, `ban_temporario` ou `ban_permanente`.'
          );

          return true;
        }

        if (
          punicao === 'ban_temporario' &&
          !duracao
        ) {
          await interaction.editReply(
            '❌ Para `ban_temporario`, informe a duração.'
          );

          return true;
        }

        const logChannel =
          await interaction.guild.channels.fetch(
            PUNISHMENT_LOG_CHANNEL_ID
          );

        if (!logChannel?.isTextBased()) {
          await interaction.editReply(
            '❌ O canal de punições não foi encontrado.'
          );

          return true;
        }

        const punishmentId =
          await getNextPunishmentId(logChannel);

        const punishmentEmbed =
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
                value: identificador || 'Não informado',
                inline: true
              },
              {
                name: '⚖️ Punição',
                value: punishmentNames[punicao],
                inline: true
              },
              {
                name: '⏱️ Duração',
                value:
                  punicao === 'ban_permanente'
                    ? 'Permanente'
                    : duracao || 'Não se aplica',
                inline: true
              },
              {
                name: '🛡️ Staff responsável',
                value: `${interaction.user}`,
                inline: true
              },
              {
                name: '📡 Origem',
                value: 'DENÚNCIA',
                inline: true
              },
              {
                name: '🚨 Denúncia relacionada',
                value: reportMessageId,
                inline: true
              },
              {
                name: '📝 Motivo',
                value: motivo,
                inline: false
              }
            )
            .setFooter({
              text: 'Brasil Mega Lite • Sistema de Punições'
            })
            .setTimestamp();

        await logChannel.send({
          embeds: [punishmentEmbed]
        });

        await interaction.editReply(
          `✅ Punição **${punishmentId}** registrada com sucesso.`
        );

        return true;

      } catch (error) {
        console.error(
          'Erro ao registrar punição pela denúncia:',
          error
        );

        await interaction.editReply(
          '❌ Ocorreu um erro ao registrar a punição.'
        );

        return true;
      }
    }
    if (
      interaction.customId.startsWith(
        'ticket_modal:'
      )
    ) {

      const type =
        interaction.customId.split(':')[1];

      if (!TYPE[type]) {
        return false;
      }

      await createTicket(
        interaction,
        type
      );

      return true;
    }


    if (
      interaction.customId.startsWith(
        'report_decision:'
      )
    ) {

      await decide(
        interaction,
        interaction.customId.split(':')[1]
      );

      return true;
    }

  }


  return false;
}
