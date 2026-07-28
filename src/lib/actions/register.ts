"use server";

import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendAccountConflictEmail, sendVerificationEmail } from "@/lib/email/send";
import { issueVerificationCode } from "@/lib/otp";

type RegisterResult = { error: string } | { error: null };

// Always returns the same generic success shape regardless of whether the email
// was new or already taken, so the response can't be used to enumerate accounts.
const GENERIC_SUCCESS: RegisterResult = { error: null };

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name || !email || !password) {
    return { error: "Fill in every field to continue." };
  }
  if (password.length < 8) {
    return { error: "Password needs at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // Don't reveal that an account exists — notify the real owner instead.
    await sendAccountConflictEmail(email);
    return GENERIC_SUCCESS;
  }

  const passwordHash = await bcryptjs.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  const code = await issueVerificationCode(user.id, "EMAIL_VERIFY");
  if (code) {
    await sendVerificationEmail(email, code);
  }

  return GENERIC_SUCCESS;
}
