import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle } from 'discord.js';
import { config } from '../config.js';

const TYPE = {
  suporte: { label: 'Suporte / Dúvidas', emoji: '🛠️', roles: () => [config.staffRoleId] },
  financeiro: { label: 'Financeiro', emoji: '💰', roles: () => [config.financeRoleId] },
  denuncia: { label: 'Denúncia', emoji: '🚨', roles: () => [config.staffRoleId, config.reportRoleId] },
};

const hasRole = (i, id) => Boolean(id && i.member?.roles?.cache?.has(id));
const canManage = (i, type) => i.memberPermissions?.has(PermissionFlagsBits.Administrator) || TYPE[type]?.roles().some(id => hasRole(i, id));
const safeName = v => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').slice(0,35);

function ticketButtons(type) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_claim:${type}`).setLabel('Assumir').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ticket_close:${type}`).setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
  );
  if (type === 'denuncia') row.addComponents(
    new ButtonBuilder().setCustomId('report_accept').setLabel('Aceitar').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('report_deny').setLabel('Negar').setEmoji('❌').setStyle(ButtonStyle.Danger),
  );
  return row;
}

export async function publishTicketPanel(client) {
  const channel = await client.channels.fetch(config.ticketPanelChannelId);
  if (!channel?.isTextBased()) throw new Error('Canal de tickets inválido');
  const embed = new EmbedBuilder().setColor(0x8e44ad)
    .setTitle('🎫 CENTRAL DE ATENDIMENTO — BRASIL MEGA LITE')
    .setDescription('Selecione o setor desejado.\n\n🛠️ **Suporte / Dúvidas** — ajuda geral.\n💰 **Financeiro** — pagamentos e compras.\n🚨 **Denúncia** — denúncias de jogadores com provas.\n\nAbra apenas um ticket por assunto.')
    .setFooter({ text: 'Brasil Mega Lite • Sistema de Atendimento' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_open:suporte').setLabel('Suporte / Dúvidas').setEmoji('🛠️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_open:financeiro').setLabel('Financeiro').setEmoji('💰').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_open:denuncia').setLabel('Denúncia').setEmoji('🚨').setStyle(ButtonStyle.Danger),
  );
  await channel.send({ embeds:[embed], components:[row] });
}

function openModal(type) {
  const modal = new ModalBuilder().setCustomId(`ticket_modal:${type}`).setTitle(type === 'denuncia' ? 'Abrir denúncia' : `Abrir ${TYPE[type].label}`);
  const rows = [];
  if (type === 'denuncia') {
    rows.push(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('denunciado').setLabel('Nome/ID do jogador denunciado').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motivo').setLabel('Motivo da denúncia').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('descricao').setLabel('Descreva o ocorrido').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('provas').setLabel('Provas (links de imagem/vídeo)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)),
    );
  } else {
    rows.push(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('assunto').setLabel('Assunto').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('descricao').setLabel('Explique como podemos ajudar').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1200)),
    );
  }
  return modal.addComponents(...rows);
}

async function existingTicket(guild, userId, type) {
  await guild.channels.fetch();
  return guild.channels.cache.find(ch => ch.parentId === config.ticketCategoryId && ch.topic?.includes(`owner=${userId}`) && ch.topic?.includes(`type=${type}`));
}

async function createTicket(interaction, type) {
  const old = await existingTicket(interaction.guild, interaction.user.id, type);
  if (old) return interaction.reply({ content:`❌ Você já possui um ticket de **${TYPE[type].label}** aberto: ${old}`, ephemeral:true });
  const roleIds = [...new Set(TYPE[type].roles().filter(Boolean))];
  const channel = await interaction.guild.channels.create({
    name:`${type}-${safeName(interaction.user.username)}`, type:ChannelType.GuildText, parent:config.ticketCategoryId,
    topic:`BML ticket | owner=${interaction.user.id} | type=${type}`,
    permissionOverwrites:[
      { id:interaction.guild.roles.everyone.id, deny:[PermissionFlagsBits.ViewChannel] },
      { id:interaction.user.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles] },
      ...roleIds.map(id => ({ id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles] }))
    ]
  });
  const embed = new EmbedBuilder().setColor(type==='denuncia'?0xe74c3c:type==='financeiro'?0x2ecc71:0x3498db)
    .setTitle(`${TYPE[type].emoji} ${TYPE[type].label} — ${interaction.user.username}`).setDescription(`Ticket aberto por ${interaction.user}.`).setTimestamp();
  if (type === 'denuncia') embed.addFields(
    {name:'👤 Denunciado',value:interaction.fields.getTextInputValue('denunciado')},
    {name:'🚨 Motivo',value:interaction.fields.getTextInputValue('motivo')},
    {name:'📝 Descrição',value:interaction.fields.getTextInputValue('descricao')},
    {name:'🔗 Provas',value:interaction.fields.getTextInputValue('provas')},
  ); else embed.addFields(
    {name:'📌 Assunto',value:interaction.fields.getTextInputValue('assunto')},
    {name:'📝 Descrição',value:interaction.fields.getTextInputValue('descricao')},
  );
  await channel.send({ content:`${interaction.user} ${roleIds.map(id=>`<@&${id}>`).join(' ')}`, embeds:[embed], components:[ticketButtons(type)], allowedMentions:{users:[interaction.user.id],roles:roleIds} });
  await interaction.reply({ content:`✅ Seu ticket foi criado: ${channel}`, ephemeral:true });
}

function decisionModal(decision) {
  const ok = decision === 'accept';
  return new ModalBuilder().setCustomId(`report_decision:${decision}`).setTitle(ok?'Aceitar denúncia':'Negar denúncia').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('decisao').setLabel(ok?'Motivo / punição aplicada':'Motivo da recusa').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000))
  );
}

async function decide(interaction, decision) {
  if (!hasRole(interaction,config.reportRoleId) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({content:'❌ Apenas a equipe de denúncias pode decidir.',ephemeral:true});
  if (!interaction.channel?.topic?.includes('type=denuncia')) return interaction.reply({content:'❌ Este canal não é uma denúncia.',ephemeral:true});
  if (interaction.channel.topic.includes('decision=')) return interaction.reply({content:'❌ Esta denúncia já recebeu uma decisão.',ephemeral:true});
  const ownerId = interaction.channel.topic.match(/owner=(\d+)/)?.[1] || '0';
  const accepted = decision === 'accept';
  const targetId = accepted ? config.reportAcceptedChannelId : config.reportDeniedChannelId;
  const target = await interaction.guild.channels.fetch(targetId);
  const messages = await interaction.channel.messages.fetch({limit:20});
  const original = messages.find(m=>m.author.id===interaction.client.user.id && m.embeds.length)?.embeds?.[0];
  const result = new EmbedBuilder().setColor(accepted?0x2ecc71:0xe74c3c).setTitle(accepted?'✅ DENÚNCIA ACEITA':'❌ DENÚNCIA NEGADA')
    .addFields({name:'👤 Denunciante',value:`<@${ownerId}>`,inline:true},{name:'🛡️ Analisada por',value:`${interaction.user}`,inline:true},{name:accepted?'⚖️ Decisão / Punição':'📝 Motivo da recusa',value:interaction.fields.getTextInputValue('decisao')})
    .setFooter({text:`Ticket: #${interaction.channel.name}`}).setTimestamp();
  for (const name of ['👤 Denunciado','🚨 Motivo','📝 Descrição','🔗 Provas']) { const f=original?.fields?.find(x=>x.name===name); if(f) result.addFields({name:f.name,value:f.value}); }
  await target.send({embeds:[result]});
  await interaction.channel.setTopic(`${interaction.channel.topic} | decision=${accepted?'accepted':'denied'} | by=${interaction.user.id}`);
  await interaction.reply(`${accepted?'✅ Denúncia aceita':'❌ Denúncia negada'} por ${interaction.user}. Resultado enviado para <#${targetId}>.`);
}

export async function handleTicketInteraction(interaction) {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('ticket_open:')) { const type=interaction.customId.split(':')[1]; if(!TYPE[type]) return false; await interaction.showModal(openModal(type)); return true; }
    if (interaction.customId.startsWith('ticket_claim:')) { const type=interaction.customId.split(':')[1]; if(!canManage(interaction,type)) await interaction.reply({content:'❌ Sem permissão para assumir.',ephemeral:true}); else await interaction.reply(`🛡️ Atendimento assumido por ${interaction.user}.`); return true; }
    if (interaction.customId.startsWith('ticket_close:')) { const type=interaction.customId.split(':')[1]; const owner=interaction.channel?.topic?.match(/owner=(\d+)/)?.[1]; if(owner!==interaction.user.id && !canManage(interaction,type)) await interaction.reply({content:'❌ Sem permissão para fechar.',ephemeral:true}); else { await interaction.reply('🔒 Ticket encerrado. Canal será excluído em 5 segundos.'); setTimeout(()=>interaction.channel.delete('Ticket encerrado').catch(console.error),5000); } return true; }
    if (interaction.customId==='report_accept'||interaction.customId==='report_deny') { if(!hasRole(interaction,config.reportRoleId)&&!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) await interaction.reply({content:'❌ Apenas a equipe de denúncias pode decidir.',ephemeral:true}); else await interaction.showModal(decisionModal(interaction.customId==='report_accept'?'accept':'deny')); return true; }
  }
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('ticket_modal:')) { const type=interaction.customId.split(':')[1]; if(!TYPE[type]) return false; await createTicket(interaction,type); return true; }
    if (interaction.customId.startsWith('report_decision:')) { await decide(interaction,interaction.customId.split(':')[1]); return true; }
  }
  return false;
}
