import type { SupportTicket } from '@/domain/entities/SupportTicket'
import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import type { SupportTicketRepository } from '@/domain/repositories/SupportTicketRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export class ListSupportTicketsUseCase {
  private readonly repository: SupportTicketRepository

  constructor(repository: SupportTicketRepository) {
    this.repository = repository
  }

  async execute(actor: User): Promise<SupportTicket[]> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo el administrador puede ver el soporte')
    }
    return this.repository.listAll()
  }
}

export class ResolveSupportTicketUseCase {
  private readonly repository: SupportTicketRepository

  constructor(repository: SupportTicketRepository) {
    this.repository = repository
  }

  async execute(
    actor: User,
    input: { ticketId: string; response: string },
  ): Promise<SupportTicket> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo el administrador puede responder')
    }
    const ticketId = input.ticketId.trim()
    if (!ticketId) throw new ValidationError('Aviso inválido')
    const response = input.response.trim()
    if (response.length > 1000) {
      throw new ValidationError('La respuesta es demasiado larga')
    }
    return this.repository.resolve({
      ticketId,
      response,
      resolvedById: actor.id,
      resolvedByName: actor.displayName,
    })
  }
}
