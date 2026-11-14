import {discordPause,responseDelay} from './discordPause.js';
// Transport uses Node's native fetch, as in the successful connection preflight.
// Discord.js still owns its queues and Retry-After handling; no rate-limit bypass.
export function createDiscordRequest(fetcher = globalThis.fetch, log = console, pause = discordPause) {
  const invalid=[];
  return async (url, init) => {
    await pause.assertAllowed();
    const pathname = new URL(url).pathname;
    const callback = /^\/api\/v\d+\/interactions\/\d+\/[^/]+\/callback$/.test(pathname);
    const started = Date.now();
    if(callback){
      const id=pathname.split('/')[4];
      const created=Number((BigInt(id)>>22n)+1420070400000n);
      if(started-created>=2800)throw Object.assign(new Error('Interação expirou antes do envio; chamada descartada localmente.'),{code:10062});
    }
    // Never print the URL: it contains an interaction/webhook token.
    const label = callback ? 'resposta inicial' : pathname.includes('/roles') ? 'cargos' : pathname.includes('/messages') ? 'mensagens' : pathname.includes('/invites') ? 'convites' : pathname.includes('/commands') ? 'comandos' : 'REST';
    const timeout = AbortSignal.timeout(callback ? 2500 : 15000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try {
      const response = await fetcher(url, { ...init, signal,
        ...(init.body && typeof init.body.getReader === 'function' ? {duplex:'half'} : {}) });
      if (callback || response.status >= 400) {
        log.log('[BML Resposta]', label, 'HTTP', response.status, Date.now()-started+'ms');
      }
      if (response.status === 429) {
        let body;try{body=await response.clone().json();}catch{}
        const delay=responseDelay(response,body);
        // Short per-route limits stay in Discord.js's own bucket queues.
        if(body?.global || response.headers.get('x-ratelimit-global')==='true' || delay>=60000) {
          await pause.pause(delay,'HTTP 429; respeitando Retry-After');
        }
        log.warn('[BML Resposta] Limite Discord; espera em segundos:',Math.ceil(delay/1000));
      }
      if ([401,403,404,429].includes(response.status) && response.headers.get('x-ratelimit-scope')!=='shared') {
        const now=Date.now();invalid.push(now);
        while(invalid.length && invalid[0]<now-600000)invalid.shift();
        // Conservative safety stop, far below Discord's invalid-request threshold.
        if(invalid.length>=20)await pause.pause(600000,'20 respostas inválidas em 10 minutos; revisar permissões/configuração');
      }
      return response;
    } catch (error) {
      log.error('[BML Resposta]', label, 'falhou:', error.name, error.cause?.code || error.code || '', Date.now()-started+'ms');
      throw error;
    }
  };
}

export const discordRESTOptions = {
  timeout: 15000,
  retries: 0,
  makeRequest: createDiscordRequest()
};

export function traceInteraction(interaction, log = console) {
  const started = Date.now();
  const name = interaction.commandName || interaction.customId || interaction.type;
  const age = started - interaction.createdTimestamp;
  if (age > 1500) log.warn('[BML Interação] Recebida com atraso:', name, age+'ms');
  let completed = false;
  const timer = setTimeout(() => {
    if (!interaction.replied && !interaction.deferred) {
      log.warn('[BML Interação] Sem confirmação inicial:', name, Date.now()-started+'ms');
    }
  }, 2200);
  timer.unref?.();
  for (const method of ['reply','deferReply','deferUpdate','update','showModal']) {
    if (typeof interaction[method] !== 'function') continue;
    const original = interaction[method].bind(interaction);
    interaction[method] = async (...args) => {
      log.log('[BML Interação] Enviando', method, name);
      try {
        const result = await original(...args);
        log.log('[BML Interação] Confirmada', method, name, Date.now()-started+'ms');
        return result;
      } catch (error) {
        // No token, payload, user input, or full request object in this diagnostic.
        log.error('[BML Interação] Falha na confirmação', method, name, error.code || error.name);
        throw error;
      }
    };
  }
  return () => {
    if (completed) return;
    completed = true;
    clearTimeout(timer);
    log.log('[BML Interação] Finalizada', name, 'respondida='+Boolean(interaction.replied || interaction.deferred), Date.now()-started+'ms');
  };
}
