import { ReceiptTemplate, ReceiptOrder } from '@/components/Receipt';

// ESC/POS Commands for thermal printers
export const ESC_POS = {
  // Initialize printer
  INIT: '\x1B\x40',
  
  // Text formatting
  BOLD_ON: '\x1B\x45\x01',
  BOLD_OFF: '\x1B\x45\x00',
  UNDERLINE_ON: '\x1B\x2D\x01',
  UNDERLINE_OFF: '\x1B\x2D\x00',
  
  // Text alignment
  ALIGN_LEFT: '\x1B\x61\x00',
  ALIGN_CENTER: '\x1B\x61\x01',
  ALIGN_RIGHT: '\x1B\x61\x02',
  
  // Text size
  NORMAL_SIZE: '\x1B\x21\x00',
  DOUBLE_HEIGHT: '\x1B\x21\x10',
  DOUBLE_WIDTH: '\x1B\x21\x20',
  DOUBLE_SIZE: '\x1B\x21\x30',
  
  // Line feed
  LF: '\x0A',
  
  // Paper cut
  FULL_CUT: '\x1D\x56\x00',
  PARTIAL_CUT: '\x1D\x56\x01',
  
  // Cash drawer
  OPEN_DRAWER: '\x1B\x70\x00\x19\xFA',
};

export interface PrintOptions {
  autoCut?: boolean;
  openDrawer?: boolean;
  copies?: number;
}

export class ReceiptPrinter {
  private template: ReceiptTemplate;
  
  constructor(template: ReceiptTemplate) {
    this.template = template;
  }

  private formatCurrency(amount: number): string {
    return `GHS ${amount.toFixed(2)}`;
  }

  private formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private padLine(left: string, right: string, width: number): string {
    const totalLength = left.length + right.length;
    const padding = Math.max(0, width - totalLength);
    return left + ' '.repeat(padding) + right;
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  private generateSeparator(width: number): string {
    return '='.repeat(Math.min(width, 48));
  }

  public generateReceiptText(order: ReceiptOrder): string {
    let receipt = '';
    const width = this.template.width;
    
    // Initialize printer
    receipt += ESC_POS.INIT;
    
    // Header Section
    if (this.template.showHeader) {
      receipt += ESC_POS.ALIGN_CENTER;
      receipt += ESC_POS.DOUBLE_SIZE;
      receipt += this.template.shopName + ESC_POS.LF;
      receipt += ESC_POS.NORMAL_SIZE;
      
      // Address lines
      const addressLines = this.template.address.split('\n');
      addressLines.forEach(line => {
        receipt += line.trim() + ESC_POS.LF;
      });
      
      receipt += `Tel: ${this.template.phone}` + ESC_POS.LF;
      receipt += this.generateSeparator(width) + ESC_POS.LF;
    }

    // Receipt type header
    receipt += ESC_POS.ALIGN_CENTER;
    receipt += ESC_POS.BOLD_ON;
    receipt += this.template.headerText + ESC_POS.LF;
    receipt += ESC_POS.BOLD_OFF;
    receipt += ESC_POS.ALIGN_LEFT;

    // Order information
    receipt += ESC_POS.LF;
    receipt += `Order: #${order.orderNumber}` + ESC_POS.LF;
    
    if (this.template.showDateTime) {
      receipt += `Date: ${this.formatDateTime(order.createdAt)}` + ESC_POS.LF;
    }
    
    if (this.template.showStaffInfo && order.staffName) {
      receipt += `Staff: ${order.staffName}` + ESC_POS.LF;
    }
    
    if (this.template.showTableInfo && order.tableNumber) {
      receipt += `Table: ${order.tableNumber}` + ESC_POS.LF;
    }
    
    if (this.template.showCustomerInfo && order.customerName) {
      receipt += `Customer: ${order.customerName}` + ESC_POS.LF;
    }
    
    receipt += `Payment: ${order.paymentMethod}` + ESC_POS.LF;
    receipt += this.generateSeparator(width) + ESC_POS.LF;

    // Order items
    if (this.template.showOrderDetails) {
      // Items header
      receipt += ESC_POS.BOLD_ON;
      receipt += this.padLine('Item', 'Total', width) + ESC_POS.LF;
      receipt += ESC_POS.BOLD_OFF;
      
      // Items
      order.items.forEach(item => {
        const itemName = item.name.length > width - 15 
          ? item.name.substring(0, width - 18) + '...'
          : item.name;
        
        receipt += itemName + ESC_POS.LF;
        
        const qtyPrice = `${item.quantity} x ${this.formatCurrency(item.price)}`;
        const total = this.formatCurrency(item.total);
        receipt += this.padLine(qtyPrice, total, width) + ESC_POS.LF;
      });
    }

    receipt += this.generateSeparator(width) + ESC_POS.LF;

    // Totals
    receipt += this.padLine('Subtotal', this.formatCurrency(order.subtotal), width) + ESC_POS.LF;
    
    if (order.tax && order.tax > 0) {
      receipt += this.padLine('Tax', this.formatCurrency(order.tax), width) + ESC_POS.LF;
    }
    
    receipt += ESC_POS.BOLD_ON;
    receipt += this.padLine('TOTAL', this.formatCurrency(order.total), width) + ESC_POS.LF;
    receipt += ESC_POS.BOLD_OFF;

    if (order.amountPaid) {
      receipt += this.padLine('Paid', this.formatCurrency(order.amountPaid), width) + ESC_POS.LF;
      
      if (order.change && order.change > 0) {
        receipt += this.padLine('Change', this.formatCurrency(order.change), width) + ESC_POS.LF;
      }
    }

    receipt += this.generateSeparator(width) + ESC_POS.LF;

    // Footer messages
    if (this.template.footerText) {
      receipt += ESC_POS.ALIGN_CENTER;
      const footerLines = this.template.footerText.replace(/\\n/g, '\n').split('\n');
      footerLines.forEach(line => {
        receipt += line.trim() + ESC_POS.LF;
      });
      receipt += ESC_POS.ALIGN_LEFT;
    }

    if (this.template.customMessage) {
      receipt += this.generateSeparator(width) + ESC_POS.LF;
      receipt += ESC_POS.ALIGN_CENTER;
      const customLines = this.template.customMessage.split('\n');
      customLines.forEach(line => {
        receipt += line.trim() + ESC_POS.LF;
      });
      receipt += ESC_POS.ALIGN_LEFT;
    }

    // QR Code placeholder (would need specific printer commands)
    if (this.template.showQrCode) {
      receipt += ESC_POS.LF;
      receipt += ESC_POS.ALIGN_CENTER;
      receipt += `[QR: Order #${order.orderNumber}]` + ESC_POS.LF;
      receipt += ESC_POS.ALIGN_LEFT;
    }

    return receipt;
  }

  public async printReceipt(order: ReceiptOrder, options: PrintOptions = {}): Promise<boolean> {
    try {
      const receiptText = this.generateReceiptText(order);
      
      // For web browsers, we'll use the Web Serial API or fall back to window.print()
      if ('serial' in navigator) {
        return await this.printViaSerial(receiptText, options);
      } else {
        return await this.printViaWindow(order, options);
      }
    } catch (error) {
      console.error('Print error:', error);
      return false;
    }
  }

  private async printViaSerial(receiptText: string, options: PrintOptions): Promise<boolean> {
    try {
      // Request serial port access
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });

      const writer = port.writable.getWriter();
      
      // Send receipt data
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(receiptText));
      
      // Paper cut
      if (options.autoCut !== false) {
        const cutCommand = this.template.cutType === 'partial' 
          ? ESC_POS.PARTIAL_CUT 
          : ESC_POS.FULL_CUT;
        await writer.write(encoder.encode(cutCommand));
      }
      
      // Open cash drawer
      if (options.openDrawer) {
        await writer.write(encoder.encode(ESC_POS.OPEN_DRAWER));
      }
      
      writer.releaseLock();
      await port.close();
      
      return true;
    } catch (error) {
      console.error('Serial print error:', error);
      return false;
    }
  }

  private async printViaWindow(order: ReceiptOrder, options: PrintOptions): Promise<boolean> {
    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=300,height=600');
      if (!printWindow) return false;

      // Generate HTML for printing
      const html = this.generatePrintHTML(order);
      
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
      };
      
      return true;
    } catch (error) {
      console.error('Window print error:', error);
      return false;
    }
  }

  private generatePrintHTML(order: ReceiptOrder): string {
    const width = this.template.paperSize === '58mm' ? '58mm' : '80mm';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          @media print {
            @page {
              size: ${width} auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 8px;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.2;
              width: ${width};
            }
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.2;
            width: ${width};
            margin: 0;
            padding: 8px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .separator { text-align: center; margin: 4px 0; }
          .flex { display: flex; justify-content: space-between; }
          .item-line { margin-bottom: 2px; }
        </style>
      </head>
      <body>
        ${this.generateReceiptHTML(order)}
      </body>
      </html>
    `;
  }

  private generateReceiptHTML(order: ReceiptOrder): string {
    let html = '';
    
    // Header
    if (this.template.showHeader) {
      html += `<div class="center bold" style="font-size: 14px;">${this.template.shopName}</div>`;
      html += `<div class="center">${this.template.address.replace(/\n/g, '<br>')}</div>`;
      html += `<div class="center">Tel: ${this.template.phone}</div>`;
      html += `<div class="separator">${this.generateSeparator(this.template.width)}</div>`;
    }

    // Receipt header
    html += `<div class="center bold">${this.template.headerText}</div><br>`;

    // Order info
    html += `Order: #${order.orderNumber}<br>`;
    if (this.template.showDateTime) {
      html += `Date: ${this.formatDateTime(order.createdAt)}<br>`;
    }
    if (this.template.showStaffInfo && order.staffName) {
      html += `Staff: ${order.staffName}<br>`;
    }
    if (this.template.showTableInfo && order.tableNumber) {
      html += `Table: ${order.tableNumber}<br>`;
    }
    if (this.template.showCustomerInfo && order.customerName) {
      html += `Customer: ${order.customerName}<br>`;
    }
    html += `Payment: ${order.paymentMethod}<br>`;
    html += `<div class="separator">${this.generateSeparator(this.template.width)}</div>`;

    // Items
    if (this.template.showOrderDetails) {
      html += `<div class="flex bold"><span>Item</span><span>Total</span></div>`;
      order.items.forEach(item => {
        html += `<div class="item-line">${item.name}</div>`;
        html += `<div class="flex item-line"><span>${item.quantity} x ${this.formatCurrency(item.price)}</span><span>${this.formatCurrency(item.total)}</span></div>`;
      });
    }

    html += `<div class="separator">${this.generateSeparator(this.template.width)}</div>`;

    // Totals
    html += `<div class="flex"><span>Subtotal</span><span>${this.formatCurrency(order.subtotal)}</span></div>`;
    if (order.tax && order.tax > 0) {
      html += `<div class="flex"><span>Tax</span><span>${this.formatCurrency(order.tax)}</span></div>`;
    }
    html += `<div class="flex bold"><span>TOTAL</span><span>${this.formatCurrency(order.total)}</span></div>`;
    
    if (order.amountPaid) {
      html += `<div class="flex"><span>Paid</span><span>${this.formatCurrency(order.amountPaid)}</span></div>`;
      if (order.change && order.change > 0) {
        html += `<div class="flex"><span>Change</span><span>${this.formatCurrency(order.change)}</span></div>`;
      }
    }

    html += `<div class="separator">${this.generateSeparator(this.template.width)}</div>`;

    // Footer
    if (this.template.footerText) {
      html += `<div class="center">${this.template.footerText.replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}</div>`;
    }

    if (this.template.customMessage) {
      html += `<div class="separator">${this.generateSeparator(this.template.width)}</div>`;
      html += `<div class="center">${this.template.customMessage.replace(/\n/g, '<br>')}</div>`;
    }

    if (this.template.showQrCode) {
      html += `<div class="center" style="margin-top: 8px;">`;
      html += `<div style="border: 2px solid black; width: 48px; height: 48px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px;">QR</div>`;
      html += `<div style="font-size: 10px; margin-top: 4px;">Order #${order.orderNumber}</div>`;
      html += `</div>`;
    }

    return html;
  }
}

// Utility function to create and use printer
export const printReceipt = async (
  template: ReceiptTemplate, 
  order: ReceiptOrder, 
  options: PrintOptions = {}
): Promise<boolean> => {
  const printer = new ReceiptPrinter(template);
  return await printer.printReceipt(order, options);
};

export default ReceiptPrinter; 