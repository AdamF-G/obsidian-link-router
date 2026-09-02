import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  { ignores: ["main.js", "node_modules/"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    plugins: { obsidianmd },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      ...obsidianmd.configs.recommended.rules
    }
  }
);

