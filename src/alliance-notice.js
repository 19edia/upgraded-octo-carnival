import {RokuharaEmbed} from './embed-theme.js';
export function allianceMessage(d,invite){
 return {embeds:[new RokuharaEmbed(d.id).setTitle('ROKUHARA × HYDRA NO KAI').setDescription([
 '🤝 **NOSSA ALIANÇA**',
 'A **HYDRA NO KAI** é uma gang aliada da **ROKUHARA**. Valorizamos essa parceria e queremos fortalecer os laços entre nossas comunidades com respeito e união.',
 '🛡️ **RESPEITO ENTRE ALIADOS**',
 'Recebam nossos aliados com educação. Ao visitar o servidor deles, respeitem as regras e os membros. Se surgir algum problema, procurem a administração para resolver com diálogo.',
 `🔗 **SERVIDOR DA HYDRA NO KAI**\n${invite}`,
 '━━━━━━━━━━━━━━━━━━\n**✦ ROKUHARA × HYDRA NO KAI ✦**\n*⚔️ Duas forças, uma aliança. 🤝*'
 ].join('\n\n'))],allowedMentions:{parse:[]}};
}
export async function publishAlliance(pool,client,d,invite){
 if(!d.allianceChannel)return;
 const ch=await client.channels.fetch(d.allianceChannel);
 if(!ch||ch.guildId!==d.guild||!ch.isTextBased()||!ch.send)throw new Error(`DIV_${d.id}_ALLIANCE_CHANNEL_ID: canal inválido.`);
 const content=allianceMessage(d,invite);
 const old=(await pool.query('SELECT message_id FROM panels WHERE channel_id=$1',[d.allianceChannel])).rows[0];
 let message;if(old)message=await ch.messages.fetch(old.message_id).catch(e=>{if(e.code===10008)return null;throw e;});
 if(message)await message.edit(content);
 else{message=await ch.send(content);await pool.query('INSERT INTO panels(channel_id,message_id) VALUES($1,$2) ON CONFLICT(channel_id) DO UPDATE SET message_id=$2',[d.allianceChannel,message.id]);}
}
