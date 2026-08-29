import {
  InstallationMeterType,
  INSTALLATION_METER_TYPE_OPTIONS,
  installationMeterTypeFromSubType,
  type InstallationMeterType as MeterSystemType,
} from '@/domain/entities/InstallationOrder'

export const MeterChangeOrderStatus = {
  Programado: 'PROGRAMADO',
  NoRegistrado: 'NO_REGISTRADO',
} as const

export type MeterChangeOrderStatus =
  (typeof MeterChangeOrderStatus)[keyof typeof MeterChangeOrderStatus]

export interface MeterChangeOrder {
  id: string
  areaId: string
  areaName: string
  orderNumber: string
  pedido: string
  customerName: string
  address: string
  supplyCode: string
  routeCode: string
  meterSerial: string
  typeCode: string
  systemType: string
  changeDoneFlag: string
  observations: string
  latitude: number | null
  longitude: number | null
  technicianId: string
  technicianName: string
  scheduledDate: Date | null
  status: MeterChangeOrderStatus
  createdById: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

export interface MeterChangeOrderDraft {
  orderNumber: string
  pedido: string
  customerName: string
  address: string
  supplyCode: string
  routeCode: string
  meterSerial: string
  typeCode: string
  systemType: string
  changeDoneFlag: string
  observations: string
  latitude: number | null
  longitude: number | null
  technicianId: string
  technicianName: string
  scheduledDate: Date | null
}

export function meterChangeOrderStatus(
  technicianId: string,
): MeterChangeOrderStatus {
  return technicianId.trim()
    ? MeterChangeOrderStatus.Programado
    : MeterChangeOrderStatus.NoRegistrado
}

export function meterChangeOrderStatusLabel(status: MeterChangeOrderStatus): string {
  return status === MeterChangeOrderStatus.Programado
    ? 'PROGRAMADO'
    : 'NO REGISTRADO'
}

export type MeterChangeDoneFlag = 'PENDIENTE' | 'SI' | 'NO'

export const METER_CHANGE_DONE_FLAG_OPTIONS: MeterChangeDoneFlag[] = [
  'PENDIENTE',
  'SI',
  'NO',
]

export function meterChangeDoneFlag(
  value: string | null | undefined,
): MeterChangeDoneFlag {
  const raw = (value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (raw === 'SI' || raw === 'S' || raw === 'YES' || raw === '1') return 'SI'
  if (raw === 'NO' || raw === 'N' || raw === '0') return 'NO'
  return 'PENDIENTE'
}

/** Valor corto en Firestore (PEN cabe en reglas con size <= 8). */
export function meterChangeDoneFlagStorage(
  value: string | null | undefined,
): 'PEN' | 'SI' | 'NO' {
  const flag = meterChangeDoneFlag(value)
  if (flag === 'SI') return 'SI'
  if (flag === 'NO') return 'NO'
  return 'PEN'
}

export function meterChangeDoneFlagLabel(flag: MeterChangeDoneFlag): string {
  if (flag === 'SI') return 'SI'
  if (flag === 'NO') return 'NO'
  return 'PENDIENTE'
}

export function meterChangeDoneFlagClass(flag: MeterChangeDoneFlag): string {
  if (flag === 'SI') return 'io-done io-done--si'
  if (flag === 'NO') return 'io-done io-done--no'
  return 'io-done io-done--pendiente'
}

export const METER_CHANGE_SYSTEM_OPTIONS = INSTALLATION_METER_TYPE_OPTIONS.map(
  (option) => ({
    code: option.code,
    shortLabel: option.shortLabel,
    description: option.description,
  }),
)

export function meterChangeSystemFromValue(
  value: string | null | undefined,
): MeterSystemType {
  const raw = (value ?? '').trim().toUpperCase()
  if (raw === 'C1' || raw === 'C2') return raw as MeterSystemType
  return installationMeterTypeFromSubType(raw)
}

export function meterChangeSystemLabel(value: string | null | undefined): string {
  const code = meterChangeSystemFromValue(value)
  const option = METER_CHANGE_SYSTEM_OPTIONS.find((item) => item.code === code)
  if (!option) return code
  return `${option.shortLabel} — ${option.description}`
}

export function emptyMeterChangeOrderDraft(): MeterChangeOrderDraft {
  return {
    orderNumber: '',
    pedido: '',
    customerName: '',
    address: '',
    supplyCode: '',
    routeCode: '',
    meterSerial: '',
    typeCode: 'CM',
    systemType: InstallationMeterType.C1,
    changeDoneFlag: 'PEN',
    observations: '',
    latitude: null,
    longitude: null,
    technicianId: '',
    technicianName: '',
    scheduledDate: null,
  }
}

export function draftFromMeterChangeOrder(
  order: MeterChangeOrder,
): MeterChangeOrderDraft {
  return {
    orderNumber: order.orderNumber,
    pedido: order.pedido,
    customerName: order.customerName,
    address: order.address,
    supplyCode: order.supplyCode,
    routeCode: order.routeCode,
    meterSerial: order.meterSerial,
    typeCode: order.typeCode || 'CM',
    systemType: meterChangeSystemFromValue(order.systemType),
    changeDoneFlag: meterChangeDoneFlag(order.changeDoneFlag),
    observations: order.observations,
    latitude: order.latitude,
    longitude: order.longitude,
    technicianId: order.technicianId,
    technicianName: order.technicianName,
    scheduledDate: order.scheduledDate,
  }
}

export function formatMeterChangeDate(date: Date | null): string {
  if (!date) return ''
  return date.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
}

/** Pedido = TECNICO_CM_DD-MM-YYYY (como LISTA_CM). */
export function buildMeterChangePedido(input: {
  technicianName: string
  typeCode?: string
  scheduledDate: Date | null
}): string {
  const technician = input.technicianName
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
  const typeCode = (input.typeCode || 'CM').trim().toUpperCase() || 'CM'
  if (!technician || !input.scheduledDate) return ''
  const day = String(input.scheduledDate.getDate()).padStart(2, '0')
  const month = String(input.scheduledDate.getMonth() + 1).padStart(2, '0')
  const year = String(input.scheduledDate.getFullYear())
  return `${technician}_${typeCode}_${day}-${month}-${year}`
}

export function parseMeterChangeLocation(
  value: string | null | undefined,
): { latitude: number | null; longitude: number | null } {
  const raw = (value ?? '').trim()
  if (!raw) return { latitude: null, longitude: null }
  const match = raw.match(/(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/)
  if (!match) return { latitude: null, longitude: null }
  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { latitude: null, longitude: null }
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { latitude: null, longitude: null }
  }
  return { latitude, longitude }
}

export function formatMeterChangeLocation(
  latitude: number | null,
  longitude: number | null,
): string {
  if (latitude == null || longitude == null) return ''
  return `${latitude}, ${longitude}`
}

export function meterChangeExportFileName(input: {
  technicianName: string
  reportCode: string
  date: Date
  count: number
  extension: 'pdf' | 'xlsx'
}): string {
  const technician = sanitizeMeterChangeFilePart(input.technicianName || 'TODOS')
  const code = sanitizeMeterChangeFilePart(input.reportCode || 'CM')
  const dateKey = [
    String(input.date.getDate()).padStart(2, '0'),
    String(input.date.getMonth() + 1).padStart(2, '0'),
    String(input.date.getFullYear()),
  ].join('-')
  return `${technician}_${code}_${dateKey}_${input.count}_${code}_HMT_App.${input.extension}`
}

function sanitizeMeterChangeFilePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 80)
}

