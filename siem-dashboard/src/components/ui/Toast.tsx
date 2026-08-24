'use client';
/**
 * Toast & ConfirmModal — Shared UI Primitives
 *
 * Usage (toast):
 *   const { toasts, success, error } = useToast();
 *   success('IP diblokir!');
 *   error('Gagal memblokir IP.');
 *   <ToastContainer toasts={toasts} onDismiss={dismiss} />
 *
 * Usage (confirm modal):
 *   const { confirmState, confirm, closeConfirm } = useConfirm();
 *   const ok = await confirm({ title: '...', message: '...', ip: '1.2.3.4', variant: 'danger' });
 *   <ConfirmModal state={confirmState} onClose={closeConfirm} />
 */

import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, X, ShieldOff } from 'lucide-react';

/* ──────────────────────────────────────────────────────────── */
/*  Types                                                        */
/* ──────────────────────────────────────────────────────────── */

export type ToastType = 'success' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  ip?: string;
  variant?: 'danger' | 'warning';
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
}

/* ──────────────────────────────────────────────────────────── */
/*  useToast hook                                               */
/* ──────────────────────────────────────────────────────────── */

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string, duration = type === 'success' ? 3000 : 4000) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const success = useCallback((msg: string) => push('success', msg), [push]);
  const error = useCallback((msg: string) => push('error', msg), [push]);

  return { toasts, success, error, dismiss };
}

/* ──────────────────────────────────────────────────────────── */
/*  useConfirm hook                                             */
/* ──────────────────────────────────────────────────────────── */

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    options: null,
    resolve: null,
  });

  /** Open the modal and return Promise<boolean> (true = confirmed, false = cancelled) */
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ open: true, options, resolve });
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((prev) => {
      prev.resolve?.(result);
      return { open: false, options: null, resolve: null };
    });
  }, []);

  return { confirmState, confirm, closeConfirm };
}

/* ──────────────────────────────────────────────────────────── */
/*  ToastContainer                                              */
/* ──────────────────────────────────────────────────────────── */

export const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={[
        'pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-[360px] px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl',
        'transition-all duration-300',
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8',
        isSuccess
          ? 'bg-emerald-950/80 border-emerald-500/25 shadow-emerald-900/30'
          : 'bg-rose-950/80 border-rose-500/25 shadow-rose-900/30',
      ].join(' ')}
    >
      <div className="shrink-0 mt-0.5">
        {isSuccess ? (
          <CheckCircle2 size={16} className="text-emerald-400" />
        ) : (
          <XCircle size={16} className="text-rose-400" />
        )}
      </div>
      <p className={`flex-1 text-xs font-medium leading-relaxed ${isSuccess ? 'text-emerald-200' : 'text-rose-200'}`}>
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        className={`shrink-0 mt-0.5 opacity-50 hover:opacity-100 transition-opacity ${isSuccess ? 'text-emerald-400' : 'text-rose-400'}`}
      >
        <X size={13} />
      </button>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────── */
/*  ConfirmModal                                                */
/* ──────────────────────────────────────────────────────────── */

export const ConfirmModal: React.FC<{
  state: ConfirmState;
  onClose: (result: boolean) => void;
}> = ({ state, onClose }) => {
  const { open, options } = state;

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !options) return null;

  const isDanger = options.variant !== 'warning';

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      onClick={() => onClose(false)}
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-sm bg-[#0d1526] border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
        style={{ animation: 'modalIn 0.18s ease-out both' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className={`h-0.5 w-full ${isDanger ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`} />

        <div className="p-6">
          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-5">
            <div className={`shrink-0 p-2.5 rounded-xl ${isDanger ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}>
              {isDanger ? (
                <ShieldOff size={20} className="text-rose-400" />
              ) : (
                <AlertTriangle size={20} className="text-amber-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-100 mb-1.5">{options.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{options.message}</p>
              {options.ip && (
                <div className={`mt-3 px-3 py-2 rounded-lg border font-mono text-sm font-bold text-center
                  ${isDanger
                    ? 'bg-rose-500/8 border-rose-500/20 text-rose-300'
                    : 'bg-amber-500/8 border-amber-500/20 text-amber-300'
                  }`}>
                  {options.ip}
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onClose(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
            >
              {options.cancelLabel ?? 'Batal'}
            </button>
            <button
              onClick={() => onClose(true)}
              className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg
                ${isDanger
                  ? 'bg-gradient-to-br from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-900/40'
                  : 'bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-amber-900/40'
                }`}
            >
              {options.confirmLabel ?? 'Konfirmasi'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(-8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};
