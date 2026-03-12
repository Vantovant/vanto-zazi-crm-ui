# Vanto Zazi CRM — Import System Full Specification

**Version:** 2.0.0  
**Last Updated:** 2026-03-12  
**Status:** Production-Ready with AI-Powered Smart Mapping

---

## 1. Overview

The Vanto Zazi CRM Import System is a comprehensive, AI-assisted data ingestion pipeline designed for APLGO MLM business operations. It supports CSV and Excel (XLSX/XLS) formats with intelligent column mapping, duplicate detection, and lifecycle-aware classification.

### 1.1 Core Value Proposition

- **AI-Powered Smart Mapping:** Automatically maps spreadsheet columns to CRM fields using LLM analysis
- **Intelligent Duplicate Handling:** Matches by normalized phone/email with safe merge strategies
- **Lifecycle-Aware Classification:** Auto-detects Expired members, Purchase_Status vs Purchase_Nostatus
- **Flexible File Support:** CSV, XLSX, XLS with multi-sheet detection
- **Visual Preview:** Live preview of mapped data before import
- **Batch Processing:** Handles large files with progress tracking

---

## 2. Import Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Import Flow                              │
│                                                                 │
│   ┌─────────┐   ┌─────────────┐   ┌─────────────────────────┐  │
│   │ Upload  │──▶│ AI Analysis │──▶│ Column Mapping Review   │  │
│   │  File   │   │ (smart-     │   │ (User can adjust)       │  │
│   └─────────┘   │ import EF)  │   └─────────────────────────┘  │
│                 └─────────────┘              │                   │
│                                              ▼                   │
│   ┌─────────┐   ┌─────────────┐   ┌─────────────────────────┐  │
│   │ Complete│◀──│ Preview     │◀──│ Import Execution      │  │
│   │ Status  │   │ Verification│   │ (Batch processing)    │  │
│   └─────────┘   └─────────────┘   └─────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Supported File Formats

### 3.1 CSV (Comma-Separated Values)

- **Encoding:** UTF-8 preferred
- **Delimiter:** Comma (`,`), supports quoted values
- **Quote Handling:** Double quotes (`"`), escaped quotes (`""`)
- **Header Row:** Required in first row
- **Line Endings:** CRLF (`\r\n`) or LF (`\n`)

### 3.2 Excel (XLSX / XLS)

- **Library:** SheetJS (xlsx) for parsing
- **Sheet Selection:** First sheet processed by default
- **Multi-sheet Detection:** Sheet names returned for UI display
- **Data Types:** All values converted to strings for consistency

---

## 4. Column Mapping System

### 4.1 AI-Powered Smart Mapping (Primary)

**Edge Function:** `smart-import`

**Process:**
1. Extract first 5 rows as sample data
2. Send headers + sample rows to AI
3. AI analyzes patterns and suggests mappings with confidence scores
4. Confidence threshold: ≥0.4 for automatic application

**AI Model:** `google/gemini-3-flash-preview` (via Lovable AI Gateway)

**Fallback Chain:**
1. Lovable AI Gateway (default)
2. User's Gemini API key (if configured)
3. User's OpenAI API key (if configured)

**Request Payload:**
```json
{
  "headers": ["Name", "Phone", "Email", "Date"],
  "sampleRows": [
    ["Thabo Molefe", "+27 82 345 6789", "thabo@email.com", "2026-01-15"],
    ["Jane Smith", "+27 71 123 4567", "jane@email.com", "15/01/2026"]
  ]
}
```

**Response Format:**
```json
{
  "mappings": [
    {
      "spreadsheetColumn": "Name",
      "crmField": "FullName",
      "confidence": 0.95,
      "reason": "Direct header match with FullName field",
      "transformNote": null
    }
  ],
  "summary": "Successfully mapped 5 columns with high confidence"
}
```

### 4.2 Fallback Auto-Mapping (Rule-Based)

If AI is unavailable, the system uses case-insensitive fuzzy matching with aliases:

| CRM Field | Primary Aliases | Secondary Aliases |
|-----------|----------------|-------------------|
| FullName | name, fullname | namesurname, surname, firstname, lastname |
| PhoneNumber | phone, mobile, cell | tel, telephone, cellphone, contactnumber |
| EmailAddress | email | emailaddress, emailid |
| DateCaptured | date, datecaptured | enrollmentdate, activationdate |
| LeadTemperature | temperature, leadtemp | temp |
| LeadType | leadtype, type | - |
| APLGoID | aplgoid, aplid | associateid, associatesid |
| GOStatus | gostatus | - |

**Normalization:** Lowercase, remove spaces/underscores/dots/hyphens

---

## 5. Data Transformation Rules

### 5.1 Date Normalization

**Input Formats Supported:**
- ISO: `2026-01-15` (YYYY-MM-DD)
- European: `15/01/2026` or `15.01.2026` (DD/MM/YYYY)
- US: `01/15/2026` (MM/DD/YYYY)

**Output:** Always `YYYY-MM-DD`

**Fallback:** Current date if unparseable

### 5.2 Phone Normalization

**South African Market Rules:**
- Leading `0` converted to `27` (e.g., `082 345 6789` → `+27 82 345 6789`)
- Spaces preserved in display, stripped for matching

**Storage:**
- `phone_number`: Original format (preserved)
- `phone_normalized`: Stripped digits for deduplication

### 5.3 Composite Column Parsing

**"Contacts" Column Format:**
```
"Country, Email, Phone" → Parsed into separate fields
Example: "South Africa, user@email.com, +27 82 123 4567"
```

**Detection:** Comma-separated with email pattern and phone pattern

### 5.4 Special Classification Triggers

#### Expired Members Detection

**Trigger:** Header contains `date of making inactive` (case-insensitive)

**Auto-Applied Values:**
```
lead_type = "Expired"
registration_status = "Activated"  (implied they were once active)
```

#### GO-Status Classification

**Ranked Statuses (Purchase_Status):**
- `promoter`, `diamond`, `builder`, `mentor`, `associate`, `vip`

**No-Status Variants (Purchase_Nostatus):**
- `no status`, `no_status`, `nostatus`

**Auto-Applied:**
```javascript
if (rankedStatuses.some(r => goStatus.includes(r))) {
  lead_type = "Purchase_Status";
} else if (noStatusVariants.includes(goStatus)) {
  lead_type = "Purchase_Nostatus";
}
```

---

## 6. Duplicate Detection & Handling

### 6.1 Matching Strategy

**Primary Key (in order):**
1. `phone_normalized` - Exact match on normalized phone
2. `email_normalized` - Exact match on normalized email

**Process:**
```
For each row:
  1. Normalize phone/email from spreadsheet
  2. Query contacts table for existing match
  3. If match found → UPDATE with safe merge
  4. If no match → INSERT new contact
```

### 6.2 Safe Merge Strategy

**Function:** `safeMerge(existing, incoming)`

**Rules:**
- Empty incoming values don't overwrite existing data
- Non-empty incoming values replace existing
- `user_id`, `id`, `created_at` never updated
- `updated_at` auto-set by trigger

**Example:**
```javascript
existing:  { full_name: "Thabo", phone_number: "+27 82 123 4567", city: "Joburg" }
incoming:  { full_name: "Thabo Molefe", phone_number: "", city: "" }
merged:    { full_name: "Thabo Molefe", city: "Joburg" }  // phone and city preserved
```

### 6.3 Import Results Tracking

**Counters:**
- `inserted` - New contacts created
- `updated` - Existing contacts merged
- `failed` - Errors during processing

**Progress Updates:** Every 10 rows to prevent UI blocking

---

## 7. CRM Schema Mapping

### 7.1 Field Mapping (Spreadsheet → Database)

| Spreadsheet Field | Database Column | Required | Default |
|-------------------|-----------------|----------|---------|
| FullName | full_name | Yes | - |
| PhoneNumber | phone_number | No | '' |
| EmailAddress | email_address | No | '' |
| DateCaptured | date_captured | No | CURRENT_DATE |
| City | city | No | '' |
| Province | province | No | '' |
| State | state | No | '' |
| Country | country | No | 'South Africa' |
| LeadTemperature | lead_temperature | No | 'Warm' |
| CommunicationStatus | communication_status | No | 'New' |
| RegistrationStatus | registration_status | No | 'Not Registered' |
| LeadType | lead_type | No | 'Prospect' |
| InterestLevel | interest_level | No | 'Medium' |
| FocusArea | focus_area | No | 'Health Transformation' |
| LeadPath | lead_path | No | 'Not sure yet' |
| SponsorName | sponsor_name | No | '' |
| AssignedTo | assigned_to | No | '' |
| ActionTaken | action_taken | No | '' |
| NextAction | next_action | No | '' |
| MeetingTime | meeting_time | No | '' |
| APLGoID | aplgo_id | No | '' |
| AssociateStatus | associate_status | No | '' |
| AdditionalNotes | additional_notes | No | '' |
| GOStatus | go_status | No | '' |

### 7.2 Lead Type Values (Dropdown)

- `Prospect`
- `Registered_Nopurchase`
- `Purchase_Nostatus`
- `Purchase_Status`
- `Expired`
- `Customer`
- `Distributor`

### 7.3 Registration Status Values

- `Registered`
- `Not Registered`
- `Activated`

---

## 8. Import User Interface Flow

### 8.1 Step 1: Upload

**Accepts:** Drag & drop or file picker
**Validations:**
- File extension (.csv, .xlsx, .xls)
- File size (browser-limited)
- Minimum 1 row with headers

**Error States:**
- "Could not find any data in the file"
- "Could not read the file. Please upload a valid CSV or Excel file"

### 8.2 Step 2: AI Analysis

**UI State:** "Analyzing with AI..." spinner
**Duration:** Typically 2-5 seconds
**Fallback:** If AI fails, auto-switches to rule-based mapping with warning

### 8.3 Step 3: Column Mapping

**UI Components:**
- Dropdown per CRM field showing available columns
- AI confidence badges (High/Medium/Low)
- Transform notes display
- Summary text from AI

**User Actions:**
- Adjust any mapping
- Skip fields by selecting "-- Unmapped --"

### 8.4 Step 4: Preview

**Display:**
- First 5 rows with applied mappings
- CRM field names as column headers
- Visual confirmation of data quality

### 8.5 Step 5: Import Execution

**UI:**
- Progress bar with "Processing row X of Y"
- Real-time counters (inserted/updated/failed)
- Cancel capability (at batch boundaries)

### 8.6 Step 6: Complete

**Summary Card:**
```
✓ Import Complete
├── 45 New contacts added
├── 12 Existing contacts updated
└── 3 Failed to import
```

**Actions:**
- Download failed rows
- Import another file
- View contacts in CRM

---

## 9. Export System

### 9.1 Supported Formats

- CSV (default)
- XLSX (Excel)

### 9.2 Export Types

| Export | Description | Record Count |
|--------|-------------|--------------|
| Contacts | All prospects and contacts | User's contact count |
| Orders | Order history and transactions | User's order count |

### 9.3 ZAZI Mail Export (ConvertKit Format)

**Specialized exports for email marketing:**

1. **Activation Only**
   - Contacts with `registration_status = 'Activated'`
   - Lifecycle tag: `activated-members`

2. **GO-Status Ranked**
   - Contacts with ranked GO-Status (Promoter, Diamond, etc.)
   - Lifecycle tag: `ranked-associates`

3. **Purchase — No Status**
   - `lead_type = 'Purchase_Nostatus'`
   - Lifecycle tag: `purchased-no-rank`

4. **Expired Members**
   - `lead_type = 'Expired'`
   - Lifecycle tag: `expired-reactivation`

**Derived Tags:**
```javascript
const lifecycleTags = [
  lead_temperature.toLowerCase(),           // hot, warm, cold
  lead_type.toLowerCase(),                  // prospect, expired, etc.
  registration_status.replace(/\s/g, '-').toLowerCase(),
  interest_level.toLowerCase(),             // high, medium, low
  focus_area.replace(/\s/g, '-').toLowerCase(),
  lead_path.toLowerCase()                   // customer, distributor
].filter(Boolean);
```

---

## 10. Error Handling

### 10.1 Import Errors

| Error Code | Meaning | Action |
|------------|---------|--------|
| 23505 | Unique constraint violation | Retry as update |
| AI 429 | Rate limit | Show "try again later" |
| AI 402 | AI credits exhausted | Fallback to rule-based |
| Parse Error | Invalid file format | Show validation error |

### 10.2 Row-Level Failures

**Skipped Rows:**
- Empty `FullName` (required field)
- Database constraint violations
- Data type mismatches

**Logged:** Console error with row index and error message

---

## 11. Security & RLS

### 11.1 Row-Level Security

All import operations respect RLS policies:

```sql
-- Users can only insert their own contacts
CREATE POLICY "Users can create their own contacts" 
ON public.contacts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own contacts
CREATE POLICY "Users can update their own contacts" 
ON public.contacts FOR UPDATE 
USING (auth.uid() = user_id);
```

### 11.2 Data Isolation

- Each user only sees/imports their own contacts
- Cross-user duplicate detection is NOT performed
- No admin override for bulk user imports

---

## 12. Performance Specifications

### 12.1 Batch Processing

- **Batch Size:** 1 row at a time (sequential for dedup checking)
- **Yield Interval:** Every 10 rows (`await new Promise(r => setTimeout(r, 10))`)
- **UI Updates:** Per-row progress bar updates

### 12.2 File Size Limits

- **Browser limit:** ~20MB ( imposed by browser/FileReader )
- **Recommended:** <5,000 rows for optimal UX
- **Large files:** Processable but slower due to sequential upsert logic

### 12.3 AI Timeout

- **Expected:** 2-5 seconds for analysis
- **Timeout handling:** Fallback to rule-based after failure
- **Retry logic:** None (single attempt)

---

## 13. Integration with CRM

### 13.1 Post-Import Actions

After successful import:
1. `refetchContacts()` called to refresh CRM context
2. Orders page data refreshed if orders imported
3. Contact activities NOT auto-created (manual logging only)

### 13.2 Data Relationships

- Contacts → Orders (via `contact_id` FK)
- Contacts → Activities (via `contact_id` FK)
- Contacts → Follow-up States (via `contact_id` FK)

---

## 14. Template Downloads

### 14.1 Contacts Template

```csv
FullName,PhoneNumber,EmailAddress,DateCaptured,City,Province,Country,LeadTemperature,CommunicationStatus,RegistrationStatus,LeadType,InterestLevel,FocusArea,LeadPath,SponsorName,AssignedTo,ActionTaken,NextAction,MeetingTime,APLGoID,AssociateStatus,AdditionalNotes,GOStatus
Thabo Molefe,+27 82 345 6789,thabo@example.com,2026-01-15,Johannesburg,Gauteng,South Africa,Warm,New,Not Registered,Prospect,Medium,Health Transformation,Not sure yet,,,,,,,,,
```

### 14.2 Orders Template

```csv
contact_name,product,quantity,amount,order_date,pv_amount,purchase_type,status,sales_channel,source
Thabo Molefe,Product Name,1,100.00,2026-01-15,50,Activity,Pending,Online,manual
```

---

## 15. API Specification

### 15.1 Smart Import Edge Function

**Endpoint:** `POST /functions/v1/smart-import`

**Headers:**
```
Authorization: Bearer <supabase_token>
Content-Type: application/json
```

**Request:**
```json
{
  "headers": ["Column A", "Column B", "Column C"],
  "sampleRows": [
    ["Value 1", "Value 2", "Value 3"],
    ["Value 4", "Value 5", "Value 6"]
  ],
  "userApiKeys": {
    "preferred_provider": "lovable",
    "gemini_api_key": null,
    "openai_api_key": null
  }
}
```

**Response:**
```json
{
  "mappings": [
    {
      "spreadsheetColumn": "Column A",
      "crmField": "FullName",
      "confidence": 0.92,
      "reason": "Header resembles common name field",
      "transformNote": null
    }
  ],
  "summary": "Analyzed 3 columns and mapped 2 with high confidence"
}
```

**Error Responses:**
- `401` - Unauthorized (invalid/missing token)
- `429` - Rate limit exceeded
- `402` - AI credits exhausted
- `500` - AI service unavailable

---

## 16. Testing Checklist

### 16.1 Import Tests

- [ ] Upload CSV with European date format (DD/MM/YYYY)
- [ ] Upload Excel file with multiple sheets
- [ ] Verify AI mapping confidence badges display
- [ ] Adjust column mapping manually
- [ ] Import with duplicate phone numbers (verify update path)
- [ ] Import with "Date of making inactive" column (verify Expired classification)
- [ ] Import with GO-Status = "Diamond" (verify Purchase_Status)
- [ ] Import with empty FullName rows (verify skip)
- [ ] Test with 1000+ rows (verify progress tracking)

### 16.2 Export Tests

- [ ] Export contacts as CSV
- [ ] Export contacts as XLSX
- [ ] Export ZAZI Mail "Expired Members" list
- [ ] Verify lifecycle tags in export

---

## 17. Known Limitations

1. **Sequential Processing:** Row-by-row upsert for dedup checking (not batched)
2. **No Undo:** Import cannot be bulk-reverted
3. **No Validation Preview:** Data type validation only at import time
4. **Single Sheet:** Only first sheet processed from multi-sheet Excel files
5. **No Custom Fields:** Limited to standard 23-column CRM schema

---

## 18. Future Enhancements (Backlog)

- [ ] Multi-sheet Excel processing
- [ ] Pre-import validation report (dry-run mode)
- [ ] Bulk undo/revert capability
- [ ] Import templates for specific use cases (events, bulk updates)
- [ ] Import scheduling (queue for later processing)
- [ ] Duplicate preview (show matches before import)

---

**Document Owner:** Vanto Zazi Product Team  
**Review Cycle:** Monthly or on schema changes  
**Related Docs:** `PRODUCT_SPEC.md`, `USER_MANUAL.md`
