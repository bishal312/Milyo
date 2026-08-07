import { createAuthClient } from "better-auth/react"
export const authClient = createAuthClient({ baseURL: process.env.Next_PUBLIC_APP_URL });
export const { useSession, signIn, signUp, signOut } = authClient;