import { jsPDF } from 'jspdf'
import type {
  AttendanceExportLine,
  AttendanceExportReport,
} from '@/domain/entities/AttendanceExportReport'
import { formatExportCoord } from '@/domain/entities/AttendanceExportReport'
import type { AttendanceExportFile } from '@/domain/repositories/AttendanceExcelExportService'
import type { AttendancePdfExportService } from '@/domain/repositories/AttendancePdfExportService'
import { downloadStorageBlob } from '@/infrastructure/storage/downloadStorageBlob'

const BRAND_BLUE: [number, number, number] = [21, 101, 192]
const BRAND_GREEN: [number, number, number] = [46, 125, 50]
const MUTED: [number, number, number] = [90, 98, 112]
const LINE: [number, number, number] = [220, 226, 234]
const OFFICE_BG: [number, number, number] = [227, 242, 253]
const ZONE_BG: [number, number, number] = [232, 245, 233]
const PERMISO_BG: [number, number, number] = [243, 229, 245]
const MISSING_BG: [number, number, number] = [255, 235, 238]

const MARGIN = 14
const PAGE_WIDTH = 210
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = 288

const TABLE_COLS = [
  { key: 'personName', label: 'Persona', width: 52 },
  { key: 'attendedLabel', label: 'Asistió', width: 18 },
  { key: 'originLabel', label: 'Tipo', width: 28 },
  { key: 'timeLabel', label: 'Hora', width: 20 },
  { key: 'personRole', label: 'Rol', width: 54 },
] as const

async function jpegFromStoragePath(
  storagePath: string,
): Promise<string | null> {
  try {
    const blob = await downloadStorageBlob(storagePath)
    const objectUrl = URL.createObjectURL(blob)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image()
        element.onload = () => resolve(element)
        element.onerror = () => reject(new Error('invalid-image'))
        element.src = objectUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth || image.width
      canvas.height = image.naturalHeight || image.height
      const context = canvas.getContext('2d')
      if (!context) return null
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      return canvas.toDataURL('image/jpeg', 0.86)
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return null
  }
}

function cellText(
  line: AttendanceExportLine,
  key: (typeof TABLE_COLS)[number]['key'],
): string {
  return String(line[key] ?? '')
}

export class JsPdfAttendanceExportService implements AttendancePdfExportService {
  async createEvidenceDocument(
    report: AttendanceExportReport,
  ): Promise<AttendanceExportFile> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    this.drawCover(pdf, report)
    this.drawRoster(pdf, report)

    for (const line of report.present) {
      pdf.addPage()
      await this.drawEvidencePage(pdf, report, line)
    }

    this.drawFooters(pdf, report)

    return {
      blob: pdf.output('blob'),
      fileName: `asistencia-${report.dateKey}-evidencia.pdf`,
    }
  }

  private drawCover(pdf: jsPDF, report: AttendanceExportReport): void {
    pdf.setFillColor(...BRAND_BLUE)
    pdf.rect(0, 0, PAGE_WIDTH, 42, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text('Consorcio Selva MDD', MARGIN, 18)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(12)
    pdf.text('Parte diario de asistencia · evidencia', MARGIN, 28)
    pdf.setFontSize(10)
    pdf.text(report.dateLabel, MARGIN, 36)

    pdf.setTextColor(30, 35, 45)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('Este PDF', MARGIN, 54)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    const purpose = pdf.splitTextToSize(
      'Archivo de evidencia: lista del día y GPS. En campo puede incluir foto. El Excel de control sirve para filtros y planillas.',
      CONTENT_WIDTH,
    )
    pdf.text(purpose, MARGIN, 61)

    pdf.setFont('helvetica', 'bold')
    pdf.text('Oficina', MARGIN, 82)
    pdf.setFont('helvetica', 'normal')
    pdf.text(
      `${report.officeName}  ·  radio ${report.officeRadiusMeters} m`,
      MARGIN,
      89,
    )
    pdf.setTextColor(...MUTED)
    pdf.text(
      `GPS oficina: ${report.officeLatitude.toFixed(6)}, ${report.officeLongitude.toFixed(6)}`,
      MARGIN,
      96,
    )

    this.drawKpiBox(pdf, MARGIN, 108, 'Personas', String(report.totals.people), BRAND_BLUE)
    this.drawKpiBox(pdf, MARGIN + 46, 108, 'Oficina', String(report.totals.office), BRAND_BLUE)
    this.drawKpiBox(pdf, MARGIN + 92, 108, 'Campo', String(report.totals.zone), BRAND_GREEN)
    this.drawKpiBox(pdf, MARGIN + 138, 108, 'Sin marca', String(report.totals.missing), [198, 40, 40])

    pdf.setTextColor(30, 35, 45)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text('Contenido', MARGIN, 152)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text('1. Portada con indicadores', MARGIN, 160)
    pdf.text('2. Lista de asistencia del día', MARGIN, 167)
    pdf.text(
      `3. Evidencia individual (${report.present.length}) con foto y GPS`,
      MARGIN,
      174,
    )
    pdf.setTextColor(...MUTED)
    pdf.text(
      `Generado ${report.generatedAtLabel} por ${report.generatedByName}`,
      MARGIN,
      188,
    )
  }

  private drawKpiBox(
    pdf: jsPDF,
    x: number,
    y: number,
    label: string,
    value: string,
    color: [number, number, number],
  ): void {
    pdf.setFillColor(248, 250, 252)
    pdf.setDrawColor(...LINE)
    pdf.roundedRect(x, y, 42, 28, 2, 2, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.setTextColor(...color)
    pdf.text(value, x + 4, y + 14)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    pdf.text(label, x + 4, y + 22)
  }

  private drawRoster(pdf: jsPDF, report: AttendanceExportReport): void {
    pdf.addPage()
    this.drawSectionHeader(pdf, 'Lista de asistencia', report.dateLabel)

    let y = 36
    y = this.drawTableHeader(pdf, y)

    for (const line of report.all) {
      const texts = TABLE_COLS.map((col) =>
        pdf.splitTextToSize(cellText(line, col.key), col.width - 3),
      )
      const lines = Math.max(1, ...texts.map((item) => item.length))
      const rowHeight = Math.max(8, lines * 4.4 + 3)
      if (y + rowHeight > FOOTER_Y - 6) {
        pdf.addPage()
        this.drawSectionHeader(pdf, 'Lista de asistencia', report.dateLabel)
        y = 36
        y = this.drawTableHeader(pdf, y)
      }
      this.drawTableRow(pdf, line, texts, y, rowHeight)
      y += rowHeight
    }
  }

  private drawSectionHeader(pdf: jsPDF, title: string, subtitle: string): void {
    pdf.setFillColor(...BRAND_BLUE)
    pdf.rect(0, 0, PAGE_WIDTH, 24, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.text(title, MARGIN, 11)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(subtitle, MARGIN, 18)
  }

  private drawTableHeader(pdf: jsPDF, y: number): number {
    pdf.setFillColor(21, 101, 192)
    pdf.rect(MARGIN, y, CONTENT_WIDTH, 8, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    let x = MARGIN
    for (const col of TABLE_COLS) {
      pdf.text(col.label, x + 1.5, y + 5.4)
      x += col.width
    }
    return y + 8
  }

  private drawTableRow(
    pdf: jsPDF,
    line: AttendanceExportLine,
    texts: string[][],
    y: number,
    rowHeight: number,
  ): void {
    const fill: [number, number, number] =
      line.status === 'No asistió'
        ? MISSING_BG
        : line.originLabel === 'Permiso'
          ? PERMISO_BG
          : line.originLabel === 'Oficina'
            ? OFFICE_BG
            : ZONE_BG
    pdf.setFillColor(...fill)
    pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F')
    pdf.setDrawColor(...LINE)
    pdf.line(MARGIN, y + rowHeight, MARGIN + CONTENT_WIDTH, y + rowHeight)

    pdf.setTextColor(30, 35, 45)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    let x = MARGIN
    texts.forEach((lines, index) => {
      pdf.text(lines, x + 1.5, y + 4.4)
      x += TABLE_COLS[index]?.width ?? 0
    })
  }

  private async drawEvidencePage(
    pdf: jsPDF,
    report: AttendanceExportReport,
    line: AttendanceExportLine,
  ): Promise<void> {
    this.drawSectionHeader(
      pdf,
      'Evidencia de marca',
      `${report.dateLabel} · ${line.originLabel}`,
    )

    pdf.setTextColor(30, 35, 45)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text(line.personName, MARGIN, 38)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...MUTED)
    pdf.text(line.personEmail, MARGIN, 45)

    const facts = [
      ['Asistió', line.attendedLabel],
      ['Tipo', line.originLabel],
      ['Hora', line.timeLabel],
      ['Rol', line.personRole],
      ['Permiso', line.permissionNote],
      ['GPS validado', line.officeValidatedLabel],
      [
        'Coordenadas',
        `${formatExportCoord(line.latitude)}, ${formatExportCoord(line.longitude)}`,
      ],
      [
        'Precisión',
        line.accuracyMeters == null ? '—' : `±${Math.round(line.accuracyMeters)} m`,
      ],
      [
        'Distancia oficina',
        line.distanceToOfficeMeters == null
          ? '—'
          : `${line.distanceToOfficeMeters} m`,
      ],
    ]

    let y = 56
    pdf.setFontSize(10)
    for (const [label, value] of facts) {
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...MUTED)
      pdf.text(label, MARGIN, y)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(30, 35, 45)
      pdf.text(value, MARGIN + 42, y)
      y += 7
    }

    y += 4
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 35, 45)
    pdf.text('Foto del entorno', MARGIN, y)
    y += 4

    const photoTop = y
    const photoMaxWidth = CONTENT_WIDTH
    const photoMaxHeight = FOOTER_Y - 10 - photoTop

    if (line.photoPath) {
      const jpeg = await jpegFromStoragePath(line.photoPath)
      if (jpeg) {
        const props = pdf.getImageProperties(jpeg)
        const ratio = Math.min(
          photoMaxWidth / props.width,
          photoMaxHeight / props.height,
        )
        const drawWidth = props.width * ratio
        const drawHeight = props.height * ratio
        pdf.addImage(jpeg, 'JPEG', MARGIN, photoTop, drawWidth, drawHeight)
        return
      }
    }

    pdf.setFillColor(245, 247, 250)
    pdf.roundedRect(MARGIN, photoTop, CONTENT_WIDTH, 70, 3, 3, 'F')
    pdf.setTextColor(...MUTED)
    pdf.setFont('helvetica', 'normal')
    pdf.text(
      'No hay foto de entorno disponible para esta marca.',
      MARGIN + 6,
      photoTop + 36,
    )
  }

  private drawFooters(pdf: jsPDF, report: AttendanceExportReport): void {
    const pageCount = pdf.getNumberOfPages()
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page)
      pdf.setDrawColor(...LINE)
      pdf.line(MARGIN, FOOTER_Y - 4, PAGE_WIDTH - MARGIN, FOOTER_Y - 4)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(...MUTED)
      pdf.text(
        `Consorcio Selva MDD · evidencia ${report.dateKey}`,
        MARGIN,
        FOOTER_Y,
      )
      pdf.text(
        `${page} / ${pageCount}`,
        PAGE_WIDTH - MARGIN,
        FOOTER_Y,
        { align: 'right' },
      )
    }
  }
}
