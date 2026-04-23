/**
 * OceanGuard AI Assistant
 * Intelligent assistant for marine pollution and platform help
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, RotateCcw, ChevronDown } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { cn } from '@/utils/cn';
import ENV from '@/config/env';
import logoImg from '@/assets/images/marine-logo.png';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

// ── System instruction ────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are OceanGuard AI Assistant — a helpful, expert assistant embedded in the OceanGuard AI marine plastic detection platform.

PLATFORM CONTEXT:
OceanGuard AI is a full-stack web platform for detecting and forecasting marine plastic pollution.
Built as a Final Year Project at HITEC University Taxila (2026).
Team: Touseef Ur Rehman (ML), Qasim Shahzad (Backend), Zohaib Ashraf (Frontend).

PLATFORM FEATURES:
1. Upload & Detect — Upload images/videos; YOLOv26s detects 9 debris classes (71% mAP50, ~16,500 training images)
   Classes: Fishing Net (99.4%), Tyre (89.1%), Glass Container (74.7%), Metal Can (70.3%), Other Debris (62.1%), Plastic Bag (61.2%), Plastic Bottle (53.6%), Plastic Fragments (21%), Background
2. Predictions — 3-step LSTM pipeline per region: Fetch Data → Train Model → Generate 7–90 day forecasts
   Regions: Pacific Ocean, Atlantic Ocean, Indian Ocean, Mediterranean Sea
   Data sources: Open-Meteo (free weather), WAQI (air quality), NOAA CDO (climate)
3. Heatmap — Interactive Leaflet map showing pollution intensity, fed by saved predictions
4. Reports — PDF reports: YOLO Detection, LSTM Prediction, or Comprehensive
5. History — Browse, filter, delete past detections
6. Dashboard — Analytics: detection trends, class distribution, object counts
7. Settings — Theme, data export/import, account management
8. Admin Panel — System stats, user management, logs, system settings

TECHNICAL DETAILS:
- LSTM: 2-layer stacked (64→32 units), 30-day sequences, 10 environmental features, confidence intervals
- Auth: JWT tokens, USER/ADMIN roles. Default: admin/admin123 (ADMIN), demo_user/user123 (USER)
- Save Result button saves predictions to DB → feeds heatmap and reports automatically

ANSWER SCOPE — only answer:
1. How to use this platform (any feature, any page)
2. Marine plastic pollution (facts, statistics, research, environmental impact)
3. Ocean health, marine ecosystems, conservation efforts
4. Technology used (YOLO, LSTM, computer vision, time-series forecasting)
5. Environmental data concepts (AQI, ocean temperature, pollution indices)
6. Troubleshooting platform issues

OUT OF SCOPE — politely decline with: "I'm focused on marine pollution and this platform. Ask me about those!"

TONE: Friendly, concise, expert. Use bullet points for lists. Keep answers under 150 words unless detail is genuinely needed.`;

// ── Suggestions ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'How do I detect plastic in a video?',
  'What is the Great Pacific Garbage Patch?',
  'How does the LSTM prediction work?',
  'How do I save predictions to the heatmap?',
];

// ── Gemini client (singleton) ─────────────────────────────────────────────────
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
  return _ai;
}

// ── API call using official SDK ───────────────────────────────────────────────
// Model fallback chain — ordered by quota cost (cheapest first)
// All verified available for this key via ListModels
const MODEL_CHAIN = [
  'gemini-2.0-flash-lite',   // cheapest, highest free quota
  'gemini-2.0-flash',        // standard free tier
  'gemini-2.5-flash',        // latest, slightly higher quota cost
];

async function askGemini(history: Message[], userText: string): Promise<string> {
  if (!ENV.GEMINI_API_KEY) throw new Error('VITE_GEMINI_API_KEY not set in .env');

  const ai = getAI();

  const contents = [
    ...history.map(m => ({
      role:  m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: userText }] },
  ];

  let lastError: Error | null = null;

  for (const model of MODEL_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature:       0.7,
          maxOutputTokens:   512,
          topP:              0.9,
        },
      });

      const text = response.text?.trim();
      if (!text) throw new Error('Empty response');
      return text;

    } catch (e: any) {
      const raw: string = e?.message ?? String(e);

      if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
        // Extract retry delay if present
        const retryMatch = raw.match(/retry[^\d]*(\d+)[\.\d]*s/i);
        const retrySec   = retryMatch ? parseInt(retryMatch[1]) : null;
        lastError = new Error(
          retrySec
            ? `QUOTA:Retry in ${retrySec}s`
            : 'QUOTA:Daily free-tier quota exhausted for this API key.'
        );
        await new Promise(r => setTimeout(r, 800));
        continue;
      }

      // 404 model not found — try next silently
      if (raw.includes('404') || raw.includes('NOT_FOUND')) {
        lastError = new Error(`SKIP:${model} not available`);
        continue;
      }

      throw new Error(raw);
    }
  }

  // Parse the last quota error for a clean message
  const lastMsg = lastError?.message ?? '';
  if (lastMsg.startsWith('QUOTA:')) {
    const detail = lastMsg.slice(6);
    throw new Error(`QUOTA:${detail}`);
  }
  throw new Error('All models unavailable. Please try again shortly.');
}

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (/^[•\-\*] /.test(line)) {
      return <li key={i} className="ml-3 list-disc" dangerouslySetInnerHTML={{ __html: bold.replace(/^[•\-\*] /, '') }} />;
    }
    if (line.trim() === '') return <br key={i} />;
    return <p key={i} dangerouslySetInnerHTML={{ __html: bold }} />;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OceanAssistant() {
  const [open,     setOpen]     = useState(false);
  const [input,    setInput]    = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const hasKey    = !!ENV.GEMINI_API_KEY;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput('');
    setError('');

    const userMsg: Message = { role: 'user', text: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const reply = await askGemini(messages, trimmed);
      setMessages(prev => [...prev, { role: 'assistant', text: reply, ts: Date.now() }]);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const reset = () => { setMessages([]); setError(''); setInput(''); };

  return (
    <>
      {/* ── Floating trigger ── */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'fixed bottom-5 right-5 z-50 flex items-center gap-2.5',
          'h-12 rounded-2xl shadow-lg shadow-cyan-500/30',
          'bg-gradient-to-r from-cyan-500 to-teal-500 text-white',
          'transition-all duration-200 hover:shadow-cyan-500/50 hover:scale-105',
          open ? 'px-3' : 'px-3.5'
        )}
        whileTap={{ scale: 0.95 }}
        aria-label="Toggle AI assistant"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="close"
              initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span key="open"
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
              <img src={logoImg} alt="OceanGuard AI" className="w-7 h-7 rounded-lg" />
            </motion.span>
          )}
        </AnimatePresence>
        {!open && <span className="text-sm font-semibold">Ask AI</span>}
      </motion.button>

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'fixed bottom-20 right-5 z-50',
              'w-[calc(100vw-2.5rem)] max-w-sm',
              'rounded-2xl border border-border/60 shadow-2xl shadow-black/20',
              'bg-background/95 backdrop-blur-xl',
              'flex flex-col overflow-hidden',
            )}
            style={{ height: 'min(520px, calc(100dvh - 6rem))' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-sm overflow-hidden">
                  <img src={logoImg} alt="OceanGuard AI" className="w-6 h-6 rounded-lg" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">OceanGuard Assistant</p>
                  <p className="text-xs text-muted-foreground leading-tight">Marine AI · Always here to help</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={reset}
                    className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    title="Clear chat">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">

              {/* Welcome + suggestions */}
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                      <img src={logoImg} alt="" className="w-5 h-5 rounded-lg" />
                    </div>
                    <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%]">
                      Hi! I'm your OceanGuard assistant 🌊<br />
                      Ask me anything about marine pollution, how to use this platform, or the science behind it.
                    </div>
                  </div>

                  {!hasKey ? (
                    <div className="mx-1 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                      Add <code className="font-mono">VITE_GEMINI_API_KEY</code> to your <code className="font-mono">.env</code> file to enable the assistant.
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs text-muted-foreground px-1">Try asking:</p>
                      {SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => send(s)}
                          className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border/60 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-colors text-muted-foreground hover:text-foreground">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Chat history */}
              {messages.map(msg => (
                <div key={msg.ts} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
                  <div className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold overflow-hidden',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gradient-to-br from-cyan-500 to-teal-500'
                  )}>
                    {msg.role === 'user'
                      ? 'U'
                      : <img src={logoImg} alt="" className="w-4 h-4 rounded-md" />}
                  </div>
                  <div className={cn(
                    'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed space-y-1',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted/60 rounded-tl-sm'
                  )}>
                    {renderText(msg.text)}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <img src={logoImg} alt="" className="w-4 h-4 rounded-md" />
                  </div>
                  <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-3.5 py-3 flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i}
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (() => {
                const isQuota = error.startsWith('QUOTA:');
                const msg     = isQuota ? error.slice(6) : error;
                return (
                  <div className="mx-1 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs space-y-1.5">
                    {isQuota ? (
                      <>
                        <p className="font-semibold text-destructive">⚠️ Assistant Unavailable</p>
                        <p className="text-muted-foreground">{msg}</p>
                        <p className="text-muted-foreground">
                          The assistant has reached its daily limit. Please try again tomorrow or contact the admin.
                        </p>
                      </>
                    ) : (
                      <p className="text-destructive">{msg}</p>
                    )}
                  </div>
                );
              })()}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2 border-t border-border/50 flex-shrink-0">
              <div className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors',
                'bg-muted/30 border-border/60',
                'focus-within:border-cyan-500/60 focus-within:bg-background'
              )}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={hasKey ? 'Ask about marine pollution…' : 'API key required'}
                  disabled={!hasKey || loading}
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
                  maxLength={500}
                />
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading || !hasKey}
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                    input.trim() && hasKey && !loading
                      ? 'bg-gradient-to-br from-cyan-500 to-teal-500 text-white hover:scale-105 shadow-sm'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  {loading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground/50 mt-1.5">
                OceanGuard AI · Marine &amp; platform questions only
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
