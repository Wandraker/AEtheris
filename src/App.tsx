import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Map, ScrollText, X } from 'lucide-react'

type Panel = 'map' | 'rules' | null

const panelTitles: Record<Exclude<Panel, null>, string> = {
  map: 'Онлайн-карта',
  rules: 'Правила',
}

function App() {
  const [panel, setPanel] = useState<Panel>(null)

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

  return (
    <main className="site-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />

      <motion.section
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

        <nav className="actions" aria-label="Разделы сайта">
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
      </motion.section>

      <footer className="site-footer">© 2026 AEtheris. All rights reserved.</footer>

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
              className="modal"
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
              <p>Пока ничего нет</p>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

export default App
