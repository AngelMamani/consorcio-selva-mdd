import { DomainError } from '@/domain/errors/DomainError'

/** Rectángulo normalizado (0–1) sobre la imagen. */
export type NormRect = {
  x: number
  y: number
  w: number
  h: number
}

/** Zona por defecto: primera línea del sello GPS (abajo-derecha). */
export const DEFAULT_DATE_COVER_RECT: NormRect = {
  x: 0.48,
  y: 0.808,
  w: 0.505,
  h: 0.032,
}

export type DateStampEdit = {
  dateText: string
  coverRect: NormRect
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampNormRect(rect: NormRect): NormRect {
  const w = clamp(rect.w, 0.04, 1)
  const h = clamp(rect.h, 0.015, 0.2)
  const x = clamp(rect.x, 0, 1 - w)
  const y = clamp(rect.y, 0, 1 - h)
  return { x, y, w, h }
}

export function formatStampDate(date = new Date()): string {
  const months = [
    'ene.',
    'feb.',
    'mar.',
    'abr.',
    'may.',
    'jun.',
    'jul.',
    'ago.',
    'set.',
    'oct.',
    'nov.',
    'dic.',
  ]
  const day = date.getDate()
  const month = months[date.getMonth()] ?? 'ene.'
  const year = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${day} ${month} ${year} ${hh}:${mm}:${ss}`
}

function rectCacheKey(rect: NormRect): string {
  const r = clampNormRect(rect)
  return `${r.x.toFixed(3)}_${r.y.toFixed(3)}_${r.w.toFixed(3)}_${r.h.toFixed(3)}`
}

/** Caché de imágenes ya decodificadas (evita re-leer el File en cada tecla). */
const imageCache = new Map<string, HTMLImageElement>()
/** Caché del fondo ya “curado” (sin fecha). Clave: fileKey|rect|size */
const healedCache = new Map<string, HTMLCanvasElement>()

function fileCacheKey(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`
}

export function clearDateStampCaches(): void {
  imageCache.clear()
  healedCache.clear()
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const key = fileCacheKey(file)
  const cached = imageCache.get(key)
  if (cached) return cached

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () =>
        reject(new DomainError(`No se pudo leer la imagen: ${file.name}`))
      element.src = url
    })
    imageCache.set(key, image)
    // Limitar caché
    if (imageCache.size > 24) {
      const first = imageCache.keys().next().value
      if (first) imageCache.delete(first)
    }
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Heal rápido: máscara por contraste local (sin ventana grande) +
 * relleno horizontal en pocas pasadas.
 */
function healDateRegion(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  rect: NormRect,
): void {
  const padX = Math.max(2, Math.round(rect.w * width * 0.01))
  const padY = Math.max(2, Math.round(rect.h * height * 0.18))
  const x0 = clamp(Math.floor(rect.x * width) - padX, 0, width - 1)
  const y0 = clamp(Math.floor(rect.y * height) - padY, 0, height - 1)
  const x1 = clamp(Math.ceil((rect.x + rect.w) * width) + padX, x0 + 1, width)
  const y1 = clamp(Math.ceil((rect.y + rect.h) * height) + padY, y0 + 1, height)
  const rw = x1 - x0
  const rh = y1 - y0
  if (rw < 2 || rh < 2) return

  const image = context.getImageData(x0, y0, rw, rh)
  const src = image.data
  const mask = new Uint8Array(rw * rh)

  // Fila de referencia arriba de la zona (fondo sin texto del sello)
  const refRow = 0
  for (let row = 0; row < rh; row += 1) {
    for (let col = 0; col < rw; col += 1) {
      const i = (row * rw + col) * 4
      const L = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]
      const ri = (refRow * rw + col) * 4
      const refL =
        0.299 * src[ri] + 0.587 * src[ri + 1] + 0.114 * src[ri + 2]
      // También comparar con vecinos inmediatos (barato)
      const left = col > 0 ? (row * rw + col - 1) * 4 : i
      const right = col + 1 < rw ? (row * rw + col + 1) * 4 : i
      const leftL =
        0.299 * src[left] + 0.587 * src[left + 1] + 0.114 * src[left + 2]
      const rightL =
        0.299 * src[right] + 0.587 * src[right + 1] + 0.114 * src[right + 2]
      const localDark = Math.min(refL, leftL, rightL)
      if (L > localDark + 20 && L > 100) {
        mask[row * rw + col] = 1
      }
    }
  }

  // Dilatar 1 vez
  const dilated = new Uint8Array(mask)
  for (let row = 1; row < rh - 1; row += 1) {
    for (let col = 1; col < rw - 1; col += 1) {
      if (mask[row * rw + col]) continue
      if (
        mask[(row - 1) * rw + col] ||
        mask[(row + 1) * rw + col] ||
        mask[row * rw + col - 1] ||
        mask[row * rw + col + 1]
      ) {
        dilated[row * rw + col] = 1
      }
    }
  }

  // Relleno horizontal (2 pasadas)
  for (let pass = 0; pass < 2; pass += 1) {
    for (let row = 0; row < rh; row += 1) {
      const cleanCols: number[] = []
      for (let col = 0; col < rw; col += 1) {
        if (!dilated[row * rw + col]) cleanCols.push(col)
      }
      if (cleanCols.length === 0) {
        for (let col = 0; col < rw; col += 1) {
          const dest = (row * rw + col) * 4
          const from = (refRow * rw + col) * 4
          src[dest] = src[from]
          src[dest + 1] = src[from + 1]
          src[dest + 2] = src[from + 2]
        }
        continue
      }

      let nextIdx = 0
      for (let col = 0; col < rw; col += 1) {
        if (!dilated[row * rw + col]) continue
        while (nextIdx < cleanCols.length && cleanCols[nextIdx] < col) {
          nextIdx += 1
        }
        const rightCol = nextIdx < cleanCols.length ? cleanCols[nextIdx] : -1
        const leftCol = nextIdx > 0 ? cleanCols[nextIdx - 1] : -1
        const dest = (row * rw + col) * 4

        if (leftCol >= 0 && rightCol >= 0 && rightCol !== leftCol) {
          const t = (col - leftCol) / (rightCol - leftCol)
          const a = (row * rw + leftCol) * 4
          const b = (row * rw + rightCol) * 4
          src[dest] = Math.round(src[a] + (src[b] - src[a]) * t)
          src[dest + 1] = Math.round(src[a + 1] + (src[b + 1] - src[a + 1]) * t)
          src[dest + 2] = Math.round(src[a + 2] + (src[b + 2] - src[a + 2]) * t)
        } else if (leftCol >= 0) {
          const a = (row * rw + leftCol) * 4
          src[dest] = src[a]
          src[dest + 1] = src[a + 1]
          src[dest + 2] = src[a + 2]
        } else if (rightCol >= 0) {
          const b = (row * rw + rightCol) * 4
          src[dest] = src[b]
          src[dest + 1] = src[b + 1]
          src[dest + 2] = src[b + 2]
        } else {
          const from = (refRow * rw + col) * 4
          src[dest] = src[from]
          src[dest + 1] = src[from + 1]
          src[dest + 2] = src[from + 2]
        }
      }
    }
  }

  // Blur 3x3 solo en máscara (1 pasada)
  const copy = new Uint8ClampedArray(src)
  for (let row = 1; row < rh - 1; row += 1) {
    for (let col = 1; col < rw - 1; col += 1) {
      if (!dilated[row * rw + col]) continue
      for (let c = 0; c < 3; c += 1) {
        let sum = 0
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            sum += copy[((row + dy) * rw + (col + dx)) * 4 + c]
          }
        }
        src[(row * rw + col) * 4 + c] = Math.round(sum / 9)
      }
    }
  }

  context.putImageData(image, x0, y0)
}

type SampledStampStyle = {
  r: number
  g: number
  b: number
  lineHeight: number
}

function sampleStampStyleBelow(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  rect: NormRect,
): SampledStampStyle {
  const lineH = Math.max(8, Math.round(rect.h * height))
  const x0 = clamp(Math.floor(rect.x * width), 0, width - 1)
  const x1 = clamp(Math.ceil((rect.x + rect.w) * width), x0 + 1, width)
  const y0 = clamp(Math.floor((rect.y + rect.h) * height) + 1, 0, height - 1)
  const y1 = clamp(y0 + Math.round(lineH * 1.15), y0 + 1, height)
  const rw = x1 - x0
  const rh = y1 - y0
  if (rw < 4 || rh < 4) {
    return { r: 245, g: 245, b: 245, lineHeight: lineH }
  }

  const data = context.getImageData(x0, y0, rw, rh).data
  let rSum = 0
  let gSum = 0
  let bSum = 0
  let count = 0
  let minY = rh
  let maxY = 0
  // Muestrear cada 2 px para ir más rápido
  for (let row = 0; row < rh; row += 2) {
    for (let col = 0; col < rw; col += 2) {
      const i = (row * rw + col) * 4
      const L = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (L < 175) continue
      rSum += data[i]
      gSum += data[i + 1]
      bSum += data[i + 2]
      count += 1
      if (row < minY) minY = row
      if (row > maxY) maxY = row
    }
  }

  if (count < 6) {
    return { r: 248, g: 248, b: 248, lineHeight: lineH }
  }

  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
    lineHeight: Math.max(10, maxY - minY + 1),
  }
}

function drawDateText(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  rect: NormRect,
  dateText: string,
): void {
  const text = dateText.trim()
  if (!text) return

  const style = sampleStampStyleBelow(context, width, height, rect)
  const boxW = rect.w * width
  const boxH = rect.h * height
  const right = (rect.x + rect.w) * width - Math.max(3, boxW * 0.01)
  const baseline = rect.y * height + boxH * 0.76

  let fontSize = Math.max(10, Math.round(style.lineHeight * 0.92))
  fontSize = Math.min(fontSize, Math.round(boxH * 0.9))
  const fontFamily = 'Arial, "Helvetica Neue", Helvetica, sans-serif'

  context.save()
  context.textAlign = 'right'
  context.textBaseline = 'alphabetic'
  context.font = `400 ${fontSize}px ${fontFamily}`
  const maxWidth = boxW * 0.98
  while (fontSize > 9 && context.measureText(text).width > maxWidth) {
    fontSize -= 1
    context.font = `400 ${fontSize}px ${fontFamily}`
  }

  context.shadowColor = 'transparent'
  context.shadowBlur = 0
  context.fillStyle = `rgb(${style.r},${style.g},${style.b})`
  context.fillText(text, right, baseline)
  context.restore()
}

function drawScaledImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
): void {
  context.drawImage(image, 0, 0, width, height)
}

function getHealedCanvas(
  image: HTMLImageElement,
  file: File,
  rect: NormRect,
  width: number,
  height: number,
): HTMLCanvasElement {
  const key = `${fileCacheKey(file)}|${rectCacheKey(rect)}|${width}x${height}`
  const cached = healedCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new DomainError('No se pudo preparar el lienzo')

  drawScaledImage(context, image, width, height)
  healDateRegion(context, width, height, clampNormRect(rect))

  healedCache.set(key, canvas)
  if (healedCache.size > 16) {
    const first = healedCache.keys().next().value
    if (first) healedCache.delete(first)
  }
  return canvas
}

const PREVIEW_MAX_EDGE = 960

function fitSize(
  naturalW: number,
  naturalH: number,
  maxEdge: number,
): { width: number; height: number } {
  const edge = Math.max(naturalW, naturalH)
  if (edge <= maxEdge) return { width: naturalW, height: naturalH }
  const scale = maxEdge / edge
  return {
    width: Math.max(1, Math.round(naturalW * scale)),
    height: Math.max(1, Math.round(naturalH * scale)),
  }
}

/** Preview rápido (baja resolución + caché del fondo curado). */
export async function renderDateStampPreview(
  file: File,
  edit: DateStampEdit,
): Promise<string> {
  const image = await loadImageFromFile(file)
  const naturalW = image.naturalWidth || image.width
  const naturalH = image.naturalHeight || image.height
  const { width, height } = fitSize(naturalW, naturalH, PREVIEW_MAX_EDGE)
  const rect = clampNormRect(edit.coverRect)

  const healed = getHealedCanvas(image, file, rect, width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new DomainError('No se pudo preparar la vista previa')

  context.drawImage(healed, 0, 0)
  drawDateText(context, width, height, rect, edit.dateText)
  return canvas.toDataURL('image/jpeg', 0.72)
}

/** Exportación a resolución completa (solo al guardar). */
export async function exportDateStampImage(
  file: File,
  edit: DateStampEdit,
  quality = 0.92,
): Promise<{ blob: Blob; fileName: string }> {
  const image = await loadImageFromFile(file)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const rect = clampNormRect(edit.coverRect)

  const healed = getHealedCanvas(image, file, rect, width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new DomainError('No se pudo exportar la imagen')

  context.drawImage(healed, 0, 0)
  drawDateText(context, width, height, rect, edit.dateText)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new DomainError('No se pudo generar el JPEG')),
      'image/jpeg',
      quality,
    )
  })

  const base = file.name.replace(/\.[^.]+$/, '') || 'foto'
  const safe = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'foto'
  return { blob, fileName: `${safe}.jpg` }
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<FileSystemDirectoryHandle>
}

function safeFolderName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
  return cleaned || 'fotos-editadas'
}

export function canSaveImagesToFolder(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
}

export async function saveEditedImagesToFolder(
  items: Array<{ file: File; edit: DateStampEdit }>,
  folderName: string,
  onProgress?: (label: string) => void,
): Promise<{ folderName: string; count: number }> {
  if (items.length === 0) {
    throw new DomainError('No hay fotos para guardar')
  }
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) {
    throw new DomainError(
      'Tu navegador no permite guardar en carpeta. Se usará descarga ZIP.',
    )
  }

  const parent = await picker.call(window, { mode: 'readwrite' })
  const outName = safeFolderName(folderName)
  const outDir = await parent.getDirectoryHandle(outName, { create: true })

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    onProgress?.(
      `Guardando ${item.file.name} (${index + 1}/${items.length})...`,
    )
    const exported = await exportDateStampImage(item.file, item.edit)
    const fileHandle = await outDir.getFileHandle(exported.fileName, {
      create: true,
    })
    const writable = await fileHandle.createWritable()
    await writable.write(exported.blob)
    await writable.close()
  }

  return { folderName: outName, count: items.length }
}

export async function zipEditedImages(
  items: Array<{ file: File; edit: DateStampEdit }>,
  zipName: string,
  onProgress?: (label: string) => void,
): Promise<{ blob: Blob; fileName: string }> {
  if (items.length === 0) {
    throw new DomainError('No hay fotos para empaquetar')
  }
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    onProgress?.(
      `Empaquetando ${item.file.name} (${index + 1}/${items.length})...`,
    )
    const exported = await exportDateStampImage(item.file, item.edit)
    zip.file(exported.fileName, exported.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  return {
    blob,
    fileName: `${safeFolderName(zipName)}.zip`,
  }
}
