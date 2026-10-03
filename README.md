This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Admin console

The admin console is available at `/admin`. Set `ADMIN_EMAILS` on the server to a comma-separated list of authorized account email addresses. For the requested administrator, use:

```env
ADMIN_EMAILS=bishalm626@gmail.com
```

This value is configured in local `.env.local`. Add the same variable under the Vercel project&apos;s Environment Variables for each deployment environment where admin access is needed, then redeploy. Every admin API request validates the signed-in user&apos;s email against this allowlist.

The console manages users, lost/found items, item categories, claims, matches, AI comparison reports, conversations, and messages. Categories are stored as text on items; renaming a category updates all matching items, while reassigning one moves its items to the selected category. Deleting a user permanently deletes their items and related claims, matches, conversations, and messages.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
