import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/api-error.js';

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(Role).default('KASIR'),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export async function listUsers(params?: {
  role?: Role;
  isActive?: boolean;
  q?: string;
}) {
  const where: Prisma.UserWhereInput = {};
  if (params?.role) where.role = params.role;
  if (params?.isActive !== undefined) where.isActive = params.isActive;
  if (params?.q) where.OR = [{ name: { contains: params.q } }, { email: { contains: params.q } }];

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
  });
  if (!user) throw new ApiError(404, 'User tidak ditemukan');
  return user;
}

export async function createUser(input: CreateUserInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new ApiError(400, 'Email sudah digunakan');

  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      phone: input.phone || null,
      isActive: input.isActive,
    },
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
  });
}

export async function updateUser(id: string, input: UpdateUserInput) {
  await getUser(id);
  if (input.email) {
    const exists = await prisma.user.findFirst({ where: { email: input.email, NOT: { id } } });
    if (exists) throw new ApiError(400, 'Email sudah digunakan');
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
  });
}

export async function resetPassword(id: string, newPassword: string) {
  await getUser(id);
  if (newPassword.length < 6) throw new ApiError(400, 'Password minimal 6 karakter');
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  return { id };
}

export async function toggleUserActive(id: string) {
  const user = await getUser(id);
  return prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
  });
}
