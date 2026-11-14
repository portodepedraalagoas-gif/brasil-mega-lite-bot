import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';

// Shared by the startup preflight and every Discord REST client in this process.
export function createDiscordPause({file=process.env.DISCORD_CONNECTION_STATE_FILE || '/data/discord-connection.json',now=Date.now,log=console}={}) {
 let until=0,loaded=false,loading,writes=Promise.resolve();
 async function load(){
  if(loaded)return;
  if(!loading)loading=(async()=>{try{until=Math.max(until,Number(JSON.parse(await readFile(file,'utf8')).until)||0);}catch(e){if(e.code!=='ENOENT')log.warn('[BML Proteção] Não foi possível ler a pausa persistida.');}loaded=true;})();
  await loading;
 }
 async function remaining(){await load();return Math.max(0,until-now());}
 async function pause(ms,reason){
  await load();const end=now()+Math.max(0,ms);if(end<=until)return;
  until=end;
  const value=JSON.stringify({until,reason});
  writes=writes.catch(()=>{}).then(async()=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',value,{mode:0o600});await rename(file+'.tmp',file);});
  try{await writes;}catch{log.error('[BML Proteção] Falha ao salvar pausa; evite reiniciar o serviço.');}
  log.warn('[BML Proteção] Requisições Discord pausadas até',new Date(until).toISOString(),reason);
 }
 async function assertAllowed(){const delay=await remaining();if(delay>0)throw Object.assign(new Error('Discord em pausa; nenhuma solicitação foi enviada.'),{code:'BML_DISCORD_PAUSED',retryAfter:delay});}
 return {remaining,pause,assertAllowed};
}
export const discordPause=createDiscordPause();
export function responseDelay(response,body,now=Date.now()) {
 const header=response.headers.get('retry-after');const seconds=header===null?NaN:Number(header);
 const date=header&&!Number.isFinite(seconds)?Date.parse(header):NaN;
 const raw=Number(body?.retry_after);
 return Math.ceil(Math.max(Number.isFinite(seconds)?seconds*1000:0,Number.isFinite(date)?date-now:0,Number.isFinite(raw)?raw*1000:0,1000))+2000;
}
