module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    "quotes": "off",
    "comma-dangle": "off",
    "max-len": "off",
    "eol-last": "off",
    "no-trailing-spaces": "off",
    "padded-blocks": "off",
    "indent": "off",
    "object-curly-spacing": "off",
    "semi": "off",
  },
  parserOptions: {
    // Required for certain syntax used in functions
    ecmaVersion: 2020,
  },
};