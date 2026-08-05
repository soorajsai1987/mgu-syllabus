/* ============================================================
   MGU Agent – Syllabus Verification System
   Application JavaScript (Vanilla, No Dependencies)
   ============================================================ */

(function () {
    'use strict';

    // ----- Configuration -----
    const API_BASE = window.location.origin;
    const SEARCH_DEBOUNCE_MS = 300;
    const TOAST_DURATION_MS = 4000;

    // ----- DOM Cache -----
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        // Theme
        themeToggle: $('#theme-toggle-btn'),
        themeIconDark: $('#theme-icon-dark'),
        themeIconLight: $('#theme-icon-light'),

        // Health
        healthDot: $('#health-dot'),
        healthLabel: $('#health-label'),

        // Search
        searchInput: $('#search-input'),
        searchClear: $('#search-clear-btn'),
        searchShortcut: $('#search-shortcut-hint'),
        searchBox: $('#search-box'),

        // Stats
        statProgrammes: $('#stat-programmes-value'),
        statPdfs: $('#stat-pdfs-value'),
        statCourses: $('#stat-courses-value'),
        statVerified: $('#stat-verified-value'),

        // Results
        resultsSection: $('#search-results-section'),
        resultsGrid: $('#results-grid'),
        resultsTitle: $('#results-title'),
        noResults: $('#no-results'),
        loadingSkeleton: $('#loading-skeleton'),
        exportResultsBtn: $('#export-results-btn'),

        // Course Detail Modal
        courseOverlay: $('#course-detail-overlay'),
        courseModal: $('#course-detail-modal'),
        courseCode: $('#course-detail-code'),
        courseTitle: $('#course-detail-title'),
        courseBody: $('#course-detail-body'),
        coursePdfBody: $('#course-pdf-body'),
        courseLinkBody: $('#course-link-body'),
        modalTabs: $$('.modal-tab'),
        courseCloseBtn: $('#course-detail-close-btn'),
        courseCompareBtn: $('#course-compare-btn'),
        courseExportBtn: $('#course-export-btn'),

        // Comparison Modal
        compOverlay: $('#comparison-overlay'),
        compContent: $('#comparison-content'),
        compCloseBtn: $('#comparison-close-btn'),
        compTitle: $('#comparison-title'),

        // Toast
        toastContainer: $('#toast-container'),
    };

    // ----- State -----
    let currentResults = [];
    let currentCourseData = null;
    let searchTimeout = null;
    let windowAllCourses = [];

    // ============================================================
    //  UTILITIES
    // ============================================================

    async function apiFetch(path, options = {}) {
        return null; // Deprecated in static version
    }

    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    function escapeHtml(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function formatNumber(n) {
        if (n == null || isNaN(n)) return '—';
        return Number(n).toLocaleString();
    }

    function downloadJson(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // ============================================================
    //  TOAST NOTIFICATIONS
    // ============================================================

    function showToast(message, type = 'info') {
        const icons = {
            success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
        dom.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, TOAST_DURATION_MS);
    }

    // ============================================================
    //  THEME
    // ============================================================

    function initTheme() {
        const saved = localStorage.getItem('mgu-theme') || 'dark';
        setTheme(saved);
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('mgu-theme', theme);
        if (theme === 'dark') {
            dom.themeIconDark.classList.remove('hidden');
            dom.themeIconLight.classList.add('hidden');
        } else {
            dom.themeIconDark.classList.add('hidden');
            dom.themeIconLight.classList.remove('hidden');
        }
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    }

    // ============================================================
    //  HEALTH & STATUS
    // ============================================================

    async function loadData() {
        try {
            if (window.MGU_COURSES_DATA) {
                windowAllCourses = window.MGU_COURSES_DATA;
                console.log('Loaded courses from data.js');
            } else {
                const resp = await fetch('courses.json');
                if (!resp.ok) throw new Error('Failed to fetch courses.json');
                windowAllCourses = await resp.json();
            }
            
            dom.healthDot.className = 'health-dot online';
            dom.healthLabel.textContent = 'Data Loaded';
            
            // Calculate unique stats locally
            const uniqueProgs = new Set(windowAllCourses.map(c => c.programme).filter(Boolean));
            dom.statProgrammes.textContent = formatNumber(uniqueProgs.size);
            dom.statCourses.textContent = formatNumber(windowAllCourses.length);
            dom.statVerified.textContent = formatNumber(windowAllCourses.filter(c => c.is_verified).length);
            dom.statPdfs.textContent = '—'; // PDF calculation not trivial in static mode
        } catch(err) {
            dom.healthDot.className = 'health-dot error';
            dom.healthLabel.textContent = 'Data Error';
            showToast('Could not load course data.', 'error');
            console.error("Static data load error:", err);
        }
    }

    // ============================================================
    //  SEARCH
    // ============================================================

    async function performSearch(query) {
        if (!query || query.trim().length === 0) {
            hideResults();
            return;
        }

        showLoading();

        // Give UI a moment to show loading skeleton before blocking main thread
        setTimeout(() => {
            const q = query.trim().toLowerCase();
            const results = windowAllCourses.filter(c => {
                const code = (c.course_code || '').toLowerCase();
                const name = (c.course_name || '').toLowerCase();
                return code.includes(q) || name.includes(q);
            });
            
            // Sort: exact code match first
            results.sort((a, b) => {
                const aExact = (a.course_code || '').toLowerCase() === q ? 1 : 0;
                const bExact = (b.course_code || '').toLowerCase() === q ? 1 : 0;
                return bExact - aExact;
            });
            
            // Limit to 100 to avoid freezing DOM
            const limited = results.slice(0, 100);
            currentResults = limited;
            renderResults(limited, query);
        }, 50);
    }

    function showLoading() {
        dom.loadingSkeleton.classList.remove('hidden');
        dom.resultsSection.classList.add('hidden');
        dom.noResults.classList.add('hidden');
    }

    function hideLoading() {
        dom.loadingSkeleton.classList.add('hidden');
    }

    function hideResults() {
        dom.resultsSection.classList.add('hidden');
        dom.loadingSkeleton.classList.add('hidden');
        dom.noResults.classList.add('hidden');
        // Show portal card when no search is active
        const portalCard = document.getElementById('portal-card-section');
        if (portalCard) portalCard.style.display = 'flex';
    }

    function renderResults(results, query) {
        hideLoading();
        // Hide portal card whenever search results are shown
        const portalCard = document.getElementById('portal-card-section');
        if (portalCard) portalCard.style.display = 'none';

        if (!results || results.length === 0) {
            dom.resultsSection.classList.remove('hidden');
            dom.resultsGrid.innerHTML = '';
            dom.noResults.classList.remove('hidden');
            dom.resultsTitle.textContent = `No results for "${query}"`;
            return;
        }

        dom.noResults.classList.add('hidden');
        dom.resultsSection.classList.remove('hidden');
        dom.resultsTitle.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`;

        dom.resultsGrid.innerHTML = results.map((course, i) => {
            const code = course.course_code || course.code || '';
            const name = course.course_name || course.name || course.title || '';
            const programme = course.programme || course.programme_name || '';
            const semester = course.semester || '';
            const confidence = normalizeConfidence(course.confidence_label != null ? course.confidence_label : (course.confidence != null ? course.confidence : 0));
            const source = course.source_type || course.source || '';
            const courseType = course.course_type || '';
            // Abbreviate course type for badge
            const typeAbbr = courseType
                .replace('Discipline Specific Course', 'DSC')
                .replace('Discipline Specific Elective', 'DSE')
                .replace('Ability Enhancement Course', 'AEC')
                .replace('Multi-Disciplinary Course', 'MDC')
                .replace('Skill Enhancement Course', 'SEC')
                .replace('Value-Added Course', 'VAC')
                .replace('Core Course', 'Core')
                .replace(/\s+Elective/, ' Elective');

            return `
                <div class="result-card" data-index="${i}" tabindex="0" role="button" aria-label="View ${code} ${name}">
                    <div class="result-card-header">
                        <span class="result-code">${escapeHtml(code)}</span>
                        <div style="display:flex;gap:6px;align-items:center;">
                            ${course.is_verified ? `<span class="confidence-badge" style="background:var(--success-muted);color:var(--success);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Verified</span>` : ''}
                            ${confidence ? `<span class="confidence-badge confidence-${confidence.toLowerCase()}">${confidenceIcon(confidence)} ${escapeHtml(confidence)}</span>` : ''}
                        </div>
                    </div>
                    <div class="result-name">${escapeHtml(name)}</div>
                    <div class="result-meta">
                        ${programme ? `<span class="result-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${escapeHtml(programme)}</span>` : ''}
                        ${semester ? `<span class="result-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Sem ${escapeHtml(String(semester))}</span>` : ''}
                        ${typeAbbr ? `<span class="source-pill source-syllabus">${escapeHtml(typeAbbr)}</span>` : ''}
                        ${source ? `<span class="source-pill source-${source.toLowerCase().includes('amendment') ? 'amendment' : 'syllabus'}">${escapeHtml(source)}</span>` : ''}
                    </div>
                    ${course.portal_url ? `
                    <div style="margin-top:12px;">
                        <a href="${escapeHtml(course.portal_url)}" target="_blank" rel="noopener noreferrer" 
                           class="btn btn-primary btn-sm" style="display:inline-flex;gap:6px;font-size:0.8rem;padding:6px 12px;background:rgba(59,130,246,0.1);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);text-decoration:none;"
                           onclick="event.stopPropagation();">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            Open MGU Portal
                        </a>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');


        // Attach click handlers
        dom.resultsGrid.querySelectorAll('.result-card').forEach(card => {
            card.addEventListener('click', () => openCourseDetail(currentResults[parseInt(card.dataset.index)]));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openCourseDetail(currentResults[parseInt(card.dataset.index)]);
                }
            });
        });
    }

    function normalizeConfidence(val) {
        if (!val) return '';
        const v = String(val).toLowerCase();
        if (v === 'high' || v === 'h' || (Number(v) >= 0.8)) return 'High';
        if (v === 'medium' || v === 'med' || v === 'm' || (Number(v) >= 0.5 && Number(v) < 0.8)) return 'Medium';
        if (v === 'low' || v === 'l' || (Number(v) > 0 && Number(v) < 0.5)) return 'Low';
        // Capitalize first letter fallback
        return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
    }

    function confidenceIcon(level) {
        const l = level.toLowerCase();
        if (l === 'high') return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
        if (l === 'medium') return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        if (l === 'low') return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        return '';
    }

    // ============================================================
    //  COURSE DETAIL
    // ============================================================

    async function openCourseDetail(courseSummary) {
        const code = courseSummary.course_code || courseSummary.code || '';
        dom.courseCode.textContent = code;
        dom.courseTitle.textContent = courseSummary.course_name || courseSummary.name || courseSummary.title || '';
        dom.courseBody.innerHTML = '<div class="skeleton-card"><div class="skeleton-line w80"></div><div class="skeleton-line w60"></div><div class="skeleton-line w90"></div></div>';
        
        // Reset tabs
        if(dom.modalTabs && dom.modalTabs.length > 0) {
            dom.modalTabs.forEach(t => t.classList.remove('active'));
            dom.modalTabs[0].classList.add('active');
        }
        dom.courseBody.classList.remove('hidden');
        if(dom.coursePdfBody) {
            dom.coursePdfBody.classList.add('hidden');
            dom.coursePdfBody.innerHTML = '';
        }
        if(dom.courseLinkBody) {
            dom.courseLinkBody.classList.add('hidden');
            dom.courseLinkBody.innerHTML = '';
        }

        dom.courseOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Static: just render the data we already have from search
        currentCourseData = courseSummary;
        renderCourseDetail(courseSummary);
    }

    function renderCourseDetail(data) {
        const course = data.course || data;
        const confidence = normalizeConfidence(course.confidence || course.verification_confidence || '');

        // Core fields
        const fields = [
            { label: 'Course Code', value: course.course_code || course.code, mono: true },
            { label: 'Course Name', value: course.course_name || course.name || course.title, mono: false },
            { label: 'Programme', value: course.programme || course.programme_name, mono: false },
            { label: 'Semester', value: course.semester, mono: true },
            { label: 'Credits', value: course.credits || course.credit_total, mono: true },
            { label: 'Hours/Week', value: course.hours || course.hours_per_week || course.total_hours || course.teaching_hours, mono: true },
            { label: 'CIA Marks', value: course.cia || course.cia_marks || course.internal_marks, mono: true },
            { label: 'ESE Marks', value: course.ese || course.ese_marks || course.external_marks, mono: true },
            { label: 'Total Marks', value: course.total_marks || course.total, mono: true },
            { label: 'Exam Duration', value: course.duration || course.exam_duration, mono: true },
            { label: 'Category', value: course.category || course.course_type, mono: false },
        ].filter(f => f.value != null && f.value !== '');

        // Sources
        const sources = course.sources || course.source_trail || [];
        const sourceType = course.source_type || course.source || '';

        let html = '';

        // Verification badge
        if (confidence || course.is_verified) {
            html += `
                <div class="detail-verification">
                    ${course.is_verified ? `<span class="confidence-badge" style="background:var(--success-muted);color:var(--success);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 100% Verified</span>` : ''}
                    ${confidence ? `<span class="confidence-badge confidence-${confidence.toLowerCase()}">${confidenceIcon(confidence)} ${escapeHtml(confidence)} Confidence</span>` : ''}
                    <span class="detail-verification-label" style="margin-left: 8px;">Verification Status</span>
                    ${sourceType ? `<span class="source-pill source-${sourceType.toLowerCase().includes('amendment') ? 'amendment' : 'syllabus'}">${escapeHtml(sourceType)}</span>` : ''}
                </div>
            `;
        }

        // Course Information grid
        if (fields.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        Course Information
                    </div>
                    <div class="detail-grid">
                        ${fields.map(f => `
                            <div class="detail-field">
                                <div class="detail-field-label">${escapeHtml(f.label)}</div>
                                <div class="detail-field-value ${f.mono ? '' : 'text-value'}">${escapeHtml(String(f.value))}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }


        // Question Pattern – structured card (ESE only)
        if (course.question_pattern) {
            // CIA line patterns to exclude from display
            const ciaPatterns = [
                /active participation/i,
                /class discussion/i,
                /essay assignment/i,
                /research paper/i,
                /oral presentation/i,
                /quiz(zes)?/i,
                /multimedia project/i,
                /written test/i,
                /internal assessment/i,
                /continuous internal/i,
                /CIA/,
                /\bA\.\s*(Continuous|Internal)/i,
            ];
            const isCIALine = line => ciaPatterns.some(p => p.test(line));

            const allLines = course.question_pattern.split('\n').filter(l => l.trim());

            // Find ESE section start: look for "End Semester", "ESE", "Semester End Exam"
            const eseStartIdx = allLines.findIndex(l =>
                /end semester|semester end|ESE|\bB\.\s*End/i.test(l)
            );
            // Use ESE section if found; otherwise fall back to all lines
            const qpLines = eseStartIdx >= 0
                ? allLines.slice(eseStartIdx)
                : allLines.filter(l => !isCIALine(l));

            // Filter out any remaining CIA lines even in ESE section
            const filteredLines = qpLines.filter(l => !isCIALine(l));

            let qpTitle = '';
            let qpMeta  = '';
            let qpRows  = [];
            if (filteredLines.length > 0) {
                qpTitle = filteredLines[0];
                // Second line is meta if it contains "Marks", "Duration", "Max", "Time" or "Hrs"
                if (filteredLines.length > 1 && /Marks|Duration|Max|Time|Hrs/i.test(filteredLines[1])) {
                    qpMeta = filteredLines[1];
                    qpRows = filteredLines.slice(2);
                } else {
                    qpRows = filteredLines.slice(1);
                }
            }
            html += `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Question Pattern
                    </div>
                    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                        <div style="background:var(--primary-muted,rgba(99,102,241,0.08));padding:10px 14px;border-bottom:1px solid var(--border);">
                            <div style="font-weight:600;font-size:0.875rem;color:var(--text-primary);">${escapeHtml(qpTitle)}</div>
                            ${qpMeta ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">${escapeHtml(qpMeta)}</div>` : ''}
                        </div>
                        ${qpRows.map((row, i) => {
                            // Try to split "Short Answer (5 out of 7; 5x2=10 marks)" into name + detail
                            const m = row.match(/^(.+?)\s*\((.+)\)\s*$/);
                            const name   = m ? m[1].trim() : row;
                            const detail = m ? m[2].trim() : '';
                            return `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;${i < qpRows.length-1 ? 'border-bottom:1px solid var(--border);' : ''}background:${i%2===0?'transparent':'rgba(0,0,0,0.02)'};">
                                <span style="font-size:0.8125rem;color:var(--text-primary);font-weight:500;">${escapeHtml(name)}</span>
                                ${detail ? `<span style="font-size:0.8rem;color:var(--text-secondary);font-family:var(--font-mono);">${escapeHtml(detail)}</span>` : ''}
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }


        // Source Trail
        if (sources.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Source Documents
                    </div>
                    <div class="source-trail">
                        ${sources.map((s, idx) => {
                            const isLatest = s.is_latest || s.latest;
                            const filename = s.pdf_filename || s.filename || s.file || s.pdf || s.document || 'Unknown';
                            const title = s.pdf_title || filename;
                            const pages = s.page_number || s.pages || s.page || '';
                            const type = s.pdf_type || s.type || s.source_type || '';
                            return `
                                <div class="source-trail-item ${isLatest ? 'latest' : ''}" style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div class="trail-filename">
                                            ${escapeHtml(title)}
                                        </div>
                                        <div class="trail-detail">
                                            ${pages ? `Page: ${escapeHtml(String(pages))}` : ''}
                                            ${type ? ` · ${escapeHtml(type)}` : ''}
                                            ${s.is_latest || s.latest ? ' · <strong style="color:var(--success)">✅</strong>' : ''}
                                        </div>
                                    </div>
                                    <div>
                                        <a href="https://cap.mgu.ac.in/mguugp/syllabus.jsp#:~:text=${encodeURIComponent(course.programme || '')}" target="_blank" class="btn btn-primary btn-sm" style="text-decoration: none; padding: 4px 10px; font-size: 12px;">
                                            MGU Portal Link
                                        </a>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // Modules / Units
        const modules = course.modules || course.units || [];
        if (modules.length > 0) {
            html += `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        Modules
                    </div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        ${modules.map((m, idx) => `
                            <div class="detail-field" style="padding:10px 14px;">
                                <div class="detail-field-label">Module ${idx + 1}${m.title ? ': ' + escapeHtml(m.title) : ''}</div>
                                <div class="detail-field-value text-value" style="font-size:0.8125rem;line-height:1.6;">${escapeHtml(m.content || m.description || m.topics || '')}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        dom.courseBody.innerHTML = html;
    }

    function closeCourseDetail() {
        dom.courseOverlay.classList.add('hidden');
        document.body.style.overflow = '';
        currentCourseData = null;
    }

    async function loadFullPdfTab() {
        if (!currentCourseData) return;
        const course = currentCourseData.course || currentCourseData;
        const prog = course.programme || '';

        const sources = course.sources || [];
        if (!sources || sources.length === 0) {
            dom.coursePdfBody.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);">No PDF sources found for this course.</div>';
            return;
        }

        // Sort: latest first
        const sorted = [...sources].sort((a, b) => (b.is_latest ? 1 : 0) - (a.is_latest ? 1 : 0));

        let amendCount = 0, syllCount = 0;

        let rows = sorted.map(s => {
            // Encode URL properly (fix spaces and special chars)
            let fileUrl = 'https://cap.mgu.ac.in/mguugp/syllabus.jsp';
            if (s.pdf_url) {
                try {
                    // Split on the last path segment and encode only the filename
                    const lastSlash = s.pdf_url.lastIndexOf('/');
                    const base = s.pdf_url.substring(0, lastSlash + 1);
                    const file = s.pdf_url.substring(lastSlash + 1);
                    fileUrl = base + encodeURIComponent(file);
                } catch(e) {
                    fileUrl = s.pdf_url;
                }
            }

            // Friendly label
            let label, badgeColor, badgeBg, icon;
            if (s.pdf_type === 'amendment') {
                amendCount++;
                label = `Amendment ${amendCount > 1 ? amendCount : ''}`.trim();
                badgeColor = '#b45309'; badgeBg = '#fef3c7';
                icon = '📋';
            } else {
                syllCount++;
                label = syllCount > 1 ? `Syllabus ${syllCount}` : 'Original Syllabus';
                badgeColor = '#1e40af'; badgeBg = '#dbeafe';
                icon = '📄';
            }

            const isLatestBadge = s.is_latest
                ? `<span style="font-size:0.7rem;background:#059669;color:white;padding:2px 8px;border-radius:4px;margin-left:auto;white-space:nowrap;">✓ Latest</span>`
                : '';

            return `
                <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:8px;background:var(--bg-secondary);margin-bottom:8px;border:1px solid var(--border-primary);">
                    <span style="font-size:1.1rem;">${icon}</span>
                    <div style="flex:1;min-width:0;">
                        <a href="${fileUrl}" target="_blank" rel="noopener noreferrer"
                           style="color:var(--brand-blue);text-decoration:none;font-weight:600;font-size:0.9rem;display:block;">
                            ${escapeHtml(label)}
                            <svg style="vertical-align:middle;margin-left:4px;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                        <div style="font-size:0.74rem;color:var(--text-secondary);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.pdf_filename || '')}</div>
                    </div>
                    <span style="font-size:0.7rem;background:${badgeBg};color:${badgeColor};padding:3px 8px;border-radius:4px;white-space:nowrap;">${s.pdf_type === 'amendment' ? 'Amendment' : 'Syllabus'}</span>
                    ${isLatestBadge}
                </div>
            `;
        }).join('');

        dom.coursePdfBody.innerHTML = `
            <div style="padding:4px 0 8px;font-size:0.8rem;color:var(--text-secondary);font-weight:500;letter-spacing:0.04em;text-transform:uppercase;">
                ${prog ? escapeHtml(prog) + ' · ' : ''}${sources.length} Document${sources.length !== 1 ? 's' : ''} Found
            </div>
            ${rows}
            <div style="text-align:center;margin-top:8px;font-size:0.78rem;color:var(--text-secondary);">
                Links open the official PDF directly from the MGU server.
            </div>
        `;
    }

    async function loadLinkTab() {
        if (!currentCourseData) return;
        const course = currentCourseData.course || currentCourseData;
        const courseCode = course.course_code || course.code || '';
        const prog = course.programme || '';

        const portalBase = 'https://cap.mgu.ac.in/mguugp/syllabus.jsp';
        // Use exact collapse anchor if available, else main portal page
        const portalUrl = course.portal_url || portalBase;

        dom.courseLinkBody.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;gap:24px;text-align:center;">
                <div style="width:72px;height:72px;border-radius:16px;background:linear-gradient(135deg,#1e40af,#3b82f6);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(59,130,246,0.3);">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                </div>
                <div>
                    <div style="font-size:1.1rem;font-weight:600;color:var(--text-primary);margin-bottom:6px;">
                        ${prog ? escapeHtml(prog) : 'MGU UGP Syllabus Portal'}
                    </div>
                    <div style="font-size:0.85rem;color:var(--text-secondary);max-width:320px;line-height:1.5;">
                        Opens the exact programme section on the MGU portal where you can download the official PDF.
                    </div>
                    ${courseCode ? `<div style="margin-top:10px;font-size:0.78rem;color:var(--text-secondary);">Course: <span style="color:var(--brand-blue);font-weight:600;">${escapeHtml(courseCode)}</span></div>` : ''}
                </div>
                <a href="${escapeHtml(portalUrl)}" target="_blank" rel="noopener noreferrer"
                   style="display:inline-flex;align-items:center;gap:10px;padding:14px 32px;background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;border-radius:10px;font-size:1rem;font-weight:600;text-decoration:none;box-shadow:0 4px 16px rgba(59,130,246,0.35);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Open MGU Portal
                </a>
                <div style="font-size:0.75rem;color:var(--text-secondary);opacity:0.7;word-break:break-all;max-width:360px;">${escapeHtml(portalUrl)}</div>
            </div>
        `;
    }

    // ============================================================
    //  COMPARISON VIEW
    // ============================================================

    async function openComparison() {
        showToast('Version comparison is not available in the static version.', 'warning');
    }

    function renderComparison(data) {
        const original = data.original || data.syllabus || data.base || {};
        const latest = data.latest || data.amendment || data.updated || {};
        const changes = data.changes || data.differences || data.diffs || {};

        // Build list of all fields
        const allFields = new Set([...Object.keys(original), ...Object.keys(latest)]);
        const skipFields = new Set(['source_trail', 'sources', 'modules', 'units', 'objectives', 'course_objectives', 'raw_text']);

        let html = `
            <div class="comparison-col-header col-original">
                <span class="source-pill source-syllabus">Syllabus (Original)</span>
            </div>
            <div class="comparison-col-header col-latest">
                <span class="source-pill source-amendment">Amendment (Latest)</span>
            </div>
        `;

        for (const field of allFields) {
            if (skipFields.has(field)) continue;
            const origVal = original[field] ?? '—';
            const latestVal = latest[field] ?? '—';
            const isChanged = String(origVal) !== String(latestVal) && origVal !== '—' && latestVal !== '—';
            const isNew = origVal === '—' && latestVal !== '—';
            const isRemoved = origVal !== '—' && latestVal === '—';

            const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            // Determine winner
            const winner = (changes[field] && changes[field].winner) || '';

            html += `
                <div class="comparison-cell ${isChanged ? 'cell-changed cell-removed' : ''}">
                    <div class="comparison-field-label">${escapeHtml(fieldLabel)}</div>
                    <div class="comparison-field-value">${escapeHtml(String(origVal))}</div>
                    ${winner === 'original' ? '<span class="comparison-winner">✓ Authoritative</span>' : ''}
                </div>
                <div class="comparison-cell ${isChanged ? 'cell-changed cell-added' : ''} ${isNew ? 'cell-added' : ''}">
                    <div class="comparison-field-label">${escapeHtml(fieldLabel)}</div>
                    <div class="comparison-field-value">${escapeHtml(String(latestVal))}</div>
                    ${winner === 'latest' || winner === 'amendment' ? '<span class="comparison-winner">✓ Authoritative</span>' : ''}
                    ${isChanged && !winner ? '<span class="comparison-winner">★ Updated</span>' : ''}
                </div>
            `;
        }

        // If no fields found, show a helpful message
        if (allFields.size === 0 || (allFields.size <= skipFields.size)) {
            html += `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-tertiary);">
                <p>No field-level comparison data available.</p>
            </div>`;
        }

        dom.compContent.innerHTML = html;
    }

    function closeComparison() {
        dom.compOverlay.classList.add('hidden');
    }

    // ============================================================
    //  ADMIN PANEL
    // ============================================================

    function toggleAdmin() {
        const panel = dom.adminPanel;
        if (panel.classList.contains('visible')) {
            panel.classList.remove('visible');
            // Let the transition finish before hiding completely
            setTimeout(() => {
                if (!panel.classList.contains('visible')) {
                    panel.classList.add('hidden');
                }
            }, 350);
        } else {
            panel.classList.remove('hidden');
            // Force reflow for animation
            void panel.offsetHeight;
            panel.classList.add('visible');
        }
    }

    // Crawl
    async function startCrawl() {
        dom.crawlBtn.disabled = true;
        dom.crawlDot.className = 'admin-status-dot running';
        dom.crawlProgress.classList.remove('hidden');
        dom.crawlProgressBar.classList.add('indeterminate');
        dom.crawlStatusText.textContent = 'Crawling MGU portal…';
        showToast('Crawl started', 'info');

        try {
            await apiFetch('/api/crawl', { method: 'POST' });
            pollCrawlStatus();
        } catch (err) {
            dom.crawlDot.className = 'admin-status-dot error';
            dom.crawlProgressBar.classList.remove('indeterminate');
            dom.crawlStatusText.textContent = `Error: ${err.message}`;
            dom.crawlBtn.disabled = false;
            showToast(`Crawl failed: ${err.message}`, 'error');
        }
    }

    function pollCrawlStatus() {
        if (pollTimers.crawl) clearInterval(pollTimers.crawl);
        pollTimers.crawl = setInterval(async () => {
            try {
                const data = await apiFetch('/api/crawl/status');
                const status = data.status || data.state || '';
                const progress = data.progress ?? data.percent ?? null;

                if (progress != null) {
                    dom.crawlProgressBar.classList.remove('indeterminate');
                    dom.crawlProgressBar.style.width = `${Math.min(100, progress)}%`;
                }

                dom.crawlStatusText.textContent = data.message || `Status: ${status}`;

                if (status === 'completed' || status === 'done' || status === 'finished' || status === 'idle') {
                    clearInterval(pollTimers.crawl);
                    dom.crawlDot.className = 'admin-status-dot';
                    dom.crawlProgressBar.classList.remove('indeterminate');
                    dom.crawlProgressBar.style.width = '100%';
                    dom.crawlStatusText.textContent = 'Crawl completed';
                    dom.crawlBtn.disabled = false;
                    showToast('Crawl completed successfully!', 'success');
                    fetchStatus();
                } else if (status === 'error' || status === 'failed') {
                    clearInterval(pollTimers.crawl);
                    dom.crawlDot.className = 'admin-status-dot error';
                    dom.crawlBtn.disabled = false;
                    showToast('Crawl failed', 'error');
                }
            } catch {
                // Continue polling silently
            }
        }, POLL_INTERVAL_MS);
    }

    // Parse
    async function startParse() {
        dom.parseBtn.disabled = true;
        dom.parseDot.className = 'admin-status-dot running';
        dom.parseProgress.classList.remove('hidden');
        dom.parseProgressBar.classList.add('indeterminate');
        dom.parseStatusText.textContent = 'Parsing documents…';
        showToast('Parse started', 'info');

        try {
            const data = await apiFetch('/api/parse', { method: 'POST' });
            dom.parseDot.className = 'admin-status-dot';
            dom.parseProgressBar.classList.remove('indeterminate');
            dom.parseProgressBar.style.width = '100%';
            dom.parseStatusText.textContent = data.message || 'Parse completed';
            dom.parseBtn.disabled = false;
            showToast('Documents parsed successfully!', 'success');
            fetchStatus();
        } catch (err) {
            dom.parseDot.className = 'admin-status-dot error';
            dom.parseProgressBar.classList.remove('indeterminate');
            dom.parseStatusText.textContent = `Error: ${err.message}`;
            dom.parseBtn.disabled = false;
            showToast(`Parse failed: ${err.message}`, 'error');
        }
    }

    // Rebuild Index
    async function startRebuild() {
        dom.rebuildBtn.disabled = true;
        dom.rebuildDot.className = 'admin-status-dot running';
        dom.rebuildProgress.classList.remove('hidden');
        dom.rebuildProgressBar.classList.add('indeterminate');
        dom.rebuildStatusText.textContent = 'Rebuilding index…';
        showToast('Index rebuild started', 'info');

        try {
            const data = await apiFetch('/api/index/rebuild', { method: 'POST' });
            dom.rebuildDot.className = 'admin-status-dot';
            dom.rebuildProgressBar.classList.remove('indeterminate');
            dom.rebuildProgressBar.style.width = '100%';
            dom.rebuildStatusText.textContent = data.message || 'Index rebuilt';
            dom.rebuildBtn.disabled = false;
            showToast('Index rebuilt successfully!', 'success');
            fetchStatus();
        } catch (err) {
            dom.rebuildDot.className = 'admin-status-dot error';
            dom.rebuildProgressBar.classList.remove('indeterminate');
            dom.rebuildStatusText.textContent = `Error: ${err.message}`;
            dom.rebuildBtn.disabled = false;
            showToast(`Rebuild failed: ${err.message}`, 'error');
        }
    }

    // ============================================================
    //  EVENT HANDLERS
    // ============================================================

    function initEvents() {
        // Theme
        dom.themeToggle.addEventListener('click', toggleTheme);

        // Search – debounced
        const debouncedSearch = debounce((query) => performSearch(query), SEARCH_DEBOUNCE_MS);
        dom.searchInput.addEventListener('input', (e) => {
            const q = e.target.value;
            if (q.length > 0) {
                dom.searchClear.classList.remove('hidden');
                dom.searchShortcut.classList.add('hidden');
            } else {
                dom.searchClear.classList.add('hidden');
                dom.searchShortcut.classList.remove('hidden');
            }
            debouncedSearch(q);
        });

        dom.searchClear.addEventListener('click', () => {
            dom.searchInput.value = '';
            dom.searchClear.classList.add('hidden');
            dom.searchShortcut.classList.remove('hidden');
            hideResults();
            dom.searchInput.focus();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or / to focus search
            if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== dom.searchInput && document.activeElement.tagName !== 'INPUT')) {
                e.preventDefault();
                dom.searchInput.focus();
                dom.searchInput.select();
            }

            // Alt+T to toggle theme
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                toggleTheme();
            }

            // Escape to close modals
            if (e.key === 'Escape') {
                if (dom.compOverlay && !dom.compOverlay.classList.contains('hidden')) {
                    closeComparison();
                } else if (!dom.courseOverlay.classList.contains('hidden')) {
                    closeCourseDetail();
                } else if (document.activeElement === dom.searchInput) {
                    dom.searchInput.blur();
                }
            }
        });

        // Export results
        dom.exportResultsBtn.addEventListener('click', () => {
            if (currentResults.length > 0) {
                downloadJson(currentResults, `mgu-search-results-${Date.now()}.json`);
                showToast('Results exported', 'success');
            }
        });

        // Course detail
        if (dom.modalTabs) {
            dom.modalTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    dom.modalTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    const targetId = tab.getAttribute('data-target');
                    // Hide all panels
                    dom.courseBody.classList.add('hidden');
                    dom.coursePdfBody.classList.add('hidden');
                    dom.courseLinkBody.classList.add('hidden');

                    if (targetId === 'course-detail-body') {
                        dom.courseBody.classList.remove('hidden');
                    } else if (targetId === 'course-pdf-body') {
                        dom.coursePdfBody.classList.remove('hidden');
                        if (!dom.coursePdfBody.innerHTML) {
                            loadFullPdfTab();
                        }
                    } else if (targetId === 'course-link-body') {
                        dom.courseLinkBody.classList.remove('hidden');
                        if (!dom.courseLinkBody.innerHTML) {
                            loadLinkTab();
                        }
                    }
                });
            });
        }

        dom.courseCloseBtn.addEventListener('click', closeCourseDetail);
        dom.courseOverlay.addEventListener('click', (e) => {
            if (e.target === dom.courseOverlay) closeCourseDetail();
        });

        if (dom.courseCompareBtn) dom.courseCompareBtn.addEventListener('click', openComparison);

        dom.courseExportBtn.addEventListener('click', () => {
            if (currentCourseData) {
                const code = currentCourseData.course_code || currentCourseData.code || (currentCourseData.course && (currentCourseData.course.course_code || currentCourseData.course.code)) || 'course';
                downloadJson(currentCourseData, `mgu-${code}-${Date.now()}.json`);
                showToast('Course data exported', 'success');
            }
        });

        // Comparison (elements may not exist in static version)
        if (dom.compCloseBtn) dom.compCloseBtn.addEventListener('click', closeComparison);
        if (dom.compOverlay) dom.compOverlay.addEventListener('click', (e) => {
            if (e.target === dom.compOverlay) closeComparison();
        });

        // Admin (removed in static version)
        if (dom.adminToggle) dom.adminToggle.addEventListener('click', toggleAdmin);
        if (dom.adminClose) dom.adminClose.addEventListener('click', toggleAdmin);
        if (dom.crawlBtn) dom.crawlBtn.addEventListener('click', startCrawl);
        if (dom.parseBtn) dom.parseBtn.addEventListener('click', startParse);
        if (dom.rebuildBtn) dom.rebuildBtn.addEventListener('click', startRebuild);
    }

    // ============================================================
    //  INITIALISATION
    // ============================================================

    function init() {
        initTheme();
        initEvents();
        loadData();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
