
import type { Timestamp } from 'firebase/firestore';

export type TransactionType = 'revenue' | 'expense';
export type TransactionSubtype =
  | 'Prestação de Serviço'
  | 'Venda'
  | 'Serviço + Venda'
  | 'Despesa';

export type PaymentMethod = 'À Vista' | 'Parcelado' | 'A Prazo';
export type TransactionStatus = 'Pago' | 'Pendente' | 'Parcialmente Pago';

export type Installment = {
  installmentNumber: number;
  dueDate: Date | Timestamp;
  amount: number;
  status: 'Paga' | 'Pendente';
};

export type TransactionItem = {
  productId: string;
  productName: string; // Denormalized for easier display
  quantity: number;
  price: number; // Price at the time of transaction
};

export type TransactionServiceItem = {
    serviceId: string;
    serviceName: string; // Denormalized
    price: number; // Price at the time of transaction
};

export type Transaction = {
  id: string;
  sequentialId?: number;
  date: Date | Timestamp;
  description: string;
  amount: number;
  type: TransactionType;
  subtype: TransactionSubtype;
  companyId: string;
  customerId?: string;
  customerName?: string; // Denormalized for easier display
  paymentMethod?: PaymentMethod;
  status?: TransactionStatus;
  installments?: Installment[];
  installmentsCount?: number;
  // Fields for multi-item transactions
  items?: TransactionItem[];
  services?: TransactionServiceItem[];
  serviceAmount?: number; // Kept for backward compatibility or simple services
};

export type User = {
  id: string;
  name: string;
  username: string;
  password: string;
  companyId?: string;
  role: 'system_admin' | 'company_admin' | 'user';
  hasDashboardAccess?: boolean;
};

export type CompanyInfo = {
  id: string; // Document ID from firestore
  name: string;
  document: string; // This is the unique identifier (CNPJ/CPF)
  logo?: string; // public URL from Firebase Storage
  allowedSubtypes?: TransactionSubtype[];
  transactionCounter?: number;
};

export type Product = {
  id: string;
  name: string;
  barcode?: string;
  quantity: number;
  price: number;
  companyId: string;
  minimumStock?: number;
};

export type Service = {
  id: string;
  name: string;
  price: number;
  companyId: string;
};

export type Customer = {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  companyId: string;
};
