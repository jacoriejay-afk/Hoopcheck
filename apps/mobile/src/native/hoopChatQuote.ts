/** Plain-text quote replies work with current message storage and older clients.
 * Quoting never sends a message, stores a new relation, or expands authorization.
 */
export function quoteConversationMessage(requestId:string,message:{request_id:string;body:string},draft:string):string|null {
  if(!requestId||message.request_id!==requestId||typeof message.body!=="string"||typeof draft!=="string")return null;
  const body=message.body.replace(/\s+/g," ").trim();
  if(!body)return null;
  const characters=Array.from(body);
  const preview=characters.length>300?characters.slice(0,299).join("")+"…":body;
  const next="> "+preview+"\n\n"+draft;
  return next.length<=2000?next:null;
}
