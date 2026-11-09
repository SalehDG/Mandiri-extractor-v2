import { useRef, useState } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { processUploadedFiles } from '../features/pdf-upload/services/upload-processor'
import type { UploadProcessingResult } from '../features/pdf-upload/services/upload-processor'
import './App.css'

const UPLOAD_OPTIONS = {
  maxArchiveSizeBytes: 50 * 1024 * 1024,
  maxEntries: 500,
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<UploadProcessingResult>({
    uniquePdfs: [],
    duplicates: [],
    rejectedFiles: [],
  })
  const [duplicateDecision, setDuplicateDecision] = useState<
    'include' | 'exclude' | null
  >(null)
  const [error, setError] = useState('')

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)

    if (files.length === 0) return

    setIsProcessing(true)
    setError('')
    setDuplicateDecision(null)

    try {
      const processingResult = await processUploadedFiles(
        files,
        UPLOAD_OPTIONS,
      )

      setResult((previous) => ({
        uniquePdfs: [
          ...previous.uniquePdfs,
          ...processingResult.uniquePdfs,
        ],
        duplicates: [
          ...previous.duplicates,
          ...processingResult.duplicates,
        ],
        rejectedFiles: [
          ...previous.rejectedFiles,
          ...processingResult.rejectedFiles,
        ],
      }))

      if (processingResult.duplicates.length > 0) {
        const shouldContinue = window.confirm(
          `Ditemukan ${processingResult.duplicates.length} file duplikat. Apakah kamu ingin tetap melanjutkan dengan file duplikat tersebut?`,
        )

        setDuplicateDecision(
          shouldContinue ? 'include' : 'exclude',
        )
      }
    } catch {
      setError('Terjadi kesalahan saat memproses file.')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      void handleFiles(event.target.files)
    }

    // Memungkinkan file yang sama dipilih kembali.
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
    setResult({
      uniquePdfs: [],
      duplicates: [],
      rejectedFiles: [],
    })
    setDuplicateDecision(null)
    setError('')
  }

  const totalFiles =
    result.uniquePdfs.length +
    result.duplicates.length +
    result.rejectedFiles.length

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
            disabled={isProcessing}
          >
            <span className="upload-plus">+</span>
            {isProcessing ? 'Memproses file...' : 'Pilih PDF / ZIP'}
          </button>

          <div className="document-heading">
            <div className="document-title">
              <h2>Daftar Dokumen</h2>
              <span className="file-count">{totalFiles} file</span>
            </div>

            <button
              className="clear-button"
              onClick={removeAllFiles}
              disabled={totalFiles === 0 || isProcessing}
            >
              Hapus Semua
            </button>
          </div>

          {error && <p className="error-message">{error}</p>}

          {result.uniquePdfs.length === 0 &&
            result.duplicates.length === 0 &&
            result.rejectedFiles.length === 0 && (
              <div className="empty-documents">
                <p>Belum ada dokumen.</p>
                <span>Upload PDF atau ZIP untuk memulai.</span>
              </div>
            )}

          {result.uniquePdfs.map((item) => (
            <DocumentItem
              key={`${item.sourcePath}-${item.file.name}`}
              name={item.file.name}
              size={formatFileSize(item.file.size)}
              status="accepted"
              source={item.sourceType === 'zip' ? 'Dari ZIP' : 'PDF'}
            />
          ))}

          {result.duplicates.map((item, index) => (
            <DocumentItem
              key={`duplicate-${index}`}
              name={item.file.file.name}
              size={formatFileSize(item.file.file.size)}
              status="duplicate"
              source={`Duplikat dari ${item.duplicateOf.file.name}`}
            />
          ))}

          {result.rejectedFiles.map((item, index) => (
            <DocumentItem
              key={`rejected-${index}`}
              name={item.fileName}
              size=""
              status="rejected"
              source={item.reason}
            />
          ))}

          {isProcessing && (
            <div className="processing-indicator">
              <span className="spinner" />
              Sedang memeriksa file...
            </div>
          )}

          {duplicateDecision && (
            <p className="decision-message">
              {duplicateDecision === 'include'
                ? 'Duplikat diizinkan untuk tahap berikutnya.'
                : 'File duplikat tidak akan disertakan.'}
            </p>
          )}
        </aside>

        <section className="preview-panel">
          <div className="preview-header">
            <div className="preview-file">
              <div className="preview-file-icon">PDF</div>
              <div>
                <h2>Belum ada dokumen dipilih</h2>
                <p>Hasil transaksi akan ditampilkan di sini.</p>
              </div>
            </div>

            <div className="preview-actions">
              <button className="secondary-button" disabled>
                Copy Semua
              </button>
              <button className="export-button" disabled>
                Ekspor ke Excel
              </button>
            </div>
          </div>

          <div className="empty-preview">
            <div className="empty-preview-icon">▤</div>
            <h3>Belum ada data transaksi</h3>
            <p>
              Upload rekening koran PDF untuk mulai memproses
              data transaksi.
            </p>
          </div>
        </section>
      </section>
    </main>
  )
}

interface DocumentItemProps {
  name: string
  size: string
  status: 'accepted' | 'duplicate' | 'rejected'
  source: string
}

function DocumentItem({
  name,
  size,
  status,
  source,
}: DocumentItemProps) {
  const statusLabels = {
    accepted: 'Diterima',
    duplicate: 'Duplikat',
    rejected: 'Ditolak',
  }

  return (
    <div className={`document-item ${status}`}>
      <div className="pdf-icon">PDF</div>

      <div className="document-info">
        <strong title={name}>{name}</strong>
        <span title={source}>
          {source}
          {size && ` · ${size}`}
        </span>
      </div>

      <span className={`status-badge ${status}`}>
        {statusLabels[status]}
      </span>
    </div>
  )
}

export default App