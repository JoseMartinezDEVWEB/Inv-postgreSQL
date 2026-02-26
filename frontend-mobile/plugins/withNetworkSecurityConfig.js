const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin de Expo para crear el archivo network_security_config.xml
 * Este archivo permite conexiones HTTP (cleartext) a servidores locales
 */
const withNetworkSecurityConfig = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const xmlDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml');
      const xmlPath = path.join(xmlDir, 'network_security_config.xml');
      
      // Crear directorio si no existe
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      
      // Contenido del archivo de configuración de seguridad de red
      const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Permitir tráfico HTTP (cleartext) para conexiones LAN -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;
      
      // Escribir el archivo
      fs.writeFileSync(xmlPath, networkSecurityConfig, 'utf-8');
      
      console.log('✅ [Plugin] network_security_config.xml creado en:', xmlPath);
      
      return config;
    },
  ]);
};

module.exports = withNetworkSecurityConfig;
