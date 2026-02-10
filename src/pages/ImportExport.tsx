import { useState, useCallback } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Users,
  ShoppingCart,
  Activity,
  CheckCircle,
  AlertCircle,
  X,
  FileText,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { DataStatusBanner } from '../components/DataStatusBanner';
import { useCrm } from '@/contexts/CrmContext';
import { prospectColumns } from '@/data/mockData';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'complete';

// All CRM fields available for mapping
const CRM_FIELDS = prospectColumns.map(col => ({ key: col.key, label: col.label }));

// Normalize a string for fuzzy matching (lowercase, strip spaces/underscores/hyphens)
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-\.]/g, '');
}

// Try to auto-map a CSV header to a CRM field key
function autoMapHeader(header: string): string {
  const norm = normalize(header);
  for (const field of CRM_FIELDS) {
    if (normalize(field.key) === norm || normalize(field.label) === norm) {
      return field.key;
    }
  }
  // Common aliases
  const aliases: Record<string, string> = {
    name: 'FullName', fullname: 'FullName',
    phone: 'PhoneNumber', phonenumber: 'PhoneNumber', mobile: 'PhoneNumber',
    email: 'EmailAddress', emailaddress: 'EmailAddress',
    date: 'DateCaptured', datecaptured: 'DateCaptured',
    temperature: 'LeadTemperature', leadtemperature: 'LeadTemperature', leadtemp: 'LeadTemperature',
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
    aplgoid: 'APLGoID', aplid: 'APLGoID',
    associatestatus: 'AssociateStatus', assocstatus: 'AssociateStatus',
    additionalnotes: 'AdditionalNotes', notes: 'AdditionalNotes',
    city: 'City',
    province: 'Province',
    state: 'State',
    country: 'Country',
  };
  return aliases[norm] || '';
}

// Simple CSV line parser (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(parseCSVLine);
  return { headers, rows };
}

// Detect if first row looks like headers (non-numeric, non-empty labels)
function looksLikeHeaders(row: string[]): boolean {
  if (row.length === 0) return false;
  const nonEmpty = row.filter(c => c.trim() !== '');
  if (nonEmpty.length === 0) return false;
  // If most cells are non-numeric short strings, likely headers
  const textLike = nonEmpty.filter(c => c.length < 50 && Number.isNaN(Number(c)));
  return textLike.length / nonEmpty.length > 0.5;
}

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: typeof Users;
  recordCount: number;
}

const exportOptions: ExportOption[] = [
  { id: 'contacts', label: 'Contacts', description: 'Export all prospects and contacts', icon: Users, recordCount: 12 },
  { id: 'orders', label: 'Orders', description: 'Export order history and transactions', icon: ShoppingCart, recordCount: 10 },
  { id: 'activities', label: 'Activities', description: 'Export activity log and timeline', icon: Activity, recordCount: 12 },
];

const importTemplates = [
  { id: 'contacts', label: 'Contacts Template', description: 'CSV template for importing contacts' },
  { id: 'orders', label: 'Orders Template', description: 'CSV template for importing orders' },
];

export function ImportExport() {
  const { dbActive } = useCrm();
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [selectedExports, setSelectedExports] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [headerError, setHeaderError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setUploadedFile(file);
    setHeaderError(null);
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0 || !looksLikeHeaders(headers)) {
        setHeaderError('CSV must include a header row. Please use the provided template.');
        setCsvHeaders([]);
        setCsvRows([]);
        setColumnMapping({});
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
      // Auto-map headers to CRM fields
      const mapping: Record<string, string> = {};
      for (const crmField of CRM_FIELDS) {
        const matchIdx = headers.findIndex(h => autoMapHeader(h) === crmField.key);
        if (matchIdx !== -1) {
          mapping[crmField.key] = headers[matchIdx];
        }
      }
      setColumnMapping(mapping);
      setImportStep('mapping');
    } catch {
      setHeaderError('Could not read the file. Please upload a valid CSV.');
    }
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      processFile(e.target.files[0]);
    }
  };

  const toggleExportSelection = (id: string) => {
    const newSelection = new Set(selectedExports);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedExports(newSelection);
  };

  const resetImport = () => {
    setUploadedFile(null);
    setImportStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setHeaderError(null);
  };

  const updateMapping = (crmFieldKey: string, csvHeader: string) => {
    setColumnMapping(prev => ({ ...prev, [crmFieldKey]: csvHeader }));
  };

  const mappedCount = Object.values(columnMapping).filter(v => v !== '').length;

  return (
    <div className="space-y-6">
      {/* Data Status Banner */}
      <DataStatusBanner dbActive={dbActive} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Import / Export</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage your data with bulk import and export tools</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'import'
              ? 'bg-teal-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'export'
              ? 'bg-teal-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Import Area */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              {/* Step Indicator */}
              <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
                <div className="flex items-center gap-4">
                  {['upload', 'mapping', 'preview', 'complete'].map((step, index) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        importStep === step
                          ? 'bg-teal-600 text-white'
                          : index < ['upload', 'mapping', 'preview', 'complete'].indexOf(importStep)
                          ? 'bg-teal-600/20 text-teal-400'
                          : 'bg-slate-700 text-slate-500'
                      }`}>
                        {index + 1}
                      </div>
                      <span className={`text-sm font-medium capitalize ${
                        importStep === step ? 'text-white' : 'text-slate-500'
                      }`}>
                        {step}
                      </span>
                      {index < 3 && <div className="w-8 h-px bg-slate-700" />}
                    </div>
                  ))}
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
                      dragActive
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-4">
                      <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      Drop your file here
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">
                      Supports CSV files (.csv) — first row must be headers
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      Browse Files
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Mapping Step */}
              {importStep === 'mapping' && uploadedFile && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-teal-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{uploadedFile.name}</p>
                        <p className="text-xs text-slate-400">
                          {(uploadedFile.size / 1024).toFixed(1)} KB · {csvHeaders.length} columns · {csvRows.length} rows
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetImport}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-white">Map Your Columns</h4>
                    <span className="text-xs text-slate-500">{mappedCount} of {CRM_FIELDS.length} fields mapped</span>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {CRM_FIELDS.map((field) => (
                      <div key={field.key} className="flex items-center gap-4">
                        <div className="w-44 flex-shrink-0">
                          <p className="text-sm text-slate-300">{field.label}</p>
                        </div>
                        <div className="flex-1">
                          <select
                            value={columnMapping[field.key] || ''}
                            onChange={(e) => updateMapping(field.key, e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                          >
                            <option value="">— Skip —</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>{header}</option>
                            ))}
                          </select>
                        </div>
                        {columnMapping[field.key] && (
                          <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={resetImport}
                      className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportStep('preview')}
                      disabled={!columnMapping['FullName']}
                      className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        columnMapping['FullName']
                          ? 'bg-teal-600 hover:bg-teal-500 text-white'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Continue to Preview
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Step */}
              {importStep === 'preview' && (
                <div className="p-6">
                  {/* Warning Banner */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-400">Preview Mode</p>
                        <p className="text-xs text-amber-400/70">Review your data before importing. This action cannot be undone.</p>
                      </div>
                    </div>
                  </div>

                  {/* Data Preview Table — built from real CSV rows */}
                  {(() => {
                    // Determine which CRM fields are mapped so we can build columns
                    const mappedFields = CRM_FIELDS.filter(f => columnMapping[f.key]);
                    // For each CSV row, resolve mapped values
                    const previewRows = csvRows.map((row) => {
                      const record: Record<string, string> = {};
                      for (const field of mappedFields) {
                        const csvHeader = columnMapping[field.key];
                        const colIdx = csvHeaders.indexOf(csvHeader);
                        record[field.key] = colIdx !== -1 ? (row[colIdx] ?? '') : '';
                      }
                      return record;
                    });

                    if (previewRows.length === 0) {
                      return (
                        <div className="flex items-center gap-3 p-4 mb-6 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                          <p className="text-sm text-rose-400">No data rows found in the uploaded file. Please check your CSV and try again.</p>
                        </div>
                      );
                    }

                    // Show at most the first 4 mapped columns in the table to keep it readable
                    const displayFields = mappedFields.slice(0, 4);

                    return (
                      <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden mb-6">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-slate-800">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">#</th>
                                {displayFields.map(f => (
                                  <th key={f.key} className="text-left px-4 py-3 text-xs font-semibold text-slate-400">{f.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                              {previewRows.map((record, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-3 text-xs text-slate-500">{idx + 1}</td>
                                  {displayFields.map(f => (
                                    <td key={f.key} className="px-4 py-3 text-sm text-slate-300">{record[f.key] || '—'}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Summary and Actions */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      <span className="text-emerald-400 font-medium">{csvRows.length} row{csvRows.length !== 1 ? 's' : ''}</span> ready to import
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={resetImport}
                        className="px-4 py-2 text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        Cancel Import
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportStep('mapping')}
                        className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportStep('complete')}
                        disabled={csvRows.length === 0}
                        className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                          csvRows.length > 0
                            ? 'bg-teal-600 hover:bg-teal-500 text-white'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Import {csvRows.length} Record{csvRows.length !== 1 ? 's' : ''}
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
                  <p className="text-sm text-slate-400 mb-6">Successfully imported 2 contacts into your CRM.</p>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={resetImport}
                      className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Import More
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      View Contacts
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Templates */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Download Templates</h3>
              <p className="text-xs text-slate-400 mb-4">Use these templates to ensure your data is formatted correctly.</p>

              <div className="space-y-3">
                {importTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
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

              <div className="mt-6 pt-6 border-t border-slate-700">
                <h4 className="text-sm font-semibold text-white mb-3">Import Tips</h4>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-400 mt-0.5 flex-shrink-0" />
                    Use the first row for column headers
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-400 mt-0.5 flex-shrink-0" />
                    Phone numbers should include country code
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-400 mt-0.5 flex-shrink-0" />
                    Maximum 1000 records per import
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Export Options */}
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
                      selectedExports.has(option.id)
                        ? 'bg-teal-500 border-teal-500'
                        : 'border-slate-500'
                    }`}>
                      {selectedExports.has(option.id) && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
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

              {/* Export Format */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-white mb-3">Export Format</h4>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                      exportFormat === 'csv'
                        ? 'bg-teal-500/10 border-teal-500/40 text-teal-400'
                        : 'bg-slate-700/30 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    <span className="font-medium">CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('xlsx')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                      exportFormat === 'xlsx'
                        ? 'bg-teal-500/10 border-teal-500/40 text-teal-400'
                        : 'bg-slate-700/30 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    <span className="font-medium">Excel</span>
                  </button>
                </div>
              </div>

              {/* Date Range (Optional) */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-white mb-3">Date Range (Optional)</h4>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="date"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                    />
                  </div>
                  <span className="text-slate-500">to</span>
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="date"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Export Button */}
              <button
                type="button"
                disabled={selectedExports.size === 0}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  selectedExports.size > 0
                    ? 'bg-teal-600 hover:bg-teal-500 text-white'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Download className="w-4 h-4" />
                Export {selectedExports.size > 0 ? `${selectedExports.size} Dataset${selectedExports.size > 1 ? 's' : ''}` : 'Selected Data'}
              </button>
            </div>
          </div>

          {/* Export History */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Recent Exports</h3>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">contacts_export.csv</p>
                    <p className="text-xs text-slate-500">Feb 8, 2026 · 12 records</p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 cursor-pointer hover:text-teal-400" />
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">orders_jan2026.xlsx</p>
                    <p className="text-xs text-slate-500">Jan 31, 2026 · 45 records</p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 cursor-pointer hover:text-teal-400" />
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">activities_q4.csv</p>
                    <p className="text-xs text-slate-500">Dec 31, 2025 · 128 records</p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 cursor-pointer hover:text-teal-400" />
                </div>
              </div>

              <button
                type="button"
                className="w-full mt-4 text-center text-xs font-medium text-teal-400 hover:text-teal-300"
              >
                View All Export History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
