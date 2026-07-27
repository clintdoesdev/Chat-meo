"use server";

import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";

type RegisterResult = { error: string } | { error: null };

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
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcryptjs.hash(password, 10);
  await prisma.user.create({ data: { name, email, passwordHash } });

  return { error: null };
}
