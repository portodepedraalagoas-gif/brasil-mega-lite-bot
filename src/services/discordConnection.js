import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

export function retryDelay(header, body, now = Date.now()) {
  const seconds = header == null ? NaN : Number(header);
  const date = header && !Number.isFinite(seconds) ? Date.parse(header) : NaN;
  const values = [Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 0,
    Number.isFinite(date) ? Math.max(0, date - now) : 0,
    Number.isFinite(body?.retry_after) && body.retry_after >= 0 ? body.retry_after * 1000 : 0];
  return Math.ceil(Math.max(...values, 60000)) + 2000;
}

export async function discordConnectionCheck(endpoint, token, options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const now = options.now || Date.now;
  const file = options.file || process.env.DISCORD_CONNECTION_STATE_FILE || '/data/discord-connection.json';
  const log = options.log || console;
  let until = 0;
  try { until = Number(JSON.parse(await readFile(file, 'utf8')).until) || 0; } catch {}
  while (true) {
    if (until > now()) {
      const seconds = Math.ceil((until - now()) / 1000);
      log.warn('[BML Conexão] Discord pediu uma pausa. Nova tentativa em ' +
        Math.floor(seconds / 3600) + 'h ' + Math.floor(seconds % 3600 / 60) +
        'min. Não reinicie o bot; ele tentará automaticamente.');
      while (until > now()) await sleep(Math.min(until - now(), 60000));
    }
    log.log('[BML Conexão] Consultando Discord', endpoint);
    const response = await fetcher('https://discord.com/api/v10' + endpoint, {
      headers: { Authorization: 'Bot ' + token.trim() }, signal: AbortSignal.timeout(15000)
    });
    log.log('[BML Conexão] Resposta HTTP', response.status, endpoint);

if (response.status === 429) {
  log.error('[BML Diagnóstico] Limite identificado:', {
    global: response.headers.get('x-ratelimit-global'),
    retryAfter: response.headers.get('retry-after'),
    remaining: response.headers.get('x-ratelimit-remaining'),
    limit: response.headers.get('x-ratelimit-limit'),
    resetAfter: response.headers.get('x-ratelimit-reset-after')
  });
}
    if (response.status === 429) {
      let body;
      try { body = await response.json(); } catch {}
      until = now() + retryDelay(response.headers.get('retry-after'), body, now());
      try {
        await mkdir(path.dirname(file), { recursive: true });
        const temporary = file + '.tmp';
        await writeFile(temporary, JSON.stringify({ until }), { mode: 0o600 });
        await rename(temporary, file);
      } catch { log.warn('[BML Conexão] Não foi possível salvar o prazo de espera em disco.'); }
      continue;
    }
    if (response.status === 401) throw new Error('DISCORD_TOKEN inválido ou revogado. Atualize a variável no Railway.');
    if (!response.ok) throw new Error('Discord respondeu HTTP ' + response.status + ' em ' + endpoint);
    return response.json();
  }
}
