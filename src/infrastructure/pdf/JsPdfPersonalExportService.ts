import { jsPDF } from 'jspdf'
import type {
  PersonalExportLine,
  PersonalExportReport,
} from '@/domain/entities/PersonalExportReport'
import type { PersonalExportFile } from '@/domain/repositories/PersonalExcelExportService'
import type { PersonalPdfExportService } from '@/domain/repositories/PersonalPdfExportService'

const BRAND_BLUE: [number, number, number] = [21, 101, 192]
const BRAND_GREEN: [number, number, number] = [46, 125, 50]
const MUTED: [number, number, number] = [90, 98, 112]
const LINE: [number, number, number] = [220, 226, 234]
const VIGENTE_BG: [number, number, number] = [232, 245, 233]
const INGRESO_BG: [number, number, number] = [255, 243, 224]
const RETIRADO_BG: [number, number, number] = [255, 235, 238]
const SIN_ROL_BG: [number, number, number] = [245, 247, 250]

const MARGIN = 12
const PAGE_WIDTH = 297
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = 200

const TABLE_COLS = [
  { key: 'index', label: 'N°', width: 12 },
  { key: 'fullName', label: 'Persona', width: 62 },
  { key: 'dni', label: 'DNI', width: 24 },
  { key: 'cargoName', label: 'Cargo', width: 48 },
  { key: 'localidadName', label: 'Localidad', width: 42 },
  { key: 'rolesLabel', label: 'Roles', width: 55 },
  { key: 'conditionLabel', label: 'Condición', width: 30 },
] as const

type TableKey = (typeof TABLE_COLS)[number]['key']

function cellText(
  line: PersonalExportLine,
  index: number,
  key: TableKey,
): string {
  if (key === 'index') return String(index + 1)
  return String(line[key] ?? '')
}

export class JsPdfPersonalExportService implements PersonalPdfExportService {
  createDocument(report: PersonalExportReport): PersonalExportFile {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    this.drawCover(pdf, report)
    this.drawRoster(pdf, report)
    this.drawFooters(pdf, report)

    return {
      blob: pdf.output('blob'),
      fileName: `personal-${report.dateKey}.pdf`,
    }
  }

  private drawCover(pdf: jsPDF, report: PersonalExportReport): void {
    pdf.setFillColor(...BRAND_BLUE)
    pdf.rect(0, 0, PAGE_WIDTH, 36, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text('Consorcio Selva MDD', MARGIN, 16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(12)
    pdf.text('Recursos Humanos · listado de personal', MARGIN, 26)

    pdf.setTextColor(30, 35, 45)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('Este PDF', MARGIN, 48)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    const purpose = pdf.splitTextToSize(
      'Listado del personal visible en Recursos Humanos. Una fila por persona (DNI), con cargo, localidad, roles de acceso y condición.',
      CONTENT_WIDTH,
    )
    pdf.text(purpose, MARGIN, 55)

    pdf.setFont('helvetica', 'bold')
    pdf.text('Filtro aplicado', MARGIN, 72)
    pdf.setFont('helvetica', 'normal')
    pdf.text(report.filterLabel, MARGIN, 79)

    this.drawKpiBox(
      pdf,
      MARGIN,
      92,
      'Personas',
      String(report.totals.people),
      BRAND_BLUE,
    )
    this.drawKpiBox(
      pdf,
      MARGIN + 54,
      92,
      'Vigentes',
      String(report.totals.vigentes),
      BRAND_GREEN,
    )
    this.drawKpiBox(
      pdf,
      MARGIN + 108,
      92,
      'Sin rol',
      String(report.totals.withoutRole),
      [198, 40, 40],
    )
    this.drawKpiBox(
      pdf,
      MARGIN + 162,
      92,
      'Retirados',
      String(report.totals.retirados),
      [121, 85, 72],
    )
    this.drawKpiBox(
      pdf,
      MARGIN + 216,
      92,
      'En RR.HH.',
      String(report.rosterCount),
      MUTED,
    )

    pdf.setTextColor(30, 35, 45)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text('Contenido', MARGIN, 138)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text('1. Portada con indicadores', MARGIN, 146)
    pdf.text(
      `2. Lista de personal (${report.totals.people}) ordenada A–Z`,
      MARGIN,
      153,
    )
    pdf.setTextColor(...MUTED)
    pdf.text(
      `Generado ${report.generatedAtLabel} por ${report.generatedByName}`,
      MARGIN,
      168,
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
    pdf.roundedRect(x, y, 50, 28, 2, 2, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.setTextColor(...color)
    pdf.text(value, x + 4, y + 14)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    pdf.text(label, x + 4, y + 22)
  }

  private drawRoster(pdf: jsPDF, report: PersonalExportReport): void {
    pdf.addPage()
    this.drawSectionHeader(pdf, 'Lista de personal', report.filterLabel)

    let y = 30
    y = this.drawTableHeader(pdf, y)

    report.all.forEach((line, index) => {
      const texts = TABLE_COLS.map((col) =>
        pdf.splitTextToSize(
          cellText(line, index, col.key),
          col.width - 3,
        ),
      )
      const lines = Math.max(1, ...texts.map((item) => item.length))
      const rowHeight = Math.max(7.2, lines * 4.2 + 2.6)
      if (y + rowHeight > FOOTER_Y - 6) {
        pdf.addPage()
        this.drawSectionHeader(pdf, 'Lista de personal', report.filterLabel)
        y = 30
        y = this.drawTableHeader(pdf, y)
      }
      this.drawTableRow(pdf, line, texts, y, rowHeight)
      y += rowHeight
    })
  }

  private drawSectionHeader(pdf: jsPDF, title: string, subtitle: string): void {
    pdf.setFillColor(...BRAND_BLUE)
    pdf.rect(0, 0, PAGE_WIDTH, 20, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.text(title, MARGIN, 9)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(subtitle, MARGIN, 16)
  }

  private drawTableHeader(pdf: jsPDF, y: number): number {
    pdf.setFillColor(21, 101, 192)
    pdf.rect(MARGIN, y, CONTENT_WIDTH, 8, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    let x = MARGIN
    for (const col of TABLE_COLS) {
      pdf.text(col.label, x + 1.4, y + 5.4)
      x += col.width
    }
    return y + 8
  }

  private drawTableRow(
    pdf: jsPDF,
    line: PersonalExportLine,
    texts: string[][],
    y: number,
    rowHeight: number,
  ): void {
    const fill: [number, number, number] =
      line.conditionCode === 'RETIRADO'
        ? RETIRADO_BG
        : line.conditionCode === 'INGRESO'
          ? INGRESO_BG
          : !line.hasRole
            ? SIN_ROL_BG
            : VIGENTE_BG
    pdf.setFillColor(...fill)
    pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F')
    pdf.setDrawColor(...LINE)
    pdf.line(MARGIN, y + rowHeight, MARGIN + CONTENT_WIDTH, y + rowHeight)

    pdf.setTextColor(30, 35, 45)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    let x = MARGIN
    texts.forEach((lines, index) => {
      pdf.text(lines, x + 1.4, y + 4.2)
      x += TABLE_COLS[index]?.width ?? 0
    })
  }

  private drawFooters(pdf: jsPDF, report: PersonalExportReport): void {
    const pageCount = pdf.getNumberOfPages()
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page)
      pdf.setDrawColor(...LINE)
      pdf.line(MARGIN, FOOTER_Y - 4, PAGE_WIDTH - MARGIN, FOOTER_Y - 4)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(...MUTED)
      pdf.text(
        `Consorcio Selva MDD · personal ${report.dateKey}`,
        MARGIN,
        FOOTER_Y,
      )
      pdf.text(`${page} / ${pageCount}`, PAGE_WIDTH - MARGIN, FOOTER_Y, {
        align: 'right',
      })
    }
  }
}
