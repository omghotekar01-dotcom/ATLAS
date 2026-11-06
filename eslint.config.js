import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/ETH-DEV/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/coverage/**",
      "**/.cache/**",
      "**/.snapshots/**",
      "**/.audit/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
