export const InstallationOrderStatus = {
  Programado: 'PROGRAMADO',
  NoRegistrado: 'NO_REGISTRADO',
} as const

export type InstallationOrderStatus =
  (typeof InstallationOrderStatus)[keyof typeof InstallationOrderStatus]

export interface InstallationOrder {
  id: string
  areaId: string
  areaName: string
  orderNumber: string
  subType: string
  applicantName: string
  applicantAddress: string
  sectorCijp: string
  sector: string
  supplyCode: string
  neighborRouteCode: string
  attentionCenter: string
  executionNotes: string
  registeredFlag: string
  categoryCode: string
  referenceNumber: string
  recordedAt: Date | null
  typeInitials: string
  classification: string
  technicianId: string
  technicianName: string
  scheduledDate: Date | null
  status: InstallationOrderStatus
  createdById: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

export interface InstallationOrderDraft {
  orderNumber: string
  subType: string
  applicantName: string
  applicantAddress: string
  sectorCijp: string
  sector: string
  supplyCode: string
  neighborRouteCode: string
  attentionCenter: string
  executionNotes: string
  registeredFlag: string
  categoryCode: string
  referenceNumber: string
  recordedAt: Date | null
  typeInitials: string
  classification: string
  technicianId: string
  technicianName: string
  scheduledDate: Date | null
}

export function installationOrderStatus(
  technicianId: string,
): InstallationOrderStatus {
  return technicianId.trim()
    ? InstallationOrderStatus.Programado
    : InstallationOrderStatus.NoRegistrado
}

export function installationOrderStatusLabel(status: InstallationOrderStatus): string {
  return status === InstallationOrderStatus.Programado
    ? 'PROGRAMADO'
    : 'NO REGISTRADO'
}

export function installationRegisteredFlag(value: string | null | undefined): 'SI' | 'NO' {
  const raw = (value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (raw === 'SI' || raw === 'S' || raw === 'YES' || raw === '1') return 'SI'
  return 'NO'
}

export function emptyInstallationOrderDraft(): InstallationOrderDraft {
  return {
    orderNumber: '',
    subType: 'INSTALACION NUEVA C1',
    applicantName: '',
    applicantAddress: '',
    sectorCijp: '',
    sector: '',
    supplyCode: '',
    neighborRouteCode: '',
    attentionCenter: '',
    executionNotes: '',
    registeredFlag: 'NO',
    categoryCode: '',
    referenceNumber: '',
    recordedAt: null,
    typeInitials: '',
    classification: 'F',
    technicianId: '',
    technicianName: '',
    scheduledDate: null,
  }
}

export function draftFromInstallationOrder(order: InstallationOrder): InstallationOrderDraft {
  return {
    orderNumber: order.orderNumber,
    subType: order.subType,
    applicantName: order.applicantName,
    applicantAddress: order.applicantAddress,
    sectorCijp: order.sectorCijp,
    sector: order.sector,
    supplyCode: order.supplyCode,
    neighborRouteCode: order.neighborRouteCode,
    attentionCenter: order.attentionCenter,
    executionNotes: order.executionNotes,
    registeredFlag: installationRegisteredFlag(order.registeredFlag),
    categoryCode: order.categoryCode,
    referenceNumber: order.referenceNumber,
    recordedAt: order.recordedAt,
    typeInitials: order.typeInitials,
    classification: order.classification,
    technicianId: order.technicianId,
    technicianName: order.technicianName,
    scheduledDate: order.scheduledDate,
  }
}

export function formatInstallationDate(date: Date | null): string {
  if (!date) return ''
  return date.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
}

export function formatInstallationDateTime(date: Date | null): string {
  if (!date) return ''
  return date.toLocaleString('es-PE', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function installationExportFileName(input: {
  technicianName: string
  reportCode: string
  date: Date
  count: number
}): string {
  const technician = sanitizeFilePart(input.technicianName || 'TODOS')
  const code = sanitizeFilePart(input.reportCode || 'IN')
  const dateKey = [
    String(input.date.getDate()).padStart(2, '0'),
    String(input.date.getMonth() + 1).padStart(2, '0'),
    String(input.date.getFullYear()),
  ].join('-')
  return `${technician}_${code}_${dateKey}_${input.count}_${code}_HMT_App.pdf`
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 80)
}
