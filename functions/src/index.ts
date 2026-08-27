import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import {
  FieldValue,
  getFirestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onInit, setGlobalOptions } from 'firebase-functions/v2'

setGlobalOptions({ region: 'us-central1', maxInstances: 5 })

const ALLOWED_ROLES = new Set([
  'SUPER_ADMINISTRADOR',
  'ADMINISTRADOR',
  'TECNICO',
])
const CONFIGURED_SUPER_ADMIN_EMAIL = 'amamanim@unamad.edu.pe'
const DEFAULT_TEMPORARY_PASSWORD = '87654321'
const TECHNICIAN_EMAIL_DOMAIN = 'tecnicos.consorcio-selva-mdd.firebaseapp.com'

function technicianLoginEmail(dni: string): string {
  return `${dni}@${TECHNICIAN_EMAIL_DOMAIN}`
}

const callableOptions = {
  region: 'us-central1' as const,
  cors: true,
  invoker: 'public' as const,
}

onInit(() => {
  initializeApp()
})

function actorRoleCodes(actor: Record<string, unknown> | undefined): string[] {
  const fromList = Array.isArray(actor?.roles)
    ? actor.roles.filter((item): item is string => typeof item === 'string')
    : []
  const primary = typeof actor?.role === 'string' ? actor.role : ''
  return [...new Set([...fromList, primary].filter((item) => ALLOWED_ROLES.has(item)))]
}

function isPrivilegedActor(actor: Record<string, unknown> | undefined): boolean {
  const codes = actorRoleCodes(actor)
  return (
    actor?.active === true &&
    (codes.includes('ADMINISTRADOR') || codes.includes('SUPER_ADMINISTRADOR'))
  )
}

function actorIsSuperAdmin(actor: Record<string, unknown> | undefined): boolean {
  return actorRoleCodes(actor).includes('SUPER_ADMINISTRADOR')
}

function isPrivilegedUserData(data: Record<string, unknown> | undefined): boolean {
  const codes = actorRoleCodes(data)
  return (
    codes.includes('ADMINISTRADOR') || codes.includes('SUPER_ADMINISTRADOR')
  )
}

function assertAdmin(actor: Record<string, unknown> | undefined) {
  if (!actor || !isPrivilegedActor(actor)) {
    throw new HttpsError(
      'permission-denied',
      'Solo el administrador puede realizar esta acción',
    )
  }
}

function normalizeDni(value: unknown): string {
  const dni = String(value ?? '').replace(/\D/g, '')
  if (!dni) return ''
  if (!/^\d{8}$/.test(dni)) {
    throw new HttpsError('invalid-argument', 'El DNI debe tener 8 dígitos')
  }
  return dni
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeDisplayName(value: unknown): string {
  return String(value ?? '').trim()
}

function mapAuthAdminError(error: unknown, fallback: string): HttpsError {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : ''

  if (code === 'auth/user-not-found') {
    return new HttpsError(
      'not-found',
      'El usuario no existe en Authentication. Verifica que el UID coincida.',
    )
  }
  if (code === 'auth/email-already-exists') {
    return new HttpsError('already-exists', 'El correo ya está registrado')
  }
  if (code === 'auth/invalid-password' || code === 'auth/weak-password') {
    return new HttpsError(
      'invalid-argument',
      'La contraseña temporal no fue aceptada por Auth',
    )
  }

  const message = error instanceof Error ? error.message : fallback
  return new HttpsError('failed-precondition', message || fallback)
}

export const createManagedUser = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión')
  }

  const db = getFirestore()
  const actorSnap = await db.collection('users').doc(request.auth.uid).get()
  const actor = actorSnap.data() as Record<string, unknown> | undefined
  assertAdmin(actor)

  const displayName = normalizeDisplayName(request.data?.displayName)
  const role = String(request.data?.role ?? '').trim()
  const dni = normalizeDni(request.data?.dni)
  let email = normalizeEmail(request.data?.email)

  if (role === 'TECNICO' && !dni) {
    throw new HttpsError(
      'invalid-argument',
      'El DNI es el código de acceso del técnico',
    )
  }

  if (!email && dni) {
    email = technicianLoginEmail(dni)
  }

  if (!email || !displayName) {
    throw new HttpsError(
      'invalid-argument',
      role === 'TECNICO'
        ? 'Nombre y DNI son obligatorios para el técnico'
        : 'Nombre y correo o DNI son obligatorios',
    )
  }

  if (displayName.length > 120) {
    throw new HttpsError('invalid-argument', 'El nombre es demasiado largo')
  }

  if (!ALLOWED_ROLES.has(role)) {
    throw new HttpsError('invalid-argument', 'Rol inválido')
  }

  if (role === 'SUPER_ADMINISTRADOR' && !actorIsSuperAdmin(actor)) {
    throw new HttpsError(
      'permission-denied',
      'Solo el Super Administrador puede crear otro Super Administrador',
    )
  }

  if (dni) {
    const aliasSnap = await db.collection('loginByDni').doc(dni).get()
    if (aliasSnap.exists) {
      throw new HttpsError('already-exists', 'Ya existe un usuario con ese DNI')
    }
    const byDni = await db
      .collection('users')
      .where('dni', '==', dni)
      .limit(1)
      .get()
    if (!byDni.empty) {
      throw new HttpsError('already-exists', 'Ya existe un usuario con ese DNI')
    }
  }

  if (email) {
    const byEmail = await db
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get()
    if (!byEmail.empty) {
      throw new HttpsError('already-exists', 'El correo ya está registrado')
    }
  }

  const temporaryPassword = DEFAULT_TEMPORARY_PASSWORD
  let userId = ''

  try {
    const created = await getAuth().createUser({
      email,
      password: temporaryPassword,
      displayName,
      disabled: false,
    })
    userId = created.uid
  } catch (error) {
    throw mapAuthAdminError(error, 'No se pudo crear el usuario en Auth')
  }

  try {
    await db.collection('users').doc(userId).set({
      email,
      displayName,
      dni,
      role,
      roles: [role],
      theme: 'light',
      mustChangePassword: true,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    if (dni) {
      await db.collection('loginByDni').doc(dni).set({
        email,
        userId,
      })
    }
  } catch (error) {
    await getAuth()
      .deleteUser(userId)
      .catch(() => undefined)
    const message =
      error instanceof Error ? error.message : 'No se pudo guardar el perfil'
    throw new HttpsError('failed-precondition', message)
  }

  return {
    ok: true,
    userId,
    temporaryPassword,
  }
})

export const resetUserTemporaryPassword = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión')
    }

    const targetUserId = String(request.data?.userId ?? '').trim()
    if (!targetUserId) {
      throw new HttpsError('invalid-argument', 'Falta el usuario a restablecer')
    }

    const db = getFirestore()
    const actorSnap = await db.collection('users').doc(request.auth.uid).get()
    assertAdmin(actorSnap.data() as Record<string, unknown> | undefined)

    if (targetUserId === request.auth.uid) {
      throw new HttpsError(
        'failed-precondition',
        'No puedes restablecer tu propia contraseña desde aquí',
      )
    }

    const targetSnap = await db.collection('users').doc(targetUserId).get()
    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado en Firestore')
    }

    const temporaryPassword = DEFAULT_TEMPORARY_PASSWORD

    try {
      await getAuth().updateUser(targetUserId, {
        password: temporaryPassword,
        disabled: targetSnap.data()?.active === false,
      })
    } catch (error) {
      throw mapAuthAdminError(
        error,
        'No se pudo actualizar la contraseña en Authentication',
      )
    }

    try {
      await db.collection('users').doc(targetUserId).update({
        mustChangePassword: true,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo marcar mustChangePassword'
      throw new HttpsError('failed-precondition', message)
    }

    return {
      ok: true,
      temporaryPassword,
    }
  },
)

export const setManagedUserActive = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión')
    }

    const targetUserId = String(request.data?.userId ?? '').trim()
    const active = request.data?.active === true

    if (!targetUserId) {
      throw new HttpsError('invalid-argument', 'Falta el usuario a actualizar')
    }

    const db = getFirestore()
    const actorSnap = await db.collection('users').doc(request.auth.uid).get()
    const actor = actorSnap.data() as Record<string, unknown> | undefined
    assertAdmin(actor)

    if (targetUserId === request.auth.uid && !active) {
      throw new HttpsError(
        'failed-precondition',
        'No puedes desactivar tu propia cuenta',
      )
    }

    const targetSnap = await db.collection('users').doc(targetUserId).get()
    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado en Firestore')
    }

    const target = targetSnap.data() as Record<string, unknown> | undefined
    if (
      actorRoleCodes(target).includes('SUPER_ADMINISTRADOR') &&
      !actorIsSuperAdmin(actor)
    ) {
      throw new HttpsError(
        'permission-denied',
        'Solo el Super Administrador puede desactivar a otro Super Administrador',
      )
    }

    if (!active && isPrivilegedUserData(target)) {
      const all = await db.collection('users').get()
      const otherAdmins = all.docs.filter((docSnap) => {
        if (docSnap.id === targetUserId) return false
        const data = docSnap.data() as Record<string, unknown>
        return data.active !== false && isPrivilegedUserData(data)
      })
      if (otherAdmins.length === 0) {
        throw new HttpsError(
          'failed-precondition',
          'Debe quedar al menos un administrador activo',
        )
      }
    }

    try {
      if (!active) {
        await getAuth().revokeRefreshTokens(targetUserId)
      }
      await getAuth().updateUser(targetUserId, { disabled: !active })
    } catch (error) {
      throw mapAuthAdminError(
        error,
        'No se pudo actualizar el acceso en Authentication',
      )
    }

    try {
      await db.collection('users').doc(targetUserId).update({
        active,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } catch (error) {
      await getAuth()
        .updateUser(targetUserId, { disabled: active })
        .catch(() => undefined)
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el estado en Firestore'
      throw new HttpsError('failed-precondition', message)
    }

    return { ok: true, active }
  },
)

export const deleteManagedUser = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión')
  }

  const targetUserId = String(request.data?.userId ?? '').trim()
  if (!targetUserId) {
    throw new HttpsError('invalid-argument', 'Falta el usuario a eliminar')
  }
  if (targetUserId === request.auth.uid) {
    throw new HttpsError(
      'failed-precondition',
      'No puedes eliminar tu propia cuenta',
    )
  }

  const db = getFirestore()
  const actorSnap = await db.collection('users').doc(request.auth.uid).get()
  const actor = actorSnap.data() as Record<string, unknown> | undefined
  assertAdmin(actor)

  const targetSnap = await db.collection('users').doc(targetUserId).get()
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Usuario no encontrado en Firestore')
  }

  const target = targetSnap.data() as Record<string, unknown> | undefined
  if (
    actorRoleCodes(target).includes('SUPER_ADMINISTRADOR') &&
    !actorIsSuperAdmin(actor)
  ) {
    throw new HttpsError(
      'permission-denied',
      'Solo el Super Administrador puede eliminar esa cuenta',
    )
  }

  if (isPrivilegedUserData(target)) {
    const all = await db.collection('users').get()
    const otherAdmins = all.docs.filter((docSnap) => {
      if (docSnap.id === targetUserId) return false
      const data = docSnap.data() as Record<string, unknown>
      return data.active !== false && isPrivilegedUserData(data)
    })
    if (otherAdmins.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Debe quedar al menos un administrador activo',
      )
    }
  }

  const dni = String(target?.dni ?? '').replace(/\D/g, '')
  try {
    await getAuth().revokeRefreshTokens(targetUserId).catch(() => undefined)
    await getAuth().deleteUser(targetUserId)
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: string }).code)
        : ''
    if (code !== 'auth/user-not-found') {
      throw mapAuthAdminError(error, 'No se pudo eliminar el usuario en Authentication')
    }
  }

  if (/^\d{8}$/.test(dni)) {
    await db.collection('loginByDni').doc(dni).delete().catch(() => undefined)
  }
  await db.collection('users').doc(targetUserId).delete()

  return { ok: true }
})

export const updateManagedUserDisplayName = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión')
    }

    const targetUserId = String(request.data?.userId ?? '').trim()
    const displayName = normalizeDisplayName(request.data?.displayName)

    if (!targetUserId) {
      throw new HttpsError('invalid-argument', 'Falta el usuario a actualizar')
    }
    if (!displayName) {
      throw new HttpsError('invalid-argument', 'El nombre no puede estar vacío')
    }
    if (displayName.length > 120) {
      throw new HttpsError('invalid-argument', 'El nombre es demasiado largo')
    }

    const db = getFirestore()
    const actorSnap = await db.collection('users').doc(request.auth.uid).get()
    assertAdmin(actorSnap.data() as Record<string, unknown> | undefined)

    const targetSnap = await db.collection('users').doc(targetUserId).get()
    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado en Firestore')
    }

    try {
      await getAuth().updateUser(targetUserId, { displayName })
    } catch (error) {
      throw mapAuthAdminError(
        error,
        'No se pudo actualizar el nombre en Authentication',
      )
    }

    try {
      await db.collection('users').doc(targetUserId).update({
        displayName,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el perfil'
      throw new HttpsError('failed-precondition', message)
    }

    const [foldersSnap, imagesSnap] = await Promise.all([
      db.collection('folders').where('ownerId', '==', targetUserId).get(),
      db
        .collection('folderImages')
        .where('uploadedById', '==', targetUserId)
        .get(),
    ])

    async function commitNamePatches(
      docs: QueryDocumentSnapshot[],
      field: 'ownerName' | 'uploadedByName',
    ) {
      const chunkSize = 400
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = db.batch()
        const slice = docs.slice(i, i + chunkSize)
        for (const docSnap of slice) {
          if (field === 'ownerName') {
            batch.update(docSnap.ref, {
              ownerName: displayName,
              updatedAt: FieldValue.serverTimestamp(),
            })
          } else {
            batch.update(docSnap.ref, {
              uploadedByName: displayName,
            })
          }
        }
        await batch.commit()
      }
    }

    try {
      await commitNamePatches(foldersSnap.docs, 'ownerName')
      await commitNamePatches(imagesSnap.docs, 'uploadedByName')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudieron sincronizar carpetas e imágenes'
      throw new HttpsError('failed-precondition', message)
    }

    return {
      ok: true,
      userId: targetUserId,
      displayName,
      syncedFolders: foldersSnap.size,
      syncedImages: imagesSnap.size,
    }
  },
)

export const claimConfiguredSuperAdmin = onCall(
  callableOptions,
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión')
    }

    const email = String(request.auth.token.email ?? '')
      .trim()
      .toLowerCase()
    if (email !== CONFIGURED_SUPER_ADMIN_EMAIL) {
      throw new HttpsError(
        'permission-denied',
        'Esta cuenta no está configurada como Super Administrador',
      )
    }

    const db = getFirestore()
    const current = (await db.collection('users').doc(request.auth.uid).get()).data()
    const currentRoles = Array.isArray(current?.roles)
      ? current.roles.filter((item: unknown): item is string => typeof item === 'string')
      : []
    const nextRoles = [
      ...new Set(
        [...currentRoles, String(current?.role ?? ''), 'SUPER_ADMINISTRADOR'].filter(
          (item) => ALLOWED_ROLES.has(item),
        ),
      ),
    ]
    await db.collection('users').doc(request.auth.uid).update({
      role: 'SUPER_ADMINISTRADOR',
      roles: nextRoles,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  },
)

