import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'

const UpdateNotification = () => {
  const [updateInfo, setUpdateInfo] = useState(null)

  useEffect(() => {
    // Guard: la función solo existe cuando corre dentro de Electron empaquetado
    if (!window.electronAPI?.onAppUpdate) return

    window.electronAPI.onAppUpdate((info) => {
      setUpdateInfo(info)
    })

    return () => {
      window.electronAPI?.removeAllListeners?.('app-update-available')
    }
  }, [])

  if (!updateInfo) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-10 right-4 z-50 bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-sm"
      >
        <div className="flex items-start gap-3">
          <Download className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Actualización disponible</p>
            <p className="text-xs text-blue-100 mt-0.5">
              {updateInfo.version ? `Versión ${updateInfo.version} lista para instalar.` : 'Una nueva versión está disponible.'}
            </p>
          </div>
          <button
            onClick={() => setUpdateInfo(null)}
            className="text-blue-200 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default UpdateNotification
