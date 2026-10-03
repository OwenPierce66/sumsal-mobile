module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|@sentry/.*|sentry-expo|@tanstack/.*|react-native-reanimated|react-native-gesture-handler|react-native-encrypted-storage)',
  ],
  moduleNameMapper: {
    '^@api$': '<rootDir>/api',
    '^@api/(.*)$': '<rootDir>/api/$1',
    '^@storage$': '<rootDir>/secureStorage',
    '^@storage/(.*)$': '<rootDir>/secureStorage/$1',
    '^@app$': '<rootDir>/App',
    '^@screens/(.*)$': '<rootDir>/screens/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@contexts/(.*)$': '<rootDir>/contexts/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/.expo/'],
  collectCoverageFrom: [
    'utils/**/*.js',
    'hooks/**/*.js',
    '!**/__mocks__/**',
    '!**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html'],
};
