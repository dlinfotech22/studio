export type Transaction = {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'revenue' | 'expense';
  category: string;
};

export type User = {
  id: string;
  username: string;
  password: string;
};

export type Category = {
  id: string;
  name: string;
  type: 'revenue' | 'expense';
};

export type CompanyInfo = {
  name: string;
  document: string; // CNPJ or CPF
  logo?: string; // base64 data URI
};
