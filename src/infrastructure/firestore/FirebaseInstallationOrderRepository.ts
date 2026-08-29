import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type {
  InstallationOrder,
  InstallationOrderDraft,
  InstallationOrderStatus,
} from '@/domain/entities/InstallationOrder'
import { installationOrderStatus } from '@/domain/entities/InstallationOrder'
import type { InstallationOrderRepository } from '@/domain/repositories/InstallationOrderRepository'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface InstallationOrderDoc {
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
  recordedAt: Timestamp | null
  typeInitials: string
  classification: string
  technicianId: string
  technicianName: string
  scheduledDate: Timestamp | null
  status: InstallationOrderStatus
  createdById: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

function toTimestamp(value: Date | null): Timestamp | null {
  return value ? Timestamp.fromDate(value) : null
}

function fromTimestamp(value: Timestamp | null | undefined): Date | null {
  return value ? value.toDate() : null
}

function orderDocId(areaId: string, orderNumber: string): string {
  return `in_${areaId}_${orderNumber}`
}

function payloadFromDraft(
  areaId: string,
  areaName: string,
  draft: InstallationOrderDraft,
  meta: {
    createdById: string
    createdByName: string
    createdAt: Timestamp
  },
): InstallationOrderDoc {
  return {
    areaId,
    areaName,
    orderNumber: draft.orderNumber,
    subType: draft.subType,
    applicantName: draft.applicantName,
    applicantAddress: draft.applicantAddress,
    sectorCijp: draft.sectorCijp,
    sector: draft.sector,
    supplyCode: draft.supplyCode,
    neighborRouteCode: draft.neighborRouteCode,
    attentionCenter: draft.attentionCenter,
    executionNotes: draft.executionNotes,
    registeredFlag: draft.registeredFlag,
    categoryCode: draft.categoryCode,
    referenceNumber: draft.referenceNumber,
    recordedAt: toTimestamp(draft.recordedAt),
    typeInitials: draft.typeInitials,
    classification: draft.classification,
    technicianId: draft.technicianId,
    technicianName: draft.technicianName,
    scheduledDate: toTimestamp(draft.scheduledDate),
    status: installationOrderStatus(draft.technicianId),
    createdById: meta.createdById,
    createdByName: meta.createdByName,
    createdAt: meta.createdAt,
    updatedAt: Timestamp.now(),
  }
}

function mapOrder(id: string, data: InstallationOrderDoc): InstallationOrder {
  return {
    id,
    areaId: data.areaId,
    areaName: data.areaName ?? '',
    orderNumber: data.orderNumber,
    subType: data.subType ?? '',
    applicantName: data.applicantName ?? '',
    applicantAddress: data.applicantAddress ?? '',
    sectorCijp: data.sectorCijp ?? '',
    sector: data.sector ?? '',
    supplyCode: data.supplyCode ?? '',
    neighborRouteCode: data.neighborRouteCode ?? '',
    attentionCenter: data.attentionCenter ?? '',
    executionNotes: data.executionNotes ?? '',
    registeredFlag: data.registeredFlag ?? '',
    categoryCode: data.categoryCode ?? '',
    referenceNumber: data.referenceNumber ?? '',
    recordedAt: fromTimestamp(data.recordedAt),
    typeInitials: data.typeInitials ?? '',
    classification: data.classification ?? '',
    technicianId: data.technicianId ?? '',
    technicianName: data.technicianName ?? '',
    scheduledDate: fromTimestamp(data.scheduledDate),
    status: installationOrderStatus(data.technicianId ?? ''),
    createdById: data.createdById,
    createdByName: data.createdByName,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

function sortOrders(orders: InstallationOrder[]): InstallationOrder[] {
  return [...orders].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'NO_REGISTRADO' ? -1 : 1
    }
    const leftDate = left.scheduledDate?.getTime() ?? 0
    const rightDate = right.scheduledDate?.getTime() ?? 0
    if (leftDate !== rightDate) return leftDate - rightDate
    return left.orderNumber.localeCompare(right.orderNumber)
  })
}

export class FirebaseInstallationOrderRepository
  implements InstallationOrderRepository
{
  private readonly collectionRef = collection(firestoreDb, 'installationOrders')

  async listByArea(areaId: string): Promise<InstallationOrder[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('areaId', '==', areaId)),
    )
    return sortOrders(
      snapshot.docs.map((item) =>
        mapOrder(item.id, item.data() as InstallationOrderDoc),
      ),
    )
  }

  watchByArea(
    areaId: string,
    onChange: (orders: InstallationOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      query(this.collectionRef, where('areaId', '==', areaId)),
      (snapshot) => {
        onChange(
          sortOrders(
            snapshot.docs.map((item) =>
              mapOrder(item.id, item.data() as InstallationOrderDoc),
            ),
          ),
        )
      },
      (error) => onError?.(error),
    )
  }

  watchAssignedTo(
    technicianId: string,
    onChange: (orders: InstallationOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      query(this.collectionRef, where('technicianId', '==', technicianId)),
      (snapshot) => {
        onChange(
          sortOrders(
            snapshot.docs.map((item) =>
              mapOrder(item.id, item.data() as InstallationOrderDoc),
            ),
          ),
        )
      },
      (error) => onError?.(error),
    )
  }

  async getById(id: string): Promise<InstallationOrder | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapOrder(snapshot.id, snapshot.data() as InstallationOrderDoc)
  }

  async findByOrderNumber(
    areaId: string,
    orderNumber: string,
  ): Promise<InstallationOrder | null> {
    const snapshot = await getDoc(
      doc(this.collectionRef, orderDocId(areaId, orderNumber)),
    )
    if (!snapshot.exists()) return null
    return mapOrder(snapshot.id, snapshot.data() as InstallationOrderDoc)
  }

  async upsert(
    areaId: string,
    areaName: string,
    draft: InstallationOrderDraft,
    actor: { id: string; name: string },
  ): Promise<InstallationOrder> {
    const id = orderDocId(areaId, draft.orderNumber)
    const refDoc = doc(this.collectionRef, id)
    const snapshot = await getDoc(refDoc)
    const now = Timestamp.now()
    const payload = payloadFromDraft(areaId, areaName, draft, {
      createdById: snapshot.exists()
        ? ((snapshot.data() as InstallationOrderDoc).createdById ?? actor.id)
        : actor.id,
      createdByName: snapshot.exists()
        ? ((snapshot.data() as InstallationOrderDoc).createdByName ?? actor.name)
        : actor.name,
      createdAt: snapshot.exists()
        ? ((snapshot.data() as InstallationOrderDoc).createdAt ?? now)
        : now,
    })
    await setDoc(refDoc, payload)
    return mapOrder(id, payload)
  }

  async update(
    id: string,
    areaName: string,
    draft: InstallationOrderDraft,
  ): Promise<InstallationOrder> {
    const refDoc = doc(this.collectionRef, id)
    const snapshot = await getDoc(refDoc)
    if (!snapshot.exists()) {
      throw new NotFoundError('Orden no encontrada')
    }
    const current = snapshot.data() as InstallationOrderDoc
    const payload = payloadFromDraft(current.areaId, areaName, draft, {
      createdById: current.createdById,
      createdByName: current.createdByName,
      createdAt: current.createdAt,
    })
    await setDoc(refDoc, payload)
    return mapOrder(id, payload)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }

  async upsertMany(
    areaId: string,
    areaName: string,
    drafts: InstallationOrderDraft[],
    actor: { id: string; name: string },
  ): Promise<{ created: number; updated: number }> {
    const existing = await this.listByArea(areaId)
    const existingByNumber = new Map(
      existing.map((item) => [item.orderNumber, item]),
    )
    let created = 0
    let updated = 0
    let batch = writeBatch(firestoreDb)
    let count = 0
    const now = Timestamp.now()

    for (const draft of drafts) {
      const id = orderDocId(areaId, draft.orderNumber)
      const previous = existingByNumber.get(draft.orderNumber)
      const payload = payloadFromDraft(areaId, areaName, draft, {
        createdById: previous?.createdById ?? actor.id,
        createdByName: previous?.createdByName ?? actor.name,
        createdAt: previous ? Timestamp.fromDate(previous.createdAt) : now,
      })
      batch.set(doc(this.collectionRef, id), payload)
      if (previous) updated += 1
      else created += 1
      count += 1
      if (count === 400) {
        await batch.commit()
        batch = writeBatch(firestoreDb)
        count = 0
      }
    }

    if (count > 0) {
      await batch.commit()
    }

    return { created, updated }
  }

  async renameAreaName(areaId: string, areaName: string): Promise<void> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('areaId', '==', areaId)),
    )
    if (snapshot.empty) return
    const now = Timestamp.now()
    let batch = writeBatch(firestoreDb)
    let count = 0
    for (const item of snapshot.docs) {
      batch.update(item.ref, { areaName, updatedAt: now })
      count += 1
      if (count === 50) {
        await batch.commit()
        batch = writeBatch(firestoreDb)
        count = 0
      }
    }
    if (count > 0) {
      await batch.commit()
    }
  }
}
