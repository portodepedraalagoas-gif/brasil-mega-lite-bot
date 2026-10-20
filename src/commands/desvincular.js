
import {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';

import { config } from '../config.js';
import { revokeMtaDiscord } from '../services/mtaVerification.js';

export const data = new SlashCommandBuilder()
  .setName('desvincular')
  .setDescription('Desvincula sua conta MTA do Discord.')
  .addStringOption(option =>
    option
      .setName('confirmacao')
      .setDescription('Digite DESVINCULAR para confirmar')
      .setRequired(true)
  );

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: '❌ Use este comando no servidor Discord.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (process.env.MTA_VERIFICATION_ENABLED !== 'true') {
    return interaction.reply({
      content: '❌ Verificação MTA desativada.',
      flags: MessageFlags.Ephemeral
    });
  }

  const confirmacao = interaction.options
    .getString('confirmacao', true);

  if (confirmacao !== 'DESVINCULAR') {
    return interaction.reply({
      content: '❌ Digite DESVINCULAR para confirmar.',
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  try {
    const account = await revokeMtaDiscord(
      interaction.user.id
    );

    if (!account) {
      return interaction.editReply({
        content: '⚠️ Nenhuma conta MTA vinculada encontrada.'
      });
    }

    let avisoCargo = '';

    if (config.verifiedRoleId) {
      try {
        const member = await interaction.guild.members.fetch(
          interaction.user.id
        );

        if (member.roles.cache.has(config.verifiedRoleId)) {
          await member.roles.remove(
            config.verifiedRoleId,
            'Desvinculação voluntária da conta MTA'
          );
        }
      } catch (error) {
        console.error('Erro ao remover cargo:', error);
        avisoCargo =
          '\n⚠️ Não foi possível remover o cargo automaticamente.';
      }
    }

    await interaction.editReply({
      content:
        '✅ **Conta desvinculada!**\n\n' +
        `🎮 Conta MTA: **${account}**\n` +
        '🔓 Vínculo desativado com sucesso.\n\n' +
        'Você poderá realizar uma nova verificação no MTA.' +
        avisoCargo
    });

  } catch (error) {
    console.error('Erro ao desvincular MTA:', error);

    await interaction.editReply({
      content:
        '❌ Não foi possível desvincular sua conta. ' +
        'Contate a administração.'
    });
  }
}
