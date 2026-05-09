/**
 * Script de prueba: detecta colaborador conectado y le envía inventario
 * Conecta al backend REMOTO (mismo que usa el mobile)
 * Uso: node test-send-inventory.js <usuario> <password>
 */

const { io } = require('socket.io-client');
const https = require('https');

const BACKEND_URL = 'https://appj4-hlqj.onrender.com';
const API_URL = `${BACKEND_URL}/api`;

const usuario = process.argv[2] || 'admin';
const password = process.argv[3] || '';

if (!password) {
  console.error('❌ Uso: node test-send-inventory.js <usuario> <password>');
  process.exit(1);
}

// ─── helpers ────────────────────────────────────────────────────────────────
const jsonPost = (path, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const url = new URL(path, API_URL + '/');
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  };
  const req = https.request(options, res => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON inválido: ' + raw.slice(0, 200))); }
    });
  });
  req.on('error', reject);
  req.write(data);
  req.end();
});

const jsonGet = (path, token) => new Promise((resolve, reject) => {
  const url = new URL(path, API_URL + '/');
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  };
  const req = https.request(options, res => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON inválido: ' + raw.slice(0, 200))); }
    });
  });
  req.on('error', reject);
  req.end();
});

// ─── main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🔐 Iniciando sesión como "${usuario}" en ${API_URL}...`);

  let token;
  try {
    const res = await jsonPost('/auth/login', { nombreUsuario: usuario, password });
    token = res.token || res.data?.token;
    if (!token) throw new Error(JSON.stringify(res));
    console.log(`✅ Login OK — rol: ${res.usuario?.rol || res.data?.usuario?.rol}`);
  } catch (err) {
    console.error('❌ Error en login:', err.message);
    process.exit(1);
  }

  // Obtener productos del backend remoto
  let productos = [];
  try {
    console.log('📦 Obteniendo productos generales...');
    const res = await jsonGet('/productos?limite=5000', token);
    const lista = res.datos || res.productos || res.rows || (Array.isArray(res) ? res : []);
    productos = lista.map(p => ({
      _id: p._id || p.id,
      id: p.id || p._id,
      nombre: p.nombre || '',
      sku: p.sku || '',
      codigoBarras: p.codigoBarras || '',
      codigo_barra: p.codigoBarras || '',
      costo: p.costo || p.costoBase || 0,
      precioVenta: p.precioVenta || 0,
      unidad: p.unidad || 'unidad',
      categoria: p.categoria || 'General',
      descripcion: p.descripcion || ''
    }));
    console.log(`✅ ${productos.length} productos listos para enviar`);
  } catch (err) {
    console.error('❌ Error obteniendo productos:', err.message);
  }

  // Conectar al WebSocket remoto
  console.log(`\n🔌 Conectando al WebSocket remoto: ${BACKEND_URL}`);
  const socket = io(BACKEND_URL, {
    auth: { token, clientType: 'web' },
    transports: ['websocket', 'polling'],
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log(`✅ WebSocket conectado — Socket ID: ${socket.id}`);
    console.log('👂 Esperando colaborador...\n');
    // Pedir conteo actual
    socket.emit('get_online_colaborators');
  });

  socket.on('online_colaboradores_count', (data) => {
    console.log(`📊 Colaboradores activos: ${data.count}`, data.detalles?.map(d => d.nombre) || []);
    if (data.count > 0 && productos.length > 0) {
      enviarInventario(socket, productos, data.count);
    }
  });

  socket.on('colaborador_conectado', (data) => {
    console.log(`\n🟢 COLABORADOR CONECTADO: ${JSON.stringify(data)}`);
    if (productos.length > 0) {
      setTimeout(() => enviarInventario(socket, productos, data.totalColaboradores), 1000);
    } else {
      console.warn('⚠️ Sin productos para enviar');
    }
  });

  socket.on('colaborador_desconectado', (data) => {
    console.log(`🔴 Colaborador desconectado. Activos: ${data.totalColaboradores}`);
  });

  socket.on('sync_finished_ok', (data) => {
    console.log(`\n✅ CONFIRMACIÓN DEL BACKEND:`, data);
    if (data.success) {
      console.log(`🎉 Inventario enviado a ${data.count} colaborador(es)`);
    } else {
      console.log(`❌ Backend dice: ${data.message}`);
    }
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Error de conexión WebSocket:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Desconectado:', reason);
  });

  // Mantener proceso vivo 5 minutos
  setTimeout(() => {
    console.log('\n⏱️ Timeout — cerrando script');
    socket.disconnect();
    process.exit(0);
  }, 5 * 60 * 1000);
})();

function enviarInventario(socket, productos, totalColabs) {
  console.log(`\n📤 Enviando ${productos.length} productos a ${totalColabs} colaborador(es)...`);
  socket.emit('send_inventory', { productos });
  console.log('✅ Evento send_inventory emitido');
}
