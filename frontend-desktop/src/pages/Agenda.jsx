import React, { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { sesionesApi } from '../services/api'
import { ChevronLeft, ChevronRight, CalendarDays, Package, CheckCircle, Clock, XCircle } from 'lucide-react'
import Modal, { ModalFooter } from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { Link } from 'react-router-dom'

const pad = (n) => String(n).padStart(2, '0')
const fmtMonthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
const fmtDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

const getTz = () => {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
};

const getEstadoColor = (estado) => {
  switch (estado) {
    case 'completada': return 'success'
    case 'cancelada': return 'danger'
    case 'en_progreso': return 'warning'
    default: return 'info'
  }
}

const getEstadoIcon = (estado) => {
  switch (estado) {
    case 'completada': return <CheckCircle className="w-3 h-3" />
    case 'cancelada': return <XCircle className="w-3 h-3" />
    case 'en_progreso': return <Clock className="w-3 h-3" />
    default: return <Clock className="w-3 h-3" />
  }
}

const getEstadoLabel = (estado) => {
  switch (estado) {
    case 'completada': return 'Completada'
    case 'cancelada': return 'Cancelada'
    case 'en_progreso': return 'En Progreso'
    case 'iniciada': return 'Iniciada'
    default: return estado
  }
}

const getEstadoBadgeStyle = (estado) => {
  switch (estado) {
    case 'completada': return 'bg-green-100 text-green-700 border border-green-200'
    case 'cancelada': return 'bg-red-100 text-red-700 border border-red-200'
    case 'en_progreso': return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
    default: return 'bg-blue-100 text-blue-700 border border-blue-200'
  }
}

const Agenda = () => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [selectedDate, setSelectedDate] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const monthKey = useMemo(() => fmtMonthKey(currentMonth), [currentMonth])

  const { data: resumenData, isLoading: resumenLoading } = useQuery(
    ['agenda-resumen', monthKey],
    () => sesionesApi.getAgendaResumen({ mes: monthKey, tz: getTz() }),
    { select: (res) => res.data.datos }  // backend returns { exito, datos: { resumen } }
  )

  const countsMap = useMemo(() => {
    const map = new Map()
    if (resumenData?.resumen) {
      resumenData.resumen.forEach((r) => map.set(r.fecha, r.total))
    }
    return map
  }, [resumenData])

  const { data: diaData, isLoading: diaLoading } = useQuery(
    ['agenda-dia', selectedDate],
    () => sesionesApi.getAgendaDia({ fecha: selectedDate, tz: getTz() }),
    {
      select: (res) => res.data.datos,
      enabled: !!selectedDate && modalOpen,
      // Refetch cada vez que se abre el modal con una fecha
      staleTime: 0,
    }
  )

  const days = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth() + 1
    const firstWeekday = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()

    const prevMonthDays = firstWeekday
    const totalCells = Math.ceil((prevMonthDays + daysInMonth) / 7) * 7

    const cells = []
    for (let i = 0; i < totalCells; i += 1) {
      const dayNum = i - prevMonthDays + 1
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth
      let dateStr = ''
      if (inMonth) {
        dateStr = fmtDate(year, month, dayNum)
      }
      const count = inMonth ? (countsMap.get(dateStr) || 0) : 0
      cells.push({ inMonth, dayNum: inMonth ? dayNum : '', dateStr, count })
    }
    return cells
  }, [currentMonth, countsMap])

  const goPrev = () => {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() - 1)
    setCurrentMonth(d)
  }
  const goNext = () => {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() + 1)
    setCurrentMonth(d)
  }

  const handleDayClick = (cell) => {
    if (!cell.inMonth) return
    setSelectedDate(cell.dateStr)
    setModalOpen(true)
  }

  // Estilo para cada celda del calendario según si tiene inventarios o no
  const getDayCellStyle = (cell) => {
    if (!cell.inMonth) {
      return 'bg-gray-50 border-gray-100 text-gray-300 cursor-default opacity-60'
    }
    if (cell.count > 0) {
      // Días CON inventarios → verde claro (clicable)
      return 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 cursor-pointer hover:shadow-sm'
    }
    // Días SIN inventarios → amarillo claro (clicable pero sin datos)
    return 'bg-amber-50 border-amber-200 hover:bg-amber-100 cursor-default'
  }

  const getDayNumStyle = (cell) => {
    if (!cell.inMonth) return 'text-gray-300'
    if (cell.count > 0) return 'text-emerald-800 font-semibold'
    return 'text-amber-700'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            <p className="text-gray-600">Calendario de inventarios del mes</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" onClick={goPrev} icon={<ChevronLeft className="w-5 h-5" />} />
          <div className="px-3 py-2 bg-white rounded-lg border text-gray-900 font-semibold">
            {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </div>
          <Button variant="ghost" onClick={goNext} icon={<ChevronRight className="w-5 h-5" />} />
        </div>
      </div>

      {/* Leyenda de colores */}
      <div className="flex items-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></div>
          <span className="text-gray-600">Días con inventarios</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-amber-100 border border-amber-300"></div>
          <span className="text-gray-600">Días sin inventarios</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-4">
        <div className="grid grid-cols-7 gap-2 px-1 pb-2 text-xs font-medium text-gray-500">
          <div className="text-center">Dom</div>
          <div className="text-center">Lun</div>
          <div className="text-center">Mar</div>
          <div className="text-center">Mié</div>
          <div className="text-center">Jue</div>
          <div className="text-center">Vie</div>
          <div className="text-center">Sáb</div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((cell, idx) => (
            <button
              key={idx}
              disabled={!cell.inMonth}
              onClick={() => handleDayClick(cell)}
              className={`relative h-20 rounded-lg border text-left p-2 transition-all duration-150 ${getDayCellStyle(cell)}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm ${getDayNumStyle(cell)}`}>{cell.dayNum}</span>
                {cell.inMonth && cell.count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-medium">
                    {cell.count}
                  </span>
                )}
              </div>
              {cell.inMonth && cell.count > 0 && (
                <div className="mt-1">
                  <div className="flex items-center space-x-1 text-emerald-700">
                    <Package className="w-3 h-3" />
                    <span className="text-xs">{cell.count === 1 ? '1 inv.' : `${cell.count} inv.`}</span>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
        {resumenLoading && (
          <div className="text-center text-sm text-gray-500 py-4 flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
            <span>Cargando calendario...</span>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedDate('')
        }}
        title={`Inventarios del ${selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}`}
        size="lg"
      >
        {diaLoading ? (
          <div className="flex items-center justify-center py-12 space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="text-gray-500">Cargando inventarios...</span>
          </div>
        ) : diaData?.sesiones?.length ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-500 mb-4">
              {diaData.sesiones.length} {diaData.sesiones.length === 1 ? 'inventario' : 'inventarios'} encontrados
            </div>
            {diaData.sesiones.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {s.clienteNegocio?.nombre || 'Cliente desconocido'}
                    </div>
                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getEstadoBadgeStyle(s.estado)}`}>
                      {getEstadoIcon(s.estado)}
                      <span>{getEstadoLabel(s.estado)}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Sesión #{s.numeroSesion}</span>
                    {s.clienteNegocio?.telefono && (
                      <span>📞 {s.clienteNegocio.telefono}</span>
                    )}
                    {s.totales?.totalProductosContados > 0 && (
                      <span>📦 {s.totales.totalProductosContados} productos</span>
                    )}
                    {s.totales?.valorTotalInventario > 0 && (
                      <span className="text-green-600 font-medium">
                        ${s.totales.valorTotalInventario.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  to={`/inventarios/${s.id}`}
                  onClick={() => setModalOpen(false)}
                  className="ml-4 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Ver detalle
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <CalendarDays className="w-12 h-12 mb-3" />
            <p className="text-base font-medium text-gray-500">No hay inventarios en este día</p>
            <p className="text-sm mt-1">Selecciona otro día del calendario</p>
          </div>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={() => { setModalOpen(false); setSelectedDate('') }}>Cerrar</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default Agenda
