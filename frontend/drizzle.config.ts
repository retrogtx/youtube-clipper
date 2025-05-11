import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env file');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/schema.ts',
  dbCredentials: {
    url: process.env.DATABASE_URL, 
  }
})
