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
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // ─── Aliases ─────────────────────────────────────────────────────────────────
  // Paralelos a los de babel.config.js
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

  // ─── Stub de módulos nativos incompatibles con webpack ───────────────────────
  //
  // resolve.alias solo reemplaza el punto de entrada del paquete.
  // NormalModuleReplacementPlugin intercepta CUALQUIER import que coincida con
  // el regex — incluyendo sub-rutas internas como:
  //   @sentry/react-native/dist/js/sdk.js
  //   @sentry/react-native/dist/js/touchevents.js
  //   @sentry/react-native/dist/js/wrapper.js
  //
  // Esto evita que webpack intente compilar JSX sin transpilar ni TurboModuleRegistry.
  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(
      /^@sentry\/react-native(\/.*)?$/,
      path.resolve(__dirname, 'sentry.web.stub.js')
    )
  );

  return config;
};
