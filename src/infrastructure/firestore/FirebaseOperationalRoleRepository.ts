import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore'
import type { OperationalRole } from '@/domain/entities/OperationalRole'
import type { OperationalRoleRepository } from '@/domain/repositories/OperationalRoleRepository'
import { isAppMenuKey } from '@/domain/value-objects/AppMenuPermission'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'permission-denied'
  )
}

interface OperationalRoleDoc {
  name: string
  code: string
  permissions: string[]
  isSystem: boolean
  createdById: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

function mapRole(id: string, data: OperationalRoleDoc): OperationalRole {
  return {
    id,
    name: data.name,
    code: data.code,
    permissions: (data.permissions ?? []).filter(isAppMenuKey),
    isSystem: data.isSystem ?? false,
    createdById: data.createdById,
    createdByName: data.createdByName,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
  }
}

export class FirebaseOperationalRoleRepository implements OperationalRoleRepository {
  private readonly collectionRef = collection(firestoreDb, 'operationalRoles')
  private readonly usersRef = collection(firestoreDb, 'users')

  async listAll(): Promise<OperationalRole[]> {
    try {
      const snapshot = await getDocs(this.collectionRef)
      return snapshot.docs
        .map((item) => mapRole(item.id, item.data() as OperationalRoleDoc))
        .sort((left, right) => left.name.localeCompare(right.name, 'es'))
    } catch (err) {
      if (isPermissionDenied(err)) return []
      throw err
    }
  }

  async getById(id: string): Promise<OperationalRole | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapRole(snapshot.id, snapshot.data() as OperationalRoleDoc)
  }

  async getByCode(code: string): Promise<OperationalRole | null> {
    try {
      const snapshot = await getDocs(
        query(this.collectionRef, where('code', '==', code), limit(1)),
      )
      const first = snapshot.docs[0]
      if (!first) return null
      return mapRole(first.id, first.data() as OperationalRoleDoc)
    } catch (err) {
      if (isPermissionDenied(err)) return null
      throw err
    }
  }

  async create(input: {
    name: string
    code: string
    permissions: string[]
    isSystem: boolean
    createdById: string
    createdByName: string
  }): Promise<OperationalRole> {
    const now = Timestamp.now()
    const id = crypto.randomUUID()
    const payload: OperationalRoleDoc = {
      name: input.name,
      code: input.code,
      permissions: input.permissions,
      isSystem: input.isSystem,
      createdById: input.createdById,
      createdByName: input.createdByName,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(doc(this.collectionRef, id), payload)
    return mapRole(id, payload)
  }

  async update(
    id: string,
    input: { name: string; permissions: string[] },
  ): Promise<OperationalRole> {
    const refDoc = doc(this.collectionRef, id)
    const snapshot = await getDoc(refDoc)
    if (!snapshot.exists()) {
      throw new NotFoundError('Rol no encontrado')
    }
    const current = snapshot.data() as OperationalRoleDoc
    const payload: OperationalRoleDoc = {
      ...current,
      name: input.name,
      permissions: input.permissions,
      updatedAt: Timestamp.now(),
    }
    await setDoc(refDoc, payload)
    return mapRole(id, payload)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }

  async countUsersByRoleCode(code: string): Promise<number> {
    const snapshot = await getCountFromServer(
      query(this.usersRef, where('role', '==', code)),
    )
    return snapshot.data().count
  }
}
