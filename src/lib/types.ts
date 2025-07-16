import type { Timestamp } from 'firebase/firestore';

export type TransactionType = 'revenue' | 'expense';
export type TransactionSubtype =
  | 'Prestação de Serviço'
  | 'Venda'
  | 'Serviço + Venda'
  | 'Despesa';


export type Transaction = {
  id: string;
  date: Date | Timestamp;
  description: string;
  amount: number;
  type: TransactionType;
  subtype: TransactionSubtype;
  category: string;
  companyId: string;
  productId?: string;
  quantitySold?: number;
};

export type User = {
  id: string;
  name: string;
  username: string;
  password: string;
  companyId?: string;
  role: 'system_admin' | 'company_admin' | 'user';
};

export type Category = {
  id: string;
  name: string;
  type: 'revenue' | 'expense';
  companyId: string;
};

export type CompanyInfo = {
  id: string; // Document ID from firestore
  name: string;
  document: string; // This is the unique identifier (CNPJ/CPF)
  logo?: string; // public URL from Firebase Storage
};

export type Product = {
  id: string;
  name: string;
  barcode?: string;
  quantity: number;
  price: number;
  companyId: string;
};
