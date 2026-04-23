import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node, 
      },
    },
    rules: {
      // Code quality
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",           
      "no-undef": "error",

      // Style
      "semi": ["error", "always"],
      "quotes": ["error", "double"],
      "indent": ["error", 2],
      "eol-last": ["error", "always"],
      "no-trailing-spaces": "error",

    
      "no-unused-expressions": "error",
      "consistent-return": "warn",   
    },
  },
  {
    
    ignores: ["node_modules/**", "public/**"],
  },
];
