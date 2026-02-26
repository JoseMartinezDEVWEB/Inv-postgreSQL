const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Plugin de Expo para habilitar cleartext traffic (HTTP) en Android
 * Esto es necesario para conexiones LAN al backend local
 */
const withAndroidCleartextTraffic = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Obtener el elemento application
    const application = androidManifest.manifest.application?.[0];
    
    if (application) {
      // Asegurar que usesCleartextTraffic está habilitado
      application.$['android:usesCleartextTraffic'] = 'true';
      
      // También agregar networkSecurityConfig si no existe
      // Esto permite conexiones HTTP a cualquier servidor
      if (!application.$['android:networkSecurityConfig']) {
        application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
      }
      
      console.log('✅ [Plugin] Cleartext traffic habilitado en AndroidManifest.xml');
    }
    
    return config;
  });
};

module.exports = withAndroidCleartextTraffic;
