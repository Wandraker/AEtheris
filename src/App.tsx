import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  LoaderCircle,
  Map,
  ScrollText,
  Server,
  X,
} from 'lucide-react'

type Panel = 'map' | 'rules' | 'faq' | 'recipes' | 'connect' | null
type ServiceState = 'operational' | 'degraded' | 'downtime' | 'maintenance' | 'not_monitored' | 'unknown'

type BetterStackResource = {
  id?: string
  type?: string
  attributes?: {
    public_name?: string
    name?: string
    status?: string
    availability?: number
    status_page_section_id?: string | number
  }
}

type BetterStackPayload = {
  data?: {
    attributes?: {
      aggregate_state?: string
      updated_at?: string
    }
  }
  included?: BetterStackResource[]
}

const STATUS_JSON_URL = 'https://status.hyprr.space/index.json'

const panelTitles: Record<Exclude<Panel, null>, string> = {
  map: 'Онлайн-карта',
  rules: 'Правила',
  faq: 'ЧаВо',
  recipes: 'Рецепты',
  connect: 'Подключение',
}

const statusLabels: Record<ServiceState, string> = {
  operational: 'Работает',
  degraded: 'Есть проблемы',
  downtime: 'Есть недоступность',
  maintenance: 'Техработы',
  not_monitored: 'Не отслеживается',
  unknown: 'Нет данных',
}

function normalizeStatus(value?: string): ServiceState {
  switch (value?.toLowerCase()) {
    case 'operational':
      return 'operational'
    case 'degraded':
      return 'degraded'
    case 'downtime':
      return 'downtime'
    case 'maintenance':
      return 'maintenance'
    case 'not_monitored':
      return 'not_monitored'
    default:
      return 'unknown'
  }
}

function sectionLabel(name?: string) {
  if (!name) return null

  const match = name.match(/Nodes\s+—\s+([^〔]+)/i)
  return match?.[1]?.trim() || name.trim()
}

function severityOf(state: ServiceState) {
  switch (state) {
    case 'downtime':
      return 3
    case 'degraded':
    case 'maintenance':
      return 2
    case 'not_monitored':
    case 'unknown':
      return 1
    default:
      return 0
  }
}

function App() {
  const [panel, setPanel] = useState<Panel>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [hostStatus, setHostStatus] = useState<ServiceState>('unknown')
  const [laneStatus, setLaneStatus] = useState<ServiceState>('unknown')
  const [nodeRegion, setNodeRegion] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<'java' | 'bedrock-address' | 'bedrock-port' | null>(null)

  useEffect(() => {
    if (!panel) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [panel])

  useEffect(() => {
    if (!statusOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStatusOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [statusOpen])

  useEffect(() => {
    let active = true

    const loadStatus = async () => {
      try {
        const response = await fetch(STATUS_JSON_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error('Status request failed')

        const payload = (await response.json()) as BetterStackPayload
        if (!active) return

        const nextHostStatus = normalizeStatus(payload.data?.attributes?.aggregate_state)
        const laneResource = payload.included?.find((resource) => {
          if (resource.type !== 'status_page_resource') return false
          return resource.attributes?.public_name?.trim().toUpperCase().startsWith('DELTA-1') ?? false
        })

        const sectionId = laneResource?.attributes?.status_page_section_id
        const laneSection = payload.included?.find((resource) => {
          if (resource.type !== 'status_page_section') return false
          return sectionId != null && String(resource.id) === String(sectionId)
        })

        setHostStatus(nextHostStatus)
        setLaneStatus(normalizeStatus(laneResource?.attributes?.status))
        setNodeRegion(sectionLabel(laneSection?.attributes?.name))
        setLastUpdated(payload.data?.attributes?.updated_at ?? new Date().toISOString())
        setStatusError(false)
      } catch {
        if (!active) return
        setStatusError(true)
      } finally {
        if (active) setStatusLoading(false)
      }
    }

    void loadStatus()
    const interval = window.setInterval(() => void loadStatus(), 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const indicator = useMemo(() => {
    if (statusLoading) return 'loading'
    if (statusError) return 'unknown'

    const severity = Math.max(severityOf(hostStatus), severityOf(laneStatus))
    if (severity >= 3) return 'down'
    if (severity >= 2) return 'issue'
    if (severity === 1) return 'unknown'
    return 'ok'
  }, [hostStatus, laneStatus, statusError, statusLoading])

  const updatedText = useMemo(() => {
    if (!lastUpdated) return null

    const value = new Date(lastUpdated)
    if (Number.isNaN(value.getTime())) return null

    return value.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [lastUpdated])

  const renderIndicatorIcon = () => {
    if (indicator === 'loading') {
      return <LoaderCircle size={15} className="status-spin" aria-hidden="true" />
    }

    if (indicator === 'ok') {
      return <Check size={15} strokeWidth={2.4} aria-hidden="true" />
    }

    if (indicator === 'unknown') {
      return <CircleHelp size={15} aria-hidden="true" />
    }

    return <AlertTriangle size={15} strokeWidth={2.2} aria-hidden="true" />
  }

  const scrollToMore = () => {
    document.getElementById('more')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const copyConnection = async (
    value: string,
    field: 'java' | 'bedrock-address' | 'bedrock-port',
  ) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }

    setCopiedField(field)
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current))
    }, 1400)
  }

  return (
    <main className="site-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />

      <aside className="status-widget">
        <motion.button
          className={'status-trigger status-trigger-' + indicator}
          type="button"
          aria-expanded={statusOpen}
          aria-controls="status-panel"
          onClick={() => setStatusOpen((value) => !value)}
          whileTap={{ scale: 0.97 }}
        >
          <span className="status-indicator" aria-hidden="true">
            {renderIndicatorIcon()}
          </span>
          <span>STATUS</span>
          <ChevronDown
            size={15}
            className={statusOpen ? 'status-chevron status-chevron-open' : 'status-chevron'}
            aria-hidden="true"
          />
        </motion.button>

        <AnimatePresence>
          {statusOpen && (
            <motion.div
              id="status-panel"
              className="status-panel"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -7, scale: 0.985 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="status-panel-heading">
                <span>hyprr//cloud</span>
                <span className={'status-pill status-' + hostStatus}>{statusLabels[hostStatus]}</span>
              </div>

              <div className="status-divider" />

              <div className="status-service">
                <div>
                  <strong>DELTA-1</strong>
                  <span>{nodeRegion ?? '—'}</span>
                </div>
                <span className={'status-pill status-' + laneStatus}>{statusLabels[laneStatus]}</span>
              </div>

              {statusError && (
                <div className="status-warning">
                  Не удалось получить свежий статус.
                </div>
              )}

              <div className="status-panel-footer">
                <span>{updatedText ? 'Обновлено ' + updatedText : 'Автообновление'}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      <section className="hero-screen">
        <motion.div
          className="home"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.h1
            className="server-name"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08, duration: 0.55 }}
          >
            AEtheris
          </motion.h1>

          <nav className="actions" aria-label="Основные разделы сайта">
            <motion.button
              className="action-card"
              type="button"
              onClick={() => setPanel('map')}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="icon-wrap" aria-hidden="true">
                <Map size={24} strokeWidth={1.8} />
              </span>
              <span>Онлайн-карта</span>
            </motion.button>

            <motion.button
              className="action-card"
              type="button"
              onClick={() => setPanel('rules')}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="icon-wrap" aria-hidden="true">
                <ScrollText size={24} strokeWidth={1.8} />
              </span>
              <span>Правила</span>
            </motion.button>
          </nav>
        </motion.div>

        <motion.button
          className="scroll-cue"
          type="button"
          aria-label="К дополнительным разделам"
          onClick={scrollToMore}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          <span className="scroll-cue-line" aria-hidden="true" />
          <ChevronDown size={18} aria-hidden="true" />
        </motion.button>

        <footer className="site-footer">© 2026 AEtheris. All rights reserved.</footer>
      </section>

      <section id="more" className="secondary-screen" aria-label="Дополнительные разделы">
        <div className="secondary-track" aria-hidden="true">
          <span className="secondary-track-line" />
          <span className="secondary-track-dot secondary-track-dot-one" />
          <span className="secondary-track-dot secondary-track-dot-two" />
          <span className="secondary-track-dot secondary-track-dot-three" />
        </div>

        <div className="secondary-nodes">
          <motion.button
            className="secondary-node secondary-node-left"
            type="button"
            onClick={() => setPanel('faq')}
            initial={{ opacity: 0, x: -28, y: 14 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.45 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ x: 6 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="secondary-node-icon" aria-hidden="true">
              <CircleHelp size={25} strokeWidth={1.7} />
            </span>
            <span className="secondary-node-title">ЧаВо</span>
            <ChevronRight className="secondary-node-arrow" size={18} aria-hidden="true" />
          </motion.button>

          <motion.button
            className="secondary-node secondary-node-right"
            type="button"
            onClick={() => setPanel('recipes')}
            initial={{ opacity: 0, x: 28, y: 14 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.45 }}
            transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ x: -6 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="secondary-node-icon" aria-hidden="true">
              <BookOpen size={25} strokeWidth={1.7} />
            </span>
            <span className="secondary-node-title">Рецепты</span>
            <ChevronRight className="secondary-node-arrow" size={18} aria-hidden="true" />
          </motion.button>

          <motion.button
            className="secondary-node secondary-node-left"
            type="button"
            onClick={() => setPanel('connect')}
            initial={{ opacity: 0, x: -28, y: 14 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.45 }}
            transition={{ delay: 0.16, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ x: 6 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="secondary-node-icon" aria-hidden="true">
              <Server size={25} strokeWidth={1.7} />
            </span>
            <span className="secondary-node-title">Подключение</span>
            <ChevronRight className="secondary-node-arrow" size={18} aria-hidden="true" />
          </motion.button>
        </div>
      </section>

      <AnimatePresence>
        {panel && (
          <motion.div
            className="modal-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setPanel(null)
            }}
          >
            <motion.section
              className={panel === 'connect' ? 'modal modal-connect' : 'modal'}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 390, damping: 30 }}
            >
              <button
                className="close-button"
                type="button"
                aria-label="Закрыть"
                onClick={() => setPanel(null)}
              >
                <X size={20} />
              </button>

              <h2 id="modal-title">{panelTitles[panel]}</h2>

              {panel === 'connect' ? (
                <div className="connection-content">
                  <section className="connection-group">
                    <div className="connection-platform">Java</div>
                    <button
                      className="connection-copy connection-copy-wide"
                      type="button"
                      onClick={() => void copyConnection('31.177.109.245:15124', 'java')}
                    >
                      <span className="connection-value">31.177.109.245:15124</span>
                      <span className={copiedField === 'java' ? 'copy-state copy-state-active' : 'copy-state'}>
                        {copiedField === 'java' ? <Check size={16} /> : <Copy size={16} />}
                        <span>{copiedField === 'java' ? 'Скопировано' : 'Копировать'}</span>
                      </span>
                    </button>
                  </section>

                  <section className="connection-group">
                    <div className="connection-platform">Bedrock</div>
                    <div className="connection-grid">
                      <button
                        className="connection-copy"
                        type="button"
                        onClick={() => void copyConnection('31.177.109.245', 'bedrock-address')}
                      >
                        <span className="connection-label">Адрес</span>
                        <span className="connection-value">31.177.109.245</span>
                        <span className={copiedField === 'bedrock-address' ? 'copy-icon copy-icon-active' : 'copy-icon'}>
                          {copiedField === 'bedrock-address' ? <Check size={16} /> : <Copy size={16} />}
                        </span>
                      </button>

                      <button
                        className="connection-copy"
                        type="button"
                        onClick={() => void copyConnection('15126', 'bedrock-port')}
                      >
                        <span className="connection-label">Порт</span>
                        <span className="connection-value">15126</span>
                        <span className={copiedField === 'bedrock-port' ? 'copy-icon copy-icon-active' : 'copy-icon'}>
                          {copiedField === 'bedrock-port' ? <Check size={16} /> : <Copy size={16} />}
                        </span>
                      </button>
                    </div>
                  </section>
                </div>
              ) : (
                <p>Пока ничего нет</p>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

export default App
