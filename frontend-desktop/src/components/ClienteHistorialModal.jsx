import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { sesionesApi } from '../services/api' // Ensure this export exists or use axios directly if needed
import Modal from './ui/Modal'
import Table, { StatusBadge } from './ui/Table'
import Button from './ui/Button'
import { Eye, Calendar, FileText, Download } from 'lucide-react'
import ReporteInventarioModal from './ReporteInventarioModal'

const ClienteHistorialModal = ({ isOpen, onClose, cliente }) => {
    const [selectedSesion, setSelectedSesion] = useState(null)
    const [isReporteOpen, setIsReporteOpen] = useState(false)

    // Fetch sessions for this client
    const { data: sesionesData, isLoading } = useQuery(
        ['sesiones-cliente', cliente?._id],
        async () => {
            if (!cliente?._id) return { datos: [] }
            // Assuming endpoint: GET /sesiones/cliente/:id
            const response = await sesionesApi.getByClient(cliente._id)
            return response.data // Adjust based on actual API response structure
        },
        {
            enabled: !!cliente?._id && isOpen,
        }
    )

    const handleOpenReporte = (sesion) => {
        setSelectedSesion(sesion)
        setIsReporteOpen(true)
    }

    const columns = [
        {
            key: 'numeroSesion',
            title: '#',
            render: (value) => <span className="font-mono text-gray-500">#{value}</span>
        },
        {
            key: 'fecha',
            title: 'Fecha',
            render: (value) => (
                <div className="flex items-center text-sm text-gray-700">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    {new Date(value).toLocaleDateString()}
                </div>
            ),
        },
        {
            key: 'totales',
            title: 'Resumen',
            render: (_, row) => {
                const totalProductos = row.totales?.totalProductosContados || row.productosContados?.length || 0;
                const valorTotal = row.totales?.valorTotalInventario || 0;

                return (
                    <div className="text-sm">
                        <div className="font-medium text-gray-900">${valorTotal.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">{totalProductos} productos</div>
                    </div>
                )
            }
        },
        {
            key: 'estado',
            title: 'Estado',
            render: (value) => (
                <StatusBadge
                    status={value}
                    variant={value === 'completada' ? 'success' : value === 'cancelada' ? 'danger' : 'warning'}
                />
            )
        },
        {
            key: 'actions',
            title: 'Ver',
            render: (_, row) => (
                <Button
                    variant="ghost"
                    size="sm"
                    icon={<FileText className="w-4 h-4" />}
                    onClick={() => handleOpenReporte(row)}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                >
                    Reporte
                </Button>
            ),
        },
    ]

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`Historial de Inventarios - ${cliente?.nombre || ''}`}
                size="xl"
            >
                <div className="max-h-[60vh] overflow-y-auto">
                    <Table
                        data={sesionesData?.datos || []}
                        columns={columns}
                        loading={isLoading}
                        emptyMessage="No hay inventarios registrados para este cliente"
                    />
                </div>
                <div className="mt-4 flex justify-end">
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                </div>
            </Modal>

            {/* Report Modal layered on top */}
            {selectedSesion && (
                <ReporteInventarioModal
                    isOpen={isReporteOpen}
                    onClose={() => setIsReporteOpen(false)}
                    sesion={selectedSesion}
                    cliente={cliente}
                />
            )}
        </>
    )
}

export default ClienteHistorialModal
