import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db/db";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  socialProviders: {
    // google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },

  }
})