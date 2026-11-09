import { getMtaLinkByDiscordId } from '../services/mtaVerification.js';
import { getCurrentVIPMemberships } from '../services/mtaVIPRoles.js';

const definition = {
  name: 'minhaconta',
  description: 'Consulte seu vínculo com o MTA e os vencimentos dos seus VIPs.'
};

const planNames = { streamer: 'Streamer', lite: 'Lite', sigma: 'Sigma', supremo: 'Supremo', mega: 'Mega' };

export const data = { name: definition.name, toJSON: () => definition };

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });
  try {
    const link = await getMtaLinkByDiscordId(interaction.user.id);
    if (!link) {
      await interaction.editReply({ content: 'Seu Discord ainda não está vinculado a uma conta do MTA. Use o painel de verificação do BML para vincular.' });
      return;
    }

    const memberships = getCurrentVIPMemberships(link.account);
    const plans = memberships?.map(({ plan, expires }) => `**VIP ${planNames[plan]}** · vence em <t:${expires}:f>`) ?? [];
    const vipText = memberships === null ? 'Os dados de VIP desta conta ainda não foram sincronizados.' :
      (plans.length ? plans.join('\n') : 'Nenhum VIP válido no momento.');

    await interaction.editReply({ embeds: [{
      title: 'Minha conta no BML',
      color: 0xb15cff,
      fields: [
        { name: 'Vinculação', value: 'Conta vinculada', inline: true },
        { name: 'ID no MTA', value: Number.isSafeInteger(link.playerID) && link.playerID > 0 ? String(link.playerID) : 'Ainda não registrado', inline: true },
        { name: 'VIPs válidos', value: vipText }
      ]
    }] });
  } catch (error) {
    console.error('[Minha conta] Falha na consulta:', error.code || error.message);
    await interaction.editReply({ content: 'Não consegui consultar sua conta agora. Tente novamente em instantes.' });
  }
}
