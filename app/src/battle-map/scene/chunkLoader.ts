import type { ChunkAddress } from '../domain/chunks'

export async function loadChunkWithRetry<T>(
  address: ChunkAddress,
  loader: (address: ChunkAddress) => Promise<T>,
  maxAttempts = 2,
): Promise<T> {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('Chunk attempts must be a positive integer')
  }
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await loader(address)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}
