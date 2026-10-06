import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Abre a Central Administrativa do Brasil Mega Lite.');

export async function execute(interaction) {

  // Por enquanto: somente administradores.
  // Depois podemos liberar para cargos específicos.
  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return interaction.reply({
      content: '❌ Você não possui permissão para acessar a Central Administrativa.',
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle('🛡️ CENTRAL ADMINISTRATIVA')
    .setDescription(
      '**Brasil Mega Lite • Painel de Controle**\n\n' +
      'Bem-vindo à Central Administrativa.\n' +
      'Selecione abaixo o setor que deseja gerenciar.'
    )
    .addFields(
      {
        name: '🟢 Servidor',
        value: 'Status e informações do servidor MTA.',
        inline: true
      },
      {
        name: '👥 Jogadores',
        value: 'Visualizar jogadores conectados.',
        inline: true
      },
      {
        name: '🎫 Tickets',
        value: 'Informações do sistema de atendimento.',
        inline: true
      },
      {
        name: '🚨 Denúncias',
        value: 'Gerenciamento de denúncias.',
        inline: true
      },
      {
        name: '🔨 Punições',
        value: 'Histórico e gerenciamento de punições.',
        inline: true
      },
      {
        name: '🛡️ Staff',
        value: 'Ferramentas administrativas da equipe.',
        inline: true
      },
      {
        name: '📋 Logs',
        value: 'Acesso rápido aos registros do sistema.',
        inline: true
      }
    )
    .setFooter({
      text: 'Brasil Mega Lite • Sistema Administrativo'
    })
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()
        .setCustomId('admin_server')
        .setLabel('Servidor')
        .setEmoji('🟢')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId('admin_players')
        .setLabel('Jogadores')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('admin_tickets')
        .setLabel('Tickets')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('admin_reports')
        .setLabel('Denúncias')
        .setEmoji('🚨')
        .setStyle(ButtonStyle.Danger)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()
        .setCustomId('admin_punishments')
        .setLabel('Punições')
        .setEmoji('🔨')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('admin_staff')
        .setLabel('Staff')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('admin_logs')
        .setLabel('Logs')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.reply({
    embeds: [embed],
    components: [row1, row2],
    ephemeral: true
  });
}
