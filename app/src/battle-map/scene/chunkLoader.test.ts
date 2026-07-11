import { expect, it, vi } from 'vitest'
import { loadChunkWithRetry } from './chunkLoader'

it('retries one failed chunk load and returns one resource', async () => {
  const loader = vi.fn().mockRejectedValueOnce(new Error('fixture failure')).mockResolvedValueOnce('texture')
  await expect(loadChunkWithRetry({ column: 3, row: 4 }, loader)).resolves.toBe('texture')
  expect(loader).toHaveBeenCalledTimes(2)
})
