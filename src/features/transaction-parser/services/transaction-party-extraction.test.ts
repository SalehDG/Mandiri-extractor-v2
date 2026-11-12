import { describe, expect, it } from 'vitest'
import { extractPartyDetails } from './transaction-parser'

describe('extractPartyDetails', () => {
  it.each([
    ['MCM InhouseTrf KE SHOLAHUDIN Transfer Fee', 'SHOLAHUDIN', 'MCM InhouseTrf KE Transfer Fee'],
    ['KE HAFID GHASANI Transfer Fee', 'HAFID GHASANI', 'KE Transfer Fee'],
    ['KE YASMINA LUTHFI NUR FITRIANI Transfer Fee', 'YASMINA LUTHFI NUR FITRIANI', 'KE Transfer Fee'],
    ['KE IWAN TRESNAWAN Transfer Fee', 'IWAN TRESNAWAN', 'KE Transfer Fee'],
    ['KE PRIMA DUTA NUSANTARA Transfer Fee', 'PRIMA DUTA NUSANTARA', 'KE Transfer Fee'],
    ['KE DESA MERAH PUTIH Transfer Fee', 'DESA MERAH PUTIH', 'KE Transfer Fee'],
    ['DARI BAGUS SANTOSO balikin modal', 'BAGUS SANTOSO', 'DARI balikin modal'],
    ['DARI KARAWANG SUKSES BERDAYA Transfer Fee', 'KARAWANG SUKSES BERDAYA', 'DARI Transfer Fee'],
    ['DARI KONSUMEN MASYARAKAT MADANI BERJAYA Transfer Fee', 'KONSUMEN MASYARAKAT MADANI BERJAYA', 'DARI Transfer Fee'],
  ])('extracts only the party name from %s', (remark, name, description) => {
    expect(extractPartyDetails(remark)).toEqual({ name, description })
  })

  it('keeps KE/DARI and all remaining text when no party marker exists', () => {
    const remark = 'MCM InhouseTrf Transfer Fee ref123'
    expect(extractPartyDetails(remark)).toEqual({ name: '', description: remark })
  })

  it('does not extract a name when KE/DARI is followed only by a delimiter', () => {
    expect(extractPartyDetails('MCM InhouseTrf KE Transfer Fee')).toEqual({
      name: '',
      description: 'MCM InhouseTrf KE Transfer Fee',
    })
  })

  it('keeps the original Remark when no party name can be identified', () => {
    const remark = 'Maintenance okt E'
    expect(extractPartyDetails(remark)).toEqual({ name: '', description: remark })
  })

  it('uses Ops Koperasi as the description while retaining the party name', () => {
    expect(extractPartyDetails('KE HAFID GHASANI Transfer Fee koperasi')).toEqual({
      name: 'HAFID GHASANI',
      description: 'Ops Koperasi',
    })
  })

  it('handles the explicitly confirmed NURHAYATI special pattern', () => {
    expect(extractPartyDetails('BSMDIDJA/YATI NURHAYATI ops supir99102')).toEqual({
      name: 'NURHAYATI',
      description: 'ops supir',
    })
  })


  it('does not guess a party name when KE/DARI has no recognized end marker', () => {
    const remarks = [
      'DARI Maintenance okt E',
      'KE BAYAR AIR GALON',
      'DARI OPS GAJI KONTRAK 161',
    ]

    for (const remark of remarks) {
      expect(extractPartyDetails(remark)).toEqual({ name: '', description: remark })
    }
  })

  it('keeps the explicitly confirmed MITRA GIZI TANGERANG party pattern', () => {
    expect(extractPartyDetails('DARI MITRA GIZI TANGERANG')).toEqual({
      name: 'MITRA GIZI TANGERANG',
      description: 'DARI',
    })
  })

  it('does not remove a matching word from an earlier part of the Remark', () => {
    expect(extractPartyDetails('SHOLAHUDIN MCM InhouseTrf KE SHOLAHUDIN Transfer Fee')).toEqual({
      name: 'SHOLAHUDIN',
      description: 'SHOLAHUDIN MCM InhouseTrf KE Transfer Fee',
    })
  })
})
