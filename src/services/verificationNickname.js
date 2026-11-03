export function verificationNickname(name, playerId) {
 if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 24 || /[\u0000-\u001f\u007f@`|]/u.test(name)) throw new Error('Use um nome de 2 a 24 caracteres, sem @, barras ou quebras de linha.');
 if (!Number.isSafeInteger(playerId) || playerId < 1 || playerId > 999999999) throw new Error('Seu ID ainda não chegou do jogo. Entre no servidor e confira o novo código.');
 const suffix=' | '+playerId;
 const chars=Array.from(name.trim().replace(/\s+/gu,' '));
 while(chars.join('').length+suffix.length>32)chars.pop();
 return chars.join('')+suffix;
}
export async function updateVerificationNickname(member, nickname) {
 try {
  if(member.nickname!==nickname)await member.setNickname(nickname,'Nome e ID confirmados pelo MTA BML');
  return '';
 } catch {
  return 'Sua conta foi vinculada, mas não consegui mudar o apelido. Confira a permissão Gerenciar apelidos e a posição do cargo do bot. O dono do Discord precisa mudar o próprio apelido.';
 }
}
