import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

// Railway: configure um volume persistente se quiser preservar as opções entre redeploys.
const DATA_FILE = process.env.AUTOMOD_DATA_FILE || path.resolve('data/automod.json');
const defaults = { flood: true, links: true, spam: true, allowedDomains: [], floodCount: 6, floodWindowMs: 6000, spamCount: 3, spamWindowMs: 15000 };
let settings = {};
try { settings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
const history = new Map();
const warnings = new Map();
function getSettings(guildId) { return { ...defaults, ...(settings[guildId] || {}) }; }
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
  const re = /(?:https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/)[^\s<>]+/gi;
  return [...content.matchAll(re)].map(m => m[0]);
}
function domainOf(link) {
  try { return new URL(/^https?:\/\//i.test(link) ? link : 'https://' + link).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}
async function logViolation(message, config, reason) {
  if (!config.automodLogChannelId) return;
  try {
    const ch = await message.guild.channels.fetch(config.automodLogChannelId);
    if (!ch?.isTextBased()) return;
    await ch.send({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('🛡️ BML • AutoMod')
      .addFields({ name: 'Membro', value: `<@${message.author.id}>`, inline: true },
        { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Motivo', value: reason },
        { name: 'Mensagem removida', value: (message.content || '(sem texto)').slice(0, 950) })
      .setTimestamp()] });
  } catch (err) { console.error('AutoMod log:', err.message); }
}
export async function handleAutoModMessage(message, config) {
  if (!message.guild || message.author.bot || !message.content || isStaff(message, config)) return;
  const opts = getSettings(message.guild.id);
  const key = `${message.guild.id}:${message.channel.id}:${message.author.id}`;
  const now = Date.now();
  const recent = (history.get(key) || []).filter(x => now - x.time < 20000);
  const normalized = message.content.toLowerCase().replace(/\s+/g, ' ').trim();
  recent.push({ time: now, text: normalized });
  history.set(key, recent);
  if (history.size > 10000) { for (const [k, v] of history) if (!v.some(x => now - x.time < 20000)) history.delete(k); }
  let reason = '';
  if (opts.links) {
    const links = findLinks(message.content);
    const unauthorized = links.find(link => {
      const host = domainOf(link);
      return !host || !opts.allowedDomains.some(domain => host === domain || host.endsWith('.' + domain));
    });
    if (unauthorized) reason = '🔗 Link não autorizado';
  }
  if (!reason && opts.spam && recent.filter(x => x.text === normalized && now - x.time <= opts.spamWindowMs).length >= opts.spamCount) reason = '📢 Mensagem repetida (antispam)';
  if (!reason && opts.flood && recent.filter(x => now - x.time <= opts.floodWindowMs).length >= opts.floodCount) reason = '🚫 Muitas mensagens em pouco tempo (antiflood)';
  if (!reason) return;
  try {
    if (!message.deletable) { console.warn('AutoMod: sem permissão para apagar mensagem', message.channel.id); return; }
    await message.delete();
    await logViolation(message, config, reason);
    const warnKey = `${message.guild.id}:${message.author.id}`;
    const last = warnings.get(warnKey) || 0;
    if (now - last > 10000) {
      warnings.set(warnKey, now);
      const notice = await message.channel.send({ content: `🛡️ <@${message.author.id}>, sua mensagem foi removida: **${reason}**.`, allowedMentions: { users: [message.author.id] } });
      setTimeout(() => notice.delete().catch(() => {}), 7000).unref?.();
    }
  } catch (err) { console.error('AutoMod:', err); }
}
function panel(guildId) {
  const o = getSettings(guildId);
  const embed = new EmbedBuilder().setColor(0x8e44ad).setTitle('🛡️ BML • Central AutoMod')
    .setDescription('Proteção automática dos canais. Administradores e staff são isentos.\n\n' +
      `🚫 **Antiflood:** ${o.flood ? '🟢 Ativo' : '🔴 Desativado'} (6 mensagens / 6 segundos)\n` +
      `🔗 **Antilinks:** ${o.links ? '🟢 Ativo' : '🔴 Desativado'}\n` +
      `📢 **Antispam:** ${o.spam ? '🟢 Ativo' : '🔴 Desativado'} (3 iguais / 15 segundos)\n\n` +
      `**Domínios liberados:** ${o.allowedDomains.length ? o.allowedDomains.map(x => '`'+x+'`').join(', ') : 'Nenhum'}`)
    .setFooter({ text: 'Brasil Mega Lite • Configuração restrita a administradores' });
  const row = new ActionRowBuilder().addComponents(
    ...[['flood','🚫 Antiflood'],['links','🔗 Antilinks'],['spam','📢 Antispam']].map(([id,label]) =>
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
  if (!['flood','links','spam'].includes(field)) return false;
  const o = getSettings(interaction.guildId);
  o[field] = !o[field];
  settings[interaction.guildId] = o;
  try { persist(); await interaction.update(panel(interaction.guildId)); }
  catch (err) { console.error('AutoMod config:', err); if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Não foi possível salvar a configuração.', ephemeral: true }); }
  return true;
}
