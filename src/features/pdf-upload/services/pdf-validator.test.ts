
import { describe, it, expect } from 'vitest'
import { validatePdfFile } from './pdf-validator'

describe('validatePdfFile', () => {
  it('should accept a valid PDF file', async () => {
    const content = '%PDF-1.7\nSample PDF content'
    const file = new File([content], 'rekening.pdf')

    const result = await validatePdfFile(file)

    expect(result.valid).toBe(true)
  })

  it('should reject a non-PDF extension', async () => {
    const file = new File(['image content'], 'rekening.jpg')

    const result = await validatePdfFile(file)

    expect(result.valid).toBe(false)
  })

  it('should reject a fake PDF file', async () => {
    const file = new File(['This is not a PDF'], 'rekening.pdf')

    const result = await validatePdfFile(file)

    expect(result.valid).toBe(false)
  })

  it('should reject an empty PDF file', async () => {
    const file = new File([], 'rekening.pdf')

    const result = await validatePdfFile(file)

    expect(result.valid).toBe(false)
  })

  it('should accept uppercase PDF extension', async () => {
    const content = '%PDF-1.7\nSample PDF content'
    const file = new File([content], 'REKENING.PDF')

    const result = await validatePdfFile(file)

    expect(result.valid).toBe(true)
  })
})
