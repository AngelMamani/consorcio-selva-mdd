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
  MeterChangeOrder,
  MeterChangeOrderDraft,
  MeterChangeOrderStatus,
} from '@/domain/entities/MeterChangeOrder'
import { meterChangeOrderStatus } from '@/domain/entities/MeterChangeOrder'
import type { MeterChangeOrderRepository } from '@/domain/repositories/MeterChangeOrderRepository'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface MeterChangeOrderDoc {
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
  scheduledDate: Timestamp | null
  status: MeterChangeOrderStatus
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
  return `cm_${areaId}_${orderNumber}`
}

function payloadFromDraft(
  areaId: string,
  areaName: string,
  draft: MeterChangeOrderDraft,
  meta: {
    createdById: string
    createdByName: string
    createdAt: Timestamp
  },
): MeterChangeOrderDoc {
  return {
    areaId,
    areaName,
    orderNumber: draft.orderNumber,
    pedido: draft.pedido,
    customerName: draft.customerName,
    address: draft.address,
    supplyCode: draft.supplyCode,
    routeCode: draft.routeCode,
    meterSerial: draft.meterSerial,
    typeCode: draft.typeCode || 'CM',
    systemType: draft.systemType,
    changeDoneFlag: draft.changeDoneFlag,
    observations: draft.observations,
    latitude: draft.latitude,
    longitude: draft.longitude,
    technicianId: draft.technicianId,
    technicianName: draft.technicianName,
    scheduledDate: toTimestamp(draft.scheduledDate),
    status: meterChangeOrderStatus(draft.technicianId),
    createdById: meta.createdById,
    createdByName: meta.createdByName,
    createdAt: meta.createdAt,
    updatedAt: Timestamp.now(),
  }
}

function mapOrder(id: string, data: MeterChangeOrderDoc): MeterChangeOrder {
  return {
    id,
    areaId: data.areaId,
    areaName: data.areaName ?? '',
    orderNumber: data.orderNumber,
    pedido: data.pedido ?? '',
    customerName: data.customerName ?? '',
    address: data.address ?? '',
    supplyCode: data.supplyCode ?? '',
    routeCode: data.routeCode ?? '',
    meterSerial: data.meterSerial ?? '',
    typeCode: data.typeCode ?? 'CM',
    systemType: data.systemType ?? 'C1',
    changeDoneFlag: data.changeDoneFlag ?? 'PEN',
    observations: data.observations ?? '',
    latitude:
      typeof data.latitude === 'number' && Number.isFinite(data.latitude)
        ? data.latitude
        : null,
    longitude:
      typeof data.longitude === 'number' && Number.isFinite(data.longitude)
        ? data.longitude
        : null,
    technicianId: data.technicianId ?? '',
    technicianName: data.technicianName ?? '',
    scheduledDate: fromTimestamp(data.scheduledDate),
    status: meterChangeOrderStatus(data.technicianId ?? ''),
    createdById: data.createdById,
    createdByName: data.createdByName,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

function sortOrders(orders: MeterChangeOrder[]): MeterChangeOrder[] {
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

export class FirebaseMeterChangeOrderRepository
  implements MeterChangeOrderRepository
{
  private readonly collectionRef = collection(firestoreDb, 'meterChangeOrders')

  async listByArea(areaId: string): Promise<MeterChangeOrder[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('areaId', '==', areaId)),
    )
    return sortOrders(
      snapshot.docs.map((item) =>
        mapOrder(item.id, item.data() as MeterChangeOrderDoc),
      ),
    )
  }

  watchByArea(
    areaId: string,
    onChange: (orders: MeterChangeOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      query(this.collectionRef, where('areaId', '==', areaId)),
      (snapshot) => {
        onChange(
          sortOrders(
            snapshot.docs.map((item) =>
              mapOrder(item.id, item.data() as MeterChangeOrderDoc),
            ),
          ),
        )
      },
      (error) => onError?.(error),
    )
  }

  watchAssignedTo(
    technicianId: string,
    onChange: (orders: MeterChangeOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      query(this.collectionRef, where('technicianId', '==', technicianId)),
      (snapshot) => {
        onChange(
          sortOrders(
            snapshot.docs.map((item) =>
              mapOrder(item.id, item.data() as MeterChangeOrderDoc),
            ),
          ),
        )
      },
      (error) => onError?.(error),
    )
  }

  async getById(id: string): Promise<MeterChangeOrder | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapOrder(snapshot.id, snapshot.data() as MeterChangeOrderDoc)
  }

  async findByOrderNumber(
    areaId: string,
    orderNumber: string,
  ): Promise<MeterChangeOrder | null> {
    return this.getById(orderDocId(areaId, orderNumber))
  }

  async upsert(
    areaId: string,
    areaName: string,
    draft: MeterChangeOrderDraft,
    actor: { id: string; name: string },
  ): Promise<MeterChangeOrder> {
    const id = orderDocId(areaId, draft.orderNumber)
    const existing = await getDoc(doc(this.collectionRef, id))
    const createdAt = existing.exists()
      ? (existing.data() as MeterChangeOrderDoc).createdAt
      : Timestamp.now()
    const createdById = existing.exists()
      ? (existing.data() as MeterChangeOrderDoc).createdById
      : actor.id
    const createdByName = existing.exists()
      ? (existing.data() as MeterChangeOrderDoc).createdByName
      : actor.name
    const payload = payloadFromDraft(areaId, areaName, draft, {
      createdById,
      createdByName,
      createdAt,
    })
    await setDoc(doc(this.collectionRef, id), payload)
    return mapOrder(id, payload)
  }

  async update(
    id: string,
    areaName: string,
    draft: MeterChangeOrderDraft,
  ): Promise<MeterChangeOrder> {
    const ref = doc(this.collectionRef, id)
    const existing = await getDoc(ref)
    if (!existing.exists()) throw new NotFoundError('Orden no encontrada')
    const current = existing.data() as MeterChangeOrderDoc
    const payload = payloadFromDraft(current.areaId, areaName, draft, {
      createdById: current.createdById,
      createdByName: current.createdByName,
      createdAt: current.createdAt,
    })
    await setDoc(ref, payload)
    return mapOrder(id, payload)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }

  async upsertMany(
    areaId: string,
    areaName: string,
    drafts: MeterChangeOrderDraft[],
    actor: { id: string; name: string },
  ): Promise<{ created: number; updated: number }> {
    let created = 0
    let updated = 0
    const chunkSize = 400
    for (let offset = 0; offset < drafts.length; offset += chunkSize) {
      const chunk = drafts.slice(offset, offset + chunkSize)
      const batch = writeBatch(firestoreDb)
      for (const draft of chunk) {
        const id = orderDocId(areaId, draft.orderNumber)
        const ref = doc(this.collectionRef, id)
        const existing = await getDoc(ref)
        if (existing.exists()) {
          updated += 1
          const current = existing.data() as MeterChangeOrderDoc
          batch.set(
            ref,
            payloadFromDraft(areaId, areaName, draft, {
              createdById: current.createdById,
              createdByName: current.createdByName,
              createdAt: current.createdAt,
            }),
          )
        } else {
          created += 1
          batch.set(
            ref,
            payloadFromDraft(areaId, areaName, draft, {
              createdById: actor.id,
              createdByName: actor.name,
              createdAt: Timestamp.now(),
            }),
          )
        }
      }
      await batch.commit()
    }
    return { created, updated }
  }
}
