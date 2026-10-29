import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';

type Variant = 'default' | 'outline' | 'secondary';
const vcls: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-90',
  outline: 'border border-border bg-transparent text-foreground hover:bg-muted',
  secondary: 'bg-muted text-foreground',
};

export function Button({ variant = 'default', size, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' }) {
  return <button {...p} className={`inline-flex items-center justify-center rounded-md font-medium transition disabled:opacity-50 ${size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm'} ${vcls[variant]} ${className}`} />;
}
export function Input({ className = '', ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground ${className}`} />;
}
export function Textarea({ className = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground ${className}`} />;
}
export function Badge({ variant = 'default', className = '', children, onClick }: { variant?: Variant; className?: string; children: ReactNode; onClick?: () => void }) {
  return <span onClick={onClick} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${vcls[variant]} ${className}`}>{children}</span>;
}
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button aria-label="Close" onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Minimal toast
type T = { id: number; msg: string; kind: 'ok' | 'err'; action?: { label: string; onClick: () => void }; ms: number };
let push: (t: T) => void = () => {};
let seq = 0;
const add = (kind: T['kind']) => (msg: string, o?: { duration?: number; action?: T['action'] }) =>
  push({ id: ++seq, msg, kind, action: o?.action, ms: o?.duration ?? 4000 });
export const toast = { success: add('ok'), error: add('err') };

export function Toaster() {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    push = (t) => {
      setList((l) => [...l, t]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), t.ms);
    };
    return () => { push = () => {}; };
  }, []);
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[92%] max-w-sm -translate-x-1/2 space-y-2">
      {list.map((t) => (
        <div key={t.id} role="status" className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm shadow-lg ${t.kind === 'err' ? 'bg-destructive text-destructive-foreground' : 'bg-foreground text-background'}`}>
          <span>{t.msg}</span>
          {t.action && <button className="font-semibold underline" onClick={() => { t.action!.onClick(); setList((l) => l.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}
