import * as XLSX from 'xlsx'
import type { MeterChangeOrderDraft } from '@/domain/entities/MeterChangeOrder'
import {
  emptyMeterChangeOrderDraft,
  meterChangeDoneFlag,
  meterChangeSystemFromValue,
  parseMeterChangeLocation,
} from '@/domain/entities/MeterChangeOrder'
import { ValidationError } from '@/domain/errors/DomainError'

function cellText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  return String(value).trim().replace(/\s+/g, ' ')
}

function cellDigits(value: unknown): string {
  return cellText(value).replace(/\D/g, '')
}

function headerKey(value: unknown): string {
  return cellText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function findColumn(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const index = headers.findIndex((header) => header === alias)
    if (index >= 0) return index
  }
  for (const alias of aliases) {
    const index = headers.findIndex((header) => header.includes(alias))
    if (index >= 0) return index
  }
  return -1
}

function excelSerialToDate(value: number): Date | null {
  if (!Number.isFinite(value)) return null
  const utc = Math.round((value - 25569) * 86400 * 1000)
  const date = new Date(utc)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') return excelSerialToDate(value)
  const text = cellText(value)
  if (!text) return null
  const match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    let year = Number(match[3])
    if (year < 100) year += 2000
    const date = new Date(year, month - 1, day)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeMeterSerial(value: unknown): string {
  return cellText(value)
    .replace(/^STAR-->/i, '')
    .replace(/^-->/g, '')
    .trim()
}

export function parseMeterChangeOrdersExcel(buffer: ArrayBuffer): {
  rows: MeterChangeOrderDraft[]
  skipped: number
} {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  if (workbook.SheetNames.length === 0) {
    throw new ValidationError('El Excel no tiene hojas')
  }

  let headerIndex = -1
  let matrix: unknown[][] = []
  let columns = {
    orderNumber: -1,
    pedido: -1,
    technicianName: -1,
    scheduledDate: -1,
    customerName: -1,
    address: -1,
    supplyCode: -1,
    routeCode: -1,
    meterSerial: -1,
    typeCode: -1,
    systemType: -1,
    changeDoneYes: -1,
    changeDoneNo: -1,
    changeDoneEstado: -1,
    observations: -1,
    location: -1,
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const candidate = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      sheet,
      { header: 1, defval: '', raw: true },
    ) as unknown[][]

    for (let index = 0; index < Math.min(candidate.length, 30); index += 1) {
      const headers = (candidate[index] ?? []).map(headerKey)
      const orderNumber = findColumn(headers, ['OT', 'NRO OT', 'NUMERO OT'])
      if (orderNumber < 0) continue
      headerIndex = index
      matrix = candidate
      columns = {
        orderNumber,
        pedido: findColumn(headers, ['PEDIDO']),
        technicianName: findColumn(headers, ['TECNICO', 'TECNICO1']),
        scheduledDate: findColumn(headers, [
          'SE PROGRAMA PARA EL DIA',
          'FECHA PROG',
          'FECHA PROGRAMADA',
        ]),
        customerName: findColumn(headers, ['NOMBRE', 'CLIENTE', 'SOLICITANTE']),
        address: findColumn(headers, ['DIRECCION', 'DIRECCIÓN']),
        supplyCode: findColumn(headers, ['SUMINISTRO']),
        routeCode: findColumn(headers, ['COD RUTA', 'CODIGO RUTA', 'RUTA']),
        meterSerial: findColumn(headers, [
          'SERIE DE MEDIDOR',
          'SERIE MEDIDOR',
          'MEDIDOR',
        ]),
        typeCode: findColumn(headers, ['TIPO']),
        systemType: findColumn(headers, ['SISTEMA']),
        changeDoneYes: findColumn(headers, ['SI']),
        changeDoneNo: findColumn(headers, ['NO']),
        changeDoneEstado: findColumn(headers, ['ESTADO', 'CAMBIO']),
        observations: findColumn(headers, ['OBSERVACIONES', 'OBS']),
        location: findColumn(headers, ['UBICACION', 'UBICACIÓN', 'GPS']),
      }
      break
    }
    if (headerIndex >= 0) break
  }

  if (headerIndex < 0) {
    throw new ValidationError(
      'No se encontró la fila de encabezados (OT, PEDIDO, SUMINISTRO…). Usa la plantilla LISTA_CM.',
    )
  }

  const rows: MeterChangeOrderDraft[] = []
  let skipped = 0

  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const line = matrix[index] ?? []
    const orderNumber = cellDigits(line[columns.orderNumber])
    if (!orderNumber) {
      skipped += 1
      continue
    }

    const yesRaw =
      columns.changeDoneYes >= 0 ? cellText(line[columns.changeDoneYes]) : ''
    const noRaw =
      columns.changeDoneNo >= 0 ? cellText(line[columns.changeDoneNo]) : ''
    const estadoRaw =
      columns.changeDoneEstado >= 0
        ? cellText(line[columns.changeDoneEstado])
        : ''
    let changeDoneFlag = meterChangeDoneFlag('')
    if (estadoRaw) changeDoneFlag = meterChangeDoneFlag(estadoRaw)
    else if (yesRaw && meterChangeDoneFlag(yesRaw) === 'SI') changeDoneFlag = 'SI'
    else if (noRaw) changeDoneFlag = 'NO'
    else changeDoneFlag = 'PENDIENTE'

    const location = parseMeterChangeLocation(
      columns.location >= 0 ? cellText(line[columns.location]) : '',
    )

    rows.push({
      ...emptyMeterChangeOrderDraft(),
      orderNumber,
      pedido: columns.pedido >= 0 ? cellText(line[columns.pedido]) : '',
      technicianName:
        columns.technicianName >= 0
          ? cellText(line[columns.technicianName])
          : '',
      scheduledDate:
        columns.scheduledDate >= 0
          ? parseDate(line[columns.scheduledDate])
          : null,
      customerName:
        columns.customerName >= 0 ? cellText(line[columns.customerName]) : '',
      address: columns.address >= 0 ? cellText(line[columns.address]) : '',
      supplyCode:
        columns.supplyCode >= 0 ? cellDigits(line[columns.supplyCode]) : '',
      routeCode:
        columns.routeCode >= 0 ? cellDigits(line[columns.routeCode]) : '',
      meterSerial:
        columns.meterSerial >= 0
          ? normalizeMeterSerial(line[columns.meterSerial])
          : '',
      typeCode:
        columns.typeCode >= 0
          ? cellText(line[columns.typeCode]).toUpperCase() || 'CM'
          : 'CM',
      systemType: meterChangeSystemFromValue(
        columns.systemType >= 0 ? cellText(line[columns.systemType]) : 'C1',
      ),
      changeDoneFlag,
      observations:
        columns.observations >= 0 ? cellText(line[columns.observations]) : '',
      latitude: location.latitude,
      longitude: location.longitude,
    })
  }

  if (rows.length === 0) {
    throw new ValidationError('El archivo no tiene órdenes con número de OT')
  }

  return { rows, skipped }
}

export const METER_CHANGE_IMPORT_HEADERS = [
  'OT',
  'PEDIDO',
  'TECNICO',
  'SE PROGRAMA PARA EL DIA:',
  'NOMBRE',
  'DIRECCION',
  'SUMINISTRO',
  'COD RUTA',
  'SERIE DE MEDIDOR',
  'TIPO',
  'SISTEMA',
  'SI',
  'NO',
  'OBSERVACIONES',
  'UBICACION',
] as const
