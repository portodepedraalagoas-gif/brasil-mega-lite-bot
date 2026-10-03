import { getServerInfo } from '@bsnext/mta-ase-query';
import { config } from '../config.js';

export async function queryMta() {
  return getServerInfo(config.mtaHost, config.mtaPort, 5000);
}
