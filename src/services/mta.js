import { getServerInfo } from '@bsnext/mta-ase-query';
import { config } from '../config.js';

export async function queryMta() {
  const server = await getServerInfo(
    config.mtaHost,
    config.mtaPort,
    5000
  );

  console.log('========== MTA SERVER INFO ==========');
  console.dir(server, { depth: null });
  console.log('=====================================');

  return server;
}
