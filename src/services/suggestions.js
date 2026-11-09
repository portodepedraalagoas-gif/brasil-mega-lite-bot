import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const idPattern = /^\d{17,20}$/;
const privateReply = { flags: 64, allowedMentions: { parse: [] } };
const noPings = { parse: [] };
const buttons = { 'bml_suggestion:up': 'up', 'bml_suggestion:down': 'down' };
const pending = new Map();
const cooldowns = new Map();
const cooldownMs = 60_000;

function storeDir() {
  return process.env.SUGGESTIONS_DATA_DIR?.trim() ||
    join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data', 'suggestions');
}

function fileFor(id) {
  if (!idPattern.test(id)) throw new Error('ID de mensagem inválido.');
  return join(storeDir(), `${id}.json`);
}

async function save(id, state) {
  const path = fileFor(id);
  const temp = `${path}.${randomUUID()}.tmp`;
  await mkdir(storeDir(), { recursive: true });
  try {
    await writeFile(temp, JSON.stringify(state), { flag: 'wx' });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true }).catch(() => {});
  }
}

function serialized(id, operation) {
  const task = (pending.get(id) || Promise.resolve()).catch(() => {}).then(operation);
  pending.set(id, task);
  return task.finally(() => { if (pending.get(id) === task) pending.delete(id); });
}

function voteRow(votes) {
  let up = 0, down = 0;
  for (const vote of Object.values(votes)) {
    if (vote === 'up') up++;
    if (vote === 'down') down++;
  }
  const total = up + down;
  const positivePercent = total ? Math.round(100 * up / total) : 0;
  const negativePercent = total ? 100 - positivePercent : 0;
  const label = (name, count, percent) => `${name} · ${count} (${percent}%)`;
  return [{ type: 1, components: [
    { type: 2, style: 3, custom_id: 'bml_suggestion:up', emoji: { name: '✅' }, label: label('A favor', up, positivePercent) },
    { type: 2, style: 4, custom_id: 'bml_suggestion:down', emoji: { name: '❌' }, label: label('Contra', down, negativePercent) }
  ] }];
}

export async function publishSuggestion(interaction, input) {
  const channelId = process.env.SUGGESTIONS_CHANNEL_ID?.trim();
  if (!interaction.inGuild() || !idPattern.test(channelId || '')) {
    await interaction.reply({ ...privateReply, content: 'O canal de sugestões ainda não foi configurado.' });
    return;
  }
  const idea = input.trim();
  if (idea.length < 5 || idea.length > 1000) {
    await interaction.reply({ ...privateReply, content: 'Escreva sua sugestão com 5 a 1.000 caracteres.' });
    return;
  }
  const userKey = `${interaction.guildId}:${interaction.user.id}`;
  const now = Date.now();
  for (const [key, deadline] of cooldowns) if (deadline <= now) cooldowns.delete(key);
  if (cooldowns.has(userKey)) {
    await interaction.reply({ ...privateReply, content: `Aguarde ${Math.ceil((cooldowns.get(userKey) - now) / 1000)} s para enviar outra sugestão.` });
    return;
  }
  const deadline = now + cooldownMs;
  cooldowns.set(userKey, deadline);
  let message, thread, saved = false;
  try {
    await interaction.deferReply(privateReply);
    const channel = await interaction.guild.channels.fetch(channelId);
    if (channel?.type !== 0 || channel.guildId !== interaction.guildId) {
      throw new Error('O destino precisa ser um canal de texto deste servidor.');
    }
    const bot = interaction.guild.members.me || await interaction.guild.members.fetchMe();
    if (!channel.permissionsFor(bot)?.has(['ViewChannel', 'SendMessages', 'EmbedLinks', 'CreatePublicThreads'])) {
      throw new Error('Faltam permissões para publicar ou criar tópicos no canal de sugestões.');
    }
    const timestamp = Math.floor(now / 1000);
    const safeIdea = idea.replace(/([\\`*_~|>\[\]#])/g, '\\$1');
    message = await channel.send({ allowedMentions: noPings, embeds: [{
      color: 0xb15cff,
      title: 'Nova sugestão',
      description: `Enviada por <@${interaction.user.id}> · <t:${timestamp}:f>\n\n${safeIdea}`,
      thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) },
      footer: { text: 'Brasil Mega Lite • Vote abaixo e converse no tópico.' }
    }] });
    thread = await message.startThread({ name: `Sugestão · ${message.id}`, autoArchiveDuration: 1440 });
    const state = { guildId: interaction.guildId, channelId, votes: {} };
    await save(message.id, state);
    saved = true;
    await message.edit({ components: voteRow(state.votes), allowedMentions: noPings });
  } catch (error) {
    if (cooldowns.get(userKey) === deadline) cooldowns.delete(userKey);
    if (saved) await rm(fileFor(message.id), { force: true }).catch(() => {});
    if (thread) await thread.delete('Não foi possível concluir a publicação da sugestão.').catch(() => {});
    if (message) await message.delete().catch(() => {});
    console.error('[Sugestões] Falha ao publicar:', error.code || error.message);
    const content = 'Não consegui publicar a sugestão. Avise a equipe para conferir o canal e as permissões do bot.';
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content }).catch(() => {});
    else await interaction.reply({ ...privateReply, content }).catch(() => {});
    return;
  }
  await interaction.editReply({ content: `✅ Sua sugestão foi publicada em <#${channelId}>. [Ver sugestão](${message.url}) · [Abrir tópico](${thread.url})` }).catch(() => {});
}

export async function handleSuggestionInteraction(interaction) {
  if (!interaction.isButton() || !Object.hasOwn(buttons, interaction.customId)) return false;
  if (!interaction.inGuild() || interaction.message.author?.id !== interaction.client.user.id) return false;
  const { message, guildId, channelId, user } = interaction;
  try {
    await interaction.deferReply(privateReply);
    const result = await serialized(message.id, async () => {
      let state;
      try {
        state = JSON.parse(await readFile(fileFor(message.id), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return 'Esta sugestão não tem votação disponível.';
        throw error;
      }
      if (state.guildId !== guildId || state.channelId !== channelId) return 'Esta votação não está disponível neste canal.';
      const choice = buttons[interaction.customId];
      const removed = state.votes[user.id] === choice;
      if (removed) delete state.votes[user.id];
      else state.votes[user.id] = choice;
      await save(message.id, state);
      try {
        await message.edit({ components: voteRow(state.votes), allowedMentions: noPings });
      } catch (error) {
        console.error('[Sugestões] Falha ao atualizar placar:', error.code || error.message);
        return 'Sua escolha foi salva, mas não consegui atualizar o placar agora.';
      }
      return removed ? 'Seu voto foi retirado.' : `Voto registrado: ${choice === 'up' ? 'a favor' : 'contra'}.`;
    });
    await interaction.editReply({ content: result }).catch(() => {});
  } catch (error) {
    console.error('[Sugestões] Falha na votação:', error.code || error.message);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'Não consegui registrar seu voto. Tente novamente.' }).catch(() => {});
    }
  }
  return true;
}
