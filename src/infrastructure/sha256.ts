export async function sha256Utf8(value: string): Promise<string> {
  const input = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
