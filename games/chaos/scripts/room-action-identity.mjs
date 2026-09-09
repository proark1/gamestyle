// Adapt API regression checks to the sequenced party protocol.
// Read the authenticated watermark; old rooms continue to accept legacy actions.
const sequences = new Map();
export async function identifyAction(origin, body) {
  if (body.op !== 'action') return body;
  const response = await fetch(new URL('/api/handwerker/rooms', origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: new URL(origin).origin,
    },
    body: JSON.stringify({
      op: 'sync',
      code: body.code,
      id: body.id,
      token: body.token,
    }),
  });
  if (!response.ok) return body;
  const { snapshot } = await response.json();
  if (!snapshot.world.party) return body;
  const seq =
    Math.max(sequences.get(body.id) || 0, snapshot.actionSeq || 0) + 1;
  sequences.set(body.id, seq);
  return {
    ...body,
    seq,
    actionId: crypto.randomUUID(),
    roundId: snapshot.world.party.roundId,
  };
}
