import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {quoteConversationMessage} from "../src/native/hoopChatQuote.ts";
test("quote replies are explicit text drafts and preserve existing text",()=>{
  const message={request_id:"thread-a",body:"  Basketball\n discussion  "};
  assert.equal(quoteConversationMessage("thread-a",message,"My reply"),"> Basketball discussion\n\nMy reply");
  assert.equal(quoteConversationMessage("thread-b",message,"My reply"),null);
  assert.equal(quoteConversationMessage("",message,""),null);
  assert.equal(quoteConversationMessage("thread-a",{...message,body:"  "},"draft"),null);
  assert.equal(quoteConversationMessage("thread-a",message,"x".repeat(2000)),null);
  const result=quoteConversationMessage("thread-a",{...message,body:"🏀".repeat(301)},"");
  assert.ok(result.endsWith("…\n\n"));
  assert.equal(Array.from(result.slice(2,-3)).length,299);
});
test("native quote actions are limited to confirmed selected conversation history and never send",()=>{
  const screen=readFileSync(new URL("../app/messages.tsx",import.meta.url),"utf8");
  const button=screen.slice(screen.indexOf("Quote message from"),screen.indexOf(">Quote reply</Text>"));
  assert.match(button,/selected\.status!=="accepted"/);
  assert.match(button,/item\.request_id!==selected\.id/);
  assert.match(button,/currentPage\.rows\.some/);
  assert.match(button,/setDraft\(next\)/);
  assert.doesNotMatch(button,/\.insert\(|sendConversationMessage|void send\(/);
});
