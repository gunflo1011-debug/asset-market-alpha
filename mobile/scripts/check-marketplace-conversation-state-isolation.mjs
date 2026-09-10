import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/features/marketplace/MarketplaceConversationScreen.tsx', import.meta.url), 'utf8');

const required = [
  ['active conversation ref', 'const activeConversationRef = useRef(conversation.conversation_id);'],
  ['refresh generation ref', 'const refreshRequestRef = useRef(0);'],
  ['refresh generation increment', 'const requestId = ++refreshRequestRef.current;'],
  ['stale refresh guard', 'if (requestId !== refreshRequestRef.current) return;'],
  ['conversation switch updates active ref', 'activeConversationRef.current = conversation.conversation_id;'],
  ['conversation switch invalidates refreshes', 'refreshRequestRef.current += 1;'],
  ['conversation switch clears messages', 'setMessages([]);'],
  ['conversation switch clears offers', 'setOffers([]);'],
  ['conversation switch clears draft', "setDraft('');"],
  ['send completion guard', 'if (activeConversationRef.current !== conversationId) return;'],
  ['stale mutation error guard', 'if (activeConversationRef.current === conversationId) setError('],
  ['stale mutation busy guard', 'if (activeConversationRef.current === conversationId) setSending(false);'],
  ['offer busy stale guard', 'if (activeConversationRef.current === conversationId) setOfferBusy(false);'],
  ['lifecycle busy stale guard', 'if (activeConversationRef.current === conversationId) setLifecycleBusy(false);'],
  ['adoption busy stale guard', 'if (activeConversationRef.current === conversationId) setAdoptionBusy(false);'],
];

const failures = required.filter(([, needle]) => !source.includes(needle));
if (failures.length) {
  console.error('Marketplace conversation state-isolation contract failed:');
  for (const [label] of failures) console.error(`- missing ${label}`);
  process.exit(1);
}

const mutationConversationBindings = source.match(/const conversationId = conversation\.conversation_id;/g)?.length ?? 0;
if (mutationConversationBindings < 5) {
  console.error(`Marketplace conversation state-isolation contract failed: expected at least 5 conversation-bound async paths, found ${mutationConversationBindings}`);
  process.exit(1);
}

console.log('Marketplace conversation state-isolation contract OK');
