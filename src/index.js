import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
  ActivityType
} from 'discord.js';

import { config, validateConfig } from './config.js';
import { queryMta } from './services/mta.js';
import { startPanelUpdater } from './services/panel.js';
import { handleTicketInteraction } from './services/tickets.js';

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
  revogarpunicao
];


// ==========================================
// CLIENTE DO DISCORD
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
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
// INTERAÇÕES
// ==========================================

client.on(
  'interactionCreate',
  async interaction => {

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
            .followUp(msg)
            .catch(() => {});

        } else {

          await interaction
            .reply(msg)
            .catch(() => {});

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
