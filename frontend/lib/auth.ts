import {
    betterAuth
} from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import db from "@/lib/db"; // your drizzle instance
import * as schema from "@/lib/schema"; // Your Drizzle schema, adjust if necessary

// Ensure you have these environment variables in your .env.local file
// GOOGLE_CLIENT_ID
// GOOGLE_CLIENT_SECRET
// AUTH_SECRET (generate a strong random string)
// NEXT_PUBLIC_APP_URL (e.g., http://localhost:3000 for development)
// DATABASE_URL (your Neon database connection string)

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL is not set in .env file');
}
if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is not set in .env file');
}
if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID is not set in .env file');
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('GOOGLE_CLIENT_SECRET is not set in .env file');
}
if (!process.env.DATABASE_URL) {
  // This should be caught by drizzle.config.ts or db.ts already, but good to have
  throw new Error('DATABASE_URL is not set in .env file');
}

export const auth = betterAuth({
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!
        }
    },

    database: drizzleAdapter(db, {
        provider: "pg", // or "mysql", "sqlite"
        schema, // Pass your Drizzle schema anmed exports
    }),

    // Core settings
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.NEXT_PUBLIC_APP_URL,

    // Origins allowed to make authenticated requests (for CORS and CSRF protection)
    trustedOrigins: (
      process.env.TRUSTED_ORIGINS ||
      `${process.env.NEXT_PUBLIC_APP_URL},https://www.clippa.in,https://clippa.in`
    )
      .split(/,\s*/)
      .filter(Boolean),

    // Optional: Enable email and password authentication
    emailAndPassword: {
        enabled: true, // Set to false if you only want social logins
    },
    
    // You might need to add the nextCookies plugin if using server actions for auth later
    // plugins: [nextCookies()] // make sure this is the last plugin in the array if used

    // Add any other configurations you need
});

// Export types for convenience if needed elsewhere
// export type AuthSession = typeof auth.$Infer.Session;
// export type AuthUser = typeof auth.$Infer.User;