const CHUNK_LOAD_ERROR_RE = /Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk [\w-]+ failed/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_LOAD_ERROR_RE.test(message);
}
