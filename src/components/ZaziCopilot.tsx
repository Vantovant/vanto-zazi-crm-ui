import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, X, Sparkles, BookOpen, User, TrendingUp, Send, Loader2, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'ask' | 'page' | 'contact' | 'insight';
interface Message { role: 'user' | 'assistant'; content: string }

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

export function ZaziCopilot({ selectedContactId }: { selectedContactId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('ask');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageContent, setPageContent] = useState('');
  const [contactContent, setContactContent] = useState('');
  const [insightContent, setInsightContent] = useState('');
  const [feedbackShown, setFeedbackShown] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { contacts, orders } = useCrm();
  const { user } = useAuth();

  const currentRoute = location.pathname.replace('/', '') || 'dashboard';

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pageContent, contactContent, insightContent]);

  const selectedContact = selectedContactId
    ? contacts.find(c => String(c.id) === selectedContactId)
    : null;

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
      await streamChat(
        { action: 'ask', message: input, route: currentRoute },
        upsert,
        () => setLoading(false),
      );
    } catch (e) {
      upsert(`\n\n⚠️ ${e instanceof Error ? e.message : 'Error connecting to AI'}`);
      setLoading(false);
    }
  }, [input, loading, currentRoute]);

  const loadPageGuidance = useCallback(async () => {
    if (loading) return;
    setPageContent('');
    setLoading(true);
    let soFar = '';
    try {
      await streamChat(
        { action: 'page_guidance', route: currentRoute },
        (chunk) => { soFar += chunk; setPageContent(soFar); },
        () => setLoading(false),
      );
    } catch (e) {
      setPageContent(`⚠️ ${e instanceof Error ? e.message : 'Error'}`);
      setLoading(false);
    }
  }, [currentRoute, loading]);

  const loadContactAnalysis = useCallback(async () => {
    if (!selectedContact || loading) return;
    setContactContent('');
    setLoading(true);
    const contactOrders = orders.filter(o => o.contactName === selectedContact.FullName);
    let soFar = '';
    try {
      await streamChat(
        {
          action: 'contact_analysis',
          contactId: String(selectedContact.id),
          contactData: { ...selectedContact, orders: contactOrders },
        },
        (chunk) => { soFar += chunk; setContactContent(soFar); },
        () => { setLoading(false); setFeedbackShown(String(selectedContact.id)); },
      );
    } catch (e) {
      setContactContent(`⚠️ ${e instanceof Error ? e.message : 'Error'}`);
      setLoading(false);
    }
  }, [selectedContact, orders, loading]);

  const loadInsight = useCallback(async () => {
    if (loading) return;
    setInsightContent('');
    setLoading(true);
    const summary = {
      totalContacts: contacts.length,
      hot: contacts.filter(c => c.LeadTemperature === 'Hot').length,
      warm: contacts.filter(c => c.LeadTemperature === 'Warm').length,
      cold: contacts.filter(c => c.LeadTemperature === 'Cold').length,
      activated: contacts.filter(c => c.RegistrationStatus === 'Activated').length,
      registered: contacts.filter(c => c.RegistrationStatus === 'Registered').length,
      distributors: contacts.filter(c => c.LeadType === 'Distributor').length,
      customers: contacts.filter(c => c.LeadType === 'Customer').length,
      totalOrders: orders.length,
      paidOrders: orders.filter(o => o.status === 'Paid').length,
    };
    let soFar = '';
    try {
      await streamChat(
        { action: 'business_insight', message: `My CRM summary: ${JSON.stringify(summary)}` },
        (chunk) => { soFar += chunk; setInsightContent(soFar); },
        () => setLoading(false),
      );
    } catch (e) {
      setInsightContent(`⚠️ ${e instanceof Error ? e.message : 'Error'}`);
      setLoading(false);
    }
  }, [contacts, orders, loading]);

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

  const tabs: { key: Tab; icon: typeof MessageSquare; label: string }[] = [
    { key: 'ask', icon: MessageSquare, label: 'Ask ZAZI' },
    { key: 'page', icon: BookOpen, label: 'Page Guide' },
    { key: 'contact', icon: User, label: 'This Contact' },
    { key: 'insight', icon: TrendingUp, label: 'Insights' },
  ];

  return (
    <>
      {/* Floating bubble */}
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

      {/* Side panel */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <span className="font-semibold text-white text-sm">ZAZI Copilot</span>
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
                  if (t.key === 'contact' && selectedContact && !contactContent) loadContactAnalysis();
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
                    <p className="text-sm text-slate-400">Ask me anything about your CRM, contacts, or APLGO business.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block max-w-[85%] px-3 py-2 rounded-lg ${
                      m.role === 'user'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
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
              <div className="text-sm text-slate-300 whitespace-pre-wrap">
                {!pageContent && loading && (
                  <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading guidance...</div>
                )}
                {pageContent || (!loading && <p className="text-slate-500">Click to load page guidance.</p>)}
                {!loading && pageContent && (
                  <button type="button" onClick={loadPageGuidance} className="mt-3 text-xs text-teal-400 hover:underline">Refresh</button>
                )}
              </div>
            )}

            {tab === 'contact' && (
              <div className="text-sm text-slate-300 whitespace-pre-wrap">
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
                    {!contactContent && loading && (
                      <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing contact...</div>
                    )}
                    {contactContent}
                    {!loading && contactContent && feedbackShown === String(selectedContact.id) && (
                      <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <p className="text-xs text-slate-400 mb-2">Did this recommendation help move the prospect forward?</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleFeedback(true)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded text-xs hover:bg-emerald-600/30">
                            <ThumbsUp className="w-3 h-3" /> Yes — It Worked
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
              <div className="text-sm text-slate-300 whitespace-pre-wrap">
                {!insightContent && loading && (
                  <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Generating insights...</div>
                )}
                {insightContent || (!loading && <p className="text-slate-500">Click to generate business insights.</p>)}
                {!loading && insightContent && (
                  <button type="button" onClick={loadInsight} className="mt-3 text-xs text-teal-400 hover:underline">Refresh</button>
                )}
              </div>
            )}
          </div>

          {/* Input (Ask tab only) */}
          {tab === 'ask' && (
            <div className="border-t border-slate-700 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendAsk()}
                  placeholder="Ask ZAZI anything..."
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
        </div>
      )}
    </>
  );
}
