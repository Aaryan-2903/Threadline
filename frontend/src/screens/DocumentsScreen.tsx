import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useNavigation } from '../context/useNavigation';
import { useUserProfile } from '../context/useUserProfile';
import { isValidUUID } from '../utils/uuid';
import type { DocumentItem, Project } from '../types';

export const DocumentsScreen: React.FC = () => {
  const { navigate, selectedProjectId } = useNavigation();
  const { profile } = useUserProfile();

  const validProjectId = isValidUUID(selectedProjectId) ? selectedProjectId : undefined;

  // State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [approvedClaimsCount, setApprovedClaimsCount] = useState<number>(0);
  const [totalReviewedClaims, setTotalReviewedClaims] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents and projects
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [docsData, projsData, reviewsData] = await Promise.all([
          api.getDocuments(validProjectId),
          api.getProjects(),
          api.getReviews({ project_id: validProjectId }),
        ]);

        if (!isMounted) return;
        setProjects(projsData || []);

        if (docsData && docsData.length > 0) {
          setDocuments(docsData);
          setSelectedDocId((prev) => prev || docsData[0].id);
        } else {
          setDocuments([]);
          setSelectedDocId(null);
        }

        const approved = (reviewsData || []).filter((r) => r.status === 'approved').length;
        const reviewed = (reviewsData || []).filter((r) => r.status === 'approved' || r.status === 'rejected').length;
        setApprovedClaimsCount(approved);
        setTotalReviewedClaims(reviewed);
      } catch (err) {
        console.warn('Error loading documents:', err);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [validProjectId]);

  const refreshDocuments = async () => {
    try {
      const [docsData, projsData, reviewsData] = await Promise.all([
        api.getDocuments(validProjectId),
        api.getProjects(),
        api.getReviews({ project_id: validProjectId }),
      ]);
      if (docsData && docsData.length > 0) {
        setDocuments(docsData);
      }
      setProjects(projsData);
      const approved = (reviewsData || []).filter((r) => r.status === 'approved').length;
      const reviewed = (reviewsData || []).filter((r) => r.status === 'approved' || r.status === 'rejected').length;
      setApprovedClaimsCount(approved);
      setTotalReviewedClaims(reviewed);
    } catch (err) {
      console.warn('Refresh error:', err);
    }
  };

  // File upload handler
  const handleFileUpload = async (file: File) => {
    setUploadError(null);

    // Validation
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.pdf') && !lowerName.endsWith('.docx')) {
      setUploadError('Invalid format: Only PDF (.pdf) and Word (.docx) files are supported.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File size exceeds the 50MB maximum limit.');
      return;
    }

    setIsUploading(true);
    try {
      const activeProjId = validProjectId || (projects.length > 0 ? projects[0].id : undefined);
      const newDoc = await api.uploadDocument(file, activeProjId, profile.displayName || 'User');
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDocId(newDoc.id);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Delete handler
  const handleDeleteDocument = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this document and its extracted knowledge?')) {
      return;
    }

    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (selectedDocId === id) {
        const remaining = documents.filter((d) => d.id !== id);
        setSelectedDocId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.warn('Delete failed:', err);
    }
  };

  // Reprocess handler
  const handleReprocessDocument = async (id: string) => {
    try {
      const updated = await api.reprocessDocument(id);
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (err) {
      console.warn('Reprocess failed:', err);
    }
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = doc.filename.toLowerCase().includes(q);
      const matchAuthor = (doc.author || '').toLowerCase().includes(q);
      const matchProj = (doc.project_name || '').toLowerCase().includes(q);
      if (!matchName && !matchAuthor && !matchProj) return false;
    }
    if (selectedProjectFilter !== 'all') {
      if (doc.project_id && doc.project_id !== selectedProjectFilter) return false;
      if (!doc.project_id && doc.project_name !== selectedProjectFilter) return false;
    }
    if (formatFilter !== 'all') {
      if (doc.file_type.toLowerCase() !== formatFilter.toLowerCase()) return false;
    }
    if (statusFilter !== 'all') {
      if (doc.status !== statusFilter) return false;
    }
    return true;
  });

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0] || null;

  // KPI calculations
  const totalDocs = documents.length;
  const totalClaims = documents.reduce((sum, d) => sum + (d.extracted_claims_count || 0), 0);
  const activeProcessing = documents.filter((d) => d.status === 'processing').length;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col w-full pb-16">
      <div className="px-space-xl py-space-lg flex flex-col gap-space-lg">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-md">
          <div className="flex flex-col">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Documents</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Source evidence hub for architecture RFCs, specifications, meeting logs, and handover notes.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <button
              onClick={() => navigate('ai-review-queue')}
              className="h-8 px-space-md rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-colors font-label-md text-label-md font-medium inline-flex items-center gap-1.5 shadow-sm border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">smart_toy</span>
              <span>Open AI Review Queue</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              accept=".pdf,.docx"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-8 px-space-md rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-medium inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span>{isUploading ? 'Ingesting...' : 'Upload Document'}</span>
            </button>
          </div>
        </div>

        {/* Upload & Ingestion Dropzone Banner */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-space-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all relative overflow-hidden border-2 ${
            isDragging
              ? 'border-primary-container bg-primary-fixed/20'
              : 'border-dashed border-outline-variant/50 hover:border-primary-container'
          }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-md min-w-0">
              <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container shrink-0">
                <span className="material-symbols-outlined text-[26px]">
                  {isUploading ? 'hourglass_top' : 'cloud_upload'}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                    Drag &amp; drop technical specifications, RFCs, PRDs, or architecture notes
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-secondary-container font-label-sm text-label-sm uppercase tracking-wider font-semibold">
                    Max 50MB
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Documents are automatically OCR-indexed, extracted for ADRs &amp; handover commitments, and anchored with page citations.
                </p>
                {uploadError && (
                  <p className="font-label-sm text-label-sm text-error mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {uploadError}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-space-sm shrink-0 w-full md:w-auto justify-end">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-space-md rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">folder_open</span>
                <span>Browse local files</span>
              </button>
            </div>
          </div>

          {/* Pipeline Features Tags */}
          <div className="mt-space-md pt-space-sm flex flex-wrap items-center gap-2 bg-surface-container-low/40 px-space-sm py-1.5 rounded-lg">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold flex items-center gap-1 mr-2">
              <span className="material-symbols-outlined text-[14px]">verified</span> Pipeline Features:
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-primary-container">picture_as_pdf</span> PDF supported
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-tertiary-container">description</span> DOCX supported
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-tertiary">document_scanner</span> Page-level citations
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-primary">auto_fix_high</span> Semantic AI Knowledge Engine
            </span>
          </div>
        </div>

        {/* Summary Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">Total Documents</span>
              <span className="material-symbols-outlined text-[18px]">folder_copy</span>
            </div>
            <div className="mt-space-sm flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">{totalDocs}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Persisted &amp; indexed</span>
            </div>
            <div className="mt-2 w-full bg-surface-container-low h-1 rounded-full overflow-hidden">
              <div className="bg-primary-container h-full rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">Extracted Claims</span>
              <span className="material-symbols-outlined text-[18px]">fact_check</span>
            </div>
            <div className="mt-space-sm flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">{totalClaims}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Decisions, Tasks &amp; Risks</span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-label-sm text-on-surface-variant">
              <span className="inline-block w-2 h-2 rounded-full bg-primary-container"></span> Decisions
              <span className="inline-block w-2 h-2 rounded-full bg-tertiary-container ml-1"></span> Tasks
              <span className="inline-block w-2 h-2 rounded-full bg-secondary ml-1"></span> Risks
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">Processing Active</span>
              <span className={`w-2 h-2 rounded-full ${activeProcessing > 0 ? 'bg-primary animate-pulse' : 'bg-outline-variant'}`}></span>
            </div>
            <div className="mt-space-sm flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">{activeProcessing}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">OCR &amp; Parsing pipeline</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-full bg-surface-container-low h-1 rounded-full overflow-hidden">
                <div
                  className={`bg-primary h-full rounded-full ${activeProcessing > 0 ? 'animate-pulse' : ''}`}
                  style={{ width: activeProcessing > 0 ? '60%' : '100%' }}
                ></div>
              </div>
              <span className="font-code-inline text-[11px] text-on-surface-variant shrink-0">
                {activeProcessing > 0 ? 'In progress' : 'Idle'}
              </span>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">Approved Claims</span>
              <span className="material-symbols-outlined text-[18px] text-primary">verified_user</span>
            </div>
            <div className="mt-space-sm flex items-baseline gap-2">
              <span className="font-headline-xl text-headline-xl text-on-surface font-semibold tracking-tight">{approvedClaimsCount}</span>
              <span className="font-label-sm text-label-sm text-secondary-container bg-surface-container px-1 rounded text-on-surface font-medium">
                Human verified
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-on-surface-variant font-label-sm">
              <span>{totalReviewedClaims} reviewed across specifications</span>
              <span className="text-tertiary font-medium">Review Queue</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-sm bg-surface-container-lowest p-space-sm rounded-xl shadow-sm">
          <div className="relative flex items-center flex-1 min-w-[280px]">
            <span className="material-symbols-outlined absolute left-3 text-[18px] text-on-surface-variant pointer-events-none">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by title, author, or project..."
              className="h-9 w-full pl-9 pr-10 rounded-lg bg-surface-container-low/50 text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest shadow-inner transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-surface-container-low/70 px-2.5 py-1 rounded-lg">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Project:</span>
              <select
                value={selectedProjectFilter}
                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                className="bg-transparent font-label-md text-label-md text-on-surface font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-surface-container-low/70 px-2.5 py-1 rounded-lg">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Format:</span>
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="bg-transparent font-label-md text-label-md text-on-surface font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All File Types</option>
                <option value="pdf">PDF (.pdf)</option>
                <option value="docx">Word (.docx)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-surface-container-low/70 px-2.5 py-1 rounded-lg">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent font-label-md text-label-md text-on-surface font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="extracted">Extracted</option>
                <option value="processing">Processing</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Workspace Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Left: Document Evidence Library (7 cols) */}
          <div className="lg:col-span-7 flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
            <div className="px-space-md py-space-sm bg-surface-container-low/60 flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-on-surface-variant">
                  Evidence Sources ({filteredDocs.length} displayed)
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container"></span>
              </div>
              <button
                onClick={refreshDocuments}
                className="flex items-center gap-1 text-[11px] font-label-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span> Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/30 text-on-surface-variant text-[11px] uppercase tracking-wider font-label-sm select-none border-b border-outline-variant/10">
                    <th className="py-2.5 pl-space-md pr-2 font-semibold">Document Title</th>
                    <th className="py-2.5 px-2 font-semibold">Author</th>
                    <th className="py-2.5 px-2 font-semibold">Status</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Extracted</th>
                    <th className="py-2.5 pl-2 pr-space-md font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                  {filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[32px] block mb-2 text-outline">description</span>
                        No documents found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map((doc) => {
                      const isSelected = selectedDoc?.id === doc.id;
                      const isPdf = doc.file_type.toLowerCase() === 'pdf';

                      return (
                        <tr
                          key={doc.id}
                          onClick={() => setSelectedDocId(doc.id)}
                          className={`hover:bg-surface-container-low/70 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-surface-container-low/80 font-medium' : ''
                          }`}
                        >
                          <td className="py-space-md pl-space-md pr-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                                  isPdf
                                    ? 'bg-error-container text-on-error-container'
                                    : 'bg-secondary-container text-on-secondary-fixed'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {isPdf ? 'picture_as_pdf' : 'description'}
                                </span>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate group-hover:text-primary transition-colors">
                                  {doc.filename}
                                </span>
                                <span className="text-[11px] font-label-sm text-on-surface-variant truncate">
                                  {formatFileSize(doc.file_size)} • {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-space-md px-2">
                            <span className="font-label-md text-label-md text-on-surface truncate block max-w-[100px]">
                              {doc.author || 'System'}
                            </span>
                          </td>

                          <td className="py-space-md px-2">
                            {doc.status === 'extracted' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-tertiary font-label-sm text-label-sm font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> Extracted
                              </span>
                            )}
                            {doc.status === 'processing' && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary-fixed text-primary font-label-sm text-label-sm font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span> Processing...
                              </span>
                            )}
                            {doc.status === 'error' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-error-container text-error font-label-sm text-label-sm font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-error"></span> Error
                              </span>
                            )}
                            {doc.status === 'uploaded' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                                Uploaded
                              </span>
                            )}
                          </td>

                          <td className="py-space-md px-2 text-right">
                            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                              {doc.extracted_claims_count} items
                            </span>
                          </td>

                          <td className="py-space-md pl-2 pr-space-md text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => handleDeleteDocument(doc.id, e)}
                                title="Delete document"
                                className="w-7 h-7 rounded hover:bg-error-container/40 hover:text-error flex items-center justify-center text-on-surface-variant transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                              <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-primary transition-colors">
                                chevron_right
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Document Detail Drawer / Inspector (5 cols) */}
          <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-md border border-outline-variant/20 sticky top-16">
            {selectedDoc ? (
              <>
                <div className="flex items-start justify-between gap-space-sm border-b border-outline-variant/15 pb-space-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${
                        selectedDoc.file_type.toLowerCase() === 'pdf'
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-secondary-container text-on-secondary-fixed'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {selectedDoc.file_type.toLowerCase() === 'pdf' ? 'picture_as_pdf' : 'description'}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                        {selectedDoc.filename}
                      </h2>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {formatFileSize(selectedDoc.file_size)} • {selectedDoc.page_count} pages • {selectedDoc.file_type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-label-sm font-semibold uppercase ${
                      selectedDoc.status === 'extracted'
                        ? 'bg-tertiary-fixed text-tertiary'
                        : selectedDoc.status === 'processing'
                        ? 'bg-primary-fixed text-primary animate-pulse'
                        : 'bg-error-container text-error'
                    }`}
                  >
                    {selectedDoc.status}
                  </span>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-space-sm bg-surface-container-low/50 p-space-sm rounded-lg">
                  <div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">Author</span>
                    <span className="font-label-md text-label-md text-on-surface font-medium truncate block">
                      {selectedDoc.author || profile.displayName || 'User'}
                    </span>
                  </div>
                  <div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">Extracted Claims</span>
                    <span className="font-label-md text-label-md text-on-surface font-semibold text-primary block">
                      {selectedDoc.extracted_claims_count} Verified Claims
                    </span>
                  </div>
                  <div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">Storage Mode</span>
                    <span className="font-label-md text-label-md text-on-surface font-medium block">
                      Persistent SQLite/Postgres
                    </span>
                  </div>
                  <div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">Uploaded</span>
                    <span className="font-label-md text-label-md text-on-surface font-medium block">
                      {new Date(selectedDoc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/15">
                  <button
                    onClick={() => navigate('ai-review-queue')}
                    className="w-full h-9 rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">fact_check</span>
                    <span>Review {selectedDoc.extracted_claims_count} Claims in Review Queue</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReprocessDocument(selectedDoc.id)}
                      className="flex-1 h-8 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">sync</span>
                      <span>Reprocess</span>
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(selectedDoc.id)}
                      className="flex-1 h-8 rounded bg-error-container/40 hover:bg-error-container text-error font-label-sm text-label-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Delete File</span>
                    </button>
                  </div>
                </div>

                {/* Proof Anchor & Preview Box */}
                <div className="flex flex-col gap-1.5 mt-2">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-primary">find_in_page</span>
                    Verified Source Citation Anchor
                  </span>
                  <div className="p-space-md rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm leading-relaxed border border-outline-variant/20 max-h-48 overflow-y-auto">
                    <p className="italic text-on-surface-variant">
                      “...all decisions, tasks, and system dependencies parsed from{' '}
                      <span className="font-semibold text-on-surface">{selectedDoc.filename}</span> are cryptographically anchored to page citations and ready for sign-off in the AI Review Queue.”
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[32px] block mb-2 text-outline">description</span>
                Select a document to inspect its extracted details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
