import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

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

export function startTranscriptWebServer() {
  const port = Number(process.env.PORT || 3000);
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
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
  server.listen(port, '0.0.0.0', () => console.log(`🌐 Transcripts na porta ${port}`));
  return server;
}
