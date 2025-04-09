// --- script.js (Revamped - Corrected) ---

// Wrap the entire script in ONE DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', () => { // Correct comma here
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

        // Optional: Close other open items in the same accordion
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
            // Use transitionend event to handle cleanup after transition
            content.addEventListener('transitionend', () => {
                // Check again if it's still closed before removing class/display
                 if (header.getAttribute('aria-expanded') === 'false') {
                     content.classList.remove('open');
                     content.style.display = ''; // Reset display property after closing fully
                 }
            }, { once: true }); // Important: { once: true } ensures the listener is removed after firing
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
                // Optional: Clear invalid data
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
            const now = new Date(); now.setHours(0, 0, 0, 0); // Set time to start of day for accurate day difference
            const regDate = new Date(config.estimatedRegDate); regDate.setHours(0, 0, 0, 0);
            const examDate = new Date(config.estimatedExamDate); examDate.setHours(0, 0, 0, 0);

            // Check if dates are valid after creation
            if (isNaN(regDate.getTime()) || isNaN(examDate.getTime())) {
                throw new Error('Invalid date format in config');
            }

            const msPerDay = 86400000; // 1000 * 60 * 60 * 24
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
            // Use optional chaining and nullish coalescing for safety
            cb.checked = progressData.checkboxes?.[cb.id] ?? false;
            updateLabelStyle(cb);
        });
        console.log('Task progress loaded.');
        updateAllPhaseProgressBars(); // Ensure progress bars are updated after loading
    }

    function saveTaskProgress() {
        const checkboxState = {};
        allCheckboxes.forEach(cb => { checkboxState[cb.id] = cb.checked; });
        saveData(config.localStorageKeys.progress, { checkboxes: checkboxState });
        updateDashboardSummary(); // Update summary when tasks change
    }

    function updateLabelStyle(checkbox) {
        // Try finding the label as the next sibling first (common pattern)
        const label = checkbox.nextElementSibling;
        if (label && label.tagName === 'LABEL') {
             // Find parent task item for overall styling (like strikethrough)
             const taskItem = checkbox.closest('.task-item');
             if (taskItem) {
                 taskItem.classList.toggle('completed', checkbox.checked);
             }
        } else {
             // Fallback: If label is not the direct sibling, try finding it using 'for' attribute
             const fallbackLabel = document.querySelector(`label[for="${checkbox.id}"]`);
             if (fallbackLabel) {
                 const taskItem = fallbackLabel.closest('.task-item');
                 if (taskItem) taskItem.classList.toggle('completed', checkbox.checked);
             }
        }
    }


    function updatePhaseProgressBar(groupId) {
        if (!groupId) return 0; // Avoid errors if data-group is missing
        const groupCheckboxes = document.querySelectorAll(`.task-checkbox[data-group="${groupId}"]`);
        const total = groupCheckboxes.length;
        if (total === 0) return 0; // Avoid division by zero

        const completed = Array.from(groupCheckboxes).filter(cb => cb.checked).length;
        const percentage = Math.round((completed / total) * 100);

        const bar = document.getElementById(`progress-${groupId}-bar`);
        const percentText = document.getElementById(`progress-${groupId}-percent`);

        if (bar) bar.style.width = `${percentage}%`;
        if (percentText) updateElementText(percentText, `${percentage}%`);

        return percentage; // Return the calculated percentage
    }

    function updateAllPhaseProgressBars() {
        let totalTasksOverall = 0;
        let completedTasksOverall = 0;

        // Get unique group IDs from the checkboxes that have the data-group attribute
        const groupIds = new Set(
            Array.from(allCheckboxes)
                 .map(cb => cb.dataset.group)
                 .filter(Boolean) // Filter out undefined/empty values
        );

        groupIds.forEach(id => {
            updatePhaseProgressBar(id); // Update individual bar

            // Recalculate counts for the summary (more reliable than summing percentages)
            const groupCheckboxes = document.querySelectorAll(`.task-checkbox[data-group="${id}"]`);
            totalTasksOverall += groupCheckboxes.length;
            completedTasksOverall += Array.from(groupCheckboxes).filter(cb => cb.checked).length;
        });

         // Update dashboard summary Tasks text directly here
         // Use totalTasksOverall and completedTasksOverall calculated above
         updateElementText(summaryTasks, `${completedTasksOverall} / ${totalTasksOverall}`);

        console.log('Phase progress bars and task summary updated.');
    }


    // Notes
    function loadNotesData() {
        const notesData = loadData(config.localStorageKeys.notes, {}); // Default to empty object
        noteTextareas.forEach(textarea => {
            // Use optional chaining and nullish coalescing
            textarea.value = notesData?.[textarea.id] ?? '';
        });
        console.log('Notes loaded.');
    }

    function saveSpecificNote(textarea) {
        // Load current notes data to update only the specific field
        const notesData = loadData(config.localStorageKeys.notes, {});
        notesData[textarea.id] = textarea.value;

        // Use throttled save
        throttledSave(config.localStorageKeys.notes, () => notesData);

        // Show status indication (simplified, non-blocking)
        const statusEl = textarea.id === 'notes-course' ? courseNotesStatus : notesStatusElement;

         // Show temporary status only if element exists and is an element
         if (statusEl && statusEl.tagName) { // Basic check if it's an element
             statusEl.textContent = '自动保存...'; statusEl.style.color = 'var(--text-light)'; // Or use a CSS class
            // Clear status after a delay using a timer
            setTimeout(() => {
                // Check if the element still exists before clearing
                const currentStatusEl = textarea.id === 'notes-course' ? courseNotesStatus : notesStatusElement;
                if (currentStatusEl && currentStatusEl.textContent === '自动保存...') {
                   currentStatusEl.textContent = '';
                }
            }, SAVE_THROTTLE_MS + 500); // Clear slightly after throttle duration
        }
    }


    function saveAllNotesNow() {
         const notesData = {};
         noteTextareas.forEach(textarea => {
             notesData[textarea.id] = textarea.value;
         });
         saveData(config.localStorageKeys.notes, notesData); // Use immediate save

         // Provide user feedback for manual save
         if (notesStatusElement) {
             notesStatusElement.textContent = '笔记已手动保存!';
             notesStatusElement.style.color = 'var(--success-color)';
             setTimeout(() => { if (notesStatusElement) notesStatusElement.textContent = ''; }, 2000);
         }
         // Also provide feedback on the button itself
         if (saveNotesButton) {
             saveNotesButton.innerHTML = `<i class="fas fa-check"></i> 保存成功!`;
             saveNotesButton.disabled = true; // Briefly disable
             setTimeout(() => {
                 if(saveNotesButton) {
                     saveNotesButton.innerHTML = `<i class="fas fa-save"></i> 手动保存`;
                     saveNotesButton.disabled = false;
                 }
             }, 1500);
         }
         console.log("All notes saved manually.");
    }


    // Course Tracker
    function loadCourseData() {
        const courseData = loadData(config.localStorageKeys.course, { total: '1', completed: '0', notes: '' });
        // Ensure elements exist before setting values
        if (courseTotalInput) courseTotalInput.value = courseData.total || '1'; // Default if null/undefined
        if (courseCompletedInput) courseCompletedInput.value = courseData.completed || '0';
        if (courseNotesTextarea) courseNotesTextarea.value = courseData.notes || '';
        console.log('Course data loaded.');
        updateCourseProgressDisplay(); // Update visuals after loading
    }

    function saveCourseData() {
        // Ensure elements exist before reading values
        const courseData = {
            total: courseTotalInput?.value || '1',
            completed: courseCompletedInput?.value || '0',
            notes: courseNotesTextarea?.value || ''
        };
        saveData(config.localStorageKeys.course, courseData);
        updateDashboardSummary(); // Update dashboard when course data changes
    }


    function updateCourseProgressDisplay() {
        if (!courseTotalInput || !courseCompletedInput) return 0; // Exit if elements don't exist

        // Parse values safely, providing defaults
        const total = parseInt(courseTotalInput.value) || 1; // Default to 1 to avoid division by zero if empty
        const completed = parseInt(courseCompletedInput.value) || 0;

        // Clamp completed value between 0 and total
        const validCompleted = Math.max(0, Math.min(completed, total));

        // Optional: Correct the input value if it was outside the valid range and not currently focused
        if (completed !== validCompleted && document.activeElement !== courseCompletedInput) {
            courseCompletedInput.value = validCompleted;
        }

        // Calculate percentage, handle total <= 0 case
        const percentage = total > 0 ? Math.round((validCompleted / total) * 100) : 0;

        // Update progress bar and text if elements exist
        if (courseProgressBar) courseProgressBar.style.width = `${percentage}%`;
        if (courseProgressPercent) updateElementText(courseProgressPercent, `${percentage}%`);

        return percentage; // Return percentage for summary updates
    }

    // Pomodoro Timer
    function loadPomodoroSettings() {
        const settings = loadData(config.localStorageKeys.pomodoro, config.pomodoroDefaults);
        // Ensure elements exist before setting values
        if (workDurationInput) workDurationInput.value = settings.work || config.pomodoroDefaults.work;
        if (shortBreakDurationInput) shortBreakDurationInput.value = settings.shortBreak || config.pomodoroDefaults.shortBreak;
        if (longBreakDurationInput) longBreakDurationInput.value = settings.longBreak || config.pomodoroDefaults.longBreak;

        // Load and potentially reset Pomodoro count for the day
        const summaryData = loadData(config.localStorageKeys.summary, { pomodorosToday: 0, lastResetDate: null });
        const today = new Date().toLocaleDateString(); // Get date string in local format

        if(summaryData.lastResetDate === today) {
            pomodorosToday = summaryData.pomodorosToday || 0; // Ensure it's a number, default to 0 if missing/invalid
        } else {
            // If it's a new day (or first time running), reset the count
            pomodorosToday = 0;
            saveSummaryData(); // Save the reset count and new date immediately
        }

        console.log("Pomodoro settings and daily count loaded.");
        resetTimer(true); // Reset timer display with loaded/default values (silent mode)
        updateDashboardSummary(); // Update summary after loading count
    }


    function savePomodoroSettings() {
         const settings = {
            // Ensure values are taken from inputs if they exist, otherwise use defaults
            work: workDurationInput?.value || config.pomodoroDefaults.work,
            shortBreak: shortBreakDurationInput?.value || config.pomodoroDefaults.shortBreak,
            longBreak: longBreakDurationInput?.value || config.pomodoroDefaults.longBreak
        };
        saveData(config.localStorageKeys.pomodoro, settings);

        // If the timer is not currently running, apply the new settings immediately by resetting
        if (!isTimerRunning) {
            resetTimer(true); // Reset silently to reflect new durations
        }
         console.log("Pomodoro settings saved.");
    }

     function updateTimerRing() {
        if (!timerProgressRingFg || !timerCircumference) return; // Ensure elements and calculated values exist

        // Calculate progress (0 to 1)
        const progress = timerTotalSeconds > 0 ? (timerTotalSeconds - timerSecondsRemaining) / timerTotalSeconds : 0;

        // Calculate the stroke-dashoffset. Offset starts at circumference (full ring) and moves towards 0 (empty ring)
        // Clamp progress between 0 and 1 to avoid unexpected values
        const offset = timerCircumference * (1 - Math.min(1, Math.max(0, progress)));

        timerProgressRingFg.style.strokeDashoffset = offset;

        // Initialize stroke-dasharray if not already set (needed for the effect)
        if (!timerProgressRingFg.style.strokeDasharray) {
            timerProgressRingFg.style.strokeDasharray = timerCircumference;
        }
    }

     function updateTimerDisplayAndRing() {
        const modeTextMap = { work: '工作', shortBreak: '短休', longBreak: '长休' };
        const currentModeText = modeTextMap[currentMode] || '工作'; // Default to '工作' if mode is unexpected

        // Update mode text, time display, and timer ring SVG
        updateElementText(timerModeDisplay, currentModeText);
        updateElementText(timerTimeDisplay, formatTime(timerSecondsRemaining));
        updateTimerRing();

        // Update the card's data attribute for potential styling based on mode
        if(pomodoroCard) pomodoroCard.dataset.mode = currentMode;

        // Update the page title to reflect the timer status
        document.title = `${currentModeText} | ${formatTime(timerSecondsRemaining)} - 备考舱`;
    }

    function switchMode(newMode, showAlert = true) {
        currentMode = newMode;
        const modeTextMap = { work: '工作', shortBreak: '短休', longBreak: '长休' }; // Define inside or ensure accessible

        // --- Important Logic: Increment counters ---
        // Only increment pomodorosToday when a *work* cycle *completes* and we are switching *to* a break.
        // The original logic incremented when switching *to* work, which is less standard for Pomodoro tracking.
        // Let's adjust: Increment when a work cycle *finishes*.
        // The check happens *before* setting the new duration.
        if (previousMode === 'work' && (newMode === 'shortBreak' || newMode === 'longBreak')) {
             workCyclesCompleted++; // Track cycles for long breaks
             pomodorosToday++; // Track total Pomodoros for the day
             saveSummaryData(); // Persist the updated count
             updateDashboardSummary(); // Update the UI
             console.log(`Pomodoro cycle ${pomodorosToday} completed.`);
        }


        let durationMinutes;
        switch (newMode) {
            case 'shortBreak':
                durationMinutes = parseInt(shortBreakDurationInput?.value || config.pomodoroDefaults.shortBreak);
                break;
            case 'longBreak':
                durationMinutes = parseInt(longBreakDurationInput?.value || config.pomodoroDefaults.longBreak);
                workCyclesCompleted = 0; // Reset cycle count after starting a long break
                break;
            case 'work':
            default: // Default to work mode
                durationMinutes = parseInt(workDurationInput?.value || config.pomodoroDefaults.work);
                break;
        }

        // Update timer state variables
        timerTotalSeconds = durationMinutes * 60;
        timerSecondsRemaining = timerTotalSeconds;
        isTimerRunning = false; // Ensure timer is stopped before potentially restarting

        updateTimerDisplayAndRing(); // Update UI immediately for the new mode

        if (showAlert) {
             // Use console log for less intrusive notification
             console.log(`%c Pomo: 时间到！现在开始 ${modeTextMap[newMode]}。`, 'color: blue; font-weight: bold;');
             // Optional: Play a notification sound
             // try {
             //     const audio = new Audio('path/to/notification.mp3'); // Replace with actual path or use a library
             //     audio.play();
             // } catch (e) { console.error("Failed to play notification sound:", e); }

             // Optional: Browser Notification API (requires user permission)
             // if (Notification.permission === "granted") {
             //    new Notification("番茄钟", { body: `时间到！现在开始 ${modeTextMap[newMode]}。` });
             // } else if (Notification.permission !== "denied") {
             //    Notification.requestPermission().then(permission => {
             //        if (permission === "granted") {
             //            new Notification("番茄钟", { body: `时间到！现在开始 ${modeTextMap[newMode]}。` });
             //        }
             //    });
             // }
        }
         // Automatically start the timer for the new mode? Common Pomodoro behavior.
         // startTimer(); // Uncomment if you want the next phase to start automatically
    }


     function startTimer() {
        if (isTimerRunning) return; // Prevent multiple intervals

        isTimerRunning = true;
        setButtonState(startButton, true);  // Disable Start
        setButtonState(pauseButton, false); // Enable Pause
        setButtonState(resetButton, false); // Enable Reset (can reset while running)


        // Re-calculate total seconds based on current mode settings *when starting*
        let durationMinutes;
         switch (currentMode) {
             case 'shortBreak': durationMinutes = parseInt(shortBreakDurationInput?.value || config.pomodoroDefaults.shortBreak); break;
             case 'longBreak': durationMinutes = parseInt(longBreakDurationInput?.value || config.pomodoroDefaults.longBreak); break;
             case 'work': default: durationMinutes = parseInt(workDurationInput?.value || config.pomodoroDefaults.work); break;
         }
         timerTotalSeconds = durationMinutes * 60;


         // If timer was paused at 0 or somehow negative, reset remaining time to full duration
         if(timerSecondsRemaining <= 0) {
             timerSecondsRemaining = timerTotalSeconds;
             // **Important**: Avoid double-counting pomodoros here. Counting happens in switchMode now.
         }

        updateTimerDisplayAndRing(); // Update display immediately before interval starts

        console.log(`Timer started in ${currentMode} mode (${formatTime(timerSecondsRemaining)} remaining).`);

        timerInterval = setInterval(() => {
            timerSecondsRemaining--;
            updateTimerDisplayAndRing(); // Update UI every second

            if (timerSecondsRemaining < 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                setButtonState(startButton, false); // Enable Start for next round
                setButtonState(pauseButton, true);  // Disable Pause

                const previousModeForSwitch = currentMode; // Store the mode that just finished
                const longBreakInterval = config.pomodoroDefaults.longBreakInterval;

                let nextMode;
                if (previousModeForSwitch === 'work') {
                    // Check if it's time for a long break (using the counter incremented in switchMode)
                    // Note: workCyclesCompleted is incremented *after* a work session, before the break starts.
                    // So, if it's now equal to the interval, the *next* break should be long.
                    nextMode = (workCyclesCompleted > 0 && workCyclesCompleted % longBreakInterval === 0) ? 'longBreak' : 'shortBreak';
                } else {
                    // After any break (short or long), switch back to work
                    nextMode = 'work';
                }

                switchMode(nextMode, true, previousModeForSwitch); // Pass previous mode to handle pomodoro count correctly
            }
        }, 1000);
    }


    function pauseTimer() {
        if (!isTimerRunning) return; // Do nothing if already paused

        clearInterval(timerInterval); // Stop the interval
        isTimerRunning = false;
        setButtonState(startButton, false); // Enable Start (to resume)
        setButtonState(pauseButton, true);  // Disable Pause
        // Reset button remains enabled
         console.log(`Timer paused at ${formatTime(timerSecondsRemaining)} in ${currentMode} mode.`);
         // Change title back to indicate paused state? Maybe not necessary.
    }

    function resetTimer(silent = false) {
        clearInterval(timerInterval); // Stop any active interval
        isTimerRunning = false;
        const previousMode = currentMode; // Store mode before reset
        currentMode = 'work'; // Always reset TO work mode

        // Resetting the timer should arguably reset the work cycle count,
        // unless the user specifically wants to preserve it across manual resets.
        // Let's reset it for simplicity.
        // workCyclesCompleted = 0; // Uncomment this line if reset should clear cycle count.

        // Get the current work duration setting
        const durationMinutes = parseInt(workDurationInput?.value || config.pomodoroDefaults.work);
        timerTotalSeconds = durationMinutes * 60;
        timerSecondsRemaining = timerTotalSeconds; // Reset remaining time to full duration

        updateTimerDisplayAndRing(); // Update text, ring, and title

        // Set button states for a fresh, ready-to-start timer
        setButtonState(startButton, false); // Enable Start
        setButtonState(pauseButton, true);  // Disable Pause (nothing to pause)
        setButtonState(resetButton, true);  // Disable Reset initially? Or keep enabled? Let's keep enabled.

        // Reset page title to default
        document.title = "备考智能驾驶舱 | 段绪程";

        if(!silent) {
            console.log(`Timer reset from ${previousMode} mode back to Work mode.`);
        }
    }


    // Dashboard Summary
    function saveSummaryData() {
         const summaryData = {
             pomodorosToday: pomodorosToday,
             lastResetDate: new Date().toLocaleDateString() // Store today's date string
         };
         saveData(config.localStorageKeys.summary, summaryData);
         // No console log needed here usually, it's called internally
    }


    function updateDashboardSummary() {
        // Tasks Summary - Recalculate here for accuracy or rely on updateAllPhaseProgressBars
        // Let's recalculate to be safe, though updateAllPhaseProgressBars already updates the element.
        const totalTasks = allCheckboxes.length;
        const completedTasks = Array.from(allCheckboxes).filter(cb => cb.checked).length;
        updateElementText(summaryTasks, `${completedTasks} / ${totalTasks}`);

        // Course Summary - Call the function that calculates and updates the display
        const coursePercentage = updateCourseProgressDisplay(); // This function updates its element and returns the value
        updateElementText(summaryCourse, `${coursePercentage}%`); // Update the summary element specifically

        // Pomodoro Summary - Update with the current count
        updateElementText(summaryPomodoro, pomodorosToday);

         console.log("Dashboard summary updated.");
    }



    // --- Initialization ---
    function initialize() {
        console.log('Initializing Study Cockpit...');

        // --- Load Data First ---
        // Order matters slightly if one load depends on another (not really here)
        loadTaskProgress();      // Loads checkbox states, updates phase bars & task summary part 1
        loadNotesData();         // Loads text area content
        loadCourseData();        // Loads course inputs/notes, updates course progress bar & summary part 1
        loadPomodoroSettings();  // Loads durations, resets timer display, loads/resets daily count & summary part 1

        // --- Update Displays based on potentially cross-dependent data ---
        updateCountdownDisplay(); // Update countdown timers
        updateDashboardSummary(); // Final update for the dashboard summary after all data is loaded

        // --- Set up recurring updates & initial states ---
        updateCurrentTime();           // Set initial time
        setInterval(updateCurrentTime, 1000); // Update time every second

        // Initialize SVG ring dash array/offset
        updateTimerRing();

        // Set initial button states for Pomodoro (should be handled by resetTimer in loadPomodoroSettings)
        setButtonState(startButton, false);
        setButtonState(pauseButton, true);
        setButtonState(resetButton, true); // Initially enabled? Or disabled until started? Let's say enabled.


        // --- Attach Event Listeners ---

        // Sidebar Navigation
        sidebarNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default anchor link behavior
                const targetId = link.dataset.target;
                if (targetId) {
                    setActiveSection(targetId);
                } else {
                    console.warn("Sidebar link clicked with no data-target:", link);
                }
            });
        });

        // Accordion Headers
        accordionHeaders.forEach(header => {
            header.addEventListener('click', () => toggleAccordion(header));
             // Optional: Pre-open the first accordion item or based on saved state
             // if (header.closest('.accordion-item').classList.contains('initially-open')) {
             //    toggleAccordion(header);
             // }
        });

        // Task Checkboxes
        allCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                updateLabelStyle(cb); // Update visual style (e.g., strikethrough)
                // Update progress bar *only if* the checkbox belongs to a group
                if (cb.dataset.group) {
                    updatePhaseProgressBar(cb.dataset.group);
                }
                saveTaskProgress(); // Save state and update dashboard summary
            });
        });

        // Notes Textareas (Auto-save on input, ensure save on blur)
        noteTextareas.forEach(textarea => {
            textarea.addEventListener('input', () => {
                saveSpecificNote(textarea); // Throttle save on input
            });
             textarea.addEventListener('blur', () => { // Ensure data is saved when focus leaves
                saveSpecificNote(textarea); // Should ideally trigger the throttled save if enough time passed or save immediately if needed
                // Consider forcing a save here if throttle hasn't fired recently:
                // saveData(config.localStorageKeys.notes, loadData(config.localStorageKeys.notes)); // Reload and save immediately
             });
        });

        // Manual Notes Save Button
         if (saveNotesButton) {
            saveNotesButton.addEventListener('click', saveAllNotesNow);
         }

        // Course Tracker Inputs (Save on change - typically blur or enter key)
        [courseTotalInput, courseCompletedInput].forEach(input => {
             if(input) { // Check if the element exists
                 input.addEventListener('change', () => {
                     updateCourseProgressDisplay(); // Update visuals first
                     saveCourseData(); // Then save the new data (also updates summary)
                 });
                 // Optional: Update progress display on 'input' for immediate feedback, but save on 'change'
                 // input.addEventListener('input', updateCourseProgressDisplay);
             }
        });

        // Pomodoro Timer Buttons
         if (startButton) startButton.addEventListener('click', startTimer);
         if (pauseButton) pauseButton.addEventListener('click', pauseTimer);
         if (resetButton) resetButton.addEventListener('click', () => resetTimer(false)); // Pass false for non-silent reset

         // Pomodoro Duration Setting Inputs (Save on change)
         [workDurationInput, shortBreakDurationInput, longBreakDurationInput].forEach(input => {
             if(input) { // Check if element exists
                input.addEventListener('change', savePomodoroSettings);
             }
         });

        // --- Final Steps ---
        // Activate the initial section (e.g., dashboard)
        setActiveSection('dashboard-section'); // Or load last active section from localStorage if implemented

        console.log('Study cockpit initialized successfully for 段绪程.');
    }

    // --- Run Initialization ---
    initialize();

}); // End of DOMContentLoaded
