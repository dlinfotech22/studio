export type Transaction = {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'revenue' | 'expense';
  category: string;
};
