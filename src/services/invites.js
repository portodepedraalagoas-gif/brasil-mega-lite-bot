import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const color = 0xb15cff;
const number = new Intl.NumberFormat('pt-BR');
const states = new Map();
const noMentions = { parse: [] };

export function inviteChannelId() {
  return process.env.INVITES_CHANNEL_ID?.trim() || '1557481603976921178';
}

export function inviteTotals(records) {
  const totals = new Map();
  for (const record of records.values()) {
    if (record.active && record.inviterId) {
      totals.set(record.inviterId, (totals.get(record.inviterId) || 0) + 1);
    }
  }
  return totals;
}

export function identifyInvite(previous, current, members) {
  if (!previous || previous.vanityUnknown || current.vanityUnknown) return null;
  let uses = 0;
  let origin;
  for (const [code, invite] of current.invites) {
    const before = previous.invites.get(code);
    if (!before && invite.uses > 0 && !(invite.createdAt >= previous.observedAt)) return null;
    const delta = invite.uses - (before?.uses ?? 0);
    if (delta <= 0) continue;
    if (!invite.inviterId || (origin && origin.inviterId !== invite.inviterId)) return null;
    origin = { kind: 'member', inviterId: invite.inviterId };
    uses += delta;
  }
  if (current.vanityCode && current.vanityCode === previous.vanityCode && current.vanityUses > previous.vanityUses) {
    if (origin) return null;
    origin = { kind: 'vanity', inviterId: null };
    uses = current.vanityUses - previous.vanityUses;
  }
  return uses === members && origin ? origin : null;
}

async function snapshot(guild) {
  const list = await guild.invites.fetch({ cache: false });
  const observedAt = Date.now();
  const invites = new Map();
  for (const invite of list.values()) {
    if (Number.isSafeInteger(invite.uses)) {
      invites.set(invite.code, {
        uses: invite.uses,
        inviterId: invite.inviter?.id,
        createdAt: invite.createdTimestamp
      });
    }
  }
  const vanityCode = guild.vanityURLCode;
  let vanityUses = 0;
  let vanityUnknown = false;
  if (vanityCode) {
    try {
      const vanity = await guild.fetchVanityData();
      vanityUses = vanity.uses;
      vanityUnknown = !Number.isSafeInteger(vanityUses) || vanity.code !== vanityCode;
    } catch {
      vanityUnknown = true;
    }
  }
  return { invites, observedAt, vanityCode, vanityUses, vanityUnknown };
}

export async function getInviteTotals(guildId) {
  const state = states.get(guildId);
  if (!state) return null;
  await state.ready;
  return inviteTotals(state.records);
}

export function startInviteTracking(client, guildId) {
  if (states.has(guildId)) return;
  const directory = process.env.INVITES_DATA_DIR?.trim() ||
    join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data', 'invites');
  const file = join(directory, guildId + '.json');
  const channelId = inviteChannelId();
  const state = { records: new Map(), baseline: null, pending: new Map(), timer: null };
  states.set(guildId, state);

  const logError = error => console.error('[BML Convites]', error.code || error.message);
  state.ready = (async () => {
    let entries;
    try {
      entries = JSON.parse(await readFile(file, 'utf8')).members;
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    if (!Array.isArray(entries)) throw new Error('Arquivo de convites inválido.');
    state.records = new Map(entries);
  })();
  let queue = state.ready.catch(logError);
  function enqueue(task) {
    queue = queue.then(async () => {
      await state.ready;
      await task();
    }).catch(logError);
  }
  async function save(records) {
    await mkdir(directory, { recursive: true });
    const temp = file + '.' + process.pid + '.tmp';
    await writeFile(temp, JSON.stringify({ members: [...records] }), { mode: 0o600 });
    await rename(temp, file);
    state.records = records;
  }
  async function announce(guild, embed) {
    try {
      const channel = await guild.channels.fetch(channelId);
      if (!channel?.isTextBased() || typeof channel.send !== 'function') {
        throw new Error('Confira INVITES_CHANNEL_ID e as permissões do canal.');
      }
      await channel.send({ embeds: [embed], allowedMentions: noMentions });
    } catch (error) {
      logError(error);
    }
  }
  async function refresh(guild) {
    try {
      return await snapshot(guild);
    } catch (error) {
      logError(error);
      return null;
    }
  }
  async function processJoins(batch) {
    const members = [...batch.values()].filter(member => {
      const previous = state.records.get(member.id);
      return !(previous?.active && previous.joinedAt === member.joinedTimestamp);
    });
    if (!members.length) return;
    const guild = members[0].guild;
    const current = await refresh(guild);
    const origin = current && identifyInvite(state.baseline, current, members.length);
    state.baseline = current;
    const records = new Map(state.records);
    const arrivals = [];
    for (const member of members) {
      const previous = records.get(member.id);
      const credit = previous || (origin?.inviterId === member.id ? null : origin);
      const record = {
        kind: credit?.kind || 'unknown',
        inviterId: credit?.inviterId || null,
        joinedAt: member.joinedTimestamp,
        active: true
      };
      records.set(member.id, record);
      arrivals.push({ member, record, returning: Boolean(previous) });
    }
    if (!arrivals.length) return;
    await save(records);
    const totals = inviteTotals(records);
    for (const { member, record, returning } of arrivals) {
      const lines = [`👋 <@${member.id}>, boas-vindas ao **${guild.name}**!`];
      if (record.inviterId) {
        lines.push(`🎟️ ${returning ? 'Convite original de' : 'Convite de'} <@${record.inviterId}>.`);
        lines.push(`🏆 Convites ativos: **${number.format(totals.get(record.inviterId))}**`);
      } else {
        lines.push(record.kind === 'vanity' ? '🔗 Entrada pelo link oficial do servidor.' : '🎟️ Convite de origem não identificado.');
      }
      await announce(guild, {
        title: returning ? 'De volta ao BML' : 'Mais um na comunidade',
        description: lines.join('\n'),
        color,
        thumbnail: { url: member.user.displayAvatarURL({ size: 128 }) },
        footer: { text: 'BML • Convites' },
        timestamp: new Date(member.joinedTimestamp || Date.now()).toISOString()
      });
    }
  }
  function flush() {
    clearTimeout(state.timer);
    state.timer = null;
    if (!state.pending.size) return;
    const batch = state.pending;
    state.pending = new Map();
    enqueue(() => processJoins(batch));
  }

  const guild = client.guilds.cache.get(guildId);
  if (guild) enqueue(async () => { state.baseline = await refresh(guild); });
  client.on('guildAvailable', availableGuild => {
    if (availableGuild.id === guildId) enqueue(async () => { state.baseline = await refresh(availableGuild); });
  });
  client.on('shardDisconnect', (_, shardId) => {
    if (client.guilds.cache.get(guildId)?.shardId === shardId) enqueue(() => { state.baseline = null; });
  });

  client.on('inviteCreate', invite => {
    if (invite.guild?.id !== guildId) return;
    enqueue(() => {
      state.baseline?.invites.set(invite.code, { uses: invite.uses ?? 0, inviterId: invite.inviter?.id });
    });
  });
  client.on('guildMemberAdd', member => {
    if (member.guild.id !== guildId || member.user.bot) return;
    state.pending.set(member.id, member);
    if (!state.timer) state.timer = setTimeout(flush, 1000);
  });
  client.on('guildMemberRemove', member => {
    if (member.guild.id !== guildId || member.user?.bot) return;
    flush();
    enqueue(async () => {
      const record = state.records.get(member.id);
      if (record && !record.active) return;
      if (record) {
        const records = new Map(state.records);
        records.set(member.id, { ...record, active: false });
        await save(records);
      }
      const lines = [`<@${member.id}> saiu do servidor.`];
      if (record?.inviterId) {
        const total = inviteTotals(state.records).get(record.inviterId) || 0;
        lines.push(`🎟️ <@${record.inviterId}> perdeu um convite ativo.`);
        lines.push(`🏆 Convites ativos: **${number.format(total)}**`);
      }
      await announce(member.guild, {
        title: 'Membro saiu',
        description: lines.join('\n'),
        color: 0x81748d,
        footer: { text: 'BML • Convites' },
        timestamp: new Date().toISOString()
      });
    });
  });
}
