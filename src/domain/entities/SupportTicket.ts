export interface SupportTicket {
  id: string
  kind: 'SUGERENCIA' | 'PROBLEMA'
  message: string
  status: 'ABIERTO' | 'RESUELTO'
  createdById: string
  createdByName: string
  createdAt: Date
  response: string
  resolvedAt: Date | null
  resolvedById: string
  resolvedByName: string
}

export function supportTicketKindLabel(kind: SupportTicket['kind']): string {
  return kind === 'PROBLEMA' ? 'Problema' : 'Sugerencia'
}

export function supportTicketStatusLabel(
  status: SupportTicket['status'],
): string {
  return status === 'RESUELTO' ? 'Resuelto' : 'Abierto'
}
