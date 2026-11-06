import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

// Desativado por padrão. Cada identificador realiza o reset uma única vez.
export async function resetVerificationOnce(links, saveLinks, directory, { env = process.env, logger = console } = {}) {
  const id = env.BML_RESET_LINKS;
  if (!id) return links;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('BML_RESET_LINKS inválido; use uma data como 2026-11-06');
  const marker = path.join(directory, `reset-links-${id}.done.json`);
  try {
    const done = JSON.parse(await readFile(marker, 'utf8'));
    if (done.id !== id || done.complete !== true) throw new Error('Marcador de reset inválido');
    logger.log('[BML Reset] Este reset já foi concluído; vínculos novos preservados.');
    return links;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const backup = path.join(directory, `links-backup-${id}.json`);
  try {
    await writeFile(backup, JSON.stringify({ links }), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = JSON.parse(await readFile(backup, 'utf8'));
    if (!previous.links || typeof previous.links !== 'object' || Array.isArray(previous.links)) throw new Error('Backup de vínculos inválido');
  }
  // Confirma que existe um backup legível antes de gravar a base vazia.
  const check = JSON.parse(await readFile(backup, 'utf8'));
  if (!check.links || typeof check.links !== 'object' || Array.isArray(check.links)) throw new Error('Falha na validação do backup');
  await saveLinks({});
  const temp = `${marker}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify({ id, complete: true, created: Date.now() }), { encoding: 'utf8', mode: 0o600 });
  await rename(temp, marker);
  logger.log(`[BML Reset] Vínculos Discord zerados. Backup: links-backup-${id}.json`);
  return {};
}
