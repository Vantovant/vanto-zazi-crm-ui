import { useState } from 'react';
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
  Copy,
  ChevronDown,
} from 'lucide-react';
import { DataStatusBanner } from '../components/DataStatusBanner';
import { useCrm } from '@/contexts/CrmContext';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'complete';

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
  const [showDuplicates, setShowDuplicates] = useState(false);

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
      setUploadedFile(e.dataTransfer.files[0]);
      setImportStep('mapping');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setUploadedFile(e.target.files[0]);
      setImportStep('mapping');
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
  };

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
                      Supports CSV and Excel files (.csv, .xlsx)
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
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
                        <p className="text-xs text-slate-400">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
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

                  <h4 className="text-sm font-semibold text-white mb-4">Map Your Columns</h4>

                  <div className="space-y-3">
                    {['Full Name', 'Phone Number', 'Email', 'City', 'Lead Temperature', 'Focus Area'].map((field) => (
                      <div key={field} className="flex items-center gap-4">
                        <div className="w-40">
                          <p className="text-sm text-slate-300">{field}</p>
                        </div>
                        <div className="flex-1">
                          <select className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500">
                            <option value="">Select column...</option>
                            <option value="col_a">Column A</option>
                            <option value="col_b">Column B</option>
                            <option value="col_c">Column C</option>
                            <option value="col_d">Column D</option>
                          </select>
                        </div>
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
                      className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Continue to Preview
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Step */}
              {importStep === 'preview' && (
                <div className="p-6">
                  {/* Warning Banners */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-400">Preview Mode</p>
                        <p className="text-xs text-amber-400/70">Review the data before importing. This action cannot be undone.</p>
                      </div>
                    </div>

                    {/* Duplicate Warning */}
                    <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <Copy className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-orange-400">2 Potential Duplicates Detected</p>
                        <p className="text-xs text-orange-400/70 mt-1">
                          Matches found based on <span className="font-medium">Email Address</span> or <span className="font-medium">Phone Number</span>.
                          You can proceed with import, but duplicate records may be created.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowDuplicates(!showDuplicates)}
                          className="mt-2 text-xs font-medium text-orange-400 hover:text-orange-300 flex items-center gap-1"
                        >
                          {showDuplicates ? 'Hide' : 'Review'} Duplicates
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDuplicates ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Duplicate Details Panel */}
                    {showDuplicates && (
                      <div className="bg-slate-800 rounded-lg border border-orange-500/20 overflow-hidden">
                        <div className="px-4 py-3 bg-orange-500/5 border-b border-orange-500/20">
                          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Duplicate Review</p>
                        </div>
                        <div className="divide-y divide-slate-700">
                          {/* Duplicate 1 */}
                          <div className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-white">Sarah Johnson</p>
                                <p className="text-xs text-slate-400 mt-1">From import file (Row 4)</p>
                              </div>
                              <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">Duplicate</span>
                            </div>
                            <div className="mt-3 p-3 bg-slate-900 rounded-lg">
                              <p className="text-xs text-slate-500 mb-2">Matches existing contact:</p>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-medium">SN</div>
                                <div>
                                  <p className="text-sm text-slate-300">Sarah Nkosi</p>
                                  <p className="text-xs text-slate-500">Matched on: <span className="text-orange-400">+27 82 345 6789</span> (Phone)</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Duplicate 2 */}
                          <div className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-white">Mike Williams</p>
                                <p className="text-xs text-slate-400 mt-1">From import file (Row 7)</p>
                              </div>
                              <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">Duplicate</span>
                            </div>
                            <div className="mt-3 p-3 bg-slate-900 rounded-lg">
                              <p className="text-xs text-slate-500 mb-2">Matches existing contact:</p>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-medium">MZ</div>
                                <div>
                                  <p className="text-sm text-slate-300">Mandla Zulu</p>
                                  <p className="text-xs text-slate-500">Matched on: <span className="text-orange-400">mandla.zulu@icloud.com</span> (Email)</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="px-4 py-3 bg-slate-900 border-t border-slate-700">
                          <p className="text-xs text-slate-500">
                            <span className="text-orange-400 font-medium">Note:</span> Proceeding will create new records. Duplicate merging will be available in a future update.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Data Preview Table */}
                  <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden mb-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-800">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Name</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Phone</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Email</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          <tr>
                            <td className="px-4 py-3 text-sm text-slate-300">John Smith</td>
                            <td className="px-4 py-3 text-sm text-slate-400">+27 81 234 5678</td>
                            <td className="px-4 py-3 text-sm text-slate-400">john@example.com</td>
                            <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">Valid</span></td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-sm text-slate-300">Jane Doe</td>
                            <td className="px-4 py-3 text-sm text-slate-400">+27 82 345 6789</td>
                            <td className="px-4 py-3 text-sm text-slate-400">jane@example.com</td>
                            <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">Valid</span></td>
                          </tr>
                          <tr className="bg-orange-500/5">
                            <td className="px-4 py-3 text-sm text-slate-300">
                              <div className="flex items-center gap-2">
                                Sarah Johnson
                                <Copy className="w-3.5 h-3.5 text-orange-400" />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-orange-400">+27 82 345 6789</td>
                            <td className="px-4 py-3 text-sm text-slate-400">sarah.j@example.com</td>
                            <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">Duplicate</span></td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-sm text-slate-300">Bob Wilson</td>
                            <td className="px-4 py-3 text-sm text-rose-400">Invalid phone</td>
                            <td className="px-4 py-3 text-sm text-slate-400">bob@example.com</td>
                            <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-full">Error</span></td>
                          </tr>
                          <tr className="bg-orange-500/5">
                            <td className="px-4 py-3 text-sm text-slate-300">
                              <div className="flex items-center gap-2">
                                Mike Williams
                                <Copy className="w-3.5 h-3.5 text-orange-400" />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-400">+27 86 111 2222</td>
                            <td className="px-4 py-3 text-sm text-orange-400">mandla.zulu@icloud.com</td>
                            <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">Duplicate</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary and Actions */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      <span className="text-emerald-400 font-medium">2 valid</span> ·
                      <span className="text-orange-400 font-medium ml-1">2 duplicates</span> ·
                      <span className="text-rose-400 font-medium ml-1">1 error</span> ·
                      <span className="ml-1">5 total rows</span>
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
                        className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Import 4 Records (incl. duplicates)
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
