import NextAuth from 'next-auth/next';
import GoogleProvider from 'next-auth/providers/google';

const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId,
      clientSecret,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt' as const,
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.email ?? '';
      }
      return session;
    },
  },
} satisfies Parameters<typeof NextAuth>[0];

