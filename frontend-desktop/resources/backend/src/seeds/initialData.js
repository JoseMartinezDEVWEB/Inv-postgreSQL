import Usuario from '../models/Usuario.js'
import ClienteNegocio from '../models/ClienteNegocio.js'
import ProductoGeneral from '../models/ProductoGeneral.js'
import logger from '../utils/logger.js'

export const seedInitialData = () => {
  logger.info('🌱 Iniciando seed de datos...')

  try {
    // Verificar si ya hay usuarios
    const usuariosExistentes = Usuario.buscarActivos()
    
    if (usuariosExistentes.length > 0) {
      logger.info('✅ Datos ya existen, omitiendo seed')
      return
    }

    // Crear usuario administrador
    logger.info('👤 Creando usuario administrador...')
    const admin = Usuario.crear({
      nombreUsuario: 'admin',
      nombre: 'Administrador',
      email: 'admin@j4pro.com',
      password: '123456',
      telefono: '1234567890',
      rol: 'administrador',
      configuracion: {
        inventarioBuscar: true,
        inventarioAuto: true,
        inventarioPreferencia: 'producto_general',
        inventarioNumero: 1,
      },
    })

    // Crear contador de prueba
    logger.info('👤 Creando contador de prueba...')
    const contador = Usuario.crear({
      nombreUsuario: 'contador1',
      nombre: 'Juan Pérez',
      email: 'contador@j4pro.com',
      password: '123456',
      telefono: '0987654321',
      rol: 'contador',
      configuracion: {
        inventarioBuscar: true,
        inventarioAuto: false,
        inventarioPreferencia: 'producto_cliente',
        inventarioNumero: 1,
      },
    })

    // Crear colaborador de prueba
    logger.info('👤 Creando colaborador de prueba...')
    const colaborador = Usuario.crear({
      nombreUsuario: 'colaborador1',
      nombre: 'María García',
      email: 'colaborador@j4pro.com',
      password: '123456',
      telefono: '1122334455',
      rol: 'colaborador',
      contablePrincipalId: contador.id,
    })

    // Crear clientes de prueba
    logger.info('🏪 Creando clientes de prueba...')
    const cliente1 = ClienteNegocio.crear({
      nombre: 'Supermercado El Ahorro',
      telefono: '5551234567',
      direccion: 'Av. Principal #123, Ciudad',
      contadorAsignadoId: contador.id,
      configuracionInventario: {
        habilitado: true,
        buscarProductos: true,
        inventarioAutomatico: false,
        preferenciaInventario: 'general',
        numeroInventario: 1,
      },
      proximaVisita: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      notas: 'Cliente frecuente',
    })

    const cliente2 = ClienteNegocio.crear({
      nombre: 'Tienda Don José',
      telefono: '5559876543',
      direccion: 'Calle Segunda #456, Barrio Centro',
      contadorAsignadoId: contador.id,
      configuracionInventario: {
        habilitado: true,
        buscarProductos: true,
        inventarioAutomatico: true,
        preferenciaInventario: 'cliente',
        numeroInventario: 1,
      },
    })

    // Crear productos generales de prueba
    logger.info('📦 Creando productos generales de prueba...')
    const productos = [
      {
        nombre: 'Arroz 1 lb',
        descripcion: 'Arroz blanco de primera calidad',
        categoria: 'Mercado',
        unidad: 'lb',
        costoBase: 1.25,
        creadoPorId: admin.id,
      },
      {
        nombre: 'Aceite de Cocina 1 Lt',
        descripcion: 'Aceite vegetal refinado',
        categoria: 'Mercado',
        unidad: 'litro',
        costoBase: 2.50,
        creadoPorId: admin.id,
      },
      {
        nombre: 'Azúcar 2 lb',
        descripcion: 'Azúcar refinada',
        categoria: 'Mercado',
        unidad: 'lb',
        costoBase: 1.50,
        creadoPorId: admin.id,
      },
      {
        nombre: 'Frijoles Negros 1 lb',
        descripcion: 'Frijoles negros secos',
        categoria: 'Mercado',
        unidad: 'lb',
        costoBase: 1.00,
        creadoPorId: admin.id,
      },
      {
        nombre: 'Coca Cola 2 Lt',
        descripcion: 'Refresco sabor cola',
        categoria: 'Bebidas',
        unidad: 'litro',
        costoBase: 2.00,
        tipoContenedor: 'caja',
        tieneUnidadesInternas: true,
        unidadesInternas: {
          cantidad: 12,
          nombre: 'Botella 2Lt',
          costoPorUnidad: 2.00,
        },
        creadoPorId: admin.id,
      },
      {
        nombre: 'Leche Entera 1 Lt',
        descripcion: 'Leche pasteurizada entera',
        categoria: 'Alimentos General',
        unidad: 'litro',
        costoBase: 1.80,
        creadoPorId: admin.id,
      },
      {
        nombre: 'Pan Blanco',
        descripcion: 'Pan de molde blanco',
        categoria: 'Alimentos General',
        unidad: 'unidad',
        costoBase: 1.20,
        creadoPorId: admin.id,
      },
      {
        nombre: 'Atún en Lata',
        descripcion: 'Atún en aceite vegetal 140g',
        categoria: 'Enlatados',
        unidad: 'unidad',
        costoBase: 1.50,
        codigoBarras: '7501234567890',
        creadoPorId: admin.id,
      },
      {
        nombre: 'Tomate Rojo',
        descripcion: 'Tomate fresco de huerta',
        categoria: 'Mercado',
        unidad: 'lb',
        costoBase: 0.80,
        tipoPeso: 'lb',
        creadoPorId: admin.id,
      },
      {
        nombre: 'Papel Higiénico 4 Rollos',
        descripcion: 'Papel higiénico doble hoja',
        categoria: 'Desechables',
        unidad: 'paquete',
        costoBase: 3.00,
        creadoPorId: admin.id,
      },
    ]

    productos.forEach(producto => {
      ProductoGeneral.crear(producto)
    })

    logger.info('✅ Seed completado exitosamente')
    logger.info('\n' + '='.repeat(60))
    logger.info('📊 DATOS DE PRUEBA CREADOS')
    logger.info('='.repeat(60))
    logger.info('\n👤 Usuarios creados:')
    logger.info(`   Administrador: admin@j4pro.com / 123456`)
    logger.info(`   Contador:      contador@j4pro.com / 123456`)
    logger.info(`   Colaborador:   colaborador@j4pro.com / 123456`)
    logger.info('\n🏪 Clientes: 2 clientes de prueba')
    logger.info('📦 Productos: 10 productos generales')
    logger.info('='.repeat(60) + '\n')

  } catch (error) {
    logger.error('❌ Error en seed:', error)
    throw error
  }
}

export default seedInitialData
