module.exports = {
  root: true,
  env: { browser: true, es2023: true },
  extends: ['airbnb-base', 'plugin:import/errors', 'plugin:import/warnings', 'prettier'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: {
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  overrides: [
    {
      files: ['vite.config.*', '**/*.config.*', 'scripts/**'],
      rules: {
        // Permite usar devDependencies en archivos de configuración
        'import/no-extraneous-dependencies': ['off', { devDependencies: true }],
      },
    },
  ],
};
