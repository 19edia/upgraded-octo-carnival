import {EmbedBuilder} from 'discord.js';
// One visual identity for every Discord embed, with readable titles and native fields.
export class RokuharaEmbed extends EmbedBuilder {
 constructor(division=0){super();this.setAuthor({name:'ROKUHARA  /  UNIÃO • RESPEITO • LEALDADE'});this.setColor(division===2?0x38a9ff:0x69f06a);super.setFooter({text:division?`ROKUHARA • ${division}ª DIVISÃO • CENTRAL IFJ`:'ROKUHARA • CENTRAL IFJ'});this.setTimestamp();}
 setTitle(value){return super.setTitle(value?`❖ ┃ ${value}`:value);}
 setFooter(value){return super.setFooter(value?.text?{...value,text:value.text.includes('ROKUHARA')?value.text:`ROKUHARA • ${value.text}`}:value);}
}
