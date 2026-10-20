
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { confirmMtaCode } from '../services/mtaVerification.js';

export const data = new SlashCommandBuilder()
  .setName('verificar')
  .setDescription('Vincula sua conta do MTA ao Discord usando o código de 6 dígitos.')
  .addStringOption(option =>
    option
      .setName('codigo')
      .setDescription('Código de 6 números mostrado no MTA')
      .setRequired(true)
      .setMinLength(6)
      .setMaxLength(6)
  );

export async function execute(interaction) {
  if (process.env.MTA_VERIFICATION_ENABLED !== 'true') {
    return interaction.reply({
      content: '⏳ A verificação MTA ainda está sendo configurada.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (!interaction.inGuild()) {
    return interaction.reply({
      content: '❌ Use este comando dentro do servidor Discord.',
      flags: MessageFlags.Ephemeral
    });
  }

  const code = interaction.options.getString('codigo', true);

  if (!/^\d{6}$/.test(code)) {
    return interaction.reply({
      content: '❌ Digite exatamente os 6 números mostrados no MTA.',
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  try {
    if (!config.verifiedRoleId) {
      throw new Error('O cargo VERIFIED_ROLE_ID não está configurado.');
    }

    const guild = interaction.guild;

    const member = await guild.members.fetch(interaction.user.id);
    const role = await guild.roles.fetch(config.verifiedRoleId);

    if (!role) {
      throw new Error('O cargo de verificado não foi encontrado.');
    }

    const botMember = await guild.members.fetchMe();

    if (role.position >= botMember.roles.highest.position) {
      throw new Error(
        'O cargo do bot precisa estar acima do cargo de verificado.'
      );
    }

    if (!botMember.permissions.has('ManageRoles')) {
      throw new Error(
        'O bot precisa da permissão Gerenciar Cargos.'
      );
    }

    const result = await confirmMtaCode(
      code,
      interaction.user.id,
      async () => {
        await member.roles.add(
          role,
          'Verificação de conta MTA Brasil Mega Lite'
        );
      }
    );

    await interaction.editReply({
      content:
        `✅ **Verificação concluída!**\n\n` +
        `🎮 Conta MTA: **${result.account}**\n` +
        `🛡️ Cargo recebido: **${role.name}**\n\n` +
        `Bem-vindo ao ${config.serverName}! 🦊`
    });

  } catch (error) {
    console.error('Erro ao verificar código MTA:', error);

    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}
