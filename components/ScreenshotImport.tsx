'use client';

import { useState } from 'react';
import { Category, PaymentMethod } from '@/types/database';
import { usePaymentMethods } from '@/lib/hooks/usePaymentMethods';
import { createWorker } from 'tesseract.js';

interface ScreenshotImportProps {
  categories: Category[];
  onSuccess: () => void;
}

interface ParsedTransaction {
  id: string;
  date: string;
  amount: string;
  description: string;
  category: string;
  payment_method: string;
  paid_by: string | null;
  year?: number;
  month?: number;
  quarter?: number;
  rawText?: string; // Original OCR text for debugging
  error?: string; // Parsing errors
}

export default function ScreenshotImport({ categories, onSuccess }: ScreenshotImportProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<ParsedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [processingFile, setProcessingFile] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [rawOcrTexts, setRawOcrTexts] = useState<Record<string, string>>({});
  const [showRawText, setShowRawText] = useState(false);
  const [paymentMethodOverride, setPaymentMethodOverride] = useState<PaymentMethod | ''>('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [periodValue, setPeriodValue] = useState<number>(new Date().getMonth() + 1);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Validate file types
    const invalidFiles = selectedFiles.filter(f => !f.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      setError(`Please select only image files (PNG, JPG, JPEG, WEBP). ${invalidFiles.length} invalid file(s) found.`);
      return;
    }

    setFiles(prev => [...prev, ...selectedFiles]);
    setPreview([]);
    setError(null);
    setRawOcrTexts({});
    setOcrProgress(0);
    setOcrStatus('');
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    // Also remove any parsed transactions from this file
    // (We could track which transactions came from which file, but for simplicity, we'll just clear preview)
    // Actually, let's keep the preview and let user manage it
  };

  const handleClearAll = () => {
    setFiles([]);
    setPreview([]);
    setRawOcrTexts({});
    setError(null);
    setOcrProgress(0);
    setOcrStatus('');
    setProcessingFile('');
  };

  // Date parsing patterns
  const parseDate = (text: string, defaultYear?: number): string | null => {
    if (!text) return null;
    
    const yearToUse = defaultYear || selectedYear;

    // Pattern 1: MM/DD/YYYY or M/D/YYYY
    const mmddyyyy = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (mmddyyyy) {
      const [, month, day, year] = mmddyyyy;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    // Pattern 2: Mon DD, YYYY or Dec DD, YYYY (abbreviated month) - comma optional, year optional
    const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Try with year first
    const abbrevPatternWithYear = new RegExp(`\\b(${monthAbbrev.join('|')})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'i');
    const abbrevMatchWithYear = text.match(abbrevPatternWithYear);
    if (abbrevMatchWithYear) {
      const [, monthStr, day, year] = abbrevMatchWithYear;
      const monthIndex = monthAbbrev.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
      if (monthIndex >= 0) {
        const date = new Date(parseInt(year), monthIndex, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    // Try without year (use default/selected year)
    // Also handle day-of-week prefix like "Sun, Dec 7" or "Tue, Dec 2"
    const dayOfWeekPrefix = '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\\s+';
    const abbrevPatternNoYear = new RegExp(`(?:^|\\s)(?:${dayOfWeekPrefix})?(${monthAbbrev.join('|')})\\s+(\\d{1,2})\\b`, 'i');
    const abbrevMatchNoYear = text.match(abbrevPatternNoYear);
    if (abbrevMatchNoYear) {
      const [, monthStr, day] = abbrevMatchNoYear;
      const monthIndex = monthAbbrev.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
      if (monthIndex >= 0) {
        // Check if this looks like a date (not just random text)
        // Should be at start of line or after whitespace, and day should be 1-31
        const dayNum = parseInt(day);
        if (dayNum >= 1 && dayNum <= 31) {
          const date = new Date(yearToUse, monthIndex, dayNum);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      }
    }

    // Pattern 3: Full month name (January, February, etc.) - with or without year
    const monthFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    // Try with year first
    const fullPatternWithYear = new RegExp(`\\b(${monthFull.join('|')})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'i');
    const fullMatchWithYear = text.match(fullPatternWithYear);
    if (fullMatchWithYear) {
      const [, monthStr, day, year] = fullMatchWithYear;
      const monthIndex = monthFull.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
      if (monthIndex >= 0) {
        const date = new Date(parseInt(year), monthIndex, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    // Try without year (use default/selected year)
    const fullPatternNoYear = new RegExp(`\\b(${monthFull.join('|')})\\s+(\\d{1,2})\\b`, 'i');
    const fullMatchNoYear = text.match(fullPatternNoYear);
    if (fullMatchNoYear) {
      const [, monthStr, day] = fullMatchNoYear;
      const monthIndex = monthFull.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
      if (monthIndex >= 0) {
        const dayNum = parseInt(day);
        if (dayNum >= 1 && dayNum <= 31) {
          const date = new Date(yearToUse, monthIndex, dayNum);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      }
    }

    return null;
  };

  // Amount parsing - must have $ sign or decimal point to avoid matching dates
  const parseAmount = (text: string): string | null => {
    if (!text) return null;

    // Match amounts: $X.XX, -$X.XX, $X,XXX.XX, or X.XX (with decimal)
    // Must have $ sign OR decimal point to avoid matching day numbers from dates
    // Handles positive and negative amounts
    // Pattern 1: With $ sign: $X.XX or -$X.XX
    const dollarPattern = /([-])?\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/;
    const dollarMatch = text.match(dollarPattern);
    if (dollarMatch) {
      const [, negative, amountStr] = dollarMatch;
      const cleaned = amountStr.replace(/,/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        return negative ? `-${cleaned}` : cleaned;
      }
    }
    
    // Pattern 2: Without $ but with decimal: X.XX (at least 2 decimal places)
    const decimalPattern = /([-])?(\d{1,3}(?:,\d{3})*\.\d{2,})/;
    const decimalMatch = text.match(decimalPattern);
    if (decimalMatch) {
      const [, negative, amountStr] = decimalMatch;
      const cleaned = amountStr.replace(/,/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        return negative ? `-${cleaned}` : cleaned;
      }
    }

    return null;
  };

  // Helper to check if text looks like a balance (typically large amounts that are running totals)
  // Be conservative - only flag obvious balances, not just "larger than previous transaction"
  const looksLikeBalance = (amountStr: string, prevAmountStr: string | null): boolean => {
    if (!prevAmountStr) return false;
    const amount = Math.abs(parseFloat(amountStr));
    const prevAmount = Math.abs(parseFloat(prevAmountStr));
    // Only flag as balance if amount is VERY large (> $1000) - these are likely running balances
    // Don't flag smaller amounts just because they're larger than previous - those are just larger transactions
    return amount > 1000;
  };

  // Helper to check if text is a continuation (phone, URL, short location code)
  const isContinuation = (text: string): boolean => {
    // Phone numbers: XXX-XXX-XXXX or (XXX) XXX-XXXX
    if (/^[\d\s\-\(\)]+$/.test(text) && text.replace(/\D/g, '').length >= 10) return true;
    // URLs: contains .com, .net, etc or http/https
    if (/\.(com|net|org|io|co|bill|amzn)/i.test(text) || /^https?:\/\//.test(text)) return true;
    // Short location codes (2-letter state codes, city names)
    if (/^[A-Z]{2}$/.test(text.trim()) || (text.length < 20 && /^[A-Z][A-Z\s]+$/.test(text))) return true;
    return false;
  };

  // Parse transactions from OCR text
  const parseTransactions = (ocrText: string): ParsedTransaction[] => {
    const lines = ocrText.split('\n').filter(line => line.trim());
    const transactions: ParsedTransaction[] = [];
    let currentDate: string | null = null;
    let pendingAmount: string | null = null; // Store pending transaction amount
    
    // Use today's date as fallback for transactions without dates
    const todayDate = new Date().toISOString().split('T')[0];
    
    // First pass: find the first date in the OCR text to use for transactions without dates
    let firstDateInText: string | null = null;
    for (const line of lines) {
      const date = parseDate(line, selectedYear);
      if (date) {
        firstDateInText = date;
        break; // Use the first date we find
      }
    }

    // Helper to check if a line is a header/non-transaction
    const isHeaderLine = (line: string): boolean => {
      const lower = line.toLowerCase();
      return (
        lower.includes('outstanding balance') ||
        lower.includes('transaction total') ||
        lower.includes('activity period') ||
        lower.includes('recent activity') ||
        lower.includes('now viewing') ||
        lower.includes('current statement') ||
        lower.includes('search by keyword') ||
        lower.includes('need help') ||
        lower.includes('log out') ||
        lower.includes('sign off') ||
        lower.includes('privacy & terms') ||
        lower.includes('member fdic') ||
        lower.includes('equal housing') ||
        lower.includes('bilt world elite mastercard') ||
        lower.includes('filter') ||
        lower.includes('subi boa cb') ||
        !!lower.match(/^\d{1,2}:\d{2}/) // Time patterns like "11:18"
      );
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || isHeaderLine(line)) {
        // But check if this header line contains a date we should extract
        const headerDate = parseDate(line, selectedYear);
        if (headerDate && !currentDate) {
          currentDate = headerDate;
        }
        continue;
      }

      // Check for "Pending $X.XX" - this is the transaction amount, merchant follows on next line
      const pendingMatch = line.match(/pending\s+([-])?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i);
      if (pendingMatch) {
        const [, negative, amountStr] = pendingMatch;
        const cleaned = amountStr.replace(/,/g, '');
        pendingAmount = negative ? `-${cleaned}` : cleaned;
        currentDate = null; // Pending transactions don't have dates
        continue; // Skip this line, next line will have merchant
      }

      // Check for date-only header lines (like "Dec 20, 2025" or "December 20, 2025:")
      const parsedDate = parseDate(line, selectedYear);
      const lineAmount = parseAmount(line);
      
      if (parsedDate && !lineAmount) {
        // If line is just a date (or date with minimal text/colon), it's a header
        const withoutDate = line.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, '')
          .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi, '')
          .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, '')
          .replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi, '') // With day-of-week and year
          .replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b/gi, '') // With day-of-week, no year
          .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b/gi, '') // Also remove dates without year
          .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/gi, '') // Full month without year
          .replace(/:/g, '')
          .trim()
          .replace(/[^\w\s]/g, '');
        
        if (withoutDate.length < 15) {
          currentDate = parsedDate;
          pendingAmount = null; // Clear pending when we see a date
          continue;
        }
      }
      
      // New pattern: Date header → Amount-only line → Merchant line
      // If we have a currentDate set and this line is just an amount (no text), store it as pendingAmount
      if (currentDate && !parsedDate && lineAmount) {
        // Check if the line is JUST an amount (maybe with $ sign and whitespace)
        const lineWithoutAmount = line.replace(/([-])?\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, '')
          .replace(/([-])?(\d{1,3}(?:,\d{3})*\.\d{2,})/g, '')
          .trim();
        
        // If line is mostly just the amount (very little or no other text), treat as amount-only line
        if (lineWithoutAmount.length < 5) {
          // This line is just an amount, next line should be merchant
          pendingAmount = lineAmount;
          continue;
        }
      }
      
      // Pattern 1: Date + Amount on same line (e.g., "Dec 18, 2025 -$330.74")
      // The amount on this line IS the transaction amount, merchant follows on next line
      if (parsedDate && lineAmount) {
        currentDate = parsedDate;
        pendingAmount = null;
        
        // Next line should have merchant name (and possibly balance)
        if (i + 1 < lines.length) {
          const merchantLine = lines[i + 1].trim();
          let description = merchantLine;
          
          // Remove balance amount if present (the amount on merchant line is usually balance)
          const merchantAmount = parseAmount(merchantLine);
          if (merchantAmount) {
            // Extract description by removing the amount (match $X.XX or X.XX with decimal)
            description = merchantLine.replace(/([-])?\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, '')
              .replace(/([-])?(\d{1,3}(?:,\d{3})*\.\d{2,})/g, '').trim();
          }
          
          // Collect continuation lines
          let j = i + 2;
          while (j < lines.length) {
            const nextLine = lines[j].trim();
            
            if (!nextLine || isHeaderLine(nextLine)) break;
            if (parseDate(nextLine, selectedYear)) break;
            
            // If next line has amount, it's likely a balance or new transaction - stop
            if (parseAmount(nextLine)) break;
            
            // Check if it's a continuation (phone, URL, location, or short text)
            if (isContinuation(nextLine) || nextLine.length < 30) {
              description += ' ' + nextLine;
              j++;
            } else {
              break;
            }
          }
          
          // Clean up description: remove UI elements and weird prefix characters
        description = description
          .replace(/^[®¢%9$C\s]+/g, '') // Remove weird prefix characters at the start (®¢, %¢, 9¢, $C, etc.)
          .replace(/[✓✔✅@]/g, '') // Checkmarks and @ symbols
          .replace(/[>→]/g, '') // Arrows
          .replace(/\s+/g, ' ') // Multiple spaces
          .trim();
          
          if (description.length >= 3) {
            transactions.push({
              id: `screenshot-${Date.now()}-${transactions.length}`,
              date: parsedDate,
              amount: lineAmount, // Use amount from date line
              description: description,
              category: '',
              payment_method: paymentMethodOverride || 'Other',
              paid_by: null,
              year: selectedYear,
              month: periodType === 'month' ? periodValue : undefined,
              quarter: periodType === 'quarter' ? periodValue : undefined,
              rawText: `${line} ${description}`.trim(),
            });
          }
          
          i = j - 1;
          continue;
        }
      }
      
      // Pattern 2: Pending transaction OR Amount-only line followed by merchant
      // If we have pendingAmount stored, this line should be the merchant
      if (pendingAmount && !lineAmount && !parsedDate) {
        // This line is the merchant (no amount on this line)
        let description = line.trim();
        
        // Clean up description: remove UI elements
        description = description
          .replace(/pay\s+it/gi, '') // Remove "Pay It" button text
          .replace(/^[®¢%9$C\s]+/g, '') // Remove weird prefix characters at the start
          .replace(/[✓✔✅@]/g, '') // Checkmarks and @ symbols
          .replace(/[>→]/g, '') // Arrows
          .replace(/\s+/g, ' ') // Multiple spaces
          .trim();
        
        if (description.length >= 3) {
          transactions.push({
            id: `screenshot-${Date.now()}-${transactions.length}`,
            date: currentDate || firstDateInText || todayDate, // Use currentDate, firstDateInText, or today as fallback
            amount: pendingAmount, // Use stored pending amount
            description: description,
            category: '',
            payment_method: paymentMethodOverride || 'Other',
            paid_by: null,
            year: selectedYear,
            month: periodType === 'month' ? periodValue : undefined,
            quarter: periodType === 'quarter' ? periodValue : undefined,
            rawText: line,
          });
          
          // Clear pending amount after using it
          pendingAmount = null;
        }
        continue;
      }
      
      // Pattern 2b: Pending transaction - we have pendingAmount stored, this line is merchant + balance
      if (pendingAmount && lineAmount && !parsedDate) {
        // Extract merchant name by removing the amount (balance) - match $X.XX or X.XX with decimal
        let description = line.replace(/([-])?\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, '')
          .replace(/([-])?(\d{1,3}(?:,\d{3})*\.\d{2,})/g, '').trim();
        description = description.replace(/:/g, '').trim();
        
        // Clean up description: remove UI elements and weird prefix characters
        description = description
          .replace(/pay\s+it/gi, '') // Remove "Pay It" button text
          .replace(/^[®¢%9$C\s]+/g, '') // Remove weird prefix characters at the start
          .replace(/[✓✔✅@]/g, '') // Checkmarks and @ symbols
          .replace(/[>→]/g, '') // Arrows
          .replace(/\s+/g, ' ') // Multiple spaces
          .trim();
        
        if (description.length >= 3 && description.toLowerCase() !== 'pending') {
          transactions.push({
            id: `screenshot-${Date.now()}-${transactions.length}`,
            date: currentDate || firstDateInText || todayDate, // Use currentDate, firstDateInText, or today as fallback
            amount: pendingAmount, // Use stored pending amount
            description: description,
            category: '',
            payment_method: paymentMethodOverride || 'Other',
            paid_by: null,
            year: selectedYear,
            month: periodType === 'month' ? periodValue : undefined,
            quarter: periodType === 'quarter' ? periodValue : undefined,
            rawText: line,
          });
          
          // Clear pending amount after using it
          pendingAmount = null;
        }
        continue;
      }
      
      // Pattern 3: Regular merchant + amount line (with current date set or first date in text)
      // In this format (merchant + amount under date header), amounts are transactions, not balances
      // So we don't need balance detection here - all amounts should be treated as transactions
      // Use firstDateInText if currentDate is not set yet, or today's date as final fallback
      const dateToUse = currentDate || firstDateInText || todayDate;
      if (lineAmount && !parsedDate && !pendingAmount) {
        // Extract merchant name by removing amount - match $X.XX or X.XX with decimal
        let description = line.replace(/([-])?\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, '')
          .replace(/([-])?(\d{1,3}(?:,\d{3})*\.\d{2,})/g, '').trim();
        description = description.replace(/:/g, '').trim();
        
        // Collect continuation lines
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          
          if (!nextLine || isHeaderLine(nextLine)) break;
          if (parseDate(nextLine, selectedYear)) break;
          
          const nextAmount = parseAmount(nextLine);
          if (nextAmount) {
            // If it looks like a balance, skip it and stop
            if (looksLikeBalance(nextAmount, lineAmount)) {
              j++;
            }
            break;
          }
          
          // If it's a continuation (phone, URL, location), add it
          if (isContinuation(nextLine) || nextLine.length < 30) {
            description += ' ' + nextLine;
            j++;
          } else {
            break;
          }
        }
        
        // Clean up description: remove UI elements and weird prefix characters
        description = description
          .replace(/^[®¢%9$C\s]+/g, '') // Remove weird prefix characters at the start (®¢, %¢, 9¢, $C, etc.)
          .replace(/[✓✔✅@]/g, '') // Checkmarks and @ symbols
          .replace(/[>→]/g, '') // Arrows
          .replace(/\s+/g, ' ') // Multiple spaces
          .trim();
        
        // Only skip if description is too short or suspicious (not just checking length >= 3)
        if (description.length >= 3 && !description.match(/^\d+$/)) {
          transactions.push({
            id: `screenshot-${Date.now()}-${transactions.length}`,
            date: dateToUse, // Use dateToUse instead of currentDate
            amount: lineAmount,
            description: description,
            category: '',
            payment_method: paymentMethodOverride || 'Other',
            paid_by: null,
            year: selectedYear,
            month: periodType === 'month' ? periodValue : undefined,
            quarter: periodType === 'quarter' ? periodValue : undefined,
            rawText: line,
          });
        }
        
        i = j - 1;
      }
    }

    return transactions;
  };

  // Preprocess image for better OCR accuracy
  const preprocessImage = async (imageDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Create canvas with 2x upscaling for better OCR accuracy
          const scaleFactor = 2;
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scaleFactor;
          canvas.height = img.height * scaleFactor;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Use high-quality image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw scaled image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Get image data for pixel manipulation
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Apply preprocessing: grayscale, contrast enhancement, and sharpening
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Convert to grayscale using luminance formula
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            
            // Apply contrast enhancement (increase contrast by 20%)
            const contrast = 1.2;
            const enhanced = Math.round(((gray / 255 - 0.5) * contrast + 0.5) * 255);
            
            // Clamp values to 0-255
            const final = Math.max(0, Math.min(255, enhanced));
            
            data[i] = final;     // R
            data[i + 1] = final; // G
            data[i + 2] = final; // B
            // Alpha channel (data[i + 3]) stays the same
          }
          
          // Apply simple sharpening kernel (unsharp mask effect)
          // We'll do a simple edge enhancement by detecting edges
          const sharpenedData = new Uint8ClampedArray(data);
          const kernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
          ];
          
          // Apply kernel (simplified - only to grayscale values)
          for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < canvas.width - 1; x++) {
              let sum = 0;
              let kernelIdx = 0;
              
              for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                  const idx = ((y + ky) * canvas.width + (x + kx)) * 4;
                  sum += data[idx] * kernel[kernelIdx];
                  kernelIdx++;
                }
              }
              
              const idx = (y * canvas.width + x) * 4;
              const sharpened = Math.max(0, Math.min(255, sum));
              sharpenedData[idx] = sharpened;
              sharpenedData[idx + 1] = sharpened;
              sharpenedData[idx + 2] = sharpened;
            }
          }
          
          // Put processed image data back
          imageData.data.set(sharpenedData);
          ctx.putImageData(imageData, 0, 0);
          
          // Convert back to data URL
          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  };

  // Process a single file
  const processSingleFile = async (file: File, fileIndex: number, totalFiles: number): Promise<ParsedTransaction[]> => {
    setProcessingFile(`${file.name} (${fileIndex + 1}/${totalFiles})`);
    
    // Convert File to data URL first (fixes DataCloneError with Web Workers)
    setOcrStatus(`Loading ${file.name}...`);
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Preprocess image for better OCR accuracy
    setOcrStatus(`Preprocessing ${file.name}...`);
    const preprocessedImageDataUrl = await preprocessImage(imageDataUrl);

    const worker = await createWorker('eng');
    
    setOcrStatus(`Processing ${file.name} (${fileIndex + 1}/${totalFiles})...`);
    
    // Don't use logger callback - it causes DataCloneError because React state setters can't be cloned
    const { data } = await worker.recognize(preprocessedImageDataUrl);

    await worker.terminate();

    // Store raw OCR text for this file
    setRawOcrTexts(prev => ({ ...prev, [file.name]: data.text }));

    // Parse transactions from OCR text
    const parsed = parseTransactions(data.text);
    
    // Update overall progress
    const fileProgress = ((fileIndex + 1) / totalFiles) * 100;
    setOcrProgress(fileProgress / 100);

    return parsed;
  };

  const handleProcessScreenshots = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setError(null);
    setOcrProgress(0);
    setOcrStatus('Starting OCR processing...');
    setPreview([]);
    setRawOcrTexts({});

    try {
      const allTransactions: ParsedTransaction[] = [];
      const errors: string[] = [];

      // Process files serially (one at a time)
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const parsed = await processSingleFile(file, i, files.length);
          
          if (parsed.length === 0) {
            errors.push(`No transactions found in ${file.name}`);
          } else {
            // Apply payment method override
            if (paymentMethodOverride) {
              parsed.forEach(t => {
                t.payment_method = paymentMethodOverride;
              });
            }
            
            // Add file source info to transaction ID for tracking
            parsed.forEach(t => {
              t.id = `${file.name}-${t.id}`;
            });
            
            allTransactions.push(...parsed);
          }
        } catch (err: any) {
          errors.push(`Failed to process ${file.name}: ${err.message || 'Unknown error'}`);
          console.error(`Error processing ${file.name}:`, err);
        }
      }

      if (allTransactions.length === 0) {
        const errorMsg = errors.length > 0 
          ? `No transactions found in any screenshot. ${errors.join('; ')}`
          : 'No transactions found in any screenshot.';
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Show any warnings but continue
      if (errors.length > 0) {
        console.warn('Processing warnings:', errors);
      }

      setPreview(allTransactions);
      setOcrStatus(`Complete - Found ${allTransactions.length} transactions from ${files.length} file(s)`);
      setOcrProgress(1);
    } catch (err: any) {
      setError(`Failed to process screenshots: ${err.message || 'Unknown error occurred'}`);
      console.error('OCR Error:', err);
    } finally {
      setLoading(false);
      setProcessingFile('');
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Prepare transactions for import (matching CSV import format)
      // The API expects category names, not IDs
      const transactions = preview.map(t => ({
        date: t.date || null,
        amount: t.amount,
        description: t.description,
        category: t.category || null, // Allow null/empty category for uncategorized transactions
        payment_method: t.payment_method || 'Other',
        paid_by: t.paid_by || null,
        year: selectedYear,
        month: periodType === 'month' ? periodValue : undefined,
        quarter: periodType === 'quarter' ? periodValue : undefined,
      }));

      // Send to API (reuse CSV import endpoint)
      const response = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transactions }),
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMessage = data.error || `Failed to import transactions (${response.status})`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      alert(`Successfully imported ${data.count} transactions!`);
      handleClearAll();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewEdit = (id: string, field: keyof ParsedTransaction, value: any) => {
    setPreview(prev => prev.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const handleDeletePreview = (id: string) => {
    setPreview(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="screenshot-file" className="block text-sm font-medium mb-1">
          Upload Screenshot
        </label>
        <input
          id="screenshot-file"
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          onChange={handleFileChange}
          className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-sm text-gray-500 mt-1">
          Upload a screenshot of your transaction list (PNG, JPG, or WEBP). The system will extract transaction details using OCR.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="import-year" className="block text-sm font-medium mb-1">
                Year *
              </label>
              <input
                id="import-year"
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                min="2000"
                max="2100"
                required
                className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="import-period-type" className="block text-sm font-medium mb-1">
                Period Type *
              </label>
              <select
                id="import-period-type"
                value={periodType}
                onChange={(e) => {
                  setPeriodType(e.target.value as 'month' | 'quarter' | 'year');
                  if (e.target.value === 'year') {
                    setPeriodValue(0);
                  } else if (e.target.value === 'month' && periodValue === 0) {
                    setPeriodValue(new Date().getMonth() + 1);
                  } else if (e.target.value === 'quarter' && periodValue === 0) {
                    setPeriodValue(Math.ceil((new Date().getMonth() + 1) / 3));
                  }
                }}
                required
                className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </div>

            <div>
              <label htmlFor="import-period-value" className="block text-sm font-medium mb-1">
                {periodType === 'month' ? 'Month *' : periodType === 'quarter' ? 'Quarter *' : 'Year'}
              </label>
              {periodType === 'month' ? (
                <select
                  id="import-period-value"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(parseInt(e.target.value))}
                  required
                  className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              ) : periodType === 'quarter' ? (
                <select
                  id="import-period-value"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(parseInt(e.target.value))}
                  required
                  className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Quarter</option>
                  <option value="1">Q1 (January - March)</option>
                  <option value="2">Q2 (April - June)</option>
                  <option value="3">Q3 (July - September)</option>
                  <option value="4">Q4 (October - December)</option>
                </select>
              ) : (
                <input
                  id="import-period-value"
                  type="text"
                  value="Full Year"
                  disabled
                  className="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              )}
            </div>

            <div>
              <label htmlFor="payment-method-override" className="block text-sm font-medium mb-1">
                Payment Method *
              </label>
              <select
                id="payment-method-override"
                value={paymentMethodOverride}
                onChange={(e) => {
                  const method = e.target.value as PaymentMethod | '';
                  setPaymentMethodOverride(method);
                  // Update all preview transactions
                  if (method && preview.length > 0) {
                    setPreview(prev => prev.map(t => ({ ...t, payment_method: method })));
                  }
                }}
                required
                className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select payment method</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.name}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            All imported transactions will be assigned to the selected year and period. Please select the payment method used for these transactions.
          </p>

          <button
            onClick={handleProcessScreenshots}
            disabled={loading || !paymentMethodOverride || files.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? `Processing... (${files.length} file${files.length !== 1 ? 's' : ''})` : `Process ${files.length} Screenshot${files.length !== 1 ? 's' : ''}`}
          </button>

          {loading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">{ocrStatus}</p>
              {processingFile && (
                <p className="text-xs text-gray-500">Currently processing: {processingFile}</p>
              )}
            </div>
          )}

          {Object.keys(rawOcrTexts).length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showRawText ? 'Hide' : 'Show'} Raw OCR Text ({Object.keys(rawOcrTexts).length} file{Object.keys(rawOcrTexts).length !== 1 ? 's' : ''})
              </button>
              {showRawText && (
                <div className="space-y-4">
                  {Object.entries(rawOcrTexts).map(([filename, text]) => (
                    <div key={filename} className="p-4 bg-gray-100 border rounded-lg">
                      <div className="text-xs font-semibold text-gray-700 mb-2">{filename}</div>
                      <pre className="text-xs whitespace-pre-wrap font-mono max-h-64 overflow-auto">{text}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {preview.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm font-medium">
                Preview ({preview.length} transaction{preview.length !== 1 ? 's' : ''} found from {files.length} file{files.length !== 1 ? 's' : ''}):
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-[800px] md:min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28 md:w-32">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 min-w-[200px] md:min-w-[300px]">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-32 md:w-40">Category</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20 md:w-24">Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-sm w-28 md:w-32">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => handlePreviewEdit(row.id, 'date', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm min-w-[200px] md:min-w-[300px]">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => handlePreviewEdit(row.id, 'description', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm w-32 md:w-40">
                          <select
                            value={row.category}
                            onChange={(e) => handlePreviewEdit(row.id, 'category', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select category</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.name}>
                                {cat.name} ({cat.type})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-sm text-right w-20 md:w-24">
                          <input
                            type="text"
                            value={row.amount}
                            onChange={(e) => handlePreviewEdit(row.id, 'amount', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() => handleDeletePreview(row.id)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleImport}
                disabled={loading}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Importing...' : `Import ${preview.length} Transactions`}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

