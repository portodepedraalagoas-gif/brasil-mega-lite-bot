import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

const DATA_FILE = process.env.AUTOMOD_DATA_FILE || path.resolve('data/automod.json');
const defaults = { flood: true, links: true, spam: true, allowedDomains: [], floodCount: 6, floodWindowMs: 6000, spamCount: 3, spamWindowMs: 15000 };
let settings = {};
try { settings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
const history = new Map();
const warnings = new Map();
const offenses = new Map();
const getSettings = guildId => ({ ...defaults, ...(settings[guildId] || {}) });
function persist() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2));
}
function isStaff(message, config) {
  return message.member?.permissions.has(PermissionFlagsBits.ManageMessages) ||
    message.member?.permissions.has(PermissionFlagsBits.Administrator) ||
    (config.staffRoleId && message.member?.roles.cache.has(config.staffRoleId));
}
function findLinks(content) {
  // URLs com protocolo, www, convites Discord e domínios comuns sem protocolo.
  const re = /(?:https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/)[^\s<>]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|gg|io|br|dev|app|xyz|me|link|site|info|tv|co|shop)(?:\/[^\s<>]*)?/gi;
  return [...content.matchAll(re)].map(m => m[0]);
}
function domainOf(link) {
  try { return new URL(/^https?:\/\//i.test(link) ? link : 'https://' + link).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}
async function logViolation(message, config, reason, removed, failures) {
  if (!config.automodLogChannelId) return;
  try {
    const ch = await message.guild.channels.fetch(config.automodLogChannelId);
    if (!ch?.isTextBased()) return;
    await ch.send({ embeds: [new EmbedBuilder().setColor(failures ? 0xe67e22 : 0xe74c3c)
      .setTitle('🛡️ BML • AutoMod')
      .addFields(
        { name: 'Membro', value: `<@${message.author.id}>`, inline: true },
        { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Motivo', value: reason },
        { name: 'Exclusões', value: `${removed} removida(s), ${failures} falha(s)` },
        { name: 'Mensagem', value: (message.content || '(sem texto)').slice(0, 950) }
      ).setTimestamp()] });
  } catch (err) { console.error('AutoMod log:', err); }
}
async function removeMessages(messages) {
  let removed = 0, failures = 0;
  for (const msg of messages) {
    try {
      if (!msg.deletable) { failures++; console.warn('AutoMod: mensagem não pode ser apagada', msg.id, msg.channelId); continue; }
      await msg.delete();
      removed++;
    } catch (err) {
      failures++;
      console.error('AutoMod: erro ao apagar mensagem', msg.id, err);
    }
  }
  return { removed, failures };
}
export async function handleAutoModMessage(message, config) {
  if (!message.guild || message.author.bot || !message.content || isStaff(message, config)) return;
  const opts = getSettings(message.guild.id);
  if (!opts.links && !opts.spam && !opts.flood) return;
  const key = `${message.guild.id}:${message.channel.id}:${message.author.id}`;
  const now = Date.now();
  const windowMs = Math.max(opts.floodWindowMs, opts.spamWindowMs, 20000);
  const recent = (history.get(key) || []).filter(x => now - x.time <= windowMs);
  const normalized = message.content.toLowerCase().replace(/\s+/g, ' ').trim();
  recent.push({ time: now, text: normalized, message });
  history.set(key, recent);
  if (history.size > 10000) {
    for (const [k, entries] of history) if (!entries.some(x => now - x.time <= windowMs)) history.delete(k);
  }

  let reason = '';
  let targets = [message];
  if (opts.links) {
    const links = findLinks(message.content);
    const unauthorized = links.find(link => {
      const host = domainOf(link);
      return !host || !opts.allowedDomains.some(d => {
        const domain = String(d).toLowerCase().replace(/^www\./, '');
        return host === domain || host.endsWith('.' + domain);
      });
    });
    if (unauthorized) reason = '🔗 Link não autorizado';
  }
  if (!reason && opts.spam) {
    const duplicates = recent.filter(x => x.text === normalized && now - x.time <= opts.spamWindowMs);
    if (duplicates.length >= opts.spamCount) {
      reason = '📢 Mensagem repetida (antispam)';
      targets = duplicates.map(x => x.message);
    }
  }
  if (!reason && opts.flood) {
    const burst = recent.filter(x => now - x.time <= opts.floodWindowMs);
    if (burst.length >= opts.floodCount) {
      reason = '🚫 Muitas mensagens em pouco tempo (antiflood)';
      targets = burst.map(x => x.message);
    }
  }
  if (!reason) return;

  // Limpa do histórico mensagens envolvidas na infração, evitando contagem duplicada.
  const ids = new Set(targets.map(m => m.id));
  history.set(key, recent.filter(x => !ids.has(x.message.id)));
  const { removed, failures } = await removeMessages([...new Map(targets.map(m => [m.id, m])).values()]);
  await logViolation(message, config, reason, removed, failures);
  if (!removed) return;

  const warnKey = `${message.guild.id}:${message.author.id}`;
  const last = warnings.get(warnKey) || 0;
  if (now - last > 10000) {
    warnings.set(warnKey, now);
    try {
      const notice = await message.channel.send({
        content: `🛡️ <@${message.author.id}>, ${removed} mensagem(ns) removida(s): **${reason}**.`,
        allowedMentions: { users: [message.author.id] }
      });
      setTimeout(() => notice.delete().catch(() => {}), 7000).unref?.();
    } catch (err) { console.error('AutoMod aviso:', err); }
  }
  // Timeout somente após 3 infrações em 60 segundos. Evita punir por uma única rajada.
  const previous = (offenses.get(warnKey) || []).filter(t => now - t <= 60000);
  previous.push(now);
  offenses.set(warnKey, previous);
  if (previous.length >= 3) {
    offenses.delete(warnKey);
    try {
      const member = message.member;
      if (member?.moderatable) await member.timeout(60000, 'BML AutoMod: reincidência em flood/spam/links');
      else console.warn('AutoMod: membro não pode receber timeout', message.author.id);
    } catch (err) { console.error('AutoMod timeout:', err); }
  }
}
function panel(guildId) {
  const o = getSettings(guildId);
  const embed = new EmbedBuilder().setColor(0x8e44ad).setTitle('🛡️ BML • Central AutoMod')
    .setDescription('Proteção automática dos canais. Administradores e staff são isentos.\n\n' +
      `🚫 **Antiflood:** ${o.flood ? '🟢 Ativo' : '🔴 Desativado'} (${o.floodCount} mensagens / ${o.floodWindowMs / 1000} segundos)\n` +
      `🔗 **Antilinks:** ${o.links ? '🟢 Ativo' : '🔴 Desativado'}\n` +
      `📢 **Antispam:** ${o.spam ? '🟢 Ativo' : '🔴 Desativado'} (${o.spamCount} iguais / ${o.spamWindowMs / 1000} segundos)\n\n` +
      `**Domínios liberados:** ${o.allowedDomains.length ? o.allowedDomains.map(x => '`' + x + '`').join(', ') : 'Nenhum'}\n\n` +
      'Reincidência: 3 infrações em 60 segundos → timeout de 1 minuto.')
    .setFooter({ text: 'Brasil Mega Lite • Configuração restrita a administradores' });
  const row = new ActionRowBuilder().addComponents(
    ...[['flood', '🚫 Antiflood'], ['links', '🔗 Antilinks'], ['spam', '📢 Antispam']].map(([id, label]) =>
      new ButtonBuilder().setCustomId('bml_automod_toggle_' + id).setLabel(label).setStyle(o[id] ? ButtonStyle.Success : ButtonStyle.Secondary)));
  return { embeds: [embed], components: [row] };
}
export async function showAutoModPanel(interaction) {
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ Apenas administradores podem configurar o AutoMod.', ephemeral: true }); return;
  }
  await interaction.reply({ ...panel(interaction.guildId), ephemeral: true });
}
export async function handleAutoModInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('bml_automod_toggle_')) return false;
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ Sem permissão.', ephemeral: true }); return true;
  }
  const field = interaction.customId.slice('bml_automod_toggle_'.length);
  if (!['flood', 'links', 'spam'].includes(field)) return false;
  const o = getSettings(interaction.guildId);
  o[field] = !o[field];
  settings[interaction.guildId] = o;
  try { persist(); await interaction.update(panel(interaction.guildId)); }
  catch (err) { console.error('AutoMod config:', err); if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Não foi possível salvar a configuração.', ephemeral: true }); }
  return true;
}
