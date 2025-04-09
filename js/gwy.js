// --- script.js (Revamped - setupCardAnimation call removed) ---

document。addEventListener('DOMContentLoaded',() => {
    // --- 配置项 ---
    const config = {
        estimatedRegDate: '2025-10-15',
        estimatedExamDate: '2025-11-30',
        localStorageKeys: { // Group keys for clarity
            progress: 'dxcGwyPlanProgress_v2',
            notes: 'dxcGwyPlanNotes_v2',
            course: 'dxcGwyCourseTracker_v2',
            pomodoro: 'dxcGwyPomodoroSettings_v2',
            summary: 'dxcGwySummaryData_v1' // For dashboard summary
        },
        pomodoroDefaults: { work: 25, shortBreak: 5, longBreak: 15, longBreakInterval: 4 }
    };

    // --- DOM 元素获取 ---
    // Layout & Navigation
    const sidebarNavLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const contentSections = document.querySelectorAll('.main-content .content-section');
    const currentTimeElement = document.getElementById('current-time');
    // Dashboard
    const countdownRegMain = document.getElementById('countdown-days-reg-main');
    const countdownExamMain = document.getElementById('countdown-days-exam-main');
    const summaryTasks = document.getElementById('summary-tasks-completed');
    const summaryCourse = document.getElementById('summary-course-progress');
    const summaryPomodoro = document.getElementById('summary-pomodoro-count');
    // Timeline & Tasks
    const allCheckboxes = document.querySelectorAll('.task-checkbox');
    const accordionHeaders = document.querySelectorAll('.accordion .accordion-header');
    // Notes
    const noteTextareas = document.querySelectorAll('.notes-textarea'); // Includes phase, general, course
    const generalNotesTextarea = document.getElementById('notes-general');
    const saveNotesButton = document.getElementById('save-notes-btn');
    const notesStatusElement = document.getElementById('notes-status');
    // Course Tracker
    const courseTotalInput = document.getElementById('course-total-lessons');
    const courseCompletedInput = document.getElementById('course-completed-lessons');
    const courseProgressBar = document.getElementById('course-progress-bar'); // The fill element
    const courseProgressPercent = document.getElementById('course-progress-percentage');
    const courseNotesTextarea = document.getElementById('notes-course');
    const courseNotesStatus = document.getElementById('course-notes-status');
    // Pomodoro Timer
    const pomodoroCard = document.getElementById('pomodoro-timer-card'); // Card container for mode data attribute
    const timerModeDisplay = document.getElementById('timer-mode');
    const timerTimeDisplay = document.getElementById('timer-time');
    const timerProgressRingFg = document.querySelector('.timer-progress-ring__fg');
    const timerRingRadius = timerProgressRingFg?.r?.baseVal?.value || 90; // Get radius or default
    const timerCircumference = 2 * Math.PI * timerRingRadius;
    const startButton = document.getElementById('timer-start');
    const pauseButton = document.getElementById('timer-pause');
    const resetButton = document.getElementById('timer-reset');
    const workDurationInput = document.getElementById('work-duration');
    const shortBreakDurationInput = document.getElementById('short-break-duration');
    const longBreakDurationInput = document.getElementById('long-break-duration');

    // --- 状态变量 ---
    let timerInterval = null;
    let timerTotalSeconds = (parseInt(workDurationInput?.value || config.pomodoroDefaults.work)) * 60; // Safer initialization
    let timerSecondsRemaining = timerTotalSeconds;
    let currentMode = 'work'; // 'work', 'shortBreak', 'longBreak'
    let workCyclesCompleted = 0;
    let pomodorosToday = 0; // For dashboard summary
    let isTimerRunning = false;
    let lastSaveTimestamp = 0; // Throttle frequent saves
    const SAVE_THROTTLE_MS = 1500;


    // --- Utility Functions ---
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const updateElementText = (element, text) => {
        if (element && element.textContent !== String(text)) { // Ensure text is string for comparison
            element.textContent = text;
        }
    };


    const setButtonState = (button, disabled) => {
        if (button) button.disabled = disabled;
    };

    // --- Core Logic Functions ---

    // Section Navigation
    function setActiveSection(targetId) {
        contentSections.forEach(section => {
            section.classList.toggle('active-section', section.id === targetId);
        });
        sidebarNavLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.target === targetId);
        });
        // Optional: Store active section
        // localStorage.setItem('activeSection', targetId);
         // Scroll to top of new section (optional)
         const mainContentArea = document.querySelector('.main-content');
         if(mainContentArea) mainContentArea.scrollTo(0, 0);
    }

    // Accordion Toggle
    function toggleAccordion(header) {
        const content = header.nextElementSibling;
        const item = header.closest('.accordion-item'); // Get the parent item
        if (!content || !item) return;

        const isOpen = header.getAttribute('aria-expanded') === 'true';

        // Close other open items in the same accordion (optional)
        // const accordion = item.closest('.accordion');
        // if (accordion && !isOpen) { // Only close others when opening a new one
        //     accordion.querySelectorAll('.accordion-item .accordion-header[aria-expanded="true"]').forEach(openHeader => {
        //         if (openHeader !== header) {
        //             toggleAccordion(openHeader); // Recursively close others
        //         }
        //     });
        // }


        header.setAttribute('aria-expanded', !isOpen);
        if (!isOpen) {
            // Opening
            content.classList.add('open');
             // Force reflow before setting max-height for transition to work correctly from height 0
             content.style.display = 'block'; // Make sure it's visible before measuring scrollHeight
             const scrollHeight = content.scrollHeight;
             content.style.maxHeight = scrollHeight + "px";
             // Optional: remove display:block after transition if needed, but usually not necessary
             // setTimeout(() => { content.style.display = ''; }, 400); // Match transition duration
        } else {
            // Closing
            content.style.maxHeight = '0';
            content.addEventListener('transitionend', () => {
                // Check again if it's still closed before removing class/display
                 if (header.getAttribute('aria-expanded') === 'false') {
                     content.classList.remove('open');
                     content.style.display = ''; // Reset display property after closing fully
                 }
            }, { once: true });
        }
    }


    // Update Current Time in Sidebar
    function updateCurrentTime() {
        if (!currentTimeElement) return;
        const now = new Date();
        const timeString = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        updateElementText(currentTimeElement, timeString);
    }

    // --- Data Persistence Functions ---
    function saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`Data saved for key: ${key}`);
        } catch (e) {
            console.error(`Error saving data for key ${key}:`, e);
            // Maybe notify user if storage is full?
            // alert("无法保存数据，可能是存储空间已满。");
        }
    }


    function loadData(key, defaultValue = {}) {
        const savedData = localStorage.getItem(key);
        if (savedData) {
            try {
                return JSON.parse(savedData);
            } catch (e) {
                console.error(`Error parsing data for key ${key}:`, e);
                localStorage.removeItem(key);
            }
        }
        // Ensure the default value is returned as a fresh object/array if it's mutable
         return typeof defaultValue === 'object' && defaultValue !== null ? JSON.parse(JSON.stringify(defaultValue)) : defaultValue;
    }


    // Throttle saving function
    function throttledSave(key, dataProviderFn) {
        const now = Date.now();
        if (now - lastSaveTimestamp > SAVE_THROTTLE_MS) {
             saveData(key, dataProviderFn());
             lastSaveTimestamp = now;
        } else {
             console.log(`Save throttled for key: ${key}`);
             // Optional: implement a debounced save for the last call if needed
        }
    }


    // --- Feature Specific Logic ---

    // Countdown
    function updateCountdownDisplay() {
        try {
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const regDate = new Date(config.estimatedRegDate); regDate.setHours(0, 0, 0, 0);
            const examDate = new Date(config.estimatedExamDate); examDate.setHours(0, 0, 0, 0);
            if (isNaN(regDate.getTime()) || isNaN(examDate.getTime())) throw new Error('Invalid date format');
            const msPerDay = 86400000;
            const daysToReg = Math.max(0, Math.ceil((regDate - now) / msPerDay));
            const daysToExam = Math.max(0, Math.ceil((examDate - now) / msPerDay));
            updateElementText(countdownRegMain, daysToReg);
            updateElementText(countdownExamMain, daysToExam);
        } catch (e) {
            console.error("Error calculating countdown:", e);
            updateElementText(countdownRegMain, 'N/A');
            updateElementText(countdownExamMain, 'N/A');
        }
    }

    // Tasks & Progress
    function loadTaskProgress() {
        const progressData = loadData(config.localStorageKeys.progress, { checkboxes: {} });
        allCheckboxes.forEach(cb => {
            cb.checked = progressData.checkboxes?.[cb.id] ?? false;
            updateLabelStyle(cb);
        });
        console.log('Task progress loaded.');
        updateAllPhaseProgressBars();
    }

    function saveTaskProgress() {
        const checkboxState = {};
        allCheckboxes.forEach(cb => { checkboxState[cb.id] = cb.checked; });
        saveData(config.localStorageKeys.progress, { checkboxes: checkboxState });
        updateDashboardSummary(); // Update summary when tasks change
    }

    function updateLabelStyle(checkbox) {
        const label = checkbox.nextElementSibling; // Assuming label is direct sibling
        if (label && label.tagName === 'LABEL') {
             // Find parent task item if needed for styling
             const taskItem = checkbox.closest('.task-item');
             if (taskItem) {
                 taskItem.classList.toggle('completed', checkbox.checked);
             }
        } else {
             // Fallback if label is not direct sibling (less reliable)
             const fallbackLabel = document.querySelector(`label[for="${checkbox.id}"]`);
             if (fallbackLabel) {
                 const taskItem = fallbackLabel.closest('.task-item');
                 if (taskItem) taskItem.classList.toggle('completed', checkbox.checked);
             }
        }
    }


    function updatePhaseProgressBar(groupId) {
        const groupCheckboxes = document.querySelectorAll(`.task-checkbox[data-group="${groupId}"]`);
        const total = groupCheckboxes.length;
        if (total === 0) return 0;
        const completed = Array.from(groupCheckboxes).filter(cb => cb.checked).length;
        const percentage = Math.round((completed / total) * 100);
        const bar = document.getElementById(`progress-${groupId}-bar`);
        const percentText = document.getElementById(`progress-${groupId}-percent`);
        if (bar) bar.style.width = `${percentage}%`;
        if (percentText) updateElementText(percentText, `${percentage}%`);
        return percentage;
    }

    function updateAllPhaseProgressBars() {
        let totalTasks = 0;
        let completedTasks = 0;
        const groupIds = new Set(Array.from(allCheckboxes).map(cb => cb.dataset.group).filter(Boolean));
        groupIds.forEach(id => {
            updatePhaseProgressBar(id);
            // Recalculate for summary
            const groupCheckboxes = document.querySelectorAll(`.task-checkbox[data-group="${id}"]`);
            totalTasks += groupCheckboxes.length;
            completedTasks += Array.from(groupCheckboxes).filter(cb => cb.checked).length;
        });
         // Update summary directly here
         updateElementText(summaryTasks, `${completedTasks} / ${totalTasks}`);
        console.log('Phase progress bars updated.');
    }


    // Notes
    function loadNotesData() {
        const notesData = loadData(config.localStorageKeys.notes);
        noteTextareas.forEach(textarea => {
            textarea.value = notesData[textarea.id] ?? '';
        });
        console.log('Notes loaded.');
    }

    function saveSpecificNote(textarea) {
        const notesData = loadData(config.localStorageKeys.notes);
        notesData[textarea.id] = textarea.value;
        throttledSave(config.localStorageKeys.notes, () => notesData); // Throttle saving
        // Show status (simplified)
        const statusEl = textarea.id === 'notes-course' ? courseNotesStatus : notesStatusElement;
         // Show temporary status only if element exists
         if (statusEl && statusEl.tagName) { // Basic check if it's an element
             statusEl.textContent = '自动保存...'; statusEl.style.color = 'var(--text-light)';
            // Clear status after a delay
            setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 1500);
        }
    }


    function saveAllNotesNow() {
         const notesData = {};
         noteTextareas.forEach(textarea => { notesData[textarea.id] = textarea.value; });
         saveData(config.localStorageKeys.notes, notesData);
         if (notesStatusElement) {
             notesStatusElement.textContent = '笔记已保存!'; notesStatusElement.style.color = 'var(--success-color)';
             setTimeout(() => { if (notesStatusElement) notesStatusElement.textContent = ''; }, 2000);
         }
         // Give feedback on button too
         if (saveNotesButton) {
             saveNotesButton.innerHTML = `<i class="fas fa-check"></i> 保存成功!`;
             setTimeout(() => {
                 if(saveNotesButton) saveNotesButton.innerHTML = `<i class="fas fa-save"></i> 手动保存`;
             }, 1500);
         }
    }


    // Course Tracker
    function loadCourseData() {
        const courseData = loadData(config.localStorageKeys.course, { total: '1', completed: '0', notes: '' });
        if (courseTotalInput) courseTotalInput.value = courseData.total;
        if (courseCompletedInput) courseCompletedInput.value = courseData.completed;
        if (courseNotesTextarea) courseNotesTextarea.value = courseData.notes;
        console.log('Course data loaded.');
        updateCourseProgressDisplay();
    }

    function saveCourseData() {
        const courseData = {
            total: courseTotalInput?.value || '1',
            completed: courseCompletedInput?.value || '0',
            notes: courseNotesTextarea?.value || ''
        };
        saveData(config.localStorageKeys.course, courseData);
        updateDashboardSummary(); // Update dashboard when course data changes
    }


    function updateCourseProgressDisplay() {
        if (!courseTotalInput || !courseCompletedInput) return 0;
        const total = parseInt(courseTotalInput.value) || 1;
        const completed = parseInt(courseCompletedInput.value) || 0;
        const validCompleted = Math.max(0, Math.min(completed, total));
        if (completed !== validCompleted && document.activeElement !== courseCompletedInput) {
            courseCompletedInput.value = validCompleted;
        }
        const percentage = total > 0 ? Math.round((validCompleted / total) * 100) : 0;
        if (courseProgressBar) courseProgressBar.style.width = `${percentage}%`;
        if (courseProgressPercent) updateElementText(courseProgressPercent, `${percentage}%`);
        return percentage;
    }

    // Pomodoro Timer
    function loadPomodoroSettings() {
        const settings = loadData(config.localStorageKeys.pomodoro, config.pomodoroDefaults);
        if (workDurationInput) workDurationInput.value = settings.work;
        if (shortBreakDurationInput) shortBreakDurationInput.value = settings.shortBreak;
        if (longBreakDurationInput) longBreakDurationInput.value = settings.longBreak;

        const summaryData = loadData(config.localStorageKeys.summary, { pomodorosToday: 0, lastResetDate: null });
        const today = new Date().toLocaleDateString();
        if(summaryData.lastResetDate === today) {
            pomodorosToday = summaryData.pomodorosToday || 0; // Ensure it's a number
        } else {
            pomodorosToday = 0;
            saveSummaryData(); // Save the reset count
        }

        console.log("Pomodoro settings loaded.");
        resetTimer(true); // Reset timer display with loaded/default values
        updateDashboardSummary(); // Update summary after loading count
    }


    function savePomodoroSettings() {
         const settings = {
            work: workDurationInput?.value || config.pomodoroDefaults.work,
            shortBreak: shortBreakDurationInput?.value || config.pomodoroDefaults.shortBreak,
            longBreak: longBreakDurationInput?.value || config.pomodoroDefaults.longBreak
        };
        saveData(config.localStorageKeys.pomodoro, settings);
        if (!isTimerRunning) resetTimer(true); // Apply settings if timer stopped
    }

     function updateTimerRing() {
        if (!timerProgressRingFg) return;
        const progress = timerTotalSeconds > 0 ? (timerTotalSeconds - timerSecondsRemaining) / timerTotalSeconds : 0;
        const offset = timerCircumference * (1 - Math.min(1, Math.max(0, progress))); // Clamp progress 0-1
        timerProgressRingFg.style.strokeDashoffset = offset;
    }

     function updateTimerDisplayAndRing() {
        const modeTextMap = { work: '工作', shortBreak: '短休', longBreak: '长休' };
        updateElementText(timerModeDisplay, modeTextMap[currentMode] || '工作');
        updateElementText(timerTimeDisplay, formatTime(timerSecondsRemaining));
        updateTimerRing();
         if(pomodoroCard) pomodoroCard.dataset.mode = currentMode;
        document.title = `${modeTextMap[currentMode]} | ${formatTime(timerSecondsRemaining)} - 备考舱`;
    }

    function switchMode(newMode, showAlert = true) {
        currentMode = newMode;
        if (newMode === 'work') {
             // Increment counts ONLY if starting a fresh work cycle, not resuming
             // This logic needs refinement if pause/resume shouldn't count
             // Let's assume starting a new cycle increments counts
             workCyclesCompleted++;
             pomodorosToday++;
             saveSummaryData();
             updateDashboardSummary();
        }

        let durationMinutes;
        switch (newMode) {
            case 'shortBreak': durationMinutes = parseInt(shortBreakDurationInput.value) || config.pomodoroDefaults.shortBreak; break;
            case 'longBreak': durationMinutes = parseInt(longBreakDurationInput.value) || config.pomodoroDefaults.longBreak; workCyclesCompleted = 0; break;
            case 'work': default: durationMinutes = parseInt(workDurationInput.value) || config.pomodoroDefaults.work; break;
        }
        timerTotalSeconds = durationMinutes * 60;
        timerSecondsRemaining = timerTotalSeconds;
        updateTimerDisplayAndRing();

        if (showAlert) {
             // Replace alert with a less intrusive notification or sound if possible
             console.log(`%c Pomo: ${modeTextMap[currentMode]} 时间到！现在开始 ${newMode === 'work' ? '工作' : '休息'}。`, 'color: blue; font-weight: bold;');
             // Optional: Play a sound
             // const audio = new Audio('path/to/sound.mp3'); audio.play();
        }
    }

     function startTimer() {
        if (isTimerRunning) return;
        isTimerRunning = true;
        setButtonState(startButton, true);
        setButtonState(pauseButton, false);
        setButtonState(resetButton, false);

        // Ensure total seconds reflects current setting
        timerTotalSeconds = (parseInt(
             currentMode === 'work' ? workDurationInput.value :
             currentMode === 'shortBreak' ? shortBreakDurationInput.value :
             longBreakDurationInput.value
         ) || config.pomodoroDefaults[currentMode]) * 60;

         // If timer is at 0 or less, reset remaining time based on current mode before starting
         if(timerSecondsRemaining <= 0) {
             timerSecondsRemaining = timerTotalSeconds;
             if(currentMode === 'work'){ // If starting work from 0, increment counters
                 workCyclesCompleted++;
                 pomodorosToday++;
                 saveSummaryData();
                 updateDashboardSummary();
             }
         }

        updateTimerDisplayAndRing(); // Update display immediately

        timerInterval = setInterval(() => {
            timerSecondsRemaining--;
            updateTimerDisplayAndRing();

            if (timerSecondsRemaining < 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                setButtonState(startButton, false);
                setButtonState(pauseButton, true);
                const interval = config.pomodoroDefaults.longBreakInterval;
                if (currentMode === 'work') {
                    const nextBreak = (workCyclesCompleted % interval === 0 && workCyclesCompleted > 0) ? 'longBreak' : 'shortBreak';
                    switchMode(nextBreak);
                } else {
                    switchMode('work'); // Switch back to work after any break
                }
            }
        }, 1000);
    }


    function pauseTimer() {
        if (!isTimerRunning) return;
        clearInterval(timerInterval);
        isTimerRunning = false;
        setButtonState(startButton, false);
        setButtonState(pauseButton, true);
         console.log("Timer paused.");
    }

    function resetTimer(silent = false) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        const previousMode = currentMode;
        currentMode = 'work'; // Always reset TO work mode
        // workCyclesCompleted = 0; // Decide if reset should clear cycle count? Maybe only after long break completes.
        const durationMinutes = parseInt(workDurationInput?.value || config.pomodoroDefaults.work);
        timerTotalSeconds = durationMinutes * 60;
        timerSecondsRemaining = timerTotalSeconds;
        updateTimerDisplayAndRing(); // Update text and ring
        setButtonState(startButton, false);
        setButtonState(pauseButton, true);
        setButtonState(resetButton, true); // Reset should be initially active
        document.title = "备考智能驾驶舱 | 段绪程";
        if(!silent) console.log(`Timer reset from ${previousMode} mode.`);
    }


    // Dashboard Summary
    function saveSummaryData() {
         const summaryData = {
             pomodorosToday: pomodorosToday,
             lastResetDate: new Date().toLocaleDateString()
         };
         saveData(config.localStorageKeys.summary, summaryData);
    }


    function updateDashboardSummary() {
        // Tasks Summary - Recalculate here to ensure accuracy
        const totalTasks = allCheckboxes.length;
        const completedTasks = Array.from(allCheckboxes).filter(cb => cb.checked).length;
        updateElementText(summaryTasks, `${completedTasks} / ${totalTasks}`);

        // Course Summary
        const coursePercentage = updateCourseProgressDisplay(); // Get current percentage
        updateElementText(summaryCourse, `${coursePercentage}%`);

        // Pomodoro Summary
        updateElementText(summaryPomodoro, pomodorosToday);
         console.log("Dashboard summary updated.");
    }



    // --- Initialization ---
    function initialize() {
        // Load all data first
        loadTaskProgress(); // Includes updating phase bars
        loadNotesData();
        loadCourseData(); // Includes updating course bar
        loadPomodoroSettings(); // Includes resetting timer display & loading today's count

        // Update displays based on loaded data
        updateCountdownDisplay();
        updateDashboardSummary(); // Update summary after all data is loaded

        // Set up interactions
        updateCurrentTime(); // Initial time update
        setInterval(updateCurrentTime, 1000); // Update time every second

        // Event Listeners
        sidebarNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.dataset.target;
                if (targetId) setActiveSection(targetId);
            });
        });

        accordionHeaders.forEach(header => {
            header.addEventListener('click', () => toggleAccordion(header));
        });

        allCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                updateLabelStyle(cb);
                if (cb.dataset.group) updatePhaseProgressBar(cb.dataset.group);
                saveTaskProgress(); // Save immediately on change
            });
        });

        noteTextareas.forEach(textarea => {
            textarea.addEventListener('input', () => {
                saveSpecificNote(textarea); // Throttle save on input
            });
             textarea.addEventListener('blur', () => { // Ensure save on blur
                saveSpecificNote(textarea);
             });
        });

         if (saveNotesButton) saveNotesButton.addEventListener('click', saveAllNotesNow);

        [courseTotalInput, courseCompletedInput].forEach(input => {
             if(input) input.addEventListener('change', () => {
                 updateCourseProgressDisplay();
                 saveCourseData(); // Save on change (blur/enter)
             });
        });

         if (startButton) startButton.addEventListener('click', startTimer);
         if (pauseButton) pauseButton.addEventListener('click', pauseTimer);
         if (resetButton) resetButton.addEventListener('click', () => resetTimer(false));

         [workDurationInput, shortBreakDurationInput, longBreakDurationInput].forEach(input => {
             if(input) input.addEventListener('change', savePomodoroSettings);
         });

        // Activate initial section
        setActiveSection('dashboard-section'); // Default to dashboard

        // Ensure initial ring state is correct
        updateTimerRing();

        console.log('Study cockpit initialized for 段绪程.');
    }

    // --- Run Initialization ---
    initialize();

}); // End of DOMContentLoaded
