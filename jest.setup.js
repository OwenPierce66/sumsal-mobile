// Mock oficial de AsyncStorage para todas las pruebas: el filtro por categorías
// (CategoryHierarchy) lo usa en muchas pantallas. Una prueba puede volver a mockearlo.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
