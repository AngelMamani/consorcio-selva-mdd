import type {
  InstallationOrder,
  InstallationOrderDraft,
} from '@/domain/entities/InstallationOrder'

export interface InstallationOrderRepository {
  listByArea(areaId: string): Promise<InstallationOrder[]>
  watchByArea(
    areaId: string,
    onChange: (orders: InstallationOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void
  watchAssignedTo(
    technicianId: string,
    onChange: (orders: InstallationOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void
  getById(id: string): Promise<InstallationOrder | null>
  findByOrderNumber(
    areaId: string,
    orderNumber: string,
  ): Promise<InstallationOrder | null>
  upsert(
    areaId: string,
    areaName: string,
    draft: InstallationOrderDraft,
    actor: { id: string; name: string },
  ): Promise<InstallationOrder>
  update(
    id: string,
    areaName: string,
    draft: InstallationOrderDraft,
  ): Promise<InstallationOrder>
  delete(id: string): Promise<void>
  renameAreaName(areaId: string, areaName: string): Promise<void>
  upsertMany(
    areaId: string,
    areaName: string,
    drafts: InstallationOrderDraft[],
    actor: { id: string; name: string },
  ): Promise<{ created: number; updated: number }>
}
