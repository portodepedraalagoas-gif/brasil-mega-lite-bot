import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
  ActivityType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';

import {
  config,
  validateConfig
} from './config.js';

import { queryMta } from './services/mta.js';
import { startPanelUpdater } from './services/panel.js';

import {
  handleTicketInteraction,
  handleTicketMessage
} from './services/tickets.js';

import * as tickets from './commands/tickets.js';
import * as status from './commands/status.js';
import * as players from './commands/players.js';
import * as ip from './commands/ip.js';
import * as ajuda from './commands/ajuda.js';
import * as verificacao from './commands/verificacao.js';
import * as painel from './commands/painel.js';
import * as punir from './commands/punir.js';
import * as historico from './commands/historico.js';
import * as revogarpunicao from './commands/revogarpunicao.js';
import * as admin from './commands/admin.js';

validateConfig();


// ==========================================
// COMANDOS DO BOT
// ==========================================

const commandModules = [
  status,
  players,
  ip,
  ajuda,
  verificacao,
  painel,
  tickets,
  punir,
  historico,
  revogarpunicao,
  admin
];


// ==========================================
// CLIENTE DO DISCORD
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});


// ==========================================
// COLEÇÃO DE COMANDOS
// ==========================================

client.commands = new Collection(
  commandModules.map(command => [
    command.data.name,
    command
  ])
);


// ==========================================
// REGISTRAR SLASH COMMANDS
// ==========================================

async function registerCommands() {

  const rest =
    new REST({
      version: '10'
    }).setToken(
      config.token
    );

  await rest.put(
    Routes.applicationGuildCommands(
      config.clientId,
      config.guildId
    ),
    {
      body:
        commandModules.map(
          command =>
            command.data.toJSON()
        )
    }
  );

  console.log(
    '✅ Comandos slash registrados.'
  );
}


// ==========================================
// PRESENÇA DO BOT
// ==========================================

async function updatePresence() {

  client.user.setActivity(
    'Brasil Mega Lite 🦊',
    {
      type:
        ActivityType.Playing
    }
  );
}


// ==========================================
// BOT PRONTO
// ==========================================

client.once(
  'ready',
  async () => {

    console.log(
      `✅ Bot conectado como ${client.user.tag}`
    );

    await updatePresence();

    setInterval(
      updatePresence,
      60_000
    );

    startPanelUpdater(
      client
    );
  }
);


// ==========================================
// BOAS-VINDAS
// ==========================================

client.on(
  'guildMemberAdd',
  async member => {

    if (
      !config.verificationChannelId
    ) {
      return;
    }

    try {

      const ch =
        await member.guild.channels.fetch(
          config.verificationChannelId
        );

      if (
        ch?.isTextBased()
      ) {

        await ch.send(
          `👋 Bem-vindo(a), ${member}! Clique em **Verificar** no painel acima para liberar seu acesso ao ${config.serverName}.`
        );

      }

    } catch (e) {

      console.error(
        'Boas-vindas:',
        e
      );

    }
  }
);


// ==========================================
// RESPOSTAS DA STAFF NOS TICKETS
// ==========================================

client.on(
  'messageCreate',
  async message => {

    try {

      await handleTicketMessage(
        message
      );

    } catch (error) {

      console.error(
        'Erro ao verificar resposta em ticket:',
        error
      );

    }
  }
);


// ==========================================
// INTERAÇÕES
// ==========================================

client.on(
  'interactionCreate',
  async interaction => {


    // ======================================
    // CENTRAL ADMINISTRATIVA
    // ======================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        'admin_'
      )
    ) {

      // Somente administradores
      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.Administrator
        )
      ) {

        await interaction.reply({
          content:
            '❌ Você não possui permissão para usar a Central Administrativa.',
          ephemeral: true
        });

        return;
      }


      // ====================================
      // SERVIDOR MTA
      // ====================================

      if (
        interaction.customId ===
          'admin_server' ||
        interaction.customId ===
          'admin_server_refresh'
      ) {

        await interaction.deferUpdate();

        try {

          const server =
            await queryMta();

          console.log(
            '📡 Dados MTA:',
            server
          );

        const playerCount =
  Number(server?.players ?? 0);

const maxPlayers =
  Number(server?.max_players ?? 0);

          const serverName =
            server?.name ??
            server?.hostname ??
            config.serverName ??
            'Brasil Mega Lite RP';

          const embed =
            new EmbedBuilder()

              .setColor(
                0x2ecc71
              )

              .setTitle(
                '🟢 BRASIL MEGA LITE — SERVIDOR'
              )

              .setDescription(
                `**${serverName}**\n\n` +
                'Informações em tempo real do servidor.'
              )

              .addFields(

                {
                  name:
                    '📡 Status',
                  value:
                    '🟢 **ONLINE**',
                  inline: true
                },

                {
                  name:
                    '👥 Jogadores',
                  value:
                    `**${playerCount} / ${maxPlayers}**`,
                  inline: true
                },

                {
                  name:
                    '🎮 Plataforma',
                  value:
                    '**MTA:SA**',
                  inline: true
                },

                {
                  name:
                    '🌐 Endereço',
                  value:
                    '`151.242.227.118:22003`',
                  inline: false
                },

                {
                  name:
                    '🔗 Conexão direta',
                  value:
                    '`mtasa://151.242.227.118:22003`',
                  inline: false
                },

                {
                  name:
                    '🕐 Última atualização',
                  value:
                    `<t:${Math.floor(
                      Date.now() / 1000
                    )}:R>`,
                  inline: false
                }

              )

              .setFooter({
                text:
                  'Brasil Mega Lite • Central Administrativa'
              })

              .setTimestamp();


          const row =
            new ActionRowBuilder()

              .addComponents(

                new ButtonBuilder()

                  .setCustomId(
                    'admin_server_refresh'
                  )

                  .setLabel(
                    'Atualizar'
                  )

                  .setEmoji(
                    '🔄'
                  )

                  .setStyle(
                    ButtonStyle.Success
                  ),


                new ButtonBuilder()

                  .setCustomId(
                    'admin_players'
                  )

                  .setLabel(
                    'Ver jogadores'
                  )

                  .setEmoji(
                    '👥'
                  )

                  .setStyle(
                    ButtonStyle.Primary
                  ),


                new ButtonBuilder()

                  .setCustomId(
                    'admin_home'
                  )

                  .setLabel(
                    'Voltar'
                  )

                  .setEmoji(
                    '⬅️'
                  )

                  .setStyle(
                    ButtonStyle.Secondary
                  )

              );


          await interaction.editReply({
            embeds: [
              embed
            ],
            components: [
              row
            ]
          });


        } catch (error) {

          console.error(
            '❌ Erro ao consultar servidor MTA:',
            error
          );


          const embed =
            new EmbedBuilder()

              .setColor(
                0xe74c3c
              )

              .setTitle(
                '🔴 BRASIL MEGA LITE — SERVIDOR'
              )

              .setDescription(
                'Não foi possível consultar o servidor MTA neste momento.'
              )

              .addFields({
                name:
                  '📡 Status',
                value:
                  '🔴 **OFFLINE / INDISPONÍVEL**'
              })

              .setFooter({
                text:
                  'Brasil Mega Lite • Central Administrativa'
              })

              .setTimestamp();


          const row =
            new ActionRowBuilder()

              .addComponents(

                new ButtonBuilder()

                  .setCustomId(
                    'admin_server_refresh'
                  )

                  .setLabel(
                    'Tentar novamente'
                  )

                  .setEmoji(
                    '🔄'
                  )

                  .setStyle(
                    ButtonStyle.Primary
                  ),


                new ButtonBuilder()

                  .setCustomId(
                    'admin_home'
                  )

                  .setLabel(
                    'Voltar'
                  )

                  .setEmoji(
                    '⬅️'
                  )

                  .setStyle(
                    ButtonStyle.Secondary
                  )

              );


          await interaction.editReply({
            embeds: [
              embed
            ],
            components: [
              row
            ]
          });

        }

        return;
      }


      // ====================================
      // JOGADORES
      // ====================================

      if (
        interaction.customId ===
        'admin_players'
      ) {

        await interaction.reply({
          content:
            '👥 O painel de jogadores será configurado agora.',
          ephemeral: true
        });

        return;
      }


      // ====================================
      // VOLTAR PARA CENTRAL
      // ====================================

      if (
        interaction.customId ===
        'admin_home'
      ) {

        const embed =
          new EmbedBuilder()

            .setColor(
              0x8e44ad
            )

            .setTitle(
              '🛡️ CENTRAL ADMINISTRATIVA'
            )

            .setDescription(
              '**Brasil Mega Lite • Painel de Controle**\n\n' +
              'Selecione abaixo o setor que deseja gerenciar.'
            )

            .addFields(

              {
                name:
                  '🟢 Servidor',
                value:
                  'Status e informações do servidor MTA.',
                inline: true
              },

              {
                name:
                  '👥 Jogadores',
                value:
                  'Visualizar jogadores conectados.',
                inline: true
              },

              {
                name:
                  '🎫 Tickets',
                value:
                  'Sistema de atendimento.',
                inline: true
              },

              {
                name:
                  '🚨 Denúncias',
                value:
                  'Gerenciamento de denúncias.',
                inline: true
              },

              {
                name:
                  '🔨 Punições',
                value:
                  'Histórico de punições.',
                inline: true
              },

              {
                name:
                  '🛡️ Staff',
                value:
                  'Ferramentas da equipe.',
                inline: true
              },

              {
                name:
                  '📋 Logs',
                value:
                  'Registros administrativos.',
                inline: true
              }

            )

            .setFooter({
              text:
                'Brasil Mega Lite • Sistema Administrativo'
            })

            .setTimestamp();


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


        await interaction.update({
          embeds: [
            embed
          ],
          components: [
            row1,
            row2
          ]
        });

        return;
      }

    }


    // ======================================
    // SISTEMA DE TICKETS
    // ======================================

    try {

      if (
        await handleTicketInteraction(
          interaction
        )
      ) {
        return;
      }

    } catch (error) {

      console.error(
        'Tickets:',
        error
      );

      if (
        interaction.isRepliable()
      ) {

        const msg = {
          content:
            '❌ Ocorreu um erro no sistema de tickets.',
          ephemeral: true
        };


        if (
          interaction.replied ||
          interaction.deferred
        ) {

          await interaction
            .followUp(
              msg
            )
            .catch(
              () => {}
            );

        } else {

          await interaction
            .reply(
              msg
            )
            .catch(
              () => {}
            );

        }
      }

      return;
    }


    // ======================================
    // VERIFICAÇÃO
    // ======================================

    if (
      interaction.isButton() &&
      interaction.customId ===
        'bml_verify'
    ) {

      if (
        !config.verifiedRoleId
      ) {

        return interaction.reply({
          content:
            '❌ O cargo de verificação ainda não foi configurado.',
          ephemeral: true
        });

      }


      try {

        const role =
          await interaction.guild.roles.fetch(
            config.verifiedRoleId
          );


        if (!role) {

          return interaction.reply({
            content:
              '❌ Não encontrei o cargo configurado.',
            ephemeral: true
          });

        }


        if (
          interaction.member.roles.cache.has(
            role.id
          )
        ) {

          return interaction.reply({
            content:
              '✅ Você já está verificado.',
            ephemeral: true
          });

        }


        await interaction.member.roles.add(
          role
        );


        return interaction.reply({
          content:
            `✅ Verificação concluída! Cargo **${role.name}** liberado.`,
          ephemeral: true
        });


      } catch (e) {

        console.error(
          'Verificação:',
          e
        );


        return interaction.reply({
          content:
            '❌ Não consegui entregar o cargo. Coloque o cargo do bot acima do cargo de verificado.',
          ephemeral: true
        });

      }
    }


    // ======================================
    // COMANDOS SLASH
    // ======================================

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }


    const command =
      client.commands.get(
        interaction.commandName
      );


    if (!command) {
      return;
    }


    try {

      await command.execute(
        interaction
      );


    } catch (error) {

      console.error(
        error
      );


      const msg = {
        content:
          '❌ Ocorreu um erro ao executar esse comando.',
        ephemeral: true
      };


      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction.followUp(
          msg
        );

      } else {

        await interaction.reply(
          msg
        );

      }
    }
  }
);


// ==========================================
// INICIAR BOT
// ==========================================

await registerCommands();

await client.login(
  config.token
);
