/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" in the self-contained preview build (npm run build:preview). */
  readonly VITE_PREVIEW?: string;
  /** Default server address, e.g. https://keurkompas-api.example.workers.dev */
  readonly VITE_API_URL?: string;
  /** Default Microsoft app registration (client) ID for OneDrive. */
  readonly VITE_MS_CLIENT_ID?: string;
}
