import NextAuth from 'next-auth/next';

import { authOptions } from '@/lib/auth';

const handler = (req: NextRequest, res: NextResponse) =>
  NextAuth(req, res, authOptions);

export { handler as GET, handler as POST };

