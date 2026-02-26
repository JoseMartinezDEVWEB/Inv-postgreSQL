#!/usr/bin/env node

/**
 * Script para verificar la conexión con el backend
 * Ejecución: node verificar-backend.js
 */

const http = require('http');
const https = require('https');

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// URLs a verificar
const BACKEND_URL = 'http://192.168.1.10:3001';
const API_ENDPOINT = `${BACKEND_URL}/api/salud`;

console.log(`\n${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}   VERIFICACIÓN DE CONEXIÓN - J4 Pro Mobile${colors.reset}`);
console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);

// Función para hacer petición HTTP
const verificarConexion = (url) => {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const request = client.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
};

// Función para verificar disponibilidad de puerto
const verificarPuerto = (host, puerto) => {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      resolve(false);
    });
    
    socket.connect(puerto, host);
  });
};

// Función principal
const ejecutar = async () => {
  try {
    const host = '192.168.1.10';
    const puerto = 3001;
    
    console.log(`${colors.yellow}1. Verificando conexión de red...${colors.reset}`);
    console.log(`   Host: ${host}:${puerto}`);
    
    // Verificar puerto
    const puertoAbiero = await verificarPuerto(host, puerto);
    
    if (!puertoAbiero) {
      console.log(`   ${colors.red}✗ No se puede conectar al puerto ${puerto}${colors.reset}`);
      console.log(`\n${colors.yellow}Posibles soluciones:${colors.reset}`);
      console.log(`  • Verifica que el backend esté corriendo en http://${host}:${puerto}`);
      console.log(`  • Ejecuta en la carpeta backend: npm run dev`);
      console.log(`  • Verifica que la IP ${host} sea correcta (ejecuta ipconfig)`);
      console.log(`  • Si estás en emulador Android, usa 10.0.2.2 en lugar de ${host}`);
      return;
    }
    
    console.log(`   ${colors.green}✓ Puerto ${puerto} abierto${colors.reset}\n`);
    
    console.log(`${colors.yellow}2. Verificando API de salud...${colors.reset}`);
    console.log(`   Petición GET: ${API_ENDPOINT}`);
    
    const response = await verificarConexion(API_ENDPOINT);
    
    if (response.status === 200) {
      console.log(`   ${colors.green}✓ Respuesta exitosa (HTTP ${response.status})${colors.reset}`);
      console.log(`   ${colors.green}✓ Backend funcionando correctamente${colors.reset}\n`);
      
      console.log(`${colors.yellow}3. Información del backend:${colors.reset}`);
      console.log(`   ${JSON.stringify(response.body, null, 2)}\n`);
    } else {
      console.log(`   ${colors.red}✗ Respuesta con estado ${response.status}${colors.reset}\n`);
      console.log(`   Respuesta: ${JSON.stringify(response.body, null, 2)}\n`);
    }
    
    console.log(`${colors.yellow}4. Configuración recomendada:${colors.reset}`);
    console.log(`   En frontend-mobile/src/services/api.js`);
    console.log(`   const API_BASE_URL = 'http://${host}:${puerto}/api'\n`);
    
    console.log(`${colors.yellow}5. Para emulador Android:${colors.reset}`);
    console.log(`   En frontend-mobile/src/services/api.js`);
    console.log(`   const API_BASE_URL = 'http://10.0.2.2:${puerto}/api'\n`);
    
    console.log(`${colors.green}✓ Verificación completada${colors.reset}\n`);
    
  } catch (error) {
    console.log(`\n${colors.red}✗ Error durante la verificación:${colors.reset}`);
    console.log(`   ${error.message}\n`);
    
    console.log(`${colors.yellow}Soluciones comunes:${colors.reset}`);
    console.log(`  1. Verifica que el backend esté corriendo (npm run dev en carpeta backend/)`);
    console.log(`  2. Verifica que MongoDB esté corriendo`);
    console.log(`  3. Verifica tu conexión de red`);
    console.log(`  4. Verifica que la IP sea correcta (ejecuta ipconfig en PowerShell)`);
    console.log(`  5. Comprueba el firewall de Windows\n`);
  }
};

// Ejecutar
ejecutar();



