import { verificationNickname } from './verificationNickname.js';

import { randomInt } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = process.env.MTA_VERIFY_DIR || '/data/verification';
const FILE = path.join(DATA_DIR, 'links.json');
const TOKEN_TTL = 10 * 60;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 10 * 60;

let database = { links: {}, tokens: {} };
let initialized = false;
let queue = Promise.resolve();
const attempts = new Map();

const now = () => Math.floor(Date.now() / 1000);

async function save(links) {
  await mkdir(DATA_DIR, { recursive: true });
  const temporary = `${FILE}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify({ links }), {
    encoding: 'utf8',
    mode: 0o600
  });
  await rename(temporary, FILE);
}

export async function initMtaVerification() {
  if (initialized) return;

  await mkdir(DATA_DIR, { recursive: true });

  try {
    const loaded = JSON.parse(await readFile(FILE, 'utf8'));

    if (
      !loaded ||
      typeof loaded.links !== 'object' ||
      Array.isArray(loaded.links) ||
      !loaded.links
    ) {
      throw new Error('Arquivo de vínculos inválido.');
    }

    database.links = loaded.links;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  database.tokens = {};
  await save(database.links);
  initialized = true;
}

function locked(operation) {
  const result = queue.then(() => {
    if (!initialized) {
      throw new Error('Verificação MTA não inicializada.');
    }
    return operation();
  });

  queue = result.catch(() => {});
  return result;
}

export function getMtaLink(account) {
  return locked(() => database.links[account] || null);
}

export function createMtaCode(account, playerID) {
  return locked(() => {
    if (
      typeof account !== 'string' ||
      !account.trim() ||
      account.length > 64 ||
      account !== account.trim()
    ) {
      throw new Error('Conta MTA inválida.');
    }

    if (database.links[account]?.verified) {
      return { verified: true };
    }

    const current = database.tokens[account];

    if (current && current.expires > now()) {
      if (Number.isSafeInteger(playerID) && playerID > 0) current.playerID=playerID;
      return {
        verified: false,
        token: current.code,
        expires: current.expires
      };
    }

    for (const [name, token] of Object.entries(database.tokens)) {
      if (token.expires <= now()) {
        delete database.tokens[name];
      }
    }

    const used = new Set(
      Object.values(database.tokens).map(token => token.code)
    );

    let code;

    do {
      code = String(randomInt(0, 1000000)).padStart(6, '0');
    } while (used.has(code));

    const expires = now() + TOKEN_TTL;

    database.tokens[account] = { code, expires, playerID };

    return {
      verified: false,
      token: code,
      expires
    };
  });
}

// grantRole é uma função async que entrega o cargo no Discord.
// O vínculo só é salvo depois que essa função terminar sem erro.
export function confirmMtaCode(code, discordId, grantRole, displayName) {
  return locked(async () => {
    const id = String(discordId);
    const normalized = String(code).trim();

    if (typeof grantRole !== 'function') {
      throw new Error(
        'Confirmação indisponível: entrega do cargo não configurada.'
      );
    }

    const previous = attempts.get(id);

    const record = previous && previous.resetAt > now()
      ? previous
      : {
          count: 0,
          resetAt: now() + ATTEMPT_WINDOW
        };

    if (record.count >= MAX_ATTEMPTS) {
      throw new Error(
        'Muitas tentativas. Aguarde 10 minutos e tente novamente.'
      );
    }

    if (!/^\d{6}$/.test(normalized)) {
      record.count++;
      attempts.set(id, record);

      throw new Error('O código precisa ter exatamente 6 números.');
    }

    const entry = Object.entries(database.tokens).find(
      ([, token]) =>
        token.code === normalized &&
        token.expires > now()
    );

    if (!entry) {
      record.count++;
      attempts.set(id, record);

      throw new Error('Código inválido ou expirado. Confira o jogo.');
    }

    const [account] = entry;
    const existing = database.links[account];

    if (existing && existing.discordId !== id) {
      throw new Error(
        'Esta conta MTA já está vinculada a outro Discord.'
      );
    }

    const other = Object.entries(database.links).find(
      ([name, link]) =>
        name !== account &&
        link.discordId === id
    );

    if (other) {
      throw new Error(
        'Seu Discord já está vinculado a outra conta MTA.'
      );
    }

    const playerID=entry[1].playerID;
    const nickname=verificationNickname(displayName, playerID);
    await grantRole({nickname,playerID});

    const nextLinks = {
      ...database.links,
      [account]: {
        discordId: id,
        displayName: displayName.trim(),
        playerID,
        verified: true,
        updated: now()
      }
    };

    await save(nextLinks);

    database.links = nextLinks;
    delete database.tokens[account];
    attempts.delete(id);

    return {
      account,
      nickname,
      playerID,
      verified: true
    };
  });
}

export function revokeMtaDiscord(discordId) {
  return locked(async () => {
    const id = String(discordId);

    const entry = Object.entries(database.links).find(
      ([, link]) => link.discordId === id
    );

    if (!entry) return null;

    const [account, link] = entry;

    const nextLinks = {
      ...database.links,
      [account]: {
        ...link,
        verified: false,
        updated: now()
      }
    };

    await save(nextLinks);
    database.links = nextLinks;

    return account;
  });
}
