import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import {
  pickCanonicalUser,
  uniqueUsersByAccessDni,
  type User,
} from '@/domain/entities/User'
import type {
  CreateUserInput,
  UpdateUserInput,
  UserRepository,
} from '@/domain/repositories/UserRepository'
import { normalizeUserRoles, primaryUserRole } from '@/domain/value-objects/UserRole'
import { ThemePreference, normalizeThemePreference } from '@/domain/value-objects/ThemePreference'
import { DomainError, NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface UserDoc {
  email: string
  displayName: string
  dni?: string
  role: string
  roles?: string[]
  theme?: string
  mustChangePassword?: boolean
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

function mapUser(id: string, data: UserDoc): User {
  const roles = normalizeUserRoles([
    ...(Array.isArray(data.roles) ? data.roles : []),
    data.role,
  ])
  const role = primaryUserRole(roles)
  if (!role) {
    throw new DomainError(`Rol inválido en usuario ${id}`)
  }

  return {
    id,
    email: data.email,
    displayName: data.displayName,
    dni: data.dni ?? '',
    role,
    roles,
    theme: normalizeThemePreference(data.theme),
    mustChangePassword: data.mustChangePassword === true,
    active: data.active,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

export class FirebaseUserRepository implements UserRepository {
  private readonly collectionRef = collection(firestoreDb, 'users')
  private readonly loginAliasRef = collection(firestoreDb, 'loginByDni')

  async getById(id: string): Promise<User | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapUser(snapshot.id, snapshot.data() as UserDoc)
  }

  async listAll(): Promise<User[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, orderBy('createdAt', 'desc')),
    )
    return snapshot.docs.map((item) => mapUser(item.id, item.data() as UserDoc))
  }

  async listTechnicians(): Promise<User[]> {
    const [byRole, byArray] = await Promise.all([
      getDocs(query(this.collectionRef, where('role', '==', 'TECNICO'))),
      getDocs(
        query(this.collectionRef, where('roles', 'array-contains', 'TECNICO')),
      ),
    ])
    const byId = new Map<string, User>()
    for (const item of [...byRole.docs, ...byArray.docs]) {
      try {
        byId.set(item.id, mapUser(item.id, item.data() as UserDoc))
      } catch {
        // Perfil mal formado: no entra al listado de campo.
      }
    }
    return uniqueUsersByAccessDni([...byId.values()]).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'es'),
    )
  }

  async listByDni(dni: string): Promise<User[]> {
    if (!dni) return []
    const snapshot = await getDocs(
      query(this.collectionRef, where('dni', '==', dni)),
    )
    return snapshot.docs.map((item) => mapUser(item.id, item.data() as UserDoc))
  }

  async findByDni(dni: string): Promise<User | null> {
    return pickCanonicalUser(await this.listByDni(dni))
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return null
    const snapshot = await getDocs(
      query(this.collectionRef, where('email', '==', normalized)),
    )
    return pickCanonicalUser(
      snapshot.docs.map((item) => mapUser(item.id, item.data() as UserDoc)),
    )
  }

  async create(input: CreateUserInput): Promise<User> {
    const now = Timestamp.now()
    const payload: UserDoc = {
      email: input.email,
      displayName: input.displayName,
      dni: input.dni ?? '',
      role: input.role,
      roles: normalizeUserRoles(input.roles ?? [input.role]),
      theme: ThemePreference.Light,
      mustChangePassword: true,
      active: true,
      createdAt: now,
      updatedAt: now,
    }

    await setDoc(doc(this.collectionRef, input.id), payload)
    await this.syncLoginAlias(input.id, input.email, '', input.dni ?? '')
    return mapUser(input.id, payload)
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const ref = doc(this.collectionRef, id)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      throw new NotFoundError('Usuario no encontrado')
    }

    const patch: Partial<UserDoc> = {
      updatedAt: Timestamp.now(),
    }

    if (input.displayName !== undefined) patch.displayName = input.displayName
    if (input.role !== undefined) patch.role = input.role
    if (input.roles !== undefined) {
      const roles = normalizeUserRoles(input.roles)
      patch.roles = roles
      patch.role = primaryUserRole(roles) ?? input.role ?? (existing.data() as UserDoc).role
    }
    if (input.dni !== undefined) patch.dni = input.dni
    if (input.active !== undefined) patch.active = input.active
    if (input.theme !== undefined) patch.theme = input.theme
    if (input.mustChangePassword !== undefined) {
      patch.mustChangePassword = input.mustChangePassword
    }

    await updateDoc(ref, patch)
    if (input.dni !== undefined) {
      const current = existing.data() as UserDoc
      await this.syncLoginAlias(
        id,
        current.email,
        current.dni ?? '',
        input.dni,
      )
    }
    const updated = await getDoc(ref)
    return mapUser(id, updated.data() as UserDoc)
  }

  private async syncLoginAlias(
    userId: string,
    email: string,
    previousDni: string,
    nextDni: string,
  ): Promise<void> {
    if (previousDni && previousDni !== nextDni) {
      await deleteDoc(doc(this.loginAliasRef, previousDni)).catch(() => undefined)
    }
    if (nextDni) {
      await setDoc(doc(this.loginAliasRef, nextDni), {
        email: email.trim().toLowerCase(),
        userId,
      })
    }
  }
}
