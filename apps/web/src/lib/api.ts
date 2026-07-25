function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
}

const API_URL = resolveApiUrl();

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

  categories: (token: string) =>
    request<Category[]>('/api/products/categories', { headers: authHeader(token) }),
  createCategory: (token: string, name: string) =>
    request<Category>('/api/products/categories', {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify({ name }),
    }),

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
  deleteSale: (token: string, id: string) =>
    request<{ id: string }>(`/api/sales/${id}`, { method: 'DELETE', headers: authHeader(token) }),

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
  updateExpense: (token: string, id: string, body: Partial<ExpenseInput>) =>
    request<Expense>(`/api/expenses/${id}`, {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(body),
    }),
  deleteExpense: (token: string, id: string) =>
    request<{ id: string }>(`/api/expenses/${id}`, { method: 'DELETE', headers: authHeader(token) }),

  reports: (token: string, from?: string, to?: string) =>
    request<ReportResponse>(`/api/reports${qs({ from, to })}`, { headers: authHeader(token) }),

  waStatus: (token: string) =>
    request<WaState>('/api/whatsapp/status', { headers: authHeader(token) }),
  waConnect: (token: string) =>
    request<WaState>('/api/whatsapp/connect', { method: 'POST', headers: authHeader(token) }),
  waTest: (token: string, to: string, message: string) =>
    request<unknown>('/api/whatsapp/test', {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify({ to, message }),
    }),
  waLogs: (token: string, limit = 50) =>
    request<WhatsAppLog[]>(`/api/whatsapp/logs?limit=${limit}`, { headers: authHeader(token) }),

  users: (token: string, params?: { role?: string; isActive?: boolean; q?: string }) =>
    request<User[]>(`/api/users${qs(params || {})}`, { headers: authHeader(token) }),
  createUser: (token: string, body: UserInput) =>
    request<User>('/api/users', {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify(body),
    }),
  updateUser: (token: string, id: string, body: Partial<UserInput>) =>
    request<User>(`/api/users/${id}`, {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(body),
    }),
  resetUserPassword: (token: string, id: string, password: string) =>
    request<{ id: string }>(`/api/users/${id}/reset-password`, {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify({ password }),
    }),
  toggleUserActive: (token: string, id: string) =>
    request<User>(`/api/users/${id}/toggle-active`, { method: 'POST', headers: authHeader(token) }),

  stockLogs: (token: string, params?: { productId?: string; type?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    request<{ items: StockLog[]; total: number; page: number; limit: number }>(`/api/stock${qs(params || {})}`, {
      headers: authHeader(token),
    }),
  stockMovements: (token: string) =>
    request<StockMovement[]>(`/api/stock/movements`, { headers: authHeader(token) }),

  customerRequests: (token: string, status?: string) =>
    request<CustomerRequest[]>(`/api/customer-requests${qs({ status })}`, {
      headers: authHeader(token),
    }),
  updateCustomerRequestStatus: (token: string, id: string, status: CustomerRequestStatus) =>
    request<CustomerRequest>(`/api/customer-requests/${id}/status`, {
      method: 'PATCH',
      headers: authHeader(token),
      body: JSON.stringify({ status }),
    }),
  deleteCustomerRequest: (token: string, id: string) =>
    request<{ id: string }>(`/api/customer-requests/${id}`, {
      method: 'DELETE',
      headers: authHeader(token),
    }),

  getSettings: (token: string) =>
    request<Record<string, string>>('/api/settings', { headers: authHeader(token) }),
  updateSettings: (token: string, body: Record<string, string>) =>
    request<Record<string, string>>('/api/settings', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(body),
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

export type WaState = {
  connected: boolean;
  qr: string | null;
  qrDataUrl: string | null;
  connection: string | null;
};

export type WhatsAppLog = {
  id: string;
  type: string;
  to: string | null;
  message: string;
  status: string;
  createdAt: string;
};

export type UserInput = {
  name: string;
  email: string;
  password: string;
  role: 'OWNER' | 'KASIR';
  phone?: string | null;
  isActive?: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'KASIR';
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type StockLog = {
  id: string;
  productId: string;
  type: 'SALE' | 'REFUND' | 'ADJUSTMENT' | 'RESTOCK' | 'CANCEL';
  quantity: number;
  before: number;
  after: number;
  note?: string | null;
  refId?: string | null;
  createdAt: string;
  product?: { id: string; name: string; barcode?: string | null } | null;
};

export type StockMovement = {
  id: string;
  name: string;
  barcode?: string | null;
  stock: number;
  minStock: number;
  totalIn: number;
  totalOut: number;
};

export type CustomerRequestStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';

export type CustomerRequest = {
  id: string;
  name: string;
  phone: string;
  message: string;
  status: CustomerRequestStatus;
  createdAt: string;
  updatedAt: string;
};
