import { describe, expect, it } from 'vitest'
import { zFileAttributes, zImageAttributes } from '@laibrary/types'
import { mediaAttributesFor, mediaKindForFile } from '../src/lib/blob'

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


describe('media attributes', () => {
  it('file attributes stay strict and image keeps display_width', () => {
    const file_attrs = mediaAttributesFor('file', 'a.pdf')
    expect(file_attrs).toEqual({ filename: 'a.pdf' })
    expect(zFileAttributes.safeParse(file_attrs).success).toBe(true)

    const image_attrs = mediaAttributesFor('image', 'a.png')
    expect(image_attrs).toEqual({ filename: 'a.png', display_width: 480 })
    expect(zImageAttributes.safeParse(image_attrs).success).toBe(true)
  })
})
