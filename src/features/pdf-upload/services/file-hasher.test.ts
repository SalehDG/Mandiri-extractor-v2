import { describe, it, expect } from 'vitest'
import { calculateFileHash } from './file-hasher'

describe('calculateFileHash', () => {
  it('should generate the correct SHA-256 hash', async () => {
    const file = new File(['hello'], 'hello.txt')

    const hash = await calculateFileHash(file)

    expect(hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
  })

  it('should generate the same hash for identical content', async () => {
    const fileA = new File(['same content'], 'file-a.pdf')
    const fileB = new File(['same content'], 'file-b.pdf')

    const hashA = await calculateFileHash(fileA)
    const hashB = await calculateFileHash(fileB)

    expect(hashA).toBe(hashB)
  })

  it('should generate different hashes for different content', async () => {
    const fileA = new File(['content A'], 'file-a.pdf')
    const fileB = new File(['content B'], 'file-b.pdf')

    const hashA = await calculateFileHash(fileA)
    const hashB = await calculateFileHash(fileB)

    expect(hashA).not.toBe(hashB)
  })
})