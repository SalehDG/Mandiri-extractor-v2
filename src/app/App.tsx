import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { processUploadedFiles } from '../features/pdf-upload/services/upload-processor'
import type {
  UploadProcessingResult,
  UploadedPdf,
} from '../features/pdf-upload/services/upload-processor'
import { extractTransactionsFromPdf } from '../features/transaction-extraction/services/transaction-extraction'
import { downloadTransactionsCsv } from '../features/excel-export/services/csv-exporter'
import type {
  TransactionOutput,
  TransactionValidationResult,
} from '../features/transaction-parser/types/transaction'
import './App.css'

const UPLOAD_OPTIONS = {
  maxArchiveSizeBytes: 50 * 1024 * 1024,
  maxEntries: 500,
}

interface FileExtractionResult {
  id: string
  fileName: string
  sourcePath: string
  pageCount: number
  transactions: TransactionOutput[]
  validation: TransactionValidationResult
  error: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

const EMPTY_UPLOAD_RESULT: UploadProcessingResult = {
  uniquePdfs: [],
  duplicates: [],
  rejectedFiles: [],
}

const OUTPUT_COLUMNS: (keyof TransactionOutput)[] = [
  'TGL/BLN/THN',
  'URAIAN',
  'NAMA',
  'DEBET',
  'KREDIT',
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const isSelectingCells = useRef(false)
  const selectionToolbarRef = useRef<HTMLDivElement>(null)
  const transactionTableRef = useRef<HTMLDivElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [result, setResult] = useState<UploadProcessingResult>(EMPTY_UPLOAD_RESULT)
  const [duplicateDecision, setDuplicateDecision] = useState<'include' | 'exclude' | null>(null)
  const [extractionResults, setExtractionResults] = useState<FileExtractionResult[]>([])
  const [selectedResultId, setSelectedResultId] = useState('')
  const [error, setError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [copyAnimating, setCopyAnimating] = useState(false)
  const [exportAnimating, setExportAnimating] = useState(false)
  const [selectedRange, setSelectedRange] = useState<{ startRow: number; endRow: number; startCol: number; endCol: number } | null>(null)
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!selectedRange) return

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (selectionToolbarRef.current?.contains(target) || transactionTableRef.current?.contains(target)) return
      isSelectingCells.current = false
      setSelectedRange(null)
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown)
  }, [selectedRange])

  function updateSelectionPosition(clientX: number, clientY: number) {
    setSelectionPosition({
      x: Math.max(12, Math.min(clientX + 12, window.innerWidth - 280)),
      y: Math.max(12, Math.min(clientY + 12, window.innerHeight - 76)),
    })
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setIsProcessing(true)
    setError('')
    setCopyMessage('')

    try {
      const processingResult = await processUploadedFiles(files, UPLOAD_OPTIONS)
      setResult((previous) => ({
        uniquePdfs: [...previous.uniquePdfs, ...processingResult.uniquePdfs],
        duplicates: [...previous.duplicates, ...processingResult.duplicates],
        rejectedFiles: [...previous.rejectedFiles, ...processingResult.rejectedFiles],
      }))

      if (processingResult.duplicates.length > 0) {
        const shouldContinue = window.confirm(
          `Ditemukan ${processingResult.duplicates.length} file duplikat. Sertakan file duplikat pada proses ekstraksi?`,
        )
        setDuplicateDecision(shouldContinue ? 'include' : 'exclude')
      }
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : 'Terjadi kesalahan saat memproses file.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleExtract() {
    const filesToExtract: UploadedPdf[] = [
      ...result.uniquePdfs,
      ...(duplicateDecision === 'include' ? result.duplicates.map((item) => item.file) : []),
    ]

    if (filesToExtract.length === 0 || isExtracting) return

    setIsExtracting(true)
    setError('')
    setCopyMessage('')
    setSelectedRange(null)

    const jobs = filesToExtract.map((item, index) => ({
      item,
      id: `${item.sourcePath}-${index}-${item.file.size}`,
    }))

    const initialResults: FileExtractionResult[] = jobs.map(({ item, id }) => ({
      id,
      fileName: item.file.name,
      sourcePath: item.sourcePath,
      pageCount: 0,
      transactions: [],
      validation: { isValid: false, issues: [], balanceChecks: 0 },
      error: '',
      status: 'pending',
    }))

    setExtractionResults(initialResults)
    setSelectedResultId(jobs[0]?.id ?? '')

    try {
      for (const { item, id } of jobs) {
        setExtractionResults((previous) =>
          previous.map((entry) =>
            entry.id === id ? { ...entry, status: 'processing' } : entry,
          ),
        )

        try {
          const extraction = await extractTransactionsFromPdf(item.file)

          setExtractionResults((previous) =>
            previous.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    pageCount: extraction.pageCount,
                    transactions: extraction.transactions,
                    validation: extraction.validation,
                    error: '',
                    status: 'completed',
                  }
                : entry,
            ),
          )
        } catch (extractionError) {
          setExtractionResults((previous) =>
            previous.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    error:
                      extractionError instanceof Error
                        ? extractionError.message
                        : 'Gagal mengekstrak dokumen.',
                    status: 'failed',
                  }
                : entry,
            ),
          )
        }
      }
    } finally {
      setIsExtracting(false)
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void handleFiles(event.target.files)
    event.target.value = ''
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    dragCounter.current += 1
    setIsDragging(true)
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault()
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    void handleFiles(event.dataTransfer.files)
  }

  function removeAllFiles() {
    setResult(EMPTY_UPLOAD_RESULT)
    setDuplicateDecision(null)
    setExtractionResults([])
    setSelectedResultId('')
    setSelectedRange(null)
    setError('')
    setCopyMessage('')
  }

  async function copyTransactions(transactions: TransactionOutput[], label: string) {
    if (transactions.length === 0) return
    const text = transactions.map((transaction) =>
      OUTPUT_COLUMNS.map((column) => {
        const value = transaction[column]
        return value === 0 || value === null || value === undefined ? '' : String(value)
      }).join('\t'),
    ).join('\n')

    setCopyAnimating(true)
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage(`${label} berhasil disalin.`)
    } catch {
      setCopyMessage('Tidak dapat menyalin. Periksa izin clipboard browser.')
    } finally {
      window.setTimeout(() => setCopyAnimating(false), 650)
    }
  }

  function selectCell(row: number, col: number, extend = false) {
    setSelectedRange((current) => ({
      startRow: extend && current ? current.startRow : row,
      endRow: row,
      startCol: extend && current ? current.startCol : col,
      endCol: col,
    }))
  }

  function isCellSelected(row: number, col: number): boolean {
    if (!selectedRange) return false
    const minRow = Math.min(selectedRange.startRow, selectedRange.endRow)
    const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow)
    const minCol = Math.min(selectedRange.startCol, selectedRange.endCol)
    const maxCol = Math.max(selectedRange.startCol, selectedRange.endCol)
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
  }

  function getTransactionCell(transaction: TransactionOutput, columnIndex: number): string {
    const value = transaction[OUTPUT_COLUMNS[columnIndex]]
    if (value === 0 || value === '0' || value === null || value === undefined || value === '') return ''
    return typeof value === 'number' ? value.toLocaleString('id-ID') : String(value)
  }

  async function copySelectedRange() {
    if (!selectedResult || !selectedRange) return
    const minRow = Math.min(selectedRange.startRow, selectedRange.endRow)
    const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow)
    const minCol = Math.min(selectedRange.startCol, selectedRange.endCol)
    const maxCol = Math.max(selectedRange.startCol, selectedRange.endCol)
    const text = selectedResult.transactions.slice(minRow, maxRow + 1).map((transaction) =>
      OUTPUT_COLUMNS.slice(minCol, maxCol + 1).map((_, offset) => getTransactionCell(transaction, minCol + offset)).join('\t'),
    ).join('\n')

    setCopyAnimating(true)
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage(`Pilihan ${maxRow - minRow + 1} baris × ${maxCol - minCol + 1} kolom berhasil disalin.`)
    } catch {
      setCopyMessage('Tidak dapat menyalin. Periksa izin clipboard browser.')
    } finally {
      window.setTimeout(() => setCopyAnimating(false), 650)
    }
  }

  const totalFiles =
    result.uniquePdfs.length + result.duplicates.length + result.rejectedFiles.length
  const selectedResult =
    extractionResults.find((item) => item.id === selectedResultId) ?? null
  const hasExtractableFiles =
    result.uniquePdfs.length > 0 ||
    (result.duplicates.length > 0 && duplicateDecision === 'include')

  return (
    <main
      className="app"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-content">
            <div className="drop-icon">↓</div>
            <h2>Lepaskan file di sini</h2>
            <p>PDF atau ZIP rekening koran</p>
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M4 12h24v3H4zM7 16h3v9H7zm7 0h3v9h-3zm7 0h3v9h-3zM4 26h24v3H4zM16 3 3 10h26L16 3z" />
            </svg>
          </div>
          <div>
            <h1>Mandiri Extractor V2</h1>
            <p>Bank Statement Data Processor</p>
          </div>
        </div>
      </header>

      <section className="dashboard">
        <aside className="document-panel">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.zip,application/pdf,application/zip"
            multiple
            hidden
            onChange={handleInputChange}
          />

          <button
            className="upload-button"
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing || isExtracting}
          >
            <span className="upload-plus">+</span>
            {isProcessing ? 'Memproses file...' : 'Pilih PDF / ZIP'}
          </button>

          <button
            className="extract-button"
            onClick={() => void handleExtract()}
            disabled={!hasExtractableFiles || isProcessing || isExtracting}
          >
            {isExtracting ? 'Sedang mengekstrak...' : 'Ekstrak Data'}
          </button>

          <div className="document-heading">
            <div className="document-title">
              <h2>Daftar Dokumen</h2>
              <span className="file-count">{totalFiles} file</span>
            </div>
            <button
              className="clear-button"
              onClick={removeAllFiles}
              disabled={totalFiles === 0 || isProcessing || isExtracting}
            >
              Hapus Semua
            </button>
          </div>

          {error && <p className="error-message">{error}</p>}

          {totalFiles === 0 && (
            <div className="empty-documents">
              <p>Belum ada dokumen.</p>
              <span>Upload PDF atau ZIP untuk memulai.</span>
            </div>
          )}

          {result.uniquePdfs.map((item) => {
            const extraction = extractionResults.find(
              (entry) => entry.sourcePath === item.sourcePath && entry.fileName === item.file.name,
            )
            return (
              <DocumentItem
                key={`${item.sourcePath}-${item.file.name}`}
                name={item.file.name}
                size={formatFileSize(item.file.size)}
                status={extraction?.status ?? 'accepted'}
                source={item.sourceType === 'zip' ? 'Dari ZIP' : 'PDF'}
                active={extraction?.id === selectedResultId}
                disabled={!extraction}
                onClick={() => { if (extraction) { setSelectedResultId(extraction.id); setSelectedRange(null) } }}
              />
            )
          })}

          {result.duplicates.map((item, index) => {
            const extraction = extractionResults.find(
              (entry) => entry.sourcePath === item.file.sourcePath && entry.fileName === item.file.file.name,
            )
            return (
              <DocumentItem
                key={`duplicate-${index}`}
                name={item.file.file.name}
                size={formatFileSize(item.file.file.size)}
                status={extraction?.status ?? 'duplicate'}
                source={`Duplikat dari ${item.duplicateOf.file.name}`}
                active={extraction?.id === selectedResultId}
                disabled={!extraction}
                onClick={() => { if (extraction) { setSelectedResultId(extraction.id); setSelectedRange(null) } }}
              />
            )
          })}

          {result.rejectedFiles.map((item, index) => (
            <DocumentItem
              key={`rejected-${index}`}
              name={item.fileName}
              size=""
              status="rejected"
              source={item.reason}
              disabled
            />
          ))}

          {isProcessing && (
            <div className="processing-indicator">
              <span className="spinner" />
              Sedang memeriksa file...
            </div>
          )}

          {duplicateDecision && result.duplicates.length > 0 && (
            <p className="decision-message">
              {duplicateDecision === 'include'
                ? 'File duplikat akan ikut diekstrak.'
                : 'File duplikat tidak disertakan.'}
            </p>
          )}
        </aside>

        <section className="preview-panel">
          <div className="preview-header">
            <div className="preview-file">
              <div className="preview-file-icon">CSV</div>
              <div>
                <h2>{selectedResult?.fileName ?? 'Hasil Ekstraksi'}</h2>
                <p>
                  {selectedResult
                    ? `${selectedResult.pageCount} halaman · ${selectedResult.transactions.length} transaksi`
                    : 'Hasil transaksi akan ditampilkan di sini.'}
                </p>
              </div>
            </div>

            <div className="preview-actions">
              <button
                className={`secondary-button ${copyAnimating ? 'is-animating' : ''}`}
                disabled={!selectedResult || selectedResult.transactions.length === 0}
                onClick={() => {
                  if (selectedResult) {
                    void copyTransactions(selectedResult.transactions, selectedResult.fileName)
                  }
                }}
              >
                {copyAnimating ? 'Tersalin!' : 'Copy Data'}
              </button>
              <button
                className={`export-button ${exportAnimating ? 'is-animating' : ''}`}
                disabled={!selectedResult || selectedResult.transactions.length === 0}
                onClick={() => {
                  if (selectedResult) {
                    setExportAnimating(true)
                    downloadTransactionsCsv(selectedResult.fileName, selectedResult.transactions)
                    window.setTimeout(() => setExportAnimating(false), 650)
                  }
                }}
              >
                {exportAnimating ? 'Mengunduh...' : 'Ekspor CSV'}
              </button>
            </div>
          </div>

          {copyMessage && <p className="copy-message">{copyMessage}</p>}

          {extractionResults.length > 0 ? (
            <>
              {selectedResult?.status === 'pending' || selectedResult?.status === 'processing' ? (
                <div className="result-message">
                  <h3>{selectedResult.status === 'processing' ? 'Sedang diproses' : 'Menunggu proses'}</h3>
                  <p>{selectedResult.status === 'processing' ? 'Dokumen ini sedang diekstrak. Kamu tetap bisa membuka dokumen lain yang sudah selesai.' : 'Dokumen ini akan diekstrak sesuai antrean.'}</p>
                </div>
              ) : selectedResult?.error ? (
                <div className="result-message error">
                  <h3>Ekstraksi gagal</h3>
                  <p>{selectedResult.error}</p>
                </div>
              ) : selectedResult ? (
                <>
                  <div className="result-summary">
                    <span>{selectedResult.transactions.length} transaksi ditemukan</span>
                    <span className={selectedResult.validation.isValid ? 'validation-ok' : 'validation-warning'}>
                      {selectedResult.validation.isValid
                        ? 'Validasi saldo sesuai'
                        : `${selectedResult.validation.issues.length} temuan validasi`}
                    </span>
                  </div>

                  {!selectedResult.validation.isValid && (
                    <details className="validation-details">
                      <summary>
                        Lihat detail validasi ({selectedResult.validation.issues.length})
                      </summary>
                      <ul>
                        {selectedResult.validation.issues.map((issue, index) => (
                          <li key={`${issue.transactionIndex}-${issue.field}-${index}`}>
                            Halaman {issue.pageNumber}: {issue.message}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {selectedRange && (
                    <div
                      ref={selectionToolbarRef}
                      className="selection-toolbar selection-toolbar-floating"
                      style={{ left: selectionPosition.x, top: selectionPosition.y }}
                    >
                      <button
                        className={`selection-copy-button${copyAnimating ? ' is-copied' : ''}`}
                        aria-label="Copy"
                        title="Copy"
                        onClick={() => void copySelectedRange()}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  <div ref={transactionTableRef} className="transaction-table-wrap" onMouseUp={() => { isSelectingCells.current = false }}>
                    <table className="transaction-table">
                      <thead>
                        <tr>
                          {OUTPUT_COLUMNS.map((column, columnIndex) => (
                            <th key={column}>
                              <button
                                className="column-select-button"
                                onClick={(event) => {
                                  updateSelectionPosition(event.clientX, event.clientY)
                                  setSelectedRange({ startRow: 0, endRow: selectedResult.transactions.length - 1, startCol: columnIndex, endCol: columnIndex })
                                }}
                                title={`Pilih seluruh kolom ${column}`}
                              >
                                {column}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedResult.transactions.map((transaction, index) => (
                          <tr key={`${transaction['TGL/BLN/THN']}-${index}`}>
                            {OUTPUT_COLUMNS.map((column, columnIndex) => (
                              <td
                                key={column}
                                className={`${columnIndex >= 3 ? 'amount-cell ' : ''}${isCellSelected(index, columnIndex) ? 'cell-selected' : ''}`}
                                onMouseDown={(event) => {
                                  if (event.button === 0) {
                                    isSelectingCells.current = true
                                    updateSelectionPosition(event.clientX, event.clientY)
                                    selectCell(index, columnIndex, event.shiftKey)
                                  }
                                }}
                                onMouseEnter={(event) => {
                                  if (isSelectingCells.current) {
                                    updateSelectionPosition(event.clientX, event.clientY)
                                    selectCell(index, columnIndex, true)
                                  }
                                }}
                                onClick={(event) => {
                                  if (event.shiftKey) {
                                    updateSelectionPosition(event.clientX, event.clientY)
                                    selectCell(index, columnIndex, true)
                                  }
                                }}
                              >
                                {getTransactionCell(transaction, columnIndex)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="empty-preview">
              <div className="empty-preview-icon">▤</div>
              <h3>Belum ada data transaksi</h3>
              <p>Upload rekening koran PDF, lalu klik Ekstrak Data untuk menampilkan hasilnya.</p>
            </div>
          )}

        </section>
      </section>
    </main>
  )
}

interface DocumentItemProps {
  name: string
  size: string
  status: 'accepted' | 'duplicate' | 'rejected' | 'pending' | 'processing' | 'completed' | 'failed'
  source: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}

function DocumentItem({ name, size, status, source, active = false, disabled = false, onClick }: DocumentItemProps) {
  const statusLabels = {
    accepted: 'Diterima',
    duplicate: 'Duplikat',
    rejected: 'Ditolak',
    pending: 'Menunggu',
    processing: 'Proses',
    completed: 'Selesai',
    failed: 'Gagal',
  }

  return (
    <button
      type="button"
      className={`document-item ${status} ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? source : `Lihat hasil ekstraksi ${name}`}
    >
      <span className="pdf-icon">PDF</span>
      <span className="document-info">
        <strong title={name}>{name}</strong>
        <span title={source}>{source}{size && ` · ${size}`}</span>
      </span>
      <span className={`status-badge ${status}`}>{statusLabels[status]}</span>
    </button>
  )
}

export default App
