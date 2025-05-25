import React from 'react';

export interface ReceiptTemplate {
  shopName: string;
  address: string;
  phone: string;
  width: number;
  showHeader: boolean;
  showFooter: boolean;
  showQrCode: boolean;
  headerText: string;
  footerText: string;
  customMessage: string;
  showOrderDetails: boolean;
  showStaffInfo: boolean;
  showDateTime: boolean;
  showTableInfo: boolean;
  showCustomerInfo: boolean;
  paperSize: string;
  encoding: string;
  cutType: string;
}

export interface ReceiptOrder {
  id: string;
  orderNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax?: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number;
  change?: number;
  customerName?: string;
  tableNumber?: string;
  staffName?: string;
  createdAt: string;
}

interface ReceiptProps {
  template: ReceiptTemplate;
  order: ReceiptOrder;
  isPreview?: boolean;
  className?: string;
}

export const Receipt: React.FC<ReceiptProps> = ({ 
  template, 
  order, 
  isPreview = false,
  className = ""
}) => {
  const formatCurrency = (amount: number) => `GHS ${amount.toFixed(2)}`;
  
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const centerText = (text: string, width: number) => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  };

  const rightAlign = (text: string, width: number) => {
    const padding = Math.max(0, width - text.length);
    return ' '.repeat(padding) + text;
  };

  const separator = '='.repeat(Math.min(template.width, 48));

  const receiptStyle = isPreview ? {
    width: `${template.width * 8}px`,
    maxWidth: '100%',
    overflow: 'hidden',
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: '1.4',
    backgroundColor: 'white',
    border: '2px dashed #ccc',
    padding: '16px',
    color: 'black'
  } : {
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: '1.4',
    width: '100%',
    color: 'black'
  };

  return (
    <div className={className} style={receiptStyle}>
      {/* Header Section */}
      {template.showHeader && (
        <>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
            {template.shopName}
          </div>
          <div style={{ textAlign: 'center', fontSize: '11px' }}>
            {template.address.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            <div>Tel: {template.phone}</div>
          </div>
          <div style={{ textAlign: 'center' }}>{separator}</div>
        </>
      )}

      {/* Receipt Type Header */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '8px 0' }}>
        {template.headerText}
      </div>

      {/* Order Information */}
      <div style={{ fontSize: '11px', marginBottom: '8px' }}>
        <div>Order: #{order.orderNumber}</div>
        {template.showDateTime && (
          <div>Date: {formatDateTime(order.createdAt)}</div>
        )}
        {template.showStaffInfo && order.staffName && (
          <div>Staff: {order.staffName}</div>
        )}
        {template.showTableInfo && order.tableNumber && (
          <div>Table: {order.tableNumber}</div>
        )}
        {template.showCustomerInfo && order.customerName && (
          <div>Customer: {order.customerName}</div>
        )}
        <div>Payment: {order.paymentMethod}</div>
      </div>

      <div style={{ textAlign: 'center' }}>{separator}</div>

      {/* Items Header */}
      {template.showOrderDetails && (
        <>
          <div style={{ 
            display: 'flex', 
            fontWeight: 'bold', 
            fontSize: '11px',
            marginBottom: '4px'
          }}>
            <span style={{ width: '50%' }}>Item</span>
            <span style={{ width: '15%', textAlign: 'center' }}>Qty</span>
            <span style={{ width: '20%', textAlign: 'right' }}>Price</span>
            <span style={{ width: '15%', textAlign: 'right' }}>Total</span>
          </div>

          {/* Order Items */}
          {order.items.map((item, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              fontSize: '11px',
              marginBottom: '2px'
            }}>
              <span style={{ 
                width: '50%', 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.name}
              </span>
              <span style={{ width: '15%', textAlign: 'center' }}>
                {item.quantity}
              </span>
              <span style={{ width: '20%', textAlign: 'right' }}>
                {formatCurrency(item.price)}
              </span>
              <span style={{ width: '15%', textAlign: 'right' }}>
                {formatCurrency(item.total)}
              </span>
            </div>
          ))}
        </>
      )}

      <div style={{ textAlign: 'center' }}>{separator}</div>

      {/* Totals Section */}
      <div style={{ fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>Subtotal</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        
        {order.tax && order.tax > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Tax</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontWeight: 'bold',
          fontSize: '12px',
          marginBottom: '4px'
        }}>
          <span>TOTAL</span>
          <span>{formatCurrency(order.total)}</span>
        </div>

        {order.amountPaid && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Paid</span>
              <span>{formatCurrency(order.amountPaid)}</span>
            </div>
            
            {order.change && order.change > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Change</span>
                <span>{formatCurrency(order.change)}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>{separator}</div>

      {/* Footer Messages */}
      {template.footerText && (
        <div style={{ 
          textAlign: 'center', 
          fontSize: '11px',
          whiteSpace: 'pre-line',
          marginBottom: '8px'
        }}>
          {template.footerText.replace(/\\n/g, '\n')}
        </div>
      )}

      {template.customMessage && (
        <>
          <div style={{ textAlign: 'center' }}>{separator}</div>
          <div style={{ 
            textAlign: 'center', 
            fontSize: '11px',
            whiteSpace: 'pre-line',
            marginBottom: '8px'
          }}>
            {template.customMessage}
          </div>
        </>
      )}

      {/* QR Code */}
      {template.showQrCode && (
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <div style={{
            display: 'inline-flex',
            border: '2px solid black',
            width: '48px',
            height: '48px',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px'
          }}>
            QR
          </div>
          <div style={{ fontSize: '10px', marginTop: '4px' }}>
            Order #{order.orderNumber}
          </div>
        </div>
      )}

      {/* Paper Cut Indicator (for preview only) */}
      {isPreview && template.cutType !== 'none' && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '16px',
          fontSize: '10px',
          color: '#666'
        }}>
          {template.cutType === 'full' ? '✂️ Full Cut' : '✂️ Partial Cut'}
        </div>
      )}
    </div>
  );
};

export default Receipt; 