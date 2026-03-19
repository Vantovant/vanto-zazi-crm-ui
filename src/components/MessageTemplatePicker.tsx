import { useState, useMemo, useCallback } from 'react';
import {
  X, MessageCircle, Mail, Sparkles, ChevronRight, Copy, ExternalLink,
  Check, Clock, Loader2, Send, BookOpen, Zap, ChevronDown, ChevronUp, PenLine, Download, Image,
} from 'lucide-react';
import aplgoLogo from '@/assets/aplgo-logo.png';
import type { Prospect } from '@/data/mockData';
import type { MessageTemplate } from '@/hooks/useMessageTemplates';
import { useMessageTemplates, TEMPLATE_CATEGORIES } from '@/hooks/useMessageTemplates';
import { useContactActivities } from '@/hooks/useContactActivities';
import { useCrm } from '@/contexts/CrmContext';
import { mergeTemplate, mergeSubject } from '@/utils/templateMerge';
import { recommendTemplate } from '@/utils/templateRecommender';

interface MessageTemplatePickerProps {
  contact: Prospect;
  channel: 'whatsapp' | 'email';
  onClose: () => void;
}

const confidenceColors = {
  High: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  Low: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
};

type PickerStep = 'choose' | 'preview' | 'custom';

export function MessageTemplatePicker({ contact, channel, onClose }: MessageTemplatePickerProps) {
  const { templates, loading: templatesLoading } = useMessageTemplates();
  const { logActivity, daysSinceLastActivity, getContactActivities } = useContactActivities();
  const { updateContact } = useCrm();

  const [step, setStep] = useState<PickerStep>('choose');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [editedBody, setEditedBody] = useState('');
  const [editedSubject, setEditedSubject] = useState('');
  const [customRawBody, setCustomRawBody] = useState('');
  const [customRawSubject, setCustomRawSubject] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [copied, setCopied] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const [logging, setLogging] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const days = daysSinceLastActivity(String(contact.id));
  const hasActivity = getContactActivities(String(contact.id)).length > 0;

  const recommendation = useMemo(() => {
    return recommendTemplate(contact, templates, channel, days, hasActivity);
  }, [contact, templates, channel, days, hasActivity]);

  const categories = useMemo(() => {
    return TEMPLATE_CATEGORIES.filter(c =>
      templates.some(t => t.channel === channel && t.category === c)
    );
  }, [templates, channel]);

  const mergeCtx = useMemo(() => ({ contact }), [contact]);

  const handleSelectTemplate = useCallback((t: MessageTemplate) => {
    setSelectedTemplate(t);
    setEditedBody(mergeTemplate(t.body, mergeCtx));
    setEditedSubject(channel === 'email' ? mergeSubject(t.subject, mergeCtx) : '');
    setStep('preview');
  }, [mergeCtx, channel]);

  /* ---------- Custom message helpers ---------- */
  const personalizeCustom = useCallback((raw: string) => {
    return mergeTemplate(raw, mergeCtx);
  }, [mergeCtx]);

  const handleEnterCustomMode = useCallback(() => {
    setSelectedTemplate(null);
    setCustomRawBody('');
    setCustomRawSubject('');
    setEditedBody('');
    setEditedSubject('');
    setStep('custom');
  }, []);

  const handleCustomPreview = useCallback(() => {
    setEditedBody(personalizeCustom(customRawBody));
    if (channel === 'email') setEditedSubject(personalizeCustom(customRawSubject));
    setStep('preview');
  }, [customRawBody, customRawSubject, channel, personalizeCustom]);

  /* ---------- Send helpers ---------- */
  const handleCopy = useCallback(() => {
    const text = channel === 'email' ? `Subject: ${editedSubject}\n\n${editedBody}` : editedBody;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editedBody, editedSubject, channel]);

  const handleOpenWhatsApp = useCallback(() => {
    const phone = contact.PhoneNumber.replace(/\s/g, '').replace('+', '');
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(editedBody)}`, '_blank');
    }
  }, [contact, editedBody]);

  const handleOpenEmail = useCallback(() => {
    const email = contact.EmailAddress;
    if (email) {
      window.open(`mailto:${email}?subject=${encodeURIComponent(editedSubject)}&body=${encodeURIComponent(editedBody)}`, '_blank');
    }
  }, [contact, editedBody, editedSubject]);

  const handleSendAndLog = useCallback(async () => {
    setLogging(true);
    const isCustom = !selectedTemplate;
    const summaryText = isCustom
      ? `Custom ${channel === 'whatsapp' ? 'WhatsApp' : 'Email'} message sent`
      : `Sent template: ${selectedTemplate!.template_name}`;
    await logActivity({
      contact_id: String(contact.id),
      activity_type: channel === 'whatsapp' ? 'whatsapp' : 'email',
      summary: summaryText,
      notes: editedBody.substring(0, 500),
      next_action: nextAction,
    });
    const actionText = `${channel === 'whatsapp' ? 'WhatsApp' : 'Email'}: ${isCustom ? 'Custom message' : selectedTemplate!.template_name} (${new Date().toLocaleDateString()})`;
    await updateContact(String(contact.id), {
      ActionTaken: actionText,
      ...(nextAction ? { NextAction: nextAction } : {}),
    } as any);

    if (channel === 'whatsapp') handleOpenWhatsApp();
    else handleOpenEmail();

    setLogging(false);
    setLogSuccess(true);
    setTimeout(() => onClose(), 1500);
  }, [selectedTemplate, contact, channel, editedBody, nextAction, logActivity, updateContact, handleOpenWhatsApp, handleOpenEmail, onClose]);

  /* ---------- Render ---------- */

  if (templatesLoading) {
    return (
      <>
        <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-12 text-center">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading templates...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${channel === 'whatsapp' ? 'bg-green-500/20' : 'bg-violet-500/20'}`}>
                {channel === 'whatsapp' ? <MessageCircle className="w-5 h-5 text-green-400" /> : <Mail className="w-5 h-5 text-violet-400" />}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {step === 'choose' ? 'Choose Message Template' : step === 'custom' ? 'Write Your Own Message' : 'Preview & Send'}
                </h2>
                <p className="text-xs text-slate-400">{channel === 'whatsapp' ? 'WhatsApp' : 'Email'} · {contact.FullName}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {logSuccess ? (
            <div className="p-12 text-center">
              <Check className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-medium">Activity logged successfully!</p>
            </div>

          ) : step === 'choose' ? (
            <div className="flex-1 overflow-y-auto">
              {/* Contact Summary */}
              <div className="px-6 py-4 bg-slate-800/30 border-b border-slate-700/50">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-slate-500">Temperature</span><p className="text-white font-medium mt-0.5">{contact.LeadTemperature}</p></div>
                  <div><span className="text-slate-500">Lead Type</span><p className="text-white font-medium mt-0.5">{contact.LeadType}</p></div>
                  <div><span className="text-slate-500">Registration</span><p className="text-white font-medium mt-0.5">{contact.RegistrationStatus}</p></div>
                  <div><span className="text-slate-500">Last Activity</span><p className="text-white font-medium mt-0.5">{days !== null ? `${days}d ago` : 'Never'}</p></div>
                  {contact.GOStatus && (
                    <div><span className="text-slate-500">GO Status</span><p className="text-amber-400 font-medium mt-0.5">{contact.GOStatus}</p></div>
                  )}
                  {contact.ActionTaken && (
                    <div className="col-span-2"><span className="text-slate-500">Last Action</span><p className="text-white font-medium mt-0.5 truncate">{contact.ActionTaken}</p></div>
                  )}
                  {contact.NextAction && (
                    <div><span className="text-slate-500">Next Action</span><p className="text-teal-400 font-medium mt-0.5 truncate">{contact.NextAction}</p></div>
                  )}
                </div>
              </div>

              {/* AI Recommendation */}
              {recommendation && !browsing && (
                <div className="px-6 py-4 border-b border-slate-700/50">
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      <h3 className="text-sm font-semibold text-violet-300">Recommended for this contact</h3>
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceColors[recommendation.confidence]}`}>
                        {recommendation.confidence}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{recommendation.reason}</p>
                    <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                      <div>
                        <p className="text-sm font-medium text-white">{recommendation.template.template_name}</p>
                        <p className="text-xs text-slate-500">{recommendation.template.category}</p>
                      </div>
                      <button type="button" onClick={() => handleSelectTemplate(recommendation.template)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors">
                        <Zap className="w-3 h-3" /> Use This
                      </button>
                    </div>
                  </div>

                  {/* Action row: Browse library + Custom message */}
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <button type="button" onClick={() => setBrowsing(true)}
                      className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                      <BookOpen className="w-3.5 h-3.5" /> Browse library manually
                    </button>
                    <button type="button" onClick={handleEnterCustomMode}
                      className="flex items-center gap-2 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                      <PenLine className="w-3.5 h-3.5" /> Use my own message
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Browse */}
              {(browsing || !recommendation) && (
                <div className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-4 mb-3">
                    {recommendation && (
                      <button type="button" onClick={() => setBrowsing(false)}
                        className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                        <Sparkles className="w-3.5 h-3.5" /> Back to AI recommendation
                      </button>
                    )}
                    <button type="button" onClick={handleEnterCustomMode}
                      className="flex items-center gap-2 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                      <PenLine className="w-3.5 h-3.5" /> Use my own message
                    </button>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Browse Templates</h3>
                  <div className="space-y-1">
                    {categories.map(cat => {
                      const catTemplates = templates.filter(t => t.channel === channel && t.category === cat);
                      const isExpanded = expandedCategory === cat;
                      return (
                        <div key={cat}>
                          <button type="button" onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors">
                            <span className="font-medium">{cat}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">{catTemplates.length}</span>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="ml-3 mb-2 space-y-1">
                              {catTemplates.map(t => (
                                <button key={t.id} type="button" onClick={() => handleSelectTemplate(t)}
                                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors group">
                                  <div className="text-left">
                                    <p className="font-medium">{t.template_name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{t.send_when_condition}</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          ) : step === 'custom' ? (
            /* Custom Message Input */
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <button type="button" onClick={() => { setStep('choose'); setBrowsing(false); }}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors mb-2">
                ← Back to templates
              </button>

              <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <PenLine className="w-4 h-4 text-teal-400" />
                  <h3 className="text-sm font-semibold text-teal-300">Write Your Own Message</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Use {'{{firstName}}'} for the contact's name. It will be personalised automatically.
                </p>
              </div>

              {channel === 'email' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Subject</label>
                  <input type="text" value={customRawSubject} onChange={e => setCustomRawSubject(e.target.value)}
                    placeholder="e.g. Quick check-in, Leader {{firstName}}"
                    className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 placeholder:text-slate-500" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Your Message</label>
                <textarea value={customRawBody} onChange={e => setCustomRawBody(e.target.value)} rows={8}
                  placeholder={`e.g. Hi {{firstName}}, I wanted to check in and see how you are doing.`}
                  className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 resize-y placeholder:text-slate-500" />
              </div>

              <button type="button" onClick={handleCustomPreview} disabled={!customRawBody.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white rounded-lg transition-colors">
                <Sparkles className="w-4 h-4" /> Personalise & Preview
              </button>
            </div>

          ) : (
            /* Preview Step */
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <button type="button" onClick={() => selectedTemplate ? setStep('choose') : setStep('custom')}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors mb-2">
                ← {selectedTemplate ? 'Back to templates' : 'Back to editor'}
              </button>

              <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
                <p className="text-xs text-slate-500">Source</p>
                <p className="text-sm font-medium text-white">{selectedTemplate ? selectedTemplate.template_name : 'Custom Message'}</p>
                {selectedTemplate && <p className="text-xs text-slate-500 mt-1">{selectedTemplate.category}</p>}
              </div>

              {channel === 'email' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Subject</label>
                  <input type="text" value={editedSubject} onChange={e => setEditedSubject(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Message</label>
                <textarea value={editedBody} onChange={e => setEditedBody(e.target.value)} rows={8}
                  className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 resize-y" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Next Action (optional)</label>
                <input type="text" value={nextAction} onChange={e => setNextAction(e.target.value)}
                  placeholder="What's the next step after this message?"
                  className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 placeholder:text-slate-500" />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={handleCopy}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : `Copy ${channel === 'email' ? 'Email' : 'Message'}`}
                </button>

                <button type="button" onClick={channel === 'whatsapp' ? handleOpenWhatsApp : handleOpenEmail}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    channel === 'whatsapp' ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }`}>
                  <ExternalLink className="w-4 h-4" />
                  {channel === 'whatsapp' ? 'Open in WhatsApp' : 'Open Email Draft'}
                </button>

                <button type="button" onClick={handleSendAndLog} disabled={logging}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                  {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send & Log Activity
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
