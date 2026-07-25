import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { notifyCustomerRequest } from '../notification/notification.service.js';

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  message: z.string().min(1),
});

export async function createCustomerRequest(input: z.infer<typeof createSchema>) {
  const req = await prisma.customerRequest.create({ data: input });
  void notifyCustomerRequest(input).catch(() => undefined);
  return req;
}

export async function listCustomerRequests(status?: string) {
  return prisma.customerRequest.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCustomerRequest(id: string) {
  const req = await prisma.customerRequest.findUnique({ where: { id } });
  if (!req) throw new ApiError(404, 'Permintaan tidak ditemukan');
  return req;
}

export async function updateStatus(id: string, status: string) {
  const req = await prisma.customerRequest.findUnique({ where: { id } });
  if (!req) throw new ApiError(404, 'Permintaan tidak ditemukan');
  return prisma.customerRequest.update({
    where: { id },
    data: { status: status as never },
  });
}

export async function deleteCustomerRequest(id: string) {
  await getCustomerRequest(id);
  await prisma.customerRequest.delete({ where: { id } });
  return { id };
}
