import test from "node:test";
import assert from "node:assert/strict";
import {findIntelligenceTopics,intelligenceTopics} from "../src/native/intelligenceGuide.ts";
test("supported questions retrieve relevant editorial sources only",()=>{
 assert.equal(findIntelligenceTopics("How do I verify a club?")[0]?.id,"verify-club");
 assert.equal(findIntelligenceTopics("What about late salary?")[0]?.id,"payment");
 assert.equal(findIntelligenceTopics("upfront fee and fake agent")[0]?.id,"scams");
 for(const topic of intelligenceTopics){assert.equal(findIntelligenceTopics(topic.phrases[0])[0]?.id,topic.id);assert.match(topic.webPath,/^\//);}
});
test("unsupported or oversized questions abstain rather than guess",()=>{
 for(const q of ["", "club", "Who won yesterday?", "How much does Club X pay?", "x".repeat(161)])assert.deepEqual(findIntelligenceTopics(q),[]);
});
