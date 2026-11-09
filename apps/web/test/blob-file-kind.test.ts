import { describe, expect, it } from 'vitest'
import { mediaKindForFile } from '../src/lib/blob'

describe('mediaKindForFile', () => {
  it('uses MIME first', () => {
    expect(mediaKindForFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBe('image')
    expect(mediaKindForFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBe('file')
  })

  it('falls back to image extensions when MIME is missing', () => {
    expect(mediaKindForFile(new File(['x'], 'a.PNG', { type: '' }))).toBe('image')
    expect(mediaKindForFile(new File(['x'], 'a.zip', { type: '' }))).toBe('file')
  })
})
