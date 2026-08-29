import type {
  MeterChangeOrder,
  MeterChangeOrderDraft,
} from '@/domain/entities/MeterChangeOrder'

export interface MeterChangeOrderRepository {
  listByArea(areaId: string): Promise<MeterChangeOrder[]>
  watchByArea(
    areaId: string,
    onChange: (orders: MeterChangeOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void
  watchAssignedTo(
    technicianId: string,
    onChange: (orders: MeterChangeOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void
  getById(id: string): Promise<MeterChangeOrder | null>
  findByOrderNumber(
    areaId: string,
    orderNumber: string,
  ): Promise<MeterChangeOrder | null>
  upsert(
    areaId: string,
    areaName: string,
    draft: MeterChangeOrderDraft,
    actor: { id: string; name: string },
  ): Promise<MeterChangeOrder>
  update(
    id: string,
    areaName: string,
    draft: MeterChangeOrderDraft,
  ): Promise<MeterChangeOrder>
  delete(id: string): Promise<void>
  upsertMany(
    areaId: string,
    areaName: string,
    drafts: MeterChangeOrderDraft[],
    actor: { id: string; name: string },
  ): Promise<{ created: number; updated: number }>
}
