import { EnvHttpProxyAgent, fetch as undiciFetch } from 'undici';

const hasProxy = Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
const dispatcher = hasProxy ? new EnvHttpProxyAgent() : undefined;

export function httpFetch(
  input: string | URL,
  init: Parameters<typeof undiciFetch>[1] = {}
): ReturnType<typeof undiciFetch> {
  return undiciFetch(input, {
    ...init,
    ...(dispatcher ? { dispatcher } : {}),
  });
}
