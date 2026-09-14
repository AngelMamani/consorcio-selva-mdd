import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import type {
  PdfExportResult,
  PdfExportService,
  PdfImageSource,
  PdfLocalImageSource,
} from '@/domain/repositories/PdfExportService'
import { DomainError } from '@/domain/errors/DomainError'
import { downloadStorageBlob } from '@/infrastructure/storage/downloadStorageBlob'

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob)

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () =>
        reject(new DomainError('Imagen inválida para PDF'))
      element.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function canvasFromImage(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new DomainError('No se pudo procesar la imagen para PDF')
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0)
  return canvas
}

async function buildImagesPdf(
  fileName: string,
  images: Array<{ title: string; blob: Blob }>,
): Promise<PdfExportResult> {
  if (images.length === 0) {
    throw new DomainError('No hay imágenes para exportar')
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const usableWidth = pageWidth - margin * 2
  const usableHeight = pageHeight - margin * 2

  for (let index = 0; index < images.length; index += 1) {
    if (index > 0) {
      pdf.addPage()
    }

    const source = images[index]
    const image = await loadImageFromBlob(source.blob)
    const canvas = canvasFromImage(image)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    const ratio = Math.min(
      usableWidth / canvas.width,
      usableHeight / canvas.height,
    )
    const drawWidth = canvas.width * ratio
    const drawHeight = canvas.height * ratio
    const offsetX = margin + (usableWidth - drawWidth) / 2
    const offsetY = margin + (usableHeight - drawHeight) / 2

    pdf.addImage(dataUrl, 'JPEG', offsetX, offsetY, drawWidth, drawHeight)
  }

  return {
    blob: pdf.output('blob'),
    fileName,
  }
}

export class JsPdfExportService implements PdfExportService {
  async createImagesDocument(
    fileName: string,
    images: PdfImageSource[],
  ): Promise<PdfExportResult> {
    const local: Array<{ title: string; blob: Blob }> = []
    for (const source of images) {
      try {
        const blob = await downloadStorageBlob(source.storagePath)
        local.push({ title: source.title, blob })
      } catch {
        throw new DomainError(
          `No se pudo leer la imagen "${source.title}" desde Storage`,
        )
      }
    }
    return buildImagesPdf(fileName, local)
  }

  async createLocalImagesDocument(
    fileName: string,
    images: PdfLocalImageSource[],
  ): Promise<PdfExportResult> {
    return buildImagesPdf(
      fileName,
      images.map((image) => ({ title: image.title, blob: image.data })),
    )
  }

  async mergeDocuments(
    fileName: string,
    documents: ArrayBuffer[],
  ): Promise<PdfExportResult> {
    if (documents.length < 2) {
      throw new DomainError('Se necesitan al menos 2 PDFs para unir')
    }

    try {
      const merged = await PDFDocument.create()
      for (let index = 0; index < documents.length; index += 1) {
        const bytes = documents[index]
        if (!bytes || bytes.byteLength === 0) {
          throw new DomainError(`El PDF #${index + 1} está vacío o no es válido`)
        }
        let source: PDFDocument
        try {
          source = await PDFDocument.load(bytes, { ignoreEncryption: true })
        } catch {
          throw new DomainError(
            `No se pudo leer el PDF #${index + 1}. Verifica que no esté dañado o protegido.`,
          )
        }
        if (source.getPageCount() === 0) {
          throw new DomainError(`El PDF #${index + 1} no tiene páginas`)
        }
        const pages = await merged.copyPages(source, source.getPageIndices())
        for (const page of pages) {
          merged.addPage(page)
        }
      }

      const output = await merged.save()
      const outBytes = new Uint8Array(output)
      return {
        blob: new Blob([outBytes], { type: 'application/pdf' }),
        fileName,
      }
    } catch (error) {
      if (error instanceof DomainError) throw error
      throw new DomainError('No se pudieron unir los PDFs')
    }
  }
}
