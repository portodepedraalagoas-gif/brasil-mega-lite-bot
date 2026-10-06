import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';

import { queryMta } from '../services/mta.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Abre a Central Administrativa do Brasil Mega Lite.');

export async function execute(interaction) {

  // ==========================================
  // PERMISSÃO
  // ==========================================

  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return interaction.reply({
      content:
        '❌ Você não possui permissão para acessar a Central Administrativa.',
      ephemeral: true
    });
  }

  // ==========================================
  // CONSULTAR SERVIDOR MTA
  // ==========================================

  let serverOnline = false;
  let playerCount = 0;
  let maxPlayers = 200;

  try {

    const server = await queryMta();

    serverOnline = true;

    // O @bsnext/mta-ase-query retorna:
    // players = quantidade online
    // max_players = limite do servidor

    playerCount = Number(
      server?.players ?? 0
    );

    maxPlayers = Number(
      server?.max_players ?? 200
    );

  } catch (error) {

    console.error(
      'Erro ao consultar MTA no painel admin:',
      error
    );

  }

  // ==========================================
  // PAINEL PRINCIPAL
  // ==========================================

  const embed = new EmbedBuilder()

    .setColor(
      serverOnline
        ? 0x2ecc71
        : 0xe74c3c
    )

    .setTitle(
      '🛡️ CENTRAL ADMINISTRATIVA'
    )

    .setDescription(
      '**Brasil Mega Lite • Painel de Controle**\n\n' +
      'Bem-vindo à Central Administrativa.\n' +
      'Selecione abaixo o setor que deseja gerenciar.'
    )

    .addFields(

      {
        name: '🟢 Servidor',
        value:
          serverOnline
            ? '🟢 **ONLINE**'
            : '🔴 **OFFLINE**',
        inline: true
      },

      {
        name: '👥 Jogadores',
        value:
          `**${playerCount} / ${maxPlayers}**`,
        inline: true
      },

      {
        name: '🎮 Plataforma',
        value: '**MTA:SA**',
        inline: true
      },

      {
        name: '🌐 Endereço',
        value:
          `\`${config.mtaHost}:${config.mtaPort}\``,
        inline: false
      },

      {
        name: '🎫 Tickets',
        value:
          'Informações do sistema de atendimento.',
        inline: true
      },

      {
        name: '🚨 Denúncias',
        value:
          'Gerenciamento de denúncias.',
        inline: true
      },

      {
        name: '🔨 Punições',
        value:
          'Histórico e gerenciamento de punições.',
        inline: true
      },

      {
        name: '🛡️ Staff',
        value:
          'Ferramentas administrativas da equipe.',
        inline: true
      },

      {
        name: '📋 Logs',
        value:
          'Acesso rápido aos registros do sistema.',
        inline: true
      }

    )

    .setFooter({
      text:
        'Brasil Mega Lite • Sistema Administrativo'
    })

    .setTimestamp();

  // ==========================================
  // PRIMEIRA LINHA DE BOTÕES
  // ==========================================

  const row1 =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            'admin_server'
          )
          .setLabel(
            'Servidor'
          )
          .setEmoji(
            '🟢'
          )
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            'admin_players'
          )
          .setLabel(
            'Jogadores'
          )
          .setEmoji(
            '👥'
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            'admin_tickets'
          )
          .setLabel(
            'Tickets'
          )
          .setEmoji(
            '🎫'
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            'admin_reports'
          )
          .setLabel(
            'Denúncias'
          )
          .setEmoji(
            '🚨'
          )
          .setStyle(
            ButtonStyle.Danger
          )

      );

  // ==========================================
  // SEGUNDA LINHA DE BOTÕES
  // ==========================================

  const row2 =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            'admin_punishments'
          )
          .setLabel(
            'Punições'
          )
          .setEmoji(
            '🔨'
          )
          .setStyle(
            ButtonStyle.Danger
          ),

        new ButtonBuilder()
          .setCustomId(
            'admin_staff'
          )
          .setLabel(
            'Staff'
          )
          .setEmoji(
            '🛡️'
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            'admin_logs'
          )
          .setLabel(
            'Logs'
          )
          .setEmoji(
            '📋'
          )
          .setStyle(
            ButtonStyle.Secondary
          )

      );

  // ==========================================
  // ENVIAR PAINEL
  // ==========================================

  await interaction.reply({
    embeds: [embed],
    components: [
      row1,
      row2
    ],
    ephemeral: true
  });
}
