import Swal from 'sweetalert2'

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 1400,
  timerProgressBar: true,
  animation: false,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer
    toast.onmouseleave = Swal.resumeTimer
  },
})

/** Toast inmediato (no bloquea la UI). */
export function swalSuccess(title: string): void {
  void Toast.fire({
    icon: 'success',
    title,
  })
}

export function swalError(title: string): void {
  void Swal.fire({
    icon: 'error',
    title: 'No se pudo completar',
    text: title,
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#1e88e5',
    animation: false,
  })
}

export async function swalConfirmDelete(options: {
  title?: string
  text: string
}): Promise<boolean> {
  const result = await Swal.fire({
    icon: 'warning',
    title: options.title ?? '¿Eliminar?',
    text: options.text,
    showCancelButton: true,
    focusCancel: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d32f2f',
    cancelButtonColor: '#6b7385',
    reverseButtons: true,
    animation: false,
  })
  return result.isConfirmed
}
