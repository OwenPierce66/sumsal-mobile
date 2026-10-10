const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @tanstack/* declara "react-native": "src/index.ts" (TypeScript sin compilar).
// Con esa fuente, los campos de tipo (getCurrentResult!: ...) de
// InfiniteQueryObserver pisan los metodos heredados y rompen useInfiniteQuery.
// Forzamos el build precompilado (campo "main") para estos paquetes.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@tanstack/')) {
    return context.resolveRequest(
      { ...context, mainFields: ['main'] },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;