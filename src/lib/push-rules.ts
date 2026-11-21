export function canSendPush(alertOwner:string,deviceOwner:string,tier:unknown){
 return alertOwner===deviceOwner&&(tier==='alerts'||tier==='bots');
}
