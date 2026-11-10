import { fileURLToPath } from 'node:url';

export const welcomeChannelId = '1554349919689642105';
const banner = fileURLToPath(new URL('../assets/bml-welcome.png', import.meta.url));

export async function sendWelcomeCard(member, verificationChannelId) {
  if (member.user.bot) return;
  try {
    const channel = await member.guild.channels.fetch(welcomeChannelId);
    if (!channel?.isTextBased() || typeof channel.send !== 'function') {
      console.error('[BML Boas-vindas] Canal de boas-vindas indisponível:', welcomeChannelId);
      return;
    }

    const mention = `<@${member.id}>`;
    const avatar = member.displayAvatarURL({ size: 256 });
    const lines = [
      `Olá, ${mention}! Que bom ter você no **Brasil Mega Lite**. 💜`,
      'Fique à vontade para conhecer a comunidade. A gente se vê na cidade! 🚀'
    ];
    if (verificationChannelId === welcomeChannelId) {
      lines.push('Clique em **Verificar** no painel do canal para liberar seu acesso.');
    }
    await channel.send({
      content: mention,
      allowedMentions: { parse: [], users: [member.id] },
      embeds: [{
        color: 0xa832ed,
        author: { name: `@${member.user.username}`, icon_url: avatar },
        title: '👋 Bem-vindo(a)!',
        description: lines.join('\n\n'),
        thumbnail: { url: avatar },
        image: { url: 'attachment://bml-welcome.png' },
        footer: { text: `ID do usuário: ${member.id}` }
      }],
      files: [{ attachment: banner, name: 'bml-welcome.png' }]
    });
  } catch (error) {
    console.error('[BML Boas-vindas] Falha ao enviar cartão:', error.code || error.message);
  }
}
