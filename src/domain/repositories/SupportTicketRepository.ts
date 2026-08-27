import type { SupportTicket } from '@/domain/entities/SupportTicket'

export interface ResolveSupportTicketInput {
  ticketId: string
  response: string
  resolvedById: string
  resolvedByName: string
}

export interface SupportTicketRepository {
  listAll(): Promise<SupportTicket[]>
  resolve(input: ResolveSupportTicketInput): Promise<SupportTicket>
}
