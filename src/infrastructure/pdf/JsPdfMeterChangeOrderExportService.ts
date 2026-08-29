import { jsPDF } from 'jspdf'
import type { MeterChangeOrder } from '@/domain/entities/MeterChangeOrder'
import {
  formatMeterChangeDate,
  meterChangeDoneFlag,
  meterChangeDoneFlagLabel,
  meterChangeExportFileName,
  meterChangeOrderStatusLabel,
  meterChangeSystemLabel,
} from '@/domain/entities/MeterChangeOrder'
import type {
  MeterChangeOrderExportFile,
  MeterChangeOrderExportReport,
  MeterChangeOrderPdfExportService,
} from '@/domain/repositories/MeterChangeOrderExportService'

const BRAND_BLUE: [number, number, number] = [79, 129, 189]
const HEADER_FILL: [number, number, number] = [79, 129, 189]
const ROW_ALT: [number, number, number] = [232, 240, 254]
const LINE: [number, number, number] = [180, 198, 231]
const RED: [number, number, number] = [198, 40, 40]
const GREEN: [number, number, number] = [46, 125, 50]
const BLUE: [number, number, number] = [21, 101, 192]
const AMBER: [number, number, number] = [180, 120, 20]
const MUTED: [number, number, number] = [90, 98, 112]

const MARGIN = 8
const PAGE_WIDTH = 297
const PAGE_HEIGHT = 210
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const COLS = [
  { key: 'orderNumber', label: 'NRO OT', width: 28 },
  { key: 'estado', label: 'ESTADO', width: 18 },
  { key: 'customerName', label: 'CLIENTE', width: 34 },
  { key: 'supplyCode', label: 'SUMINISTRO', width: 22 },
  { key: 'meterSerial', label: 'SERIE', width: 20 },
  { key: 'systemType', label: 'SISTEMA', width: 28 },
  { key: 'status', label: 'ASIGNACIÓN', width: 24 },
  { key: 'scheduledDate', label: 'FECHA PROG.', width: 20 },
  { key: 'technicianName', label: 'TÉCNICO', width: 34 },
  { key: 'pedido', label: 'PEDIDO', width: 33 },
] as const

type ColKey = (typeof COLS)[number]['key']

function cellValue(order: MeterChangeOrder, key: ColKey): string {
  switch (key) {
    case 'orderNumber':
      return order.orderNumber
    case 'estado':
      return meterChangeDoneFlagLabel(meterChangeDoneFlag(order.changeDoneFlag))
    case 'customerName':
      return order.customerName
    case 'supplyCode':
      return order.supplyCode
    case 'meterSerial':
      return order.meterSerial
    case 'systemType':
      return meterChangeSystemLabel(order.systemType)
    case 'status':
      return meterChangeOrderStatusLabel(order.status)
    case 'scheduledDate':
      return formatMeterChangeDate(order.scheduledDate)
    case 'technicianName':
      return order.technicianName
    case 'pedido':
      return order.pedido
  }
}

export class JsPdfMeterChangeOrderExportService
  implements MeterChangeOrderPdfExportService
{
  createDocument(
    report: MeterChangeOrderExportReport,
  ): MeterChangeOrderExportFile {
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
        `${report.generatedByName || 'Admin'}  ·  Consorcio Selva MDD  ·  ${page + 1}/${pages}`,
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
      fileName: meterChangeExportFileName({
        technicianName: report.technicianName,
        reportCode: report.reportCode,
        date: report.date,
        count: report.orders.length,
        extension: 'pdf',
      }),
    }
  }

  private drawHeader(pdf: jsPDF, report: MeterChangeOrderExportReport): void {
    pdf.setFillColor(...BRAND_BLUE)
    pdf.rect(0, 0, PAGE_WIDTH, 22, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.text('Consorcio Selva MDD', MARGIN, 8)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(report.areaName || 'Cambio de medidor', MARGIN, 14)
    const dateLabel = report.date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(
      `${report.technicianName || 'TODOS'}  ·  ${report.reportCode || 'CM'}  ·  ${dateLabel}  ·  ${report.orders.length}`,
      PAGE_WIDTH - MARGIN,
      12,
      { align: 'right' },
    )
  }

  private drawTable(
    pdf: jsPDF,
    rows: MeterChangeOrder[],
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
        if (col.key === 'estado') {
          const done = meterChangeDoneFlag(order.changeDoneFlag)
          pdf.setTextColor(
            ...(done === 'SI' ? GREEN : done === 'NO' ? RED : AMBER),
          )
          pdf.setFont('helvetica', 'bold')
        } else if (col.key === 'status') {
          pdf.setTextColor(...(order.status === 'PROGRAMADO' ? GREEN : MUTED))
          pdf.setFont('helvetica', 'bold')
        } else if (col.key === 'scheduledDate') {
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
