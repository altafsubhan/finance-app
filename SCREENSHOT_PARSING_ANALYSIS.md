# Screenshot Parsing Requirements Analysis

## Overview
The goal is to extract transaction data from screenshots containing:
- **Description** (always present)
- **Amount** (always present)
- **Date** (usually present)
- **Payment Method** (user provides during upload)
- **Category** (user fills in manually after parsing)

## Technical Components Needed

### 1. OCR (Optical Character Recognition)

**Options:**

#### A. Client-Side OCR (Recommended for MVP - Free)
- **Tesseract.js** 
  - ✅ Completely free, no API costs
  - ✅ Runs entirely in browser (no server processing needed)
  - ✅ Privacy-friendly (images never leave user's device)
  - ⚠️ Less accurate than cloud services (~70-90% accuracy)
  - ⚠️ Larger bundle size (~2-3MB for language files)
  - ⚠️ Slower processing (5-15 seconds per image)
  - ⚠️ Requires good image quality

**Implementation:**
```javascript
import Tesseract from 'tesseract.js';

const { data: { text } } = await Tesseract.recognize(imageFile, 'eng', {
  logger: m => console.log(m) // Progress logging
});
```

#### B. Server-Side OCR APIs (Better accuracy, but cost considerations)
- **Google Cloud Vision API** - High accuracy, pay-per-use (~$1.50 per 1000 images)
- **AWS Textract** - Good accuracy, pay-per-use
- **Azure Computer Vision** - Similar pricing
- **OCR.space API** - Free tier available (limited requests)

**Recommendation:** Start with **Tesseract.js** for MVP (free, privacy-friendly). Upgrade to cloud APIs later if accuracy is insufficient.

### 2. Text Parsing & Pattern Matching

After OCR extracts raw text, we need to identify:
- **Dates**: Multiple formats to support
  - `MM/DD/YYYY` (e.g., `01/15/2024`)
  - `DD/MM/YYYY` (e.g., `15/01/2024`)
  - `YYYY-MM-DD` (e.g., `2024-01-15`)
  - `Month DD, YYYY` (e.g., `January 15, 2024`)
  - `Mon DD` (e.g., `Jan 15`)
  - `DD Mon` (e.g., `15 Jan`)
  
- **Amounts**: Various formats
  - `$12.34`
  - `12.34`
  - `(12.34)` or `-12.34` for negatives/debits
  - `$1,234.56` (with thousands separator)
  - `12.34 USD`
  - Currency symbols: `$`, `€`, `£`, etc.

- **Descriptions**: Everything else (merchant names, transaction notes, etc.)

**Challenges:**
- OCR text may have spacing issues, line breaks, misread characters
- Amounts might be on same line or different line from description
- Dates might be at transaction level or header level
- Multiple transactions per screenshot (statement/list views)

### 3. Transaction Extraction Logic

**Approach:**
1. **Line-by-line parsing**: Split OCR text into lines
2. **Pattern matching**: Use regex to identify dates and amounts per line
3. **Grouping**: Associate amounts with descriptions on same/nearby lines
4. **Validation**: Check for reasonable date ranges, valid amounts

**Example Flow:**
```
Raw OCR Text:
"01/15/2024 AMAZON.COM $45.99
01/16/2024 STARBUCKS CO $5.47
01/17/2024 GROCERY STORE $123.45"

Parsed Result:
[
  { date: "2024-01-15", description: "AMAZON.COM", amount: "45.99" },
  { date: "2024-01-16", description: "STARBUCKS CO", amount: "5.47" },
  { date: "2024-01-17", description: "GROCERY STORE", amount: "123.45" }
]
```

### 4. User Interface Flow

Similar to CSV import, but with additional steps:

1. **Upload Screenshot(s)**
   - Single or multiple files
   - Support common formats: PNG, JPG, JPEG, WEBP
   - Show upload progress

2. **Processing/OCR Stage**
   - Show progress indicator (OCR can take 5-15 seconds)
   - Display extracted raw text (optional, for debugging)

3. **Preview & Review Stage**
   - Show parsed transactions in a table (like CSV preview)
   - Allow inline editing:
     - ✅ Description (auto-filled, editable)
     - ✅ Amount (auto-filled, editable)
     - ✅ Date (auto-filled, editable)
     - ❌ Category (empty, user fills in)
     - ✅ Payment Method (user selects for all transactions)
   - Highlight any fields that couldn't be parsed

4. **User Corrections**
   - Manual edits for incorrectly parsed fields
   - Option to delete incorrectly parsed transactions
   - Option to add missing transactions manually

5. **Period Selection** (Same as CSV import)
   - Year selection
   - Period Type (Month/Quarter/Year)
   - Period Value

6. **Import**
   - Save all transactions
   - Show success/error messages

### 5. Implementation Considerations

#### A. Image Preprocessing (Improve OCR accuracy)
- **Image optimization**: Resize large images, normalize orientation
- **Contrast enhancement**: Improve text clarity
- **Noise reduction**: Remove artifacts that confuse OCR
- **Skew correction**: Fix rotated images

**Libraries:**
- `sharp` (Node.js server-side) or
- `canvas` API (client-side) for basic image manipulation

#### B. Error Handling
- OCR failures (image too blurry, no text detected)
- Parsing failures (can't identify dates/amounts)
- Partial parsing (some transactions parsed, others not)
- Invalid data (dates in future, amounts too large)

#### C. User Experience
- Show confidence scores for parsed fields (if available from OCR)
- Highlight uncertain parses for user review
- Batch processing: Process multiple screenshots sequentially
- Save draft state: Allow user to come back and finish editing

#### D. Performance
- Client-side OCR: Process images one at a time to avoid browser freezing
- Show progress: Update UI during OCR processing
- Debounce edits: Don't re-process on every keystroke

### 6. Required Libraries/Packages

```json
{
  "dependencies": {
    "tesseract.js": "^5.0.0"  // OCR engine
  },
  "devDependencies": {
    "@types/tesseract.js": "^4.1.0"  // TypeScript types
  }
}
```

**Optional (for image preprocessing):**
- `sharp` - Server-side image processing (if we move OCR to server)
- Or use browser Canvas API for client-side preprocessing

### 7. Data Structure

```typescript
interface ParsedScreenshotTransaction {
  id: string; // Temporary ID for UI
  date: string | null; // Parsed date, or null if not found
  amount: string; // Parsed amount as string
  description: string; // Parsed description
  category_id: string; // Empty, user fills in
  payment_method: PaymentMethod; // User selects
  paid_by: PaidBy | null; // Usually null for screenshots
  confidence?: number; // OCR confidence (0-100) if available
  rawText?: string; // Original OCR text for this transaction
  errors?: string[]; // Parsing errors/warnings
}
```

### 8. API Endpoint

We can reuse the existing `/api/transactions/import` endpoint since it already handles:
- Array of transactions
- Category mapping
- Period fields (year, month, quarter)

Just need to ensure parsed screenshot transactions match the expected format.

### 9. Limitations & Edge Cases

**Known Limitations:**
1. **OCR Accuracy**: Not 100% accurate, especially with:
   - Low-quality images
   - Handwritten text
   - Unusual fonts
   - Complex layouts
   - Screenshots with UI elements (buttons, icons)

2. **Parsing Ambiguity**:
   - Same-line vs. multi-line date/amount/description
   - Header dates vs. transaction dates
   - Multiple transactions sharing same date (statement format)
   - Currency symbols that look like letters

3. **Screenshot Types**:
   - Single transaction receipts ✅ Best case
   - Bank statement lists ✅ Good case
   - Credit card app screenshots ⚠️ May have UI clutter
   - Photos of receipts ❌ Worse accuracy (lighting, angle)

**Mitigation Strategies:**
- Always show preview for user confirmation
- Make all fields editable
- Provide "raw OCR text" view for debugging
- Allow manual transaction entry as fallback
- Start with best-case scenarios (clear statement screenshots)

### 10. MVP Scope Recommendation

**Phase 1 (MVP):**
1. ✅ Single screenshot upload
2. ✅ Client-side OCR with Tesseract.js
3. ✅ Basic parsing (date, amount, description)
4. ✅ Preview table with inline editing
5. ✅ Payment method selection (applies to all)
6. ✅ Category selection per transaction
7. ✅ Period selection (same as CSV import)
8. ✅ Import to database

**Phase 2 (Future Enhancements):**
- Multiple screenshot batch processing
- Server-side OCR with cloud APIs (better accuracy)
- Image preprocessing for better OCR
- Confidence scores for parsed fields
- Machine learning for better parsing patterns
- Support for more screenshot formats/layouts
- Mobile app for direct camera capture

## Next Steps

1. **Get sample screenshots** from user to understand:
   - Typical layouts/formats
   - Common date/amount formats
   - Text clarity/quality
   
2. **Prototype OCR parsing** with Tesseract.js:
   - Test accuracy on real screenshots
   - Develop parsing regex patterns
   - Identify edge cases

3. **Build UI component** (similar to CSVImport.tsx):
   - ScreenshotUpload component
   - OCR processing with progress
   - Preview/Edit table
   - Import functionality

4. **Iterate based on accuracy**:
   - Refine parsing patterns
   - Add image preprocessing if needed
   - Consider cloud OCR if Tesseract.js accuracy insufficient

