
export function verificationNickname(name, playerId) {
  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 24 ||
    /[\u0000-\u001f\u007f@`|]/u.test(name)
  ) {
    throw new Error(
      'Use um nome de 2 a 24 caracteres, sem @, barras ou quebras de linha.'
    );
  }

  if (
    !Number.isSafeInteger(playerId) ||
    playerId < 1 ||
    playerId > 999999999
  ) {
    throw new Error(
      'Seu ID ainda não chegou do jogo. Entre no servidor e confira o novo código.'
    );
  }

  const suffix = ' | ' + playerId;
  const chars = Array.from(
    name.trim().replace(/\s+/gu, ' ')
  );

  while (chars.join('').length + suffix.length > 32) {
    chars.pop();
  }

  return chars.join('') + suffix;
}

export async function updateVerificationNickname(member, nickname) {
  try {
    const guild = member.guild;

    const updatedMember = await guild.members.fetch({
      user: member.id,
      force: true
    });

    const botMember = await guild.members.fetchMe();

    if (!updatedMember.manageable) {
      console.warn('[BML Apelido] Membro não gerenciável:', {
        userId: updatedMember.id,
        isOwner: guild.ownerId === updatedMember.id,
        botHighestRole: botMember.roles.highest.position,
        memberHighestRole: updatedMember.roles.highest.position
      });

      return (
        'Sua conta foi vinculada, mas o Discord não permite ' +
        'que o bot altere seu apelido. Verifique os registros ' +
        'do Railway para identificar o motivo.'
      );
    }

    if (updatedMember.nickname !== nickname) {
      await updatedMember.setNickname(
        nickname,
        'Nome e ID confirmados pelo MTA BML'
      );
    }

    console.log(
      `[BML Apelido] Apelido confirmado para ${updatedMember.id}`
    );

    return '';

  } catch (error) {
    console.error('[BML Apelido] Falha:', {
      code: error.code ?? 'sem código',
      status: error.status ?? 'sem status',
      message: error.message ?? String(error)
    });

    return (
      'Sua conta foi vinculada, mas não foi possível ' +
      'atualizar o apelido. A administração pode consultar ' +
      'o erro nos logs do Railway.'
    );
  }
}
