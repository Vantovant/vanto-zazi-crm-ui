import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, X, Sparkles, BookOpen, User, TrendingUp, Send, Loader2, ThumbsUp, ThumbsDown, Minus, FileText, Upload, Trash2 } from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import { sanitizeAplgoId } from '@/utils/aplgoId';

type Tab = 'ask' | 'page' | 'contact' | 'insight' | 'knowledge';
interface Message { role: 'user' | 'assistant'; content: string }
interface KnowledgeDoc {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zazi-copilot`;

async function streamChat(
  body: Record<string, unknown>,
  onDelta: (t: string) => void,
  onDone: () => void,
) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `Error ${resp.status}`);
  }
  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf('\n')) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { /* partial */ }
    }
  }
  onDone();
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold text-teal-400 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold text-teal-400 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-teal-300 mb-1">{children}</h3>,
        p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-slate-300">{children}</li>,
        strong: ({ children }) => <strong className="text-teal-300 font-semibold">{children}</strong>,
        em: ({ children }) => <em className="text-slate-400">{children}</em>,
        code: ({ children }) => <code className="bg-slate-700 px-1 py-0.5 rounded text-xs text-teal-300">{children}</code>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
];
const ACCEPTED_EXT = ['.pdf', '.docx', '.doc', '.txt', '.md'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ZaziCopilot({ selectedContactId }: { selectedContactId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('ask');
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactMessages, setContactMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [contactInput, setContactInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageContent, setPageContent] = useState('');
  const [insightContent, setInsightContent] = useState('');
  const [feedbackShown, setFeedbackShown] = useState<string | null>(null);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const { contacts, orders } = useCrm();
  const { user } = useAuth();

  const currentRoute = location.pathname.replace('/', '') || 'dashboard';

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, contactMessages, pageContent, insightContent]);

  const selectedContact = selectedContactId
    ? contacts.find(c => String(c.id) === selectedContactId)
    : null;

  // Load knowledge docs
  const loadKnowledgeDocs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_knowledge_docs')
      .select('id, file_name, file_type, file_size, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setKnowledgeDocs(data as KnowledgeDoc[]);
    setDocsLoaded(true);
  }, [user]);

  useEffect(() => {
    if (tab === 'knowledge' && !docsLoaded) loadKnowledgeDocs();
  }, [tab, docsLoaded, loadKnowledgeDocs]);

  // Upload a knowledge doc
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXT.includes(ext)) {
      alert('Unsupported file type. Please upload PDF, Word (.docx/.doc), or text (.txt/.md) files.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('knowledge-docs')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: docRecord, error: insertError } = await supabase
        .from('user_knowledge_docs')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_type: file.type || ext,
          file_path: filePath,
          file_size: file.size,
          status: 'processing',
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      // Trigger parsing
      await supabase.functions.invoke('parse-knowledge-doc', {
        body: { docId: docRecord.id },
      });

      await loadKnowledgeDocs();
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [user, loadKnowledgeDocs]);

  // Delete a knowledge doc
  const deleteDoc = useCallback(async (doc: KnowledgeDoc) => {
    if (!user || !confirm(`Delete "${doc.file_name}"?`)) return;
    try {
      // Get full doc to find file_path
      const { data: fullDoc } = await supabase
        .from('user_knowledge_docs')
        .select('file_path')
        .eq('id', doc.id)
        .single();

      if (fullDoc?.file_path) {
        await supabase.storage.from('knowledge-docs').remove([fullDoc.file_path]);
      }
      await supabase.from('user_knowledge_docs').delete().eq('id', doc.id);
      setKnowledgeDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  }, [user]);

  // Build a CRM summary that gets passed with every request
  const crmSummary = useMemo(() => {
    const contactsList = contacts.map(c => ({
      id: c.id,
      name: c.FullName,
      temp: c.LeadTemperature,
      type: c.LeadType,
      status: c.RegistrationStatus,
      commStatus: c.CommunicationStatus,
      focus: c.FocusArea,
      path: c.LeadPath,
      phone: c.PhoneNumber,
      city: c.City,
      aplgoId: c.APLGoID,
    }));
    return {
      totalContacts: contacts.length,
      contacts: contactsList,
      hot: contacts.filter(c => c.LeadTemperature === 'Hot').length,
      warm: contacts.filter(c => c.LeadTemperature === 'Warm').length,
      cold: contacts.filter(c => c.LeadTemperature === 'Cold').length,
      activated: contacts.filter(c => c.RegistrationStatus === 'Activated').length,
      registered: contacts.filter(c => c.RegistrationStatus === 'Registered').length,
      notRegistered: contacts.filter(c => c.RegistrationStatus === 'Not Registered').length,
      registeredNoPurchase: contacts.filter(c => c.LeadType === 'Registered_Nopurchase').length,
      purchaseNoStatus: contacts.filter(c => c.LeadType === 'Purchase_Nostatus').length,
      purchaseStatus: contacts.filter(c => c.LeadType === 'Purchase_Status').length,
      prospects: contacts.filter(c => c.LeadType === 'Prospect').length,
      totalOrders: orders.length,
      paidOrders: orders.filter(o => o.status === 'Paid').length,
    };
  }, [contacts, orders]);

  // Fetch user's knowledge docs content for AI context
  const getKnowledgeContext = useCallback(async (): Promise<string> => {
    if (!user) return '';
    const { data } = await supabase
      .from('user_knowledge_docs')
      .select('file_name, extracted_text')
      .eq('user_id', user.id)
      .eq('status', 'ready');
    if (!data || data.length === 0) return '';
    // Combine all docs, truncate total to ~50k chars
    let combined = data.map((d: { file_name: string; extracted_text: string | null }) =>
      `--- Document: ${d.file_name} ---\n${d.extracted_text || ''}`
    ).join('\n\n');
    if (combined.length > 50000) combined = combined.substring(0, 50000) + '\n[Knowledge base truncated]';
    return combined;
  }, [user]);

  const sendAsk = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    let soFar = '';
    const upsert = (chunk: string) => {
      soFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: soFar } : m);
        return [...prev, { role: 'assistant', content: soFar }];
      });
    };

    try {
      // ===== EXACT APLGO ID LOOKUP (FIX 3) =====
      // Detect "APLGO ID 964067", "ID 964067", "find 964067", "who is 964067"
      // Look for any 4-10 digit number in the question.
      const aplgoIdMatches = input.match(/\b(\d{4,10})\b/g) || [];
      const looksLikeAplgoQuery = /\b(aplgo|apl-?go|apl|associate(?:'?s)?\s*id|find|lookup|who\s+is|search)\b/i.test(input)
        || aplgoIdMatches.length > 0;

      let exactLookupBlock = '';
      if (user && looksLikeAplgoQuery && aplgoIdMatches.length > 0) {
        for (const rawCandidate of aplgoIdMatches.slice(0, 3)) {
          const candidate = sanitizeAplgoId(rawCandidate);
          if (!candidate) continue;
          const { data, error } = await supabase
            .from('contacts')
            .select('id, full_name, aplgo_id, phone_number, phone_normalized, email_address, email_normalized, level, leg, go_status, lead_type, registration_status, sponsor_name, city, country, additional_notes')
            .eq('user_id', user.id)
            .eq('aplgo_id', candidate)
            .limit(1);
          if (!error && data && data.length > 0) {
            exactLookupBlock += `\n\nEXACT_APLGO_LOOKUP for ID ${candidate}: FOUND\n${JSON.stringify(data[0], null, 2)}\n`;
          } else {
            exactLookupBlock += `\n\nEXACT_APLGO_LOOKUP for ID ${candidate}: NOT FOUND in contacts.aplgo_id (no fuzzy guessing allowed).\n`;
          }
        }
      }

      const knowledgeContext = await getKnowledgeContext();
      const messageWithLookup = exactLookupBlock
        ? `${input}\n\n[SYSTEM-INJECTED EXACT DATABASE LOOKUP — use these results verbatim. If FOUND, return that contact's actual details. If NOT FOUND, say "No exact match for APLGO ID X" and DO NOT suggest similar IDs unless explicitly labelled as a fallback.]${exactLookupBlock}`
        : input;

      await streamChat(
        { action: 'ask', message: messageWithLookup, route: currentRoute, crmSummary, knowledgeContext },
        upsert,
        () => setLoading(false),
      );
    } catch (e) {
      upsert(`\n\n⚠️ ${e instanceof Error ? e.message : 'Error connecting to AI'}`);
      setLoading(false);
    }
  }, [input, loading, currentRoute, crmSummary, getKnowledgeContext, user]);

  const sendContactChat = useCallback(async () => {
    if (!contactInput.trim() || loading || !selectedContact) return;
    const userMsg: Message = { role: 'user', content: contactInput };
    setContactMessages(prev => [...prev, userMsg]);
    setContactInput('');
    setLoading(true);

    const contactOrders = orders.filter(o => o.contactName === selectedContact.FullName);
    let soFar = '';
    const upsert = (chunk: string) => {
      soFar += chunk;
      setContactMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: soFar } : m);
        return [...prev, { role: 'assistant', content: soFar }];
      });
    };

    try {
      const knowledgeContext = await getKnowledgeContext();
      await streamChat(
        {
          action: 'contact_chat',
          message: contactInput,
          contactData: { ...selectedContact, orders: contactOrders },
          contactId: String(selectedContact.id),
          crmSummary,
          knowledgeContext,
        },
        upsert,
        () => setLoading(false),
      );
    } catch (e) {
      upsert(`\n\n⚠️ ${e instanceof Error ? e.message : 'Error connecting to AI'}`);
      setLoading(false);
    }
  }, [contactInput, loading, selectedContact, orders, crmSummary, getKnowledgeContext]);

  const loadPageGuidance = useCallback(async () => {
    if (loading) return;
    setPageContent('');
    setLoading(true);
    let soFar = '';
    try {
      await streamChat(
        { action: 'page_guidance', route: currentRoute, crmSummary },
        (chunk) => { soFar += chunk; setPageContent(soFar); },
        () => setLoading(false),
      );
    } catch (e) {
      setPageContent(`⚠️ ${e instanceof Error ? e.message : 'Error'}`);
      setLoading(false);
    }
  }, [currentRoute, loading, crmSummary]);

  const loadContactAnalysis = useCallback(async () => {
    if (!selectedContact || loading) return;
    setContactMessages([]);
    setLoading(true);
    const contactOrders = orders.filter(o => o.contactName === selectedContact.FullName);
    let soFar = '';

    const addAnalysis = (chunk: string) => {
      soFar += chunk;
      setContactMessages([{ role: 'assistant', content: soFar }]);
    };

    try {
      const knowledgeContext = await getKnowledgeContext();
      await streamChat(
        {
          action: 'contact_analysis',
          contactId: String(selectedContact.id),
          contactData: { ...selectedContact, orders: contactOrders },
          crmSummary,
          knowledgeContext,
        },
        addAnalysis,
        () => { setLoading(false); setFeedbackShown(String(selectedContact.id)); },
      );
    } catch (e) {
      setContactMessages([{ role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Error'}` }]);
      setLoading(false);
    }
  }, [selectedContact, orders, loading, crmSummary, getKnowledgeContext]);

  const loadInsight = useCallback(async () => {
    if (loading) return;
    setInsightContent('');
    setLoading(true);
    let soFar = '';
    try {
      const knowledgeContext = await getKnowledgeContext();
      await streamChat(
        { action: 'business_insight', message: `My CRM summary: ${JSON.stringify(crmSummary)}`, crmSummary, knowledgeContext },
        (chunk) => { soFar += chunk; setInsightContent(soFar); },
        () => setLoading(false),
      );
    } catch (e) {
      setInsightContent(`⚠️ ${e instanceof Error ? e.message : 'Error'}`);
      setLoading(false);
    }
  }, [crmSummary, loading, getKnowledgeContext]);

  const handleFeedback = async (success: boolean | null) => {
    if (!user || !selectedContact) return;
    try {
      await supabase.from('ai_action_log').insert({
        user_id: user.id,
        contact_id: String(selectedContact.id),
        recommended_action: 'AI contact analysis',
        executed_action: success === true ? 'User confirmed success' : success === false ? 'User reported failure' : 'Not yet',
        manual_mark_success: success === true,
        success_score: success === true ? 50 : 0,
        success_source: success === true ? 'manual' : '',
      });
    } catch (e) {
      console.error('Feedback log error:', e);
    }
    setFeedbackShown(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const tabs: { key: Tab; icon: typeof MessageSquare; label: string }[] = [
    { key: 'ask', icon: MessageSquare, label: 'Ask ZAZI' },
    { key: 'page', icon: BookOpen, label: 'Page Guide' },
    { key: 'contact', icon: User, label: 'This Contact' },
    { key: 'insight', icon: TrendingUp, label: 'Insights' },
    { key: 'knowledge', icon: FileText, label: 'Knowledge' },
  ];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-500 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
          aria-label="Open ZAZI Copilot"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <span className="font-semibold text-white text-sm">ZAZI Copilot</span>
              <span className="text-[10px] bg-teal-600/20 text-teal-400 px-1.5 py-0.5 rounded">APLGO + MLM Expert</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-700 bg-slate-800/30">
            {tabs.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  if (t.key === 'page' && !pageContent) loadPageGuidance();
                  if (t.key === 'contact' && selectedContact && contactMessages.length === 0) loadContactAnalysis();
                  if (t.key === 'insight' && !insightContent) loadInsight();
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                  tab === t.key ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {tab === 'ask' && (
              <>
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <Sparkles className="w-10 h-10 text-teal-400/50 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Ask me anything about your CRM, contacts, APLGO business, or MLM strategies.</p>
                    <p className="text-xs text-slate-600 mt-1">I have access to all {contacts.length} contacts & {orders.length} orders</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block max-w-[85%] px-3 py-2 rounded-lg ${
                      m.role === 'user'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}>
                      {m.role === 'assistant' ? <MarkdownContent content={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                    </div>
                  </div>
                ))}
                {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                  </div>
                )}
              </>
            )}

            {tab === 'page' && (
              <div className="text-sm text-slate-300">
                {!pageContent && loading && (
                  <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading guidance...</div>
                )}
                {pageContent ? <MarkdownContent content={pageContent} /> : (!loading && <p className="text-slate-500">Click to load page guidance.</p>)}
                {!loading && pageContent && (
                  <button type="button" onClick={loadPageGuidance} className="mt-3 text-xs text-teal-400 hover:underline">Refresh</button>
                )}
              </div>
            )}

            {tab === 'contact' && (
              <div className="text-sm text-slate-300">
                {!selectedContact ? (
                  <div className="text-center py-8">
                    <User className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500">Open a contact's details to get AI analysis.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
                      <p className="font-medium text-teal-400">{selectedContact.FullName}</p>
                      <p className="text-xs text-slate-500">{selectedContact.LeadTemperature} · {selectedContact.LeadType} · {selectedContact.RegistrationStatus}</p>
                    </div>
                    {contactMessages.length === 0 && loading && (
                      <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing contact...</div>
                    )}
                    {contactMessages.map((m, i) => (
                      <div key={i} className={`text-sm mb-3 ${m.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`inline-block max-w-[85%] px-3 py-2 rounded-lg ${
                          m.role === 'user'
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-800 text-slate-200 border border-slate-700'
                        }`}>
                          {m.role === 'assistant' ? <MarkdownContent content={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                        </div>
                      </div>
                    ))}
                    {!loading && contactMessages.length > 0 && feedbackShown === String(selectedContact.id) && (
                      <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <p className="text-xs text-slate-400 mb-2">Did this recommendation help move the prospect forward?</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleFeedback(true)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded text-xs hover:bg-emerald-600/30">
                            <ThumbsUp className="w-3 h-3" /> Yes
                          </button>
                          <button type="button" onClick={() => handleFeedback(null)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-slate-400 rounded text-xs hover:bg-slate-600">
                            <Minus className="w-3 h-3" /> Not Yet
                          </button>
                          <button type="button" onClick={() => handleFeedback(false)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 text-red-400 rounded text-xs hover:bg-red-600/30">
                            <ThumbsDown className="w-3 h-3" /> Failed
                          </button>
                        </div>
                      </div>
                    )}
                    {!loading && (
                      <button type="button" onClick={loadContactAnalysis} className="mt-3 text-xs text-teal-400 hover:underline">Re-analyze</button>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'insight' && (
              <div className="text-sm text-slate-300">
                {!insightContent && loading && (
                  <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Generating insights...</div>
                )}
                {insightContent ? <MarkdownContent content={insightContent} /> : (!loading && <p className="text-slate-500">Click to generate business insights.</p>)}
                {!loading && insightContent && (
                  <button type="button" onClick={loadInsight} className="mt-3 text-xs text-teal-400 hover:underline">Refresh</button>
                )}
              </div>
            )}

            {tab === 'knowledge' && (
              <div className="text-sm text-slate-300">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-teal-400 mb-1">Knowledge Base</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Upload documents about your business — compensation plans, product guides, rules, prices, incentives. ZAZI will use this knowledge when answering your questions.
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600/20 border border-teal-600/30 text-teal-400 rounded-lg hover:bg-teal-600/30 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Upload Document</>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-600 mt-1.5 text-center">PDF, Word (.docx/.doc), or Text (.txt/.md) · Max 10MB</p>
                </div>

                {knowledgeDocs.length === 0 && docsLoaded && (
                  <div className="text-center py-6">
                    <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">No documents uploaded yet.</p>
                    <p className="text-xs text-slate-600">Upload your business docs to train ZAZI.</p>
                  </div>
                )}

                {knowledgeDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-800 rounded-lg border border-slate-700 mb-2">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-slate-600">
                        {formatFileSize(doc.file_size)} · {' '}
                        <span className={
                          doc.status === 'ready' ? 'text-emerald-500' :
                          doc.status === 'processing' ? 'text-amber-500' :
                          doc.status === 'error' ? 'text-red-500' : 'text-slate-500'
                        }>
                          {doc.status === 'ready' ? '✓ Ready' :
                           doc.status === 'processing' ? '⏳ Processing' :
                           doc.status === 'error' ? '✗ Error' :
                           doc.status === 'empty' ? '⚠ No text found' : doc.status}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteDoc(doc)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input - Ask tab */}
          {tab === 'ask' && (
            <div className="border-t border-slate-700 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendAsk()}
                  placeholder="Ask about your contacts, APLGO, or MLM..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={sendAsk}
                  disabled={loading || !input.trim()}
                  className="px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Input - Contact tab */}
          {tab === 'contact' && selectedContact && (
            <div className="border-t border-slate-700 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contactInput}
                  onChange={e => setContactInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendContactChat()}
                  placeholder={`Ask about ${selectedContact.FullName}...`}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={sendContactChat}
                  disabled={loading || !contactInput.trim()}
                  className="px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
