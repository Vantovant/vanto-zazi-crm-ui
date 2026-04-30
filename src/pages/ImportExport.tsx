import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Users,
  ShoppingCart,
  Award,
  CheckCircle,
  AlertCircle,
  X,
  FileText,
  Calendar,
  Sparkles,
  Loader2,
  Info,
  Mail,
  Brain,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { DataStatusBanner } from '../components/DataStatusBanner';
import { useCrm } from '@/contexts/CrmContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { prospectColumns } from '@/data/mockData';
import { normalizePhone, normalizeEmail, safeMerge } from '@/utils/contactNormalization';

type ImportStep = 'upload' | 'ai-analyzing' | 'mapping' | 'preview' | 'complete';

const CRM_FIELDS = prospectColumns.map(col => ({ key: col.key, label: col.label }));

// Normalize a string for fuzzy matching
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\u00a0_\-\.\'\",:]/g, '');
}

// Fallback auto-map (used if AI is unavailable)
function autoMapHeader(header: string): string {
  const norm = normalize(header);
  for (const field of CRM_FIELDS) {
    if (normalize(field.key) === norm || normalize(field.label) === norm) return field.key;
  }
  const aliases: Record<string, string> = {
    name: 'FullName', fullname: 'FullName', nameandsurname: 'FullName', namesurname: 'FullName', surname: 'FullName', firstname: 'FullName', lastname: 'FullName',
    phone: 'PhoneNumber', phonenumber: 'PhoneNumber', mobile: 'PhoneNumber', cell: 'PhoneNumber', tel: 'PhoneNumber', telephone: 'PhoneNumber', cellphone: 'PhoneNumber', contactnumber: 'PhoneNumber',
    email: 'EmailAddress', emailaddress: 'EmailAddress', emailid: 'EmailAddress',
    date: 'DateCaptured', datecaptured: 'DateCaptured', enrollmentdate: 'DateCaptured', dateofenrollment: 'DateCaptured', dateenrolled: 'DateCaptured', dateofactivation: 'DateCaptured', activationdate: 'DateCaptured', dateofbirth: 'AdditionalNotes',
    dateofmakinginactive: 'AdditionalNotes', datemakinginactive: 'AdditionalNotes',
    highestachievedrankqualification: 'AdditionalNotes', highestrankqualification: 'AdditionalNotes', highestrank: 'AdditionalNotes',
    activesmartshippv: 'AdditionalNotes', binaryandsummaryinformation: 'AdditionalNotes',
    level: 'Level', leg: 'Leg',
    contacts: 'PhoneNumber',
    temperature: 'LeadTemperature', leadtemperature: 'LeadTemperature', leadtemp: 'LeadTemperature', temp: 'LeadTemperature',
    commstatus: 'CommunicationStatus', communicationstatus: 'CommunicationStatus',
    regstatus: 'RegistrationStatus', registrationstatus: 'RegistrationStatus',
    leadtype: 'LeadType', type: 'LeadType',
    interest: 'InterestLevel', interestlevel: 'InterestLevel',
    focusarea: 'FocusArea', focus: 'FocusArea',
    leadpath: 'LeadPath', path: 'LeadPath',
    sponsor: 'SponsorName', sponsorname: 'SponsorName',
    assignedto: 'AssignedTo', assigned: 'AssignedTo',
    actiontaken: 'ActionTaken', action: 'ActionTaken',
    nextaction: 'NextAction',
    meetingtime: 'MeetingTime', meeting: 'MeetingTime',
    aplgoid: 'APLGoID', aplid: 'APLGoID', associateid: 'APLGoID', associatesid: 'APLGoID', associatesid2: 'APLGoID',
    associatestatus: 'AssociateStatus', assocstatus: 'AssociateStatus',
    additionalnotes: 'AdditionalNotes', notes: 'AdditionalNotes',
    gostatus: 'GOStatus', go_status: 'GOStatus',
    city: 'City', province: 'Province', state: 'State', country: 'Country', location: 'City',
  };
  return aliases[norm] || '';
}

// Parse any spreadsheet file (CSV, XLSX, XLS)
async function parseSpreadsheet(file: File): Promise<{ headers: string[]; rows: string[][]; sheetNames: string[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [], sheetNames: ['Sheet1'] };
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
          else if (ch === '"') inQuotes = false;
          else current += ch;
        } else {
          if (ch === '"') inQuotes = true;
          else if (ch === ',') { result.push(current.trim()); current = ''; }
          else current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(parseCSVLine);
    return { headers, rows, sheetNames: ['Sheet1'] };
  }

  // Excel files
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const sheet = workbook.Sheets[sheetNames[0]];
  const json: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (json.length === 0) return { headers: [], rows: [], sheetNames };
  // Clean non-breaking spaces (\u00a0) from all cell values
  const cleanStr = (v: unknown) => String(v).replace(/\u00a0/g, ' ').trim();
  const headers = json[0].map(cleanStr);
  const rows = json.slice(1).map(r => r.map(cleanStr));
  return { headers, rows, sheetNames };
}

interface AiMapping {
  spreadsheetColumn: string;
  crmField: string | null;
  confidence: number;
  reason: string;
  transformNote?: string;
}

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: typeof Users;
  recordCount: number;
}

const importTemplates = [
  { id: 'contacts', label: 'Contacts Template', description: 'CSV template for importing contacts' },
  { id: 'orders', label: 'Orders Template', description: 'CSV template for importing orders' },
];

export function ImportExport() {
  const { dbActive, refetchContacts, contacts, orders } = useCrm();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [selectedExports, setSelectedExports] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');

  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; updated: number; skipped: number }>({ success: 0, failed: 0, updated: 0, skipped: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [auditPreview, setAuditPreview] = useState<Array<Record<string, unknown>> | null>(null);

  // Smart Tagging (compensation for missing columns)
  const [smartTags, setSmartTags] = useState<Record<string, string>>({
    sponsor_name: '',
    leg: '',
    level: '',
    country: '',
    province: '',
    lead_type: '',
    lead_temperature: '',
  });
  const updateSmartTag = (key: string, value: string) => setSmartTags(prev => ({ ...prev, [key]: value }));
  const activeSmartTags = Object.entries(smartTags).filter(([, v]) => v.trim() !== '');

  // Preview duplicate detection
  const [previewDupeStatus, setPreviewDupeStatus] = useState<Record<number, 'create' | 'update'>>({});
  // AI mapping state
  const [aiMappings, setAiMappings] = useState<AiMapping[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [aiUsed, setAiUsed] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const exportOptions: ExportOption[] = [
    { id: 'contacts', label: 'Contacts', description: 'Export all prospects and contacts', icon: Users, recordCount: contacts.length },
    { id: 'orders', label: 'Orders', description: 'Export order history and transactions', icon: ShoppingCart, recordCount: orders.length },
  ];

  const processFile = useCallback(async (file: File) => {
    setUploadedFile(file);
    setHeaderError(null);
    setAiError(null);
    setAiMappings([]);
    setAiSummary('');
    setAiUsed(false);

    try {
      const { headers, rows, sheetNames: sheets } = await parseSpreadsheet(file);
      if (headers.length === 0) {
        setHeaderError('Could not find any data in the file. Make sure the first row contains column headers.');
        return;
      }
      setFileHeaders(headers);
      setFileRows(rows);
      setSheetNames(sheets);

      // Go to AI analysis step
      setImportStep('ai-analyzing');

      // Call AI for smart mapping
      try {
        const sampleRows = rows.slice(0, 5);
        const { data, error } = await supabase.functions.invoke('smart-import', {
          body: { headers, sampleRows },
        });

        if (error) throw error;
        if (data?.mappings) {
          setAiMappings(data.mappings);
          setAiSummary(data.summary || '');
          setAiUsed(true);

          // Apply AI mappings to column mapping (with fuzzy key matching)
          const mapping: Record<string, string> = {};
          const crmKeyMap = Object.fromEntries(CRM_FIELDS.map(f => [f.key.toLowerCase(), f.key]));
          for (const m of data.mappings as AiMapping[]) {
            if (m.crmField && m.confidence >= 0.4) {
              // Try exact match first, then case-insensitive
              const exactKey = CRM_FIELDS.find(f => f.key === m.crmField)?.key;
              const fuzzyKey = crmKeyMap[(m.crmField || '').toLowerCase()];
              const resolvedKey = exactKey || fuzzyKey;
              if (resolvedKey) {
                mapping[resolvedKey] = m.spreadsheetColumn;
              }
            }
          }

          // Fill gaps with rule-based fallback for unmapped fields
          for (const crmField of CRM_FIELDS) {
            if (!mapping[crmField.key]) {
              const matchIdx = headers.findIndex(h => autoMapHeader(h) === crmField.key);
              if (matchIdx !== -1) mapping[crmField.key] = headers[matchIdx];
            }
          }

          setColumnMapping(mapping);
          setImportStep('mapping');
          return;
        }
      } catch (aiErr) {
        console.error('AI mapping failed, using fallback:', aiErr);
        setAiError('AI analysis unavailable — using smart fallback mapping instead.');
      }

      // Fallback: use basic auto-mapping
      const mapping: Record<string, string> = {};
      for (const crmField of CRM_FIELDS) {
        const matchIdx = headers.findIndex(h => autoMapHeader(h) === crmField.key);
        if (matchIdx !== -1) mapping[crmField.key] = headers[matchIdx];
      }
      setColumnMapping(mapping);
      setImportStep('mapping');
    } catch {
      setHeaderError('Could not read the file. Please upload a valid CSV or Excel file (.csv, .xlsx, .xls).');
    }
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const toggleExportSelection = (id: string) => {
    const newSelection = new Set(selectedExports);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedExports(newSelection);
  };

  const resetImport = () => {
    setUploadedFile(null);
    setImportStep('upload');
    setFileHeaders([]);
    setFileRows([]);
    setSheetNames([]);
    setColumnMapping({});
    setHeaderError(null);
    setImporting(false);
    setImportResult({ success: 0, failed: 0, updated: 0, skipped: 0 });
    setImportErrors([]);
    setImportProgress(0);
    setAiMappings([]);
    setAiSummary('');
    setAiUsed(false);
    setAiError(null);
    setSmartTags({ sponsor_name: '', leg: '', level: '', country: '', province: '', lead_type: '', lead_temperature: '' });
    setPreviewDupeStatus({});
    setLastBatchId(null);
    setAuditPreview(null);
  };

  const runImport = async () => {
    if (!user) return;
    setImporting(true);
    setImportProgress(0);
    setImportErrors([]);
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errorMessages: string[] = [];
    const mappedFields = CRM_FIELDS.filter(f => columnMapping[f.key]);

    // Audit batch — every row in this run will be tagged with this id
    const batchId = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const fileName = uploadedFile?.name || 'unknown';
    const auditRows: Array<Record<string, unknown>> = [];
    const recordAudit = (entry: {
      sheet_row: number;
      full_name: string;
      aplgo_id: string;
      phone: string;
      email: string;
      match_method: 'aplgo_id' | 'phone' | 'email' | 'none';
      action: 'create' | 'update' | 'skip' | 'fail';
      matched_contact_id: string | null;
      reason: string;
    }) => {
      auditRows.push({
        user_id: user.id,
        batch_id: batchId,
        file_name: fileName,
        sheet_row: entry.sheet_row,
        incoming_full_name: entry.full_name,
        incoming_aplgo_id: entry.aplgo_id,
        incoming_phone: entry.phone,
        incoming_email: entry.email,
        match_method: entry.match_method,
        action: entry.action,
        matched_contact_id: entry.matched_contact_id,
        reason: entry.reason,
      });
    };

    const fieldToCol: Record<string, string> = {
      FullName: 'full_name', PhoneNumber: 'phone_number', EmailAddress: 'email_address',
      DateCaptured: 'date_captured', City: 'city', Province: 'province', State: 'state',
      Country: 'country', LeadTemperature: 'lead_temperature', CommunicationStatus: 'communication_status',
      RegistrationStatus: 'registration_status', LeadType: 'lead_type', InterestLevel: 'interest_level',
      FocusArea: 'focus_area', LeadPath: 'lead_path', SponsorName: 'sponsor_name',
      AssignedTo: 'assigned_to', ActionTaken: 'action_taken', NextAction: 'next_action',
      MeetingTime: 'meeting_time', APLGoID: 'aplgo_id', AssociateStatus: 'associate_status',
      AdditionalNotes: 'additional_notes', GOStatus: 'go_status', Leg: 'leg', Level: 'level',
    };

    const normalizeDate = (val: string): string => {
      if (!val) return '';
      if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
      const euMatch = val.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
      if (euMatch) return `${euMatch[3]}-${euMatch[2].padStart(2, '0')}-${euMatch[1].padStart(2, '0')}`;
      const usMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return '';
    };

    // Detect expired member spreadsheets
    const hasInactiveDate = fileHeaders.some(h => normalize(h).includes('makinginactive'));

    // Pre-build a lookup: normalized header → column index for robust matching
    const headerIndexMap: Record<string, number> = {};
    for (let i = 0; i < fileHeaders.length; i++) {
      headerIndexMap[normalize(fileHeaders[i])] = i;
      headerIndexMap[fileHeaders[i].trim().toLowerCase()] = i;
    }

    for (let rowIdx = 0; rowIdx < fileRows.length; rowIdx++) {
      const row = fileRows[rowIdx];
      const sheetRow = rowIdx + 2; // header is row 1, data starts at row 2
      const record: Record<string, string> = {};
      for (const field of mappedFields) {
        const csvHeader = columnMapping[field.key];
        let colIdx = fileHeaders.findIndex(h => h.trim().toLowerCase() === csvHeader.trim().toLowerCase());
        if (colIdx === -1) {
          colIdx = headerIndexMap[normalize(csvHeader)] ?? -1;
        }
        if (colIdx !== -1 && row[colIdx] != null) record[field.key] = String(row[colIdx]).trim();
      }
      const fullName = (record.FullName || '').trim();
      // Sanitize APLGO ID: strip any non-digit characters (e.g. "1823834 new!" -> "1823834")
      const rawAplgo = (record.APLGoID || '').trim();
      const incomingAplgo = rawAplgo.replace(/[^0-9]/g, '');
      if (incomingAplgo) record.APLGoID = incomingAplgo;
      const incomingPhone = (record.PhoneNumber || '').trim();
      const incomingEmail = (record.EmailAddress || '').trim();

      if (!fullName) {
        failed++;
        errorMessages.push(`Row ${sheetRow}: FullName is empty — check column mapping`);
        recordAudit({
          sheet_row: sheetRow, full_name: '', aplgo_id: incomingAplgo, phone: incomingPhone, email: incomingEmail,
          match_method: 'none', action: 'fail', matched_contact_id: null, reason: 'FullName empty',
        });
        setImportProgress(rowIdx + 1);
        continue;
      }
      record.FullName = fullName;

      // Parse composite "Contacts" column
      const contactsVal = (record.PhoneNumber || '').trim();
      if (contactsVal.includes(',') && contactsVal.includes('@')) {
        const parts = contactsVal.split(',').map(p => p.trim());
        for (const part of parts) {
          if (part.includes('@')) record.EmailAddress = record.EmailAddress || part;
          else if (/^\+?\d[\d\s]{6,}$/.test(part.replace(/\s/g, ''))) record.PhoneNumber = part;
          else if (!record.Country || record.Country === 'South Africa') record.Country = part;
        }
      }

      // Parse Location field: "South AfricaMaclear" → country + city
      const cityVal = (record.City || '').trim();
      const knownCountries = ['South Africa', 'Botswana', 'Namibia', 'Zimbabwe', 'Mozambique', 'Lesotho', 'Eswatini', 'Swaziland'];
      for (const country of knownCountries) {
        if (cityVal.startsWith(country) && cityVal.length > country.length) {
          record.Country = country;
          record.City = cityVal.slice(country.length).trim();
          break;
        } else if (cityVal === country) {
          record.Country = country;
          record.City = '';
          break;
        }
      }

      const dbRow: Record<string, unknown> = { user_id: user.id };
      for (const [k, v] of Object.entries(record)) {
        if (fieldToCol[k]) dbRow[fieldToCol[k]] = v;
      }

      // Apply Smart Tags
      for (const [dbCol, tagVal] of Object.entries(smartTags)) {
        if (tagVal.trim()) {
          const current = dbRow[dbCol] as string | undefined;
          if (!current || current.trim() === '' || ['sponsor_name', 'leg', 'level'].includes(dbCol)) {
            dbRow[dbCol] = tagVal.trim();
          }
        }
      }

      const rawDate = (dbRow.date_captured as string) || '';
      const normalizedDate = normalizeDate(rawDate);
      dbRow.date_captured = normalizedDate || new Date().toISOString().split('T')[0];

      if (hasInactiveDate) {
        dbRow.lead_type = 'Expired';
        dbRow.registration_status = dbRow.registration_status || 'Activated';
      } else {
        const goStatus = ((dbRow.go_status as string) || '').trim().toLowerCase();
        if (goStatus) {
          const rankedStatuses = ['promoter', 'diamond', 'builder', 'mentor', 'associate', 'vip'];
          if (rankedStatuses.some(r => goStatus.includes(r))) {
            dbRow.lead_type = 'Purchase_Status';
          } else if (goStatus === 'no status' || goStatus === 'no_status' || goStatus === 'nostatus') {
            dbRow.lead_type = 'Purchase_Nostatus';
          }
        }
      }

      // Sanitize enum fields
      const enumRules: Record<string, { allowed: string[]; fallback: string }> = {
        lead_temperature: { allowed: ['Hot', 'Warm', 'Cold', ''], fallback: 'Warm' },
        communication_status: { allowed: ['New', 'In Progress', 'Pending', 'Completed', 'Unsubscribed', 'Active', 'Contacted', ''], fallback: 'New' },
        lead_type: { allowed: ['Prospect', 'Registered_Nopurchase', 'Purchase_Nostatus', 'Purchase_Status', 'Expired', 'Customer', 'Distributor', ''], fallback: 'Prospect' },
        interest_level: { allowed: ['High', 'Medium', 'Low', ''], fallback: 'Medium' },
        registration_status: { allowed: ['Not Registered', 'Registered', 'Activated', ''], fallback: 'Not Registered' },
        lead_path: { allowed: ['Customer', 'Distributor', 'Not sure yet', 'Direct Registration', ''], fallback: 'Not sure yet' },
        focus_area: { allowed: ['Health Transformation', 'Business Opportunity', 'Both', ''], fallback: 'Health Transformation' },
      };
      for (const [col, rule] of Object.entries(enumRules)) {
        const val = (dbRow[col] as string | undefined);
        if (val !== undefined && !rule.allowed.includes(val)) {
          console.warn(`Sanitized ${col}: "${val}" → "${rule.fallback}" for row ${rowIdx}`);
          dbRow[col] = rule.fallback;
        }
      }
      if (dbRow.leg !== undefined) {
        const legRaw = String(dbRow.leg ?? '').trim().toLowerCase();
        if (['1', '1 leg', 'left', 'l'].includes(legRaw)) dbRow.leg = 'L';
        else if (['2', '2 leg', 'right', 'r'].includes(legRaw)) dbRow.leg = 'R';
        else if (legRaw === '') dbRow.leg = '';
        else dbRow.leg = '';
      }

      // ===== UPSERT MATCH PRIORITY (FIX 2) =====
      // 1. aplgo_id exact match first (only when present and non-empty)
      // 2. phone_normalized
      // 3. email_normalized
      const aplgoForMatch = (dbRow.aplgo_id as string | undefined)?.toString().trim() || '';
      const normPhone = normalizePhone(dbRow.phone_number as string);
      const normEmail = normalizeEmail(dbRow.email_address as string);

      let existingId: string | null = null;
      let matchMethod: 'aplgo_id' | 'phone' | 'email' | 'none' = 'none';

      if (aplgoForMatch) {
        const { data } = await supabase.from('contacts')
          .select('id')
          .eq('user_id', user.id)
          .eq('aplgo_id', aplgoForMatch)
          .limit(1);
        if (data && data.length > 0) {
          existingId = (data[0] as { id: string }).id;
          matchMethod = 'aplgo_id';
        }
      }

      if (!existingId && normPhone) {
        const { data } = await supabase.from('contacts')
          .select('id')
          .eq('user_id', user.id)
          .eq('phone_normalized', normPhone)
          .limit(1);
        if (data && data.length > 0) {
          existingId = (data[0] as { id: string }).id;
          matchMethod = 'phone';
        }
      }

      if (!existingId && normEmail) {
        const { data } = await supabase.from('contacts')
          .select('id')
          .eq('user_id', user.id)
          .eq('email_normalized', normEmail)
          .limit(1);
        if (data && data.length > 0) {
          existingId = (data[0] as { id: string }).id;
          matchMethod = 'email';
        }
      }

      if (existingId) {
        // UPDATE existing using safe merge
        const { data: existingData } = await supabase.from('contacts').select('*').eq('id', existingId).single();
        if (existingData) {
          const merged = safeMerge(existingData as Record<string, unknown>, dbRow);
          delete merged.user_id;
          delete merged.id;
          if (Object.keys(merged).length > 0) {
            const { error } = await supabase.from('contacts').update(merged).eq('id', existingId);
            if (error) {
              console.error(`Import update error row ${rowIdx}:`, error.message, error.code, 'id:', existingId);
              errorMessages.push(`Row ${sheetRow} (${fullName}): ${error.message}`);
              failed++;
              recordAudit({
                sheet_row: sheetRow, full_name: fullName, aplgo_id: incomingAplgo, phone: incomingPhone, email: incomingEmail,
                match_method: matchMethod, action: 'fail', matched_contact_id: existingId, reason: error.message,
              });
            } else {
              updated++;
              recordAudit({
                sheet_row: sheetRow, full_name: fullName, aplgo_id: incomingAplgo, phone: incomingPhone, email: incomingEmail,
                match_method: matchMethod, action: 'update', matched_contact_id: existingId, reason: `merged ${Object.keys(merged).length} field(s)`,
              });
            }
          } else {
            updated++;
            recordAudit({
              sheet_row: sheetRow, full_name: fullName, aplgo_id: incomingAplgo, phone: incomingPhone, email: incomingEmail,
              match_method: matchMethod, action: 'update', matched_contact_id: existingId, reason: 'no field changes (already up to date)',
            });
          }
        } else {
          failed++;
          errorMessages.push(`Row ${sheetRow} (${fullName}): Could not fetch existing contact`);
          recordAudit({
            sheet_row: sheetRow, full_name: fullName, aplgo_id: incomingAplgo, phone: incomingPhone, email: incomingEmail,
            match_method: matchMethod, action: 'fail', matched_contact_id: existingId, reason: 'existing contact fetch failed',
          });
        }
      } else {
        // INSERT new
        const { data: insData, error } = await supabase.from('contacts').insert(dbRow as any).select('id').single();
        if (error) {
          console.error(`Import insert error row ${rowIdx}:`, error.message, error.code, 'fullName:', fullName);
          if (error.code === '23505') {
            updated++;
            recordAudit({
              sheet_row: sheetRow, full_name: fullName, aplgo_id: incomingAplgo, phone: incomingPhone, email: incomingEmail,
              match_method: 'none', action: 'update', matched_contact_id: null, reason: 'unique constraint hit (existing record)',
            });
          } else {
            errorMessages.push(`Row ${sheetRow} (${fullName}): ${error.message}`);
            failed++;
            recordAudit({
              sheet_row: sheetRow, full_name: fullName, aplgo_id: incomingAplgo, phone: incomingPhone, email: incomingEmail,
              match_method: 'none', action: 'fail', matched_contact_id: null, reason: error.message,
            });
          }
        } else {
          inserted++;
          recordAudit({
            sheet_row: sheetRow, full_name: fullName, aplgo_id: incomingAplgo, phone: incomingPhone, email: incomingEmail,
            match_method: 'none', action: 'create', matched_contact_id: insData?.id ?? null, reason: 'new contact',
          });
        }
      }

      setImportProgress(rowIdx + 1);
      if (rowIdx % 10 === 0) await new Promise(r => setTimeout(r, 10));
    }

    // Flush audit rows in chunks of 200
    for (let i = 0; i < auditRows.length; i += 200) {
      const chunk = auditRows.slice(i, i + 200);
      const { error: auditErr } = await supabase.from('import_audit').insert(chunk as any);
      if (auditErr) console.error('Import audit write failed:', auditErr.message);
    }

    setImportResult({ success: inserted, failed, updated, skipped: 0 });
    setImportErrors(errorMessages.slice(0, 10));
    setLastBatchId(batchId);
    await refetchContacts();
    setImporting(false);
    setImportStep('complete');
  };

  const updateMapping = (crmFieldKey: string, csvHeader: string) => {
    setColumnMapping(prev => ({ ...prev, [crmFieldKey]: csvHeader }));
  };

  const mappedCount = Object.values(columnMapping).filter(v => v !== '').length;

  // Get AI confidence for a CRM field
  const getAiConfidence = (crmFieldKey: string): AiMapping | undefined => {
    const csvHeader = columnMapping[crmFieldKey];
    if (!csvHeader || !aiUsed) return undefined;
    return aiMappings.find(m => m.spreadsheetColumn === csvHeader && m.crmField === crmFieldKey);
  };

  const confidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400">HIGH</span>;
    if (confidence >= 0.5) return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400">MED</span>;
    return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-400">LOW</span>;
  };

  // ZAZI Mail export
  const exportZaziMail = (filteredContacts: typeof contacts, isRanked: boolean, fileLabel: string) => {
    const headers = ['email_address', 'first_name', 'last_name', 'tags', 'go_status_rank', 'sequence', 'source', 'opt_in_date'];
    const rows = filteredContacts.map((contact) => {
      const nameParts = contact.FullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const rank = contact.GOStatus && contact.GOStatus !== 'No status' ? contact.GOStatus.trim() : '';
      const rankTag = isRanked && rank ? `GO_Status_${rank.replace(/\s+/g, '_')}` : '';
      let sequence = '';
      if (isRanked && rank) {
        const r = rank.toLowerCase();
        if (r.includes('diamond')) sequence = 'Diamond_Leader_Sequence';
        else if (r.includes('vip')) sequence = 'VIP_Elite_Sequence';
        else if (r.includes('mentor')) sequence = 'Mentor_Growth_Sequence';
        else if (r.includes('builder')) sequence = 'Builder_Momentum_Sequence';
        else if (r.includes('associate')) sequence = 'Associate_Upgrade_Sequence';
        else if (r.includes('promoter')) sequence = 'Promoter_Activation_Sequence';
        else sequence = 'General_Status_Sequence';
      } else {
        sequence = 'Activation_Nurture_Sequence';
      }
      const lifecycleTag = contact.LeadType ? contact.LeadType : '';
      const tags = [
        'Activated_Distributor',
        isRanked ? 'Has_GO_Status' : 'Activation_Only_R375',
        rankTag,
        lifecycleTag,
        contact.FocusArea ? contact.FocusArea.replace(/\s+/g, '_') : '',
        contact.LeadTemperature ? `Temp_${contact.LeadTemperature}` : '',
        contact.InterestLevel ? `Interest_${contact.InterestLevel}` : '',
      ].filter(Boolean).join(', ');
      const source = contact.LeadPath || 'Manual';
      const optInDate = contact.DateCaptured || '';
      return [
        contact.EmailAddress, firstName, lastName, tags, rank, sequence, source, optInDate,
      ].map((v) => `"${(v || '').replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zazi-mail-${fileLabel}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileTypeLabel = uploadedFile?.name.split('.').pop()?.toUpperCase() || 'File';

  return (
    <div className="space-y-6">
      <DataStatusBanner dbActive={dbActive} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          Import / Export
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
            <Brain className="w-3 h-3" />
            AI-Powered
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">Upload any spreadsheet — ZAZI AI will map your data intelligently</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'import' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'export' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              {/* Step Indicator */}
              <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
                <div className="flex items-center gap-3 flex-wrap">
                  {(['upload', 'ai-analyzing', 'mapping', 'preview', 'complete'] as ImportStep[]).map((step, index) => {
                    const labels = ['Upload', 'AI Analysis', 'Mapping', 'Preview', 'Complete'];
                    const stepOrder = ['upload', 'ai-analyzing', 'mapping', 'preview', 'complete'];
                    const currentIdx = stepOrder.indexOf(importStep);
                    const stepIdx = index;
                    return (
                      <div key={step} className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                          importStep === step
                            ? step === 'ai-analyzing' ? 'bg-purple-600 text-white' : 'bg-teal-600 text-white'
                            : stepIdx < currentIdx
                            ? 'bg-teal-600/20 text-teal-400'
                            : 'bg-slate-700 text-slate-500'
                        }`}>
                          {step === 'ai-analyzing' ? <Sparkles className="w-3.5 h-3.5" /> : index + 1}
                        </div>
                        <span className={`text-xs font-medium ${
                          importStep === step ? 'text-white' : 'text-slate-500'
                        }`}>
                          {labels[index]}
                        </span>
                        {index < 4 && <div className="w-5 h-px bg-slate-700" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upload Step */}
              {importStep === 'upload' && (
                <div className="p-6">
                  {headerError && (
                    <div className="flex items-center gap-3 p-4 mb-4 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                      <p className="text-sm text-rose-400">{headerError}</p>
                    </div>
                  )}
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                      dragActive ? 'border-teal-500 bg-teal-500/10' : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                      <FileSpreadsheet className="w-8 h-8 text-teal-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      Drop your spreadsheet here
                    </h3>
                    <p className="text-sm text-slate-400 mb-1">
                      Supports <span className="text-teal-400 font-medium">CSV</span>, <span className="text-teal-400 font-medium">Excel (.xlsx)</span>, and <span className="text-teal-400 font-medium">.xls</span> files
                    </p>
                    <p className="text-xs text-slate-500 mb-5">
                      ZAZI AI will analyze your file and map columns automatically
                    </p>
                    <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      Browse Files
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Beginner help */}
                  <div className="mt-6 p-4 bg-slate-700/30 rounded-lg border border-slate-700">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-white mb-1">New to importing?</p>
                        <p className="text-xs text-slate-400">
                          Just upload your spreadsheet — any format, any column names. Our AI will study your data and figure out where each column belongs in the CRM. 
                          You can review and adjust before importing. No technical knowledge needed!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Analyzing Step */}
              {importStep === 'ai-analyzing' && (
                <div className="p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-teal-500/20 flex items-center justify-center mx-auto mb-6 relative">
                    <Brain className="w-10 h-10 text-purple-400" />
                    <div className="absolute inset-0 rounded-full border-2 border-purple-500/30 animate-ping" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">ZAZI AI is analyzing your data…</h3>
                  <p className="text-sm text-slate-400 mb-1">
                    Studying {fileHeaders.length} columns and {fileRows.length} rows from <span className="text-teal-400">{uploadedFile?.name}</span>
                  </p>
                  <p className="text-xs text-slate-500">Identifying patterns, matching fields, and preparing smart suggestions</p>
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                    <span className="text-sm text-purple-400">Processing…</span>
                  </div>
                </div>
              )}

              {/* Mapping Step */}
              {importStep === 'mapping' && uploadedFile && (
                <div className="p-6">
                  {/* File info */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-teal-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{uploadedFile.name}</p>
                        <p className="text-xs text-slate-400">
                          {(uploadedFile.size / 1024).toFixed(1)} KB · {fileHeaders.length} columns · {fileRows.length} rows
                          {sheetNames.length > 1 && ` · ${sheetNames.length} sheets`}
                          <span className="ml-2 text-slate-600">({fileTypeLabel})</span>
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={resetImport} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* AI Summary */}
                  {aiUsed && aiSummary && (
                    <div className="flex items-start gap-3 p-4 mb-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-purple-300">ZAZI AI Analysis</p>
                        <p className="text-xs text-purple-300/70 mt-0.5">{aiSummary}</p>
                      </div>
                    </div>
                  )}
                  {aiError && (
                    <div className="flex items-start gap-3 p-3 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-400">{aiError}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-white">Column Mapping</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{mappedCount} of {CRM_FIELDS.length} fields mapped</span>
                      {aiUsed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-400">
                          <Sparkles className="w-2.5 h-2.5" />
                          AI-Mapped
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {CRM_FIELDS.map((field) => {
                      const aiInfo = getAiConfidence(field.key);
                      return (
                        <div key={field.key} className="flex items-center gap-3">
                          <div className="w-36 flex-shrink-0">
                            <p className="text-sm text-slate-300">{field.label}</p>
                          </div>
                          <div className="flex-1">
                            <select
                              value={columnMapping[field.key] || ''}
                              onChange={(e) => updateMapping(field.key, e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                            >
                              <option value="">— Skip —</option>
                              {fileHeaders.map((header) => (
                                <option key={header} value={header}>{header}</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-20 flex items-center gap-1.5 flex-shrink-0">
                            {columnMapping[field.key] && (
                              <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0" />
                            )}
                            {aiInfo && confidenceBadge(aiInfo.confidence)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI reasoning tooltip area */}
                  {aiUsed && aiMappings.filter(m => m.crmField && m.confidence < 0.7 && m.reason).length > 0 && (
                    <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border border-slate-700">
                      <p className="text-xs font-semibold text-slate-400 mb-2">⚠️ Low-confidence mappings — please verify:</p>
                      <ul className="space-y-1">
                        {aiMappings.filter(m => m.crmField && m.confidence < 0.7 && columnMapping[m.crmField] === m.spreadsheetColumn).map((m, i) => (
                          <li key={i} className="text-xs text-slate-500">
                            <span className="text-slate-300">"{m.spreadsheetColumn}"</span> → <span className="text-teal-400">{CRM_FIELDS.find(f => f.key === m.crmField)?.label}</span>: {m.reason}
                            {m.transformNote && <span className="text-amber-400"> — {m.transformNote}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-700">
                    <button type="button" onClick={resetImport} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAiMappings([]);
                        setAiSummary('');
                        setAiUsed(false);
                        setColumnMapping({});
                        // re-run fallback
                        const mapping: Record<string, string> = {};
                        for (const crmField of CRM_FIELDS) {
                          const matchIdx = fileHeaders.findIndex(h => autoMapHeader(h) === crmField.key);
                          if (matchIdx !== -1) mapping[crmField.key] = fileHeaders[matchIdx];
                        }
                        setColumnMapping(mapping);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Mapping
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setImportStep('preview');
                        // Run preview duplicate detection for first 10 rows
                        const mappedFields = CRM_FIELDS.filter(f => columnMapping[f.key]);
                        const dupeStatus: Record<number, 'create' | 'update'> = {};
                        for (let idx = 0; idx < Math.min(fileRows.length, 10); idx++) {
                          const row = fileRows[idx];
                          const record: Record<string, string> = {};
                          for (const field of mappedFields) {
                            const csvHeader = columnMapping[field.key];
                            const colIdx = fileHeaders.findIndex(h => h.trim().toLowerCase() === csvHeader.trim().toLowerCase());
                            if (colIdx !== -1 && row[colIdx] != null) record[field.key] = String(row[colIdx]).trim();
                          }
                          const phone = normalizePhone(record.PhoneNumber);
                          const email = normalizeEmail(record.EmailAddress);
                          let found = false;
                          if (phone) {
                            const { data } = await supabase.from('contacts').select('id').eq('phone_normalized', phone).limit(1);
                            if (data && data.length > 0) found = true;
                          }
                          if (!found && email) {
                            const { data } = await supabase.from('contacts').select('id').eq('email_normalized', email).limit(1);
                            if (data && data.length > 0) found = true;
                          }
                          dupeStatus[idx] = found ? 'update' : 'create';
                        }
                        setPreviewDupeStatus(dupeStatus);
                      }}
                      disabled={!columnMapping['FullName']}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        columnMapping['FullName']
                          ? 'bg-teal-600 hover:bg-teal-500 text-white'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Continue to Preview
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Step */}
              {importStep === 'preview' && (
                <div className="p-6">
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-400">Preview Mode</p>
                        <p className="text-xs text-amber-400/70">Review your data before importing. Existing contacts matched by phone or email will be updated, not duplicated.</p>
                      </div>
                    </div>
                  </div>

                  {/* Smart Tagging UI */}
                  <div className="mb-6 p-4 bg-gradient-to-br from-purple-500/5 to-teal-500/5 rounded-lg border border-purple-500/20">
                    <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Smart Tagging (Optional)
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">Compensate for missing columns — these values fill blanks and apply to every row in this batch.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {([
                        { key: 'sponsor_name', label: 'Sponsor', placeholder: 'e.g. John Smith' },
                        { key: 'leg', label: 'Leg', placeholder: '', isLegSelect: true },
                        { key: 'level', label: 'Level', placeholder: 'e.g. Level 1, Gold' },
                        { key: 'country', label: 'Country', placeholder: 'e.g. South Africa' },
                        { key: 'province', label: 'Province', placeholder: 'e.g. Gauteng' },
                        { key: 'lead_type', label: 'Lead Type', placeholder: 'e.g. Prospect, Expired' },
                        { key: 'lead_temperature', label: 'Temperature', placeholder: 'e.g. Hot, Warm, Cold' },
                      ] as const).map(tag => (
                        <div key={tag.key}>
                          <label className="block text-xs text-slate-400 mb-1">{tag.label}</label>
                          {('isLegSelect' in tag && tag.isLegSelect) ? (
                            <select
                              value={smartTags[tag.key]}
                              onChange={(e) => updateSmartTag(tag.key, e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
                            >
                              <option value="">Unplaced</option>
                              <option value="L">L (Left)</option>
                              <option value="R">R (Right)</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={smartTags[tag.key]}
                              onChange={(e) => updateSmartTag(tag.key, e.target.value)}
                              placeholder={tag.placeholder}
                              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    {activeSmartTags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeSmartTags.map(([key, val]) => (
                          <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {key.replace(/_/g, ' ')}: {val}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {(() => {
                    const mappedFields = CRM_FIELDS.filter(f => columnMapping[f.key]);
                    const previewRows = fileRows.map((row) => {
                      const record: Record<string, string> = {};
                      for (const field of mappedFields) {
                        const csvHeader = columnMapping[field.key];
                        const colIdx = fileHeaders.indexOf(csvHeader);
                        record[field.key] = colIdx !== -1 ? (row[colIdx] ?? '') : '';
                      }
                      return record;
                    });

                    if (previewRows.length === 0) {
                      return (
                        <div className="flex items-center gap-3 p-4 mb-6 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                          <p className="text-sm text-rose-400">No data rows found in the uploaded file.</p>
                        </div>
                      );
                    }

                    const displayFields = mappedFields.slice(0, 5);
                    const createCount = Object.values(previewDupeStatus).filter(s => s === 'create').length;
                    const updateCount = Object.values(previewDupeStatus).filter(s => s === 'update').length;
                    const checkedCount = Object.keys(previewDupeStatus).length;

                    return (
                      <>
                        {activeSmartTags.length > 0 && (
                          <div className="flex items-start gap-2 p-3 mb-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                            <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-purple-300">Smart Tags will be applied to all rows:</p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {activeSmartTags.map(([key, val]) => (
                                  <span key={key} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300">
                                    {key.replace(/_/g, ' ')}: {val}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        {checkedCount > 0 && (
                          <div className="flex items-center gap-4 mb-3 text-xs">
                            <span className="text-emerald-400 font-medium">{createCount} will create</span>
                            <span className="text-amber-400 font-medium">{updateCount} will update</span>
                          </div>
                        )}
                        <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden mb-6">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-slate-800">
                                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">#</th>
                                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
                                  {displayFields.map(f => (
                                    <th key={f.key} className="text-left px-4 py-3 text-xs font-semibold text-slate-400">{f.label}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-700">
                                {previewRows.slice(0, 10).map((record, idx) => (
                                  <tr key={idx}>
                                    <td className="px-4 py-3 text-xs text-slate-500">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                      {previewDupeStatus[idx] === 'update' ? (
                                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400">UPDATE</span>
                                      ) : previewDupeStatus[idx] === 'create' ? (
                                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400">CREATE</span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-700 text-slate-500">—</span>
                                      )}
                                    </td>
                                    {displayFields.map(f => (
                                      <td key={f.key} className="px-4 py-3 text-sm text-slate-300">{record[f.key] || '—'}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {previewRows.length > 10 && (
                            <div className="px-4 py-2 bg-slate-800/50 text-xs text-slate-500 text-center">
                              Showing 10 of {previewRows.length} rows
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      <span className="text-emerald-400 font-medium">{fileRows.length} row{fileRows.length !== 1 ? 's' : ''}</span> ready to import
                    </p>
                    <div className="flex gap-3">
                      <button type="button" onClick={resetImport} className="px-4 py-2 text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors">
                        Cancel Import
                      </button>
                      <button type="button" onClick={() => setImportStep('mapping')} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={runImport}
                        disabled={fileRows.length === 0 || importing}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                          fileRows.length > 0 && !importing
                            ? 'bg-teal-600 hover:bg-teal-500 text-white'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {importing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Importing… {importProgress} / {fileRows.length}
                          </>
                        ) : (
                          `Import ${fileRows.length} Record${fileRows.length !== 1 ? 's' : ''}`
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Complete Step */}
              {importStep === 'complete' && (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Import Complete</h3>
                  <div className="flex justify-center gap-6 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-400">{importResult.success}</p>
                      <p className="text-xs text-slate-400">Created</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-400">{importResult.updated}</p>
                      <p className="text-xs text-slate-400">Updated</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-400">{importResult.skipped}</p>
                      <p className="text-xs text-slate-400">Skipped</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-rose-400">{importResult.failed}</p>
                      <p className="text-xs text-slate-400">Errors</p>
                    </div>
                  </div>
                  {importErrors.length > 0 && (
                    <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-left max-h-40 overflow-y-auto">
                      <p className="text-xs font-medium text-rose-300 mb-1">Error details:</p>
                      {importErrors.map((e, i) => (
                        <p key={i} className="text-[10px] text-rose-400/80 font-mono">{e}</p>
                      ))}
                    </div>
                  )}
                  {activeSmartTags.length > 0 && (
                    <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <p className="text-xs font-medium text-purple-300 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Smart Tags Applied:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activeSmartTags.map(([key, val]) => (
                          <span key={key} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/20 text-purple-300">
                            {key.replace(/_/g, ' ')}: {val}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiUsed && (
                    <p className="text-xs text-purple-400 mb-4 flex items-center justify-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Powered by ZAZI AI column mapping
                    </p>
                  )}
                  {lastBatchId && (
                    <div className="mb-4 text-left">
                      <button
                        type="button"
                        onClick={async () => {
                          const { data, error } = await supabase
                            .from('import_audit')
                            .select('sheet_row, incoming_full_name, incoming_aplgo_id, incoming_phone, incoming_email, match_method, action, matched_contact_id, reason')
                            .eq('batch_id', lastBatchId)
                            .order('sheet_row', { ascending: true });
                          if (error) {
                            alert('Could not load audit: ' + error.message);
                            return;
                          }
                          setAuditPreview(data as Array<Record<string, unknown>>);
                        }}
                        className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md"
                      >
                        📜 View Import Audit ({lastBatchId.slice(0, 8)}…)
                      </button>
                      {auditPreview && (
                        <div className="mt-3 max-h-72 overflow-auto bg-slate-900/70 border border-slate-700 rounded-lg">
                          <table className="w-full text-[11px]">
                            <thead className="bg-slate-800 text-slate-400 sticky top-0">
                              <tr>
                                <th className="px-2 py-1.5 text-left">Row</th>
                                <th className="px-2 py-1.5 text-left">Name</th>
                                <th className="px-2 py-1.5 text-left">APLGO</th>
                                <th className="px-2 py-1.5 text-left">Match</th>
                                <th className="px-2 py-1.5 text-left">Action</th>
                                <th className="px-2 py-1.5 text-left">Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditPreview.map((r, i) => (
                                <tr key={i} className="border-t border-slate-700/50">
                                  <td className="px-2 py-1 text-slate-400">{String(r.sheet_row)}</td>
                                  <td className="px-2 py-1 text-slate-200">{String(r.incoming_full_name || '—')}</td>
                                  <td className="px-2 py-1 text-slate-300 font-mono">{String(r.incoming_aplgo_id || '—')}</td>
                                  <td className="px-2 py-1 text-cyan-300">{String(r.match_method)}</td>
                                  <td className={`px-2 py-1 font-medium ${r.action === 'create' ? 'text-emerald-400' : r.action === 'update' ? 'text-amber-400' : r.action === 'fail' ? 'text-rose-400' : 'text-slate-400'}`}>{String(r.action)}</td>
                                  <td className="px-2 py-1 text-slate-500">{String(r.reason || '')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-center gap-3 mt-4">
                    <button type="button" onClick={resetImport} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors">
                      Import More
                    </button>
                    <button type="button" onClick={() => navigate('/contacts')} className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">
                      View Contacts
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* AI Feature highlight */}
            <div className="bg-gradient-to-br from-purple-500/10 to-teal-500/10 rounded-xl border border-purple-500/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Smart Import</h3>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                  Upload CSV or Excel — any format works
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                  AI reads your headers AND data to find the best column matches
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                  Confidence scores show how sure the AI is
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                  You can always adjust mappings before importing
                </li>
              </ul>
            </div>

            {/* Templates */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Download Templates</h3>
              <p className="text-xs text-slate-400 mb-4">Optional — use if you prefer a pre-formatted template.</p>
              <div className="space-y-3">
                {importTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      if (template.id === 'contacts') {
                        const headers = prospectColumns.map(c => c.label).join(',');
                        const blob = new Blob([headers + '\n'], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'contacts_import_template.csv';
                        a.click(); URL.revokeObjectURL(url);
                      } else if (template.id === 'orders') {
                        const headers = 'Order ID,Contact Name,Product,Quantity,Amount,Status,Order Date';
                        const blob = new Blob([headers + '\n'], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'orders_import_template.csv';
                        a.click(); URL.revokeObjectURL(url);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{template.label}</p>
                      <p className="text-xs text-slate-400 truncate">{template.description}</p>
                    </div>
                    <Download className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Select Data to Export</h3>
              <div className="space-y-3 mb-6">
                {exportOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => toggleExportSelection(option.id)}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                      selectedExports.has(option.id)
                        ? 'bg-teal-500/10 border-teal-500/40'
                        : 'bg-slate-700/30 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedExports.has(option.id) ? 'bg-teal-500 border-teal-500' : 'border-slate-500'
                    }`}>
                      {selectedExports.has(option.id) && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center">
                      <option.icon className="w-6 h-6 text-slate-300" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{option.label}</p>
                      <p className="text-xs text-slate-400">{option.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">{option.recordCount}</p>
                      <p className="text-xs text-slate-500">records</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-white mb-3">Export Format</h4>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setExportFormat('csv')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                      exportFormat === 'csv' ? 'bg-teal-500/10 border-teal-500/40 text-teal-400' : 'bg-slate-700/30 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>
                    <FileText className="w-5 h-5" /><span className="font-medium">CSV</span>
                  </button>
                  <button type="button" onClick={() => setExportFormat('xlsx')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                      exportFormat === 'xlsx' ? 'bg-teal-500/10 border-teal-500/40 text-teal-400' : 'bg-slate-700/30 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>
                    <FileSpreadsheet className="w-5 h-5" /><span className="font-medium">Excel</span>
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-white mb-3">Date Range (Optional)</h4>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="date" className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
                  </div>
                  <span className="text-slate-500">to</span>
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="date" className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={selectedExports.size === 0}
                onClick={() => {
                  if (selectedExports.has('contacts') && contacts.length > 0) {
                    const headers = prospectColumns.map(c => c.label).join(',');
                    const rows = contacts.map(c =>
                      prospectColumns.map(col => {
                        const val = String(c[col.key as keyof typeof c] ?? '');
                        return val.includes(',') ? `"${val}"` : val;
                      }).join(',')
                    ).join('\n');
                    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click(); URL.revokeObjectURL(url);
                  }
                  if (selectedExports.has('orders') && orders.length > 0) {
                    const headers = 'Order ID,Contact,Product,Quantity,Amount,Status,Date';
                    const rows = orders.map(o =>
                      [o.orderId, o.contactName, o.product, o.quantity, o.amount, o.status, o.orderDate]
                        .map(v => { const s = String(v); return s.includes(',') ? `"${s}"` : s; })
                        .join(',')
                    ).join('\n');
                    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `orders_export_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click(); URL.revokeObjectURL(url);
                  }
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  selectedExports.size > 0 ? 'bg-teal-600 hover:bg-teal-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Download className="w-4 h-4" />
                Export {selectedExports.size > 0 ? `${selectedExports.size} Dataset${selectedExports.size > 1 ? 's' : ''}` : 'Selected Data'}
              </button>
            </div>
          </div>
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-semibold text-white">ZAZI Mail Exports</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Export distributors with tags &amp; sequences for your email system.</p>
              <div className="space-y-3">
                <button type="button"
                  onClick={() => {
                    const noStatusContacts = contacts.filter(c => c.LeadType === 'Purchase_Nostatus');
                    exportZaziMail(noStatusContacts, false, 'purchase-nostatus');
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 rounded-lg transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">Purchase — No Status</p>
                    <p className="text-xs text-slate-400">{contacts.filter(c => c.LeadType === 'Purchase_Nostatus').length} contacts · Activation Nurture Sequence</p>
                  </div>
                  <Download className="w-4 h-4 text-teal-400" />
                </button>
                <button type="button"
                  onClick={() => {
                    const purchaseContacts = contacts.filter(c => c.LeadType === 'Purchase_Status');
                    const activationOnly = purchaseContacts.filter(c => !c.GOStatus || c.GOStatus === 'No status' || c.GOStatus === '');
                    exportZaziMail(activationOnly, false, 'activation-only');
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">Activation Only</p>
                    <p className="text-xs text-slate-400">{contacts.filter(c => c.LeadType === 'Purchase_Status' && (!c.GOStatus || c.GOStatus === 'No status' || c.GOStatus === '')).length} contacts · Tags + Sequences</p>
                  </div>
                  <Download className="w-4 h-4 text-amber-400" />
                </button>
                <button type="button"
                  onClick={() => {
                    const purchaseContacts = contacts.filter(c => c.LeadType === 'Purchase_Status');
                    const withStatus = purchaseContacts.filter(c => c.GOStatus && c.GOStatus !== 'No status' && c.GOStatus !== '');
                    exportZaziMail(withStatus, true, 'go-status-ranked');
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">GO-Status Ranked</p>
                    <p className="text-xs text-slate-400">{contacts.filter(c => c.LeadType === 'Purchase_Status' && c.GOStatus && c.GOStatus !== 'No status' && c.GOStatus !== '').length} contacts · Tags + Sequences</p>
                  </div>
                  <Download className="w-4 h-4 text-emerald-400" />
                </button>
                <button type="button"
                  onClick={() => {
                    const expiredContacts = contacts.filter(c => c.LeadType === 'Expired');
                    exportZaziMail(expiredContacts, true, 'expired-members');
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">Expired Members</p>
                    <p className="text-xs text-slate-400">{contacts.filter(c => c.LeadType === 'Expired').length} contacts · Re-engagement Tags</p>
                  </div>
                  <Download className="w-4 h-4 text-rose-400" />
                </button>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Export Info</h3>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-teal-400 mt-0.5 flex-shrink-0" />
                  Select datasets to export as CSV files
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-teal-400 mt-0.5 flex-shrink-0" />
                  Each dataset exports as a separate file
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-teal-400 mt-0.5 flex-shrink-0" />
                  ZAZI Mail exports include tags &amp; sequences
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
