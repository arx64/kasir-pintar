const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const json = (await res.json()) as ApiResponse<T> & { errors?: unknown };
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Request gagal');
  }
  return json.data;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function qs(params: Record<string, string | number | boolean | undefined>) {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export const EXPENSE_CATEGORIES = [
  'BAHAN',
  'LISTRIK',
  'AIR',
  'GAJI',
  'TRANSPORT',
  'OPERASIONAL',
  'LAINNYA',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const api = {
  health: () => request<{ status: string; service: string; time: string }>('/health'),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: AppUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  dashboard: (token: string) =>
    request<DashboardResponse>('/api/dashboard', { headers: authHeader(token) }),

  // PRODUCTS
  products: (token: string, params?: { q?: string; categoryId?: string; lowStock?: boolean; page?: number; limit?: number }) =>
    request<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products${qs(params || {})}`, {
      headers: authHeader(token),
    }),
  getProduct: (token: string, id: string) =>
    request<Product>(`/api/products/${id}`, { headers: authHeader(token) }),
  createProduct: (token: string, body: ProductInput) =>
    request<Product>('/api/products', {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify(body),
    }),
  updateProduct: (token: string, id: string, body: Partial<ProductInput>) =>
    request<Product>(`/api/products/${id}`, {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(body),
    }),
  adjustStock: (token: string, id: string, body: { quantity: number; note?: string }) =>
    request<Product>(`/api/products/${id}/adjust-stock`, {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify(body),
    }),
  deleteProduct: (token: string, id: string) =>
    request<{ id: string }>(`/api/products/${id}`, {
      method: 'DELETE',
      headers: authHeader(token),
    }),

  // CATEGORIES
  categories: (token: string) =>
    request<Category[]>('/api/products/categories', { headers: authHeader(token) }),
  createCategory: (token: string, name: string) =>
    request<Category>('/api/products/categories', {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify({ name }),
    }),

  // SALES
  sales: (token: string, params?: { from?: string; to?: string; status?: string }) =>
    request<{ items: Sale[]; total: number; page: number; limit: number }>(`/api/sales${qs(params || {})}`, {
      headers: authHeader(token),
    }),
  getSale: (token: string, id: string) =>
    request<Sale>(`/api/sales/${id}`, { headers: authHeader(token) }),
  generateQris: (
    token: string,
    body: { amount: number; feeType?: 'fixed' | 'percentage'; feeValue?: number }
  ) =>
    request<{ amount: number; qrisString: string; qrImageDataUrl: string; expiresAt: string }>('/api/sales/qris/generate', {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify(body),
    }),
  createSale: (
    token: string,
    body: {
      items: Array<{ productId: string; quantity: number }>;
      paymentMethod: 'CASH' | 'QRIS';
      paidAmount: number;
      discount?: number;
      note?: string;
    }
  ) =>
    request<Sale>('/api/sales', {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify(body),
    }),
  cancelSale: (token: string, id: string) =>
    request<Sale>(`/api/sales/${id}/cancel`, { method: 'POST', headers: authHeader(token) }),
  refundSale: (token: string, id: string) =>
    request<Sale>(`/api/sales/${id}/refund`, { method: 'POST', headers: authHeader(token) }),

  // EXPENSES
  expenses: (token: string, params?: { from?: string; to?: string; category?: string }) =>
    request<{ items: Expense[]; total: number; page: number; limit: number; totalAmount: number }>(`/api/expenses${qs(params || {})}`, {
      headers: authHeader(token),
    }),
  createExpense: (token: string, body: ExpenseInput) =>
    request<Expense>('/api/expenses', {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify(body),
    }),
  deleteExpense: (token: string, id: string) =>
    request<{ id: string }>(`/api/expenses/${id}`, { method: 'DELETE', headers: authHeader(token) }),

  // REPORTS
  reports: (token: string, from?: string, to?: string) =>
    request<ReportResponse>(`/api/reports${qs({ from, to })}`, { headers: authHeader(token) }),

  // WHATSAPP
  waStatus: (token: string) =>
    request<{ connected: boolean; qr: string | null; qrDataUrl: string | null; connection: string | null }>('/api/whatsapp/status', {
      headers: authHeader(token),
    }),
  waConnect: (token: string) =>
    request<{ connected: boolean; qr: string | null; qrDataUrl: string | null; connection: string | null }>('/api/whatsapp/connect', {
      method: 'POST',
      headers: authHeader(token),
    }),
  waTest: (token: string, to: string, message: string) =>
    request<unknown>('/api/whatsapp/test', {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify({ to, message }),
    }),
};

export type ProductInput = {
  name: string;
  barcode?: string | null;
  costPrice: number;
  sellPrice: number;
  stock?: number;
  minStock?: number;
  categoryId?: string | null;
  isActive?: boolean;
};

export type ExpenseInput = {
  date: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'KASIR';
  phone?: string | null;
};

export type Category = {
  id: string;
  name: string;
  _count?: { products: number };
};

export type Product = {
  id: string;
  name: string;
  barcode?: string | null;
  costPrice: number | string;
  sellPrice: number | string;
  stock: number;
  minStock: number;
  categoryId?: string | null;
  category?: Category | null;
  isActive?: boolean;
};

export type SaleItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number | string;
  costPrice: number | string;
  subtotal: number | string;
};

export type Sale = {
  id: string;
  invoiceNo: string;
  cashierId: string;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  paidAmount: number | string;
  changeAmount: number | string;
  paymentMethod: 'CASH' | 'QRIS';
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  note?: string | null;
  createdAt: string;
  items: SaleItem[];
  cashier?: { id: string; name: string };
};

export type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number | string;
  description?: string | null;
  createdBy?: { id: string; name: string };
};

export type DashboardResponse = {
  today: {
    totalTransaksi: number;
    omzet: number;
    pendapatan: number;
    pengeluaran: number;
    profit: number;
  };
  month: {
    totalTransaksi: number;
    omzet: number;
    pendapatan: number;
    pengeluaran: number;
    profit: number;
  };
  topProducts: Array<{ productId: string; name: string; qty: number; omzet: number }>;
  lowStock: Product[];
  chart: Array<{ date: string; omzet: number; pengeluaran: number }>;
};

export type ReportResponse = {
  period: { from: string; to: string; label: string };
  summary: {
    totalTransaksi: number;
    omzet: number;
    cogs: number;
    pendapatan: number;
    pengeluaran: number;
    profit: number;
  };
  sales: Sale[];
  expenses: Expense[];
  topProducts: Array<{ productId: string; name: string; qty: number; omzet: number }>;
};