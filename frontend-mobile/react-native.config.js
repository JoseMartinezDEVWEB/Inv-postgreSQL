/**
 * Configuración para React Native CLI / autolinking.
 *
 * Este repo usa `android_backup/` como carpeta Android (prebuild de Expo),
 * por lo que necesitamos indicárselo al CLI para que no falle con:
 * "project.android=null" y "failed to determine Android project configuration".
 */
module.exports = {
  project: {
    android: {
      sourceDir: './android_backup',
    },
    ios: {},
  },
}

