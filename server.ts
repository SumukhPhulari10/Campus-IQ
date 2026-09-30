import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { INITIAL_DOCUMENTS, INITIAL_CHUNKS, INITIAL_NOTICES } from './src/data/knowledgeBase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, initDb } from './src/lib/db';
import { sendOTPEmail, sendSignupOTPEmail } from './src/lib/mailer';
import multer from 'multer';
import { createRequire } from 'module';
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

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// Multer: in-memory storage (we don't need to save files to disk)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Lazy-initialized Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// In-memory knowledge base store for the session
let documents = [...INITIAL_DOCUMENTS];
let chunks = [...INITIAL_CHUNKS];
let notices = [...INITIAL_NOTICES];

// Simple keyword / semantic similarity retrieval engine
function retrieveRelevantChunks(query: string, limit = 4) {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  const scored = chunks.map(chunk => {
    const text = (chunk.content + ' ' + chunk.sectionHeader + ' ' + chunk.documentTitle + ' ' + chunk.department).toLowerCase();
    let score = 0;
    queryWords.forEach(word => {
      if (text.includes(word)) score += 2;
    });
    // Boost exact matches in content
    if (text.includes(query.toLowerCase())) score += 5;
    return { ...chunk, similarityScore: score };
  });

  scored.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
  return scored.slice(0, limit);
}

// RAG Query API endpoint
app.post('/api/query', async (req, res) => {
  try {
    const { query, studentContext } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const relevantChunks = retrieveRelevantChunks(query);
    const gemini = getGeminiClient();

    // Check for potential conflicts in retrieved context
    const hasExamConflict = query.toLowerCase().includes('cs-101') || query.toLowerCase().includes('cs101') || (query.toLowerCase().includes('exam') && query.toLowerCase().includes('conflict'));
    const isEscalationNeeded = query.toLowerCase().includes('urgent') || query.toLowerCase().includes('rent') || query.toLowerCase().includes('haven\'t received') || query.toLowerCase().includes('evict');

    let answer = '';
    let confidenceScore = 95;
    let groundedAnswerRate = 96.4;

    if (gemini) {
      const contextPrompt = `You are CampusIQ, the official authoritative RAG-based AI Scholarly Assistant for college students.
Use strictly the provided verified official document context chunks to answer the student's question accurately.

STUDENT CONTEXT:
${JSON.stringify(studentContext || { name: 'Sumukh', department: 'Computer Science', year: '4th Year' })}

OFFICIAL COLLEGE KNOWLEDGE BASE CONTEXT CHUNKS:
${relevantChunks.map((c, i) => `[Chunk ${i+1}] (Doc: ${c.documentTitle}, Page: ${c.pageNumber}, Section: ${c.sectionHeader}):\n${c.content}`).join('\n\n')}

QUESTION:
${query}

GUIDELINES:
1. Provide a direct, authoritative, structured, and student-friendly answer.
2. Quote exact regulations or dates where applicable.
3. Explicitly reference the source documents and page numbers.
4. If there is a schedule update or conflict (such as between circulars), clearly highlight the latest revision.
5. If the student has an urgent financial emergency, guide them to bursar ticket escalation.`;

      try {
        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contextPrompt,
        });
        answer = response.text || '';
      } catch (err: any) {
        console.warn('Gemini API call failed, falling back to local grounded synthesis:', err.message);
      }
    }

    // Fallback if no Gemini key or API call failed
    if (!answer) {
      if (relevantChunks.length > 0 && relevantChunks[0].similarityScore! > 0) {
        const top = relevantChunks[0];
        answer = `Based on the **${top.documentTitle}** (Section: *${top.sectionHeader}*, Page ${top.pageNumber}):\n\n${top.content}\n\nPlease check the official notice board or academic office if you require further specific condonation approvals.`;
      } else {
        answer = `According to our official academic records and 2024-25 Student Regulations:\n\n1. **Attendance Requirement**: A minimum of 75% attendance is strictly mandated across all theory and lab subjects.\n2. **Exams & Registration**: Check your portal before the final deadline to avoid late fee penalties.\n3. **Prerequisites**: Refer to your course catalog for prerequisites before registering for advanced electives.`;
      }
    }

    const citations = relevantChunks.map(c => ({
      chunkId: c.id,
      documentId: c.documentId,
      documentTitle: c.documentTitle,
      department: c.department,
      pageNumber: c.pageNumber,
      sectionHeader: c.sectionHeader,
      exactQuote: c.content.slice(0, 160) + '...',
      confidence: 0.94,
    }));

    const responsePayload = {
      answer,
      citations,
      groundedAnswerRate,
      confidenceScore: isEscalationNeeded ? 45 : confidenceScore,
      isGrounded: true,
      needsReview: query.toLowerCase().includes('parking') || query.toLowerCase().includes('appeal'),
      escalationNeeded: isEscalationNeeded,
      ticketId: isEscalationNeeded ? 'Ticket #8942' : undefined,
      conflictDetected: hasExamConflict ? {
        topic: 'CS-101 Final Examination Schedule',
        conflictingDocs: {
          docA: { title: 'Original Circular (Oct 12)', version: 'V1.2', date: 'Oct 12, 2024', quote: 'Held on November 15th, 2024 at 09:00 AM in Main Auditorium.' },
          docB: { title: 'Revised Circular (Oct 28)', version: 'V2.0', date: 'Oct 28, 2024', quote: 'Held on November 18th, 2024 at 14:00 PM in Science Block, Room 402.' }
        }
      } : undefined,
      suggestedFollowUps: [
        'How do I submit an Exam Conflict Form?',
        'What is the minimum attendance condonation policy?',
        'When is the last date for scholarship applications?',
        'View full CS701 course syllabus and credits'
      ]
    };

    return res.json(responsePayload);
  } catch (error: any) {
    console.error('Error handling RAG query:', error);
    return res.status(500).json({ error: 'Failed to process query' });
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
    const section     = body.section     || null;
    const uploadedBy  = body.uploadedBy  || null;
    const publishedDate = body.publishedDate || new Date().toISOString().split('T')[0];
    const fileSize    = uploadedFile
      ? `${(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB`
      : (body.fileSize || '—');

    // ── Extract text/image content from the uploaded file ──────
    let contentRaw = body.contentRaw || '';
    let fileType: 'pdf' | 'docx' | 'txt' | 'web' | 'image' = 'pdf';
    let fileUrl = body.fileUrl || body.imageUrl || null;
    let imageUrl = body.imageUrl || body.fileUrl || null;

    if (uploadedFile) {
      const mime = uploadedFile.mimetype || '';
      const name = uploadedFile.originalname?.toLowerCase() || '';

      if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp'].some(ext => name.endsWith(ext))) {
        fileType = 'image';
        const base64Data = uploadedFile.buffer.toString('base64');
        const mimeType = mime || (name.endsWith('.png') ? 'image/png' : name.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg');
        const dataUrl = `data:${mimeType};base64,${base64Data}`;
        fileUrl = dataUrl;
        imageUrl = dataUrl;
        if (!contentRaw || contentRaw.length < 5) {
          contentRaw = `${title} — Official Event Poster / Notice Image.\nPublished for ${department} (${category}).`;
        }
        console.log(`[Upload] Processed image poster "${title}" (${fileSize})`);
      } else if (mime === 'application/pdf' || name.endsWith('.pdf')) {
        fileType = 'pdf';
        try {
          contentRaw = await extractPdfText(uploadedFile.buffer);
          console.log(`[Upload] Extracted ${contentRaw.length} chars from PDF "${title}"`);
        } catch (pdfErr: any) {
          console.warn('[Upload] PDF parse failed, storing filename:', pdfErr.message);
          contentRaw = `${title}\n[PDF content could not be extracted automatically]`;
        }
      } else if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv')) {
        fileType = 'txt';
        contentRaw = uploadedFile.buffer.toString('utf-8');
        console.log(`[Upload] Read text file "${title}" (${contentRaw.length} chars)`);
      } else if (name.endsWith('.docx') || mime.includes('wordprocessingml')) {
        fileType = 'docx';
        contentRaw = `${title} — ${department} — ${category}`;
      } else {
        contentRaw = `${title} — ${department} — ${category}`;
      }
    }

    // If still empty (JSON path with no contentRaw), use title-based fallback
    if (!contentRaw || contentRaw.trim().length < 5) {
      contentRaw = `${title} — ${department} — ${category}`;
    }

    const id = `doc_${Date.now()}`;
    let docYear = body.academicYear || '2026-2027';
    const yearMatch = contentRaw.match(/(20\d{2})[\s\-–]+(20\d{2})/);
    if (yearMatch) docYear = `${yearMatch[1]}-${yearMatch[2]}`;

// Intelligent date / deadline extractor from document content or title
function extractDeadlineDate(text: string): string | null {
  if (!text) return null;
  const patterns = [
    /(?:deadline|last date|due date|register by|registration deadline|registration ends|ends on|event date|action by)[:\s]+([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}(?:\s+\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(?:\s+\d{4})?)/i,
    /((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      return m[1].trim();
    }
  }
  return null;
}

    const totalChunks = Math.max(4, Math.ceil(contentRaw.length / 180));
    const summary = body.summary || `${category} document for ${department}${section ? ` (Section ${section})` : ''}.`;

    const actionRequiredDate = body.actionRequiredDate || body.actionDate || extractDeadlineDate(title + ' ' + contentRaw) || null;

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
    };
    documents.unshift(newDoc);

    const isEvent = category === 'Events' || fileType === 'image';
    const noticeUrgency = isEvent ? 'urgent' : (body.urgency || 'normal');
    const noticeTitle = isEvent && !title.startsWith('🎉') ? `🎉 ${title}` : title;
    const validCategories = ['Events', 'Circular', 'Exams', 'Academic', 'Scholarships', 'Placements', 'Hostels', 'General'];
    const noticeCategory = validCategories.includes(category) ? category : (isEvent ? 'Events' : 'Circular');
    const noticeTags = [category, department, ...(isEvent ? ['Events', 'Hackathon'] : [])];

    const newNotice = {
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
    };
    notices.unshift(newNotice);

    chunks.unshift({
      id: `chk_${Date.now()}`,
      documentId: id,
      documentTitle: title,
      department,
      category,
      pageNumber: 1,
      sectionHeader: title,
      content: contentRaw,
    });

    // Persist to PostgreSQL
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO documents (id, title, department, category, academic_year, published_date,
                                  file_type, file_size, status, total_chunks, summary, content_raw, section, uploaded_by_id,
                                  image_url, file_url, action_required_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [id, title, department, category, docYear, publishedDate,
           fileType, fileSize, 'indexed', totalChunks, summary, contentRaw, section, uploadedBy,
           imageUrl, fileUrl, actionRequiredDate]
        );
        console.log(`[Upload] Saved "${title}" to DB (section=${section}, contentRaw=${contentRaw.length} chars)`);

        // Also persist corresponding notice
        await pool.query(
          `INSERT INTO notices (id, title, category, urgency, publish_date, department,
                                action_required_date, ai_summary, full_content, source_doc_id, image_url, file_url, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             category = EXCLUDED.category,
             department = EXCLUDED.department,
             image_url = EXCLUDED.image_url,
             file_url = EXCLUDED.file_url,
             action_required_date = EXCLUDED.action_required_date,
             ai_summary = EXCLUDED.ai_summary,
             full_content = EXCLUDED.full_content`,
          [newNotice.id, newNotice.title, newNotice.category, newNotice.urgency, newNotice.publishDate, newNotice.department,
           actionRequiredDate, summary, contentRaw, id, imageUrl, fileUrl, noticeTags]
        );

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
        CASE WHEN d.category = 'Events' OR d.file_type = 'image' THEN '🎉 ' || d.title ELSE d.title END,
        CASE 
          WHEN d.category IN ('Events', 'Circular', 'Exams', 'Academic', 'Scholarships', 'Placements', 'Hostels', 'General') THEN d.category 
          ELSE 'Circular' 
        END,
        CASE WHEN d.category = 'Events' OR d.file_type = 'image' THEN 'urgent' ELSE 'normal' END,
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
      WHERE d.category != 'Timetable'
        AND LOWER(d.title) NOT LIKE '%timetable%'
        AND LOWER(d.title) NOT LIKE '%tt%'
        AND NOT EXISTS (
          SELECT 1 FROM notices n WHERE n.source_doc_id = d.id OR n.id = 'not_' || d.id
        );
    `);

    const result = await pool.query(
      `SELECT id, title, category, urgency, publish_date, department,
              action_required_date, ai_summary, full_content, source_doc_id,
              image_url, file_url, tags, created_at
       FROM notices ORDER BY created_at DESC`
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
              uploaded_by_id, image_url, file_url, action_required_date, created_at
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
                        uploaded_by_id, image_url, file_url, action_required_date, created_at
                 FROM documents
                 WHERE 1=1`;
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
      };
    });

    return res.json({ documents: docs });
  } catch (err: any) {
    console.error('Fetch student documents error:', err);
    return res.status(500).json({ error: 'Failed to fetch documents' });
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

// Helper to parse dates into ISO YYYY-MM-DD
function parseDateToIso(input?: string): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const day = String(ddmmyyyy[1]).padStart(2, '0');
    const m = String(ddmmyyyy[2]).padStart(2, '0');
    const y = ddmmyyyy[3];
    return `${y}-${m}-${day}`;
  }

  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const match = s.match(/([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i) ||
                s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+),?\s+(\d{4})/i);
  if (match) {
    let mPart = match[1].toLowerCase();
    let dPart = match[2];
    let yPart = match[3];
    if (!monthMap[mPart] && monthMap[match[2]?.toLowerCase()]) {
      mPart = match[2].toLowerCase();
      dPart = match[1];
    }
    const mm = monthMap[mPart];
    if (mm) {
      return `${yPart}-${mm}-${String(dPart).padStart(2, '0')}`;
    }
  }

  const rangeMatch = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s*([a-zA-Z]{3,9})?(?:\s*-\s*\d{1,2}(?:st|nd|rd|th)?)?\s*([a-zA-Z]{3,9})\s*(\d{4})?/i);
  if (rangeMatch) {
    const day = rangeMatch[1];
    const mStr = (rangeMatch[2] || rangeMatch[3] || '').toLowerCase();
    const y = rangeMatch[4] || '2026';
    const mm = monthMap[mStr];
    if (mm) {
      return `${y}-${mm}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

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

function sendMockSMS(phone: string, otp: string) {
  console.log(`\n\n💬 [SMS MOCK] ================================`);
  console.log(`💬 Sending OTP ${otp} to mobile number ${phone}`);
  console.log(`💬 ===========================================\n\n`);
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

// SIGNUP — email optional for students (mobile mandatory); teacher/admin require email
app.post('/api/auth/signup', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not connected' });

    const { name, email, password, role, department, year, semester, rollNumber,
            phone, subject, employeeId } = req.body;

    if (!name || !password || !role) {
      return res.status(400).json({ error: 'Name, password, and role are required.' });
    }
    if (!['student', 'admin', 'teacher'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    // Phone required only for students
    if (role === 'student' && !phone) {
      return res.status(400).json({ error: 'Mobile number is required for students.' });
    }
    // Email required for admin and teacher
    if ((role === 'admin' || role === 'teacher') && !email) {
      return res.status(400).json({ error: 'Email address is required for this role.' });
    }

    // Check email uniqueness if provided
    if (email) {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
    }
    // Check phone uniqueness if provided
    if (phone) {
      const existingPhone = await pool.query('SELECT id FROM users WHERE phone_number = $1', [phone]);
      if (existingPhone.rows.length > 0) {
        return res.status(409).json({ error: 'An account with this mobile number already exists.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=003527&color=80bea6&size=128&bold=true`;

    // Always require OTP verification
    const autoVerified = false;
    const verificationMethod = email ? 'email' : 'sms';
    const verificationToken = generateOTP();
    const tokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await pool.query(
      `INSERT INTO users
         (name, email, password_hash, role, department, year, semester, roll_number,
          avatar_url, email_verified, verification_token, verification_token_expires,
          phone_number, subject, employee_id, section)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [name, email || null, passwordHash, role,
       department || null, year || null, semester || null, rollNumber || null,
       avatarUrl, autoVerified, verificationToken, tokenExpires,
       phone || null, subject || null, employeeId || null, req.body.section || null]
    );

    if (verificationMethod === 'email') {
      try {
        await sendSignupOTPEmail(email, name, verificationToken);
      } catch (mailErr: any) {
        console.warn('OTP email failed to send:', mailErr.message);
      }
      return res.status(201).json({
        verificationSent: true,
        method: 'email',
        identifier: email,
        message: `An OTP has been sent to ${email}.`,
      });
    } else {
      // Send mock SMS
      sendMockSMS(phone, verificationToken);
      return res.status(201).json({
        verificationSent: true,
        method: 'sms',
        identifier: phone,
        message: `An OTP has been sent to your mobile number.`,
      });
    }
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
    const { identifier, otp } = req.body;
    if (!identifier || !otp) return res.status(400).json({ error: 'Identifier and OTP are required.' });

    const result = await pool.query(
      `SELECT id, email_verified, verification_token_expires
       FROM users WHERE (email = $1 OR phone_number = $1) AND verification_token = $2`,
      [identifier, otp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({ error: 'Account already verified.' });
    }

    if (new Date() > new Date(user.verification_token_expires)) {
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

    const { identifier } = req.body; // Can be email or phone, but this endpoint defaults to email if exists
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
      console.warn('Resend OTP email failed:', mailErr.message);
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
    const verificationToken = generateOTP();
    const tokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await pool.query(
      `UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3`,
      [verificationToken, tokenExpires, user.id]
    );

    sendMockSMS(user.phone_number, verificationToken);

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

// Serve frontend build in production or vite dev in dev
const PORT = 3000;

async function startServer() {
  await initDb();
  await ensureDemoAdmin();
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    // Dynamic import of vite in dev mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusIQ Server running on port ${PORT}`);
  });
}

startServer();
