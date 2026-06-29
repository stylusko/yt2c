import GoogleProvider from 'next-auth/providers/google';

export function isGoogleAuthConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

const configuredSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

export const authOptions = {
  providers: isGoogleAuthConfigured()
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : [],
  session: {
    strategy: 'jwt',
  },
  secret: configuredSecret || (isGoogleAuthConfigured() ? undefined : 'youmeca-auth-disabled-placeholder'),
  callbacks: {
    async session({ session }) {
      return session;
    },
  },
};
