import {RokuharaEmbed as EmbedBuilder} from './embed-theme.js';
import {PermissionFlagsBits,ButtonBuilder,ButtonStyle,ActionRowBuilder,TextInputBuilder,TextInputStyle,ModalBuilder,SlashCommandBuilder,AttachmentBuilder,MessageFlags,escapeMarkdown} from 'discord.js';
import {tx} from './db.js';
import {text} from './security.js';
import {renderCard} from './cards.js';
import {bothDivisions} from './identity.js';
const safe=value=>escapeMarkdown(String(value)).replace(/@/g,'＠');
const commands=['imigração','imigracao'];
const privateReply={flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}};
export const communityJobs=new Set(['welcome','report-resolution','immigration-decision']);
export function guideMessage(d){return {embeds:[new EmbedBuilder(d.id).setTitle('Como verificar • ROKUHARA').setDescription([
 '**IFJ — Identificação de Filiado Juramentado à ROKUHARA**',
 '1. Solicite seu cadastro à equipe. O IFJ tem 15 números e fica vinculado ao seu ID Discord.',
 `2. Abra <#${d.verification}> e clique em **Verificar meu IFJ**.`,
 '3. Informe seu IFJ no formulário privado e confira nome, nome no jogo, usuário Roblox e divisão.',
 '4. Se os dados forem seus, clique em **Sou eu**. Só então o bot libera os canais e o cargo da patente.',
 'Aliados, Líder, Sub líder e High member podem verificar nas duas divisões. Os demais entram apenas na divisão cadastrada.',
 'Dados incorretos? Cancele e procure a equipe. Não publique seu IFJ nos canais.',
 'Veio do servidor antigo? Clique em **Solicitar imigração** no aviso publicado pela administração e aguarde a análise. A aprovação chega no privado, com IFJ e carteira PNG.'
 ].join('\n\n'))],allowedMentions:{parse:[]}};}
export function createCommunity(pool,config,client){
 async function publishGuide(d){
  const ch=await client.channels.fetch(d.guide);
  if(!ch||ch.guildId!==d.guild||!ch.isTextBased()||!ch.send)throw new Error('Canal como-verificar inválido.');
  const old=(await pool.query('SELECT message_id FROM panels WHERE channel_id=$1',[d.guide])).rows[0];
  let message;if(old)message=await ch.messages.fetch(old.message_id).catch(e=>{if(e.code===10008)return null;throw e;});
  if(message)await message.edit(guideMessage(d));else{message=await ch.send(guideMessage(d));await pool.query('INSERT INTO panels(channel_id,message_id) VALUES($1,$2) ON CONFLICT(channel_id) DO UPDATE SET message_id=$2',[d.guide,message.id]);}
 }
 async function register(){
  if(!config.immigrationGuild)return;
  const g=await client.guilds.fetch(config.immigrationGuild);
  for(const name of commands)await g.commands.create(new SlashCommandBuilder().setName(name).setDescription('Publicar aviso de imigração com prazo de 10 dias e botão').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).toJSON());
 }
 async function interact(i){
  const command=i.isChatInputCommand?.()&&commands.includes(i.commandName);
  const submit=i.isModalSubmit?.()&&i.customId==='immigration-form';
  const click=i.isButton?.()&&i.customId==='immigration-open';
  if(!command&&!submit&&!click)return false;
  if(!config.immigrationGuild||i.guildId!==config.immigrationGuild){await i.reply({...privateReply,content:'Use esse comando no servidor antigo da ROKUHARA.'});return true;}
  if(command){
   await i.deferReply(privateReply);
   const g=await client.guilds.fetch(i.guildId);
   const actor=await g.members.fetch({user:i.user.id,force:true}).catch(e=>{if(e.code===10007)return null;throw e;});
   if(!actor||(g.ownerId!==i.user.id&&!actor.permissions.has(PermissionFlagsBits.Administrator))){await i.editReply('Somente o dono ou um administrador do servidor antigo pode publicar o aviso. Clique em Solicitar imigração no aviso para preencher seu pedido.');return true;}
   const notice=await tx(pool,async c=>{
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`immigration-notice:${i.guildId}`]);
    const n=(await c.query("INSERT INTO immigration_notices(guild_id,channel_id,deadline) VALUES($1,$2,now()+interval '10 days') ON CONFLICT(guild_id) DO UPDATE SET guild_id=EXCLUDED.guild_id RETURNING *",[i.guildId,i.channelId])).rows[0];
    const ch=await client.channels.fetch(n.channel_id);
    if(!ch||ch.guildId!==i.guildId||!ch.isTextBased()||!ch.send)throw new Error('Canal do aviso indisponível.');
    const timestamp=Math.floor(new Date(n.deadline).getTime()/1000);
    const content={embeds:[new EmbedBuilder().setTitle('ROKUHARA • Vamos imigrar!').setColor(0xc4f56d).setDescription(`Este servidor será excluído em 10 dias a partir da publicação deste aviso. Vamos migrar para os novos servidores da ROKUHARA!\n\n**Data anunciada:** <t:${timestamp}:F> (<t:${timestamp}:R>).\n\nClique em **Solicitar imigração** e informe seu nome no jogo e seu nome no Discord. A administração completará seu cadastro e analisará o pedido.\n\nSe aprovado, você receberá o IFJ e a carteira PNG no privado. Se recusado, receberá o motivo. Ative suas mensagens privadas para receber a resposta.`).setFooter({text:'A exclusão do servidor será feita manualmente pelo dono.'})],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('immigration-open').setLabel('Solicitar imigração').setStyle(ButtonStyle.Success))],allowedMentions:{parse:[]}};
    let message;if(n.message_id)message=await ch.messages.fetch(n.message_id).catch(e=>{if(e.code===10008)return null;throw e;});
    if(message)await message.edit(content);else{message=await ch.send({...content,nonce:i.id,enforceNonce:true});await c.query('UPDATE immigration_notices SET message_id=$1 WHERE guild_id=$2',[message.id,i.guildId]);}
    return {channelId:n.channel_id,messageId:message.id};
   });
   await i.editReply(`Aviso publicado/atualizado: https://discord.com/channels/${i.guildId}/${notice.channelId}/${notice.messageId}. A data original foi preservada. Os membros entram pelo botão. A exclusão do servidor é manual.`);return true;
  }
  if(click){
   const form=new ModalBuilder().setCustomId('immigration-form').setTitle('Imigração • ROKUHARA').addComponents([
    ['game_nick','Seu nome no jogo',64],['discord_name','Seu nome no Discord',100]
   ].map(([key,label,max])=>new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(key).setLabel(label).setMaxLength(max).setRequired(true).setStyle(TextInputStyle.Short))));
   await i.showModal(form);return true;
  }
  await i.deferReply(privateReply);
  const game=text(i.fields.getTextInputValue('game_nick'),'Nome no jogo',64),name=text(i.fields.getTextInputValue('discord_name'),'Nome no Discord',100);
  const result=await tx(pool,async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`immigration:${i.user.id}`]);
   if((await c.query('SELECT id FROM members WHERE discord_id=$1',[i.user.id])).rowCount)return 'Você já possui IFJ. Procure a equipe para consultar ou corrigir seu cadastro.';
   if((await c.query("SELECT id FROM immigrations WHERE discord_id=$1 AND status='pendente'",[i.user.id])).rowCount)return 'Você já tem um pedido em análise. Aguarde a decisão do administrador.';
   const r=(await c.query('INSERT INTO immigrations(discord_id,guild_id,game_nick,discord_name) VALUES($1,$2,$3,$4) RETURNING id',[i.user.id,i.guildId,game,name])).rows[0];
   return `Pedido #${r.id} enviado! O administrador completará seus dados. Você receberá a decisão no privado. Permita mensagens privadas de membros deste servidor para receber o IFJ e a carteira.`;
  });await i.editReply(result);return true;
 }
 async function joined(member){
  const d=config.divisions.find(x=>x.guild===member.guild.id);if(!d||member.user.bot)return;
  const joinedAt=member.joinedTimestamp;if(!joinedAt)throw new Error('Entrada sem data de ingresso.');
  const imported=(await pool.query("SELECT id FROM members WHERE discord_id=$1 AND auto_allied=TRUE AND verified=TRUE AND account_kind='aliado'",[member.id])).rowCount;
  if(imported)await pool.query("INSERT INTO jobs(kind,payload,dedupe_key) VALUES('sync-role',$1,$2) ON CONFLICT DO NOTHING",[JSON.stringify({discordId:member.id}),`ally-join:${d.guild}:${member.id}:${joinedAt}`]);
  await pool.query("INSERT INTO jobs(kind,payload,dedupe_key) VALUES('welcome',$1,$2) ON CONFLICT DO NOTHING",[JSON.stringify({guildId:d.guild,discordId:member.id,joinedAt}),`welcome:${d.guild}:${member.id}:${joinedAt}`]);
 }
 async function execute(job,c){
  const options={allowedMentions:{parse:[]},nonce:String(job.id),enforceNonce:true};let sent;
  if(job.kind==='welcome'){
   const d=config.divisions.find(x=>x.guild===job.payload.guildId);if(!d)return;
   const g=await client.guilds.fetch(d.guild);
   const member=await g.members.fetch({user:job.payload.discordId,force:true}).catch(e=>{if(e.code===10007)return null;throw e;});
   if(!member||member.joinedTimestamp!==job.payload.joinedAt)return;
   const imported=(await c.query("SELECT id FROM members WHERE discord_id=$1 AND auto_allied=TRUE AND verified=TRUE AND account_kind='aliado'",[member.id])).rowCount;
   const ch=await client.channels.fetch(d.welcome);if(ch?.guildId!==d.guild)throw new Error('Canal de boas-vindas inválido.');
   sent=await ch.send({...options,content:`<@${member.id}>`,allowedMentions:{parse:[],users:[member.id]},embeds:[new EmbedBuilder(d.id).setImage(member.displayAvatarURL({extension:'png',size:256})).setAuthor(null).setFooter(null).setTimestamp(null),new EmbedBuilder(d.id).setTitle('Bem-vindo à ROKUHARA').setDescription(imported?'🤝 **Aliado reconhecido!**\nSua conta já está vinculada à aliança ROKUHARA. Seu acesso e o cargo Aliados serão liberados automaticamente.\n\nObrigado por continuar essa parceria conosco!':`🪪 **Seu próximo passo**\nLeia o guia em <#${d.guide}> e verifique seu IFJ em <#${d.verification}> para liberar seu acesso.`)]});
  }else if(job.kind==='report-resolution'){
   const r=(await c.query("SELECT * FROM reports WHERE id=$1 AND status='resolvida'",[job.payload.reportId])).rows[0];if(!r)return;
   const user=await client.users.fetch(r.reporter_id);
   sent=await user.send({...options,embeds:[new EmbedBuilder().setTitle(`Resultado da denúncia #${r.id}`).setDescription(safe(r.resolution).slice(0,4096)).setFooter({text:'ROKUHARA • Análise da administração'}).setColor(0xc4f56d)]});
  }else if(job.kind==='immigration-decision'){
   const r=(await c.query('SELECT * FROM immigrations WHERE id=$1',[job.payload.requestId])).rows[0];if(!r||r.status==='pendente')return;
   let message;
   if(r.status==='aprovada'){
    const m=(await c.query('SELECT * FROM members WHERE id=$1 FOR UPDATE',[r.member_id])).rows[0];
    if(!m||m.discord_id!==r.discord_id)throw Object.assign(new Error('Cadastro cancelado ou Discord alterado; carteira não enviada.'),{code:'IFJ_CHANGED'});
    const division=config.divisions.find(d=>d.id===m.division);
    const card=await renderCard(m,division.name);
    message={embeds:[new EmbedBuilder().setTitle('Imigração aprovada • ROKUHARA').setDescription(`Seu IFJ: **${m.ifj}**\nNome: ${safe(m.name)}\nPatente: ${safe(m.member_rank)}\nAcesso: ${bothDivisions(m)?'1ª e 2ª divisões':safe(division.name)}\n\nSua carteira PNG está anexada. Entre no servidor autorizado e verifique seu IFJ para receber os cargos. A aprovação não substitui a verificação.\nSe precisar do convite, peça à equipe.`).setColor(0xc4f56d)],files:[new AttachmentBuilder(card,{name:`ROKUHARA-${m.ifj}-v${m.identity_version}.png`})]};
   }else message={embeds:[new EmbedBuilder().setTitle('Imigração recusada • ROKUHARA').setDescription(safe(r.reason).slice(0,4096)).setColor(0xeb6d5b)]};
   const user=await client.users.fetch(r.discord_id);sent=await user.send({...options,...message});
  }
  if(sent)await c.query('UPDATE jobs SET message_id=$1 WHERE id=$2',[sent.id,job.id]);
 }
 return {register,interact,joined,execute,publishGuide};
}
