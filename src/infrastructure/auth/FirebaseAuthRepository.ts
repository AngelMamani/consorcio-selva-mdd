import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type Auth,
} from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
import type {
  AuthRepository,
  CreateManagedUserInput,
  CreateManagedUserResult,
  UpdateManagedUserDisplayNameInput,
} from '@/domain/repositories/AuthRepository'
import {
  firebaseAuth,
  firestoreDb,
} from '@/infrastructure/firebase/firebaseApp'
import { loadFirebaseConfig } from '@/infrastructure/firebase/firebaseConfig'
import { DomainError } from '@/domain/errors/DomainError'
import { DEFAULT_TEMPORARY_PASSWORD } from '@/domain/value-objects/PasswordPolicy'
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { normalizeUserRoles, primaryUserRole } from '@/domain/value-objects/UserRole'
import { ThemePreference } from '@/domain/value-objects/ThemePreference'

const SECONDARY_APP_NAME = 'consorcio-managed-auth'

function readErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  if ('code' in error) return String((error as { code: unknown }).code ?? '')
  return ''
}

function readErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Error de autenticación'
  }

  const candidate = error as {
    message?: unknown
    details?: unknown
    customData?: { message?: unknown }
  }

  if (typeof candidate.details === 'string' && candidate.details.trim()) {
    return candidate.details.trim()
  }

  if (
    typeof candidate.customData?.message === 'string' &&
    candidate.customData.message.trim()
  ) {
    return candidate.customData.message.trim()
  }

  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message
      .replace(/^Firebase:\s*/i, '')
      .replace(/\s*\([^)]+\)\.?$/i, '')
      .trim()
  }

  return 'Error de autenticación'
}

function mapAuthError(error: unknown): Error {
  const code = readErrorCode(error)
  const message = readErrorMessage(error)

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new DomainError('Correo, DNI o contraseña incorrectos')
    case 'auth/email-already-in-use':
      return new DomainError('El correo ya está registrado')
    case 'auth/weak-password':
      return new DomainError('La contraseña es demasiado débil')
    case 'auth/requires-recent-login':
      return new DomainError(
        'Por seguridad, cierra sesión e inicia de nuevo para cambiar la contraseña',
      )
    case 'auth/too-many-requests':
      return new DomainError('Demasiados intentos. Intenta más tarde')
    case 'auth/network-request-failed':
      return new DomainError(
        'Sin conexión con Firebase. Revisa tu internet e intenta otra vez',
      )
    default:
      return new DomainError(message || 'Error de autenticación')
  }
}

async function withSecondaryAuth<T>(
  run: (auth: Auth) => Promise<T>,
): Promise<T> {
  const config = loadFirebaseConfig()
  const existing = getApps().find((app) => app.name === SECONDARY_APP_NAME)
  const app = existing ?? initializeApp(config, SECONDARY_APP_NAME)
  const auth = getAuth(app)
  try {
    await signOut(auth).catch(() => undefined)
    return await run(auth)
  } finally {
    await signOut(auth).catch(() => undefined)
  }
}

export class FirebaseAuthRepository implements AuthRepository {
  async login(email: string, password: string): Promise<string> {
    try {
      const result = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password,
      )
      return result.user.uid
    } catch (error) {
      throw mapAuthError(error)
    }
  }

  async resolveEmailByDni(dni: string): Promise<string> {
    try {
      const snapshot = await getDoc(doc(firestoreDb, 'loginByDni', dni))
      const email = snapshot.data()?.email
      if (!snapshot.exists() || typeof email !== 'string' || !email.trim()) {
        throw new DomainError('Correo, DNI o contraseña incorrectos')
      }
      return email.trim().toLowerCase()
    } catch (error) {
      if (error instanceof DomainError) throw error
      throw mapAuthError(error)
    }
  }

  async claimConfiguredSuperAdmin(): Promise<void> {
    const uid = firebaseAuth.currentUser?.uid
    const email = firebaseAuth.currentUser?.email?.trim().toLowerCase()
    if (!uid || !email) {
      throw new DomainError('Debes iniciar sesión')
    }
    if (email !== 'amamanim@unamad.edu.pe') {
      throw new DomainError(
        'Esta cuenta no está configurada como Super Administrador',
      )
    }
    const ref = doc(firestoreDb, 'users', uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      throw new DomainError('Usuario sin perfil registrado')
    }
    const data = snap.data()
    const currentRoles = Array.isArray(data.roles)
      ? data.roles.filter((item): item is string => typeof item === 'string')
      : []
    const nextRoles = normalizeUserRoles([
      ...currentRoles,
      String(data.role ?? ''),
      'SUPER_ADMINISTRADOR',
    ])
    await updateDoc(ref, {
      role: 'SUPER_ADMINISTRADOR',
      roles: nextRoles,
      updatedAt: serverTimestamp(),
    })
  }

  async logout(): Promise<void> {
    await signOut(firebaseAuth)
  }

  async getCurrentUserId(): Promise<string | null> {
    return firebaseAuth.currentUser?.uid ?? null
  }

  observeAuthState(onChange: (userId: string | null) => void): () => void {
    return onAuthStateChanged(firebaseAuth, (user) => {
      onChange(user?.uid ?? null)
    })
  }

  async createManagedUser(
    input: CreateManagedUserInput,
  ): Promise<CreateManagedUserResult> {
    const email = input.email.trim().toLowerCase()
    const displayName = input.displayName.trim()
    const role = input.role.trim()
    const dni = String(input.dni ?? '').replace(/\D/g, '')
    const temporaryPassword = DEFAULT_TEMPORARY_PASSWORD

    if (!email || !displayName) {
      throw new DomainError('Nombre y correo o DNI son obligatorios')
    }

    try {
      const userId = await withSecondaryAuth(async (auth) => {
        try {
          const created = await createUserWithEmailAndPassword(
            auth,
            email,
            temporaryPassword,
          )
          await updateProfile(created.user, { displayName })
          return created.user.uid
        } catch (error) {
          const code = readErrorCode(error)
          if (code !== 'auth/email-already-in-use') {
            throw mapAuthError(error)
          }
          // Reutilizar Auth huérfano si aún tiene la clave temporal.
          try {
            const reused = await signInWithEmailAndPassword(
              auth,
              email,
              temporaryPassword,
            )
            await updateProfile(reused.user, { displayName }).catch(() => undefined)
            return reused.user.uid
          } catch {
            throw new DomainError(
              'Ese correo ya existe en Authentication con otra clave. En Firebase Console → Authentication elimínalo o restablécelo, y vuelve a sincronizar.',
            )
          }
        }
      })

      const roles = normalizeUserRoles([role])
      const primary = primaryUserRole(roles) ?? role
      await setDoc(doc(firestoreDb, 'users', userId), {
        email,
        displayName,
        dni: dni || '',
        role: primary,
        roles,
        theme: ThemePreference.Light,
        mustChangePassword: true,
        loginSecret: temporaryPassword,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      if (dni) {
        await setDoc(doc(firestoreDb, 'loginByDni', dni), {
          email,
          userId,
        })
      }

      return { userId, temporaryPassword }
    } catch (error) {
      if (error instanceof DomainError) throw error
      throw mapAuthError(error)
    }
  }

  async updateManagedUserDisplayName(
    input: UpdateManagedUserDisplayNameInput,
  ): Promise<void> {
    const userId = input.userId.trim()
    const displayName = input.displayName.trim()
    if (!userId || !displayName) {
      throw new DomainError('Nombre inválido')
    }

    const ref = doc(firestoreDb, 'users', userId)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      throw new DomainError('Usuario no encontrado')
    }

    await updateDoc(ref, {
      displayName,
      updatedAt: serverTimestamp(),
    })

    const email = String(snap.data()?.email ?? '')
      .trim()
      .toLowerCase()
    const secret = String(
      snap.data()?.loginSecret ?? DEFAULT_TEMPORARY_PASSWORD,
    )
    if (!email) return

    try {
      await withSecondaryAuth(async (auth) => {
        const session = await signInWithEmailAndPassword(auth, email, secret)
        await updateProfile(session.user, { displayName })
      })
    } catch {
      // El nombre en Firestore ya quedó; Auth puede quedar desfasado.
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const currentUser = firebaseAuth.currentUser
    if (!currentUser) {
      throw new DomainError('No hay sesión activa para cambiar la contraseña')
    }

    try {
      await updatePassword(currentUser, newPassword)
    } catch (error) {
      throw mapAuthError(error)
    }
  }

  async resetTemporaryPassword(userId: string): Promise<string> {
    const targetId = userId.trim()
    if (!targetId) {
      throw new DomainError('Usuario inválido')
    }
    if (targetId === firebaseAuth.currentUser?.uid) {
      throw new DomainError(
        'No puedes restablecer tu propia contraseña desde aquí',
      )
    }

    const ref = doc(firestoreDb, 'users', targetId)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      throw new DomainError('Usuario no encontrado')
    }

    const data = snap.data()
    const email = String(data.email ?? '')
      .trim()
      .toLowerCase()
    if (!email) {
      throw new DomainError('La cuenta no tiene correo de acceso')
    }

    const temporaryPassword = DEFAULT_TEMPORARY_PASSWORD
    const knownSecret = String(data.loginSecret ?? '').trim()
    const candidates = [knownSecret, temporaryPassword].filter(
      (item, index, list) => item && list.indexOf(item) === index,
    )

    try {
      await withSecondaryAuth(async (auth) => {
        let signedIn = false
        for (const candidate of candidates) {
          try {
            await signInWithEmailAndPassword(auth, email, candidate)
            signedIn = true
            break
          } catch {
            // Probar siguiente (máx. 2).
          }
        }
        if (!signedIn || !auth.currentUser) {
          throw new DomainError(
            'No se pudo restablecer la clave de acceso. En Firebase Console → Authentication busca ese usuario, elimínalo, y en Cuentas pulsa “Sincronizar con RR.HH.” para recrearlo con 87654321.',
          )
        }
        await updatePassword(auth.currentUser, temporaryPassword)
      })

      await updateDoc(ref, {
        mustChangePassword: true,
        loginSecret: temporaryPassword,
        updatedAt: serverTimestamp(),
      })

      return temporaryPassword
    } catch (error) {
      if (error instanceof DomainError) throw error
      throw mapAuthError(error)
    }
  }

  async setManagedUserActive(userId: string, active: boolean): Promise<void> {
    const targetId = userId.trim()
    if (!targetId) {
      throw new DomainError('Usuario inválido')
    }
    // Solo Firestore: la app ya bloquea cuentas inactive al iniciar sesión.
    await updateDoc(doc(firestoreDb, 'users', targetId), {
      active,
      updatedAt: serverTimestamp(),
    })
  }

  async deleteManagedUser(userId: string): Promise<void> {
    const targetId = userId.trim()
    if (!targetId) {
      throw new DomainError('Usuario inválido')
    }
    if (targetId === firebaseAuth.currentUser?.uid) {
      throw new DomainError('No puedes eliminar tu propia cuenta')
    }

    const ref = doc(firestoreDb, 'users', targetId)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      throw new DomainError('Usuario no encontrado')
    }

    const data = snap.data()
    const email = String(data.email ?? '')
      .trim()
      .toLowerCase()
    const dni = String(data.dni ?? '').replace(/\D/g, '')
    const knownSecret = String(data.loginSecret ?? '').trim()

    // Intento opcional de borrar Auth solo si conocemos la clave (sin spam 400).
    if (email && knownSecret) {
      try {
        await withSecondaryAuth(async (auth) => {
          const session = await signInWithEmailAndPassword(
            auth,
            email,
            knownSecret,
          )
          await deleteUser(session.user)
        })
      } catch {
        // Perfil se elimina igual; Auth huérfano no puede entrar por DNI.
      }
    }

    if (/^\d{8}$/.test(dni)) {
      await deleteDoc(doc(firestoreDb, 'loginByDni', dni)).catch(() => undefined)
    }
    await deleteDoc(ref)
  }
}