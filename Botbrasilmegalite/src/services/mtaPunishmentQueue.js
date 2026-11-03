
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

// Brasil Mega Lite | Fila persistente Discord -> MTA
//
// A fila fica no volume do Railway.
// O MTA e responsavel por executar a punicao.
// O bot so deve confirmar sucesso depois do resultado do MTA.

const DATA_FILE =
  process.env.MTA_PUNISHMENT_QUEUE_FILE ||
  '/data/mta-punishments.json';

const JOB_TIMEOUT_MS = 2 * 60 * 1000;
const LEASE_MS = 30 * 1000;
const RESULT_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_JOBS = 500;

const VALID_ACTIONS = new Set(['ban', 'unban']);
const VALID_STATUSES = new Set([
  'pending',
  'leased',
  'done',
  'failed',
  'expired'
]);

const jobs = new Map();

let initialized = false;
let writeChain = Promise.resolve();

function publicJob(job) {
  return {
    id: job.id,
    action: job.action,
    payload: job.payload,
    actor: job.actor,
    createdAt: job.createdAt
  };
}

function snapshot() {
  return JSON.stringify(
    {
      version: 1,
      jobs: [...jobs.values()]
    },
    null,
    2
  );
}

function persist() {
  const content = snapshot();

  const operation = writeChain
    .catch(() => {})
    .then(async () => {
      const directory = path.dirname(DATA_FILE);

      await mkdir(directory, { recursive: true });

      const temporaryFile = `${DATA_FILE}.${randomUUID()}.tmp`;

      await writeFile(temporaryFile, content, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx'
      });

      await rename(temporaryFile, DATA_FILE);
    });

  writeChain = operation;

  return operation;
}

function assertInitialized() {
  if (!initialized) {
    throw new Error(
      'Fila MTA ainda nao inicializada.'
    );
  }
}

function validateActor(actor) {
  return (
    actor &&
    typeof actor === 'object' &&
    typeof actor.id === 'string' &&
    /^\d{17,20}$/.test(actor.id)
  );
}

function validatePayload(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload)
  );
}

function validateStoredJob(job) {
  return (
    job &&
    typeof job.id === 'string' &&
    /^[0-9a-f-]{36}$/i.test(job.id) &&
    VALID_ACTIONS.has(job.action) &&
    VALID_STATUSES.has(job.status) &&
    validatePayload(job.payload) &&
    validateActor(job.actor) &&
    Number.isFinite(job.createdAt)
  );
}

export async function initMtaPunishmentQueue() {
  if (initialized) return;

  await mkdir(path.dirname(DATA_FILE), {
    recursive: true
  });

  let content;

  try {
    content = await readFile(DATA_FILE, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    initialized = true;
    await persist();

    console.log(
      '[BML Fila] Arquivo persistente criado.'
    );

    return;
  }

  let saved;

  try {
    saved = JSON.parse(content);
  } catch {
    throw new Error(
      '[BML Fila] Arquivo de punicoes corrompido. ' +
      'Nao sera sobrescrito automaticamente.'
    );
  }

  if (
    saved?.version !== 1 ||
    !Array.isArray(saved.jobs)
  ) {
    throw new Error(
      '[BML Fila] Formato do arquivo persistente invalido.'
    );
  }

  jobs.clear();

  for (const job of saved.jobs) {
    if (!validateStoredJob(job)) {
      throw new Error(
        '[BML Fila] Comando salvo invalido.'
      );
    }

    if (jobs.has(job.id)) {
      throw new Error(
        '[BML Fila] ID duplicado no arquivo.'
      );
    }

    jobs.set(job.id, job);
  }

  initialized = true;

  console.log(
    `[BML Fila] ${jobs.size} comando(s) recuperado(s).`
  );
}

export async function createMtaPunishment({
  action,
  payload,
  actor
}) {
  assertInitialized();

  if (!VALID_ACTIONS.has(action)) {
    throw new Error('Acao de punicao invalida.');
  }

  if (!validatePayload(payload)) {
    throw new Error('Dados da punicao invalidos.');
  }

  if (!validateActor(actor)) {
    throw new Error('Fundador invalido.');
  }

  if (jobs.size >= MAX_JOBS) {
    throw new Error('Fila de punicoes cheia.');
  }

  const id = randomUUID();

  const job = {
    id,
    action,
    payload: structuredClone(payload),
    actor: structuredClone(actor),
    createdAt: Date.now(),
    status: 'pending',
    leaseUntil: 0,
    attempts: 0,
    result: null
  };

  jobs.set(id, job);

  try {
    await persist();
  } catch (error) {
    jobs.delete(id);
    throw error;
  }

  return { id };
}

export async function claimMtaPunishments(limit = 5) {
  assertInitialized();

  const now = Date.now();
  const result = [];
  let changed = false;

  const maximum = Math.min(
    Math.max(Number(limit) || 1, 1),
    5
  );

  for (const job of jobs.values()) {
    if (result.length >= maximum) break;

    if (
      job.status === 'done' ||
      job.status === 'failed' ||
      job.status === 'expired'
    ) {
      continue;
    }

    if (
      now - job.createdAt >= JOB_TIMEOUT_MS
    ) {
      job.status = 'expired';
      changed = true;
      continue;
    }

    if (
      job.status === 'pending' ||
      (
        job.status === 'leased' &&
        job.leaseUntil <= now
      )
    ) {
      job.status = 'leased';
      job.leaseUntil = now + LEASE_MS;
      job.attempts = (job.attempts || 0) + 1;

      result.push(publicJob(job));
      changed = true;
    }
  }

  if (changed) {
    await persist();
  }

  return result;
}

export async function completeMtaPunishment(id, result) {
  assertInitialized();

  const job = jobs.get(id);

  if (!job) {
    return {
      accepted: false,
      reason: 'not_found'
    };
  }

  if (
    job.status === 'done' ||
    job.status === 'failed'
  ) {
    return {
      accepted: true,
      duplicate: true
    };
  }

  if (job.status !== 'leased' &&
      job.status !== 'expired') {
    return {
      accepted: false,
      reason: 'not_claimed'
    };
  }

  if (
    !result ||
    typeof result.ok !== 'boolean' ||
    typeof result.message !== 'string' ||
    result.message.length > 500
  ) {
    return {
      accepted: false,
      reason: 'invalid_result'
    };
  }

  // Aceita resultado atrasado de um comando expirado
  // somente se ele realmente chegou a ser entregue.
  if (
    job.status === 'expired' &&
    !(job.attempts > 0)
  ) {
    return {
      accepted: false,
      reason: 'never_claimed'
    };
  }

  job.status = result.ok ? 'done' : 'failed';

  job.result = {
    ok: result.ok,
    message: result.message,
    protocol: result.protocol ?? null
  };

  job.completedAt = Date.now();

  await persist();

  return {
    accepted: true,
    duplicate: false
  };
}

export function getMtaPunishment(id) {
  assertInitialized();

  const job = jobs.get(id);

  if (!job) return null;

  return {
    id: job.id,
    status: job.status,
    result: job.result
  };
}

export async function cleanupMtaPunishments() {
  assertInitialized();

  const now = Date.now();
  let changed = false;

  for (const [id, job] of jobs) {
    if (
      (
        job.status === 'pending' ||
        job.status === 'leased'
      ) &&
      now - job.createdAt >= JOB_TIMEOUT_MS
    ) {
      job.status = 'expired';
      changed = true;
    }

    if (
      (
        job.status === 'done' ||
        job.status === 'failed' ||
        job.status === 'expired'
      ) &&
      now - (job.completedAt || job.createdAt) >=
        RESULT_RETENTION_MS
    ) {
      jobs.delete(id);
      changed = true;
    }
  }

  if (changed) {
    await persist();
  }
}
