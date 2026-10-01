/**
 * webpack.config.js
 *
 * Extiende la configuración de Webpack de Expo para agregar los mismos
 * aliases que babel-plugin-module-resolver provee para Metro (móvil).
 *
 * Sin esto, @api, @components, etc. no funcionan en `expo start --web`.
 */

const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Aliases paralelos a los de babel.config.js
  config.resolve.alias = {
    ...config.resolve.alias,

    // Archivos raíz
    '@api':     path.resolve(__dirname, 'api.js'),
    '@storage': path.resolve(__dirname, 'secureStorage.js'),
    '@app':     path.resolve(__dirname, 'App.js'),

    // Carpetas
    '@screens':    path.resolve(__dirname, 'screens'),
    '@components': path.resolve(__dirname, 'components'),
    '@contexts':   path.resolve(__dirname, 'contexts'),
    '@hooks':      path.resolve(__dirname, 'hooks'),
  };

  return config;
};
