import React, { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { sesionesApi } from '../services/api'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
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
    { select: (res) => res.data.datos }
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
    { select: (res) => res.data.datos, enabled: !!selectedDate }
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
              onClick={() => {
                if (cell.inMonth && cell.count > 0) {
                  setSelectedDate(cell.dateStr)
                  setModalOpen(true)
                }
              }}
              className={`relative h-20 rounded-lg border text-left p-2 transition-colors ${
                cell.inMonth
                  ? 'bg-white hover:bg-gray-50 border-gray-200'
                  : 'bg-gray-50 border-gray-100 text-gray-400 cursor-default'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm ${cell.inMonth ? 'text-gray-900' : 'text-gray-400'}`}>{cell.dayNum}</span>
                {cell.inMonth && cell.count > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                    {cell.count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        {resumenLoading && (
          <div className="text-center text-sm text-gray-500 py-4">Cargando...</div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Inventarios del ${selectedDate}`} size="lg">
        {diaLoading ? (
          <div className="text-center text-sm text-gray-500">Cargando...</div>
        ) : diaData?.sesiones?.length ? (
          <div className="space-y-3">
            {diaData.sesiones.map((s) => (
              <div key={s._id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{s.clienteNegocio?.nombre}</div>
                  <div className="text-xs text-gray-500">{s.numeroSesion}</div>
                </div>
                <Link to={`/inventarios/${s._id}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  Ver detalle
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500">No hay inventarios en este día</div>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={() => setModalOpen(false)}>Cerrar</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default Agenda
