/** @type {import('next').NextConfig} */
export default {
  assetPrefix: process.env.NEXT_PUBLIC_BASE || undefined,
  outputFileTracingExcludes: { "*": ["./.env.local", ".env.local", "./.env", "./data/**", "./scripts/**", "./docs/**", "./.worktrees/**"] },
};
