import { jsPDF } from 'jspdf'
import type { InstallationOrder } from '@/domain/entities/InstallationOrder'
import {
  formatInstallationDate,
  formatInstallationDateTime,
  installationExportFileName,
  installationOrderStatusLabel,
  installationRegisteredFlag,
} from '@/domain/entities/InstallationOrder'
import type {
  InstallationOrderExportFile,
  InstallationOrderExportReport,
  InstallationOrderPdfExportService,
} from '@/domain/repositories/InstallationOrderExportService'

const BRAND_BLUE: [number, number, number] = [79, 129, 189]
const HEADER_FILL: [number, number, number] = [79, 129, 189]
const ROW_ALT: [number, number, number] = [232, 240, 254]
const LINE: [number, number, number] = [180, 198, 231]
const RED: [number, number, number] = [198, 40, 40]
const GREEN: [number, number, number] = [46, 125, 50]
const BLUE: [number, number, number] = [21, 101, 192]
const MUTED: [number, number, number] = [90, 98, 112]

const MARGIN = 8
const PAGE_WIDTH = 297
const PAGE_HEIGHT = 210
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const COLS = [
  { key: 'orderNumber', label: 'NRO OT', width: 32 },
  { key: 'registeredFlag', label: 'SI/NO', width: 12 },
  { key: 'categoryCode', label: 'CAT.', width: 12 },
  { key: 'referenceNumber', label: 'REFERENCIA', width: 24 },
  { key: 'recordedAt', label: 'FECHA REGISTRO', width: 26 },
  { key: 'typeInitials', label: 'TIPO', width: 10 },
  { key: 'classification', label: 'CL.', width: 8 },
  { key: 'applicantName', label: 'SOLICITANTE', width: 38 },
  { key: 'applicantAddress', label: 'DIRECCIÓN', width: 40 },
  { key: 'status', label: 'ESTADO', width: 26 },
  { key: 'scheduledDate', label: 'FECHA PROG.', width: 20 },
  { key: 'technicianName', label: 'TÉCNICO', width: 33 },
] as const

type ColKey = (typeof COLS)[number]['key']

function cellValue(order: InstallationOrder, key: ColKey): string {
  switch (key) {
    case 'orderNumber':
      return order.orderNumber
    case 'registeredFlag':
      return installationRegisteredFlag(order.registeredFlag)
    case 'categoryCode':
      return order.categoryCode
    case 'referenceNumber':
      return order.referenceNumber || order.neighborRouteCode
    case 'recordedAt':
      return formatInstallationDateTime(order.recordedAt)
    case 'typeInitials':
      return order.typeInitials
    case 'classification':
      return order.classification
    case 'applicantName':
      return order.applicantName
    case 'applicantAddress':
      return order.applicantAddress
    case 'status':
      return installationOrderStatusLabel(order.status)
    case 'scheduledDate':
      return formatInstallationDate(order.scheduledDate)
    case 'technicianName':
      return order.technicianName
  }
}

export class JsPdfInstallationOrderExportService
  implements InstallationOrderPdfExportService
{
  createDocument(
    report: InstallationOrderExportReport,
  ): InstallationOrderExportFile {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const headerHeight = 22
    const rowHeight = 6.2
    const tableTop = headerHeight + 4
    const footerY = PAGE_HEIGHT - 8
    const rowsPerPage = Math.floor((footerY - tableTop - 8) / rowHeight)
    const pages = Math.max(1, Math.ceil(report.orders.length / rowsPerPage))

    for (let page = 0; page < pages; page += 1) {
      if (page > 0) pdf.addPage()
      this.drawHeader(pdf, report)
      const start = page * rowsPerPage
      const slice = report.orders.slice(start, start + rowsPerPage)
      this.drawTable(pdf, slice, tableTop, rowHeight)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(...MUTED)
      pdf.text(
        `${report.generatedByName}  ·  Consorcio Selva MDD  ·  ${page + 1}/${pages}`,
        MARGIN,
        footerY,
      )
      pdf.text(
        `${report.orders.length} órdenes`,
        PAGE_WIDTH - MARGIN,
        footerY,
        { align: 'right' },
      )
    }

    return {
      blob: pdf.output('blob'),
      fileName: installationExportFileName({
        technicianName: report.technicianName,
        reportCode: report.reportCode,
        date: report.date,
        count: report.orders.length,
      }),
    }
  }

  private drawHeader(pdf: jsPDF, report: InstallationOrderExportReport): void {
    pdf.setFillColor(...BRAND_BLUE)
    pdf.rect(0, 0, PAGE_WIDTH, 22, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.text('Consorcio Selva MDD', MARGIN, 8)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(report.areaName || 'Instalaciones nuevas', MARGIN, 14)
    const dateLabel = report.date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(
      `${report.technicianName || 'TODOS'}  ·  ${report.reportCode}  ·  ${dateLabel}  ·  ${report.orders.length}`,
      PAGE_WIDTH - MARGIN,
      12,
      { align: 'right' },
    )
  }

  private drawTable(
    pdf: jsPDF,
    rows: InstallationOrder[],
    tableTop: number,
    rowHeight: number,
  ): void {
    let x = MARGIN
    pdf.setFillColor(...HEADER_FILL)
    pdf.rect(MARGIN, tableTop, CONTENT_WIDTH, 7, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.2)
    for (const col of COLS) {
      pdf.text(col.label, x + 0.8, tableTop + 4.6)
      x += col.width
    }

    rows.forEach((order, index) => {
      const y = tableTop + 7 + index * rowHeight
      if (index % 2 === 1) {
        pdf.setFillColor(...ROW_ALT)
        pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F')
      }
      pdf.setDrawColor(...LINE)
      pdf.setLineWidth(0.12)
      pdf.line(MARGIN, y + rowHeight, MARGIN + CONTENT_WIDTH, y + rowHeight)

      let cellX = MARGIN
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6)
      for (const col of COLS) {
        const raw = cellValue(order, col.key)
        const text = pdf.splitTextToSize(raw, col.width - 1.4)[0] ?? ''
        if (col.key === 'status') {
          pdf.setTextColor(...(order.status === 'PROGRAMADO' ? GREEN : MUTED))
          pdf.setFont('helvetica', 'bold')
        } else if (col.key === 'scheduledDate' || col.key === 'recordedAt') {
          pdf.setTextColor(...RED)
          pdf.setFont('helvetica', 'normal')
        } else if (col.key === 'technicianName') {
          pdf.setTextColor(...BLUE)
          pdf.setFont('helvetica', 'bold')
        } else if (col.key === 'orderNumber') {
          pdf.setTextColor(20, 24, 32)
          pdf.setFont('helvetica', 'bold')
        } else {
          pdf.setTextColor(30, 35, 45)
          pdf.setFont('helvetica', 'normal')
        }
        pdf.text(text, cellX + 0.8, y + 4.1)
        cellX += col.width
      }
    })
  }
}
