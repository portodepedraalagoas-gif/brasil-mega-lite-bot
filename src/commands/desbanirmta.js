import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createMtaPunishment, getMtaPunishment } from '../services/mtaPunishmentQueue.js';

const FOUNDER_ROLE = '1554346778801995866';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const data = new SlashCommandBuilder()
  .setName('desbanirmta')
  .setDescription('Remover banimento do MTA (exclusivo Fundador)')
  .addStringOption(option => option.setName('tipo').setDescription('Identificar banimento').setRequired(true)
    .addChoices({ name: 'Protocolo', value: 'protocol' }, { name: 'Serial', value: 'serial' }))
  .addStringOption(option => option.setName('valor').setDescription('Número do protocolo ou serial hexadecimal de 32 caracteres').setRequired(true).setMaxLength(32))
  .addStringOption(option => option.setName('motivo').setDescription('Motivo da retirada').setRequired(true).setMinLength(3).setMaxLength(220));

export async function execute(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: '❌ Use este comando no servidor Discord.', flags: MessageFlags.Ephemeral });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.roles.cache.has(FOUNDER_ROLE)) return interaction.reply({ content: '❌ Apenas o cargo Fundador pode usar este comando.', flags: MessageFlags.Ephemeral });
  if (process.env.MTA_PUNISHMENTS_ENABLED !== 'true') return interaction.reply({ content: '🔒 Desbanimentos pelo Discord ainda estão em modo de teste e desativados.', flags: MessageFlags.Ephemeral });

  const type = interaction.options.getString('tipo', true);
  const value = interaction.options.getString('valor', true).trim();
  const reason = interaction.options.getString('motivo', true).trim();
  if ((type === 'protocol' && (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647)) ||
      (type === 'serial' && !/^[a-f\d]{32}$/i.test(value)) || reason.length < 3) {
    return interaction.reply({ content: '❌ Protocolo, serial ou motivo inválido.', flags: MessageFlags.Ephemeral });
  }
  const payload = type === 'protocol' ? { protocol: Number(value), reason } : { serial: value.toUpperCase(), reason };
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const { id } = await createMtaPunishment({ action: 'unban', payload, actor: { id: interaction.user.id } });
    for (let i = 0; i < 24; i++) {
      await sleep(2000);
      const job = getMtaPunishment(id);
      if (job?.status === 'done' || job?.status === 'failed') {
        const result = job.result;
        return interaction.editReply({ content: `${result?.ok ? '✅' : '❌'} ${result?.message || 'Resultado sem detalhes.'}${result?.protocol ? `\nProtocolo: #${result.protocol}` : ''}` });
      }
    }
    await interaction.editReply({ content: `⏳ MTA não confirmou a execução dentro do prazo. **Não repita o comando.** Consulte os registros. ID: \`${id}\`.` });
  } catch (error) {
    console.error('[BML desbanirmta]', error);
    await interaction.editReply({ content: '❌ Não foi possível registrar ou confirmar o comando. Verifique os logs antes de tentar novamente.' });
  }
}
