import { useEffect, useMemo, useState } from 'react'
import type { SupportTicket } from '@/domain/entities/SupportTicket'
import {
  supportTicketKindLabel,
  supportTicketStatusLabel,
} from '@/domain/entities/SupportTicket'
import { DomainError } from '@/domain/errors/DomainError'
import { useAuth } from '@/presentation/providers/AuthProvider'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'
import { SystemOrgNav } from '@/presentation/components/SystemOrgNav'
import { swalError, swalSuccess } from '@/presentation/utils/appSwal'
import './SupportPage.css'

function formatWhen(date: Date): string {
  return date.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function SupportPage() {
  const { user } = useAuth()
  const { listSupportTicketsUseCase, resolveSupportTicketUseCase } =
    useDependencies()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ABIERTO' | 'RESUELTO'>('ABIERTO')
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [reply, setReply] = useState('')

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const result = await listSupportTicketsUseCase.execute(user)
      setTickets(result)
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo cargar el soporte',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const visible = useMemo(() => {
    if (filter === 'all') return tickets
    return tickets.filter((item) => item.status === filter)
  }, [tickets, filter])

  const openCount = tickets.filter((item) => item.status === 'ABIERTO').length

  async function handleResolve(ticket: SupportTicket) {
    if (!user) return
    try {
      const updated = await resolveSupportTicketUseCase.execute(user, {
        ticketId: ticket.id,
        response: reply,
      })
      setTickets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      setReplyingId(null)
      setReply('')
      swalSuccess('Aviso resuelto')
    } catch (err) {
      swalError(
        err instanceof DomainError ? err.message : 'No se pudo resolver',
      )
    }
  }

  return (
    <section className="support-page">
      <header className="page-header">
        <div>
          <p className="support-page__eyebrow">Sistema</p>
          <h2>Soporte</h2>
          <p>
            Sugerencias y problemas que envían los técnicos desde el aplicativo.
            Responde aquí para darles soporte.
          </p>
        </div>
        <SystemOrgNav />
      </header>

      <div className="support-summary">
        <strong>{openCount}</strong>
        <span>aviso{openCount === 1 ? '' : 's'} abierto{openCount === 1 ? '' : 's'}</span>
      </div>

      <div className="support-filters">
        <button
          type="button"
          className={`btn btn--small ${filter === 'ABIERTO' ? 'btn--soft-primary' : 'btn--soft-muted'}`}
          onClick={() => setFilter('ABIERTO')}
        >
          Abiertos
        </button>
        <button
          type="button"
          className={`btn btn--small ${filter === 'RESUELTO' ? 'btn--soft-primary' : 'btn--soft-muted'}`}
          onClick={() => setFilter('RESUELTO')}
        >
          Resueltos
        </button>
        <button
          type="button"
          className={`btn btn--small ${filter === 'all' ? 'btn--soft-primary' : 'btn--soft-muted'}`}
          onClick={() => setFilter('all')}
        >
          Todos
        </button>
      </div>

      <div className="panel">
        {loading ? (
          <p>Cargando avisos...</p>
        ) : visible.length === 0 ? (
          <p>No hay avisos en este filtro.</p>
        ) : (
          <ul className="support-list">
            {visible.map((ticket) => (
              <li key={ticket.id} className="support-card">
                <div className="support-card__meta">
                  <span className={`support-pill support-pill--${ticket.kind.toLowerCase()}`}>
                    {supportTicketKindLabel(ticket.kind)}
                  </span>
                  <span className={`support-pill support-pill--${ticket.status.toLowerCase()}`}>
                    {supportTicketStatusLabel(ticket.status)}
                  </span>
                  <strong>{ticket.createdByName}</strong>
                  <em>{formatWhen(ticket.createdAt)}</em>
                </div>
                <p>{ticket.message}</p>
                {ticket.response ? (
                  <p className="support-card__reply">
                    Respuesta: {ticket.response}
                  </p>
                ) : null}
                {ticket.status === 'ABIERTO' ? (
                  replyingId === ticket.id ? (
                    <div className="support-reply">
                      <textarea
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        maxLength={1000}
                        rows={3}
                        placeholder="Qué le indicas al técnico"
                      />
                      <div className="support-reply__actions">
                        <button
                          type="button"
                          className="btn btn--soft-muted btn--small"
                          onClick={() => {
                            setReplyingId(null)
                            setReply('')
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="btn btn--soft-primary btn--small"
                          onClick={() => void handleResolve(ticket)}
                        >
                          Resolver
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--soft-blue btn--small"
                      onClick={() => {
                        setReplyingId(ticket.id)
                        setReply('')
                      }}
                    >
                      Responder
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
