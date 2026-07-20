import { ExpenseCategory, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { env } from '../../config/env.js';
import { notifyLargeExpense } from '../notification/notification.service.js';
import { toNumber } from '../../utils/money.js';

export const expenseSchema = z.object({
  date: z.coerce.date(),
  category: z.nativeEnum(ExpenseCategory),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
});

export async function createExpense(userId: string, input: z.infer<typeof expenseSchema>) {
  const expense = await prisma.expense.create({
    data: {
      date: input.date,
      category: input.category,
      amount: input.amount,
      description: input.description,
      createdById: userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (input.amount >= env.WA_LARGE_EXPENSE_THRESHOLD) {
    void notifyLargeExpense(expense);
  }

  return expense;
}

export async function listExpenses(params: {
  from?: Date;
  to?: Date;
  category?: ExpenseCategory;
  page?: number;
  limit?: number;
}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const where: Prisma.ExpenseWhereInput = {};

  if (params.from || params.to) {
    where.date = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }
  if (params.category) where.category = params.category;

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.count({ where }),
  ]);

  return { items, total, page, limit, totalAmount: items.reduce((s, e) => s + toNumber(e.amount), 0) };
}

export async function getExpense(id: string) {
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!expense) throw new ApiError(404, 'Pengeluaran tidak ditemukan');
  return expense;
}

export async function deleteExpense(id: string) {
  await getExpense(id);
  await prisma.expense.delete({ where: { id } });
  return { id };
}
