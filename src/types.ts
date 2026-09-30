export type UserRole = 'student' | 'admin' | 'teacher';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  department?: string;
  year?: string;
  semester?: string;
  rollNumber?: string;
  section?: string;
  phone?: string;
  subject?: string;
  employeeId?: string;
}



export interface StudentProfile {
  id: string;
  name: string;
  avatar: string;
  program: string;
  department: string;
  year: string;
  semester: string;
  rollNumber: string;
  section?: string;
  attendancePercent: number;
  cgpa: number;
  maxCgpa: number;
  cgpaTrend: string;
  nextClass: {
    code: string;
    name: string;
    time: string;
    room: string;
    instructor: string;
    syllabusUrl?: string;
  };
}

export type NoticeCategory = 'All' | 'Events' | 'Circular' | 'Exams' | 'Academic' | 'Scholarships' | 'Placements' | 'Hostels' | 'General';

export interface Notice {
  id: string;
  title: string;
  category: 'Events' | 'Circular' | 'Exams' | 'Academic' | 'Scholarships' | 'Placements' | 'Hostels' | 'General';
  urgency: 'urgent' | 'high' | 'normal' | 'info';
  publishDate: string;
  department: string;
  actionRequiredDate?: string;
  aiSummary: string;
  fullContent: string;
  sourceDocId?: string;
  attachmentName?: string;
  imageUrl?: string;
  fileUrl?: string;
  tags: string[];
  readByStudent?: boolean;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  department: string;
  category: string;
  pageNumber: number;
  content: string;
  sectionHeader: string;
  similarityScore?: number;
}

export interface CollegeDocument {
  id: string;
  title: string;
  department: string;
  category: 'Syllabus' | 'Regulations' | 'Circular' | 'Handbook' | 'Financial Aid' | 'Placements' | 'Hostel' | 'Timetable' | 'Events' | 'Exams';
  academicYear: string;
  publishedDate: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'web' | 'image';
  fileSize: string;
  status: 'indexed' | 'processing' | 'conflict_detected' | 'review_needed';
  totalChunks: number;
  sourceUrl?: string;
  fileUrl?: string;
  imageUrl?: string;
  summary: string;
  contentRaw: string;
  section?: string;
  uploadedBy?: string;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  department: string;
  pageNumber: number;
  sectionHeader: string;
  exactQuote: string;
  confidence: number;
}

export interface RAGQueryResponse {
  answer: string;
  citations: Citation[];
  groundedAnswerRate: number;
  confidenceScore: number;
  isGrounded: boolean;
  needsReview: boolean;
  escalationNeeded: boolean;
  conflictDetected?: {
    topic: string;
    conflictingDocs: {
      docA: { title: string; version: string; date: string; quote: string };
      docB: { title: string; version: string; date: string; quote: string };
    };
  };
  suggestedFollowUps: string[];
}

export interface ConflictItem {
  id: string;
  topic: string;
  courseOrDept: string;
  detectedAt: string;
  status: 'pending' | 'resolved';
  resolutionNotes?: string;
  docA: {
    title: string;
    version: string;
    date: string;
    text: string;
    highlight: string;
  };
  docB: {
    title: string;
    version: string;
    date: string;
    text: string;
    highlight: string;
  };
}

export interface QueryLogItem {
  id: string;
  timestamp: string;
  query: string;
  status: 'grounded' | 'review_needed' | 'escalated';
  confidence: number;
  sourceDoc?: string;
  ticketId?: string;
  studentName?: string;
}

export interface DeadlineItem {
  id: string;
  title: string;
  dateStr: string; // e.g. "Aug 25"
  daysRemaining: number;
  urgency: 'high' | 'medium' | 'normal';
  category: string;
  description: string;
}
