
'use client';

import { type Transaction, type Customer, type Product, type CompanyInfo } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Building } from 'lucide-react';

interface PrintableDocumentProps {
  transaction: Transaction | null;
  customer: Customer | undefined;
  product: Product | undefined;
  companyInfo: CompanyInfo | null;
}

export function PrintableDocument({ transaction, customer, product, companyInfo }: PrintableDocumentProps) {
  if (!transaction) return null;

  const getTitle = () => {
    switch(transaction.subtype) {
      case 'Prestação de Serviço': return 'Ordem de Serviço';
      case 'Serviço + Venda': return 'Ordem de Serviço e Venda';
      case 'Venda': return 'Comprovante de Venda';
      default: return 'Documento';
    }
  };

  const hasService = transaction.subtype === 'Prestação de Serviço' || transaction.subtype === 'Serviço + Venda';
  const hasProduct = transaction.subtype === 'Venda' || transaction.subtype === 'Serviço + Venda';

  return (
    <div className="bg-white text-black p-8 font-sans printable-area">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-area, .printable-area * {
              visibility: visible;
            }
            .printable-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            @page {
              size: A4;
              margin: 20mm;
            }
          }
        `}
      </style>
      <header className="flex justify-between items-start pb-4 border-b border-gray-300">
        <div className="flex items-center gap-4">
          {companyInfo?.logo && (
            <Avatar className="h-16 w-16">
              <AvatarImage src={companyInfo.logo} />
              <AvatarFallback><Building /></AvatarFallback>
            </Avatar>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{companyInfo?.name || 'Sua Empresa'}</h1>
            {companyInfo?.document && <p className="text-sm text-gray-500">CNPJ/CPF: {companyInfo.document}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-semibold text-gray-700">{getTitle()}</h2>
          <p className="text-sm text-gray-500">Nº: {transaction.id.substring(0, 8).toUpperCase()}</p>
          <p className="text-sm text-gray-500">Data de Emissão: {format(new Date(transaction.date as Date), 'dd/MM/yyyy')}</p>
        </div>
      </header>

      <section className="mt-6">
        <h3 className="text-lg font-semibold border-b border-gray-200 pb-2 mb-2 text-gray-700">Informações do Cliente</h3>
        {customer ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <p><span className="font-semibold">Nome:</span> {customer.name}</p>
            {customer.document && <p><span className="font-semibold">CPF/CNPJ:</span> {customer.document}</p>}
            {customer.email && <p><span className="font-semibold">Email:</span> {customer.email}</p>}
            {customer.phone && <p><span className="font-semibold">Telefone:</span> {customer.phone}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Cliente não informado.</p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-semibold border-b border-gray-200 pb-2 mb-4 text-gray-700">Detalhes da Operação</h3>
        <div className="space-y-4 text-sm">
          {hasService && (
            <div>
              <h4 className="font-semibold text-gray-600 mb-1">Serviços Prestados</h4>
              <p className="p-2 bg-gray-50 rounded">{transaction.description || 'Serviço prestado'}</p>
            </div>
          )}
          {hasProduct && product && (
            <div>
              <h4 className="font-semibold text-gray-600 mb-1">Produtos Vendidos</h4>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 font-semibold">Produto</th>
                    <th className="p-2 font-semibold text-center">Qtde.</th>
                    <th className="p-2 font-semibold text-right">Preço Un.</th>
                    <th className="p-2 font-semibold text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2">{product.name}</td>
                    <td className="p-2 text-center">{transaction.quantitySold}</td>
                    <td className="p-2 text-right">{formatCurrency(product.price)}</td>
                    <td className="p-2 text-right">{formatCurrency((transaction.quantitySold || 0) * product.price)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 pt-4 border-t border-gray-300 flex justify-end">
        <div className="w-full max-w-xs space-y-2 text-sm">
          {transaction.subtype === 'Serviço + Venda' && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal (Serviços):</span>
                <span className="font-medium text-gray-800">{formatCurrency(transaction.serviceAmount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal (Produtos):</span>
                <span className="font-medium text-gray-800">{formatCurrency(transaction.productAmount || 0)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-base font-bold text-gray-800">Valor Total:</span>
            <span className="text-lg font-bold text-gray-900">{formatCurrency(transaction.amount)}</span>
          </div>
          {transaction.paymentMethod && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Forma de Pagamento:</span>
              <span>{transaction.paymentMethod}{transaction.installmentsCount ? ` (${transaction.installmentsCount}x)` : ''}</span>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-16 text-center text-xs text-gray-400 border-t pt-4">
        <p>Este é um documento gerado pelo sistema.</p>
        {companyInfo?.name && <p>{companyInfo.name}</p>}
      </footer>
    </div>
  );
}
