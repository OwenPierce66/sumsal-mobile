module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
          alias: {
            // Archivos raíz
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
    ],
  };
};
