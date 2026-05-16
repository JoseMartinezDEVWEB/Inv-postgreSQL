import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Database, Download, Upload, Trash2, RefreshCw, HardDrive, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const formatFecha = (fecha) => {
  return new Date(fecha).toLocaleString('es-GT', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const Respaldo = () => {
  const { hasRole } = useAuth()
  const [backups, setBackups]         = useState([])
  const [cargando, setCargando]       = useState(false)
  const [creando, setCreando]         = useState(false)
  const [importando, setImportando]   = useState(false)
  const [etiqueta, setEtiqueta]       = useState('')
  const [dirBackup, setDirBackup]     = useState('')

  const isElectron = !!window.electronAPI?.backup

  const cargarBackups = useCallback(async () => {
    setCargando(true)
    try {
      let data
      if (isElectron) {
        data = await window.electronAPI.backup.listar()
      } else {
        // Modo web dev: llamar directo a la API
        const token = localStorage.getItem('token')
        const res   = await fetch('/api/backup/listar', {
          headers: { Authorization: `Bearer ${token}` },
        })
        data = await res.json()
      }
      if (data.ok) {
        setBackups(data.backups || [])
        if (data.directorio) setDirBackup(data.directorio)
      }
    } catch (err) {
      toast.error('Error al cargar la lista de respaldos')
    } finally {
      setCargando(false)
    }
  }, [isElectron])

  useEffect(() => {
    cargarBackups()
  }, [cargarBackups])

  const crearBackup = async () => {
    setCreando(true)
    try {
      let data
      if (isElectron) {
        data = await window.electronAPI.backup.crear(etiqueta.trim())
      } else {
        const token = localStorage.getItem('token')
        const res   = await fetch('/api/backup/crear', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body   : JSON.stringify({ etiqueta: etiqueta.trim() }),
        })
        data = await res.json()
      }
      if (data.ok) {
        toast.success(`Respaldo creado: ${data.backup?.nombre}`)
        setEtiqueta('')
        await cargarBackups()
      } else {
        toast.error(data.error || 'Error al crear el respaldo')
      }
    } catch (err) {
      toast.error('Error al crear el respaldo')
    } finally {
      setCreando(false)
    }
  }

  const exportarBackup = async (filename) => {
    if (!isElectron) {
      // En web: descargar como archivo
      const token = localStorage.getItem('token')
      const url   = `/api/backup/descargar/${encodeURIComponent(filename)}`
      const link  = document.createElement('a')
      link.href   = url
      link.setAttribute('download', filename)
      link.setAttribute('Authorization', `Bearer ${token}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      return
    }
    const toastId = toast.loading('Exportando respaldo...')
    try {
      const result = await window.electronAPI.backup.exportar(filename)
      toast.dismiss(toastId)
      if (result.ok) toast.success(`Guardado en: ${result.path}`)
      else if (!result.canceled) toast.error(result.error || 'Error al exportar')
    } catch {
      toast.dismiss(toastId)
      toast.error('Error al exportar el respaldo')
    }
  }

  const eliminarBackup = async (filename) => {
    if (!window.confirm(`¿Eliminar el respaldo "${filename}"? Esta acción no se puede deshacer.`)) return
    try {
      let data
      if (isElectron) {
        data = await window.electronAPI.backup.eliminar(filename)
      } else {
        const token = localStorage.getItem('token')
        const res   = await fetch(`/api/backup/${encodeURIComponent(filename)}`, {
          method : 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        data = await res.json()
      }
      if (data.ok) {
        toast.success('Respaldo eliminado')
        await cargarBackups()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar el respaldo')
    }
  }

  const importarBackup = async () => {
    if (!isElectron) {
      toast.error('La restauración solo está disponible en la app de escritorio.')
      return
    }
    if (!window.confirm(
      '⚠️ ATENCIÓN: Restaurar un respaldo reemplazará TODOS los datos actuales.\n\n' +
      'Se creará un respaldo de seguridad automático antes de restaurar.\n\n' +
      '¿Deseas continuar?'
    )) return

    setImportando(true)
    const toastId = toast.loading('Restaurando respaldo...')
    try {
      const result = await window.electronAPI.backup.importar()
      toast.dismiss(toastId)
      if (result.ok) {
        toast.success(result.mensaje || 'Base de datos restaurada. Recargando...')
        setTimeout(() => window.location.reload(), 2000)
      } else if (!result.canceled) {
        toast.error(result.error || 'Error al restaurar')
      }
    } catch {
      toast.dismiss(toastId)
      toast.error('Error al restaurar el respaldo')
    } finally {
      setImportando(false)
    }
  }

  if (!hasRole('administrador')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Solo los administradores pueden gestionar respaldos.</p>
      </div>
    )
  }

  const backupsManuales   = backups.filter(b => b.tipo === 'manual')
  const backupsAutomaticos = backups.filter(b => b.tipo === 'automatico')

  return (
    <div className="space-y-6">

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-primary-600" />
            Respaldo de Datos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona los respaldos de la base de datos local (SQLite)
          </p>
          {dirBackup && (
            <p className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-lg" title={dirBackup}>
              📁 {dirBackup}
            </p>
          )}
        </div>
        <button
          onClick={cargarBackups}
          disabled={cargando}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Info de auto-backup */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Respaldo automático activo</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Se crea un respaldo automáticamente al iniciar la app y cada 24 horas.
            Se conservan los últimos 30 respaldos.
          </p>
        </div>
      </div>

      {/* Crear respaldo manual */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 p-5"
      >
        <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary-600" />
          Crear Respaldo Manual
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={etiqueta}
            onChange={e => setEtiqueta(e.target.value)}
            placeholder="Etiqueta opcional (ej: antes-de-actualizacion)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            maxLength={40}
            onKeyDown={e => { if (e.key === 'Enter') crearBackup() }}
          />
          <button
            onClick={crearBackup}
            disabled={creando}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {creando
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <CheckCircle className="w-4 h-4" />
            }
            {creando ? 'Creando...' : 'Crear Respaldo'}
          </button>
        </div>
      </motion.div>

      {/* Restaurar desde archivo externo */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Restaurar desde archivo externo</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Importa un archivo .db de respaldo de otra PC. Se creará una copia de seguridad antes de reemplazar los datos.
            </p>
          </div>
        </div>
        <button
          onClick={importarBackup}
          disabled={importando || !isElectron}
          className="ml-4 flex-shrink-0 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {importando ? 'Restaurando...' : 'Importar .db'}
        </button>
      </div>

      {/* Lista de respaldos manuales */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Respaldos Manuales ({backupsManuales.length})
          </h2>
        </div>
        {backupsManuales.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No hay respaldos manuales aún.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {backupsManuales.map(b => (
              <BackupRow key={b.nombre} backup={b} onExportar={exportarBackup} onEliminar={eliminarBackup} />
            ))}
          </ul>
        )}
      </div>

      {/* Lista de respaldos automáticos */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Respaldos Automáticos ({backupsAutomaticos.length})
          </h2>
        </div>
        {backupsAutomaticos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No hay respaldos automáticos aún.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {backupsAutomaticos.map(b => (
              <BackupRow key={b.nombre} backup={b} onExportar={exportarBackup} onEliminar={eliminarBackup} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const BackupRow = ({ backup, onExportar, onEliminar }) => (
  <li className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
    <div className="flex items-center gap-3 min-w-0">
      <Database className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate max-w-md" title={backup.nombre}>
          {backup.nombre}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatFecha(backup.fecha)} &middot; {formatBytes(backup.tamaño)}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
      <button
        onClick={() => onExportar(backup.nombre)}
        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        title="Exportar / Guardar copia"
      >
        <Download className="w-4 h-4" />
      </button>
      <button
        onClick={() => onEliminar(backup.nombre)}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        title="Eliminar respaldo"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </li>
)

export default Respaldo
