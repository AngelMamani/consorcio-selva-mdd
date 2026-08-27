export const AppMenuKey = {
  Inicio: 'inicio',
  Estaciones: 'estaciones',
  Personal: 'personal',
  Roles: 'roles',
  Cargos: 'cargos',
  Localidades: 'localidades',
  Areas: 'areas',
  Tareas: 'tareas',
  Asistencias: 'asistencias',
  Mapa: 'mapa',
  Usuarios: 'usuarios',
  AppMovil: 'app-movil',
  Soporte: 'soporte',
} as const

export const HOME_PATH = '/inicio'

export type AppMenuKey = (typeof AppMenuKey)[keyof typeof AppMenuKey]

export const ALL_APP_MENU_KEYS: AppMenuKey[] = Object.values(AppMenuKey)

export interface AppMenuDefinition {
  key: AppMenuKey
  label: string
  path: string
  module: AppMenuModuleId
}

export const AppMenuModuleId = {
  Panel: 'panel',
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
    id: AppMenuModuleId.Panel,
    label: '',
    keys: [AppMenuKey.Inicio],
  },
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
    keys: [AppMenuKey.Personal, AppMenuKey.Cargos, AppMenuKey.Localidades],
  },
  {
    id: AppMenuModuleId.Sistema,
    label: 'Sistema',
    keys: [AppMenuKey.Roles, AppMenuKey.Usuarios, AppMenuKey.AppMovil, AppMenuKey.Soporte],
  },
]

export const APP_MENU_DEFINITIONS: AppMenuDefinition[] = [
  {
    key: AppMenuKey.Inicio,
    label: 'Inicio',
    path: HOME_PATH,
    module: AppMenuModuleId.Panel,
  },
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
    label: 'Recursos Humanos',
    path: '/recursos-humanos',
    module: AppMenuModuleId.Organizacion,
  },
  {
    key: AppMenuKey.Roles,
    label: 'Roles',
    path: '/roles',
    module: AppMenuModuleId.Sistema,
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
    key: AppMenuKey.Usuarios,
    label: 'Cuentas',
    path: '/usuarios',
    module: AppMenuModuleId.Sistema,
  },
  {
    key: AppMenuKey.AppMovil,
    label: 'App móvil',
    path: '/app-movil',
    module: AppMenuModuleId.Sistema,
  },
  {
    key: AppMenuKey.Soporte,
    label: 'Soporte',
    path: '/soporte',
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
  if (pathname === HOME_PATH || pathname.startsWith(`${HOME_PATH}/`)) {
    return AppMenuKey.Inicio
  }
  if (pathname.startsWith('/roles')) return AppMenuKey.Roles
  if (
    pathname.startsWith('/recursos-humanos') ||
    pathname.startsWith('/personal')
  ) {
    return AppMenuKey.Personal
  }
  if (pathname.startsWith('/cargos')) return AppMenuKey.Cargos
  if (pathname.startsWith('/localidades')) return AppMenuKey.Localidades
  if (pathname.startsWith('/estaciones')) return AppMenuKey.Estaciones
  if (pathname.startsWith('/areas') || pathname.startsWith('/carpetas')) {
    return AppMenuKey.Areas
  }
  if (pathname.startsWith('/tareas')) return AppMenuKey.Tareas
  if (pathname.startsWith('/asistencias')) return AppMenuKey.Asistencias
  if (pathname.startsWith('/mapa')) return AppMenuKey.Mapa
  if (pathname.startsWith('/usuarios')) return AppMenuKey.Usuarios
  if (pathname.startsWith('/app-movil')) return AppMenuKey.AppMovil
  if (pathname.startsWith('/soporte')) return AppMenuKey.Soporte
  return null
}
