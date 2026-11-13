import React, { useState, useEffect, useRef } from 'react';
import { apiFetch as fetch } from '../lib/api';
import { CollegeDocument } from '../types';
import { AuthUser } from '../types';
import { TextNoticeUpload } from './TextNoticeUpload';
import { TextStudentGuideUpload } from './TextStudentGuideUpload';

interface UploadDocumentProps {
  onDocumentAdded: (doc: CollegeDocument) => void;
  onDocumentDeleted?: (docId: string) => void;
  onNavigateTab: (tab: string) => void;
  user?: AuthUser;
}

const PdfViewer = ({ fileSource, title }: { fileSource: string; title: string }) => {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (fileSource.startsWith('data:application/pdf;base64,')) {
      try {
        const base64Data = fileSource.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        setBlobUrl(fileSource);
      }
    } else {
      setBlobUrl(fileSource);
    }
  }, [fileSource]);

  if (!blobUrl) return <div className="p-4 text-center text-white">Loading PDF...</div>;

  return (
    <iframe
      src={blobUrl}
      title={title}
      className="w-full h-full rounded-xl"
      style={{ minHeight: '480px', border: 'none' }}
    />
  );
};

type UploadView = 'upload' | 'text-notice' | 'text-guide' | 'materials' | 'ai-bucket';

export const UploadDocument: React.FC<UploadDocumentProps> = ({
  onDocumentAdded,
  onDocumentDeleted,
  onNavigateTab,
  user,
}) => {
  const [activeView, setActiveView] = useState<UploadView>('upload');
  const [targetBucket, setTargetBucket] = useState<'dashboard' | 'ai_bucket' | 'student_guide'>('dashboard');
  const [guideDraftContent, setGuideDraftContent] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; size: string } | null>(null);
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState(user?.department || 'Computer Science & Engineering');
  const [category, setCategory] = useState<'Events' | 'Circular' | 'Exams' | 'Syllabus' | 'Regulations' | 'Handbook' | 'Financial Aid' | 'Scholarships' | 'Timetable' | 'Placements'>('Syllabus');
  const [section, setSection] = useState('');
  const [publishedDate, setPublishedDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionRequiredDate, setActionRequiredDate] = useState('');
  const [audience, setAudience] = useState<'all' | 'branch'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewingUpload, setPreviewingUpload] = useState(false); // pre-publish preview modal
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null); // for PDF preview
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null); // high-performance blob preview URL
  const [lastUploadedDoc, setLastUploadedDoc] = useState<CollegeDocument | null>(null); // for post-success actions

  // Uploaded materials list
  const [uploadedDocs, setUploadedDocs] = useState<CollegeDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<CollegeDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<CollegeDocument | null>(null);

  // Fetch uploaded documents from DB
  const fetchUploadedDocs = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (data.documents) {
        setUploadedDocs(data.documents);
      }
    } catch {
      // offline - ignore
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (activeView === 'materials') {
      fetchUploadedDocs();
    }
  }, [activeView]);

  const checkImageBlankness = (fileObj: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(fileObj);
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 40;
          canvas.height = 40;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(false);
          ctx.drawImage(img, 0, 0, 40, 40);
          const data = ctx.getImageData(0, 0, 40, 40).data;
          let sum = 0;
          let sumSq = 0;
          const count = 40 * 40;
          for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
            sum += brightness;
            sumSq += brightness * brightness;
          }
          const mean = sum / count;
          const variance = (sumSq / count) - (mean * mean);
          if (variance < 3) {
            resolve(true); // blank solid color
          } else {
            resolve(false);
          }
        } catch {
          resolve(false);
        }
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });
  };

  const processSelectedFile = (selected: File) => {
    setUploadError(null);

    if (selected.size === 0) {
      setUploadError('Selected file is empty (0 bytes). Please select a valid document.');
      return;
    }

    if (/(selfie|portrait|profile[-_]?pic|snapchat|whatsapp[-_]?image|meme|wallpaper|vacation|trip|food[-_]?pic|party|cat[-_]?pic|dog[-_]?pic)/i.test(selected.name)) {
      setUploadError('Warning: This file appears to be a personal photo or meme. The system only accepts official college notices, circulars, and academic event posters.');
    }

    setSelectedFileObj(selected);
    setGuideDraftContent(null);
    setFile({
      name: selected.name,
      size: `${(selected.size / (1024 * 1024)).toFixed(1)} MB`,
    });
    setTitle(selected.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));

    const isImg = selected.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(selected.name);
    const isPdf = selected.type === 'application/pdf' || /\.pdf$/i.test(selected.name);
    const isTimetableFile = /timetable|schedule|time table/i.test(selected.name);
    const isExamFile = /exam|midterm|test|endsem/i.test(selected.name);

    if (isExamFile) {
      setCategory('Exams');
    } else if (isTimetableFile) {
      setCategory('Timetable');
    } else if (isImg) {
      setCategory('Events');
    }

    // Generate fast local blob URL for instant zero-lag preview
    if (previewBlobUrl) {
      try { URL.revokeObjectURL(previewBlobUrl); } catch {}
    }
    const blobUrl = URL.createObjectURL(selected);
    setPreviewBlobUrl(blobUrl);

    if (isImg) {
      checkImageBlankness(selected).then((isBlank) => {
        if (isBlank) {
          setUploadError('The selected image appears to be completely blank or empty. Please select a valid event poster or document.');
        }
      });
      setImagePreviewUrl(blobUrl);
      setPdfPreviewUrl(null);
    } else if (isPdf) {
      setImagePreviewUrl(null);
      setPdfPreviewUrl(blobUrl);
    } else {
      setImagePreviewUrl(null);
      setPdfPreviewUrl(null);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setUploadError('Please enter a document title.');
      return;
    }
    if (!/^[a-zA-Z]/.test(trimmedTitle)) {
      setUploadError('Document title must begin with an alphabet letter.');
      return;
    }
    if (trimmedTitle.length < 3) {
      setUploadError('Document title must be at least 3 characters long.');
      return;
    }

    const fileToUpload = selectedFileObj || fileInputRef.current?.files?.[0];
    if (!fileToUpload) {
      setUploadError('Please select a document or poster file to upload.');
      return;
    }
    if (fileToUpload.size === 0) {
      setUploadError('The uploaded file is empty (0 bytes). Please select a valid document.');
      return;
    }

    setIsProcessing(true);

    const isImg = fileToUpload.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(fileToUpload.name);

    // Build a local doc object for optimistic UI update
    const activeFileUrl = previewBlobUrl || pdfPreviewUrl || imagePreviewUrl || undefined;
    const localDoc: CollegeDocument = {
      id: `doc_${Date.now()}`,
      title: trimmedTitle,
      department,
      category,
      academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      publishedDate,
      fileType: isImg ? 'image' : 'pdf',
      fileSize: file?.size || `${(fileToUpload.size / (1024 * 1024)).toFixed(1)} MB`,
      status: 'indexed',
      totalChunks: 24,
      imageUrl: imagePreviewUrl || (isImg ? activeFileUrl : undefined),
      fileUrl: activeFileUrl,
      summary: `${category} uploaded for ${department}${section ? ` Section ${section}` : ''}.`,
      contentRaw: `${trimmedTitle} — ${department} — ${category}`,
      section: section || undefined,
      uploadedBy: user?.id,
      actionRequiredDate: actionRequiredDate.trim() || undefined,
    } as any;

    try {
      let serverDoc = localDoc;

      // Send the actual file via multipart/form-data
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('title', trimmedTitle);
      formData.append('department', department);
      formData.append('category', category);
      formData.append('section', section);
      formData.append('publishedDate', publishedDate);
      formData.append('uploadedBy', user?.id || '');
      if (actionRequiredDate.trim()) {
        formData.append('actionRequiredDate', actionRequiredDate.trim());
      }
      formData.append('targetBucket', targetBucket);
      if (targetBucket === 'student_guide' && guideDraftContent === null) {
        formData.append('previewOnly', 'true');
      } else if (targetBucket === 'student_guide') {
        formData.append('approvedContent', guideDraftContent);
      }

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setUploadError(data.error || 'Document rejected: verification failed.');
        setIsProcessing(false);
        return;
      }

      if (data.preview) {
        setGuideDraftContent(data.extractedContent || '');
        return;
      }

      if (data.document) {
        serverDoc = {
          ...localDoc,
          ...data.document,
          imageUrl: data.document.imageUrl || imagePreviewUrl || (isImg ? activeFileUrl : undefined),
          fileUrl: data.document.fileUrl || activeFileUrl || undefined,
        };
      }

      onDocumentAdded(serverDoc);
      setLastUploadedDoc(serverDoc); // remember for post-success preview/delete
      setIsSuccess(true);
      setFile(null);
      setSelectedFileObj(null);
      setImagePreviewUrl(null);
      setTitle('');
      setSection('');
      setActionRequiredDate('');
      setGuideDraftContent(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.warn('Upload network error:', err);
      setUploadError('Failed to upload document due to network issue. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    setDeletingId(docId);
    try {
      await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      setUploadedDocs(prev => prev.filter(d => d.id !== docId));
      onDocumentDeleted?.(docId);
    } catch {
      alert('Failed to delete. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Timetable': return 'calendar_today';
      case 'Syllabus': return 'menu_book';
      case 'Circular': return 'campaign';
      case 'Handbook': return 'book';
      case 'Regulations': return 'gavel';
      case 'Financial Aid': return 'payments';
      default: return 'description';
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Timetable': return 'bg-blue-100 text-blue-700';
      case 'Syllabus': return 'bg-[#b0f0d6] text-[#003527]';
      case 'Circular': return 'bg-amber-100 text-amber-700';
      case 'Handbook': return 'bg-purple-100 text-purple-700';
      case 'Regulations': return 'bg-red-100 text-red-700';
      case 'Financial Aid': return 'bg-green-100 text-green-700';
      default: return 'bg-[#e5eeff] text-[#0b1c30]';
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#f4f7ff] text-[#0b1c30] pt-[64px] pb-16">
      <div className="max-w-[1200px] w-full mx-auto px-4 md:px-6">

        {/* Header */}
        <div className="mb-8 pt-8 pb-6 border-b border-[#bfc9c3]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-[#0b1c30]">
              Document Management
            </h1>
            <p className="text-sm md:text-base text-[#404944] mt-1">
              Upload and manage institutional documents for students.
            </p>
          </div>
          {/* View toggle */}
          <div className="flex bg-white rounded-2xl p-1 border border-[#bfc9c3]/30 shadow-xs gap-1 flex-wrap">
            <button
              onClick={() => { setActiveView('upload'); setTargetBucket('dashboard'); setUploadError(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                ${activeView === 'upload'
                  ? 'bg-[#003527] text-white shadow-sm'
                  : 'text-[#9ca8a3] hover:text-[#003527]'}`}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Upload Document / Poster
            </button>
            <button
              onClick={() => { setActiveView('text-notice'); setUploadError(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                ${activeView === 'text-notice'
                  ? 'bg-[#003527] text-white shadow-sm'
                  : 'text-[#9ca8a3] hover:text-[#003527]'}`}
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              Publish Text Notice
            </button>
            <button
              onClick={() => { setActiveView('text-guide'); setUploadError(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                ${activeView === 'text-guide'
                  ? 'bg-[#003527] text-white shadow-sm'
                  : 'text-[#9ca8a3] hover:text-[#003527]'}`}
            >
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              Text Student Guide
            </button>
            <button
              onClick={() => { setActiveView('materials'); setUploadError(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                ${activeView === 'materials'
                  ? 'bg-[#003527] text-white shadow-sm'
                  : 'text-[#9ca8a3] hover:text-[#003527]'}`}
            >
              <span className="material-symbols-outlined text-[18px]">folder_open</span>
              Uploaded Materials
            </button>
            <button
              onClick={() => { setActiveView('ai-bucket'); setTargetBucket('ai_bucket'); setUploadError(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                ${activeView === 'ai-bucket'
                  ? 'bg-[#003527] text-white shadow-sm'
                  : 'text-[#003527] bg-[#e8f5ef] hover:bg-[#d1fae5]'}`}
            >
              <span className="material-symbols-outlined text-[18px]">psychology</span>
              🧠 AI Knowledge Bucket
            </button>
          </div>
        </div>

        {/* Verification Error Alert */}
        {uploadError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-start justify-between animate-fade-in shadow-xs">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[24px] text-red-600 mt-0.5">error</span>
              <div>
                <p className="font-bold text-sm">Document Verification Failed</p>
                <p className="text-xs text-red-700 mt-0.5">{uploadError}</p>
              </div>
            </div>
            <button
              onClick={() => setUploadError(null)}
              className="text-xs font-bold text-red-600 hover:text-red-800 px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── TEXT NOTICE VIEW ─── */}
        {activeView === 'text-notice' && (
          <TextNoticeUpload
            user={user}
            onDocumentAdded={(doc) => {
              onDocumentAdded(doc);
              setUploadedDocs(prev => [doc, ...prev]);
            }}
            onViewMaterials={() => setActiveView('materials')}
          />
        )}

        {activeView === 'text-guide' && (
          <TextStudentGuideUpload
            user={user}
            onDocumentAdded={(doc) => {
              onDocumentAdded(doc);
              setUploadedDocs(prev => [doc, ...prev.filter(item => item.id !== doc.id)]);
            }}
            onViewMaterials={() => setActiveView('materials')}
          />
        )}

        {/* ─── UPLOAD VIEW ─── */}
        {activeView === 'upload' && (
          <>
            {/* Success Alert */}
            {isSuccess && (
              <div className="mb-8 p-5 rounded-2xl bg-[#b0f0d6]/70 border border-[#003527]/30 text-[#002117] animate-fade-in shadow-xs">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[28px] text-[#003527]">check_circle</span>
                    <div>
                      <p className="font-bold text-sm">Document Published Successfully!</p>
                      <p className="text-xs text-[#003527] mt-0.5">
                        Students in the matching section can now view this document on their dashboard.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSuccess(false)}
                    className="shrink-0 text-[#003527] hover:text-[#002117] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                {/* Post-upload action buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Preview the just-uploaded doc */}
                  {lastUploadedDoc && (
                    <button
                      onClick={() => setViewingDoc(lastUploadedDoc)}
                      className="flex items-center gap-1.5 bg-white border border-[#003527]/30 text-[#003527] text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-[#f0fdf4] transition-colors shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      Preview Uploaded Doc
                    </button>
                  )}
                  {/* Replace — upload a new file */}
                  <label
                    htmlFor="document-file-input"
                    className="flex items-center gap-1.5 bg-white border border-[#bfc9c3]/50 text-[#5a6672] text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-[#f4f7ff] transition-colors shadow-xs cursor-pointer"
                    title="Upload another document to replace this one"
                  >
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    Upload Another
                  </label>
                  {/* Delete the just-uploaded doc */}
                  {lastUploadedDoc && (
                    <button
                      onClick={async () => {
                        if (!confirm('Delete the document you just uploaded?')) return;
                        await fetch(`/api/documents/${lastUploadedDoc.id}`, { method: 'DELETE' });
                        onDocumentDeleted?.(lastUploadedDoc.id);
                        setUploadedDocs(prev => prev.filter(d => d.id !== lastUploadedDoc.id));
                        setLastUploadedDoc(null);
                        setIsSuccess(false);
                      }}
                      className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition-colors shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Delete This Doc
                    </button>
                  )}
                  <button
                    onClick={() => { setActiveView('materials'); setIsSuccess(false); }}
                    className="flex items-center gap-1.5 bg-[#003527] text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-[#064e3b] transition-colors shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">folder_open</span>
                    View All Materials
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* Left: Drop Zone */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className="bg-white rounded-3xl p-10 border-2 border-dashed border-[#80bea6] hover:border-[#003527] transition-all flex flex-col items-center justify-center text-center group cursor-pointer shadow-xs"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="document-file-input"
                    className="hidden"
                    accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg"
                    onChange={handleFileSelect}
                  />
                  <label htmlFor="document-file-input" className="cursor-pointer flex flex-col items-center">
                    <div className="w-20 h-20 rounded-3xl bg-[#eff4ff] group-hover:bg-[#dce9ff] text-[#003527] flex items-center justify-center mb-5 transition-colors shadow-sm">
                      <span className="material-symbols-outlined text-[40px]">upload_file</span>
                    </div>
                    <h3 className="font-headline font-bold text-xl text-[#0b1c30] mb-2">
                      Drag & Drop Document Here
                    </h3>
                    <p className="text-sm text-[#404944] mb-5">
                      Supports PDF, DOCX, TXT, JPG, PNG, and other images up to 50MB
                    </p>
                    <span className="bg-[#003527] text-white text-sm font-bold px-6 py-3 rounded-xl shadow-xs group-hover:bg-[#064e3b] transition-colors">
                      Browse Local Files
                    </span>
                  </label>

                  {/* Selected File Badge */}
                  {file && (
                    <div className="mt-6 w-full p-4 bg-[#f0fdf4] rounded-xl border border-[#b0f0d6] text-left">
                      {/* File info row */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#b0f0d6] flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[#003527] text-[20px]">
                            {imagePreviewUrl ? 'image' : 'picture_as_pdf'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#0b1c30] truncate">{file.name}</p>
                          <p className="text-xs text-[#707974]">{file.size} · Ready to publish</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-[#003527] bg-[#b0f0d6] px-3 py-1 rounded-full">
                          ✓ Selected
                        </span>
                      </div>

                      {/* Thumbnail strip for images */}
                      {imagePreviewUrl && (
                        <div className="mb-3 rounded-xl overflow-hidden border border-[#b0f0d6] bg-[#0b1c30] flex items-center justify-center" style={{ maxHeight: '140px' }}>
                          <img
                            src={imagePreviewUrl}
                            alt="Preview"
                            className="max-h-[136px] w-auto object-contain"
                          />
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {/* Preview full size (image or PDF) */}
                        {(imagePreviewUrl || pdfPreviewUrl || previewBlobUrl) && (
                          <button
                            type="button"
                            onClick={() => setPreviewingUpload(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#003527] text-white text-xs font-bold hover:bg-[#064e3b] transition-colors shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            Preview Document
                          </button>
                        )}
                        {/* Replace file */}
                        <label
                          htmlFor="document-file-input"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#bfc9c3]/50 text-[#5a6672] text-xs font-bold hover:bg-[#f4f7ff] transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
                          Change File
                        </label>
                        {/* Remove / clear selection */}
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            setSelectedFileObj(null);
                            setImagePreviewUrl(null);
                            setPdfPreviewUrl(null);
                            setUploadError(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info card */}
                <div className="bg-white rounded-2xl p-5 border border-[#bfc9c3]/30 shadow-xs">
                  <h3 className="font-headline font-bold text-sm text-[#0b1c30] mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#003527] text-[18px]">info</span>
                    How Document Publishing Works
                  </h3>
                  <div className="space-y-2">
                    {[
                      { icon: 'public', text: '"All Students" makes the document visible to every student centrally' },
                      { icon: 'school', text: '"Specific Branch" targets only students in that department/section' },
                      { icon: 'visibility', text: 'Uploaded documents appear highlighted on the student dashboard immediately' },
                      { icon: 'image', text: 'Supports PDFs, images (JPG, PNG), DOCX, and text files' },
                      { icon: 'sync', text: 'Documents are fetched in real-time — no refresh needed' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[#003527] text-[16px] mt-0.5">{item.icon}</span>
                        <p className="text-xs text-[#5a6672]">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Metadata Form */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-white rounded-3xl p-6 border border-[#bfc9c3]/30 shadow-xs">
                  <h3 className="font-headline font-bold text-lg text-[#0b1c30] mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#855300]">tune</span>
                    Document Details
                  </h3>

                  <form onSubmit={handleUpload} className="space-y-4">
                    {/* Title */}
                    <div>
                      <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                        Document Title *
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        placeholder="e.g. B.Tech CSE Section B Timetable"
                        className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                      />
                    </div>



                    {/* Category */}
                    <div>
                      <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as any)}
                        className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                      >
                        <option value="Events">🎉 Event / Poster</option>
                        <option value="Circular">📢 Circular</option>
                        <option value="Exams">📝 Exams / Notice</option>
                        <option value="Timetable">🗓 Timetable / Schedule</option>
                        <option value="Syllabus">📘 Syllabus</option>
                        <option value="Handbook">📖 Handbook</option>
                        <option value="Regulations">⚖️ Regulations</option>
                        <option value="Scholarships">🎓 Scholarships</option>
                        <option value="Placements">💼 Placements</option>
                        <option value="Financial Aid">💰 Financial Aid</option>
                      </select>
                    </div>

                    {/* Audience Targeting */}
                    <div>
                      <label className="block text-xs font-bold text-[#404944] uppercase mb-2">
                        Publish For
                      </label>
                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => { setAudience('all'); setSection(''); setDepartment('General Academic'); }}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border-2 transition-all
                            ${audience === 'all'
                              ? 'bg-[#003527] text-white border-[#003527]'
                              : 'bg-white text-[#5a6672] border-[#bfc9c3]/40 hover:border-[#003527]/30'}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">public</span>
                          All Students
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAudience('branch'); setDepartment(user?.department || 'Computer Science & Engineering'); }}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border-2 transition-all
                            ${audience === 'branch'
                              ? 'bg-[#003527] text-white border-[#003527]'
                              : 'bg-white text-[#5a6672] border-[#bfc9c3]/40 hover:border-[#003527]/30'}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">school</span>
                          Specific Branch
                        </button>
                      </div>
                      {audience === 'all' && (
                        <p className="text-[10px] text-[#003527] bg-[#b0f0d6]/30 px-3 py-1.5 rounded-lg font-medium">
                          📢 This document will be visible to ALL students across every department.
                        </p>
                      )}
                    </div>

                    {/* Department — only when branch-specific */}
                    {audience === 'branch' && (
                      <div>
                        <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                          Department / Branch
                        </label>
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                        >
                          <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                          <option value="Examination Cell">Examination Cell</option>
                          <option value="Dean of Students & Senate">Dean of Students & Senate</option>
                          <option value="Bursar & Financial Aid Office">Bursar & Financial Aid Office</option>
                          <option value="Centre for Career Development">Centre for Career Development</option>
                          <option value="Mechanical Engineering">Mechanical Engineering</option>
                          <option value="Electrical Engineering">Electrical Engineering</option>
                          <option value="Civil Engineering">Civil Engineering</option>
                          <option value="Electronics & Communication">Electronics & Communication</option>
                        </select>
                      </div>
                    )}

                    {/* Section — optional, only when branch-specific */}
                    {audience === 'branch' && (
                      <div>
                        <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                          Class Section
                          <span className="ml-1 text-[#9ca8a3] normal-case font-normal tracking-normal">(blank = all sections in this branch)</span>
                        </label>
                        <input
                          type="text"
                          value={section}
                          onChange={(e) => setSection(e.target.value.toUpperCase())}
                          placeholder="e.g. A, B, TY-A — blank means all sections"
                          className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                        />
                      </div>
                    )}


                    {/* Destination: notice board, AI-only, or reviewed student guide */}
                    <div>
                      <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5 flex items-center justify-between">
                        <span>Publish Target</span>
                        <span className="text-[10px] text-[#003527] font-semibold">
                          {targetBucket === 'dashboard'
                            ? '📢 Notice Board + AI'
                            : targetBucket === 'ai_bucket' ? '🧠 AI Knowledge Bucket Only' : '📘 Student Guide + AI'}
                        </span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => { setTargetBucket('dashboard'); setGuideDraftContent(null); }}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            targetBucket === 'dashboard'
                              ? 'border-[#003527] bg-[#eff4ff] text-[#003527] font-bold shadow-xs'
                              : 'border-[#bfc9c3]/40 bg-white text-[#5a6672] hover:bg-[#f8f9ff]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs mb-1">
                            <span className="material-symbols-outlined text-[16px]">campaign</span>
                            Notice Board
                          </div>
                          <p className="text-[10px] text-[#707974] font-normal leading-tight">
                            Shows on Dashboard & trains AI
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setTargetBucket('ai_bucket'); setGuideDraftContent(null); }}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            targetBucket === 'ai_bucket'
                              ? 'border-[#003527] bg-[#e8f5ef] text-[#003527] font-bold shadow-xs'
                              : 'border-[#bfc9c3]/40 bg-white text-[#5a6672] hover:bg-[#f8f9ff]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs mb-1">
                            <span className="material-symbols-outlined text-[16px]">psychology</span>
                            AI Bucket Only
                          </div>
                          <p className="text-[10px] text-[#707974] font-normal leading-tight">
                            Direct AI brain (keeps dashboard clean)
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setTargetBucket('student_guide'); setGuideDraftContent(null); }}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            targetBucket === 'student_guide'
                              ? 'border-[#003527] bg-[#fff8e7] text-[#003527] font-bold shadow-xs'
                              : 'border-[#bfc9c3]/40 bg-white text-[#5a6672] hover:bg-[#f8f9ff]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs mb-1">
                            <span className="material-symbols-outlined text-[16px]">menu_book</span>
                            Student Guide
                          </div>
                          <p className="text-[10px] text-[#707974] font-normal leading-tight">
                            Review extracted text; show in What to Know and AI, not as a notice
                          </p>
                        </button>
                      </div>
                    </div>

                    {targetBucket === 'student_guide' && guideDraftContent === null && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                        Automatic reading uses the backend Gemini AI key. The file is not published yet; select <strong>Extract &amp; Review Guide</strong> to read it and preview the recognized text first.
                      </div>
                    )}
                    {targetBucket === 'student_guide' && guideDraftContent !== null && (
                      <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                        <label htmlFor="guide-extracted-content" className="block text-xs font-bold text-[#003527]">
                          Review and correct extracted guide text
                        </label>
                        <p className="text-[11px] leading-relaxed text-[#53645c]">
                          Check every eligibility group, document name, amount, and date against the original. Only the text you approve will be published.
                        </p>
                        {!guideDraftContent.trim() && (
                          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                            No text was extracted automatically. Enter the checklist from the original image below; at least 15 characters are required.
                          </p>
                        )}
                        <textarea
                          id="guide-extracted-content"
                          value={guideDraftContent}
                          onChange={event => setGuideDraftContent(event.target.value)}
                          maxLength={20000}
                          minLength={15}
                          required
                          rows={10}
                          className="w-full resize-y rounded-xl border border-emerald-200 bg-white p-3 text-xs leading-relaxed text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003527]/20"
                        />
                        <p className="text-right text-[10px] text-[#707974]">
                          {guideDraftContent.length}/20000 characters
                        </p>
                      </div>
                    )}

                    {/* Published Date */}
                    <div>
                      <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
                        Published Date
                      </label>
                      <input
                        type="date"
                        value={publishedDate}
                        onChange={(e) => setPublishedDate(e.target.value)}
                        className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                      />
                    </div>

                    {/* Action Required Deadline Date (Optional) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-[#404944] uppercase">
                          Action Required Deadline
                        </label>
                        <span className="text-[10px] text-[#707974] font-medium lowercase">
                          (optional — leave blank if no deadline)
                        </span>
                      </div>
                      <input
                        type="date"
                        value={actionRequiredDate}
                        onChange={(e) => setActionRequiredDate(e.target.value)}
                        className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                      />
                      <p className="text-[10px] text-[#707974] mt-1">
                        If set, this deadline appears in Upcoming Deadlines. If left blank, no date is shown.
                      </p>
                    </div>

                    {/* Actions: Preview & Publish Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (file || selectedFileObj) {
                            setPreviewingUpload(true);
                          } else {
                            fileInputRef.current?.click();
                          }
                        }}
                        id="preview-doc-form-btn"
                        className="flex-1 py-3.5 px-4 rounded-xl border-2 border-[#003527] text-[#003527] bg-[#eff4ff]/60 hover:bg-[#eff4ff] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                        title="Preview the document before publishing"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                        Preview Document
                      </button>
                      <button
                        type="submit"
                        disabled={isProcessing}
                        id="publish-doc-btn"
                        className="flex-[1.5] bg-[#003527] hover:bg-[#064e3b] disabled:bg-[#bfc9c3] text-white font-bold text-xs py-3.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all"
                      >
                        {isProcessing ? (
                          <>
                            <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                            Scanning & Verifying…
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">
                              {targetBucket === 'ai_bucket' ? 'psychology' : targetBucket === 'student_guide' ? 'fact_check' : 'publish'}
                            </span>
                            {targetBucket === 'ai_bucket'
                              ? '🧠 Train & Save to AI Bucket'
                              : targetBucket === 'student_guide'
                                ? guideDraftContent === null ? 'Extract & Review Guide' : 'Approve & Publish Student Guide'
                                : 'Publish to Dashboard'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ─── UPLOADED MATERIALS VIEW ─── */}
        {activeView === 'materials' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-headline font-bold text-xl text-[#0b1c30]">Uploaded Materials</h2>
                <p className="text-sm text-[#9ca8a3] mt-1">All documents published to the student knowledge base</p>
              </div>
              <button
                onClick={fetchUploadedDocs}
                disabled={loadingDocs}
                className="flex items-center gap-2 text-xs font-bold text-[#003527] bg-[#eff4ff] hover:bg-[#dce9ff] px-4 py-2 rounded-xl transition-colors"
              >
                <span className={`material-symbols-outlined text-[16px] ${loadingDocs ? 'animate-spin' : ''}`}>refresh</span>
                Refresh
              </button>
            </div>

            {loadingDocs ? (
              <div className="flex flex-col items-center justify-center py-20">
                <span className="material-symbols-outlined text-[48px] text-[#003527] animate-spin mb-4">sync</span>
                <p className="text-sm text-[#9ca8a3]">Loading documents…</p>
              </div>
            ) : uploadedDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-[#bfc9c3]/30">
                <div className="w-20 h-20 rounded-3xl bg-[#eff4ff] flex items-center justify-center mb-5">
                  <span className="material-symbols-outlined text-[40px] text-[#003527]">folder_open</span>
                </div>
                <h3 className="font-headline font-bold text-lg text-[#0b1c30] mb-2">No Documents Yet</h3>
                <p className="text-sm text-[#9ca8a3] mb-6">Upload your first document to get started.</p>
                <button
                  onClick={() => setActiveView('upload')}
                  className="bg-[#003527] text-white text-sm font-bold px-6 py-3 rounded-xl"
                >
                  Upload Document
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {uploadedDocs.map(doc => (
                  <div
                    key={doc.id}
                    className="bg-white rounded-2xl border border-[#bfc9c3]/30 shadow-xs hover:shadow-md transition-all overflow-hidden group"
                  >
                    {/* Top color strip by category */}
                    <div className={`h-1.5 w-full ${
                      doc.category === 'Timetable' ? 'bg-blue-500' :
                      doc.category === 'Syllabus' ? 'bg-[#003527]' :
                      doc.category === 'Circular' ? 'bg-amber-500' :
                      doc.category === 'Regulations' ? 'bg-red-500' :
                      'bg-[#9ca8a3]'
                    }`} />

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#eff4ff] flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[#003527] text-[20px]">
                            {getCategoryIcon(doc.category)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-[#0b1c30] leading-snug line-clamp-2">{doc.title}</h4>
                          <p className="text-[11px] text-[#9ca8a3] mt-0.5">{doc.department}</p>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getCategoryColor(doc.category)}`}>
                          {doc.category}
                        </span>
                        {doc.section ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#003527] text-white">
                            Section {doc.section}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e5eeff] text-[#0b1c30]">
                            All Sections
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f4f7ff] text-[#9ca8a3]">
                          {doc.academicYear}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-2 text-[11px] text-[#9ca8a3] mb-4">
                        <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                        <span>{doc.publishedDate}</span>
                        <span className="mx-1">·</span>
                        <span className="material-symbols-outlined text-[13px]">folder</span>
                        <span>{doc.fileSize}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 border-t border-[#bfc9c3]/20 pt-4">
                        <button
                          onClick={() => setViewingDoc(doc)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#eff4ff] hover:bg-[#dce9ff] text-[#003527] text-xs font-bold transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          View
                        </button>
                        <button
                          onClick={() => setEditingDoc(doc)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#f8f9ff] hover:bg-[#eff4ff] text-[#5a6672] text-xs font-bold transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          disabled={deletingId === doc.id}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {deletingId === doc.id ? (
                            <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                          ) : (
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── AI KNOWLEDGE BUCKET VIEW ─── */}
        {activeView === 'ai-bucket' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-headline font-bold text-xl text-[#0b1c30] flex items-center gap-2">
                  <span>🧠</span> AI Knowledge Bucket
                </h2>
                <p className="text-sm text-[#707974] mt-0.5">
                  Reference documents powering the chatbot (hidden from student dashboard notices).
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('upload');
                    setTargetBucket('ai_bucket');
                  }}
                  className="inline-flex items-center gap-1.5 bg-[#003527] hover:bg-[#064e3b] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  Upload to AI Bucket
                </button>
                <button
                  onClick={fetchUploadedDocs}
                  disabled={loadingDocs}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#003527] bg-[#eff4ff] hover:bg-[#dce9ff] px-3.5 py-2.5 rounded-xl transition-colors"
                >
                  <span className={`material-symbols-outlined text-[15px] ${loadingDocs ? 'animate-spin' : ''}`}>refresh</span>
                  Refresh
                </button>
              </div>
            </div>

            {/* List of Documents in AI Knowledge Bucket */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-headline font-bold text-base text-[#0b1c30]">
                    Trained Knowledge Documents ({uploadedDocs.filter(d => d.targetBucket === 'ai_bucket').length})
                  </h3>
                </div>
              </div>

              {(() => {
                const aiDocs = uploadedDocs.filter(d => d.targetBucket === 'ai_bucket');
                if (aiDocs.length === 0) {
                  return (
                    <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-[#bfc9c3]/50">
                      <div className="w-16 h-16 rounded-2xl bg-[#e8f5ef] flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-[32px] text-[#003527]">psychology</span>
                      </div>
                      <h4 className="font-bold text-base text-[#0b1c30] mb-1">No Documents in AI Bucket Yet</h4>
                      <p className="text-xs text-[#707974] max-w-md mx-auto mb-5">
                        Upload your <strong>Fee Structure</strong>, Syllabus copy, or Rulebook here. The AI will learn every table and row without flooding student notice boards!
                      </p>
                      <button
                        onClick={() => {
                          setActiveView('upload');
                          setTargetBucket('ai_bucket');
                        }}
                        className="bg-[#003527] hover:bg-[#064e3b] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs"
                      >
                        Upload to AI Bucket Now
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {aiDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white rounded-2xl border border-[#bfc9c3]/30 shadow-xs hover:border-[#80bea6] hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                      >
                        <div className="h-1.5 w-full bg-[#003527]" />
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-[#e8f5ef] flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[#003527] text-[20px]">psychology</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-sm text-[#0b1c30] leading-snug line-clamp-2">{doc.title}</h4>
                                <p className="text-[11px] text-[#9ca8a3] mt-0.5">{doc.department}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#003527] text-[#80bea6] flex items-center gap-1 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#80bea6] animate-pulse"></span>
                                In AI Brain
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#003527]">
                                {doc.category}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f4f7ff] text-[#5a6672]">
                                {doc.totalChunks || 4} chunks
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 border-t border-[#bfc9c3]/20 pt-4 mt-2">
                            <button
                              onClick={() => setViewingDoc(doc)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#eff4ff] hover:bg-[#dce9ff] text-[#003527] text-xs font-bold transition-colors"
                            >
                              <span className="material-symbols-outlined text-[15px]">visibility</span>
                              Preview
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              disabled={deletingId === doc.id}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              {deletingId === doc.id ? (
                                <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                              ) : (
                                <span className="material-symbols-outlined text-[15px]">delete</span>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ─── VIEW DOCUMENT MODAL ─── */}
      {viewingDoc && (() => {
        const fileSource = viewingDoc.imageUrl || viewingDoc.fileUrl;
        const isImage = !!fileSource && (
          fileSource.startsWith('data:image') ||
          viewingDoc.fileType === 'image' ||
          /\.(png|jpe?g|webp|gif|svg)$/i.test(fileSource)
        );
        const isPdf = !!fileSource && (
          fileSource.startsWith('data:application/pdf') ||
          viewingDoc.fileType === 'pdf' ||
          /\.pdf$/i.test(fileSource)
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-[#bfc9c3]/30 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#eff4ff] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#003527] text-[20px]">
                      {isImage ? 'image' : isPdf ? 'picture_as_pdf' : 'description'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-[#0b1c30]">{viewingDoc.title}</h3>
                    <p className="text-xs text-[#9ca8a3]">{viewingDoc.department} · {viewingDoc.category} · {viewingDoc.fileSize}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {fileSource && (
                    <a
                      href={fileSource}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#eff4ff] hover:bg-[#dce9ff] text-[#003527] text-xs font-bold transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                      Open Full
                    </a>
                  )}
                  <button
                    onClick={() => setViewingDoc(null)}
                    className="w-9 h-9 rounded-xl bg-[#f4f7ff] hover:bg-[#e5eeff] flex items-center justify-center text-[#9ca8a3] hover:text-[#003527] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {/* Actual File Preview — Image */}
                {isImage && fileSource && (
                  <div className="rounded-2xl overflow-hidden border border-[#bfc9c3]/40 bg-[#0b1c30] flex flex-col items-center p-3 shadow-inner">
                    <img
                      src={fileSource}
                      alt={viewingDoc.title}
                      className="max-h-[480px] w-auto object-contain rounded-xl shadow-lg"
                    />
                  </div>
                )}

                {/* Actual File Preview — PDF */}
                {isPdf && fileSource && (
                  <div className="rounded-2xl overflow-hidden border border-[#bfc9c3]/40 bg-[#0b1c30] flex flex-col shadow-inner">
                    <div className="px-4 py-2 text-xs text-white/70 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#3cddc7] text-[16px]">picture_as_pdf</span>
                        <span className="font-bold text-white/90">{viewingDoc.title}</span>
                      </div>
                      <a
                        href={fileSource}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#3cddc7] hover:underline flex items-center gap-1 font-bold text-xs"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        Open Full PDF
                      </a>
                    </div>
                    <PdfViewer fileSource={fileSource} title={viewingDoc.title} />
                  </div>
                )}

                {/* No file — show placeholder */}
                {!fileSource && (
                  <div className="rounded-2xl border border-dashed border-[#bfc9c3]/50 bg-[#f8f9ff] p-8 flex flex-col items-center gap-3 text-center">
                    <span className="material-symbols-outlined text-[48px] text-[#9ca8a3]">description</span>
                    <p className="text-sm font-bold text-[#404944]">No file preview available</p>
                    <p className="text-xs text-[#9ca8a3]">The original file may not have been stored. Use the summary below for reference.</p>
                  </div>
                )}

                {/* Key info: summary only — short */}
                {viewingDoc.summary && (
                  <div className="bg-[#f8f9ff] rounded-xl p-3.5 border border-[#80bea6]/30">
                    <p className="text-[10px] font-bold text-[#003527] uppercase tracking-wider mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">info</span>
                      Key Info
                    </p>
                    <p className="text-xs text-[#5a6672] leading-relaxed">
                      {viewingDoc.summary
                        .replace(/Indexed with \d+ semantic chunks\.?/gi, '')
                        .trim()}
                    </p>
                  </div>
                )}

                {/* Meta — compact row */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: 'category', value: viewingDoc.category },
                    { icon: 'domain', value: viewingDoc.department },
                    { icon: 'calendar_today', value: viewingDoc.publishedDate },
                    { icon: 'group', value: viewingDoc.section || 'All Sections' },
                  ].map(item => (
                    <span key={item.icon} className="flex items-center gap-1 text-[10px] font-medium bg-[#eff4ff] text-[#003527] px-2.5 py-1 rounded-full">
                      <span className="material-symbols-outlined text-[12px]">{item.icon}</span>
                      {item.value}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-[#bfc9c3]/30 shrink-0">
                <button
                  onClick={() => setViewingDoc(null)}
                  className="w-full py-2.5 bg-[#003527] text-white font-bold text-sm rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── EDIT DOCUMENT MODAL ─── */}
      {editingDoc && (
        <EditDocumentModal
          doc={editingDoc}
          onClose={() => setEditingDoc(null)}
          onSaved={(updated) => {
            setUploadedDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
            setEditingDoc(null);
          }}
        />
      )}

      {/* ─── PRE-PUBLISH PREVIEW MODAL (Image or PDF) ─── */}
      {previewingUpload && (imagePreviewUrl || pdfPreviewUrl || previewBlobUrl) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewingUpload(false)}
        >
          <div
            className="bg-[#0b1c30] rounded-3xl shadow-2xl flex flex-col overflow-hidden max-w-3xl w-full max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#3cddc7] text-[22px]">
                  {imagePreviewUrl ? 'image' : 'picture_as_pdf'}
                </span>
                <div>
                  <p className="text-white font-bold text-sm">{file?.name}</p>
                  <p className="text-white/50 text-xs">{file?.size} · Pre-publish preview</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(previewBlobUrl || pdfPreviewUrl || imagePreviewUrl) && (
                  <a
                    href={previewBlobUrl || pdfPreviewUrl || imagePreviewUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#3cddc7] text-xs font-bold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                    Full Window
                  </a>
                )}
                <button
                  onClick={() => setPreviewingUpload(false)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
            {/* File Preview */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt="Document preview"
                  className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-xl"
                />
              ) : (pdfPreviewUrl || previewBlobUrl) ? (
                <div className="w-full flex flex-col items-center">
                  <PdfViewer fileSource={previewBlobUrl || pdfPreviewUrl || ''} title={file?.name || 'PDF Preview'} />
                </div>
              ) : null}
            </div>
            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-white/10 flex gap-3">
              <label
                htmlFor="document-file-input"
                onClick={() => setPreviewingUpload(false)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                Change File
              </label>
              <button
                onClick={() => {
                  setFile(null); setSelectedFileObj(null);
                  setImagePreviewUrl(null); setPdfPreviewUrl(null); setUploadError(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  setPreviewingUpload(false);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Remove File
              </button>
              <button
                onClick={() => setPreviewingUpload(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#003527] hover:bg-[#064e3b] text-white text-xs font-bold transition-colors"
              >
                Looks Good — Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Edit Modal ──────────────────────────────────────────────────────────
function EditDocumentModal({
  doc,
  onClose,
  onSaved,
}: {
  doc: CollegeDocument;
  onClose: () => void;
  onSaved: (updated: CollegeDocument) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [department, setDepartment] = useState(doc.department);
  const [category, setCategory] = useState(doc.category);
  const [section, setSection] = useState(doc.section || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Since we don't have a PATCH endpoint, we delete + re-insert
    // For now, update in local state only (or implement a PUT endpoint later)
    const updated: CollegeDocument = {
      ...doc,
      title,
      department,
      category,
      section: section || undefined,
    };

    try {
      // Delete old and re-upload with same data
      await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
      await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {
      console.warn('Edit save error, updating locally');
    }

    setSaving(false);
    onSaved(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[#bfc9c3]/30">
          <h3 className="font-headline font-bold text-[#0b1c30]">Edit Document</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#f4f7ff] hover:bg-[#e5eeff] flex items-center justify-center text-[#9ca8a3] hover:text-[#003527] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
            >
              <option value="Computer Science & Engineering">Computer Science & Engineering</option>
              <option value="Examination Cell">Examination Cell</option>
              <option value="Dean of Students & Senate">Dean of Students & Senate</option>
              <option value="Bursar & Financial Aid Office">Bursar & Financial Aid Office</option>
              <option value="Centre for Career Development">Centre for Career Development</option>
              <option value="General Academic">General Academic (All Departments)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
            >
              <option value="Timetable">🗓 Timetable / Schedule</option>
              <option value="Syllabus">📘 Syllabus</option>
              <option value="Circular">📢 Circular</option>
              <option value="Handbook">📖 Handbook</option>
              <option value="Regulations">⚖️ Regulations</option>
              <option value="Financial Aid">💰 Financial Aid</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#404944] uppercase mb-1.5">
              Class Section
              <span className="ml-1 text-[#9ca8a3] normal-case font-normal tracking-normal">(blank = all sections)</span>
            </label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value.toUpperCase())}
              placeholder="e.g. A, B, TY-A, TY AIML — blank means all"
              className="w-full bg-[#f8f9ff] border border-[#bfc9c3]/40 rounded-xl px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
            />
            <p className="text-[10px] text-[#9ca8a3] mt-1">
              Must match exactly what students typed (case-insensitive).
            </p>
          </div>


          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-[#bfc9c3]/40 text-[#5a6672] font-bold text-sm rounded-xl hover:bg-[#f4f7ff] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-[#003527] hover:bg-[#064e3b] text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving && <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
