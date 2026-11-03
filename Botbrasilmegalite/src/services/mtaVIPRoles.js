import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { getMtaLink } from './mtaVerification.js';
import { vipRoles, desiredPlan, validateSnapshot } from './vipRoleConfig.js';
const dir=process.env.MTA_VERIFY_DIR || '/data/verification';
const file=path.join(dir,'vip_roles.json');
let records=new Map(),storage=Promise.resolve(),work=Promise.resolve(),client,guildId;
const due=new Map();
function locked(fn){const result=storage.then(fn);storage=result.catch(()=>{});return result;}
async function save(){await mkdir(dir,{recursive:true});const temp=file+'.tmp';await writeFile(temp,JSON.stringify({records:Object.fromEntries(records)}),{mode:0o600});await rename(temp,file);}
export async function initMtaVIPRoles(){
 try{const saved=JSON.parse(await readFile(file,'utf8'));for(const [account,row]of Object.entries(saved.records || {})){validateSnapshot(row);records.set(account,row);}}
 catch(e){if(e.code!=='ENOENT')throw e;}
}
export async function acceptVIPSnapshot(input){
 const snapshot=validateSnapshot(input);
 await locked(async()=>{
  const old=records.get(snapshot.account);
  if(old && old.version>snapshot.version)throw Object.assign(new Error('Snapshot anterior ao atual'),{statusCode:409});
  if(old && old.version===snapshot.version && JSON.stringify(validateSnapshot(old))!==JSON.stringify(snapshot))throw Object.assign(new Error('Versão repetida com conteúdo diferente'),{statusCode:409});
  records.set(snapshot.account,{...snapshot,lastDiscordId:old?.lastDiscordId || null});
  try{await save();}catch(e){if(old)records.set(snapshot.account,old);else records.delete(snapshot.account);throw e;}
 });
 enqueue(snapshot.account);
 return {accepted:true};
}
// Singular add/remove usam PUT/DELETE idempotentes; nunca substitui a lista inteira de cargos.
export async function applyVIPRoles(guild,userId,plan){
 let member;
 try{member=await guild.members.fetch(userId);}catch(e){if(e.code===10007)return;throw e;}
 const managed=[...new Set(Object.values(vipRoles))];
 const desired=plan?vipRoles[plan]:null;
 const bot=await guild.members.fetchMe();
 if(!bot.permissions.has(268435456n))throw new Error('Bot sem Gerenciar cargos');
 const changes=managed.filter(id=>member.roles.cache.has(id) && id!==desired);
 for(const id of [...changes,...(desired?[desired]:[])]){
  const role=await guild.roles.fetch(id);
  if(!role || role.managed || role.position>=bot.roles.highest.position)throw new Error('Cargo VIP inexistente ou acima do bot');
 }
 if(desired && !member.roles.cache.has(desired))await member.roles.add(desired,'VIP ativo no MTA BML');
 for(const id of changes)await member.roles.remove(id,'VIP trocado, vencido ou conta desvinculada no MTA BML');
}
async function reconcile(account){
 if(!client?.isReady())return;
 const guild=client.guilds.cache.get(guildId);if(!guild)throw new Error('Servidor Discord indisponível');
 const link=await getMtaLink(account);
 const row=records.get(account);if(!row)return;
 const userId=link?.verified?String(link.discordId):null;
 if(row.lastDiscordId && row.lastDiscordId!==userId)await applyVIPRoles(guild,row.lastDiscordId,null);
 const plan=desiredPlan(row);
 if(userId)await applyVIPRoles(guild,userId,plan);
 await locked(async()=>{const current=records.get(account);if(current){current.lastDiscordId=userId;await save();}});
 const now=Date.now();const expiries=row.memberships.filter(m=>m.expires*1000>now).map(m=>m.expires*1000+1000);
 due.set(account,userId?Math.min(now+300000,...expiries):now+60000);
}
function enqueue(account){
 work=work.then(()=>reconcile(account)).catch(e=>{
  due.set(account,Date.now()+60000);
  console.error('[BML VIP] Cargo pendente:',account,e.message);
 });
}
export function startVIPRoleSync(discordClient,id){
 client=discordClient;guildId=id;
 const scan=()=>{for(const account of records.keys())if((due.get(account)||0)<=Date.now()){due.set(account,Date.now()+60000);enqueue(account);}};
 scan();const timer=setInterval(scan,15000);timer.unref();
}

export function resyncVIPAccount(account){if(records.has(account))enqueue(account);}
