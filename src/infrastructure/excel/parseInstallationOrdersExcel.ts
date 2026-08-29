import * as XLSX from 'xlsx'
import type { InstallationOrderDraft } from '@/domain/entities/InstallationOrder'
import {
  emptyInstallationOrderDraft,
  installationRegisteredFlag,
} from '@/domain/entities/InstallationOrder'
import { ValidationError } from '@/domain/errors/DomainError'

export interface ParseInstallationOrdersResult {
  rows: InstallationOrderDraft[]
  skipped: number
}

function headerKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function cellText(value: unknown): string {
  if (value == null || value === '') return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString('es-PE')
  }
  return String(value).trim().replace(/\s+/g, ' ')
}

function cellDigits(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  return cellText(value).replace(/\D/g, '')
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H ?? 0, parsed.M ?? 0, parsed.S ?? 0)
  }
  const text = cellText(value)
  const iso = Date.parse(text)
  if (!Number.isNaN(iso)) return new Date(iso)
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  let year = Number(match[3])
  if (year < 100) year += 2000
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)
  const date = new Date(year, month - 1, day, hour, minute, second)
  return Number.isNaN(date.getTime()) ? null : date
}

function findColumn(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const exact = headers.findIndex((header) => header === alias)
    if (exact >= 0) return exact
  }
  for (const alias of aliases) {
    const partial = headers.findIndex((header) => header.includes(alias))
    if (partial >= 0) return partial
  }
  return -1
}

export function parseInstallationOrdersExcel(
  buffer: ArrayBuffer,
): ParseInstallationOrdersResult {
  const book = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = book.SheetNames[0]
  if (!sheetName) {
    throw new ValidationError('El archivo Excel está vacío')
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    book.Sheets[sheetName],
    { header: 1, defval: null, raw: true },
  )

  let headerIndex = -1
  let columns = {
    orderNumber: -1,
    subType: -1,
    applicantName: -1,
    applicantAddress: -1,
    sectorCijp: -1,
    sector: -1,
    supplyCode: -1,
    neighborRouteCode: -1,
    attentionCenter: -1,
    executionNotes: -1,
    registeredFlag: -1,
    categoryCode: -1,
    referenceNumber: -1,
    recordedAt: -1,
    typeInitials: -1,
    classification: -1,
    technicianName: -1,
    scheduledDate: -1,
  }

  for (let index = 0; index < Math.min(matrix.length, 16); index += 1) {
    const headers = (matrix[index] ?? []).map(headerKey)
    const orderNumber = findColumn(headers, [
      'NRO OT',
      'NUMERO OT',
      'NÚMERO OT',
      'OT',
      'ORDEN',
    ])
    if (orderNumber < 0) continue
    headerIndex = index
    columns = {
      orderNumber,
      subType: findColumn(headers, ['SUB TIPO', 'SUBTIPO']),
      applicantName: findColumn(headers, ['SOLICITANTE', 'CLIENTE']),
      applicantAddress: findColumn(headers, [
        'DIRECCION SOLICITANTE',
        'DIRECCION',
        'DIRECCIÓN',
      ]),
      sectorCijp: findColumn(headers, ['SECTOR CIJP']),
      sector: findColumn(headers, ['SECTOR']),
      supplyCode: findColumn(headers, ['SUMINISTRO']),
      neighborRouteCode: findColumn(headers, [
        'COD RUTA VECINO',
        'RUTA VECINO',
        'RUTA VECINAL',
      ]),
      attentionCenter: findColumn(headers, ['CENTRO ATENCION', 'CENTRO_ATENCION']),
      executionNotes: findColumn(headers, ['OBS DE EJEC', 'OBSERVACION', 'OBS']),
      registeredFlag: findColumn(headers, ['SI/NO', 'REGISTRADO']),
      categoryCode: findColumn(headers, ['CATEGORIA', 'CATEGORÍA']),
      referenceNumber: findColumn(headers, ['REFERENCIA']),
      recordedAt: findColumn(headers, ['FECHA REGISTRO', 'FECHA HORA']),
      typeInitials: findColumn(headers, ['TIPO']),
      classification: findColumn(headers, ['CLASIFICACION', 'CLASIFICACIÓN']),
      technicianName: findColumn(headers, ['TECNICO1', 'TECNICO', 'TÉCNICO']),
      scheduledDate: findColumn(headers, [
        'FECHA PROG',
        'FECHA PROGRAMADA',
        'FECHA PROG CIJP',
      ]),
    }
    break
  }

  if (headerIndex < 0) {
    throw new ValidationError(
      'No se encontró la columna de número de OT. Usa la plantilla de importación.',
    )
  }

  const rows: InstallationOrderDraft[] = []
  let skipped = 0

  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const line = matrix[index] ?? []
    const orderNumber = cellDigits(line[columns.orderNumber])
    if (!orderNumber) {
      skipped += 1
      continue
    }

    const sectorCijp = columns.sectorCijp >= 0 ? cellText(line[columns.sectorCijp]) : ''
    const sector = columns.sector >= 0 ? cellText(line[columns.sector]) : sectorCijp

    rows.push({
      ...emptyInstallationOrderDraft(),
      orderNumber,
      subType:
        columns.subType >= 0
          ? cellText(line[columns.subType])
          : 'INSTALACION NUEVA C1',
      applicantName:
        columns.applicantName >= 0 ? cellText(line[columns.applicantName]) : '',
      applicantAddress:
        columns.applicantAddress >= 0
          ? cellText(line[columns.applicantAddress])
          : '',
      sectorCijp,
      sector,
      supplyCode: columns.supplyCode >= 0 ? cellDigits(line[columns.supplyCode]) : '',
      neighborRouteCode:
        columns.neighborRouteCode >= 0
          ? cellDigits(line[columns.neighborRouteCode])
          : '',
      attentionCenter:
        columns.attentionCenter >= 0
          ? cellText(line[columns.attentionCenter])
          : sectorCijp,
      executionNotes:
        columns.executionNotes >= 0 ? cellText(line[columns.executionNotes]) : '',
      registeredFlag:
        columns.registeredFlag >= 0
          ? installationRegisteredFlag(cellText(line[columns.registeredFlag]))
          : 'NO',
      categoryCode:
        columns.categoryCode >= 0 ? cellText(line[columns.categoryCode]) : '',
      referenceNumber:
        columns.referenceNumber >= 0
          ? cellDigits(line[columns.referenceNumber])
          : '',
      recordedAt: columns.recordedAt >= 0 ? parseDate(line[columns.recordedAt]) : null,
      typeInitials:
        columns.typeInitials >= 0 ? cellText(line[columns.typeInitials]) : '',
      classification:
        columns.classification >= 0 ? cellText(line[columns.classification]) : 'F',
      technicianName:
        columns.technicianName >= 0 ? cellText(line[columns.technicianName]) : '',
      scheduledDate:
        columns.scheduledDate >= 0 ? parseDate(line[columns.scheduledDate]) : null,
    })
  }

  if (rows.length === 0) {
    throw new ValidationError('El archivo no tiene órdenes con número de OT')
  }

  return { rows, skipped }
}

export const INSTALLATION_IMPORT_HEADERS = [
  'NRO OT',
  'SUB TIPO',
  'SOLICITANTE',
  'DIRECCION SOLICITANTE',
  'SECTOR CIJP',
  'SECTOR',
  'SUMINISTRO',
  'COD RUTA VECINO CIJP',
  'CENTRO ATENCION',
  'SI/NO',
  'CATEGORIA',
  'REFERENCIA',
  'FECHA REGISTRO',
  'TIPO',
  'CLASIFICACION',
  'OBS DE EJEC',
  'TECNICO1 CIJP',
  'FECHA PROG CIJP',
] as const
