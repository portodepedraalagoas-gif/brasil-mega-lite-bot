import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createMtaPunishment, getMtaPunishment } from '../services/mtaPunishmentQueue.js';

const FOUNDER_ROLE = '1554346778801995866';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const data = new SlashCommandBuilder()
  .setName('banirmta')
  .setDescription('Banir jogador no MTA (exclusivo Fundador)')
  .addStringOption(option => option.setName('tipo').setDescription('Localizar por ID online ou conta cadastrada').setRequired(true)
    .addChoices({ name: 'ID online', value: 'id' }, { name: 'Conta', value: 'account' }))
  .addStringOption(option => option.setName('alvo').setDescription('ID numérico ou nome da conta').setRequired(true).setMaxLength(64))
  .addIntegerOption(option => option.setName('minutos').setDescription('0 = permanente; de 1 a 525600 minutos').setRequired(true).setMinValue(0).setMaxValue(525600))
  .addStringOption(option => option.setName('motivo').setDescription('Motivo do banimento').setRequired(true).setMinLength(3).setMaxLength(220));

export async function execute(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: '❌ Use este comando no servidor Discord.', flags: MessageFlags.Ephemeral });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.roles.cache.has(FOUNDER_ROLE)) return interaction.reply({ content: '❌ Apenas o cargo Fundador pode usar este comando.', flags: MessageFlags.Ephemeral });
  if (process.env.MTA_PUNISHMENTS_ENABLED !== 'true') return interaction.reply({ content: '🔒 Banimentos pelo Discord ainda estão em modo de teste e desativados.', flags: MessageFlags.Ephemeral });

  const targetType = interaction.options.getString('tipo', true);
  const target = interaction.options.getString('alvo', true).trim();
  const minutes = interaction.options.getInteger('minutos', true);
  const reason = interaction.options.getString('motivo', true).trim();
  if ((targetType === 'id' && !/^\d{1,10}$/.test(target)) || (targetType === 'account' && (!target || target.length > 64)) || reason.length < 3) {
    return interaction.reply({ content: '❌ Alvo ou motivo inválido.', flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const { id } = await createMtaPunishment({ action: 'ban', payload: { targetType, target, minutes, reason }, actor: { id: interaction.user.id } });
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
    console.error('[BML banirmta]', error);
    await interaction.editReply({ content: '❌ Não foi possível registrar ou confirmar o comando. Verifique os logs antes de tentar novamente.' });
  }
}
