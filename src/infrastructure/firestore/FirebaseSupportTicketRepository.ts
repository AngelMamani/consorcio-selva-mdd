import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import type { SupportTicket } from '@/domain/entities/SupportTicket'
import type {
  ResolveSupportTicketInput,
  SupportTicketRepository,
} from '@/domain/repositories/SupportTicketRepository'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface SupportTicketDoc {
  kind: 'SUGERENCIA' | 'PROBLEMA'
  message: string
  status: 'ABIERTO' | 'RESUELTO'
  createdById: string
  createdByName: string
  createdAt: Timestamp
  response?: string
  resolvedAt?: Timestamp | null
  resolvedById?: string
  resolvedByName?: string
}

function mapTicket(id: string, data: SupportTicketDoc): SupportTicket {
  return {
    id,
    kind: data.kind === 'PROBLEMA' ? 'PROBLEMA' : 'SUGERENCIA',
    message: data.message ?? '',
    status: data.status === 'RESUELTO' ? 'RESUELTO' : 'ABIERTO',
    createdById: data.createdById ?? '',
    createdByName: data.createdByName ?? '',
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    response: data.response ?? '',
    resolvedAt: data.resolvedAt?.toDate?.() ?? null,
    resolvedById: data.resolvedById ?? '',
    resolvedByName: data.resolvedByName ?? '',
  }
}

export class FirebaseSupportTicketRepository implements SupportTicketRepository {
  private readonly collectionRef = collection(firestoreDb, 'supportTickets')

  async listAll(): Promise<SupportTicket[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, orderBy('createdAt', 'desc')),
    )
    return snapshot.docs.map((item) =>
      mapTicket(item.id, item.data() as SupportTicketDoc),
    )
  }

  async resolve(input: ResolveSupportTicketInput): Promise<SupportTicket> {
    const ref = doc(this.collectionRef, input.ticketId)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      throw new NotFoundError('Aviso no encontrado')
    }
    await updateDoc(ref, {
      status: 'RESUELTO',
      response: input.response,
      resolvedAt: Timestamp.now(),
      resolvedById: input.resolvedById,
      resolvedByName: input.resolvedByName,
    })
    const updated = await getDoc(ref)
    return mapTicket(input.ticketId, updated.data() as SupportTicketDoc)
  }
}
