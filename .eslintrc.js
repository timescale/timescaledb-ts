module.exports = {
  root: true,
  env: {
    node: true,
    'jest/globals': true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  plugins: ['@typescript-eslint', 'jest'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    'linebreak-style': ['error', 'unix'],
  },
  ignorePatterns: ['dist'],
};
