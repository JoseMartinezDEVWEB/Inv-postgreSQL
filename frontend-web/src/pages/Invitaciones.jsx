import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import api, { solicitudesConexionApi } from '../services/api';
import { QrCode, X, Download, Clock, CheckCircle, XCircle, Ban, UserCheck, UserX, Wifi, WifiOff, RefreshCw } from 'lucide-react';

const Invitaciones = () => {
  const { user, hasRole } = useAuth();
  const [invitaciones, setInvitaciones] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [colaboradoresConectados, setColaboradoresConectados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingColaboradores, setLoadingColaboradores] = useState(true);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(true);
  const [modalGenerar, setModalGenerar] = useState(false);
  const [modalQR, setModalQR] = useState(false);
  const [modalProductosOffline, setModalProductosOffline] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [productosOffline, setProductosOffline] = useState([]);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [formData, setFormData] = useState({
    rol: 'colaborador',
    email: '',
    nombre: '',
    expiraEnMinutos: 1440 // 24 horas
  });

  useEffect(() => {
    if (!hasRole('contable') && !hasRole('administrador') && !hasRole('contador')) {
      toast.error('No tienes permisos para acceder a esta página');
      return;
    }
    cargarInvitaciones();
    cargarColaboradores();
    cargarSolicitudesPendientes();
    cargarColaboradoresConectados();
    
    // Polling cada 30 segundos para actualizar solicitudes y conectados
    const interval = setInterval(() => {
      cargarSolicitudesPendientes();
      cargarColaboradoresConectados();
    }, 30000); // Aumentado de 10s a 30s para reducir solicitudes
    
    return () => clearInterval(interval);
  }, []);

  const cargarInvitaciones = async () => {
    try {
      setLoading(true);
      const response = await api.get('/invitaciones/mis-invitaciones');
      setInvitaciones(response.data.datos);
    } catch (err) {
      console.error('Error al cargar invitaciones:', err);
      toast.error('Error al cargar las invitaciones');
    } finally {
      setLoading(false);
    }
  };

  const cargarColaboradores = async () => {
    try {
      setLoadingColaboradores(true);
      const response = await api.get('/invitaciones/colaboradores');
      setColaboradores(response.data.datos);
    } catch (err) {
      console.error('Error al cargar colaboradores:', err);
      toast.error('Error al cargar colaboradores');
    } finally {
      setLoadingColaboradores(false);
    }
  };

  const handleToggleColaborador = async (id) => {
    try {
      const response = await api.patch(`/invitaciones/colaboradores/${id}/toggle`);
      toast.success(response.data.mensaje);
      cargarColaboradores();
    } catch (err) {
      console.error('Error al cambiar estado del colaborador:', err);
      toast.error(err.response?.data?.mensaje || 'Error al cambiar estado');
    }
  };

  const handleMostrarQRColaborador = async (id) => {
    try {
      const response = await api.get(`/invitaciones/colaboradores/${id}/qr`);
      setQrData(response.data.datos);
      setModalQR(true);
    } catch (err) {
      console.error('Error al obtener QR:', err);
      toast.error(err.response?.data?.mensaje || 'Error al obtener QR');
    }
  };

  const cargarSolicitudesPendientes = async () => {
    try {
      setLoadingSolicitudes(true);
      const response = await solicitudesConexionApi.listarPendientes();
      setSolicitudesPendientes(response.data.datos);
    } catch (err) {
      console.error('Error al cargar solicitudes:', err);
    } finally {
      setLoadingSolicitudes(false);
    }
  };

  const cargarColaboradoresConectados = async () => {
    try {
      const response = await solicitudesConexionApi.listarConectados();
      setColaboradoresConectados(response.data.datos);
    } catch (err) {
      console.error('Error al cargar conectados:', err);
    }
  };

  const handleAceptarSolicitud = async (solicitudId) => {
    try {
      await solicitudesConexionApi.aceptar(solicitudId, null);
      toast.success('Colaborador autorizado exitosamente');
      cargarSolicitudesPendientes();
      cargarColaboradoresConectados();
    } catch (err) {
      console.error('Error al aceptar:', err);
      toast.error(err.response?.data?.mensaje || 'Error al aceptar solicitud');
    }
  };

  const handleRechazarSolicitud = async (solicitudId) => {
    if (!confirm('¿Estás seguro de rechazar esta solicitud?')) return;
    
    try {
      await solicitudesConexionApi.rechazar(solicitudId);
      toast.success('Solicitud rechazada');
      cargarSolicitudesPendientes();
    } catch (err) {
      console.error('Error al rechazar:', err);
      toast.error(err.response?.data?.mensaje || 'Error al rechazar solicitud');
    }
  };

  const handleVerProductosOffline = async (solicitudId) => {
    try {
      const response = await solicitudesConexionApi.obtenerProductosOffline(solicitudId);
      setProductosOffline(response.data.datos);
      setSolicitudSeleccionada(solicitudId);
      setModalProductosOffline(true);
    } catch (err) {
      console.error('Error al obtener productos offline:', err);
      toast.error(err.response?.data?.mensaje || 'Error al obtener productos');
    }
  };

  const handleSincronizarProductos = async () => {
    try {
      const temporalIds = productosOffline.map(p => p.temporalId);
      await solicitudesConexionApi.sincronizar(solicitudSeleccionada, temporalIds);
      toast.success(`${temporalIds.length} productos sincronizados exitosamente`);
      setModalProductosOffline(false);
      cargarColaboradoresConectados();
    } catch (err) {
      console.error('Error al sincronizar:', err);
      toast.error(err.response?.data?.mensaje || 'Error al sincronizar');
    }
  };

  const handleGenerarQR = async (e) => {
    e.preventDefault();

    try {
      const response = await api.post('/invitaciones/qr', formData);
      setQrData(response.data.datos);
      setModalGenerar(false);
      setModalQR(true);
      toast.success('Invitación generada exitosamente');
      cargarInvitaciones();
      cargarColaboradores();
    } catch (err) {
      console.error('Error al generar QR:', err);
      toast.error(err.response?.data?.mensaje || 'Error al generar invitación');
    }
  };

  const handleCancelarInvitacion = async (invitacionId) => {
    if (!confirm('¿Estás seguro de cancelar esta invitación?')) return;

    try {
      await api.delete(`/invitaciones/${invitacionId}`);
      toast.success('Invitación cancelada exitosamente');
      cargarInvitaciones();
    } catch (err) {
      console.error('Error al cancelar invitación:', err);
      toast.error(err.response?.data?.mensaje || 'Error al cancelar invitación');
    }
  };

  const handleDescargarQR = () => {
    if (!qrData?.qrDataUrl) return;

    const link = document.createElement('a');
    link.href = qrData.qrDataUrl;
    link.download = `invitacion-${qrData.rol}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR descargado exitosamente');
  };

  const resetForm = () => {
    setFormData({
      rol: 'colaborador',
      email: '',
      nombre: '',
      expiraEnMinutos: 1440 // 24 horas
    });
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      pendiente: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, texto: 'Pendiente' },
      consumida: { color: 'bg-green-100 text-green-800', icon: CheckCircle, texto: 'Consumida' },
      expirada: { color: 'bg-red-100 text-red-800', icon: XCircle, texto: 'Expirada' },
      cancelada: { color: 'bg-gray-100 text-gray-800', icon: Ban, texto: 'Cancelada' }
    };
    
    const badge = badges[estado] || badges.pendiente;
    const Icon = badge.icon;
    
    return (
      <span className={`px-2 py-1 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.texto}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const countColaboradores = (colaboradores || []).filter(c => c.rol === 'colaborador').length
  const limiteColab = user?.limiteColaboradores
  const showLimite = hasRole('contador') && limiteColab != null

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <QrCode className="w-8 h-8" />
            Invitaciones QR
          </h1>
          <p className="text-gray-600 mt-2">
            Genera invitaciones por código QR para vincular usuarios
            {showLimite && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                Colaboradores: {countColaboradores}/{limiteColab}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => setModalGenerar(true)}
          className="flex items-center gap-2"
        >
          <QrCode className="w-5 h-5" />
          Generar Invitación
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre/Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expira
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Consumida Por
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invitaciones.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No hay invitaciones generadas
                  </td>
                </tr>
              ) : (
                invitaciones.map((invitacion) => (
                  <tr key={invitacion._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        invitacion.rol === 'contador' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {invitacion.rol === 'contador' ? 'Contador' : 'Colaborador'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {invitacion.nombre || '-'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {invitacion.email || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getEstadoBadge(invitacion.estado)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invitacion.expiraEn).toLocaleString('es-MX', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invitacion.consumidaPor ? (
                        <div className="text-sm text-gray-900">
                          {invitacion.consumidaPor.nombre}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {invitacion.estado === 'pendiente' && (hasRole('contable') || hasRole('administrador')) && (
                        <button
                          onClick={() => handleCancelarInvitacion(invitacion._id)}
                          className="text-red-600 hover:text-red-900"
                          title="Cancelar invitación"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sección de Solicitudes Pendientes */}
      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-yellow-600" />
            Solicitudes Pendientes
            {solicitudesPendientes.length > 0 && (
              <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
                {solicitudesPendientes.length}
              </span>
            )}
          </h2>
          <p className="text-gray-600 mt-1">
            Autoriza o rechaza las solicitudes de conexión de colaboradores
          </p>
        </div>

        <Card>
          {loadingSolicitudes ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : solicitudesPendientes.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No hay solicitudes pendientes
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Colaborador
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dispositivo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Solicitud
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {solicitudesPendientes.map((solicitud) => (
                    <tr key={solicitud._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {solicitud.colaborador.nombre}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-bold text-violet-600">
                          {solicitud.colaborador.invitacionId?.codigoNumerico || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {solicitud.colaborador.dispositivoInfo?.modelo || 'Desconocido'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {solicitud.colaborador.dispositivoInfo?.sistemaOperativo || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(solicitud.createdAt).toLocaleString('es-MX', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleAceptarSolicitud(solicitud._id)}
                            className="text-green-600 hover:text-green-900 flex items-center gap-1"
                            title="Autorizar"
                          >
                            <UserCheck className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleRechazarSolicitud(solicitud._id)}
                            className="text-red-600 hover:text-red-900 flex items-center gap-1"
                            title="Rechazar"
                          >
                            <UserX className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Sección de Colaboradores Conectados */}
      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wifi className="w-6 h-6 text-green-600" />
            Colaboradores Conectados
          </h2>
          <p className="text-gray-600 mt-1">
            Gestiona los colaboradores autorizados y sincroniza productos offline
          </p>
        </div>

        <Card>
          {colaboradoresConectados.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No hay colaboradores conectados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Colaborador
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Última Conexión
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Productos Offline
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {colaboradoresConectados.map((colab) => (
                    <tr key={colab._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {colab.colaborador.nombre}
                        </div>
                        <div className="text-xs text-gray-500">
                          {colab.colaborador.dispositivoInfo?.modelo || 'Desconocido'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          colab.estadoConexion === 'conectado'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {colab.estadoConexion === 'conectado' ? (
                            <><Wifi className="w-3 h-3 mr-1" /> Conectado</>
                          ) : (
                            <><WifiOff className="w-3 h-3 mr-1" /> Desconectado</>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {colab.ultimaConexion
                          ? new Date(colab.ultimaConexion).toLocaleString('es-MX', {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })
                          : 'Nunca'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {colab.productosOffline?.filter(p => !p.sincronizado).length > 0 ? (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-semibold">
                            {colab.productosOffline.filter(p => !p.sincronizado).length} pendientes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">Sin productos</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {colab.productosOffline?.filter(p => !p.sincronizado).length > 0 && (
                          <button
                            onClick={() => handleVerProductosOffline(colab._id)}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1 ml-auto"
                            title="Sincronizar productos"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Sincronizar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modal Generar Invitación */}
      <Modal
        isOpen={modalGenerar}
        onClose={() => {
          setModalGenerar(false);
          resetForm();
        }}
        title="Generar Nueva Invitación QR"
      >
        <form onSubmit={handleGenerarQR} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol *
            </label>
            <select
              name="rol"
              value={formData.rol}
              onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="colaborador">Colaborador</option>
              <option value="contador">Contador</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Define el rol que tendrá el usuario que escanee este QR
            </p>
          </div>

          <Input
            label="Nombre (opcional)"
            name="nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Nombre del colaborador"
          />

          <Input
            label="Email (opcional)"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@ejemplo.com"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duración de la invitación *
            </label>
            <select
              name="expiraEnMinutos"
              value={formData.expiraEnMinutos}
              onChange={(e) => setFormData({ ...formData, expiraEnMinutos: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="10">10 minutos</option>
              <option value="30">30 minutos</option>
              <option value="60">1 hora</option>
              <option value="120">2 horas</option>
              <option value="1440">24 horas</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Tiempo antes de que expire la invitación
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalGenerar(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">
              Generar QR
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Mostrar QR */}
      <Modal
        isOpen={modalQR}
        onClose={() => {
          setModalQR(false);
          setQrData(null);
        }}
        title="Código QR Generado"
      >
        <div className="text-center space-y-4">
          {qrData && (
            <>
              <div className="bg-white p-4 rounded-lg inline-block">
                <img 
                  src={qrData.qrDataUrl} 
                  alt="Código QR" 
                  className="w-64 h-64 mx-auto"
                />
              </div>
              
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-6 rounded-lg border-2 border-violet-200">
                <h3 className="font-bold text-violet-900 mb-3 text-lg text-center">
                  Código de Acceso
                </h3>
                <div className="bg-white p-4 rounded-lg mb-4">
                  <p className="text-4xl font-mono font-bold text-center text-violet-600 tracking-widest">
                    {qrData.codigoNumerico}
                  </p>
                </div>
                <p className="text-sm text-violet-800 text-center mb-2">
                  Comparte este código de 6 dígitos para acceso rápido
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg text-left">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Información de la invitación:
                </h3>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li><strong>Nombre:</strong> {qrData.nombre || 'Sin especificar'}</li>
                  <li><strong>Rol:</strong> {qrData.rol === 'contador' ? 'Contador' : 'Colaborador'}</li>
                  <li><strong>Expira:</strong> {new Date(qrData.expiraEn).toLocaleString('es-MX')}</li>
                  {qrData.duracionMinutos && <li><strong>Duración:</strong> {qrData.duracionMinutos} minutos</li>}
                </ul>
              </div>

              <div className="text-sm text-gray-600">
                <p>
                  El usuario debe escanear este código QR con la aplicación móvil
                  para vincularse como {qrData.rol === 'contador' ? 'contador' : 'colaborador'}.
                </p>
              </div>

              <div className="flex justify-center gap-2 pt-4">
                <Button
                  onClick={handleDescargarQR}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar QR
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setModalQR(false);
                    setQrData(null);
                  }}
                >
                  Cerrar
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal Productos Offline */}
      <Modal
        isOpen={modalProductosOffline}
        onClose={() => {
          setModalProductosOffline(false);
          setProductosOffline([]);
          setSolicitudSeleccionada(null);
        }}
        title="Productos Offline Pendientes"
      >
        <div className="space-y-4">
          {productosOffline.length === 0 ? (
            <p className="text-center text-gray-500">No hay productos pendientes de sincronización</p>
          ) : (
            <>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>{productosOffline.length} producto(s)</strong> agregado(s) por el colaborador mientras estaba offline.
                  Revisa y sincroniza para agregarlos a la sesión de inventario.
                </p>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {productosOffline.map((item, index) => (
                    <div key={item.temporalId} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900">
                            Producto #{index + 1}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {JSON.stringify(item.productoData).slice(0, 100)}...
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            Agregado: {new Date(item.timestamp).toLocaleString('es-MX')}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          Pendiente
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setModalProductosOffline(false);
                    setProductosOffline([]);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSincronizarProductos}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sincronizar {productosOffline.length} Producto(s)
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Invitaciones;
