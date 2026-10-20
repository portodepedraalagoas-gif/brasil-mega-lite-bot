
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  initMtaVerification,
  createMtaCode
} from './mtaVerification.js';

import {
  initMtaPunishmentQueue,
  claimMtaPunishments,
  completeMtaPunishment,
  getMtaPunishment,
  cleanupMtaPunishments
} from './mtaPunishmentQueue.js';

// Brasil Mega Lite | Transcripts e API MTA

const directory =
  process.env.TRANSCRIPT_DIR || './data/transcripts';

const baseUrl =
  (process.env.TRANSCRIPT_BASE_URL || '').replace(/\/$/, '');

export async function saveTranscript(html) {
  if (!baseUrl || !/^https:\/\/[^\s/]+$/i.test(baseUrl)) {
    throw new Error(
      'Defina TRANSCRIPT_BASE_URL com a URL HTTPS publica do Railway, sem barra final.'
    );
  }

  await mkdir(directory, { recursive: true });

  const token = randomBytes(24).toString('hex');

  await writeFile(
    path.join(directory, `${token}.html`),
    html,
    {
      flag: 'wx',
      mode: 0o600
    }
  );

  return `${baseUrl}/transcript/${token}`;
}

function sendJson(res, status, data) {
  if (res.headersSent) return;

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });

  res.end(JSON.stringify(data));
}

function authorized(req) {
  const secret = process.env.MTA_API_SECRET;
  const header = req.headers.authorization;

  if (
    !secret ||
    typeof header !== 'string'
  ) {
    return false;
  }

  const expected = Buffer.from(
    `Bearer ${secret}`,
    'utf8'
  );

  const received = Buffer.from(
    header,
    'utf8'
  );

  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}

async function readJsonBody(req, maxBytes = 4096) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > maxBytes) {
      const error = new Error('Requisicao muito grande');
      error.statusCode = 413;
      throw error;
    }

    chunks.push(chunk);
  }

  try {
    return JSON.parse(
      Buffer.concat(chunks).toString('utf8')
    );
  } catch {
    const error = new Error('JSON invalido');
    error.statusCode = 400;
    throw error;
  }
}

function requirePost(req, res) {
  if (req.method === 'POST') {
    return true;
  }

  res.setHeader('Allow', 'POST');

  sendJson(res, 405, {
    error: 'Metodo nao permitido'
  });

  return false;
}

function requireAuthentication(req, res) {
  if (authorized(req)) {
    return true;
  }

  sendJson(res, 401, {
    error: 'Nao autorizado'
  });

  return false;
}

async function handleMtaStatus(req, res) {
  if (process.env.MTA_VERIFICATION_ENABLED !== 'true') {
    sendJson(res, 503, {
      error: 'Verificação ainda não habilitada'
    });
    return;
  }

  if (!requirePost(req, res)) return;
  if (!requireAuthentication(req, res)) return;

  try {
    const data = await readJsonBody(req);

    const account = data?.account;

    if (
      typeof account !== 'string' ||
      !account.trim() ||
      account.length > 64 ||
      account !== account.trim()
    ) {
      sendJson(res, 400, {
        error: 'Conta inválida'
      });
      return;
    }

    const result = await createMtaCode(account);

    sendJson(res, 200, result);
  } catch (error) {
    console.error(
      '[BML] Erro na API de verificacao MTA:',
      error
    );

    sendJson(
      res,
      error.statusCode || 400,
      {
        error:
          error.statusCode === 413
            ? 'Requisicao muito grande'
            : 'Requisicao invalida'
      }
    );
  }
}

// MTA consulta a fila autenticada.
async function handlePunishmentPoll(req, res) {
  if (!requirePost(req, res)) return;
  if (!requireAuthentication(req, res)) return;

  try {
    await cleanupMtaPunishments();

    const jobs = await claimMtaPunishments(5);

    sendJson(res, 200, {
      jobs
    });
  } catch (error) {
    console.error(
      '[BML Fila] Erro ao consultar punicoes:',
      error
    );

    sendJson(res, 503, {
      error: 'Fila temporariamente indisponivel'
    });
  }
}

// MTA informa se conseguiu executar a punicao.
async function handlePunishmentResult(req, res) {
  if (!requirePost(req, res)) return;
  if (!requireAuthentication(req, res)) return;

  let data;

  try {
    data = await readJsonBody(req);
  } catch (error) {
    sendJson(
      res,
      error.statusCode || 400,
      {
        error:
          error.statusCode === 413
            ? 'Requisicao muito grande'
            : 'JSON invalido'
      }
    );
    return;
  }

  if (
    typeof data?.id !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(data.id)
  ) {
    sendJson(res, 400, {
      error: 'ID invalido'
    });
    return;
  }

  if (
    typeof data.ok !== 'boolean' ||
    typeof data.message !== 'string' ||
    data.message.length > 500
  ) {
    sendJson(res, 400, {
      error: 'Resultado invalido'
    });
    return;
  }

  try {
    const outcome = await completeMtaPunishment(
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
    console.error(
      '[BML Fila] Erro ao registrar resultado:',
      error
    );

    sendJson(res, 503, {
      error: 'Nao foi possivel salvar o resultado'
    });
  }
}

export async function startTranscriptWebServer() {
  // Inicializa a verificacao ja existente.
  await initMtaVerification();

  // Recupera a fila persistente antes de abrir a API.
  await initMtaPunishmentQueue();

  const port = Number(process.env.PORT || 3000);

  const server = http.createServer(async (req, res) => {
    let pathname;

    try {
      pathname = new URL(
        req.url || '/',
        'http://localhost'
      ).pathname;
    } catch {
      sendJson(res, 400, {
        error: 'URL invalida'
      });
      return;
    }

    // Teste de autenticacao MTA -> Railway.
    if (pathname === '/auth-test') {
      if (!requirePost(req, res)) return;
      if (!requireAuthentication(req, res)) return;

      sendJson(res, 200, {
        authenticated: true
      });
      return;
    }

    // Busca de comandos pendentes.
    if (pathname === '/mta/punishments/poll') {
      await handlePunishmentPoll(req, res);
      return;
    }

    // Confirmacao do resultado pelo MTA.
    if (pathname === '/mta/punishments/result') {
      await handlePunishmentResult(req, res);
      return;
    }

    // Verificacao de contas MTA.
    if (pathname === '/status') {
      await handleMtaStatus(req, res);
      return;
    }

    // Demais rotas aceitam somente GET e HEAD.
    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD'
    ) {
      res.writeHead(405, {
        Allow: 'GET, HEAD'
      }).end();

      return;
    }

    // Saude do servidor.
    if (pathname === '/health') {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8'
      }).end('OK');

      return;
    }

    // Transcripts de tickets.
    const match =
      /^\/transcript\/([a-f0-9]{48})$/.exec(pathname);

    if (!match) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8'
      }).end('Não encontrado');

      return;
    }

    try {
      const html = await readFile(
        path.join(directory, `${match[1]}.html`)
      );

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy':
          "default-src 'none'; img-src https: data:; " +
          "style-src 'unsafe-inline'; base-uri 'none'; " +
          "form-action 'none'; frame-ancestors 'none'"
      });

      res.end(
        req.method === 'HEAD'
          ? undefined
          : html
      );
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(
          '[BML] Erro ao ler transcript:',
          error
        );
      }

      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8'
      }).end('Transcript não encontrado');
    }
  });

  server.listen(
    port,
    '0.0.0.0',
    () => {
      console.log(
        `🌐 Transcripts e API MTA na porta ${port}`
      );

      console.log(
        '🛡️ BML | Fila persistente de punicoes inicializada.'
      );
    }
  );

  return server;
}
