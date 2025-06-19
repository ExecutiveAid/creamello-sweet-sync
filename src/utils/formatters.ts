// Standardized formatters for the entire application
// This ensures consistent formatting across all components

import { format, parseISO } from 'date-fns';

// ==================== CURRENCY FORMATTING ====================

export interface CurrencyOptions {
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  showSymbol?: boolean;
}

/**
 * Format currency with consistent styling across the app
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number | null | undefined, 
  options: CurrencyOptions = {}
): string => {
  const {
    currency = 'GHS',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true
  } = options;

  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? `${currency} 0.00` : '0.00';
  }

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits
  });

  return showSymbol ? `${currency} ${formatted}` : formatted;
};

/**
 * Format currency for display in tables and cards
 */
export const formatCurrencyDisplay = (amount: number | null | undefined): string => {
  return formatCurrency(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Format currency for input fields (no symbol)
 */
export const formatCurrencyInput = (amount: number | null | undefined): string => {
  return formatCurrency(amount, { showSymbol: false });
};

/**
 * Format currency for receipts and invoices
 */
export const formatCurrencyReceipt = (amount: number | null | undefined): string => {
  return formatCurrency(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ==================== DATE FORMATTING ====================

export interface DateFormatOptions {
  format?: 'short' | 'medium' | 'long' | 'full' | 'custom';
  customFormat?: string;
  includeTime?: boolean;
  timeFormat?: '12h' | '24h';
}

/**
 * Format date with consistent styling across the app
 * @param date - Date string, Date object, or ISO string
 * @param options - Formatting options
 * @returns Formatted date string
 */
export const formatDate = (
  date: string | Date | null | undefined,
  options: DateFormatOptions = {}
): string => {
  const {
    format: formatType = 'medium',
    customFormat,
    includeTime = false,
    timeFormat = '24h'
  } = options;

  if (!date) return '-';

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (customFormat) {
      return format(dateObj, customFormat);
    }

    // Standard date formats
    const formats = {
      short: 'MMM dd, yyyy',
      medium: 'MMM dd, yyyy',
      long: 'MMMM dd, yyyy',
      full: 'EEEE, MMMM dd, yyyy'
    };

    let dateFormat = formats[formatType];

    if (includeTime) {
      const timeFormatStr = timeFormat === '12h' ? 'hh:mm a' : 'HH:mm';
      dateFormat += ` ${timeFormatStr}`;
    }

    return format(dateObj, dateFormat);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
};

/**
 * Format date for display in tables
 */
export const formatDateDisplay = (date: string | Date | null | undefined): string => {
  return formatDate(date, { format: 'medium' });
};

/**
 * Format date with time for detailed views
 */
export const formatDateTimeDisplay = (date: string | Date | null | undefined): string => {
  return formatDate(date, { format: 'medium', includeTime: true, timeFormat: '24h' });
};

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export const formatDateInput = (date: string | Date | null | undefined): string => {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'yyyy-MM-dd');
  } catch (error) {
    return '';
  }
};

/**
 * Format date for receipts and invoices
 */
export const formatDateReceipt = (date: string | Date | null | undefined): string => {
  return formatDate(date, { format: 'medium' });
};

/**
 * Format date for reports
 */
export const formatDateReport = (date: string | Date | null | undefined): string => {
  return formatDate(date, { format: 'medium', includeTime: true });
};

// ==================== UNIT FORMATTING ====================

export interface UnitFormatOptions {
  showUnit?: boolean;
  precision?: number;
  unitSeparator?: string;
}

/**
 * Format quantity with unit
 * @param quantity - The quantity to format
 * @param unit - The unit of measurement
 * @param options - Formatting options
 * @returns Formatted quantity string
 */
export const formatQuantity = (
  quantity: number | null | undefined,
  unit: string | null | undefined,
  options: UnitFormatOptions = {}
): string => {
  const {
    showUnit = true,
    precision = 2,
    unitSeparator = ' '
  } = options;

  if (quantity === null || quantity === undefined || isNaN(quantity)) {
    return showUnit && unit ? `0.00${unitSeparator}${unit}` : '0.00';
  }

  const formattedQuantity = quantity.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });

  if (!showUnit || !unit) {
    return formattedQuantity;
  }

  return `${formattedQuantity}${unitSeparator}${unit}`;
};

/**
 * Format quantity for display in tables
 */
export const formatQuantityDisplay = (
  quantity: number | null | undefined,
  unit: string | null | undefined
): string => {
  return formatQuantity(quantity, unit, { precision: 2 });
};

/**
 * Format quantity for input fields (no unit)
 */
export const formatQuantityInput = (quantity: number | null | undefined): string => {
  return formatQuantity(quantity, null, { showUnit: false, precision: 2 });
};

// ==================== PERCENTAGE FORMATTING ====================

/**
 * Format percentage with consistent styling
 * @param value - The percentage value (0-100)
 * @param precision - Number of decimal places
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number | null | undefined,
  precision: number = 1
): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.0%';
  }

  return `${value.toFixed(precision)}%`;
};

// ==================== STATUS FORMATTING ====================

/**
 * Format status text with consistent casing
 * @param status - The status string
 * @returns Formatted status string
 */
export const formatStatus = (status: string | null | undefined): string => {
  if (!status) return '-';
  
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// ==================== PHONE NUMBER FORMATTING ====================

/**
 * Format phone number for Ghana
 * @param phone - The phone number
 * @returns Formatted phone number
 */
export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '-';
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Ghana phone number formatting
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  
  if (digits.length === 12 && digits.startsWith('233')) {
    return `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  
  return phone; // Return original if doesn't match expected patterns
};

// ==================== FILE SIZE FORMATTING ====================

/**
 * Format file size in human readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// ==================== VALIDATION HELPERS ====================

/**
 * Check if a value is a valid currency amount
 */
export const isValidCurrency = (value: string | number): boolean => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num >= 0 && num < 999999999;
};

/**
 * Check if a value is a valid quantity
 */
export const isValidQuantity = (value: string | number): boolean => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num >= 0;
};

/**
 * Check if a date string is valid
 */
export const isValidDate = (date: string): boolean => {
  try {
    const dateObj = parseISO(date);
    return !isNaN(dateObj.getTime());
  } catch {
    return false;
  }
};

// ==================== EXPORT ALL ====================

export const Formatters = {
  // Currency
  currency: formatCurrency,
  currencyDisplay: formatCurrencyDisplay,
  currencyInput: formatCurrencyInput,
  currencyReceipt: formatCurrencyReceipt,
  
  // Date
  date: formatDate,
  dateDisplay: formatDateDisplay,
  dateTimeDisplay: formatDateTimeDisplay,
  dateInput: formatDateInput,
  dateReceipt: formatDateReceipt,
  dateReport: formatDateReport,
  
  // Quantity
  quantity: formatQuantity,
  quantityDisplay: formatQuantityDisplay,
  quantityInput: formatQuantityInput,
  
  // Others
  percentage: formatPercentage,
  status: formatStatus,
  phoneNumber: formatPhoneNumber,
  fileSize: formatFileSize,
  
  // Validation
  isValidCurrency,
  isValidQuantity,
  isValidDate
}; 