import { NamedCatalogPage } from '@/presentation/pages/NamedCatalogPage'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'

export function CargosPage() {
  const { catalogCargosUseCase } = useDependencies()
  return (
    <NamedCatalogPage
      title="Cargos"
      eyebrow="Organización"
      description="Catálogo de cargos. Se usa en Recursos Humanos."
      createLabel="Nuevo cargo"
      itemLabel="cargo"
      useCase={catalogCargosUseCase}
    />
  )
}
