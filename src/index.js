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
import { startTranscriptWebServer } from './services/transcriptWeb.js';

validateConfig();
startTranscriptWebServer();

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

      // ====================================
      // PERMISSÃO
      // ====================================

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

          // Formato real retornado pela sua biblioteca
          const playerCount =
            Number(
              server?.players ?? 0
            );

          const maxPlayers =
            Number(
              server?.max_players ?? 0
            );

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
                    '🎮 Gamemode',
                  value:
                    server?.gamemode ||
                    'Não informado',
                  inline: true
                },

                {
                  name:
                    '🗺️ Mapa',
                  value:
                    server?.map ||
                    'Não informado',
                  inline: true
                },

                {
                  name:
                    '🧩 Versão',
                  value:
                    server?.version ||
                    'Não informada',
                  inline: true
                },

                {
                  name:
                    '🌐 Endereço',
                  value:
                    `\`${config.mtaHost}:${config.mtaPort}\``,
                  inline: false
                },

                {
                  name:
                    '🔗 Conexão direta',
                  value:
                    `\`mtasa://${config.mtaHost}:${config.mtaPort}\``,
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
      // JOGADORES ONLINE
      // ====================================

      if (
        interaction.customId ===
          'admin_players' ||
        interaction.customId ===
          'admin_players_refresh'
      ) {

        await interaction.deferUpdate();

        try {

          const server =
            await queryMta();

          const playerCount =
            Number(
              server?.players ?? 0
            );

          const maxPlayers =
            Number(
              server?.max_players ?? 0
            );


          // ==================================
          // TENTAR LOCALIZAR LISTA DE PLAYERS
          // ==================================

          const possibleLists = [
            server?.playerList,
            server?.playersList,
            server?.player_list,
            server?.clients,
            server?.playerInfo,
            server?.player_info
          ];

          const playerList =
            possibleLists.find(
              list =>
                Array.isArray(list)
            ) || [];


          let jogadoresTexto;


          // ==================================
          // LISTA DISPONÍVEL
          // ==================================

          if (
            playerList.length > 0
          ) {

            jogadoresTexto =
              playerList
                .slice(
                  0,
                  30
                )
                .map(
                  (
                    player,
                    index
                  ) => {

                    if (
                      typeof player ===
                      'string'
                    ) {

                      return (
                        `\`${String(
                          index + 1
                        ).padStart(
                          2,
                          '0'
                        )}\` 🎮 **${player}**`
                      );

                    }


                    const nome =
                      player?.name ??
                      player?.nick ??
                      player?.nickname ??
                      player?.player ??
                      player?.username ??
                      `Jogador ${index + 1}`;


                    const ping =
                      player?.ping;


                    if (
                      ping !== undefined &&
                      ping !== null
                    ) {

                      return (
                        `\`${String(
                          index + 1
                        ).padStart(
                          2,
                          '0'
                        )}\` 🎮 **${nome}** • ${ping}ms`
                      );

                    }


                    return (
                      `\`${String(
                        index + 1
                      ).padStart(
                        2,
                        '0'
                      )}\` 🎮 **${nome}**`
                    );

                  }
                )
                .join(
                  '\n'
                );


          // ==================================
          // EXISTEM PLAYERS, MAS SEM NOMES
          // ==================================

          } else if (
            playerCount > 0
          ) {

            jogadoresTexto =
              `🟢 Existem **${playerCount} jogador(es)** conectado(s) ao servidor.\n\n` +
              '⚠️ A consulta ASE está retornando a quantidade de jogadores, mas não forneceu a lista de nomes.';


          // ==================================
          // SERVIDOR VAZIO
          // ==================================

          } else {

            jogadoresTexto =
              '🌙 **Nenhum jogador conectado no momento.**';

          }


          const embed =
            new EmbedBuilder()

              .setColor(
                0x5865f2
              )

              .setTitle(
                `👥 JOGADORES ONLINE — ${playerCount}/${maxPlayers}`
              )

              .setDescription(
                jogadoresTexto
              )

              .addFields(

                {
                  name:
                    '📡 Servidor',
                  value:
                    '🟢 **ONLINE**',
                  inline: true
                },

                {
                  name:
                    '👥 Ocupação',
                  value:
                    `**${playerCount}/${maxPlayers}**`,
                  inline: true
                },

                {
                  name:
                    '🕐 Atualização',
                  value:
                    `<t:${Math.floor(
                      Date.now() / 1000
                    )}:R>`,
                  inline: true
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
                    'admin_players_refresh'
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
                    'admin_server'
                  )
                  .setLabel(
                    'Servidor'
                  )
                  .setEmoji(
                    '🟢'
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
            '❌ Erro ao consultar jogadores:',
            error
          );


          const embed =
            new EmbedBuilder()

              .setColor(
                0xe74c3c
              )

              .setTitle(
                '❌ ERRO AO CONSULTAR JOGADORES'
              )

              .setDescription(
                'Não foi possível consultar os jogadores do servidor neste momento.'
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
                    'admin_players_refresh'
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
// TICKETS — CENTRAL ADMINISTRATIVA
// ====================================

if (
  interaction.customId === 'admin_tickets' ||
  interaction.customId === 'admin_tickets_refresh'
) {

  await interaction.deferUpdate();

  try {

    // Atualiza o cache de canais
    await interaction.guild.channels.fetch();

    // Procura somente tickets dentro da categoria configurada
    const ticketChannels =
      interaction.guild.channels.cache.filter(
        channel =>
          channel.parentId === config.ticketCategoryId &&
          channel.isTextBased() &&
          channel.topic?.includes('BML ticket')
      );

    const ticketsAbertos =
      [...ticketChannels.values()];


    // ==================================
    // CONTAGEM POR CATEGORIA
    // ==================================

    const suporte =
      ticketsAbertos.filter(
        channel =>
          channel.topic?.includes('type=suporte')
      ).length;

    const financeiro =
      ticketsAbertos.filter(
        channel =>
          channel.topic?.includes('type=financeiro')
      ).length;

    const denuncias =
      ticketsAbertos.filter(
        channel =>
          channel.topic?.includes('type=denuncia')
      ).length;


    // ==================================
    // LISTA DOS TICKETS
    // ==================================

    let listaTickets = '';

    if (ticketsAbertos.length === 0) {

      listaTickets =
        '🌙 **Nenhum ticket aberto no momento.**';

    } else {

      listaTickets =
        ticketsAbertos
          .slice(0, 15)
          .map(
            (channel, index) => {

              const topic =
                channel.topic || '';

              const ownerId =
                topic.match(
                  /owner=(\d+)/
                )?.[1];

              const type =
                topic.match(
                  /type=([a-zA-Z0-9_-]+)/
                )?.[1] || 'desconhecido';


              let emoji = '🎫';
              let tipoNome = type;

              if (type === 'suporte') {
                emoji = '🛠️';
                tipoNome = 'Suporte';
              }

              if (type === 'financeiro') {
                emoji = '💰';
                tipoNome = 'Financeiro';
              }

              if (type === 'denuncia') {
                emoji = '🚨';
                tipoNome = 'Denúncia';
              }


              const dono =
                ownerId
                  ? `<@${ownerId}>`
                  : 'Desconhecido';


              return (
                `\`${String(
                  index + 1
                ).padStart(2, '0')}\` ` +
                `${emoji} ${channel} • **${tipoNome}**\n` +
                `└ 👤 ${dono}`
              );

            }
          )
          .join('\n\n');


      if (ticketsAbertos.length > 15) {

        listaTickets +=
          `\n\n*+${ticketsAbertos.length - 15} ticket(s) não exibido(s).*`;

      }

    }


    // ==================================
    // EMBED
    // ==================================

    const embed =
      new EmbedBuilder()

        .setColor(
          0x3498db
        )

        .setTitle(
          '🎫 CENTRAL DE TICKETS'
        )

        .setDescription(
          '**Brasil Mega Lite • Atendimento**\n\n' +
          listaTickets
        )

        .addFields(

          {
            name:
              '🎫 Abertos',
            value:
              `**${ticketsAbertos.length}**`,
            inline: true
          },

          {
            name:
              '🛠️ Suporte',
            value:
              `**${suporte}**`,
            inline: true
          },

          {
            name:
              '💰 Financeiro',
            value:
              `**${financeiro}**`,
            inline: true
          },

          {
            name:
              '🚨 Denúncias',
            value:
              `**${denuncias}**`,
            inline: true
          },

          {
            name:
              '🕐 Atualização',
            value:
              `<t:${Math.floor(
                Date.now() / 1000
              )}:R>`,
            inline: true
          }

        )

        .setFooter({
          text:
            'Brasil Mega Lite • Central Administrativa'
        })

        .setTimestamp();


    // ==================================
    // BOTÕES
    // ==================================

    const row =
      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()

            .setCustomId(
              'admin_tickets_refresh'
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
      '❌ Erro no painel de tickets:',
      error
    );


    const embed =
      new EmbedBuilder()

        .setColor(
          0xe74c3c
        )

        .setTitle(
          '❌ ERRO — CENTRAL DE TICKETS'
        )

        .setDescription(
          'Não foi possível carregar os tickets neste momento.'
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
              'admin_tickets_refresh'
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
// STAFF — CENTRAL ADMINISTRATIVA
// ====================================

if (
  interaction.customId === 'admin_staff' ||
  interaction.customId === 'admin_staff_refresh'
) {
  await interaction.deferUpdate();

  try {
    // ==================================
    // CARGOS DA STAFF
    // ==================================

    const STAFF_ROLES = [
      {
        id: '1554346778801995866',
        nome: 'Fundador',
        emoji: '👑'
      },
      {
        id: '1554353644013359124',
        nome: 'Diretor',
        emoji: '💎'
      },
      {
        id: '1554353725169082470',
        nome: 'Supervisor',
        emoji: '🛡️'
      },
      {
        id: '1554816161508761600',
        nome: 'Administrador Geral',
        emoji: '⚙️'
      },
      {
        id: '1554816528036397077',
        nome: 'Administrador',
        emoji: '🔨'
      },
      {
        id: '1555995165804597479',
        nome: 'Moderador',
        emoji: '🔰'
      },
      {
        id: '1555995306649329774',
        nome: 'Estagiário',
        emoji: '📋'
      },
      {
        id: '1556816812971135087',
        nome: 'Developer',
        emoji: '💻'
      }
    ];

    const EQUIPE_STAFF_ID =
      '1554536183457906709';


    // ==================================
    // ATUALIZA MEMBROS DO SERVIDOR
    // ==================================

    await interaction.guild.members.fetch();


    // ==================================
    // IDENTIFICA A STAFF
    // ==================================

    const todosMembros =
      [...interaction.guild.members.cache.values()];

    const membrosStaff =
      todosMembros.filter(member =>
        member.roles.cache.has(EQUIPE_STAFF_ID) ||
        STAFF_ROLES.some(role =>
          member.roles.cache.has(role.id)
        )
      );


    // ==================================
    // MONTA LISTA POR CARGO
    // ==================================

    let listaStaff = '';

    for (const role of STAFF_ROLES) {

      const membrosCargo =
        membrosStaff.filter(member =>
          member.roles.cache.has(role.id)
        );

      if (membrosCargo.length === 0) {
        continue;
      }

      const nomes =
        membrosCargo
          .slice(0, 15)
          .map(member =>
            `└ ${member}`
          )
          .join('\n');

      listaStaff +=
        `\n${role.emoji} **${role.nome}**\n` +
        `${nomes}\n`;
    }


    // ==================================
    // MEMBROS SOMENTE COM "EQUIPE STAFF"
    // ==================================

    const semCargoDefinido =
      membrosStaff.filter(member => {

        const possuiCargo =
          STAFF_ROLES.some(role =>
            member.roles.cache.has(role.id)
          );

        return !possuiCargo;

      });

    if (semCargoDefinido.length > 0) {

      const nomes =
        semCargoDefinido
          .slice(0, 15)
          .map(member =>
            `└ ${member}`
          )
          .join('\n');

      listaStaff +=
        `\n👥 **Equipe Staff**\n${nomes}\n`;
    }


    if (!listaStaff) {
      listaStaff =
        '\n🌙 **Nenhum membro da Staff encontrado.**';
    }


    // ==================================
    // CONTADORES
    // ==================================

    const totalStaff =
      membrosStaff.length;

    const online =
      membrosStaff.filter(member =>
        member.presence?.status &&
        member.presence.status !== 'offline'
      ).length;

    const offline =
      totalStaff - online;


    // ==================================
    // EMBED
    // ==================================

    const embed =
      new EmbedBuilder()

        .setColor(0x9b59b6)

        .setTitle(
          '🛡️ CENTRAL DA STAFF'
        )

        .setDescription(
          '**Brasil Mega Lite • Administração**\n' +
          listaStaff
        )

        .addFields(
          {
            name: '👥 Staff Total',
            value: `**${totalStaff}**`,
            inline: true
          },
          {
            name: '🟢 Online',
            value: `**${online}**`,
            inline: true
          },
          {
            name: '⚫ Offline',
            value: `**${offline}**`,
            inline: true
          },
          {
            name: '🕐 Atualização',
            value:
              `<t:${Math.floor(
                Date.now() / 1000
              )}:R>`,
            inline: true
          }
        )

        .setFooter({
          text:
            'Brasil Mega Lite • Central Administrativa'
        })

        .setTimestamp();


    // ==================================
    // BOTÕES
    // ==================================

    const row =
      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()
            .setCustomId(
              'admin_staff_refresh'
            )
            .setLabel(
              'Atualizar'
            )
            .setEmoji('🔄')
            .setStyle(
              ButtonStyle.Success
            ),

          new ButtonBuilder()
            .setCustomId(
              'admin_home'
            )
            .setLabel(
              'Voltar'
            )
            .setEmoji('⬅️')
            .setStyle(
              ButtonStyle.Secondary
            )

        );


    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });


  } catch (error) {

    console.error(
      '❌ Erro no painel da Staff:',
      error
    );

    const embed =
      new EmbedBuilder()

        .setColor(0xe74c3c)

        .setTitle(
          '❌ ERRO — CENTRAL DA STAFF'
        )

        .setDescription(
          'Não foi possível carregar os membros da Staff.'
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
              'admin_staff_refresh'
            )
            .setLabel(
              'Tentar novamente'
            )
            .setEmoji('🔄')
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
            .setEmoji('⬅️')
            .setStyle(
              ButtonStyle.Secondary
            )

        );


    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

  }

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
