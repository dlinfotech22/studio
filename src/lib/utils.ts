import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

export function formatPhone(value: string) {
  if (!value) return "";
  value = value.replace(/\D/g, ''); 
  value = value.substring(0, 11); 
  if (value.length > 6) {
    value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  } else if (value.length > 2) {
    value = value.replace(/^(\d{2})(\d*)/, '($1) $2');
  } else if (value.length > 0) {
    value = value.replace(/^(\d*)/, '($1');
  }
  return value;
}

export function formatDocument(value: string) {
  if (!value) return "";
  const cleanedValue = value.replace(/\D/g, '');

  if (cleanedValue.length <= 11) {
    // CPF
    return cleanedValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ
    return cleanedValue
      .substring(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
}
