import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dot, underscore, hyphen");

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128);

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const bootstrapSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(120),
});

export const schoolProfileSchema = z.object({
  name: z.string().trim().min(2).max(200),
  motto: z.string().trim().max(300).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
});

export const academicYearSetupSchema = z.object({
  name: z.string().trim().min(4).max(40),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  terms: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .length(3),
});

export const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(120),
  roleSlug: z.string().min(1),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
