export function makeSalt(): string {
  return crypto.randomUUID()
}

export async function hashSecret(secret: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${secret}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifySecret(secret: string, salt: string, hash: string): Promise<boolean> {
  return (await hashSecret(secret, salt)) === hash
}
