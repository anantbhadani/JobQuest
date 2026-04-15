/**
 * JobQuest - Premium Job Search & Application Management
 */

const CONFIG = {
    API_BASE: 'https://jobs.indianapi.in',
    PROXY_URL: 'https://corsproxy.io/?',
    LOCAL_STORAGE_KEY: 'jobquest_api_key'
};

// --- STATE ---
let jobs = [];
let trackedJobs = [];
let userProfile = { resume: '' };
let userApiKey = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY) || '';
let currentTab = 'search';
let isFetching = false;
let lastRequestTime = 0;
const RATE_LIMIT_MS = 2000;

// --- DOM ELEMENTS ---
const elements = {
    // Nav
    tabs: document.querySelectorAll('.tab-btn'),
    views: document.querySelectorAll('.view-content'),
    settingsBtn: document.getElementById('settings-btn'),
    
    // Modals
    settingsModal: document.getElementById('settings-modal'),
    closeModal: document.getElementById('close-modal'),
    apiKeyInput: document.getElementById('api-key-input'),
    saveApiKeyBtn: document.getElementById('save-api-key'),
    
    // Search
    searchBtn: document.getElementById('search-btn'),
    jobTitleInput: document.getElementById('job-title-input'),
    locationInput: document.getElementById('location-input'),
    jobsGrid: document.getElementById('jobs-grid'),
    statusContainer: document.getElementById('status-container'),
    mainLoader: document.getElementById('main-loader'),
    statusText: document.getElementById('status-text'),

    // Tracker
    trackerGrid: document.getElementById('tracker-grid'),
    statTotal: document.getElementById('stat-total'),
    statProgress: document.getElementById('stat-progress'),
    statRejected: document.getElementById('stat-rejected'),

    // Analyser
    resumeDisplay: document.getElementById('resume-display'),
    resumeEditMode: document.getElementById('resume-edit-mode'),
    resumeInput: document.getElementById('resume-input'),
    editResumeBtn: document.getElementById('edit-resume-btn'),
    saveResumeBtn: document.getElementById('save-resume-btn'),
    cancelResumeBtn: document.getElementById('cancel-resume-btn'),
    jdInput: document.getElementById('jd-input'),
    analyseBtn: document.getElementById('analyse-btn'),
    analysisResult: document.getElementById('analysis-result')
};

// --- INITIALIZE ---
async function init() {
    if (window.location.protocol === 'file:') {
        alert('CRITICAL: Running from a file directly! \n\nPlease run "npm start" to use the Database features.');
        return;
    }

    setupEventListeners();
    
    // Load existing data
    await loadTrackedJobs();
    await loadProfile();

    if (userApiKey) {
        elements.apiKeyInput.value = userApiKey;
        fetchJobs();
    } else {
        showModal();
    }
}

function setupEventListeners() {
    // Tab Switching
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Search
    elements.settingsBtn.addEventListener('click', showModal);
    elements.closeModal.addEventListener('click', hideModal);
    elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
    elements.searchBtn.addEventListener('click', fetchJobs);
    
    // Resume Editing
    elements.editResumeBtn.addEventListener('click', toggleResumeEdit);
    elements.cancelResumeBtn.addEventListener('click', toggleResumeEdit);
    elements.saveResumeBtn.addEventListener('click', saveProfile);
    elements.analyseBtn.addEventListener('click', runAnalysis);
    
    // File Upload
    const fileInput = document.getElementById('resume-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) hideModal();
    });

    // Enter key support for inputs
    [elements.jobTitleInput, elements.locationInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fetchJobs();
        });
    });
}

// --- FILE UPLOAD LOGIC ---

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    elements.resumeDisplay.innerText = '⏳ Extracting text from file...';
    elements.resumeDisplay.classList.remove('empty');

    try {
        let text = '';
        if (file.type === 'application/pdf') {
            text = await extractPdfText(file);
        } else {
            text = await file.text();
        }

        if (text && text.trim().length > 10) {
            elements.resumeInput.value = text;
            await saveProfile(); // Auto-save after upload
            alert('Resume uploaded and saved successfully!');
        } else {
            throw new Error('Could not extract meaningful text from file.');
        }
    } catch (error) {
        console.error('Upload Error:', error);
        alert('Error: ' + error.message);
        renderProfile();
    }
}

async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    
    // Set worker source (required for PDF.js)
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        fullText += strings.join(' ') + '\n';
    }

    return fullText;
}

// --- NAVIGATION ---
function switchTab(tabId) {
    currentTab = tabId;
    elements.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    elements.views.forEach(v => v.classList.toggle('active', v.id === `${tabId}-view`));
    
    if (tabId === 'tracker') renderTracker();
}

// --- DATABASE API CALLS ---

async function loadTrackedJobs() {
    try {
        const res = await fetch('/api/jobs');
        trackedJobs = await res.json();
        renderTracker();
    } catch (e) { console.error('DB Error:', e); }
}

async function loadProfile() {
    try {
        const res = await fetch('/api/profile');
        userProfile = await res.json();
        renderProfile();
    } catch (e) { console.error('DB Error:', e); }
}

async function saveProfile() {
    const text = elements.resumeInput.value.trim();
    if (!text) return;

    try {
        const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resume: text })
        });
        userProfile = await res.json();
        renderProfile();
        toggleResumeEdit();
    } catch (e) { alert('Failed to save profile'); }
}

async function addToTracker(job) {
    try {
        const res = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: job.title,
                company: job.company,
                location: job.location,
                applyLink: job.apply_link,
                jobDescription: job.job_description
            })
        });
        const savedJob = await res.json();
        trackedJobs.unshift(savedJob);
        alert('Added to Tracker!');
        renderTracker();
    } catch (e) { alert('Failed to track job'); }
}

async function updateJobStatus(id, status) {
    try {
        await fetch(`/api/jobs/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        trackedJobs = trackedJobs.map(j => j.id === id ? { ...j, status } : j);
        renderTracker();
    } catch (e) { console.error(e); }
}

async function deleteTrackedJob(id) {
    if (!confirm('Remove this job from tracker?')) return;
    try {
        await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
        trackedJobs = trackedJobs.filter(j => j.id !== id);
        renderTracker();
    } catch (e) { console.error(e); }
}

// --- SEARCH & EXTERNAL API ---

async function fetchJobs() {
    if (!userApiKey) { showModal(); return; }

    const now = Date.now();
    if (isFetching || (now - lastRequestTime < RATE_LIMIT_MS)) return;

    isFetching = true;
    elements.searchBtn.disabled = true;
    lastRequestTime = now;

    updateStatus(true);
    elements.jobsGrid.innerHTML = ''; 

    try {
        const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: elements.jobTitleInput.value.trim(),
                location: elements.locationInput.value.trim(),
                apiKey: userApiKey
            })
        });
        
        const responseData = await res.json();
        jobs = Array.isArray(responseData) ? responseData : [];
        renderJobs();
    } catch (error) {
        updateStatus(false, 'Search failed. Please check your API key in settings.');
    } finally {
        isFetching = false;
        elements.searchBtn.disabled = false;
    }
}

// --- RENDERING ---

function renderJobs() {
    elements.jobsGrid.innerHTML = '';
    updateStatus(false);
    if (jobs.length === 0) return;

    jobs.forEach((job, index) => {
        const card = createJobCard(job, index, false);
        elements.jobsGrid.appendChild(card);
    });
}

function renderTracker() {
    elements.trackerGrid.innerHTML = '';
    
    // Updates stats
    elements.statTotal.innerText = trackedJobs.length;
    elements.statProgress.innerText = trackedJobs.filter(j => j.status === 'In Progress').length;
    elements.statRejected.innerText = trackedJobs.filter(j => j.status === 'Rejected').length;

    if (trackedJobs.length === 0) {
        elements.trackerGrid.innerHTML = '<p class="initial-message">No jobs tracked yet. Find a job and click "Track Application".</p>';
        return;
    }

    trackedJobs.forEach((job, index) => {
        const card = createJobCard(job, index, true);
        elements.trackerGrid.appendChild(card);
    });
}

function createJobCard(job, index, isTracker) {
    const card = document.createElement('div');
    card.className = `job-card animate-in`;
    card.style.animationDelay = `${index * 0.05}s`;
    
    const companyInitial = job.company ? job.company.charAt(0) : 'J';
    const statusClass = `status-${(job.status || '').toLowerCase().replace(' ', '')}`;

    card.innerHTML = `
        <div class="job-card-header">
            <div class="company-logo">${companyInitial}</div>
            ${isTracker ? `<span class="status-tag ${statusClass}">${job.status}</span>` : `<span class="job-type-badge">${job.job_type || 'Full Time'}</span>`}
        </div>
        <div>
            <h3 class="job-title">${job.title}</h3>
            <span class="company-name">${job.company}</span>
        </div>
        <div class="job-details-brief">
            <div class="detail-item"><span>${job.location || 'Remote'}</span></div>
        </div>
        <p class="job-description-excerpt">${job.job_description || job.jobDescription || 'No description.'}</p>
        
        <div class="job-card-footer">
            ${isTracker ? `
                <div class="tracker-actions">
                    <button onclick="updateJobStatus('${job.id}', 'In Progress')" class="btn-status">Progress</button>
                    <button onclick="updateJobStatus('${job.id}', 'Rejected')" class="btn-status">Reject</button>
                    <button onclick="deleteTrackedJob('${job.id}')" class="btn-status">Remove</button>
                </div>
            ` : `
                <button class="btn btn-primary btn-small track-btn">Track Job</button>
                <a href="${job.apply_link}" target="_blank" class="btn-apply btn-primary">Apply</a>
            `}
        </div>
    `;

    if (!isTracker) {
        card.querySelector('.track-btn').onclick = (e) => {
            e.stopPropagation();
            addToTracker(job);
        };
    }

    return card;
}

// --- RESUME ANALYSER LOGIC ---

function renderProfile() {
    const hasResume = !!userProfile.resume;
    elements.resumeDisplay.innerText = userProfile.resume || 'No resume stored. Click edit to add yours.';
    elements.resumeDisplay.classList.toggle('empty', !hasResume);
    elements.resumeInput.value = userProfile.resume || '';
}

function toggleResumeEdit() {
    const isEdit = elements.resumeEditMode.classList.toggle('hidden');
    elements.resumeDisplay.classList.toggle('hidden', !isEdit);
}

function runAnalysis() {
    const jd = elements.jdInput.value.trim();
    if (!userProfile.resume) return alert('Please save your resume first!');
    if (!jd) return alert('Paste a JD to analyse!');

    elements.analysisResult.classList.remove('hidden');
    elements.analysisResult.innerHTML = `
        <div class="analysis-card d-flex align-center justify-center" style="min-height: 200px;">
            <div class="loading-spinner"></div>
            <p style="margin-left: 15px;">Scanning Resume & Job Description...</p>
        </div>
    `;

    setTimeout(() => {
        const results = performSemanticMatch(userProfile.resume, jd);
        renderAnalysis(results);
    }, 1200);
}

function performSemanticMatch(resume, jd) {
    // List of common words to ignore for a cleaner analysis
    const stopWords = new Set(['that', 'with', 'from', 'this', 'their', 'other', 'which', 'about', 'would', 'could', 'should', 'there', 'where', 'when', 'into', 'only', 'some', 'than', 'then', 'very', 'been', 'being', 'have', 'your', 'will', 'also', 'each', 'most', 'them', 'they', 'were', 'what', 'more', 'both', 'such', 'well']);
    
    const clean = (text) => text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w));

    const resumeWords = new Set(clean(resume));
    const jdWords = clean(jd);
    
    const uniqueJdKeywords = [...new Set(jdWords)];
    const matches = uniqueJdKeywords.filter(w => resumeWords.has(w));
    const missing = uniqueJdKeywords.filter(w => !resumeWords.has(w)).slice(0, 18);
    
    const score = Math.round((matches.length / uniqueJdKeywords.length) * 100) || 0;
    
    return { score, matches, missing };
}

function renderAnalysis(data) {
    const feedback = data.score > 75 ? 'Excellent Match!' : data.score > 40 ? 'Good Potential' : 'Needs Improvement';
    const scoreColor = data.score > 75 ? '#10b981' : data.score > 40 ? '#fbbf24' : '#f43f5e';

    elements.analysisResult.innerHTML = `
        <div class="analysis-dashboard animate-in">
            <!-- Left: Score Card -->
            <div class="analysis-card score-card">
                <div class="match-score-radial" style="--percentage: ${data.score}%; --score-color: ${scoreColor}">
                    <div class="score-value">${data.score}%</div>
                </div>
                <h3>${feedback}</h3>
                <p class="mt-2" style="color: var(--text-muted); font-size: 0.9rem;">
                    Your profile matches ${data.matches.length} out of ${data.matches.length + data.missing.length} identified technical requirements.
                </p>

                <button onclick="trackAnalysedJob(${data.score})" class="btn-track-analysis">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle; margin-right: 6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Track this Opportunity
                </button>

                <div class="mt-4" style="text-align: left; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; border: 1px solid var(--glass-border);">
                    <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                        <strong style="color: var(--text-main);">Pro Tip:</strong> Customizing your summary to include these missing keywords can help you pass through automated screening systems more effectively.
                    </p>
                </div>
            </div>

            <!-- Right: Keyword Cloud Card -->
            <div class="keyword-sections-wrapper">
                <div class="keyword-card">
                    <span class="keyword-label">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#10b981" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Matched Strengths (${data.matches.length})
                    </span>
                    <div class="keyword-list">
                        ${data.matches.map(m => `<span class="keyword-badge match">${m}</span>`).join('')}
                    </div>
                </div>

                <div class="keyword-card">
                    <span class="keyword-label">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#f43f5e" stroke-width="3" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Missing Critical Skills (${data.missing.length})
                    </span>
                    <div class="keyword-list">
                        ${data.missing.map(m => `<span class="keyword-badge missing">${m}</span>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function trackAnalysedJob(score) {
    const jd = elements.jdInput.value.trim();
    if (!jd) return;

    // --- SMART EXTRACTION LOGIC ---
    // 1. Try to find Company
    let company = 'Pasted Company';
    const subsidiaryMatch = jd.match(/Subsidiary:\s*([^\n\r]+)/i);
    const atMatch = jd.match(/at\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    
    if (subsidiaryMatch) company = subsidiaryMatch[1].trim();
    else if (atMatch) company = atMatch[1].trim();

    // 2. Try to find Title
    let title = 'Software Opportunity';
    const lines = jd.split('\n').filter(l => l.trim().length > 5);
    if (lines.length > 0) {
        // Use the first non-empty line as a potential title if it's short, otherwise use first 5 words
        const firstLine = lines[0].trim();
        title = firstLine.length < 50 ? firstLine : firstLine.split(' ').slice(0, 5).join(' ') + '...';
    }

    try {
        const res = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                company: company,
                location: 'Analysed View',
                applyLink: '',
                jobDescription: jd,
                matchScore: score
            })
        });
        const savedJob = await res.json();
        trackedJobs.unshift(savedJob);
        alert(`✅ Tracked as "${title}" at ${company}`);
    } catch (e) {
        console.error(e);
        alert('Failed to track job automatically.');
    }
}

// --- HELPERS ---

function showModal() { elements.settingsModal.classList.add('active'); }
function hideModal() { elements.settingsModal.classList.remove('active'); }
function saveApiKey() {
    const key = elements.apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, key);
        location.reload();
    }
}
function updateStatus(loading, msg) {
    const container = elements.statusContainer;
    const loader = elements.mainLoader;
    const text = elements.statusText;

    if (loading) {
        container.classList.remove('hidden');
        loader.classList.remove('hidden');
        text.innerText = msg || 'Hunting for opportunities...';
    } else {
        if (msg) {
            container.classList.remove('hidden');
            loader.classList.add('hidden');
            text.innerText = msg;
        } else if (!userApiKey) {
            container.classList.remove('hidden');
            loader.classList.add('hidden');
            text.innerText = 'Enter your API key in settings to start exploring.';
        } else if (currentTab === 'search' && jobs.length === 0) {
            container.classList.remove('hidden');
            loader.classList.add('hidden');
            text.innerText = 'No jobs found. Try adjusting your search.';
        } else {
            container.classList.add('hidden');
        }
    }
}

// Global scope helpers for onclick handlers
window.updateJobStatus = updateJobStatus;
window.deleteTrackedJob = deleteTrackedJob;
window.trackAnalysedJob = trackAnalysedJob;

document.addEventListener('DOMContentLoaded', init);
