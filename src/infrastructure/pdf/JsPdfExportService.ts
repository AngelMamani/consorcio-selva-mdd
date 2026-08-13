import { jsPDF } from 'jspdf'
import type {
  PdfExportResult,
  PdfExportService,
  PdfImageSource,
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

export class JsPdfExportService implements PdfExportService {
  async createImagesDocument(
    fileName: string,
    images: PdfImageSource[],
  ): Promise<PdfExportResult> {
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

      let blob: Blob
      try {
        blob = await downloadStorageBlob(source.storagePath)
      } catch {
        throw new DomainError(
          `No se pudo leer la imagen "${source.title}" desde Storage`,
        )
      }

      const image = await loadImageFromBlob(blob)
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
}
