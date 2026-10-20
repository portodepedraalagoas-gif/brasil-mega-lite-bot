
import { randomUUID } from 'node:crypto';

// Fila de comandos Discord -> MTA.
// Um comando so pode ser entregue a um MTA por vez.
// A confirmacao depende da resposta real do servidor MTA.

const jobs = new Map();

const JOB_TIMEOUT_MS = 2 * 60 * 1000;
const LEASE_MS = 30 * 1000;
const MAX_JOBS = 500;

const VALID_ACTIONS = new Set(['ban', 'unban']);

function publicJob(job) {
  return {
    id: job.id,
    action: job.action,
    payload: job.payload,
    actor: job.actor,
    createdAt: job.createdAt
  };
}

export function createMtaPunishment({
  action,
  payload,
  actor
}) {
  if (!VALID_ACTIONS.has(action)) {
    throw new Error('Acao de punicao invalida.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Dados da punicao invalidos.');
  }

  if (
    !actor ||
    typeof actor.id !== 'string' ||
    !/^\d{17,20}$/.test(actor.id)
  ) {
    throw new Error('Fundador invalido.');
  }

  if (jobs.size >= MAX_JOBS) {
    throw new Error('Fila de punicoes cheia.');
  }

  const id = randomUUID();
  const createdAt = Date.now();

  jobs.set(id, {
    id,
    action,
    payload: structuredClone(payload),
    actor: structuredClone(actor),
    createdAt,
    status: 'pending',
    leaseUntil: 0,
    attempts: 0,
    result: null
  });

  return { id };
}

export function claimMtaPunishments(limit = 5) {
  const now = Date.now();
  const result = [];

  for (const job of jobs.values()) {
    if (result.length >= Math.min(Math.max(limit, 1), 5)) break;

    if (job.status === 'done' || job.status === 'failed') continue;

    if (now - job.createdAt >= JOB_TIMEOUT_MS) {
      job.status = 'expired';
      continue;
    }

    if (
      job.status === 'pending' ||
      (job.status === 'leased' && job.leaseUntil <= now)
    ) {
      job.status = 'leased';
      job.leaseUntil = now + LEASE_MS;
      job.attempts += 1;
      result.push(publicJob(job));
    }
  }

  return result;
}

export function completeMtaPunishment(id, result) {
  const job = jobs.get(id);

  if (!job) {
    return { accepted: false, reason: 'not_found' };
  }

  if (job.status === 'done' || job.status === 'failed') {
    return { accepted: true, duplicate: true };
  }

  if (job.status === 'expired') {
    return { accepted: false, reason: 'expired' };
  }

  if (job.status !== 'leased') {
    return { accepted: false, reason: 'not_claimed' };
  }

  if (
    !result ||
    typeof result.ok !== 'boolean' ||
    typeof result.message !== 'string' ||
    result.message.length > 500
  ) {
    return { accepted: false, reason: 'invalid_result' };
  }

  job.status = result.ok ? 'done' : 'failed';
  job.result = {
    ok: result.ok,
    message: result.message,
    protocol: result.protocol ?? null
  };

  return { accepted: true, duplicate: false };
}

export function getMtaPunishment(id) {
  const job = jobs.get(id);

  if (!job) return null;

  return {
    id: job.id,
    status: job.status,
    result: job.result
  };
}

export function cleanupMtaPunishments() {
  const now = Date.now();

  for (const [id, job] of jobs) {
    if (
      (job.status === 'pending' || job.status === 'leased') &&
      now - job.createdAt >= JOB_TIMEOUT_MS
    ) {
      job.status = 'expired';
    }

    if (
      (job.status === 'done' ||
        job.status === 'failed' ||
        job.status === 'expired') &&
      now - job.createdAt >= 10 * 60 * 1000
    ) {
      jobs.delete(id);
    }
  }
}

