/// <reference types="vite/client" />
declare module '*.css';
/** The PostHog project token, or '' when analytics is off; set by app/vite.config.ts. */
declare const __POSTHOG_PROJECT_TOKEN__: string;
