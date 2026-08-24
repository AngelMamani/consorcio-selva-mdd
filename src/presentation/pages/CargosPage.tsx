import { NamedCatalogPage } from '@/presentation/pages/NamedCatalogPage'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'

export function CargosPage() {
  const { catalogCargosUseCase } = useDependencies()
  return (
    <NamedCatalogPage
      title="Cargos"
      eyebrow="Personal"
      description="Catálogo de cargos. Se usa en la relación de personal."
      createLabel="Nuevo cargo"
      itemLabel="cargo"
      useCase={catalogCargosUseCase}
    />
  )
}
