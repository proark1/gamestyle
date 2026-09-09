const encoder = new TextEncoder();
async function keyFromHex(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret))
    throw new Error('Secure key storage is unavailable.');
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(secret.match(/../g)!, (v) => parseInt(v, 16)),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}
export async function encryptKey(value: string, master: string, game: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: encoder.encode(game) },
      await keyFromHex(master),
      encoder.encode(value),
    ),
  );
  return JSON.stringify({ iv: Array.from(iv), data: Array.from(data) });
}
export async function decryptKey(value: string, master: string, game: string) {
  try {
    const { iv, data } = JSON.parse(value);
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(iv),
          additionalData: encoder.encode(game),
        },
        await keyFromHex(master),
        new Uint8Array(data),
      ),
    );
  } catch {
    throw new Error(
      'The saved key could not be decrypted. Please save it again.',
    );
  }
}
