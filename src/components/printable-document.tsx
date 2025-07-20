
'use client';

import { type Transaction, type Customer, type Product, type CompanyInfo } from '@/lib/types';
import { formatCurrency, maskDocument } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Building } from 'lucide-react';

interface PrintableDocumentProps {
  transaction: Transaction | null;
  customer: Customer | undefined;
  companyInfo: CompanyInfo | null;
}

export function PrintableDocument({ transaction, customer, companyInfo }: PrintableDocumentProps) {
  if (!transaction) return null;

  const getTitle = () => {
    switch(transaction.subtype) {
      case 'Prestação de Serviço': return 'Ordem de Serviço';
      case 'Serviço + Venda': return 'Ordem de Serviço';
      case 'Venda': return 'Comprovante de Venda';
      default: return 'Documento';
    }
  };

  const hasServices = transaction.subtype === 'Prestação de Serviço' || transaction.subtype === 'Serviço + Venda';
  const hasProducts = transaction.subtype === 'Venda' || transaction.subtype === 'Serviço + Venda';
  const productItems = transaction.items || [];
  const serviceItems = transaction.services || [];
  const productTotal = productItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const serviceTotal = serviceItems.reduce((sum, item) => sum + item.price, 0);

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
            {companyInfo?.document && <p className="text-sm text-gray-500">CNPJ/CPF: {maskDocument(companyInfo.document)}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-semibold text-gray-700">{getTitle()}</h2>
          <p className="text-sm text-gray-500">Nº: {transaction.sequentialId ? String(transaction.sequentialId).padStart(8, '0') : transaction.id.substring(0, 8).toUpperCase()}</p>
          <p className="text-sm text-gray-500">Data de Emissão: {format(new Date(transaction.date as Date), 'dd/MM/yyyy')}</p>
        </div>
      </header>

      {customer && (
        <section className="mt-6">
          <h3 className="text-lg font-semibold border-b border-gray-200 pb-2 mb-2 text-gray-700">Informações do Cliente</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <p><span className="font-semibold">Nome:</span> {customer.name}</p>
            {customer.document && <p><span className="font-semibold">CPF/CNPJ:</span> {maskDocument(customer.document)}</p>}
            {customer.email && <p><span className="font-semibold">Email:</span> {customer.email}</p>}
            {customer.phone && <p><span className="font-semibold">Telefone:</span> {customer.phone}</p>}
          </div>
        </section>
      )}

      {!customer && transaction.customerName && (
        <section className="mt-6">
          <h3 className="text-lg font-semibold border-b border-gray-200 pb-2 mb-2 text-gray-700">Informações do Cliente</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <p><span className="font-semibold">Nome:</span> {transaction.customerName}</p>
          </div>
        </section>
      )}


      <section className="mt-6">
        <h3 className="text-lg font-semibold border-b border-gray-200 pb-2 mb-4 text-gray-700">Detalhes da Operação</h3>
        <div className="space-y-4 text-sm">
          {hasServices && serviceItems.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-600 mb-1">Serviços Prestados</h4>
               <table className="w-full text-left">
                <thead className="border-b">
                  <tr className="bg-gray-100">
                    <th className="p-2 font-semibold">Serviço</th>
                    <th className="p-2 font-semibold text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceItems.map(item => (
                    <tr key={item.serviceId} className="border-b">
                      <td className="p-2">{item.serviceName}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hasProducts && productItems.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-600 mb-1">Produtos Vendidos</h4>
              <table className="w-full text-left">
                <thead className="border-b">
                  <tr className="bg-gray-100">
                    <th className="p-2 font-semibold">Produto</th>
                    <th className="p-2 font-semibold text-center">Qtde.</th>
                    <th className="p-2 font-semibold text-right">Preço Un.</th>
                    <th className="p-2 font-semibold text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {productItems.map(item => (
                    <tr key={item.productId} className="border-b">
                      <td className="p-2">{item.productName}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-right">{formatCurrency(item.price)}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(item.quantity * item.price)}</td>
                    </tr>
                  ))}
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
                <span className="font-medium text-gray-800">{formatCurrency(serviceTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal (Produtos):</span>
                <span className="font-medium text-gray-800">{formatCurrency(productTotal)}</span>
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
