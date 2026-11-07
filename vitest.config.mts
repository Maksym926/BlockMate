import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Integration tests read the same EXPO_PUBLIC_SUPABASE_* values as the app (.env.local, gitignored).
export default defineConfig(({ mode }) => ({
  test: { env: loadEnv(mode, process.cwd(), 'EXPO_PUBLIC_') },
}));
