import {
    createAuthClient
} from "better-auth/react";


export const authClient = createAuthClient({
    // Use the current browser origin at runtime to avoid cross-origin issues
    // (falls back to the env variable during SSR/build or in non-browser contexts).
    baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL,
})

export const {
    signIn,
    signOut,
    signUp,
    useSession
} = authClient;