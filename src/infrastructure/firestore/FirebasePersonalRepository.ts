import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { Personal } from '@/domain/entities/Personal'
import type {
  PersonalRepository,
  PersonalWriteInput,
} from '@/domain/repositories/PersonalRepository'
import type { PersonalCondition } from '@/domain/value-objects/PersonalCondition'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

const PAGE_SIZE = 500

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function asDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  return new Date(0)
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => asText(item)).filter(Boolean))]
}

function mapPersonal(id: string, data: DocumentData): Personal {
  const nombres = asText(data.nombres || data.nombre || data.names)
  const apellidoPaterno = asText(
    data.apellidoPaterno || data.apellido_paterno || data.paterno,
  )
  const apellidoMaterno = asText(
    data.apellidoMaterno || data.apellido_materno || data.materno,
  )
  const roleIds = asStringList(data.roleIds)
  const roleNames = asStringList(data.roleNames)
  const roleId = asText(data.roleId || data.role || data.rolId) || roleIds[0] || ''
  const roleName =
    asText(data.roleName || data.rol) || roleNames.join(' · ')

  return {
    id,
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    dni: asText(data.dni).replace(/\D/g, ''),
    cargoId: asText(data.cargoId),
    cargoName: asText(data.cargoName || data.cargo),
    localidadId: asText(data.localidadId),
    localidadName: asText(data.localidadName || data.localidad),
    condicion: (asText(data.condicion) as PersonalCondition | '') ?? '',
    roleId,
    roleName,
    roleIds: roleIds.length > 0 ? roleIds : roleId ? [roleId] : [],
    roleNames: roleNames.length > 0 ? roleNames : roleName ? [roleName] : [],
    createdById: asText(data.createdById),
    createdByName: asText(data.createdByName),
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
  }
}

function toDoc(
  input: PersonalWriteInput,
  createdAt: Timestamp,
  updatedAt: Timestamp,
) {
  return {
    nombres: input.nombres,
    apellidoPaterno: input.apellidoPaterno,
    apellidoMaterno: input.apellidoMaterno,
    dni: input.dni,
    cargoId: input.cargoId,
    cargoName: input.cargoName,
    localidadId: input.localidadId,
    localidadName: input.localidadName,
    condicion: input.condicion,
    roleId: input.roleId ?? '',
    roleName: input.roleName ?? '',
    roleIds: input.roleIds ?? (input.roleId ? [input.roleId] : []),
    roleNames: input.roleNames ?? (input.roleName ? [input.roleName] : []),
    createdById: input.createdById,
    createdByName: input.createdByName,
    createdAt,
    updatedAt,
  }
}

export class FirebasePersonalRepository implements PersonalRepository {
  private readonly collectionRef = collection(firestoreDb, 'personal')

  async listAll(): Promise<Personal[]> {
    const people: Personal[] = []
    let cursor: QueryDocumentSnapshot | undefined

    for (;;) {
      const page = cursor
        ? query(
            this.collectionRef,
            orderBy(documentId()),
            startAfter(cursor),
            limit(PAGE_SIZE),
          )
        : query(this.collectionRef, orderBy(documentId()), limit(PAGE_SIZE))

      const snapshot = await getDocs(page)
      if (snapshot.empty) break

      for (const item of snapshot.docs) {
        try {
          people.push(mapPersonal(item.id, item.data()))
        } catch {
          // Un documento mal formado no debe ocultar el resto.
        }
      }

      if (snapshot.size < PAGE_SIZE) break
      cursor = snapshot.docs[snapshot.docs.length - 1]
    }

    return people
  }

  async getById(id: string): Promise<Personal | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapPersonal(snapshot.id, snapshot.data())
  }

  async findByDni(dni: string): Promise<Personal | null> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('dni', '==', dni), limit(1)),
    )
    const first = snapshot.docs[0]
    if (!first) return null
    return mapPersonal(first.id, first.data())
  }

  async create(input: PersonalWriteInput): Promise<Personal> {
    const now = Timestamp.now()
    const id = crypto.randomUUID()
    const payload = toDoc(input, now, now)
    await setDoc(doc(this.collectionRef, id), payload)
    return mapPersonal(id, payload)
  }

  async update(id: string, input: PersonalWriteInput): Promise<Personal> {
    const refDoc = doc(this.collectionRef, id)
    const snapshot = await getDoc(refDoc)
    if (!snapshot.exists()) {
      throw new NotFoundError('Persona no encontrada')
    }
    await updateDoc(refDoc, {
      nombres: input.nombres,
      apellidoPaterno: input.apellidoPaterno,
      apellidoMaterno: input.apellidoMaterno,
      dni: input.dni,
      cargoId: input.cargoId,
      cargoName: input.cargoName,
      localidadId: input.localidadId,
      localidadName: input.localidadName,
      condicion: input.condicion,
      roleId: input.roleId ?? '',
      roleName: input.roleName ?? '',
      roleIds: input.roleIds ?? (input.roleId ? [input.roleId] : []),
      roleNames: input.roleNames ?? (input.roleName ? [input.roleName] : []),
      updatedAt: Timestamp.now(),
    })
    const next = await getDoc(refDoc)
    return mapPersonal(id, next.data() ?? {})
  }

  async assignRole(
    id: string,
    roleId: string,
    roleName: string,
  ): Promise<Personal> {
    return this.assignRoles(id, roleId ? [{ id: roleId, name: roleName }] : [])
  }

  async assignRoles(
    id: string,
    roles: Array<{ id: string; name: string }>,
  ): Promise<Personal> {
    const refDoc = doc(this.collectionRef, id)
    const snapshot = await getDoc(refDoc)
    if (!snapshot.exists()) {
      throw new NotFoundError('Persona no encontrada')
    }
    const unique: Array<{ id: string; name: string }> = []
    for (const role of roles) {
      if (!role.id || unique.some((item) => item.id === role.id)) continue
      unique.push(role)
    }
    const clipped = unique.slice(0, 3)
    await updateDoc(refDoc, {
      roleId: clipped[0]?.id ?? '',
      roleName: clipped.map((item) => item.name).join(' · '),
      roleIds: clipped.map((item) => item.id),
      roleNames: clipped.map((item) => item.name),
      updatedAt: Timestamp.now(),
    })
    const next = await getDoc(refDoc)
    return mapPersonal(id, next.data() ?? {})
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }

  async countByCargoId(cargoId: string): Promise<number> {
    const snapshot = await getCountFromServer(
      query(this.collectionRef, where('cargoId', '==', cargoId)),
    )
    return snapshot.data().count
  }

  async countByLocalidadId(localidadId: string): Promise<number> {
    const snapshot = await getCountFromServer(
      query(this.collectionRef, where('localidadId', '==', localidadId)),
    )
    return snapshot.data().count
  }

  async renameCargo(cargoId: string, cargoName: string): Promise<void> {
    await this.renameField('cargoId', cargoId, { cargoName })
  }

  async renameLocalidad(
    localidadId: string,
    localidadName: string,
  ): Promise<void> {
    await this.renameField('localidadId', localidadId, { localidadName })
  }

  private async renameField(
    field: 'cargoId' | 'localidadId',
    id: string,
    patch: { cargoName: string } | { localidadName: string },
  ): Promise<void> {
    const snapshot = await getDocs(
      query(this.collectionRef, where(field, '==', id)),
    )
    if (snapshot.empty) return
    const now = Timestamp.now()
    let batch = writeBatch(firestoreDb)
    let count = 0
    for (const item of snapshot.docs) {
      batch.update(item.ref, { ...patch, updatedAt: now })
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
