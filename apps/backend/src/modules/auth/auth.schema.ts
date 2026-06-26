import { z } from "zod";

const password = z.string().min(8).max(72).regex(/[A-Z]/, "Password needs an uppercase letter").regex(/[a-z]/, "Password needs a lowercase letter").regex(/[0-9]/, "Password needs a number");

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    password,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
