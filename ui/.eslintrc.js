module.exports = {
  root: true,
  extends: ['react-app', 'react-app/jest', 'plugin:@typescript-eslint/recommended'],
  overrides: [
    {
      files: ['src/setupProxy.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  rules: {
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always'],
    '@typescript-eslint/no-explicit-any': 'error',
  },
};
