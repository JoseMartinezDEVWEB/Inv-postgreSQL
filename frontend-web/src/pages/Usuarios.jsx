import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import toast from 'react-hot-toast';
import api from '../services/api';
import { UserPlus, Edit2, Trash2, Key, Users as UsersIcon } from 'lucide-react';

const Usuarios = () => {
  const { user, hasRole } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalPassword, setModalPassword] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    telefono: '',
    rol: 'colaborador',
    limiteColaboradores: ''
  });

  // Verificar que el usuario sea contable
  useEffect(() => {
    if (!hasRole('contable') && !hasRole('administrador')) {
      toast.error('No tienes permisos para acceder a esta página');
      return;
    }
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await api.get('/usuarios/subordinados');
      setUsuarios(response.data.datos || []);
      setError(null);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      setError('Error al cargar los usuarios');
      toast.error('Error al cargar los usuarios');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.email || !formData.password) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      const payload = { ...formData };
      if (hasRole('administrador') && formData.rol === 'contador' && formData.limiteColaboradores !== '' && formData.limiteColaboradores != null) {
        payload.limiteColaboradores = Number(formData.limiteColaboradores);
      } else {
        delete payload.limiteColaboradores;
      }
      await api.post('/usuarios', payload);
      toast.success('Usuario creado exitosamente');
      setModalCrear(false);
      resetForm();
      await cargarUsuarios(true);
    } catch (err) {
      console.error('Error al crear usuario:', err);
      const msg = err.response?.data?.detalles?.[0]?.mensaje || err.response?.data?.mensaje || 'Error al crear usuario';
      toast.error(msg);
    }
  };

  const handleEditarUsuario = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        rol: formData.rol
      };
      if (hasRole('administrador') && usuarioSeleccionado?.rol === 'contador') {
        payload.limiteColaboradores = formData.limiteColaboradores === '' || formData.limiteColaboradores == null
          ? null
          : Number(formData.limiteColaboradores);
      }
      await api.put(`/usuarios/${usuarioSeleccionado._id}`, payload);
      toast.success('Usuario actualizado exitosamente');
      setModalEditar(false);
      resetForm();
      await cargarUsuarios(true);
    } catch (err) {
      console.error('Error al actualizar usuario:', err);
      const msg = err.response?.data?.detalles?.[0]?.mensaje || err.response?.data?.mensaje || 'Error al actualizar usuario';
      toast.error(msg);
    }
  };

  const handleCambiarPassword = async (e) => {
    e.preventDefault();
    
    if (!formData.password || formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      await api.patch(`/usuarios/${usuarioSeleccionado._id}/password`, {
        password: formData.password
      });
      toast.success('Contraseña actualizada exitosamente');
      setModalPassword(false);
      resetForm();
      await cargarUsuarios(true);
    } catch (err) {
      console.error('Error al cambiar contraseña:', err);
      toast.error(err.response?.data?.mensaje || 'Error al cambiar contraseña');
    }
  };

  const handleEliminarUsuario = async (usuarioId) => {
    if (!confirm('¿Estás seguro de desactivar este usuario?')) return;

    try {
      await api.delete(`/usuarios/${usuarioId}`);
      toast.success('Usuario desactivado exitosamente');
      await cargarUsuarios(true);
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      toast.error(err.response?.data?.mensaje || 'Error al eliminar usuario');
    }
  };

  const abrirModalEditar = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setFormData({
      nombre: usuario.nombre,
      email: usuario.email,
      telefono: usuario.telefono || '',
      rol: usuario.rol,
      password: '',
      limiteColaboradores: usuario.limiteColaboradores ?? ''
    });
    setModalEditar(true);
  };

  const abrirModalPassword = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setFormData({ ...formData, password: '' });
    setModalPassword(true);
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      email: '',
      password: '',
      telefono: '',
      rol: 'colaborador',
      limiteColaboradores: ''
    });
    setUsuarioSeleccionado(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <UsersIcon className="w-8 h-8" />
            Gestión de Usuarios
          </h1>
          <p className="text-gray-600 mt-2">
            Administra tus contadores y colaboradores
          </p>
        </div>
        <Button
          onClick={() => setModalCrear(true)}
          className="flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Crear Usuario
        </Button>
      </div>

      {error && <ErrorMessage message={error} />}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                {hasRole('administrador') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Límite colab.
                  </th>
                )}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={hasRole('administrador') ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                    No hay usuarios subordinados registrados
                  </td>
                </tr>
              ) : (
                usuarios.map((usuario) => (
                  <tr key={usuario._id || usuario.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {usuario.nombre}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{usuario.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {usuario.telefono || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        usuario.rol === 'contador' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {usuario.rol === 'contador' ? 'Contador' : 'Colaborador'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        usuario.activo 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {hasRole('administrador') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {usuario.rol === 'contador' ? (usuario.limiteColaboradores ?? '—') : '—'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => abrirModalEditar(usuario)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => abrirModalPassword(usuario)}
                          className="text-green-600 hover:text-green-900"
                          title="Cambiar contraseña"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminarUsuario(usuario._id || usuario.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Desactivar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Crear Usuario */}
      <Modal
        isOpen={modalCrear}
        onClose={() => {
          setModalCrear(false);
          resetForm();
        }}
        title="Crear Nuevo Usuario"
      >
        <form onSubmit={handleCrearUsuario} className="space-y-4">
          <Input
            label="Nombre completo *"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
          <Input
            label="Email *"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <Input
            label="Contraseña *"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
          />
          <Input
            label="Teléfono"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol *
            </label>
            <select
              name="rol"
              value={formData.rol}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="colaborador">Colaborador</option>
              <option value="contador">Contador</option>
            </select>
          </div>
          {hasRole('administrador') && formData.rol === 'contador' && (
            <Input
              label="Límite de colaboradores"
              name="limiteColaboradores"
              type="number"
              min="0"
              value={formData.limiteColaboradores}
              onChange={handleChange}
              placeholder="Ej. 3. Vacío = sin límite"
            />
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalCrear(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">
              Crear Usuario
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar Usuario */}
      <Modal
        isOpen={modalEditar}
        onClose={() => {
          setModalEditar(false);
          resetForm();
        }}
        title="Editar Usuario"
      >
        <form onSubmit={handleEditarUsuario} className="space-y-4">
          <Input
            label="Nombre completo *"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
          <Input
            label="Email *"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <Input
            label="Teléfono"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol *
            </label>
            <select
              name="rol"
              value={formData.rol}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="colaborador">Colaborador</option>
              <option value="contador">Contador</option>
            </select>
          </div>
          {hasRole('administrador') && formData.rol === 'contador' && (
            <Input
              label="Límite de colaboradores"
              name="limiteColaboradores"
              type="number"
              min="0"
              value={formData.limiteColaboradores}
              onChange={handleChange}
              placeholder="Ej. 3. Vacío = sin límite"
            />
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalEditar(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">
              Actualizar Usuario
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Cambiar Contraseña */}
      <Modal
        isOpen={modalPassword}
        onClose={() => {
          setModalPassword(false);
          resetForm();
        }}
        title="Cambiar Contraseña"
      >
        <form onSubmit={handleCambiarPassword} className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Cambiar contraseña para: <strong>{usuarioSeleccionado?.nombre}</strong>
          </p>
          <Input
            label="Nueva Contraseña *"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalPassword(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">
              Cambiar Contraseña
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Usuarios;
