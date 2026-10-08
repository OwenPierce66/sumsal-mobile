module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    overrides: [{
      // Solo @tanstack/query-core v5 (src con #privados) necesita estos plugins;
      // aplicarlos a react-native rompe FlatList (this.props undefined).
      test: /node_modules[\\/]@tanstack/,
      plugins: [
        ['@babel/plugin-transform-class-properties', { loose: true }],
        ['@babel/plugin-transform-private-methods', { loose: true }],
        ['@babel/plugin-transform-private-property-in-object', { loose: true }],
      ],
    }],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
          alias: {
            // Archivos raÃ­z
            '@api':     './api',
            '@storage': './secureStorage',
            '@app':     './App',

            // Carpetas
            '@screens':    './screens',
            '@components': './components',
            '@contexts':   './contexts',
            '@hooks':      './hooks',
          },
        },
      ],
      // Reanimated: este plugin SIEMPRE debe ser el Ãºltimo de la lista.
      'react-native-reanimated/plugin',
    ],
  };
};
