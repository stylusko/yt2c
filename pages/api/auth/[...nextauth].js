import NextAuth from 'next-auth';
import { authOptions } from '../../../lib/auth-options.js';

export default NextAuth(authOptions);
