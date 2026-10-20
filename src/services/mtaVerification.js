
import { randomInt, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = process.env.MTA_VERIFY_DIR || '/data/verification';
const FILE = path.join(DATA_DIR, 'links.json');
const TOKEN_TTL = 10 * 60;

let database = { links: {}, tokens: {} };
let initialized = false;
let queue = Promise.resolve();

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function now() {
  return Math.floor(Date.now() / 1000);
}

async function save() {
  await mkdir(DATA_DIR, { recursive: true });

  const temporary = `${FILE}.tmp`;
  await writeFile(temporary, JSON.stringify(database), {
    encoding: 'utf8',
    mode: 0o600
  });

  await rename(temporary, FILE);
}

export async function initMtaVerification() {
  if (initialized) return;

  await mkdir(DATA_DIR, { recursive: true });

  try {
    database = JSON.parse(await readFile(FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  database.links ||= {};
  database.tokens = {};

  await save();
  initialized = true;
}

function locked(operation) {
  const result = queue.then(async () => {
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

export function createMtaCode(account) {
  return locked(async () => {
    const linked = database.links[account];

    if (linked?.verified) {
      return { verified: true };
    }

    const current = database.tokens[account];

    if (current && current.expires > now()) {
      return {
        verified: false,
        token: current.code,
        expires: current.expires
      };
    }

    const activeCodes = new Set(
      Object.values(database.tokens)
        .filter(item => item.expires > now())
        .map(item => item.code)
    );

    let code;

    do {
      code = String(randomInt(0, 1000000)).padStart(6, '0');
    } while (activeCodes.has(code));

    const expires = now() + TOKEN_TTL;

    database.tokens[account] = {
      code,
      expires
    };

    // O código temporário fica somente em memória.
    // O vínculo confirmado será persistido no Volume.
    return { verified: false, token: code, expires };
  });
}

export function confirmMtaCode(code, discordId) {
  return locked(async () => {
    const normalized = String(code).trim();

    if (!/^[0-9]{6}$/.test(normalized)) {
      throw new Error('O código precisa ter exatamente 6 números.');
    }

    const entry = Object.entries(database.tokens).find(
      ([, token]) =>
        token.code === normalized && token.expires > now()
    );

    if (!entry) {
      throw new Error('Código inválido ou expirado. Confira o jogo.');
    }

    const [account] = entry;
    const existing = database.links[account];

    if (existing && existing.discordId !== String(discordId)) {
      throw new Error('Esta conta MTA já está vinculada a outro Discord.');
    }

    const otherAccount = Object.entries(database.links).find(
      ([name, link]) =>
        name !== account &&
        link.discordId === String(discordId)
    );

    if (otherAccount) {
      throw new Error('Seu Discord já está vinculado a outra conta MTA.');
    }

    database.links[account] = {
      discordId: String(discordId),
      verified: true,
      updated: now()
    };

    await save();
    delete database.tokens[account];

    return { account, verified: true };
  });
}

export function revokeMtaDiscord(discordId) {
  return locked(async () => {
    for (const [account, link] of Object.entries(database.links)) {
      if (link.discordId === String(discordId)) {
        database.links[account] = {
          ...link,
          verified: false,
          updated: now()
        };

        await save();
        return account;
      }
    }

    return null;
  });
}
