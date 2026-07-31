/**
 * Application Configuration
 *
 * Reads the API base URL from Vite environment variables.
 * Set VITE_API_URL in .env.production for deployment.
 *
 * Development:  defaults to http://localhost:8081
 * Production:   set VITE_API_URL=https://api.yourdomain.com
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
