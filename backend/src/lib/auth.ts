import { betterAuth } from 'better-auth';
import { bearer, emailOTP } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Resend } from 'resend';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const trustedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()) : []),
];
console.log('[Auth] init:', {
  BETTER_AUTH_SECRET: !!process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? '(default)',
  RESEND_API_KEY: !!process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? '(default)',
  trustedOrigins,
  crossSubDomainCookies: !!process.env.CORS_ORIGINS,
});

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    bearer(),
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        console.log('[Auth] sendVerificationOTP', { email, type });
        const resend = getResend();
        const from = process.env.RESEND_FROM_EMAIL ?? 'SafeSwitch <onboarding@resend.dev>';

        if (resend) {
          try {
            const result = await resend.emails.send({
              from,
              to: email,
              subject: 'Your SafeSwitch sign-in code',
              html: `<p>Your sign-in code is: <strong>${otp}</strong></p><p>This code expires in 5 minutes.</p>`,
            });
            const { data, error } = result;
            if (error) {
              console.error('[Auth] Resend error:', JSON.stringify(error, null, 2));
              console.log('[Auth] OTP fallback (dev):', otp);
            } else {
              console.log('[Auth] OTP email sent via Resend, id:', data?.id);
            }
          } catch (err) {
            console.error('[Auth] Resend exception:', err);
            console.log('[Auth] OTP fallback (dev):', otp);
          }
        } else {
          console.log('[Auth] OTP (no Resend):', otp);
        }
      },
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  basePath: '/api/auth',
  trustedOrigins,
  advanced: process.env.CORS_ORIGINS
    ? {
        useSecureCookies: true,
        crossSubDomainCookies: {
          enabled: true,
          domain: 'up.railway.app',
        },
        defaultCookieAttributes: {
          sameSite: 'none' as const,
          secure: true,
        },
      }
    : undefined,
});
