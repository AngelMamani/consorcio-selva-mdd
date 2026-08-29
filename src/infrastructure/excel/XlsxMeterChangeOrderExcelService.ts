import * as XLSX from 'xlsx'
import type { MeterChangeOrder } from '@/domain/entities/MeterChangeOrder'
import {
  formatMeterChangeDate,
  formatMeterChangeLocation,
  meterChangeDoneFlag,
  meterChangeDoneFlagLabel,
  meterChangeOrderStatusLabel,
  meterChangeSystemLabel,
} from '@/domain/entities/MeterChangeOrder'
import type {
  MeterChangeOrderExcelExportService,
  MeterChangeOrderExportFile,
  MeterChangeOrderExportReport,
} from '@/domain/repositories/MeterChangeOrderExportService'
import { METER_CHANGE_IMPORT_HEADERS } from '@/infrastructure/excel/parseMeterChangeOrdersExcel'

const EXCEL_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const LIST_HEADERS = [
  'N°',
  'OT',
  'PEDIDO',
  'TECNICO',
  'FECHA PROGRAMADA',
  'NOMBRE',
  'DIRECCION',
  'SUMINISTRO',
  'COD RUTA',
  'SERIE DE MEDIDOR',
  'TIPO',
  'SISTEMA',
  'ESTADO',
  'SI',
  'NO',
  'ASIGNACION',
  'OBSERVACIONES',
  'UBICACION',
  'MAPA',
] as const

const COLUMN_WIDTHS = [
  5, 20, 36, 28, 14, 28, 34, 14, 16, 14, 6, 18, 12, 5, 5, 14, 28, 28, 14,
]

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatExportDateTime(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function formatFileDate(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-ÁÉÍÓÚÑáéíóúñ]/gi, '')
    .slice(0, 40)
}

function mapsUrl(latitude: number | null, longitude: number | null): string {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return ''
  }
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

function setColumnWidths(sheet: XLSX.WorkSheet, widths: number[]): void {
  sheet['!cols'] = widths.map((width) => ({ wch: width }))
}

function applyListLayout(
  sheet: XLSX.WorkSheet,
  headerRowIndex: number,
  rowCount: number,
  colCount: number,
  widths: number[],
): void {
  const lastRow = headerRowIndex + Math.max(rowCount, 1)
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex - 1, c: 0 },
      e: { r: lastRow - 1, c: colCount - 1 },
    }),
  }
  sheet['!views'] = [{ state: 'frozen', ySplit: headerRowIndex }]
  setColumnWidths(sheet, widths)
}

function orderToListRow(
  order: MeterChangeOrder,
  index: number,
): (string | number)[] {
  const done = meterChangeDoneFlag(order.changeDoneFlag)
  return [
    index + 1,
    order.orderNumber,
    order.pedido,
    order.technicianName,
    formatMeterChangeDate(order.scheduledDate),
    order.customerName,
    order.address,
    order.supplyCode,
    order.routeCode,
    order.meterSerial,
    order.typeCode || 'CM',
    meterChangeSystemLabel(order.systemType),
    meterChangeDoneFlagLabel(done),
    done === 'SI' ? 'SI' : '',
    done === 'NO' ? 'NO' : '',
    meterChangeOrderStatusLabel(order.status),
    order.observations,
    formatMeterChangeLocation(order.latitude, order.longitude),
    mapsUrl(order.latitude, order.longitude) ? 'Abrir mapa' : '',
  ]
}

function orderToImportRow(order: MeterChangeOrder): (string | number)[] {
  const done = meterChangeDoneFlag(order.changeDoneFlag)
  return [
    order.orderNumber,
    order.pedido,
    order.technicianName,
    formatMeterChangeDate(order.scheduledDate),
    order.customerName,
    order.address,
    order.supplyCode,
    order.routeCode,
    order.meterSerial,
    order.typeCode || 'CM',
    order.systemType,
    done === 'SI' ? 'SI' : '',
    done === 'NO' ? 'NO' : '',
    order.observations,
    formatMeterChangeLocation(order.latitude, order.longitude),
  ]
}

function addMapLinks(
  sheet: XLSX.WorkSheet,
  headerRowIndex: number,
  orders: MeterChangeOrder[],
): void {
  const mapCol = LIST_HEADERS.indexOf('MAPA')
  if (mapCol < 0) return
  orders.forEach((order, index) => {
    const url = mapsUrl(order.latitude, order.longitude)
    if (!url) return
    const cellRef = XLSX.utils.encode_cell({
      r: headerRowIndex + index,
      c: mapCol,
    })
    sheet[cellRef] = {
      t: 's',
      v: 'Abrir mapa',
      l: { Target: url, Tooltip: 'Ver ubicación en Google Maps' },
    }
  })
}

function createSummarySheet(report: MeterChangeOrderExportReport): XLSX.WorkSheet {
  const orders = report.orders
  const programmed = orders.filter((item) => item.status === 'PROGRAMADO')
  const pending = orders.filter(
    (item) => meterChangeDoneFlag(item.changeDoneFlag) === 'PENDIENTE',
  )
  const doneYes = orders.filter(
    (item) => meterChangeDoneFlag(item.changeDoneFlag) === 'SI',
  )
  const doneNo = orders.filter(
    (item) => meterChangeDoneFlag(item.changeDoneFlag) === 'NO',
  )
  const withGps = orders.filter(
    (item) =>
      typeof item.latitude === 'number' && typeof item.longitude === 'number',
  )

  const byTechnician = new Map<string, number>()
  for (const order of orders) {
    const key = order.technicianName.trim() || 'SIN ASIGNAR'
    byTechnician.set(key, (byTechnician.get(key) ?? 0) + 1)
  }
  const technicianRows = [...byTechnician.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([name, count]) => [name, count] as (string | number)[])

  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    ['Cambio de medidor — reporte de pedidos'],
    [],
    ['Actividad', report.areaName || '—'],
    ['Código', report.reportCode || 'CM'],
    ['Técnico / filtro', report.technicianName || 'TODOS'],
    ['Generado', formatExportDateTime(report.date)],
    ['Órdenes en el archivo', orders.length],
    [],
    ['Resumen de estado'],
    ['Total OTs', orders.length],
    ['Programadas', programmed.length],
    ['Sin registrar', orders.length - programmed.length],
    ['Pendiente (cambio)', pending.length],
    ['Cambio SI', doneYes.length],
    ['Cambio NO', doneNo.length],
    ['Con ubicación GPS', withGps.length],
    [],
    ['Por técnico'],
    ['Técnico', 'OTs'],
    ...technicianRows,
    [],
    ['Hojas del archivo'],
    ['01 Resumen', 'Indicadores y conteo por técnico'],
    ['02 Pedidos', 'Listado profesional con filtros y mapa'],
    ['03 LISTA_CM', 'Formato compatible para reimportar'],
  ]

  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  setColumnWidths(sheet, [28, 48])
  return sheet
}

function createPedidosSheet(report: MeterChangeOrderExportReport): XLSX.WorkSheet {
  const headerRowIndex = 6
  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    ['LISTA DE CAMBIOS DE MEDIDORES'],
    [`Actividad: ${report.areaName || '—'} · Código: ${report.reportCode || 'CM'}`],
    [`Técnico: ${report.technicianName || 'TODOS'} · Generado: ${formatExportDateTime(report.date)}`],
    [`Total OTs: ${report.orders.length}`],
    [],
    [...LIST_HEADERS],
    ...report.orders.map((order, index) => orderToListRow(order, index)),
  ]

  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  applyListLayout(
    sheet,
    headerRowIndex,
    report.orders.length,
    LIST_HEADERS.length,
    COLUMN_WIDTHS,
  )
  addMapLinks(sheet, headerRowIndex, report.orders)

  if (!sheet['!merges']) sheet['!merges'] = []
  sheet['!merges'].push(
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
  )

  return sheet
}

function createImportCompatibleSheet(
  report: MeterChangeOrderExportReport,
): XLSX.WorkSheet {
  const headerRowIndex = 3
  const matrix: (string | number)[][] = [
    ['LISTA DE CAMBIOS DE MEDIDORES'],
    ['Hoja compatible con Importar LISTA_CM'],
    [],
    [...METER_CHANGE_IMPORT_HEADERS],
    ...report.orders.map(orderToImportRow),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  applyListLayout(sheet, headerRowIndex, report.orders.length, 15, [
    20, 36, 28, 14, 28, 32, 14, 16, 16, 6, 8, 5, 5, 24, 28,
  ])
  return sheet
}

function createImportTemplateSheet(): XLSX.WorkSheet {
  const example: (string | number)[] = [
    '2025200002000258604',
    'TECNICO_CM_22-11-2025',
    'NOMBRE DEL TECNICO',
    '22/11/2025',
    'MENESES AGUILAR CRISTIAN',
    'CALLE AUGUSTO JIMENEZ 12N-07',
    '12000033096',
    '2001110003150',
    '2015022309',
    'CM',
    'C1',
    '',
    '',
    '',
    '-12.596174, -69.200404',
  ]
  const headerRowIndex = 5
  const matrix: (string | number)[][] = [
    ['Consorcio Selva MDD'],
    ['Plantilla — Cambio de medidor (LISTA_CM)'],
    ['Completa una fila por OT. Deja SI y NO vacíos para dejar el estado en PENDIENTE.'],
    ['Pedido: se puede recalcular al importar (técnico + CM + fecha).'],
    [],
    [...METER_CHANGE_IMPORT_HEADERS],
    example,
  ]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  applyListLayout(sheet, headerRowIndex, 1, 15, [
    20, 36, 28, 14, 28, 32, 14, 16, 16, 6, 8, 5, 5, 24, 28,
  ])
  if (!sheet['!merges']) sheet['!merges'] = []
  sheet['!merges'].push(
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
  )
  return sheet
}

export class XlsxMeterChangeOrderExcelService
  implements MeterChangeOrderExcelExportService
{
  createWorkbook(
    report: MeterChangeOrderExportReport,
  ): MeterChangeOrderExportFile {
    const book = XLSX.utils.book_new()
    book.Props = {
      Title: `Cambio de medidor ${report.reportCode || 'CM'}`,
      Author: 'Consorcio Selva MDD',
      Subject: report.areaName || 'Cambio de medidor',
      CreatedDate: report.date,
    }

    XLSX.utils.book_append_sheet(book, createSummarySheet(report), '01 Resumen')
    XLSX.utils.book_append_sheet(book, createPedidosSheet(report), '02 Pedidos')
    XLSX.utils.book_append_sheet(
      book,
      createImportCompatibleSheet(report),
      '03 LISTA_CM',
    )

    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
    const tech = sanitizeFilePart(report.technicianName || 'TODOS') || 'TODOS'
    const code = sanitizeFilePart(report.reportCode || 'CM') || 'CM'
    return {
      blob: new Blob([buffer], { type: EXCEL_TYPE }),
      fileName: `CM_${code}_${tech}_${formatFileDate(report.date)}.xlsx`,
    }
  }

  createImportTemplate(): MeterChangeOrderExportFile {
    const book = XLSX.utils.book_new()
    book.Props = {
      Title: 'Plantilla cambio de medidor',
      Author: 'Consorcio Selva MDD',
      Subject: 'LISTA_CM',
    }
    XLSX.utils.book_append_sheet(book, createImportTemplateSheet(), 'LISTA_CM')
    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
    return {
      blob: new Blob([buffer], { type: EXCEL_TYPE }),
      fileName: 'plantilla-cambio-de-medidor.xlsx',
    }
  }
}
