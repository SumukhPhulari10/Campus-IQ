import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { INITIAL_DOCUMENTS, INITIAL_CHUNKS, INITIAL_NOTICES } from './src/data/knowledgeBase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, initDb } from './src/lib/db';
import { sendOTPEmail, sendSignupOTPEmail } from './src/lib/mailer';
import { generatePdfDataUrl } from './src/lib/pdfGenerator';
import { extractDeadlineDate, parseDateToIso } from './src/lib/noticeDates';
import multer from 'multer';
import { createRequire } from 'module';
import { fileURLToPath } from 'node:url';
const _require = createRequire(import.meta.url);
const { PDFParse } = _require('pdf-parse');

async function extractPdfText(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    return result?.text || '';
  } finally {
    try { await parser.destroy(); } catch (_) {}
  }
}

async function extractScannedPdfText(buf: Buffer): Promise<string> {
  const gemini = getGeminiClient();
  if (!gemini) return '';

  return callGeminiWithFallback(gemini, [{
    role: 'user',
    parts: [
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: buf.toString('base64'),
        },
      },
      {
        text: 'Transcribe all readable text from this college document exactly, preserving dates, names, IDs, and table rows. Do not summarize or infer missing text. Return only the transcription; if no text is readable, return an empty response.',
      },
    ],
  }]);
}

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const app = express();
const allowedOrigins = new Set(
  (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '50mb' }));

// Multer: in-memory storage (we don't need to save files to disk)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/api/translate', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 20000) {
    return res.status(400).json({ error: 'Text must be between 1 and 20000 characters.' });
  }

  const gemini = getGeminiClient();
  if (!gemini) {
    return res.status(503).json({ error: 'Translation is unavailable because the AI service is not configured.' });
  }

  try {
    const translatedText = await callGeminiWithFallback(gemini, [{
      role: 'user',
      parts: [{
        text: `Translate the following student-facing college information from English into clear, simple Marathi. Preserve all names, dates, numbers, amounts, document labels, and URLs exactly. Do not add, remove, or infer requirements. Return only the translation.\n\n${text}`,
      }],
    }]);
    return res.json({ translatedText });
  } catch (error: any) {
    console.error('[Translation] Marathi translation failed:', error.message || error);
    return res.status(502).json({ error: 'Could not translate this section right now. Please try again.' });
  }
});

// Lazy-initialized Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || /^(your[_ -]?gemini[_ -]?key[_ -]?here|replace[_ -]?me)$/i.test(apiKey)) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Ordered candidate models for automatic failover when 429 quota is reached
const CANDIDATE_GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
];

async function callGeminiWithFallback(gemini: GoogleGenAI, contents: any): Promise<string> {
  let lastErr: any = null;
  for (const model of CANDIDATE_GEMINI_MODELS) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents,
      });
      const text = response.text?.trim();
      if (text) {
        console.log(`[Gemini] Response generated successfully using model: ${model}`);
        return text;
      }
    } catch (err: any) {
      lastErr = err;
      const errMsg = err.status || err.message || String(err);
      console.warn(`[Gemini] Model "${model}" failed (${errMsg}), trying next candidate...`);
    }
  }
  throw lastErr || new Error('All Gemini candidate models failed');
}

// In-memory knowledge base store for the session
let documents = [...INITIAL_DOCUMENTS];
let chunks = [...INITIAL_CHUNKS];
let notices = [...INITIAL_NOTICES];

// ─────────────────────────────────────────────────────────────────────
// Sync DB documents into in-memory chunks so uploaded content survives
// server restarts and is immediately available for RAG queries.
// ─────────────────────────────────────────────────────────────────────
async function syncChunksFromDb() {
  if (!pool) return;
  try {
    const result = await pool.query(
      `SELECT id, title, department, category, content_raw, summary, file_type, image_url
       FROM documents
       WHERE content_raw IS NOT NULL AND LENGTH(content_raw) > 10
       ORDER BY created_at DESC
       LIMIT 200`
    );
    const existing = new Set(chunks.map(c => c.documentId));
    let added = 0;
    for (const row of result.rows) {
      if (existing.has(row.id)) continue; // skip if already in memory
      chunks.unshift({
        id: `chk_db_${row.id}`,
        documentId: row.id,
        documentTitle: row.title,
        department: row.department || 'General',
        category: row.category || 'Circular',
        pageNumber: 1,
        sectionHeader: row.title,
        content: row.content_raw,
        // Carry image_url so RAG can do vision lookups
        imageUrl: row.image_url || undefined,
        fileType: row.file_type || 'pdf',
      } as any);
      added++;
    }
    if (added > 0) console.log(`[RAG] Synced ${added} documents from DB into knowledge base.`);
  } catch (err: any) {
    console.warn('[RAG] DB sync failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────
// College acronym / shorthand expansion so short queries like
// "tfws fees", "dse admission", "ug circular" still retrieve correctly.
// ─────────────────────────────────────────────────────────────────────
const ACRONYM_EXPANSIONS: Record<string, string> = {
  'tfws':        'tuition fee waiver scheme tfws',
  'tfw':         'tuition fee waiver tfw',
  'dse':         'direct second year engineering dse lateral entry',
  'ug':          'undergraduate engineering first year',
  'pg':          'postgraduate mtech mba',
  'be':          'bachelor engineering',
  'btech':       'bachelor technology engineering',
  'mtech':       'master technology postgraduate',
  'mba':         'master business administration',
  'cgpa':        'cumulative grade point average',
  'sgpa':        'semester grade point average',
  'ote':         'open teaching elective',
  'hss':         'humanities social science',
  'nba':         'national board accreditation',
  'naac':        'national assessment accreditation council',
  'tution':      'tuition fee',
  'tutions':     'tuition fee',
  'clg':         'college',
  'midsem':      'mid semester examination test timetable',
  'endsem':      'end semester final examination timetable',
  'sem':         'semester',
  'att':         'attendance',
  'attendence':  'attendance',
  'bonafide':    'bonafide certificate document',
  'tc':          'transfer certificate tc',
  'hallticket':  'hall ticket admit card exam',
  'chutti':      'holiday academic calendar vacation',
  'holidays':    'holiday academic calendar vacation',
  'aithon':      'aithon hackathon competition event',
  'codevita':    'tcs codevita programming contest placement',
  'placement':   'campus placement drive job interview',
  'open':        'open category general',
  'obc':         'obc category other backward class',
  'ebc':         'ebc category economically backward',
  'ews':         'ews category economically weaker section',
  'sc':          'sc category scheduled caste',
  'st':          'st category scheduled tribe',
};

function expandQuery(query: string): string {
  let expanded = query.toLowerCase().trim();
  // Fix common typos
  expanded = expanded.replace(/\btution\b/gi, 'tuition');
  for (const [abbr, full] of Object.entries(ACRONYM_EXPANSIONS)) {
    // Replace whole-word occurrences of the abbreviation
    const re = new RegExp(`\\b${abbr}\\b`, 'gi');
    if (re.test(expanded)) {
      expanded = expanded.replace(re, full);
    }
  }
  return expanded;
}

// ─────────────────────────────────────────────────────────────────────
// Smarter keyword retrieval with title/section boosting and short-word
// support so queries like "tcs" or "codevita" still rank correctly.
// ─────────────────────────────────────────────────────────────────────
function retrieveRelevantChunks(query: string, limit = 6) {
  const originalQ = query.toLowerCase().trim();
  const expandedQ = expandQuery(query);
  // Use expanded query for matching but also keep original for phrase boost
  const q = expandedQ;
  // Include even short words (≥ 2 chars) so "tc", "ai", "tcs" etc. match
  const queryWords = q.split(/\s+/).filter(w => w.length >= 2);

  const scored = chunks.map(chunk => {
    const titleLower  = (chunk.documentTitle || '').toLowerCase();
    const sectionLower = ((chunk as any).sectionHeader || '').toLowerCase();
    const contentLower = (chunk.content || '').toLowerCase();
    const deptLower   = (chunk.department || '').toLowerCase();
    const catLower    = ((chunk as any).category || '').toLowerCase();
    const fullText    = `${titleLower} ${sectionLower} ${contentLower} ${deptLower} ${catLower}`;

    let score = 0;
    for (const word of queryWords) {
      // Title match is a strong signal (×4)
      if (titleLower.includes(word)) score += 4;
      // Section header match (×3)
      if (sectionLower.includes(word)) score += 3;
      // Content match (×2)
      if (contentLower.includes(word)) score += 2;
      // Department / category match (×1)
      if (deptLower.includes(word) || catLower.includes(word)) score += 1;
    }
    // Phrase-level boost: expanded query string appears anywhere
    if (fullText.includes(q)) score += 8;
    // Original query boost (pre-expansion)
    if (originalQ !== q && fullText.includes(originalQ)) score += 6;
    // Recency boost: prefer db-synced (real) documents over static seeded ones
    if ((chunk.id || '').startsWith('chk_db_')) score += 1;

    return { ...chunk, similarityScore: score };
  });

  scored.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
  // Only return chunks that have at least some match
  return scored.filter(c => (c.similarityScore || 0) > 0).slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────
// RAG Query API — real-time, Gemini-powered, friendly chatbot
// ─────────────────────────────────────────────────────────────────────
app.post('/api/query', async (req, res) => {
  try {
    const { query, studentContext, conversationHistory } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }
    if (query.length > 12000) {
      return res.status(413).json({ error: 'Please keep your question under 12,000 characters.' });
    }

    // Always pull a fresh batch from DB so newly uploaded docs are found
    await syncChunksFromDb();

    // Expand query acronyms before retrieval
    const expandedQuery = expandQuery(query);
    const relevantChunks = retrieveRelevantChunks(expandedQuery);
    const gemini = getGeminiClient();

    let answer = '';
    let lastError: string | null = null;
    let geminiSucceeded = false;
    const confidenceScore = relevantChunks.length > 0 ? 92 : 55;

    // Multi-turn conversational context so the bot remembers follow-up questions
    let historyPrompt = '';
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      const recent = conversationHistory.slice(-6);
      historyPrompt = '\nRECENT CHAT HISTORY (Use this to resolve follow-ups like "and for tfws?", "what about second year?", etc.):\n' +
        recent.map(m => `${m.role === 'user' || m.sender === 'user' ? 'Student' : 'Campus Desk'}: ${m.text || m.content}`).join('\n') + '\n';
    }

    if (gemini) {
      // ── Check if top chunk is an image document — use Gemini Vision ──
      const topChunk = relevantChunks[0] as any;
      const isImageDoc = topChunk?.fileType === 'image' && topChunk?.imageUrl;

      try {
        if (isImageDoc) {
          // Extract base64 from data URL (strip the "data:image/...;base64," prefix)
          const dataUrl: string = topChunk.imageUrl;
          const commaIdx = dataUrl.indexOf(',');
          const mimeMatch = dataUrl.match(/data:([^;]+);base64,/);
          const mimeType  = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

          // Also include the document's extracted content/tables!
          const textChunks = relevantChunks
            .map((c: any, i: number) => `[Doc ${i+1}: ${c.documentTitle}]\n${c.content}`)
            .join('\n\n');

          const responseText = await callGeminiWithFallback(gemini, [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64Data } },
                {
                  text: `You are Campus Desk, a friendly AI assistant for college students.
${historyPrompt}
STUDENT QUESTION: "${query}"

This is an official college notice/poster image. Read ALL visible text and table numbers in this image carefully.
Also use these extracted text/table details from the documents:
${textChunks || '(none)'}

Rules:
- Answer casually and directly like a helpful senior student. Keep it warm, natural, and helpful like ChatGPT or Gemini.
- The student may ask in broken English, casual college shorthand, single keywords, or incomplete questions (e.g. 'fees open', 'midsem date', 'chutti kab hai', 'tfws fee', 'clg holiday'). Understand their intent and answer accurately.
- If asking about fees, extract the exact tuition fees, development fees, and total fees for the requested category (e.g. Open, OBC, TFWS, SC/ST, EWS).
- If asking for 'whole information', 'complete calendar', 'full schedule', provide the complete schedule with all dates, months, and events without cutting off.
- Bold important amounts and terms using **word** format.
- Keep the reply friendly, well-structured, and helpful.
- End with: 📄 Source: [Name of the notice or document you found the answer in]`,
                },
              ],
            },
          ]);
          answer = responseText?.trim() || '';
          if (answer) geminiSucceeded = true;

        } else {
          // ── Standard text-based RAG ──
          const contextText = relevantChunks.length > 0
            ? relevantChunks.map((c: any, i: number) =>
                `[Source ${i+1}: "${c.documentTitle}" | ${c.department}]\n${c.content}`
              ).join('\n\n---\n\n')
            : 'No specific documents found. Use general college knowledge.';

          const studentCtx = studentContext
            ? `Student: ${studentContext.name || 'Unknown'}, ${studentContext.department || ''}, ${studentContext.year || ''}`
            : '';

          // Detect fee/scholarship specific queries for a more targeted prompt addition
          const isFeeQuery = /\b(fee|fees|tfws|tfw|tuition|tution|waiver|scholarship|financial|challan|amount|rupee|rs\.?|lakh|thousand|open|obc|sc|st|ews)\b/i.test(query);
          const feeHint = isFeeQuery
            ? `\nIMPORTANT: The student is asking about FEES or a FEE SCHEME (e.g. TFWS = Tuition Fee Waiver Scheme, Open Category, OBC, SC/ST, EWS). Look carefully in the documents for:\n- Specific fee amounts in rupees (₹ or Rs.)
- Fee categories (tuition fee, development fee, exam fee, total fee)
- TFWS / TFW details (tuition fee waiver = ₹0 tuition, mention the development fee and final total)
- Direct Second Year (DSE / Lateral Entry) fees vs First Year fees
Do NOT just list the document headings or table of contents — extract the actual numbers and scheme details.`
            : '';

          const systemPrompt = `You are Campus Desk, a friendly AI assistant for college students. Think of yourself like a helpful senior student — casual, warm, and direct like ChatGPT or Gemini.
${studentCtx}
${historyPrompt}
OFFICIAL COLLEGE DOCUMENTS (answer ONLY from these):
${contextText}

STUDENT QUESTION: "${query}"
${feeHint}

STRICT REPLY RULES:
1. Write in plain conversational English — like texting a helpful friend.
2. The student may ask in broken English, casual college slang, single keywords, or incomplete sentences (e.g. 'fees open', 'midsem date', 'attendance kitna', 'clg reopens when', 'tfws fee', 'sports day', 'academic calender'). Intelligently understand their intent and answer accurately from the documents without commenting on their grammar.
3. NEVER use markdown tables (no | pipes), NEVER use ## headings, NEVER use --- dividers.
4. Use simple bullet points (•) when listing items, dates, months, or fees.
5. Bold important words/amounts/dates using **word** format.
6. For broad or detailed requests (e.g. 'whole information', 'complete calendar', 'academic calender', 'schedule', 'all dates', 'give me all'), provide ALL the dates, working days, and months found in the document — DO NOT cut it short or stop midway.
7. For specific quick questions (e.g. 'what is tfws fees', 'when is midsem', 'fees open'), give a clear, direct answer with the exact figures/dates in structured bullet points.
8. Extract exact dates, amounts, links, deadlines from the documents — quote them accurately.
9. At the end write one line: 📄 Source: [document name]
10. If the answer isn't in the documents say: "Couldn't find this in the notices — check with your teacher or notice board! 📋"
11. NEVER make up info not in the documents.
12. Use 1–2 emojis max to stay friendly, not excessive.`;

          const responseText = await callGeminiWithFallback(gemini, systemPrompt);
          answer = responseText?.trim() || '';
          if (answer) geminiSucceeded = true;
        }
      } catch (err: any) {
        lastError = err.message || String(err);
        console.error('[RAG] Gemini API call failed:', err.message || err);
      }
    }

    // ── Intelligent Fallback if Gemini failed or offline ──
    if (!answer) {
      if (relevantChunks.length > 0) {
        const topChunks = relevantChunks.slice(0, 3);
        const top = relevantChunks[0] as any;
        const combinedContent = topChunks.map((c: any) => c.content || '').join('\n\n');

        const isFeeQuery = /\b(fee|fees|tfws|tfw|tuition|tution|waiver|scholarship|open|obc|sc|st|ews|development|challan|amount)\b/i.test(query);

        if (isFeeQuery) {
          // Parse fee lines and tables intelligently instead of stripping them
          const lines = combinedContent.split('\n');
          const feeItems: string[] = [];
          const lowerQ = query.toLowerCase();

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.match(/^[-|: ]+$/)) continue; // skip pure separator lines

            // If it's a table row, format pipes into readable text
            let readable = line;
            if (line.startsWith('|') && line.endsWith('|')) {
              const cells = line.split('|').map(c => c.trim()).filter(Boolean);
              if (cells.length > 1) {
                readable = cells.join(' — ');
              }
            }

            const containsFeeKeyword = /(open|tfws|obc|sc|st|ews|tuition|development|total|eligibility|annual|per year|₹|rs\.?|\d{4,})/i.test(readable);
            if (containsFeeKeyword) {
              if (lowerQ.includes('tfws') && /tfws|tuition fee waiver/i.test(readable)) {
                feeItems.push(`• **${readable}**`);
              } else if (lowerQ.includes('open') && /\bopen\b/i.test(readable)) {
                feeItems.push(`• **${readable}**`);
              } else if (lowerQ.includes('obc') && /\bobc\b/i.test(readable)) {
                feeItems.push(`• **${readable}**`);
              } else if (lowerQ.includes('sc') && /\b(sc|st)\b/i.test(readable)) {
                feeItems.push(`• **${readable}**`);
              } else {
                feeItems.push(`• ${readable}`);
              }
            }
          }

          if (feeItems.length > 0) {
            const unique = Array.from(new Set(feeItems)).slice(0, 20);
            answer = `Here are the official fee details found in **${top.documentTitle}**:\n\n${unique.join('\n')}\n\n📄 Source: ${top.documentTitle}`;
          }
        }

        // If not a fee query or fee extraction didn't produce items, display the full clean content
        if (!answer) {
          const cleanLines = combinedContent
            .split('\n')
            .filter(line => !line.match(/^[-|: ]+$/)) // remove table dividers
            .map(line => {
              if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                return '• ' + cells.join(' — ');
              }
              return line.replace(/^#{1,6}\s+/, '');
            });

          const cleanContent = cleanLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
          answer = `Here's what I found in **${top.documentTitle}**:\n\n${cleanContent}\n\n📄 Source: ${top.documentTitle}`;
        }
      } else {
        answer = `Couldn't find specific info about that in the uploaded notices. Try asking your teacher or checking the notice board! 📋`;
      }
    }

    const citations = relevantChunks.map((c: any) => ({
      chunkId: c.id,
      documentId: c.documentId,
      documentTitle: c.documentTitle,
      department: c.department,
      pageNumber: c.pageNumber || 1,
      sectionHeader: c.sectionHeader || c.documentTitle,
      exactQuote: (c.content || '').slice(0, 180) + ((c.content || '').length > 180 ? '...' : ''),
      confidence: Math.min(0.99, 0.7 + (c.similarityScore || 0) * 0.03),
    }));

    // ── Store user message & bot answer in PostgreSQL chat_messages table ──
    if (pool) {
      try {
        const uId = studentContext?.id || studentContext?.userId || (req as any).user?.id || null;
        const uEmail = studentContext?.email || (req as any).user?.email || null;
        const sourceTitle = relevantChunks[0]?.documentTitle || null;

        await pool.query(
          `INSERT INTO chat_messages (user_id, user_email, sender, message) VALUES ($1, $2, 'user', $3)`,
          [uId, uEmail, query]
        );
        await pool.query(
          `INSERT INTO chat_messages (user_id, user_email, sender, message, source_doc, citations) VALUES ($1, $2, 'assistant', $3, $4, $5)`,
          [uId, uEmail, answer, sourceTitle, JSON.stringify(citations)]
        );
      } catch (saveErr: any) {
        console.warn('[Chat DB] Failed to save conversation turn:', saveErr.message);
      }
    }

    // Generate context-aware follow-up suggestions
    const followUps: string[] = [];
    const q = query.toLowerCase();
    if (q.includes('date') || q.includes('deadline') || q.includes('last')) {
      followUps.push('What are the other upcoming deadlines?');
    }
    if (q.includes('register') || q.includes('apply') || q.includes('link')) {
      followUps.push('How do I register for this?');
    }
    if (relevantChunks.length > 0) {
      followUps.push(`Tell me more about ${(relevantChunks[0] as any).documentTitle}`);
    }
    followUps.push('What are the latest notices?');

    return res.json({
      answer,
      citations,
      debugError: lastError,
      geminiSucceeded,
      groundedAnswerRate: relevantChunks.length > 0 ? 96.4 : 40.0,
      confidenceScore,
      isGrounded: relevantChunks.length > 0,
      needsReview: false,
      escalationNeeded: false,
      suggestedFollowUps: [...new Set(followUps)].slice(0, 4),
    });
  } catch (error: any) {
    console.error('[RAG] Error handling query:', error);
    return res.status(500).json({ error: 'Failed to process query' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Chat History Endpoints — PostgreSQL conversation storage
// ─────────────────────────────────────────────────────────────────────
app.get('/api/chat/history', async (req, res) => {
  try {
    const { userId, email } = req.query as { userId?: string; email?: string };
    if (!pool) return res.json({ messages: [] });

    let query = `SELECT id, sender, message as text, to_char(created_at, 'HH12:MI AM') as timestamp, source_doc as "sourceDoc", created_at
                 FROM chat_messages
                 WHERE 1=0`;
    const params: any[] = [];

    if (userId) {
      params.push(userId);
      query = `SELECT id, sender, message as text, to_char(created_at, 'HH12:MI AM') as timestamp, source_doc as "sourceDoc", created_at
               FROM chat_messages
               WHERE user_id = $1
               ORDER BY created_at ASC
               LIMIT 100`;
    } else if (email) {
      params.push(email.trim().toLowerCase());
      query = `SELECT id, sender, message as text, to_char(created_at, 'HH12:MI AM') as timestamp, source_doc as "sourceDoc", created_at
               FROM chat_messages
               WHERE LOWER(user_email) = $1
               ORDER BY created_at ASC
               LIMIT 100`;
    }

    const result = await pool.query(query, params);
    return res.json({ messages: result.rows });
  } catch (err: any) {
    console.error('Fetch chat history error:', err);
    return res.json({ messages: [] });
  }
});

app.delete('/api/chat/history', async (req, res) => {
  try {
    const { userId, email } = req.body;
    if (!pool) return res.json({ success: true });

    if (userId) {
      await pool.query('DELETE FROM chat_messages WHERE user_id = $1', [userId]);
    } else if (email) {
      await pool.query('DELETE FROM chat_messages WHERE LOWER(user_email) = $1', [email.trim().toLowerCase()]);
    }
    return res.json({ success: true, message: 'Chat history cleared' });
  } catch (err: any) {
    console.error('Clear chat history error:', err);
    return res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// Document Ingestion API endpoint — handles both multipart file upload AND JSON
// Teachers upload actual files; we extract text from PDFs so timetable parsing works.
app.post('/api/documents/upload', upload.single('file'), async (req: any, res) => {
  try {
    const body = req.body;
    const uploadedFile = req.file; // populated by multer when Content-Type is multipart

    const title       = body.title       || 'Uploaded College Document';
    const department  = body.department  || 'General Academic';
    const category    = body.category    || 'Circular';
    const isStudentGuideUpload = body.targetBucket === 'student_guide';
    const isScholarshipGuide = isStudentGuideUpload &&
      /scholarship|financial aid/i.test(`${title} ${category}`);
    const section     = body.section     || null;
    const uploadedBy  = body.uploadedBy  || null;
    const publishedDate = body.publishedDate || new Date().toISOString().split('T')[0];
    const fileSize    = uploadedFile
      ? `${(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB`
      : (body.fileSize || '—');

    // ── Academic and Institutional Notice Keywords Dictionary ──
    const ACADEMIC_NOTICE_KEYWORDS = [
      'notice', 'circular', 'announcement', 'notification', 'order', 'academic', 'college',
      'university', 'institute', 'institution', 'campus', 'department', 'faculty', 'professor',
      'lecturer', 'teacher', 'dean', 'principal', 'director', 'registrar', 'hod', 'senate',
      'student', 'students', 'semester', 'exam', 'examination', 'test', 'midterm', 'finals',
      'schedule', 'timetable', 'syllabus', 'curriculum', 'course', 'subject', 'credit',
      'hall ticket', 'admit card', 'attendance', 'condonation', 'assignment', 'submission',
      'deadline', 'due date', 'last date', 'registration', 'register', 'event', 'workshop',
      'hackathon', 'seminar', 'webinar', 'conference', 'symposium', 'cultural', 'fest',
      'competition', 'sports', 'tournament', 'club', 'placement', 'internship', 'career',
      'recruitment', 'interview', 'package', 'drive', 'scholarship', 'financial aid',
      'fees', 'fee', 'tuition', 'bursar', 'challan', 'dues', 'regulations', 'rules',
      'guidelines', 'code of conduct', 'hostel', 'mess', 'library', 'laboratory', 'lab',
      'practical', 'viva', 'project', 'convocation', 'graduation', 'result', 'grade',
      'marks', 'cgpa', 'sgpa', 'holiday', 'orientation', 'induction', 'alumni', 'meeting',
      'lecture', 'class', 'session', 'batch', 'branch', 'section', 'celebration', 'blood donation',
      'btech', 'cse', 'defaulter', 'defaulters', 'arrears', 'backlog', 'roll number'
    ];

    const scoreAcademicKeywords = (text: string): number => {
      if (!text) return 0;
      const lower = text.toLowerCase();
      let count = 0;
      for (const kw of ACADEMIC_NOTICE_KEYWORDS) {
        if (lower.includes(kw)) count++;
      }
      return count;
    };

    // ── 1. Empty Document & Content Checks ──
    if (uploadedFile) {
      if (!uploadedFile.buffer || uploadedFile.buffer.length === 0 || uploadedFile.size === 0) {
        return res.status(400).json({
          error: 'Document rejected: Uploaded file is empty (0 bytes). Please upload a valid document or poster.'
        });
      }
    } else {
      // JSON / Text Notice path
      const rawText = (body.contentRaw || body.content || '').trim();
      if (!rawText || rawText.length < 15) {
        return res.status(400).json({
          error: 'Notice rejected: Notice text content cannot be empty and must be at least 15 characters long.'
        });
      }
    }

    // ── Extract text/image content from the uploaded file ──────
    let contentRaw = (body.contentRaw || body.content || '').trim();
    let fileType: 'pdf' | 'docx' | 'txt' | 'web' | 'image' = body.fileType || 'pdf';
    let fileUrl = body.fileUrl || body.imageUrl || null;
    let imageUrl = body.imageUrl || body.fileUrl || null;

    if (uploadedFile) {
      const mime = uploadedFile.mimetype || '';
      const name = uploadedFile.originalname?.toLowerCase() || '';

      // Check for personal photo / non-notice filename patterns
      const isPersonalPhotoName = /(selfie|portrait|profile[-_]?pic|snapchat|whatsapp[-_]?image|meme|wallpaper|vacation|trip|food[-_]?pic|cat[-_]?pic|dog[-_]?pic|party|car[-_]?photo|screenshot[-_]?chat|gaming)/i.test(name);
      const isDefaultCameraName = /^(img[-_]\d+|pxl[-_]\d+|dcim|dsc[-_]\d+|sam[-_]\d+|photo[-_]\d+|image[-_]\d+)/i.test(name);

      if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp'].some(ext => name.endsWith(ext))) {
        fileType = 'image';

        // Check minimum image file size (must be at least 2KB)
        if (uploadedFile.size < 2048) {
          return res.status(400).json({
            error: 'Document rejected: Image file is too small or blank (under 2KB). Please upload a valid event poster or document.'
          });
        }

        const base64Data = uploadedFile.buffer.toString('base64');
        const mimeType = mime || (name.endsWith('.png') ? 'image/png' : name.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg');
        const dataUrl = `data:${mimeType};base64,${base64Data}`;
        fileUrl = dataUrl;
        imageUrl = dataUrl;

        // ── Multimodal AI Vision Scanner (if Gemini client is active) ──
        let aiVerified = false;
        if (isScholarshipGuide) {
          if (body.approvedContent !== undefined) {
            contentRaw = String(body.approvedContent).trim();
            aiVerified = true;
          } else {
            const gemini = getGeminiClient();
            if (!gemini) {
              return res.status(503).json({
                error: 'Automatic image reading is unavailable because the AI service is not configured. Configure GEMINI_API_KEY and try again.',
              });
            }
            try {
              const extractedText = await callGeminiWithFallback(gemini, [{
                role: 'user',
                parts: [
                  {
                    inlineData: { mimeType, data: base64Data },
                  },
                  {
                    text: `Read this scholarship application document checklist image and transcribe every visible word into a clean, student-friendly checklist. Preserve each heading and keep each document under the exact category where it appears (for example SC/ST, OBC/SBC, EBC). Do not omit repeated items. Do not invent, normalize, or guess names, dates, eligibility rules, or requirements. If a word is genuinely unreadable, write "[unclear — please verify]" in that item. Return only the transcription, with a heading and bullet/numbered lists. The staff member will review it against the original before publishing.`,
                  },
                ],
              }]);
              if (!extractedText || extractedText.trim().length < 20) {
                return res.status(422).json({
                  error: 'The AI could not read enough text from this image. Upload a clearer image and try again.',
                });
              }
              contentRaw = `${title} (${category})\n\n${extractedText.trim()}`;
              aiVerified = true;
            } catch (aiErr: any) {
              console.error('[Scholarship Guide] Automatic image extraction failed:', aiErr.message || aiErr);
              return res.status(502).json({
                error: 'Automatic image reading failed. Please try again; no guide was published.',
              });
            }
          }
        } else {
          try {
            const gemini = getGeminiClient();
            if (gemini && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_key_here') {
            const aiText = await callGeminiWithFallback(gemini, [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data
                    }
                  },
                  {
                    text: `You are the strict Institutional Document Verification AI for CampusIQ, an official college portal.
Examine this uploaded image and determine if it is a legitimate college/university document or event poster.

ACCEPTED:
- Official college notices, circulars, announcements, orders, timetables, exam schedules, syllabus sheets, fee notices.
- When the upload is a student guide, official student checklists, scholarship/financial-aid required-document lists, and clear photographs or scans of those materials.
- College event posters (e.g. hackathons, coding contests, workshops, seminars, guest lectures, cultural fests, sports meets, club recruitments, webinars).

STRICTLY REJECTED:
- Personal photos, selfies, portraits of individuals, group photos without notice/event poster context.
- Animals, pets, food, dishes, travel, nature, scenery, landscapes, cars, bikes.
- Memes, casual social media screenshots, WhatsApp chat screenshots, mobile gaming screenshots, wallpapers.
- Blank, blurry, dark, unreadable, or empty images.

Respond STRICTLY in valid JSON format with NO Markdown wrappers:
{
  "isValidNotice": boolean,
  "rejectionReason": "Short polite explanation if invalid, or empty string if valid",
  "documentType": "Notice" | "Event Poster" | "Circular" | "Timetable" | "Syllabus" | "Fee Structure" | "Invalid",
  "detectedTitle": "Short title detected from the poster/document if valid",
  "extractedText": "Complete, thorough transcription of all text, headings, notes, and ALL tables formatted in clean markdown tables with exact column headers, row particulars, categories, fee amounts, and numerical values so that any question about specific numbers can be answered accurately.",
  "actionDate": "YYYY-MM-DD or null if an explicit deadline or event date is mentioned. If NO deadline/due date is specified (e.g. general fee structure with no last date), set to null."
}`
                  }
                ]
              }
            ]);

            const rawText = aiText?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}';
            const parsed = JSON.parse(rawText);

            const extractedText = typeof parsed.extractedText === 'string' ? parsed.extractedText.trim() : '';
            const isReadableScholarshipGuide = isScholarshipGuide &&
              extractedText.length >= 15 &&
              /scholarship|financial aid|caste|income|domicile|document|certificate/i.test(extractedText);
            if (parsed.isValidNotice === false && !isReadableScholarshipGuide) {
              console.warn(`[Upload Scanner] AI rejected image: ${parsed.rejectionReason}`);
              return res.status(400).json({
                error: parsed.rejectionReason || 'Document rejected: The uploaded file was identified as a personal photo or non-official image. Only official college notices, circulars, and academic event posters are permitted.'
              });
            }

            aiVerified = true;
            if (parsed.extractedText) {
              contentRaw = `${title} (${category || 'General'})\n\n${parsed.extractedText}`;
            }
            if (parsed.actionDate && !body.actionRequiredDate) {
              body.actionRequiredDate = parsed.actionDate;
            }
          }
          } catch (aiErr: any) {
            console.warn('[Upload Scanner] AI Vision check fallback to heuristics:', aiErr.message);
          }
        }

        // ── Heuristic Verification (if AI not active or fallback) ──
        if (!aiVerified) {
          // Block known personal photo filename patterns
          if (isPersonalPhotoName) {
            return res.status(400).json({
              error: 'Document rejected: The uploaded file was identified as a personal photo or non-official image. Please upload official college notices, circulars, or event posters only.'
            });
          }

          // Block camera-roll filenames with zero academic context
          const academicScore = scoreAcademicKeywords(title + ' ' + (category || '') + ' ' + (department || ''));
          if (isDefaultCameraName && academicScore === 0) {
            return res.status(400).json({
              error: 'Document rejected: File appears to be an unverified camera photo. If this is an official poster, please provide an official notice title and valid institutional category.'
            });
          }

          // Block obviously personal or meaningless titles
          if (/^(me|my[-_]?pic|photo|selfie|test\d*|asdfgh|trial|sample|image|upload|pic|picture|random|dummy|xyz|abc|untitled|new[-_]?doc)/i.test(title.trim())) {
            return res.status(400).json({
              error: 'Document rejected: Please provide a valid official notice or event poster title (e.g. "Hackathon 2026 Poster" or "Exam Schedule Notice").'
            });
          }

          // ── Core academic relevance check for images (same bar as PDFs/DOCX/TXT) ──
          // Without AI vision, we cannot verify image content, so the title + category
          // MUST contain at least 2 academic/institutional keywords to be accepted.
          const imageAcademicScore = scoreAcademicKeywords(title + ' ' + (category || '') + ' ' + (department || ''));
          const minimumAcademicScore = isScholarshipGuide ? 1 : 2;
          if (imageAcademicScore < minimumAcademicScore) {
            return res.status(400).json({
              error: 'Document rejected: Image uploads must be official college materials. For a student guide, choose a relevant category such as Scholarships or Financial Aid and provide a descriptive title.'
            });
          }
        }

        if ((!contentRaw || contentRaw.length < 5) && !(isStudentGuideUpload && body.previewOnly === 'true')) {
          contentRaw = `${title} — Official Event Poster / Notice Image.\nPublished for ${department} (${category}).`;
        }
        console.log(`[Upload] Verified & processed image poster "${title}" (${fileSize})`);

      } else if (mime === 'application/pdf' || mime.includes('pdf') || name.endsWith('.pdf')) {
        fileType = 'pdf';
        const base64Data = uploadedFile.buffer.toString('base64');
        fileUrl = `data:application/pdf;base64,${base64Data}`;
        let pdfParseError: string | null = null;
        try {
          contentRaw = await extractPdfText(uploadedFile.buffer);
          console.log(`[Upload] Extracted ${contentRaw.length} chars from PDF "${title}"`);
        } catch (pdfErr: any) {
          pdfParseError = pdfErr.message || String(pdfErr);
          console.warn('[Upload] PDF text extraction failed:', pdfParseError);
        }

        // Scanned PDFs have nonzero bytes but no text layer, so try OCR before rejecting.
        if (!contentRaw || contentRaw.trim().length < 20) {
          try {
            contentRaw = await extractScannedPdfText(uploadedFile.buffer);
          } catch (ocrErr: any) {
            console.error('[Upload] Scanned PDF OCR failed:', ocrErr.message || ocrErr);
          }
        }

        if (!contentRaw || contentRaw.trim().length < 20) {
          const error = pdfParseError
            ? 'The PDF is not empty, but readable text could not be extracted. Scanned PDFs require OCR; check the OCR service configuration or upload a searchable PDF.'
            : 'The PDF is not empty, but it contains no readable text layer. Scanned PDFs require OCR; check the OCR service configuration or upload a searchable PDF.';
          return res.status(400).json({
            error: `Document rejected: ${error}`
          });
        }

        // Verify PDF contains academic or official notice content
        const pdfAcademicScore = scoreAcademicKeywords(contentRaw + ' ' + title);
        if (pdfAcademicScore === 0) {
          return res.status(400).json({
            error: 'Document rejected: The uploaded document does not contain official college notices, circulars, or academic event content. Please upload valid institutional materials only.'
          });
        }

      } else if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv')) {
        fileType = 'txt';
        contentRaw = uploadedFile.buffer.toString('utf-8');
        console.log(`[Upload] Read text file "${title}" (${contentRaw.length} chars)`);

        if (!contentRaw || contentRaw.trim().length < 15) {
          return res.status(400).json({
            error: 'Document rejected: The text document is empty or too short. Please provide a complete notice or document.'
          });
        }

        const textAcademicScore = scoreAcademicKeywords(contentRaw + ' ' + title);
        if (textAcademicScore === 0) {
          return res.status(400).json({
            error: 'Document rejected: The document does not contain official college notice, circular, or academic content. Please upload valid institutional materials only.'
          });
        }

      } else if (name.endsWith('.docx') || mime.includes('wordprocessingml')) {
        fileType = 'docx';
        contentRaw = `${title} — ${department} — ${category}`;
        const docxScore = scoreAcademicKeywords(title + ' ' + category + ' ' + department);
        if (docxScore === 0) {
          return res.status(400).json({
            error: 'Document rejected: Please specify a valid official academic notice or event title.'
          });
        }
      } else {
        return res.status(400).json({
          error: 'Document rejected: Unsupported file format. Please upload PDF, Image (PNG/JPG/WEBP), or TXT notice documents.'
        });
      }
    } else {
      // ── Text Notice Verification (No File Uploaded, Direct Text Notice) ──
      fileType = 'txt';
      const textScore = scoreAcademicKeywords(contentRaw + ' ' + title);
      if (textScore === 0) {
        return res.status(400).json({
          error: 'Notice rejected: The announcement content or title must relate to official college matters, events, circulars, exams, schedules, or academic information.'
        });
      }
    }

    // If still empty, reject
    if ((!contentRaw || contentRaw.trim().length < 5) && !(isStudentGuideUpload && body.previewOnly === 'true')) {
      return res.status(400).json({
        error: 'Document rejected: Content cannot be empty. Please provide valid notice or document information.'
      });
    }

    if (body.previewOnly === 'true') {
      if (body.targetBucket !== 'student_guide') {
        return res.status(400).json({ error: 'Text preview is only available for student guide uploads.' });
      }
      return res.json({
        preview: true,
        extractedContent: contentRaw.slice(0, 20000),
        truncated: contentRaw.length > 20000,
      });
    }

    if (body.approvedContent !== undefined) {
      const approvedContent = String(body.approvedContent).trim();
      if (approvedContent.length < 15 || approvedContent.length > 20000) {
        return res.status(400).json({ error: 'Reviewed guide text must be between 15 and 20000 characters.' });
      }
      if (scoreAcademicKeywords(`${approvedContent} ${title} ${category}`) === 0) {
        return res.status(400).json({ error: 'Reviewed text must include relevant official college or scholarship information.' });
      }
      contentRaw = approvedContent;
    }

    const id = `doc_${Date.now()}`;
    let docYear = body.academicYear || '2026-2027';
    const yearMatch = contentRaw.match(/(20\d{2})[\s\-–]+(20\d{2})/);
    if (yearMatch) docYear = `${yearMatch[1]}-${yearMatch[2]}`;

    const totalChunks = Math.max(4, Math.ceil(contentRaw.length / 180));
    const summary = body.summary || `${category} document for ${department}${section ? ` (Section ${section})` : ''}.`;

    const actionRequiredDateCandidate =
      body.actionRequiredDate || body.actionDate || extractDeadlineDate(title + ' ' + contentRaw);
    const actionRequiredDate = parseDateToIso(actionRequiredDateCandidate) || actionRequiredDateCandidate || null;

    // Guarantee that fileUrl is always generated and saved in DB for non-image documents (PDFs, text notices, circulars)
    if (!fileUrl && fileType !== 'image') {
      try {
        fileUrl = await generatePdfDataUrl({
          title,
          department,
          category,
          academicYear: docYear,
          publishedDate,
          actionRequiredDate: actionRequiredDate || undefined,
          contentRaw,
        });
        console.log(`[Upload] Generated official PDF URL for "${title}" (${fileUrl.length} chars)`);
      } catch (genErr: any) {
        console.warn('[Upload] Failed to generate fallback PDF URL:', genErr.message);
      }
    }

    const targetBucket: 'dashboard' | 'ai_bucket' | 'student_guide' =
      body.targetBucket === 'ai_bucket' || body.targetBucket === 'student_guide'
        ? body.targetBucket
        : 'dashboard';

    const newDoc = {
      id,
      title,
      department,
      category,
      academicYear: docYear,
      publishedDate,
      fileType,
      fileSize,
      status: 'indexed' as const,
      totalChunks,
      summary,
      contentRaw,
      section,
      uploadedBy,
      fileUrl: fileUrl || undefined,
      imageUrl: imageUrl || undefined,
      actionRequiredDate: actionRequiredDate || undefined,
      targetBucket,
    };
    documents.unshift(newDoc);

    // Always index into RAG memory store so chatbot can answer questions instantly
    chunks.unshift({
      id: `chk_${Date.now()}`,
      documentId: id,
      documentTitle: title,
      department,
      category,
      pageNumber: 1,
      sectionHeader: title,
      content: contentRaw,
      imageUrl: imageUrl || undefined,
      fileType,
    } as any);

    // ── If AI BUCKET: Skip notice creation (keeps student dashboard clean) ──
    let newNotice: any = null;
    let noticeTags: string[] = [];

    if (targetBucket === 'dashboard') {
      const isExam = category === 'Exams' || /exam|midterm|test|endsem|assessment/i.test(title);
      const isTimetable = category === 'Timetable' || /timetable|schedule|time table/i.test(title);
      const isEvent = category === 'Events' || (fileType === 'image' && /hackathon|fest|contest|event|competition|workshop|webinar/i.test(title));
      const noticeUrgency = isExam ? 'urgent' : (isEvent && actionRequiredDate ? 'urgent' : (body.urgency || 'normal'));
      
      let noticeTitle = title;
      if (isEvent && !title.startsWith('🎉')) {
        noticeTitle = `🎉 ${title}`;
      } else if (isTimetable && !title.includes('📅')) {
        noticeTitle = `📅 ${title}`;
      } else if (!title.startsWith('📢') && !title.startsWith('🎉') && !title.startsWith('📅')) {
        noticeTitle = `📢 ${title}`;
      }

      const validCategories = ['Events', 'Circular', 'Exams', 'Academic', 'Scholarships', 'Placements', 'Hostels', 'General'];
      let noticeCategory = validCategories.includes(category) ? category : (isEvent ? 'Events' : 'Circular');
      if (isExam) {
        noticeCategory = 'Exams';
      } else if (isTimetable) {
        noticeCategory = 'Academic';
      }

      noticeTags = [
        category,
        department,
        ...(isEvent ? ['Events', 'Hackathon'] : []),
        ...(isExam ? ['Exams', 'Exam Schedule'] : []),
        ...(isTimetable ? ['Timetable', 'Schedule Update'] : [])
      ];

      newNotice = {
        id: `not_${id}`,
        title: noticeTitle,
        category: noticeCategory,
        urgency: noticeUrgency,
        publishDate: publishedDate,
        department,
        actionRequiredDate: actionRequiredDate || undefined,
        aiSummary: summary,
        fullContent: contentRaw,
        sourceDocId: id,
        imageUrl: imageUrl || undefined,
        fileUrl: fileUrl || undefined,
        tags: noticeTags,
        targetBucket: 'dashboard',
      };

      if (isTimetable) {
        // Clean up previous timetable notices for this department so they don't duplicate
        notices = notices.filter(n => !(n.category === 'Academic' && n.title.includes('Timetable') && n.department === department));
        if (pool) {
          try {
            await pool.query(
              `DELETE FROM notices WHERE category = 'Academic' AND title ILIKE '%Timetable%' AND department = $1`,
              [department]
            );
          } catch (_) {}
        }
      }

      notices.unshift(newNotice);
    }

    // Persist to PostgreSQL
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO documents (id, title, department, category, academic_year, published_date,
                                  file_type, file_size, status, total_chunks, summary, content_raw, section, uploaded_by_id,
                                  image_url, file_url, action_required_date, target_bucket)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [id, title, department, category, docYear, publishedDate,
           fileType, fileSize, 'indexed', totalChunks, summary, contentRaw, section, uploadedBy,
           imageUrl, fileUrl, actionRequiredDate, targetBucket]
        );
        console.log(`[Upload] Saved "${title}" to DB (targetBucket=${targetBucket}, section=${section}, contentRaw=${contentRaw.length} chars)`);

        // Also persist corresponding notice ONLY if not in AI bucket
        if (targetBucket !== 'ai_bucket' && newNotice) {
          await pool.query(
            `INSERT INTO notices (id, title, category, urgency, publish_date, department,
                                  action_required_date, ai_summary, full_content, source_doc_id, image_url, file_url, tags, target_bucket)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               category = EXCLUDED.category,
               department = EXCLUDED.department,
               image_url = EXCLUDED.image_url,
               file_url = EXCLUDED.file_url,
               action_required_date = EXCLUDED.action_required_date,
               ai_summary = EXCLUDED.ai_summary,
               full_content = EXCLUDED.full_content,
               target_bucket = EXCLUDED.target_bucket`,
            [newNotice.id, newNotice.title, newNotice.category, newNotice.urgency, newNotice.publishDate, newNotice.department,
             actionRequiredDate, summary, contentRaw, id, imageUrl, fileUrl, noticeTags, 'dashboard']
          );
        }

        // Also sync to calendar_events if an action/deadline date is present
        if (actionRequiredDate) {
          const parsedKey = parseDateToIso(actionRequiredDate);
          if (parsedKey) {
            const isExam = category === 'Exams' || title.toLowerCase().includes('exam') || title.toLowerCase().includes('test');
            await pool.query(
              `INSERT INTO calendar_events (id, title, category, event_date, end_date, date_str, department, description, source_doc_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (id) DO UPDATE SET
                 title = EXCLUDED.title,
                 category = EXCLUDED.category,
                 event_date = EXCLUDED.event_date,
                 end_date = EXCLUDED.end_date,
                 date_str = EXCLUDED.date_str,
                 department = EXCLUDED.department,
                 description = EXCLUDED.description`,
              [`cal_${id}`, title, isExam ? 'Exams' : (category || 'Academic'), parsedKey, parsedKey, actionRequiredDate, department, summary, id]
            );
          }
        }
      } catch (dbErr: any) {
        console.warn('[Upload] DB save failed (document still in memory):', dbErr.message);
      }
    }

    return res.json({ success: true, document: newDoc, notice: newNotice });
  } catch (err: any) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Failed to upload document' });
  }
});


// GET all notices from database (with auto-sync from documents)
app.get('/api/notices', async (req, res) => {
  try {
    if (!pool) {
      return res.json({ notices });
    }

    // Auto-sync any documents that are not yet in notices
    await pool.query(`
      INSERT INTO notices (id, title, category, urgency, publish_date, department, action_required_date, ai_summary, full_content, source_doc_id, image_url, file_url, tags)
      SELECT
        'not_' || d.id,
        CASE 
          WHEN (d.category = 'Timetable' OR LOWER(d.title) LIKE '%timetable%' OR LOWER(d.title) LIKE '%schedule%') AND d.title NOT LIKE '%📅%' THEN '📅 ' || d.title
          WHEN (d.category = 'Events' OR d.file_type = 'image') AND d.title NOT LIKE '%🎉%' THEN '🎉 ' || d.title 
          ELSE d.title 
        END,
        CASE 
          WHEN LOWER(d.title) LIKE '%exam%' OR d.category = 'Exams' THEN 'Exams'
          WHEN d.category = 'Timetable' OR LOWER(d.title) LIKE '%timetable%' OR LOWER(d.title) LIKE '%schedule%' THEN 'Academic'
          WHEN d.category IN ('Events', 'Circular', 'Exams', 'Academic', 'Scholarships', 'Placements', 'Hostels', 'General') THEN d.category 
          ELSE 'Circular' 
        END,
        CASE 
          WHEN d.category = 'Events' OR d.file_type = 'image' OR LOWER(d.title) LIKE '%exam%' OR d.category = 'Timetable' OR LOWER(d.title) LIKE '%timetable%' THEN 'urgent' 
          ELSE 'normal' 
        END,
        COALESCE(d.published_date, 'Just now'),
        COALESCE(d.department, 'General Academic'),
        d.action_required_date,
        COALESCE(d.summary, d.title),
        COALESCE(d.content_raw, d.title),
        d.id,
        d.image_url,
        d.file_url,
        ARRAY[d.category, d.department]
      FROM documents d
      WHERE (d.target_bucket IS NULL OR d.target_bucket NOT IN ('ai_bucket', 'student_guide'))
        AND NOT EXISTS (
          SELECT 1 FROM notices n WHERE n.source_doc_id = d.id OR n.id = 'not_' || d.id
        );

      -- Ensure existing notices have their file_url synced if documents has it
      UPDATE notices n
      SET file_url = d.file_url,
          image_url = COALESCE(n.image_url, d.image_url)
      FROM documents d
      WHERE (n.source_doc_id = d.id OR n.id = 'not_' || d.id)
        AND (n.file_url IS NULL OR n.file_url = '')
        AND d.file_url IS NOT NULL;
    `);

    const result = await pool.query(
      `SELECT id, title, category, urgency, publish_date, department,
              action_required_date, ai_summary, full_content, source_doc_id,
              image_url, file_url, tags, created_at
       FROM notices
       WHERE (target_bucket IS NULL OR target_bucket NOT IN ('ai_bucket', 'student_guide'))
       ORDER BY created_at DESC`
    );

    const mappedNotices = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      category: row.category,
      urgency: row.urgency,
      publishDate: row.publish_date,
      department: row.department,
      actionRequiredDate: row.action_required_date || undefined,
      aiSummary: row.ai_summary || '',
      fullContent: row.full_content || '',
      sourceDocId: row.source_doc_id,
      imageUrl: row.image_url || undefined,
      fileUrl: row.file_url || row.image_url || undefined,
      tags: row.tags || [row.category, row.department],
      createdAt: row.created_at,
    }));

    return res.json({ notices: mappedNotices.length > 0 ? mappedNotices : notices });
  } catch (err: any) {
    console.error('Fetch notices error:', err);
    return res.json({ notices });
  }
});


// GET all saved documents from database
app.get('/api/documents', async (req, res) => {
  try {
    if (!pool) {
      return res.json({ documents });
    }

    const result = await pool.query(
      `SELECT id, title, department, category, academic_year, published_date,
              file_type, file_size, status, total_chunks, summary, content_raw, section,
              uploaded_by_id, image_url, file_url, action_required_date, target_bucket, created_at
       FROM documents ORDER BY created_at DESC`
    );

    const docs = result.rows.map(row => {
      const isImg = row.file_type === 'image';
      // If content_raw is a data URL, treat as imageUrl
      const imgUrl = row.image_url || (isImg || row.content_raw?.startsWith('data:image') ? (row.content_raw?.startsWith('data:image') ? row.content_raw : undefined) : undefined) || (row.file_url?.startsWith('data:image') ? row.file_url : undefined);
      return {
        id:            row.id,
        title:         row.title,
        department:    row.department,
        category:      row.category,
        academicYear:  row.academic_year,
        publishedDate: row.published_date,
        fileType:      row.file_type,
        fileSize:      row.file_size,
        status:        row.status,
        totalChunks:   row.total_chunks,
        summary:       row.summary,
        contentRaw:    row.content_raw,
        section:       row.section,
        uploadedBy:    row.uploaded_by_id,
        fileUrl:       row.file_url || imgUrl,
        imageUrl:      imgUrl,
        actionRequiredDate: row.action_required_date || undefined,
        targetBucket:  row.target_bucket || 'dashboard',
      };
    });

    return res.json({ documents: docs.length > 0 ? docs : documents });
  } catch (err: any) {
    console.error('Fetch documents error:', err);
    return res.json({ documents });
  }
});

// GET documents for a specific student (filtered by department + section)
app.get('/api/documents/for-student', async (req, res) => {
  try {
    const { department, section } = req.query as { department?: string; section?: string };

    if (!pool) {
      return res.json({ documents: [] });
    }

    // Build query: fetch docs matching department AND (section matches OR section is null/all)
    let query = `SELECT id, title, department, category, academic_year, published_date,
                        file_type, file_size, status, total_chunks, summary, content_raw, section,
                        uploaded_by_id, image_url, file_url, action_required_date, target_bucket, created_at
                 FROM documents
                 WHERE (target_bucket IS NULL OR target_bucket != 'ai_bucket')`;
    const params: any[] = [];

    if (department) {
      const deptNorm = department.trim().toLowerCase();
      // Handle CSE <-> Computer Science & Engineering acronym alias
      const isCse = deptNorm === 'cse' || deptNorm.includes('computer science');
      if (isCse) {
        query += ` AND (
          LOWER(department) LIKE '%computer science%'
          OR LOWER(department) LIKE '%cse%'
          OR department = 'General Academic'
        )`;
      } else {
        params.push(deptNorm);
        const idx = params.length;
        query += ` AND (LOWER(department) = $${idx} OR LOWER(department) LIKE '%' || $${idx} || '%' OR department = 'General Academic')`;
      }
    }
    if (section) {
      params.push(section.trim());
      const sIdx = params.length;
      query += ` AND (section IS NULL OR LOWER(TRIM(section)) = LOWER($${sIdx}))`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    const docs = result.rows.map(row => {
      const isImg = row.file_type === 'image';
      const imgUrl = row.image_url || (isImg || row.content_raw?.startsWith('data:image') ? (row.content_raw?.startsWith('data:image') ? row.content_raw : undefined) : undefined) || (row.file_url?.startsWith('data:image') ? row.file_url : undefined);
      return {
        id:            row.id,
        title:         row.title,
        department:    row.department,
        category:      row.category,
        academicYear:  row.academic_year,
        publishedDate: row.published_date,
        fileType:      row.file_type,
        fileSize:      row.file_size,
        status:        row.status,
        totalChunks:   row.total_chunks,
        summary:       row.summary,
        contentRaw:    row.content_raw,
        section:       row.section,
        uploadedBy:    row.uploaded_by_id,
        fileUrl:       row.file_url || imgUrl,
        imageUrl:      imgUrl,
        actionRequiredDate: row.action_required_date || undefined,
        targetBucket: row.target_bucket || 'dashboard',
        createdAt: row.created_at,
      };
    });

    return res.json({ documents: docs });
  } catch (err: any) {
    console.error('Fetch student documents error:', err);
    return res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// GET raw document file (PDF / image / text) for direct opening / downloading
app.get('/api/documents/:id/file', async (req, res) => {
  try {
    const { id } = req.params;
    let fileUrl: string | null = null;
    let title = 'document';

    if (pool) {
      const r = await pool.query('SELECT file_url, image_url, title FROM documents WHERE id = $1', [id]);
      if (r.rows.length > 0) {
        fileUrl = r.rows[0].file_url || r.rows[0].image_url;
        title = r.rows[0].title || 'document';
      }
    }

    if (!fileUrl) {
      const memDoc = documents.find(d => d.id === id);
      fileUrl = memDoc?.fileUrl || memDoc?.imageUrl || null;
      if (memDoc) title = memDoc.title;
    }

    if (!fileUrl) {
      return res.status(404).send('File not found');
    }

    if (fileUrl.startsWith('data:')) {
      const matches = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = mimeType.includes('pdf') ? 'pdf' : (mimeType.includes('png') ? 'png' : 'jpg');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}"`);
        return res.send(buffer);
      }
    }

    return res.redirect(fileUrl);
  } catch (err: any) {
    return res.status(500).send('Error serving file');
  }
});

// DELETE a document (and its corresponding notice)
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Remove from in-memory
    documents = documents.filter(d => d.id !== id);
    chunks = chunks.filter(c => c.documentId !== id);
    notices = notices.filter(n => n.sourceDocId !== id && n.id !== id && n.id !== `not_${id}`);

    if (pool) {
      try {
        await pool.query('DELETE FROM documents WHERE id = $1', [id]);
        await pool.query('DELETE FROM notices WHERE source_doc_id = $1 OR id = $1 OR id = $2', [id, `not_${id}`]);
        await pool.query('DELETE FROM calendar_events WHERE source_doc_id = $1 OR id = $1 OR id = $2', [id, `cal_${id}`]);
      } catch (dbErr: any) {
        console.warn('DB delete failed:', dbErr.message);
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('Delete document error:', err);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
});

// DELETE a notice directly
app.delete('/api/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    notices = notices.filter(n => n.id !== id);
    if (pool) {
      await pool.query('DELETE FROM notices WHERE id = $1 OR source_doc_id = $1', [id]);
      await pool.query('DELETE FROM calendar_events WHERE source_doc_id = $1 OR id = $1', [id]);
    }
    return res.json({ success: true });
  } catch (err: any) {
    console.error('Delete notice error:', err);
    return res.status(500).json({ error: 'Failed to delete notice' });
  }
});

// GET all academic calendar events, synced with live database documents and notices
app.get('/api/calendar-events', async (req, res) => {
  try {
    const eventsList: any[] = [];
    const seenEventKeys = new Set<string>();

    if (pool) {
      // 1. Fetch official calendar events from database
      const calRes = await pool.query(
        `SELECT id, title, category, event_date, end_date, date_str, department, description, source_doc_id
         FROM calendar_events ORDER BY event_date ASC`
      );

      for (const row of calRes.rows) {
        const cleanTitle = (row.title || '').replace(/^([📢🎉📅]\s*)+/, '').trim();
        const normKey = `${cleanTitle.toLowerCase()}_${row.event_date}`;
        if (!seenEventKeys.has(normKey)) {
          seenEventKeys.add(normKey);
          eventsList.push({
            id: row.id,
            title: cleanTitle,
            category: row.category || 'Academic',
            eventDate: row.event_date,
            endDate: row.end_date || row.event_date,
            dateStr: row.date_str || row.event_date,
            department: row.department || 'College',
            description: row.description || row.title,
            sourceDocId: row.source_doc_id,
          });
        }
      }

      // 2. Fetch all documents from documents table and extract any real-time events / deadlines
      const docsRes = await pool.query(
        `SELECT id, title, department, category, published_date, action_required_date, summary, content_raw, image_url, file_url
         FROM documents
         WHERE action_required_date IS NOT NULL AND action_required_date != ''`
      );

      for (const d of docsRes.rows) {
        const cleanTitle = (d.title || '').replace(/^([📢🎉📅]\s*)+/, '').trim();
        const parsedKey = parseDateToIso(d.action_required_date);
        if (parsedKey) {
          const normKey = `${cleanTitle.toLowerCase()}_${parsedKey}`;
          if (!seenEventKeys.has(normKey)) {
            seenEventKeys.add(normKey);
            const isExam = (d.category || '').toLowerCase() === 'exams' || cleanTitle.toLowerCase().includes('exam') || cleanTitle.toLowerCase().includes('test');
            eventsList.push({
              id: `doc_ev_${d.id}`,
              title: cleanTitle,
              category: isExam ? 'Exams' : (d.category || 'Academic'),
              eventDate: parsedKey,
              endDate: parsedKey,
              dateStr: d.action_required_date,
              department: d.department || 'Academic Affairs',
              description: d.summary || d.title,
              sourceDocId: d.id,
              imageUrl: d.image_url,
              fileUrl: d.file_url,
            });
          }
        }
      }

      // 3. Fetch from notices table for any event circulars / hackathons (e.g. TCS Codevita, AITHON 2.0)
      const notRes = await pool.query(
        `SELECT id, title, category, department, publish_date, action_required_date, ai_summary, full_content, source_doc_id, image_url, file_url
         FROM notices
         WHERE action_required_date IS NOT NULL AND action_required_date != ''`
      );

      for (const n of notRes.rows) {
        const cleanTitle = (n.title || '').replace(/^([📢🎉📅]\s*)+/, '').trim();
        const parsedKey = parseDateToIso(n.action_required_date);
        if (parsedKey) {
          const normKey = `${cleanTitle.toLowerCase()}_${parsedKey}`;
          if (!seenEventKeys.has(normKey)) {
            seenEventKeys.add(normKey);
            const isExam = (n.category || '').toLowerCase() === 'exams' || cleanTitle.toLowerCase().includes('exam') || cleanTitle.toLowerCase().includes('test');
            eventsList.push({
              id: `not_ev_${n.id}`,
              title: cleanTitle,
              category: isExam ? 'Exams' : (n.category || 'Events'),
              eventDate: parsedKey,
              endDate: parsedKey,
              dateStr: n.action_required_date,
              department: n.department || 'General Academic',
              description: n.ai_summary || cleanTitle,
              sourceDocId: n.source_doc_id || n.id,
              imageUrl: n.image_url,
              fileUrl: n.file_url,
            });
          }
        }
      }
    }

    return res.json({ events: eventsList });
  } catch (err: any) {
    console.error('Fetch calendar events error:', err);
    return res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// ── Authentication API ──────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const isDemoMode = process.env.NODE_ENV !== 'production';
const demoAdmin = {
  id: 'local-demo-admin',
  name: process.env.DEMO_ADMIN_NAME || 'CampusIQ Administrator',
  email: process.env.DEMO_ADMIN_EMAIL || '',
  role: 'admin' as const,
  avatar: 'https://ui-avatars.com/api/?name=CampusIQ%20Administrator&background=003527&color=80bea6&size=128&bold=true',
};

function hasDemoAdminCredentials(email: string, password: string) {
  return isDemoMode
    && Boolean(process.env.DEMO_ADMIN_EMAIL && process.env.DEMO_ADMIN_PASSWORD)
    && email === process.env.DEMO_ADMIN_EMAIL
    && password === process.env.DEMO_ADMIN_PASSWORD;
}

/** Secure random hex token for email verification links */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** 6-digit numeric OTP */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeIndianPhone(phone: string): string {
  const trimmedPhone = phone.trim();
  if (trimmedPhone.startsWith('+')) return trimmedPhone;
  return `+91${trimmedPhone}`;
}

function getTwilioVerifyConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error(
      'Twilio Verify is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID in backend/.env.',
    );
  }

  return { accountSid, authToken, serviceSid };
}

async function getTwilioError(response: Response, phone: string): Promise<Error> {
  let details: { code?: number | string; message?: string } = {};
  try {
    details = await response.json() as { code?: number | string; message?: string };
  } catch {
    // Keep the HTTP status useful if Twilio returns a non-JSON error.
  }

  const safeMessage = details.message
    ?.replaceAll(normalizeIndianPhone(phone), '[phone]')
    .replaceAll(phone, '[phone]');
  const code = details.code ? `, Twilio code ${details.code}` : '';
  const message = safeMessage ? `: ${safeMessage}` : '';
  return new Error(`Twilio Verify request failed (HTTP ${response.status}${code})${message}`);
}

async function sendTwilioVerification(phone: string): Promise<void> {
  const { accountSid, authToken, serviceSid } = getTwilioVerifyConfig();
  const body = new URLSearchParams({
    To: normalizeIndianPhone(phone),
    Channel: 'sms',
  });
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/Verifications`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  );

  if (!response.ok) {
    throw await getTwilioError(response, phone);
  }
}

async function checkTwilioVerification(phone: string, code: string): Promise<boolean> {
  const { accountSid, authToken, serviceSid } = getTwilioVerifyConfig();
  const body = new URLSearchParams({
    To: normalizeIndianPhone(phone),
    Code: code,
  });
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  );

  if (!response.ok) {
    const error = await getTwilioError(response, phone);
    if (response.status === 404 && error.message.includes('Twilio code 20404')) return false;
    throw error;
  }

  const result = await response.json() as { status?: string };
  return result.status === 'approved';
}

// Local demonstration account. It is created only when the database is available
// and no user has already been registered with this email.
async function ensureDemoAdmin() {
  if (!pool || !process.env.DEMO_ADMIN_EMAIL || !process.env.DEMO_ADMIN_PASSWORD) return;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [process.env.DEMO_ADMIN_EMAIL]);
    if (existing.rows.length > 0) return;

    const passwordHash = await bcrypt.hash(process.env.DEMO_ADMIN_PASSWORD, 12);
    const name = process.env.DEMO_ADMIN_NAME || 'CampusIQ Administrator';
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=003527&color=80bea6&size=128&bold=true`;
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, avatar_url, email_verified)
       VALUES ($1, $2, $3, 'admin', $4, true)`,
      [name, process.env.DEMO_ADMIN_EMAIL, passwordHash, avatarUrl],
    );
    console.log(`Demo administrator created: ${process.env.DEMO_ADMIN_EMAIL}`);
  } catch (err: any) {
    console.warn('Demo administrator could not be created:', err.message);
  }
}

// SIGNUP — every account requires a verified email address
app.post('/api/auth/signup', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    const { name, password, role, department, year, semester, rollNumber,
            subject, employeeId } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }
    if (!['student', 'admin', 'teacher'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=003527&color=80bea6&size=128&bold=true`;

    // Always require OTP verification
    const autoVerified = false;
    const verificationToken = generateOTP();
    const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO users
         (name, email, password_hash, role, department, year, semester, roll_number,
          avatar_url, email_verified, verification_token, verification_token_expires,
          phone_number, subject, employee_id, section)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [name, email || null, passwordHash, role,
       department || null, year || null, semester || null, rollNumber || null,
       avatarUrl, autoVerified, verificationToken, tokenExpires,
       null, subject || null, employeeId || null, req.body.section || null]
    );

    try {
      await sendSignupOTPEmail(email, name, verificationToken);
    } catch (mailErr: any) {
      console.error('Signup OTP email failed:', mailErr.message);
      return res.status(201).json({
        verificationSent: false,
        method: 'email',
        identifier: email,
        message: 'Your account was created, but the verification email could not be sent. Check the email settings or try resending.',
      });
    }

    return res.status(201).json({
      verificationSent: true,
      method: 'email',
      identifier: email,
      message: `An OTP has been sent to ${email}.`,
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// VERIFY SIGNUP OTP
app.post('/api/auth/verify-signup-otp', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    // identifier can be email or phone
    const { identifier, otp, method } = req.body;
    if (!identifier || !otp) return res.status(400).json({ error: 'Identifier and OTP are required.' });

    let user: { id: string; email_verified: boolean; verification_token_expires?: Date | string | null };
    if (method === 'sms') {
      const result = await pool.query(
        `SELECT id, email_verified FROM users WHERE phone_number = $1`,
        [identifier],
      );
      if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid OTP.' });
      user = result.rows[0];
      if (user.email_verified) {
        return res.status(400).json({ error: 'Account already verified.' });
      }
      if (!await checkTwilioVerification(identifier, String(otp))) {
        return res.status(400).json({ error: 'Invalid or expired OTP.' });
      }
    } else {
      const result = await pool.query(
        `SELECT id, email_verified, verification_token_expires
         FROM users WHERE (email = $1 OR phone_number = $1) AND verification_token = $2`,
        [identifier, otp]
      );
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid OTP.' });
      }
      user = result.rows[0];
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Account already verified.' });
    }

    if (method !== 'sms' && new Date() > new Date(user.verification_token_expires!)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    await pool.query(
      `UPDATE users
       SET email_verified = true, verification_token = NULL, verification_token_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    return res.json({ verified: true, message: 'Account verified successfully!' });
  } catch (err: any) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

// RESEND VERIFICATION OTP (Email)
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Identifier is required.' });

    const result = await pool.query(
      'SELECT id, name, email, email_verified FROM users WHERE email = $1 OR phone_number = $1',
      [identifier]
    );
    // Always return 200 to avoid enumeration
    if (result.rows.length === 0 || result.rows[0].email_verified || !result.rows[0].email) {
      return res.json({ sent: true });
    }

    const user = result.rows[0];
    const verificationToken = generateOTP();
    const tokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await pool.query(
      `UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3`,
      [verificationToken, tokenExpires, user.id]
    );

    try {
      await sendSignupOTPEmail(user.email, user.name, verificationToken);
    } catch (mailErr: any) {
      console.error('Resend OTP email failed:', mailErr.message);
      return res.status(502).json({ error: 'Could not send the verification email. Check the SMTP configuration and try again.' });
    }

    return res.json({ sent: true });
  } catch (err: any) {
    console.error('Resend verification error:', err);
    return res.status(500).json({ error: 'Failed to resend OTP.' });
  }
});

// RESEND VERIFICATION OTP (SMS - Fallback)
app.post('/api/auth/resend-otp-sms', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Identifier is required.' });

    const result = await pool.query(
      'SELECT id, phone_number, email_verified FROM users WHERE email = $1 OR phone_number = $1',
      [identifier]
    );

    // If already verified or no phone number exists, return success
    if (result.rows.length === 0 || result.rows[0].email_verified || !result.rows[0].phone_number) {
      return res.json({ sent: true });
    }

    const user = result.rows[0];

    await sendTwilioVerification(user.phone_number);

    await pool.query(
      `UPDATE users SET verification_token = NULL, verification_token_expires = NULL WHERE id = $1`,
      [user.id],
    );

    return res.json({ sent: true, method: 'sms' });
  } catch (err: any) {
    console.error('Resend SMS error:', err);
    return res.status(500).json({ error: 'Failed to resend SMS.' });
  }
});

// FORGOT PASSWORD — sends OTP
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const result = await pool.query(
      'SELECT id, name FROM users WHERE email = $1 AND email_verified = true',
      [email]
    );
    // Always 200 to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ sent: true });
    }

    const user = result.rows[0];
    const otp = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous OTPs for this user
    await pool.query(
      `UPDATE password_reset_otps SET used = true WHERE user_id = $1 AND used = false`,
      [user.id]
    );

    // Insert new OTP
    await pool.query(
      `INSERT INTO password_reset_otps (user_id, otp_code, expires_at) VALUES ($1, $2, $3)`,
      [user.id, otp, expires]
    );

    try {
      await sendOTPEmail(email, user.name, otp);
    } catch (mailErr: any) {
      console.warn('OTP email failed to send:', mailErr.message);
    }

    return res.json({ sent: true });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

// VERIFY OTP — returns a short-lived reset token
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND email_verified = true',
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    const userId = userResult.rows[0].id;
    const otpResult = await pool.query(
      `SELECT id, expires_at FROM password_reset_otps
       WHERE user_id = $1 AND otp_code = $2 AND used = false
       ORDER BY created_at DESC LIMIT 1`,
      [userId, otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or already used OTP.' });
    }

    const otpRow = otpResult.rows[0];
    if (new Date() > new Date(otpRow.expires_at)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Mark OTP as used
    await pool.query('UPDATE password_reset_otps SET used = true WHERE id = $1', [otpRow.id]);

    // Issue a short-lived password reset token (5 min)
    const resetToken = jwt.sign({ userId, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: '5m' });

    return res.json({ resetToken });
  } catch (err: any) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'OTP verification failed.' });
  }
});

// RESET PASSWORD — validates reset token, sets new password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    let decoded: { userId: string; purpose: string };
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET) as { userId: string; purpose: string };
    } catch {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid reset token.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, decoded.userId]);

    return res.json({ success: true, message: 'Password updated successfully. You can now sign in.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Password reset failed.' });
  }
});

// LOGIN — accepts email OR mobile number; validates selected role matches account
app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrPhone, password, role } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ error: 'Email/mobile and password are required.' });
    }

    // Demo admin shortcut (still works with email)
    if (hasDemoAdminCredentials(emailOrPhone, password)) {
      // If a role was specified and it's not admin, reject
      if (role && role !== 'admin') {
        const correctLabel = 'Admin';
        const selectedLabel = role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : role;
        return res.status(403).json({
          error: `This account is registered as ${correctLabel}. Please select "${correctLabel}" and try again.`,
          roleMismatch: true,
          actualRole: 'admin',
        });
      }
      const token = jwt.sign({ userId: demoAdmin.id, role: demoAdmin.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: demoAdmin });
    }
    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    // Detect phone (10–15 digits, optional leading +) vs email
    const isPhone = /^\+?[0-9]{10,15}$/.test(emailOrPhone.trim());
    const lookupField = isPhone ? 'phone_number' : 'email';

    const result = await pool.query(
      `SELECT id, name, email, password_hash, role, department, year, semester,
              roll_number, avatar_url, email_verified, phone_number, subject, employee_id, section
       FROM users WHERE ${lookupField} = $1`,
      [emailOrPhone.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: isPhone
          ? 'No account found with this mobile number.'
          : 'No account found with this email.',
      });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // ── Role mismatch check ─────────────────────────────────
    // If the frontend sent a role, verify it matches the user's actual role.
    // This prevents a student from accidentally (or intentionally) signing in
    // via the Admin or Teacher tab.
    if (role && role !== user.role) {
      const roleLabels: Record<string, string> = {
        student: 'Student',
        teacher: 'Teacher',
        admin: 'Admin',
      };
      const actualLabel = roleLabels[user.role] || user.role;
      return res.status(403).json({
        error: `This account is registered as ${actualLabel}. Please select "${actualLabel}" and try again.`,
        roleMismatch: true,
        actualRole: user.role,
      });
    }

    // Block accounts that have email but haven't verified it yet
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before signing in.',
        emailNotVerified: true,
        email: user.email,
      });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      token,
      user: {
        id:         user.id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        department: user.department,
        year:       user.year,
        semester:   user.semester,
        rollNumber: user.roll_number,
        avatar:     user.avatar_url,
        phone:      user.phone_number,
        subject:    user.subject,
        employeeId: user.employee_id,
        section:    user.section,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// VERIFY TOKEN
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    if (isDemoMode && decoded.userId === demoAdmin.id) {
      return res.json(demoAdmin);
    }
    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    const result = await pool.query(
      `SELECT id, name, email, role, department, year, semester, roll_number,
              avatar_url, phone_number, subject, employee_id, section
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];
    return res.json({
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      department: user.department,
      year:       user.year,
      semester:   user.semester,
      rollNumber: user.roll_number,
      avatar:     user.avatar_url,
      phone:      user.phone_number,
      subject:    user.subject,
      employeeId: user.employee_id,
      section:    user.section,
    });
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

// ── PUT /api/profile — update user profile in DB ────────────────────
app.put('/api/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    const { name, department, year, semester, rollNumber, subject, employeeId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=003527&color=80bea6&size=128&bold=true`;

    await pool.query(
      `UPDATE users
       SET name = $1, department = $2, year = $3, semester = $4,
           roll_number = $5, subject = $6, employee_id = $7, avatar_url = $8
       WHERE id = $9`,
      [name.trim(), department || null, year || null, semester || null,
       rollNumber || null, subject || null, employeeId || null, avatarUrl, decoded.userId]
    );

    const result = await pool.query(
      `SELECT id, name, email, role, department, year, semester, roll_number,
              avatar_url, phone_number, subject, employee_id, section
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    const u = result.rows[0];
    return res.json({
      id:         u.id,
      name:       u.name,
      email:      u.email,
      role:       u.role,
      department: u.department,
      year:       u.year,
      semester:   u.semester,
      rollNumber: u.roll_number,
      avatar:     u.avatar_url,
      phone:      u.phone_number,
      subject:    u.subject,
      employeeId: u.employee_id,
      section:    u.section,
    });
  } catch (err: any) {
    console.error('[Profile] Update failed:', err.message);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Student reviews
app.get('/api/reviews', async (req, res) => {
  try {
    if (!pool) return res.json({ reviews: [] });
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const result = await pool.query(
      `SELECT id, user_id, name, department, year, semester, section, rating, review_text, created_at
       FROM student_reviews ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.json({ reviews: result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      department: row.department,
      year: row.year,
      semester: row.semester,
      section: row.section,
      rating: row.rating,
      text: row.review_text,
      createdAt: row.created_at,
    })) });
  } catch (error: any) {
    console.error('[Reviews] Fetch failed:', error.message);
    return res.status(500).json({ reviews: [], error: 'Failed to load reviews' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database unavailable' });
    const { userId, name, department, year, semester, section, rating, text } = req.body;
    const cleanText = String(text || '').trim();
    const cleanRating = Number(rating);
    if (cleanText.length < 10) return res.status(400).json({ error: 'Review must contain at least 10 characters' });
    if (!Number.isInteger(cleanRating) || cleanRating < 1 || cleanRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    const existing = userId
      ? await pool.query('SELECT id FROM student_reviews WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId])
      : { rows: [] };
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'You have already submitted a review.' });
    }
    const result = await pool.query(
      `INSERT INTO student_reviews (user_id, name, department, year, semester, section, rating, review_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, name, department, year, semester, section, rating, review_text, created_at`,
      [userId || null, String(name || 'Student').trim(), String(department || 'General Academic').trim(), year || null, semester || null, section || null, cleanRating, cleanText]
    );
    const row = result.rows[0];
    return res.status(201).json({ review: {
      id: row.id, userId: row.user_id, name: row.name, department: row.department,
      year: row.year, semester: row.semester, section: row.section, rating: row.rating,
      text: row.review_text, createdAt: row.created_at,
    } });
  } catch (error: any) {
    console.error('[Reviews] Submit failed:', error.message);
    return res.status(500).json({ error: 'Failed to submit review' });
  }
});

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  await initDb();
  await ensureDemoAdmin();
  // Load all previously uploaded documents into the RAG knowledge base
  await syncChunksFromDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusIQ Server running on port ${PORT}`);
  });
}

startServer();
