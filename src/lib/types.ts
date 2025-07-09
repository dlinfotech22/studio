export type Transaction = {
  id: string;
  date: Date;
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
  companyId: string;
  role: 'admin' | 'user';
};

export type Category = {
  id: string;
  name: string;
  type: 'revenue' | 'expense';
  companyId: string;
};

export type CompanyInfo = {
  name: string;
  document: string; // This is the companyId
  logo?: string; // base64 data URI
};
