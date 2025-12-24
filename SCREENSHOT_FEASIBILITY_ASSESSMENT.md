# Screenshot Parsing Feasibility Assessment

## Sample Screenshot Analysis

Based on the 5 sample screenshots provided, here's a detailed feasibility assessment:

### Screenshot Patterns Identified

#### 1. Date Formats Observed:
- ✅ `MM/DD/YYYY` (e.g., `12/15/2025`, `12/14/2025`) - **BILT Mastercard**
- ✅ `Mon DD, YYYY` (e.g., `Dec 18, 2025`, `Dec 17, 2025`) - **Bank of America, Chase**
- ✅ `Dec 20, 2025` format (full month name) - **Chase Sapphire**
- ✅ `Pending` status (no date) - **Bank of America**

#### 2. Amount Formats Observed:
- ✅ `$X.XX` (e.g., `$4.78`, `$55.00`, `$115.09`)
- ✅ `-$X.XX` for debits (e.g., `-$330.74`, `-$10.59`) - **Bank of America**
- ✅ Amounts consistently right-aligned
- ✅ Two decimal places standard

#### 3. Description/Merchant Formats:
- ✅ Single-line merchant names (e.g., `VOYAGER CAFE QPS SANTA CLARA CA`)
- ✅ Multi-line descriptions (e.g., `IKEA 484781683 888-434-4532 MD`)
- ✅ Special characters: `*`, `\`, `/` (e.g., `TST*CRACKED & BATTERED`, `SQ *LINEA CAFFE`)
- ✅ Location suffixes (e.g., `SAN FRANCISCOCA`, `SANTA CLARA CA`, `FREMONT`)
- ✅ Truncated merchant names with `...` (e.g., `Sapphire Prefer...`)

#### 4. Layout Patterns:
- ✅ **Column-based layout** (Date | Description | Amount) - **BILT Mastercard**
- ✅ **Grouped by date headers** (Date header, then transactions) - **Chase**
- ✅ **Mixed pending + dated** (Pending section, then dated section) - **Bank of America**
- ✅ **List with icons** (Icon + Description + Amount) - **Chase**
- ✅ **Running balances** shown below amounts - **Bank of America**

### Feasibility Assessment: **✅ HIGHLY FEASIBLE**

#### Strengths (What Makes This Work):

1. **Clear Text Structure**
   - All screenshots have high contrast text (dark text on light background)
   - Standard fonts (no handwritten text)
   - Clear separation between transactions
   - Consistent formatting within each app

2. **Predictable Patterns**
   - Amounts always end with `.XX` (two decimals)
   - Dollar signs consistently present
   - Dates follow standard formats
   - Merchant names are clearly separated from amounts

3. **Good OCR Candidate**
   - High-resolution mobile screenshots (not photos)
   - Clean backgrounds (no shadows, angles, or lighting issues)
   - Standard typography (not stylized fonts)
   - No overlapping elements obscuring text

4. **Parsing Complexity: Medium**
   - Date patterns are limited and identifiable
   - Amount patterns are very consistent (`$X.XX` or `-$X.XX`)
   - Description extraction is straightforward (everything between date and amount)

#### Challenges to Address:

1. **Date Header vs Transaction Date**
   - **Chase screenshots**: Date appears as a header, transactions below share that date
   - **Solution**: Detect date headers (typically larger/bolder), associate following transactions with that date until next date header

2. **Multi-line Descriptions**
   - **Bank of America**: Some merchants have phone numbers, store IDs on second line
   - **Solution**: Combine consecutive non-date, non-amount lines as description

3. **Negative Amounts (Debits)**
   - **Bank of America**: Uses `-$X.XX` format
   - **Solution**: Detect negative sign, preserve in amount parsing

4. **Pending Transactions**
   - **Bank of America**: Shows "Pending" instead of date
   - **Solution**: Treat as current date or allow user to specify date

5. **Running Balances**
   - **Bank of America**: Shows balance after each transaction
   - **Solution**: Filter out balance lines (smaller font, appears after amount, no currency symbol or different pattern)

6. **UI Elements (Icons, Buttons)**
   - **Chase**: Fork/spoon icons, chevrons, notification badges
   - **Solution**: OCR will ignore these (they're not text), but may affect layout detection

7. **Special Characters in Merchant Names**
   - `*`, `\`, `/` appear in merchant names (e.g., `TST*CRACKED`, `SQ *LINEA`)
   - **Solution**: Preserve these in descriptions (they're part of merchant names)

### Recommended Parsing Strategy

#### Phase 1: OCR Extraction
```javascript
// Tesseract.js will extract raw text like:
"12/15/2025 VOYAGER CAFE QPS SANTA CLARA CA $4.78
12/15/2025 VOYAGER CAFE QPS SANTA CLARA CA $4.00
12/14/2025 TST*CRACKED & BATTERED SAN FRANCISCOCA $55.00"
```

#### Phase 2: Line-by-Line Processing
1. Split OCR text into lines
2. For each line:
   - Try to extract date (match date patterns)
   - Try to extract amount (match `$X.XX` pattern)
   - Extract description (everything else)

#### Phase 3: Pattern Matching Rules

**Date Detection Regex:**
```javascript
// MM/DD/YYYY
/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/

// Mon DD, YYYY (full month name)
/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\b/

// Dec DD, YYYY (abbreviated)
/\b(Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov)\s+(\d{1,2}),\s+(\d{4})\b/
```

**Amount Detection Regex:**
```javascript
// Positive amounts: $X.XX
/-\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/

// Negative amounts: -$X.XX
/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/

// Handle both
/([-])?\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/
```

**Description Extraction:**
- Everything between date and amount (or start of line to amount if no date)
- Trim whitespace, preserve special characters
- Combine multi-line descriptions

#### Phase 4: Transaction Grouping Logic

**For Column-based layouts (BILT Mastercard):**
```
Line 1: Date Description Amount
Line 2: Date Description Amount
→ Each line = one transaction
```

**For Header-based layouts (Chase):**
```
Line 1: "Dec 20, 2025" (date header)
Line 2: Merchant Amount
Line 3: Merchant Amount
Line 4: "Dec 19, 2025" (date header)
Line 5: Merchant Amount
→ Associate transactions with preceding date header
```

**For Mixed layouts (Bank of America):**
```
Line 1: "Pending" (status header)
Line 2: Merchant Amount Balance
Line 3: "Dec 18, 2025" (date header)
Line 4: Merchant Amount Balance
→ Detect headers, use current date for "Pending"
```

### Expected Accuracy Estimates

| Aspect | Expected Accuracy | Notes |
|--------|------------------|-------|
| **OCR Text Extraction** | 85-95% | High-quality screenshots, good contrast |
| **Date Parsing** | 90-95% | Limited date formats, clear patterns |
| **Amount Parsing** | 95-98% | Very consistent format, clear dollar signs |
| **Description Extraction** | 80-90% | May miss some multi-line cases, special chars |
| **Overall Transaction Detection** | 85-90% | Good, but some edge cases need manual review |

### Recommendations

#### ✅ **Proceed with Implementation**

**MVP Implementation Plan:**

1. **Start with Tesseract.js** (client-side, free)
   - Test on all 5 sample screenshots
   - Measure actual OCR accuracy

2. **Implement Core Parsing:**
   - Date pattern matching (3 formats identified)
   - Amount pattern matching (positive/negative)
   - Description extraction (everything else)

3. **Handle Layout Variations:**
   - Detect date headers vs transaction dates
   - Handle multi-line descriptions
   - Filter out running balances

4. **Build Preview/Edit UI:**
   - Show parsed transactions in editable table
   - Allow corrections before import
   - Payment method selection (applies to all)
   - Category selection per transaction

5. **Iterate Based on Results:**
   - Test with more screenshots
   - Refine parsing patterns
   - Add layout-specific rules if needed

#### ⚠️ **Known Limitations:**

1. **OCR Accuracy:**
   - Not 100% perfect (expect 85-95% for text)
   - May misread similar characters (`0` vs `O`, `1` vs `l`)
   - May struggle with very small text

2. **Parsing Edge Cases:**
   - Complex multi-line descriptions
   - Unusual date formats not yet seen
   - Special layouts we haven't encountered

3. **User Review Required:**
   - Always show preview for user confirmation
   - Make all fields editable
   - Expect some manual corrections

### Next Steps

1. **Prototype OCR + Parsing:**
   - Install Tesseract.js
   - Create test script to process sample screenshots
   - Measure accuracy on real data

2. **Build UI Component:**
   - Screenshot upload
   - OCR processing with progress
   - Preview/edit table
   - Import functionality

3. **Test & Iterate:**
   - Process all 5 sample screenshots
   - Refine parsing patterns
   - Handle edge cases
   - Improve accuracy

**Conclusion: This is highly feasible for MVP. The screenshots have clear, consistent formatting that OCR and parsing can handle well. Expect 85-90% accuracy with user review for corrections.**

