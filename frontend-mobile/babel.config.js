module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      // REMOVIDO: 'nativewind/babel' - Causaba conflicto de PostCSS con Metro bundler
      // REMOVIDO: Cualquier referencia a Tailwind CSS
    ],
  };
};



