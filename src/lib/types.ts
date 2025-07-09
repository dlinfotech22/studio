import type { Timestamp } from 'firebase/firestore';

export type Transaction = {
  id: string;
  date: Date | Timestamp;
  description: string;
  amount: number;
  type: 'revenue' | 'expense';
  category: string;
  companyId: string;
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
