// Orbit Tracker - Core Application Logic

// --- STATE MANAGEMENT ---
let state = {
    trackers: [],
    logs: {},
    rewards: [],
    redemptions: [],
    settings: {
        manualWeight: 50,
        streakTarget: 70,
        theme: 'dark'
    },
    parentPassword: '', // Passcode string (empty = unset)
    parentModeActive: false, // Tracks whether parent mode is unlocked
    currentDateStr: '' // YYYY-MM-DD format
};

// Default Trackers
const DEFAULT_TRACKERS = [
    { id: 't1', name: 'Drink 2L Water', type: 'habit', weight: 20, direction: 'positive' },
    { id: 't2', name: 'Exercise 30 mins', type: 'habit', weight: 30, direction: 'positive' },
    { id: 't3', name: 'Sleep Quality', type: 'rating', maxRating: 5, weight: 30, direction: 'positive' },
    { id: 't4', name: 'Focus Work', type: 'numeric', weight: 20, unit: 'hrs', goal: 6, direction: 'positive' }
];

// Default Rewards
const DEFAULT_REWARDS = [
    { id: 'r1', name: 'Cheat Meal / Treat', cost: 150 },
    { id: 'r2', name: '1 Hour of Video Games', cost: 100 },
    { id: 'r3', name: 'Buy Something Nice ($10)', cost: 500 },
    { id: 'r4', name: 'Take a Nap', cost: 50 }
];

// Helper: Format Date to YYYY-MM-DD
function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper: Date parser (converts YYYY-MM-DD to local Date object)
function parseDateLocal(dateStr) {
    const parts = dateStr.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

// Load state from LocalStorage
function loadState() {
    const savedState = localStorage.getItem('orbit_tracker_state');
    if (savedState) {
        try {
            state = JSON.parse(savedState);
            
            // Backwards compatibility additions
            if (!state.rewards || state.rewards.length === 0) {
                state.rewards = [...DEFAULT_REWARDS];
            }
            if (!state.redemptions) {
                state.redemptions = [];
            }
            if (state.parentPassword === undefined) {
                state.parentPassword = '';
            }
            
            // Ensure compatibility with negative direction, goal limits, and customizable rating scales
            state.trackers.forEach(t => {
                if (t.direction === undefined) {
                    t.direction = 'positive';
                }
                if (t.type === 'numeric' && t.goal === undefined) {
                    t.goal = 1;
                }
                if (t.type === 'rating' && t.maxRating === undefined) {
                    t.maxRating = 5;
                }
            });
        } catch (e) {
            console.error("Failed to parse saved state, resetting...", e);
            resetToDefaults();
        }
    } else {
        resetToDefaults();
    }
    
    state.parentModeActive = !state.parentPassword;
    
    if (!state.currentDateStr) {
        state.currentDateStr = formatDateLocal(new Date());
    }
}

// Save state to LocalStorage
function saveState() {
    localStorage.setItem('orbit_tracker_state', JSON.stringify(state));
}

// Reset state to defaults
function resetToDefaults() {
    state.trackers = [...DEFAULT_TRACKERS];
    state.rewards = [...DEFAULT_REWARDS];
    state.redemptions = [];
    state.logs = {};
    state.parentPassword = '';
    state.parentModeActive = true;
    state.settings = {
        manualWeight: 50,
        streakTarget: 70,
        theme: 'dark'
    };
    state.currentDateStr = formatDateLocal(new Date());
    saveState();
}

// --- POINTS SYSTEM CALCULATIONS ---
function calculateTotalPointsEarned() {
    return Object.values(state.logs).reduce((sum, log) => sum + (log.calculatedScore || 0), 0);
}

function calculateTotalPointsSpent() {
    return state.redemptions.reduce((sum, r) => sum + (r.cost || 0), 0);
}

function getPointsBalance() {
    return calculateTotalPointsEarned() - calculateTotalPointsSpent();
}

// --- SCORE CALCULATION ENGINE ---
function calculateDailyScore(trackerLogs = {}, manualRating = 70) {
    if (state.trackers.length === 0) {
        return Math.round(manualRating);
    }

    let positiveWeightSum = 0;
    let positiveWeightedScoreSum = 0;
    let totalDeductions = 0;

    state.trackers.forEach(tracker => {
        const val = trackerLogs[tracker.id];
        const dir = tracker.direction || 'positive';

        let scoreContribution = 0; // 0.0 to 1.2
        if (val !== undefined && val !== null) {
            if (tracker.type === 'habit') {
                scoreContribution = val ? 1.0 : 0.0;
            } else if (tracker.type === 'rating') {
                const max = Number(tracker.maxRating) || 5;
                scoreContribution = Number(val) / max;
            } else if (tracker.type === 'numeric') {
                const goal = Number(tracker.goal) || 1;
                scoreContribution = Math.min(Number(val) / goal, 1.2);
            }
        }
        
        if (dir === 'positive') {
            positiveWeightSum += Number(tracker.weight);
            positiveWeightedScoreSum += scoreContribution * Number(tracker.weight);
        } else {
            // Negative trackers deduct from the overall score
            totalDeductions += scoreContribution * Number(tracker.weight);
        }
    });

    let trackersPercentageScore = 100;
    if (positiveWeightSum > 0) {
        trackersPercentageScore = (positiveWeightedScoreSum / positiveWeightSum) * 100;
    }

    // Deduct penalties
    trackersPercentageScore = Math.max(trackersPercentageScore - totalDeductions, 0);

    const manualWeightPercent = Number(state.settings.manualWeight);
    const trackersWeightPercent = 100 - manualWeightPercent;

    const finalScore = (trackersPercentageScore * trackersWeightPercent / 100) + (Number(manualRating) * manualWeightPercent / 100);
    return Math.min(Math.max(Math.round(finalScore), 0), 100);
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent);"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeIn var(--transition-normal) reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// --- THEME MANAGEMENT ---
const sunIconSvg = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
const moonIconSvg = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const toggles = [document.getElementById('theme-toggle-desktop'), document.getElementById('theme-toggle-mobile')];
    
    toggles.forEach(toggle => {
        if (toggle) {
            toggle.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2">${theme === 'dark' ? sunIconSvg : moonIconSvg}</svg>`;
        }
    });
    
    state.settings.theme = theme;
    saveState();
}

// Toggle Theme
function toggleTheme() {
    const nextTheme = state.settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
}

// --- PARENT LOCK SECURITY ENGINE ---
function applyParentLockUI() {
    const toggleBtn = document.getElementById('btn-parent-lock-toggle');
    const lockIcon = document.getElementById('parent-lock-icon');
    const lockText = document.getElementById('parent-lock-text');
    
    const overlays = document.querySelectorAll('.parent-locked-cover');

    if (!state.parentPassword) {
        toggleBtn.style.backgroundColor = 'var(--bg-surface)';
        lockText.textContent = "Parent Lock Off";
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;
        overlays.forEach(overlay => overlay.style.display = 'none');
        return;
    }

    if (state.parentModeActive) {
        toggleBtn.style.backgroundColor = 'var(--accent-bg)';
        toggleBtn.style.color = 'var(--accent)';
        lockText.textContent = "Parent Mode Unlocked";
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>`;
        overlays.forEach(overlay => overlay.style.display = 'none');
    } else {
        toggleBtn.style.backgroundColor = 'var(--bg-surface)';
        toggleBtn.style.color = 'var(--text-primary)';
        lockText.textContent = "Parent Locked";
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;
        overlays.forEach(overlay => overlay.style.display = 'flex');
    }
}

function requestParentUnlock(onSuccessCallback = null) {
    if (!state.parentPassword) {
        state.parentModeActive = true;
        applyParentLockUI();
        if (onSuccessCallback) onSuccessCallback();
        return;
    }

    const modal = document.getElementById('parent-lock-modal');
    const input = document.getElementById('parent-passcode-prompt');
    input.value = '';
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    input.focus();

    const form = document.getElementById('form-parent-unlock');
    form.onsubmit = (e) => {
        e.preventDefault();
        if (input.value === state.parentPassword) {
            state.parentModeActive = true;
            applyParentLockUI();
            closeParentLockModal();
            showToast("Parent mode unlocked");
            if (onSuccessCallback) onSuccessCallback();
        } else {
            alert("Incorrect parent passcode!");
            input.value = '';
            input.focus();
        }
    };
}

function closeParentLockModal() {
    const modal = document.getElementById('parent-lock-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

document.getElementById('btn-parent-modal-close').addEventListener('click', closeParentLockModal);
document.getElementById('btn-parent-modal-cancel').addEventListener('click', closeParentLockModal);

document.getElementById('btn-parent-lock-toggle').addEventListener('click', () => {
    if (!state.parentPassword) {
        switchView('config');
        showToast("Please configure a Parent passcode below first.");
        document.getElementById('parent-pass-input').focus();
        return;
    }

    if (state.parentModeActive) {
        state.parentModeActive = false;
        applyParentLockUI();
        showToast("Parent settings locked");
    } else {
        requestParentUnlock();
    }
});

document.getElementById('form-parent-password').addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = document.getElementById('parent-pass-input').value;
    const confirmPass = document.getElementById('parent-pass-confirm').value;

    if (pass !== confirmPass) {
        alert("Passcodes do not match!");
        return;
    }

    state.parentPassword = pass;
    state.parentModeActive = !pass;
    saveState();
    
    document.getElementById('parent-pass-input').value = '';
    document.getElementById('parent-pass-confirm').value = '';
    
    applyParentLockUI();
    showToast(pass ? "Parent passcode configured successfully." : "Parent passcode removed.");
});

// --- STREAK & STATS CALCULATION ---
function updateStreakAndStats() {
    const threshold = Number(state.settings.streakTarget);
    const loggedDates = Object.keys(state.logs).sort();
    
    if (loggedDates.length === 0) {
        document.getElementById('stat-current-streak').textContent = '0';
        document.getElementById('stat-best-streak').textContent = '0';
        document.getElementById('stat-month-avg').textContent = '0%';
        document.getElementById('stat-completion').textContent = '0%';
        return;
    }

    const sortedLogs = loggedDates.map(dateStr => ({
        dateStr,
        date: parseDateLocal(dateStr),
        score: state.logs[dateStr].calculatedScore
    }));

    let bestStreak = 0;
    let currentStreak = 0;
    let tempStreak = 0;
    
    let prevDate = null;
    sortedLogs.forEach(log => {
        if (log.score >= threshold) {
            if (prevDate === null) {
                tempStreak = 1;
            } else {
                const diffTime = Math.abs(log.date - prevDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 1) {
                    tempStreak++;
                } else {
                    tempStreak = 1;
                }
            }
            bestStreak = Math.max(bestStreak, tempStreak);
            prevDate = log.date;
        } else {
            tempStreak = 0;
            prevDate = null;
        }
    });

    const today = new Date();
    const todayStr = formatDateLocal(today);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateLocal(yesterday);

    let streakAnchorDateStr = null;
    
    if (state.logs[todayStr] && state.logs[todayStr].calculatedScore >= threshold) {
        streakAnchorDateStr = todayStr;
    } else if (state.logs[yesterdayStr] && state.logs[yesterdayStr].calculatedScore >= threshold) {
        streakAnchorDateStr = yesterdayStr;
    }

    if (streakAnchorDateStr) {
        currentStreak = 1;
        let testDate = parseDateLocal(streakAnchorDateStr);
        
        while (true) {
            testDate.setDate(testDate.getDate() - 1);
            const testDateStr = formatDateLocal(testDate);
            if (state.logs[testDateStr] && state.logs[testDateStr].calculatedScore >= threshold) {
                currentStreak++;
            } else {
                break;
            }
        }
    } else {
        currentStreak = 0;
    }

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let monthScoresSum = 0;
    let monthLogsCount = 0;
    
    sortedLogs.forEach(log => {
        if (log.date.getMonth() === currentMonth && log.date.getFullYear() === currentYear) {
            monthScoresSum += log.score;
            monthLogsCount++;
        }
    });
    
    const monthAvg = monthLogsCount > 0 ? Math.round(monthScoresSum / monthLogsCount) : 0;

    let completionRate = 0;
    const currentLog = state.logs[state.currentDateStr];
    if (currentLog && state.trackers.length > 0) {
        let completedCount = 0;
        state.trackers.forEach(t => {
            const val = currentLog.trackerLogs[t.id];
            if (val !== undefined && val !== null) {
                if (t.type === 'habit' && t.direction === 'positive' && val === true) completedCount++;
                else if (t.type === 'habit' && t.direction === 'negative' && val === false) completedCount++;
                else if (t.type === 'rating') {
                    const passMark = Math.ceil((t.maxRating || 5) / 2);
                    if (Number(val) >= passMark) completedCount++;
                }
                else if (t.type === 'numeric' && Number(val) >= (Number(t.goal) || 1)) completedCount++;
            }
        });
        completionRate = Math.round((completedCount / state.trackers.length) * 100);
    }

    document.getElementById('stat-current-streak').textContent = currentStreak;
    document.getElementById('stat-best-streak').textContent = bestStreak;
    document.getElementById('stat-month-avg').textContent = `${monthAvg}%`;
    document.getElementById('stat-completion').textContent = `${completionRate}%`;

    const scores = sortedLogs.map(l => l.score);
    const highestScore = scores.length > 0 ? Math.max(...scores) : '-';
    const lowestScore = scores.length > 0 ? Math.min(...scores) : '-';
    document.getElementById('stat-highest-score').textContent = highestScore !== '-' ? `${highestScore}/100` : '-';
    document.getElementById('stat-lowest-score').textContent = lowestScore !== '-' ? `${lowestScore}/100` : '-';
    document.getElementById('stat-total-tracked').textContent = loggedDates.length;
    document.getElementById('stat-streak-target-val').textContent = `${threshold}+`;
}

// --- DYNAMIC LOGS RENDERING (CHECKLISTS) ---
function renderDashboardLogs() {
    const container = document.getElementById('daily-trackers-container');
    container.innerHTML = '';
    
    if (state.trackers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                No trackers configured yet. Go to <strong style="cursor: pointer; color: var(--accent);" onclick="switchView('trackers')">Manage Trackers</strong> to add one.
            </div>
        `;
        document.getElementById('log-status-badge').textContent = "Empty";
        updateScoreRing(0);
        return;
    }

    const logExists = !!state.logs[state.currentDateStr];
    document.getElementById('log-status-badge').textContent = logExists ? "Logged" : "Not Logged";
    document.getElementById('log-status-badge').style.backgroundColor = logExists ? "var(--accent-bg)" : "var(--bg-surface)";
    document.getElementById('log-status-badge').style.color = logExists ? "var(--accent)" : "var(--text-secondary)";

    const trackerLogs = logExists ? state.logs[state.currentDateStr].trackerLogs : {};
    const manualRating = logExists ? state.logs[state.currentDateStr].manualRating : 70;

    const buildTrackers = state.trackers.filter(t => (t.direction || 'positive') === 'positive');
    const avoidTrackers = state.trackers.filter(t => t.direction === 'negative');

    const renderTrackerRow = (tracker, groupContainer) => {
        const row = document.createElement('div');
        row.className = `tracker-row ${tracker.direction === 'negative' ? 'negative-tracker' : ''}`;
        
        let typeBadge = '';
        if (tracker.type === 'habit') {
            typeBadge = tracker.direction === 'negative' ? 'Avoid checklist' : 'Checklist';
        } else if (tracker.type === 'rating') {
            const maxVal = tracker.maxRating || 5;
            typeBadge = `Rating (1-${maxVal}) ${tracker.direction === 'negative' ? 'Penalty' : ''}`;
        } else if (tracker.type === 'numeric') {
            typeBadge = `Goal: ${tracker.goal} ${tracker.unit || ''} ${tracker.direction === 'negative' ? '(Avoid limit)' : ''}`;
        }

        row.innerHTML = `
            <div class="tracker-info" id="info-block-${tracker.id}">
                <span class="tracker-name">${tracker.name}</span>
                <span class="tracker-meta">${typeBadge} · Weight: <span style="font-weight:700;">${tracker.weight} pts</span></span>
            </div>
            <div class="tracker-input-wrapper" id="input-container-${tracker.id}"></div>
        `;
        
        groupContainer.appendChild(row);
        
        const infoBlock = document.getElementById(`info-block-${tracker.id}`);
        const inputWrapper = document.getElementById(`input-container-${tracker.id}`);
        const currentVal = trackerLogs[tracker.id];

        if (tracker.type === 'habit') {
            const isChecked = currentVal === true;
            inputWrapper.innerHTML = `
                <div class="custom-checkbox ${isChecked ? 'checked' : ''}" id="check-${tracker.id}">
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
            `;
            const checkbox = document.getElementById(`check-${tracker.id}`);
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
                const active = checkbox.classList.contains('checked');
                autoSaveIndividualTracker(tracker.id, active);
            });
        } 
        
        else if (tracker.type === 'rating') {
            const maxVal = tracker.maxRating || 5;
            
            if (maxVal <= 5) {
                let ratingHtml = '<div class="rating-buttons">';
                for (let i = 1; i <= maxVal; i++) {
                    const isSelected = Number(currentVal) === i;
                    ratingHtml += `<button class="rating-btn ${isSelected ? 'selected' : ''}" data-val="${i}">${i}</button>`;
                }
                ratingHtml += '</div>';
                inputWrapper.innerHTML = ratingHtml;

                const buttons = inputWrapper.querySelectorAll('.rating-btn');
                buttons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        buttons.forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        autoSaveIndividualTracker(tracker.id, Number(btn.getAttribute('data-val')));
                    });
                });
            } else {
                inputWrapper.style.display = 'none';
                
                const sliderVal = currentVal !== undefined ? currentVal : Math.round(maxVal / 2);

                const sliderBlock = document.createElement('div');
                sliderBlock.className = 'rating-slider-container';
                sliderBlock.innerHTML = `
                    <div class="rating-slider-header">
                        <span>Logged Rating: <strong id="rating-text-${tracker.id}" style="color:var(--accent); font-weight:800;">${currentVal !== undefined ? currentVal + '/' + maxVal : 'Not Rated'}</strong></span>
                    </div>
                    <input type="range" class="range-slider" id="rating-slide-${tracker.id}" min="1" max="${maxVal}" value="${sliderVal}">
                `;
                row.appendChild(sliderBlock);

                const slider = document.getElementById(`rating-slide-${tracker.id}`);
                const display = document.getElementById(`rating-text-${tracker.id}`);

                slider.addEventListener('input', (e) => {
                    display.textContent = `${e.target.value}/${maxVal}`;
                });
                
                slider.addEventListener('change', (e) => {
                    autoSaveIndividualTracker(tracker.id, Number(e.target.value));
                });
            }
        } 
        
        else if (tracker.type === 'numeric') {
            const numVal = currentVal !== undefined ? currentVal : '';
            inputWrapper.innerHTML = `
                <div class="numeric-wrapper">
                    <input type="number" class="numeric-input" id="num-${tracker.id}" min="0" placeholder="0" value="${numVal}">
                    <span class="numeric-unit">${tracker.unit || ''}</span>
                </div>
            `;
            const input = document.getElementById(`num-${tracker.id}`);
            input.addEventListener('change', () => {
                autoSaveIndividualTracker(tracker.id, input.value === '' ? null : Number(input.value));
            });
        }
    };

    if (buildTrackers.length > 0) {
        const header = document.createElement('div');
        header.className = 'tracker-group-header positive-header';
        header.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Habits to Build`;
        container.appendChild(header);
        buildTrackers.forEach(t => renderTrackerRow(t, container));
    }

    if (avoidTrackers.length > 0) {
        const header = document.createElement('div');
        header.className = 'tracker-group-header negative-header';
        header.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"></line></svg> Habits to Avoid`;
        container.appendChild(header);
        avoidTrackers.forEach(t => renderTrackerRow(t, container));
    }

    const manualSlider = document.getElementById('manual-rating-slider');
    const manualValText = document.getElementById('manual-rating-value');
    const manualWeightDisplay = document.getElementById('manual-weight-display');

    manualSlider.value = manualRating;
    manualValText.textContent = `${manualRating}/100`;
    manualWeightDisplay.textContent = state.settings.manualWeight;

    const initialScore = calculateDailyScore(trackerLogs, manualRating);
    updateScoreRing(initialScore);
}

function autoSaveIndividualTracker(trackerId, value) {
    let log = state.logs[state.currentDateStr];
    if (!log) {
        log = {
            date: state.currentDateStr,
            trackerLogs: {},
            manualRating: 70,
            calculatedScore: 0
        };
        state.logs[state.currentDateStr] = log;
    }

    if (value === null || value === undefined) {
        delete log.trackerLogs[trackerId];
    } else {
        log.trackerLogs[trackerId] = value;
    }

    log.calculatedScore = calculateDailyScore(log.trackerLogs, log.manualRating);
    saveState();
    updateScoreRing(log.calculatedScore);
    updateStreakAndStats();
    
    const badge = document.getElementById('log-status-badge');
    badge.textContent = "Logged";
    badge.style.backgroundColor = "var(--accent-bg)";
    badge.style.color = "var(--accent)";
}

function updateScoreRing(score) {
    const circle = document.getElementById('score-circle-progress');
    const valueText = document.getElementById('score-circle-value');
    const tierText = document.getElementById('score-circle-tier');
    const descText = document.getElementById('score-description');

    valueText.textContent = score;

    const isMobile = window.innerWidth <= 768;
    const r = isMobile ? 70 : 80;
    const perimeter = 2 * Math.PI * r;
    circle.style.strokeDasharray = perimeter;
    
    const offset = perimeter - (score / 100) * perimeter;
    circle.style.strokeDashoffset = offset;

    if (score === 0) {
        tierText.textContent = 'None';
        descText.textContent = 'Log your activities to begin calculations.';
    } else if (score < 50) {
        tierText.textContent = 'Poor';
        descText.textContent = 'Keep building consistency, every small action counts!';
    } else if (score < 70) {
        tierText.textContent = 'Fair';
        descText.textContent = 'Good effort! Push a bit further to reach your streak target.';
    } else if (score < 90) {
        tierText.textContent = 'Great';
        descText.textContent = 'Excellent tracking! You are maintaining a healthy orbit.';
    } else {
        tierText.textContent = 'Optimal';
        descText.textContent = 'Exceptional day! Perfect balance and goal achievements.';
    }
}

document.getElementById('manual-rating-slider').addEventListener('input', (e) => {
    const val = Number(e.target.value);
    document.getElementById('manual-rating-value').textContent = `${val}/100`;
    
    let log = state.logs[state.currentDateStr];
    if (!log) {
        log = {
            date: state.currentDateStr,
            trackerLogs: {},
            manualRating: 70,
            calculatedScore: 0
        };
        state.logs[state.currentDateStr] = log;
    }
    
    log.manualRating = val;
    log.calculatedScore = calculateDailyScore(log.trackerLogs, log.manualRating);
    saveState();
    updateScoreRing(log.calculatedScore);
    updateStreakAndStats();

    const badge = document.getElementById('log-status-badge');
    badge.textContent = "Logged";
    badge.style.backgroundColor = "var(--accent-bg)";
    badge.style.color = "var(--accent)";
});

// Date Picker
const hiddenDatePicker = document.createElement('input');
hiddenDatePicker.type = 'date';
hiddenDatePicker.style.position = 'absolute';
hiddenDatePicker.style.opacity = '0';
hiddenDatePicker.style.pointerEvents = 'none';
document.body.appendChild(hiddenDatePicker);

document.getElementById('current-date-display').addEventListener('click', () => {
    hiddenDatePicker.value = state.currentDateStr;
    hiddenDatePicker.showPicker();
});

hiddenDatePicker.addEventListener('change', () => {
    if (hiddenDatePicker.value) {
        state.currentDateStr = hiddenDatePicker.value;
        saveState();
        updateDateDisplay();
        renderDashboardLogs();
        updateStreakAndStats();
    }
});

document.getElementById('btn-prev-day').addEventListener('click', () => navigateDay(-1));
document.getElementById('btn-next-day').addEventListener('click', () => navigateDay(1));

function navigateDay(offset) {
    const curDate = parseDateLocal(state.currentDateStr);
    curDate.setDate(curDate.getDate() + offset);
    state.currentDateStr = formatDateLocal(curDate);
    saveState();
    updateDateDisplay();
    renderDashboardLogs();
    updateStreakAndStats();
}

function updateDateDisplay() {
    const curDate = parseDateLocal(state.currentDateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = formatDateLocal(curDate) === formatDateLocal(today);
    const isYesterday = formatDateLocal(curDate) === formatDateLocal(yesterday);

    let displayText = '';
    if (isToday) displayText = 'Today';
    else if (isYesterday) displayText = 'Yesterday';
    else {
        displayText = curDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    document.getElementById('current-date-display').textContent = displayText;
    
    const formatFull = curDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('sub-title').textContent = formatFull;
}

// --- CALENDAR VIEW ---
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();

document.getElementById('btn-calendar-prev').addEventListener('click', () => adjustCalendarMonth(-1));
document.getElementById('btn-calendar-next').addEventListener('click', () => adjustCalendarMonth(1));

function adjustCalendarMonth(offset) {
    calendarMonth += offset;
    if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
    } else if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
    }
    renderCalendarGrid();
}

function renderCalendarGrid() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendar-month-year').textContent = `${months[calendarMonth]} ${calendarYear}`;

    const container = document.getElementById('calendar-grid-container');
    container.innerHTML = '';

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        const label = document.createElement('div');
        label.className = 'calendar-day-label';
        label.textContent = day;
        container.appendChild(label);
    });

    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell empty';
        container.appendChild(cell);
    }

    const todayStr = formatDateLocal(new Date());

    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        
        const dateObj = new Date(calendarYear, calendarMonth, day);
        const dateStr = formatDateLocal(dateObj);
        
        const isToday = dateStr === todayStr;
        if (isToday) cell.classList.add('today');

        cell.innerHTML = `<div>${day}</div>`;

        const log = state.logs[dateStr];
        if (log) {
            const score = log.calculatedScore;
            
            let scoreClass = 'score-low';
            if (score >= 90) scoreClass = 'score-perfect';
            else if (score >= 70) scoreClass = 'score-high';
            else if (score >= 50) scoreClass = 'score-medium';

            cell.classList.add(scoreClass);
            cell.innerHTML += `<span class="calendar-cell-score">${score}</span>`;
        } else {
            cell.classList.add('score-none');
        }

        cell.addEventListener('click', () => {
            openDayLogModal(dateStr);
        });

        container.appendChild(cell);
    }
}

// --- CALENDAR MODAL ---
let modalActiveDateStr = '';

function openDayLogModal(dateStr) {
    modalActiveDateStr = dateStr;
    const dateObj = parseDateLocal(dateStr);
    document.getElementById('modal-date-title').textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const container = document.getElementById('modal-trackers-container');
    container.innerHTML = '';

    const log = state.logs[dateStr];
    const trackerLogs = log ? log.trackerLogs : {};
    const manualRating = log ? log.manualRating : 70;

    if (state.trackers.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No active trackers configured.</p>';
        return;
    }

    const buildTrackers = state.trackers.filter(t => (t.direction || 'positive') === 'positive');
    const avoidTrackers = state.trackers.filter(t => t.direction === 'negative');

    const renderModalRow = (tracker, groupContainer) => {
        const row = document.createElement('div');
        row.className = `tracker-row ${tracker.direction === 'negative' ? 'negative-tracker' : ''}`;
        row.style.padding = '10px 12px';
        
        let typeBadge = '';
        if (tracker.type === 'habit') {
            typeBadge = tracker.direction === 'negative' ? 'Avoid checklist' : 'Checklist';
        } else if (tracker.type === 'rating') {
            typeBadge = 'Rating';
        } else if (tracker.type === 'numeric') {
            typeBadge = `${tracker.goal} ${tracker.unit || ''}`;
        }

        row.innerHTML = `
            <div class="tracker-info" id="modal-info-${tracker.id}">
                <span class="tracker-name" style="font-size: 0.95rem;">${tracker.name}</span>
                <span class="tracker-meta" style="font-size: 0.75rem;">${typeBadge}</span>
            </div>
            <div class="tracker-input-wrapper" id="modal-input-container-${tracker.id}" style="min-width: 140px;"></div>
        `;
        groupContainer.appendChild(row);

        const inputWrapper = document.getElementById(`modal-input-container-${tracker.id}`);
        const currentVal = trackerLogs[tracker.id];

        if (tracker.type === 'habit') {
            const isChecked = currentVal === true;
            inputWrapper.innerHTML = `
                <div class="custom-checkbox ${isChecked ? 'checked' : ''}" id="modal-check-${tracker.id}" style="width:26px; height:26px;">
                    <svg viewBox="0 0 24 24" style="width:12px; height:12px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
            `;
            const checkbox = document.getElementById(`modal-check-${tracker.id}`);
            checkbox.addEventListener('click', () => checkbox.classList.toggle('checked'));
        } 
        
        else if (tracker.type === 'rating') {
            const maxVal = tracker.maxRating || 5;
            
            if (maxVal <= 5) {
                let ratingHtml = '<div class="rating-buttons" style="gap: 4px;">';
                for (let i = 1; i <= maxVal; i++) {
                    const isSelected = Number(currentVal) === i;
                    ratingHtml += `<button class="rating-btn ${isSelected ? 'selected' : ''}" data-val="${i}" style="width:28px; height:28px; font-size:0.75rem;">${i}</button>`;
                }
                ratingHtml += '</div>';
                inputWrapper.innerHTML = ratingHtml;

                const buttons = inputWrapper.querySelectorAll('.rating-btn');
                buttons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        buttons.forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                    });
                });
            } else {
                inputWrapper.style.display = 'none';
                
                const sliderVal = currentVal !== undefined ? currentVal : Math.round(maxVal / 2);
                const sliderBlock = document.createElement('div');
                sliderBlock.className = 'rating-slider-container';
                sliderBlock.innerHTML = `
                    <div class="rating-slider-header">
                        <span>Logged Rating: <strong id="modal-rating-text-${tracker.id}" style="color:var(--accent); font-weight:800;">${currentVal !== undefined ? currentVal + '/' + maxVal : 'Not Rated'}</strong></span>
                    </div>
                    <input type="range" class="range-slider" id="modal-rating-slide-${tracker.id}" min="1" max="${maxVal}" value="${sliderVal}">
                `;
                row.appendChild(sliderBlock);

                const slider = document.getElementById(`modal-rating-slide-${tracker.id}`);
                const display = document.getElementById(`modal-rating-text-${tracker.id}`);

                slider.addEventListener('input', (e) => {
                    display.textContent = `${e.target.value}/${maxVal}`;
                });
            }
        } 
        
        else if (tracker.type === 'numeric') {
            const numVal = currentVal !== undefined ? currentVal : '';
            inputWrapper.innerHTML = `
                <div class="numeric-wrapper" style="gap: 6px;">
                    <input type="number" class="numeric-input" id="modal-num-${tracker.id}" min="0" placeholder="0" value="${numVal}" style="width: 60px; padding: 4px 6px; font-size: 0.85rem; height: 32px;">
                    <span class="numeric-unit" style="font-size:0.75rem;">${tracker.unit || ''}</span>
                </div>
            `;
        }
    };

    if (buildTrackers.length > 0) {
        const header = document.createElement('div');
        header.className = 'tracker-group-header positive-header';
        header.style.margin = '4px 0 8px 0';
        header.textContent = 'Habits to Build';
        container.appendChild(header);
        buildTrackers.forEach(t => renderModalRow(t, container));
    }

    if (avoidTrackers.length > 0) {
        const header = document.createElement('div');
        header.className = 'tracker-group-header negative-header';
        header.style.margin = '12px 0 8px 0';
        header.textContent = 'Habits to Avoid';
        container.appendChild(header);
        avoidTrackers.forEach(t => renderModalRow(t, container));
    }

    const slider = document.getElementById('modal-manual-rating-slider');
    const valText = document.getElementById('modal-manual-rating-value');
    slider.value = manualRating;
    valText.textContent = `${manualRating}/100`;

    slider.oninput = (e) => {
        valText.textContent = `${e.target.value}/100`;
    };

    const overlay = document.getElementById('calendar-day-modal');
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
}

function closeDayLogModal() {
    const overlay = document.getElementById('calendar-day-modal');
    overlay.classList.remove('active');
    setTimeout(() => overlay.style.display = 'none', 300);
}

document.getElementById('btn-modal-close').addEventListener('click', closeDayLogModal);
document.getElementById('btn-modal-cancel').addEventListener('click', closeDayLogModal);
document.getElementById('btn-modal-save').addEventListener('click', saveModalLog);

function saveModalLog() {
    let log = state.logs[modalActiveDateStr];
    if (!log) {
        log = {
            date: modalActiveDateStr,
            trackerLogs: {},
            manualRating: 70,
            calculatedScore: 0
        };
        state.logs[modalActiveDateStr] = log;
    }

    state.trackers.forEach(tracker => {
        if (tracker.type === 'habit') {
            const checkbox = document.getElementById(`modal-check-${tracker.id}`);
            if (checkbox) {
                log.trackerLogs[tracker.id] = checkbox.classList.contains('checked');
            }
        } 
        else if (tracker.type === 'rating') {
            const maxVal = tracker.maxRating || 5;
            if (maxVal <= 5) {
                const wrapper = document.getElementById(`modal-input-container-${tracker.id}`);
                if (wrapper) {
                    const selected = wrapper.querySelector('.rating-btn.selected');
                    log.trackerLogs[tracker.id] = selected ? Number(selected.getAttribute('data-val')) : null;
                }
            } else {
                const slider = document.getElementById(`modal-rating-slide-${tracker.id}`);
                if (slider) {
                    log.trackerLogs[tracker.id] = Number(slider.value);
                }
            }
        } 
        else if (tracker.type === 'numeric') {
            const input = document.getElementById(`modal-num-${tracker.id}`);
            if (input) {
                log.trackerLogs[tracker.id] = input.value === '' ? null : Number(input.value);
            }
        }
    });

    log.manualRating = Number(document.getElementById('modal-manual-rating-slider').value);
    log.calculatedScore = calculateDailyScore(log.trackerLogs, log.manualRating);

    saveState();
    closeDayLogModal();
    showToast(`Logged score of ${log.calculatedScore} for ${parseDateLocal(modalActiveDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
    
    renderCalendarGrid();
    if (state.currentDateStr === modalActiveDateStr) {
        renderDashboardLogs();
    }
    updateStreakAndStats();
}

// --- NATIVE SVG TRENDS CHART ---
let activeTrendDays = 7;

document.getElementById('btn-trend-week').addEventListener('click', () => {
    activeTrendDays = 7;
    toggleTrendButtons('btn-trend-week', 'btn-trend-month');
    renderTrendChart();
});

document.getElementById('btn-trend-month').addEventListener('click', () => {
    activeTrendDays = 30;
    toggleTrendButtons('btn-trend-month', 'btn-trend-week');
    renderTrendChart();
});

function toggleTrendButtons(activeId, inactiveId) {
    document.getElementById(activeId).classList.remove('btn-secondary');
    document.getElementById(activeId).classList.add('btn-primary');
    document.getElementById(inactiveId).classList.remove('btn-primary');
    document.getElementById(inactiveId).classList.add('btn-secondary');
}

function renderTrendChart() {
    const container = document.getElementById('trend-chart-container');
    container.innerHTML = '';

    const dataPoints = [];
    const today = new Date();
    
    for (let i = activeTrendDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = formatDateLocal(d);
        const log = state.logs[dateStr];
        
        dataPoints.push({
            dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            score: log ? log.calculatedScore : 0,
            logged: !!log
        });
    }

    const width = container.clientWidth || 600;
    const height = 220;
    const paddingLeft = 35;
    const paddingBottom = 25;
    const paddingTop = 15;
    const paddingRight = 15;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    let svgContent = `<svg class="chart-svg" width="${width}" height="${height}">`;
    
    const accentColor = state.settings.theme === 'dark' ? '#ff6600' : '#0066ff';
    svgContent += `
        <defs>
            <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.0"/>
            </linearGradient>
        </defs>
    `;

    for (let i = 0; i <= 4; i++) {
        const yVal = 100 - i * 25;
        const yPos = paddingTop + (i * 25 / 100) * chartH;
        svgContent += `
            <line class="chart-grid-line" x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" />
            <text class="chart-axis-text" x="${paddingLeft - 8}" y="${yPos + 4}" text-anchor="end">${yVal}</text>
        `;
    }

    const pointsCount = dataPoints.length;
    const xCoord = (index) => paddingLeft + (index / (pointsCount - 1)) * chartW;
    const yCoord = (score) => paddingTop + chartH - (score / 100) * chartH;

    let linePathD = '';
    let areaPathD = '';
    
    dataPoints.forEach((pt, index) => {
        const x = xCoord(index);
        const y = yCoord(pt.score);

        if (index === 0) {
            linePathD = `M ${x} ${y}`;
            areaPathD = `M ${x} ${paddingTop + chartH} L ${x} ${y}`;
        } else {
            linePathD += ` L ${x} ${y}`;
            areaPathD += ` L ${x} ${y}`;
        }
        
        if (index === pointsCount - 1) {
            areaPathD += ` L ${x} ${paddingTop + chartH} Z`;
        }
    });

    svgContent += `<path class="chart-area" d="${areaPathD}" />`;
    svgContent += `<path class="chart-line" d="${linePathD}" />`;

    const stepLabel = activeTrendDays === 30 ? 5 : 1;
    
    dataPoints.forEach((pt, index) => {
        const x = xCoord(index);
        const y = yCoord(pt.score);

        if (pt.logged) {
            svgContent += `<circle class="chart-dot" cx="${x}" cy="${y}" onclick="openDayLogModal('${formatDateLocal(new Date(today.getTime() - (activeTrendDays - 1 - index) * 24 * 60 * 60 * 1000))}')"><title>${pt.dateLabel}: Score ${pt.score}</title></circle>`;
        } else {
            svgContent += `<circle cx="${x}" cy="${y}" r="3" fill="var(--text-tertiary)"></circle>`;
        }

        if (index % stepLabel === 0 || index === pointsCount - 1) {
            svgContent += `
                <text class="chart-axis-text" x="${x}" y="${height - 4}" text-anchor="middle">${pt.dateLabel}</text>
            `;
        }
    });

    svgContent += '</svg>';
    container.innerHTML = svgContent;

    renderInsights();
}

function renderInsights() {
    const container = document.getElementById('insights-container');
    container.innerHTML = '';

    if (state.trackers.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Add trackers to generate score analysis insights.</p>';
        return;
    }

    const logsList = Object.values(state.logs);
    if (logsList.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Log a few days to analyze tracker behaviors.</p>';
        return;
    }

    const stats = state.trackers.map(t => {
        let loggedCount = 0;
        let successfulCount = 0;

        logsList.forEach(log => {
            const val = log.trackerLogs[t.id];
            if (val !== undefined && val !== null) {
                loggedCount++;
                if (t.type === 'habit' && t.direction === 'positive' && val === true) successfulCount++;
                else if (t.type === 'habit' && t.direction === 'negative' && val === false) successfulCount++;
                else if (t.type === 'rating' && t.direction === 'positive' && Number(val) >= Math.ceil((t.maxRating || 5) * 0.8)) successfulCount++;
                else if (t.type === 'rating' && t.direction === 'negative' && Number(val) <= Math.ceil((t.maxRating || 5) * 0.4)) successfulCount++;
                else if (t.type === 'numeric' && t.direction === 'positive' && Number(val) >= (Number(t.goal) || 1)) successfulCount++;
                else if (t.type === 'numeric' && t.direction === 'negative' && Number(val) <= (Number(t.goal) || 1)) successfulCount++;
            }
        });

        const rate = loggedCount > 0 ? (successfulCount / loggedCount) : 0;
        return { tracker: t, rate, loggedCount };
    });

    const sortedStats = [...stats].sort((a, b) => b.rate - a.rate);
    const topHabit = sortedStats[0];
    const bottomHabit = sortedStats[sortedStats.length - 1];

    if (topHabit && topHabit.rate > 0) {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '12px';
        item.innerHTML = `
            <div style="width:36px; height:36px; border-radius:50%; background-color: rgba(74, 222, 128, 0.1); color:#4ade80; display:flex; align-items:center; justify-content:center; font-weight:800;">✓</div>
            <div>
                <div style="font-weight:700; font-size:0.95rem;">Most Consistent: ${topHabit.tracker.name}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary); font-weight:600;">You meet this goal ${Math.round(topHabit.rate * 100)}% of the time.</div>
            </div>
        `;
        container.appendChild(item);
    }

    if (bottomHabit && bottomHabit.rate < 0.6 && bottomHabit !== topHabit) {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '12px';
        item.style.marginTop = '8px';
        item.innerHTML = `
            <div style="width:36px; height:36px; border-radius:50%; background-color: rgba(251, 113, 133, 0.1); color:#fb7185; display:flex; align-items:center; justify-content:center; font-weight:800;">!</div>
            <div>
                <div style="font-weight:700; font-size:0.95rem;">Focus Target: ${bottomHabit.tracker.name}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary); font-weight:600;">Met only ${Math.round(bottomHabit.rate * 100)}% of the logged days. Consider adjusting point weights.</div>
            </div>
        `;
        container.appendChild(item);
    }

    if (container.children.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Keep tracking logs daily. Detailed insights are computed automatically.</p>';
    }
}

// --- TRACKER CONFIGURATION VIEW (CRUD) ---
document.getElementById('form-add-tracker').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.parentModeActive) {
        requestParentUnlock(() => submitTrackerForm());
    } else {
        submitTrackerForm();
    }
});

function submitTrackerForm() {
    const name = document.getElementById('tracker-name-input').value.trim();
    const type = document.getElementById('tracker-type-select').value;
    const direction = document.getElementById('tracker-direction-select').value;
    const weight = Number(document.getElementById('tracker-weight-input').value);
    const unit = document.getElementById('tracker-unit-input').value.trim();
    
    let goal = 1;
    let maxRating = 5;

    if (type === 'numeric') {
        const targetLabel = direction === 'negative' ? 'limit threshold' : 'target goal';
        const goalPrompt = prompt(`Enter daily ${targetLabel} for numeric metrics: "${name}"`, "8");
        if (goalPrompt === null) return;
        goal = Number(goalPrompt) || 1;
    } else if (type === 'rating') {
        maxRating = Number(document.getElementById('tracker-rating-scale-input').value) || 5;
    }

    const newTracker = {
        id: 't_' + Date.now(),
        name,
        type,
        direction,
        weight,
        maxRating: type === 'rating' ? maxRating : undefined,
        unit: type === 'numeric' ? unit : undefined,
        goal: type === 'numeric' ? goal : undefined
    };

    state.trackers.push(newTracker);
    saveState();
    
    document.getElementById('tracker-name-input').value = '';
    document.getElementById('tracker-weight-input').value = '10';
    document.getElementById('tracker-unit-input').value = '';
    document.getElementById('tracker-rating-scale-input').value = '5';
    
    renderConfigTrackersList();
    renderDashboardLogs();
    updateStreakAndStats();
    showToast(`Created tracker "${name}"`);
}

document.getElementById('tracker-type-select').addEventListener('change', (e) => {
    const unitGroup = document.getElementById('form-group-unit');
    const ratingScaleGroup = document.getElementById('form-group-rating-scale');
    
    unitGroup.style.display = e.target.value === 'numeric' ? 'flex' : 'none';
    ratingScaleGroup.style.display = e.target.value === 'rating' ? 'flex' : 'none';
});

function renderConfigTrackersList() {
    const container = document.getElementById('config-trackers-list');
    container.innerHTML = '';

    if (state.trackers.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No active trackers. Build your tracking checklist above.</p>';
        return;
    }

    state.trackers.forEach(tracker => {
        const item = document.createElement('div');
        item.className = 'config-tracker-item';
        
        let typeText = '';
        if (tracker.type === 'habit') typeText = 'Checklist';
        else if (tracker.type === 'rating') typeText = `Rating (1-${tracker.maxRating || 5})`;
        else if (tracker.type === 'numeric') typeText = `Numeric (Goal: ${tracker.goal} ${tracker.unit || ''})`;

        const dirBadge = (tracker.direction || 'positive') === 'negative'
            ? '<span class="badge-direction badge-negative">Deduct</span>'
            : '<span class="badge-direction badge-positive">Add</span>';

        item.innerHTML = `
            <div class="config-tracker-details">
                <span class="config-tracker-name">${tracker.name} ${dirBadge}</span>
                <span class="config-tracker-type-weight">${typeText} · Weight: ${tracker.weight} pts</span>
            </div>
            <div class="config-tracker-actions">
                <button class="btn-icon btn-danger" onclick="deleteTrackerTrigger('${tracker.id}')" aria-label="Delete Tracker">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

window.deleteTrackerTrigger = function(id) {
    if (!state.parentModeActive) {
        requestParentUnlock(() => actualDeleteTracker(id));
    } else {
        actualDeleteTracker(id);
    }
};

function actualDeleteTracker(id) {
    const tracker = state.trackers.find(t => t.id === id);
    if (!tracker) return;

    if (confirm(`Are you sure you want to delete tracker "${tracker.name}"?`)) {
        state.trackers = state.trackers.filter(t => t.id !== id);
        
        Object.keys(state.logs).forEach(dateStr => {
            if (state.logs[dateStr].trackerLogs[id] !== undefined) {
                delete state.logs[dateStr].trackerLogs[id];
                state.logs[dateStr].calculatedScore = calculateDailyScore(state.logs[dateStr].trackerLogs, state.logs[dateStr].manualRating);
            }
        });

        saveState();
        renderConfigTrackersList();
        renderDashboardLogs();
        updateStreakAndStats();
        showToast(`Deleted tracker "${tracker.name}"`);
    }
}

// --- SYSTEM SETTINGS CONFIG ---
document.getElementById('btn-save-settings').addEventListener('click', () => {
    if (!state.parentModeActive) {
        requestParentUnlock(() => submitSettingsForm());
    } else {
        submitSettingsForm();
    }
});

function submitSettingsForm() {
    const manualWeight = Number(document.getElementById('overall-rating-weight').value);
    const streakTarget = Number(document.getElementById('streak-target-score').value);

    if (manualWeight < 0 || manualWeight > 100) {
        alert('Manual rating weight must be between 0 and 100%.');
        return;
    }

    state.settings.manualWeight = manualWeight;
    state.settings.streakTarget = streakTarget;
    saveState();

    Object.keys(state.logs).forEach(dateStr => {
        const log = state.logs[dateStr];
        log.calculatedScore = calculateDailyScore(log.trackerLogs, log.manualRating);
    });

    saveState();
    renderDashboardLogs();
    updateStreakAndStats();
    showToast('Settings saved and scores re-indexed successfully.');
}

function loadSettingsInputs() {
    document.getElementById('overall-rating-weight').value = state.settings.manualWeight;
    document.getElementById('streak-target-score').value = state.settings.streakTarget;
}

// --- REWARDS STORE ---
document.getElementById('form-add-reward').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.parentModeActive) {
        requestParentUnlock(() => submitRewardForm());
    } else {
        submitRewardForm();
    }
});

function submitRewardForm() {
    const name = document.getElementById('reward-name-input').value.trim();
    const cost = Number(document.getElementById('reward-cost-input').value);

    const newReward = {
        id: 'r_' + Date.now(),
        name,
        cost
    };

    state.rewards.push(newReward);
    saveState();

    document.getElementById('reward-name-input').value = '';
    document.getElementById('reward-cost-input').value = '100';

    renderRewardsStore();
    showToast(`Created custom reward: "${name}"`);
}

function renderRewardsStore() {
    const balance = getPointsBalance();
    document.getElementById('points-balance-value').textContent = balance;
    document.getElementById('points-total-earned').textContent = calculateTotalPointsEarned();
    document.getElementById('points-total-spent').textContent = calculateTotalPointsSpent();

    const container = document.getElementById('rewards-redeem-container');
    container.innerHTML = '';

    if (state.rewards.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1; padding: 2rem;">No rewards configured in store.</p>';
    } else {
        state.rewards.forEach(reward => {
            const card = document.createElement('div');
            card.className = 'reward-card';
            
            const isAffordable = balance >= reward.cost;

            card.innerHTML = `
                <div class="reward-title">${reward.name}</div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                    <span class="reward-cost">${reward.cost} <span>pts</span></span>
                    <button class="btn btn-primary btn-sm ${isAffordable ? '' : 'btn-disabled'}" 
                        style="padding: 6px 12px; font-size: 0.8rem; min-height:36px;" 
                        onclick="redeemReward('${reward.id}')"
                        ${isAffordable ? '' : 'disabled'}>
                        Redeem
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    const manageList = document.getElementById('config-rewards-list');
    manageList.innerHTML = '';
    
    state.rewards.forEach(reward => {
        const item = document.createElement('div');
        item.className = 'config-tracker-item';
        item.innerHTML = `
            <div class="config-tracker-details">
                <span class="config-tracker-name">${reward.name}</span>
                <span class="config-tracker-type-weight">Cost: ${reward.cost} points</span>
            </div>
            <div class="config-tracker-actions">
                <button class="btn-icon btn-danger" onclick="deleteRewardTrigger('${reward.id}')" aria-label="Delete Reward">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        manageList.appendChild(item);
    });

    const historyList = document.getElementById('rewards-history-list');
    historyList.innerHTML = '';
    
    if (state.redemptions.length === 0) {
        historyList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.8rem; text-align: center; padding: 1rem;">No rewards redeemed yet. Keep tracking to save points!</p>';
    } else {
        [...state.redemptions].reverse().forEach(red => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '8px 12px';
            item.style.backgroundColor = 'var(--bg-surface)';
            item.style.borderRadius = 'var(--radius-sm)';
            item.style.border = '1px solid var(--border-color)';
            
            const localDate = parseDateLocal(red.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            item.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-weight:700; font-size:0.85rem;">${red.rewardName}</span>
                    <span style="font-size:0.7rem; color:var(--text-secondary); font-weight:600;">${localDate}</span>
                </div>
                <span style="color:#ff3333; font-weight:800; font-size:0.9rem;">-${red.cost} pts</span>
            `;
            historyList.appendChild(item);
        });
    }
}

window.deleteRewardTrigger = function(id) {
    if (!state.parentModeActive) {
        requestParentUnlock(() => actualDeleteReward(id));
    } else {
        actualDeleteReward(id);
    }
};

function actualDeleteReward(id) {
    const reward = state.rewards.find(r => r.id === id);
    if (!reward) return;

    if (confirm(`Delete reward "${reward.name}" from store?`)) {
        state.rewards = state.rewards.filter(r => r.id !== id);
        saveState();
        renderRewardsStore();
        showToast(`Deleted reward "${reward.name}"`);
    }
}

window.redeemReward = function(id) {
    const reward = state.rewards.find(r => r.id === id);
    if (!reward) return;

    const balance = getPointsBalance();
    if (balance < reward.cost) {
        alert("Insufficient points balance!");
        return;
    }

    if (confirm(`Redeem "${reward.name}" for ${reward.cost} points?`)) {
        const redemption = {
            id: 'red_' + Date.now(),
            rewardId: reward.id,
            rewardName: reward.name,
            cost: reward.cost,
            date: formatDateLocal(new Date())
        };

        state.redemptions.push(redemption);
        saveState();
        
        renderRewardsStore();
        showToast(`Successfully redeemed "${reward.name}"! Enjoy!`);
    }
};

// --- VIEW NAVIGATION ROUTER ---
function switchView(viewName) {
    const panels = document.querySelectorAll('.view-panel');
    panels.forEach(p => p.classList.remove('active'));
    
    const targetPanel = document.getElementById(`view-${viewName}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        if (item.getAttribute('data-view') === viewName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    bottomNavItems.forEach(item => {
        if (item.getAttribute('data-view') === viewName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const titles = {
        dashboard: 'Dashboard',
        trends: 'Trends & Charts',
        calendar: 'Calendar History',
        rewards: 'Rewards Store',
        trackers: 'Manage Trackers',
        config: 'Rules & Settings'
    };
    
    document.getElementById('current-view-title').textContent = titles[viewName] || 'Orbit Tracker';

    if (viewName === 'dashboard') {
        renderDashboardLogs();
        updateStreakAndStats();
    } else if (viewName === 'trends') {
        renderTrendChart();
    } else if (viewName === 'calendar') {
        renderCalendarGrid();
    } else if (viewName === 'rewards') {
        renderRewardsStore();
    } else if (viewName === 'trackers') {
        renderConfigTrackersList();
    } else if (viewName === 'config') {
        loadSettingsInputs();
    }
}

window.switchView = switchView;

const navigationSelectors = [...document.querySelectorAll('.sidebar-item'), ...document.querySelectorAll('.bottom-nav-item')];
navigationSelectors.forEach(el => {
    el.addEventListener('click', () => {
        const view = el.getAttribute('data-view');
        switchView(view);
    });
});

document.getElementById('theme-toggle-desktop').addEventListener('click', toggleTheme);
const mobileThemeBtn = document.getElementById('theme-toggle-mobile');
if (mobileThemeBtn) {
    mobileThemeBtn.addEventListener('click', toggleTheme);
}

function adjustLayoutForMobile() {
    const isMobile = window.innerWidth <= 768;
    const desktopThemeBtn = document.getElementById('theme-toggle-desktop');
    const mobileThemeBtn = document.getElementById('theme-toggle-mobile');
    
    if (isMobile) {
        if (desktopThemeBtn) desktopThemeBtn.style.display = 'none';
        if (mobileThemeBtn) mobileThemeBtn.style.display = 'flex';
    } else {
        if (desktopThemeBtn) desktopThemeBtn.style.display = 'flex';
        if (mobileThemeBtn) mobileThemeBtn.style.display = 'none';
    }
}

window.addEventListener('resize', () => {
    adjustLayoutForMobile();
    const trendsActive = document.getElementById('view-trends').classList.contains('active');
    if (trendsActive) {
        renderTrendChart();
    }
});

// --- APPLICATION INITIALIZATION ---
function init() {
    loadState();
    applyTheme(state.settings.theme);
    adjustLayoutForMobile();
    applyParentLockUI();
    updateDateDisplay();
    renderDashboardLogs();
    updateStreakAndStats();
}

window.addEventListener('DOMContentLoaded', init);
