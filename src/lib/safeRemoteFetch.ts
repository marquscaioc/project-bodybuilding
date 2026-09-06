import 'server-only';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);
const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost'];

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
  const version = isIP(normalized);

  if (version === 4) {
    const [a, b] = normalized.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (version === 6) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(normalized) || normalized.startsWith('ff')) return true;
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPrivateAddress(mapped) : false;
  }

  return true;
}

export async function assertSafeRemoteUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid remote URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http(s) URLs are allowed');
  }
  if (url.username || url.password) throw new Error('URL credentials are not allowed');

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error('Local network URLs are not allowed');
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('Private network URLs are not allowed');
    return url;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Remote host did not resolve to a public address');
  }
  return url;
}

export async function safeRemoteFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; maxRedirects?: number } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRedirects = options.maxRedirects ?? 3;
  let current = await assertSafeRemoteUrl(rawUrl);

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetch(current, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;

    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || redirects === maxRedirects) throw new Error('Too many redirects');
    current = await assertSafeRemoteUrl(new URL(location, current).toString());
  }

  throw new Error('Too many redirects');
}

export async function readResponseBytes(
  response: Response,
  maxBytes: number,
): Promise<ArrayBuffer> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error('Remote response is too large');
  }
  if (!response.body) return new ArrayBuffer(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('Remote response is too large');
    }
    chunks.push(value);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output.buffer;
}

export async function readResponseText(response: Response, maxBytes: number) {
  return new TextDecoder().decode(await readResponseBytes(response, maxBytes));
}
