import { AtlasError, UpstreamUnavailableError } from "@atlas/schemas";

/**
 * Bounds an upstream call. The service must not hang on a slow RPC or registry;
 * timeouts become UPSTREAM_UNAVAILABLE rather than empty results.
 */
export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return work;

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UpstreamUnavailableError(message)), timeoutMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } catch (error) {
    if (error instanceof AtlasError) throw error;
    throw new UpstreamUnavailableError(message, null, { cause: error });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
