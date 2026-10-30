/**
 * utils/mapConfig.js
 *
 * Configuración de la pestaña Mapa: dónde empieza, el zoom al centrarse en la persona y
 * el tema oscuro del mapa.
 */

// Mientras no se conoce la ubicación se muestra México.
export const DEFAULT_REGION = {
  latitude: 23.6345,
  longitude: -102.5528,
  latitudeDelta: 25,
  longitudeDelta: 25,
};

// Zoom al centrarse en la persona (unos 5 km).
export const USER_REGION_DELTA = 0.05;

export const StarLightTheme = [
  {
    featureType: 'all',
    elementType: 'all',
    stylers: [
      {
        invert_lightness: true,
      },
      {
        saturation: 10,
      },
      {
        lightness: 30,
      },
      {
        gamma: 0.5,
      },
      {
        hue: '#00aaff',
      },
    ],
  },
];
