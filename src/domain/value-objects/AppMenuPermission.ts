export const AppMenuKey = {
  Estaciones: 'estaciones',
  Personal: 'personal',
  Roles: 'roles',
  Cargos: 'cargos',
  Localidades: 'localidades',
  Areas: 'areas',
  Tareas: 'tareas',
  Asistencias: 'asistencias',
  Mapa: 'mapa',
  Documentacion: 'documentacion',
  Usuarios: 'usuarios',
  AppMovil: 'app-movil',
} as const

export type AppMenuKey = (typeof AppMenuKey)[keyof typeof AppMenuKey]

export const ALL_APP_MENU_KEYS: AppMenuKey[] = Object.values(AppMenuKey)

export interface AppMenuDefinition {
  key: AppMenuKey
  label: string
  path: string
  module: AppMenuModuleId
}

export const AppMenuModuleId = {
  Campo: 'campo',
  Organizacion: 'organizacion',
  Sistema: 'sistema',
} as const

export type AppMenuModuleId =
  (typeof AppMenuModuleId)[keyof typeof AppMenuModuleId]

export interface AppMenuModule {
  id: AppMenuModuleId
  label: string
  keys: AppMenuKey[]
}

export const APP_MENU_MODULES: AppMenuModule[] = [
  {
    id: AppMenuModuleId.Campo,
    label: 'Campo',
    keys: [
      AppMenuKey.Estaciones,
      AppMenuKey.Areas,
      AppMenuKey.Tareas,
      AppMenuKey.Asistencias,
      AppMenuKey.Mapa,
    ],
  },
  {
    id: AppMenuModuleId.Organizacion,
    label: 'Organización',
    keys: [
      AppMenuKey.Personal,
      AppMenuKey.Roles,
      AppMenuKey.Documentacion,
    ],
  },
  {
    id: AppMenuModuleId.Sistema,
    label: 'Sistema',
    keys: [AppMenuKey.Usuarios, AppMenuKey.AppMovil],
  },
]

export const APP_MENU_DEFINITIONS: AppMenuDefinition[] = [
  {
    key: AppMenuKey.Estaciones,
    label: 'Estaciones',
    path: '/estaciones',
    module: AppMenuModuleId.Campo,
  },
  {
    key: AppMenuKey.Asistencias,
    label: 'Asistencias',
    path: '/asistencias',
    module: AppMenuModuleId.Campo,
  },
  {
    key: AppMenuKey.Mapa,
    label: 'Mapa',
    path: '/mapa',
    module: AppMenuModuleId.Campo,
  },
  {
    key: AppMenuKey.Personal,
    label: 'Personal',
    path: '/personal',
    module: AppMenuModuleId.Organizacion,
  },
  {
    key: AppMenuKey.Roles,
    label: 'Roles',
    path: '/personal/roles',
    module: AppMenuModuleId.Organizacion,
  },
  {
    key: AppMenuKey.Cargos,
    label: 'Cargos',
    path: '/cargos',
    module: AppMenuModuleId.Organizacion,
  },
  {
    key: AppMenuKey.Localidades,
    label: 'Localidades',
    path: '/localidades',
    module: AppMenuModuleId.Organizacion,
  },
  {
    key: AppMenuKey.Areas,
    label: 'Actividades',
    path: '/areas',
    module: AppMenuModuleId.Campo,
  },
  {
    key: AppMenuKey.Tareas,
    label: 'Tareas',
    path: '/tareas',
    module: AppMenuModuleId.Campo,
  },
  {
    key: AppMenuKey.Documentacion,
    label: 'Documentación',
    path: '/documentacion',
    module: AppMenuModuleId.Organizacion,
  },
  {
    key: AppMenuKey.Usuarios,
    label: 'Cuentas app',
    path: '/usuarios',
    module: AppMenuModuleId.Sistema,
  },
  {
    key: AppMenuKey.AppMovil,
    label: 'App móvil',
    path: '/app-movil',
    module: AppMenuModuleId.Sistema,
  },
]

export function appMenuLabel(key: AppMenuKey): string {
  return APP_MENU_DEFINITIONS.find((item) => item.key === key)?.label ?? key
}

export function isAppMenuKey(value: string): value is AppMenuKey {
  return (ALL_APP_MENU_KEYS as readonly string[]).includes(value)
}

export function pathToMenuKey(pathname: string): AppMenuKey | null {
  if (pathname.startsWith('/personal/roles')) return AppMenuKey.Roles
  if (pathname.startsWith('/personal')) return AppMenuKey.Personal
  if (pathname.startsWith('/cargos')) return AppMenuKey.Cargos
  if (pathname.startsWith('/localidades')) return AppMenuKey.Localidades
  if (pathname.startsWith('/estaciones')) return AppMenuKey.Estaciones
  if (pathname.startsWith('/areas') || pathname.startsWith('/carpetas')) {
    return AppMenuKey.Areas
  }
  if (pathname.startsWith('/tareas')) return AppMenuKey.Tareas
  if (pathname.startsWith('/asistencias')) return AppMenuKey.Asistencias
  if (pathname.startsWith('/mapa')) return AppMenuKey.Mapa
  if (pathname.startsWith('/documentacion')) return AppMenuKey.Documentacion
  if (pathname.startsWith('/usuarios')) return AppMenuKey.Usuarios
  if (pathname.startsWith('/app-movil')) return AppMenuKey.AppMovil
  return null
}
