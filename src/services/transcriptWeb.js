
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  initMtaVerification,
  createMtaCode
} from './mtaVerification.js';

import {
  claimMtaPunishments,
  completeMtaPunishment,
  getMtaPunishment,
  cleanupMtaPunishments
} from './mtaPunishmentQueue.js';

// No Railway, monte um Volume em /data e defina TRANSCRIPT_DIR=/data/transcripts.
const directory = process.env.TRANSCRIPT_DIR || './data/transcripts';
const baseUrl = (process.env.TRANSCRIPT_BASE_URL || '').replace(/\/$/, '');

export async function saveTranscript(html) {
  if (!baseUrl || !/^https:\/\/[^\s/]+$/i.test(baseUrl)) {
    throw new Error('Defina TRANSCRIPT_BASE_URL com a URL HTTPS pública do Railway, sem barra final.');
  }
  await mkdir(directory, { recursive: true });
  const token = randomBytes(24).toString('hex');
  await writeFile(path.join(directory, `${token}.html`), html, { flag: 'wx', mode: 0o600 });
  return `${baseUrl}/transcript/${token}`;
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function authorized(req) {
  const secret = process.env.MTA_API_SECRET;
  const header = req.headers.authorization;
  if (!secret || typeof header !== 'string') return false;

  // O resource Lua original envia "Authorization: Bearer <chave>".
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const received = Buffer.from(header, 'utf8');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function handleMtaStatus(req, res) {
  if (process.env.MTA_VERIFICATION_ENABLED !== 'true') {
    sendJson(res, 503, { error: 'Verificação ainda não habilitada' });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Método não permitido' });
    return;
  }
  if (!authorized(req)) {
    sendJson(res, 401, { error: 'Não autorizado' });
    return;
  }

  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4096) {
        sendJson(res, 413, { error: 'Requisição muito grande' });
        return;
      }
      chunks.push(chunk);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const account = data?.account;
    if (
      typeof account !== 'string' ||
      !account.trim() ||
      account.length > 64 ||
      account !== account.trim()
    ) {
      sendJson(res, 400, { error: 'Conta inválida' });
      return;
    }

    const result = await createMtaCode(account);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Erro na API MTA:', error);
    if (!res.headersSent) {
      sendJson(res, 400, { error: 'Requisição inválida' });
    }
  }
}

export async function startTranscriptWebServer() {
  await initMtaVerification();

  const port = Number(process.env.PORT || 3000);
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;

    if (pathname === '/auth-test') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Método não permitido' });
        return;
      }

      if (!authorized(req)) {
        sendJson(res, 401, { error: 'Chave inválida' });
        return;
      }

      sendJson(res, 200, { authenticated: true });
      return;
    }

    // MTA busca as punicoes pendentes.
    if (pathname === '/mta/punishments/poll') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, { error: 'Metodo nao permitido' });
        return;
      }

      if (!authorized(req)) {
        sendJson(res, 401, { error: 'Nao autorizado' });
        return;
      }

      cleanupMtaPunishments();

      const jobs = claimMtaPunishments(5);

      sendJson(res, 200, { jobs });
      return;
    }

    
    // MTA informa o resultado de uma punicao.
    if (pathname === '/mta/punishments/result') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, { error: 'Metodo nao permitido' });
        return;
      }

      if (!authorized(req)) {
        sendJson(res, 401, { error: 'Nao autorizado' });
        return;
      }

      try {
        const chunks = [];
        let size = 0;

        for await (const chunk of req) {
          size += chunk.length;

          if (size > 4096) {
            sendJson(res, 413, { error: 'Requisicao muito grande' });
            return;
          }

          chunks.push(chunk);
        }

        const data = JSON.parse(
          Buffer.concat(chunks).toString('utf8')
        );

        if (
          typeof data?.id !== 'string' ||
          !/^[a-f0-9-]{36}$/i.test(data.id)
        ) {
          sendJson(res, 400, { error: 'ID invalido' });
          return;
        }

        const outcome = completeMtaPunishment(
          data.id,
          {
            ok: data.ok,
            message: data.message,
            protocol: data.protocol ?? null
          }
        );

        if (!outcome.accepted) {
          sendJson(res, 409, {
            error: 'Resultado nao aceito',
            reason: outcome.reason
          });
          return;
        }

        sendJson(res, 200, {
          received: true,
          duplicate: outcome.duplicate === true
        });
      } catch (error) {
        console.error('[BML] Erro ao receber resultado MTA:', error);

        if (!res.headersSent) {
          sendJson(res, 400, {
            error: 'Requisicao invalida'
          });
        }
      }

      return;
    }

    
    if (pathname === '/status') {
      await handleMtaStatus(req, res);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('OK');
      return;
    }

    const match = /^\/transcript\/([a-f0-9]{48})$/.exec(pathname);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
      return;
    }

    try {
      const html = await readFile(path.join(directory, `${match[1]}.html`));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
      res.end(req.method === 'HEAD' ? undefined : html);
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('Erro ao ler transcript:', error);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Transcript não encontrado');
    }
  });

  server.listen(port, '0.0.0.0', () => console.log(`🌐 Transcripts e API MTA na porta ${port}`));
  return server;
}
