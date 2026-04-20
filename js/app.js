// API Configuration
const API_BASE = 'api/';

// State Management
let currentUser = null;
let appointments = [];
let doctors = [];

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    checkSession();
    startSessionMonitor();
    lucide.createIcons();

    // Close modal when clicking outside
    document.addEventListener('click', function (event) {
        const modal = document.getElementById('slotModal');
        if (modal && event.target === modal) {
            closeSlotModal();
        }
    });

    // Close sidebar when clicking overlay on mobile
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', function () {
            toggleMobileMenu();
        });
    }

    // Handle window resize to close mobile menu if screen becomes larger
    // and resize charts
    let resizeTimeout;
    window.addEventListener('resize', function () {
        if (window.innerWidth > 768) {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            if (sidebar) sidebar.classList.remove('mobile-open');
            if (overlay) overlay.classList.remove('active');
        }

        // Debounce chart resize
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function () {
            // Resize charts if they exist
            if (doctorBarChart) {
                doctorBarChart.resize();
            }
            if (statusPieChart) {
                statusPieChart.resize();
            }
        }, 250);
    });
});

// ============= AUTHENTICATION =============

function togglePassword() {
    const passwordInput = document.getElementById('loginPassword');
    const eyeIcon = document.getElementById('eyeIcon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
        passwordInput.type = 'password';
        eyeIcon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showToast('Please enter both username and password', 'error');
        return;
    }

    try {
        const response = await fetch(API_BASE + 'auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            sessionStorage.setItem('user', JSON.stringify(currentUser));
            showDashboard();
            navigateTo('dashboard');
            showToast('Login successful!', 'success');
        } else {
            showToast(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Connection error. Please try again.', 'error');
    }
}

async function handleLogout() {
    try {
        await fetch(API_BASE + 'auth.php?action=logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    }

    sessionStorage.removeItem('user');
    currentUser = null;
    showLogin();
    showToast('Logged out successfully', 'success');
}

async function checkSession() {
    try {
        const response = await fetch(API_BASE + 'auth.php?action=check');
        const data = await response.json();

        if (data.success && data.authenticated) {
            currentUser = data.user;
            sessionStorage.setItem('user', JSON.stringify(currentUser));
            showDashboard();
            navigateTo('dashboard');
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Session check error:', error);
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainDashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainDashboard').style.display = 'block';
}

function startSessionMonitor() {
    // Check session every 60 seconds
    setInterval(checkSessionStatus, 60000);
}

async function checkSessionStatus() {
    // Only check if we think we are logged in (UI is in dashboard mode or currentUser is set)
    // accessible via the global currentUser variable
    if (!currentUser) return;

    try {
        const response = await fetch(API_BASE + 'auth.php?action=check');
        const data = await response.json();

        if (!data.success || !data.authenticated) {
            // Session expired on server
            console.log('Session expired, redirecting to login');

            // Clear local state
            sessionStorage.removeItem('user');
            currentUser = null;

            // Show login screen
            showLogin();
            showToast('Session expired. Please login again.', 'info');
        }
    } catch (error) {
        console.error('Session monitor error:', error);
        // Don't log out on connection error, wait for next check
    }
}

// ============= NAVIGATION =============

function navigateTo(page) {
    // Update active nav button
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const targetBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    // Show correct page
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    const targetPage = document.getElementById(`${page}Page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Update header title
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
        switch (page) {
            case 'dashboard': headerTitle.textContent = 'Dashboard'; break;
            case 'appointments': headerTitle.textContent = 'Appointments'; break;
            case 'doctors': headerTitle.textContent = 'Doctor Schedule'; break;
            case 'followups': headerTitle.textContent = 'Follow-up Plans'; break;
        }
    }

    // Toggle contextual header button
    updateHeaderButton(page);

    // Close mobile menu on mobile devices
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
    }

    // Load page data
    switch (page) {
        case 'dashboard':
            // Initialize dashboard filters
            const filterType = document.getElementById('dashboardFilterType');
            if (filterType) {
                // Ensure "Today" is selected by default if no value is set
                if (!filterType.value) {
                    filterType.value = 'today';
                }

                // Set default date range inputs to today (for date-range filter)
                const today = formatDateLocal(new Date());
                const dateFromInput = document.getElementById('dashboardDateFrom');
                const dateToInput = document.getElementById('dashboardDateTo');
                if (dateFromInput && !dateFromInput.value) dateFromInput.value = today;
                if (dateToInput && !dateToInput.value) dateToInput.value = today;

                // Load doctors for filter
                loadDoctorsForDashboard();

                // Apply filters (this will use the selected filter type, defaulting to "today")
                handleDashboardFilterChange();
            } else {
                // Fallback: load with today's date if filter dropdown doesn't exist
                const today = formatDateLocal(new Date());
                loadDashboardData(today, today);
            }

            // Start date/time updater if not already started
            if (!window.dateTimeUpdaterStarted) {
                startDateTimeUpdater();
                window.dateTimeUpdaterStarted = true;
            }

            // Reinitialize icons for dashboard filters
            setTimeout(() => lucide.createIcons(), 100);
            break;
        case 'appointments':
            // Initialize appointment filters
            const appointmentFilterType = document.getElementById('appointmentFilterType');
            if (appointmentFilterType) {
                // Set default date range inputs to today
                const today = formatDateLocal(new Date());
                const appointmentDateFromInput = document.getElementById('appointmentDateFrom');
                const appointmentDateToInput = document.getElementById('appointmentDateTo');
                if (appointmentDateFromInput && !appointmentDateFromInput.value) appointmentDateFromInput.value = today;
                if (appointmentDateToInput && !appointmentDateToInput.value) appointmentDateToInput.value = today;

                // Load doctors for filter dropdown
                loadDoctorsForAppointments();

                // Handle filter change to set up initial state
                handleAppointmentFilterChange();
            } else {
                loadAppointments();
                loadDoctorsForAppointments();
            }
            break;
        case 'doctors':
            loadDoctors();
            break;
        case 'followups':
            loadFollowupPlans();
            break;
    }

    lucide.createIcons();
}


function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        const isOpen = sidebar.classList.contains('mobile-open');
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active', !isOpen);
    }
}

// ============= DASHBOARD =============

function handleDashboardFilterChange() {
    const filterType = document.getElementById('dashboardFilterType').value;
    const dateRangeGroup = document.getElementById('dateRangeGroup');
    const dateRangeToGroup = document.getElementById('dateRangeToGroup');

    if (filterType === 'date-range') {
        dateRangeGroup.style.display = 'flex';
        dateRangeToGroup.style.display = 'flex';
    } else {
        dateRangeGroup.style.display = 'none';
        dateRangeToGroup.style.display = 'none';
    }

    applyDashboardFilters();
}

// Helper function to format date as YYYY-MM-DD using local timezone (not UTC)
function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDateRangeForFilter(filterType) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Create fresh date for today

    let dateFrom, dateTo;

    switch (filterType) {
        case 'today':
            // Use actual today's date
            dateFrom = new Date(today);
            dateTo = new Date(today);
            break;

        case 'this-week':
            // Calculate Monday (start of week)
            // getDay() returns 0 for Sunday, 1 for Monday, etc.
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            let daysToMonday;

            if (dayOfWeek === 0) {
                // If today is Sunday, go back 6 days to get Monday
                daysToMonday = -6;
            } else {
                // For Monday (1) through Saturday (6), calculate days back to Monday
                daysToMonday = 1 - dayOfWeek; // Monday: 1-1=0, Tuesday: 1-2=-1, etc.
            }

            dateFrom = new Date(today);
            dateFrom.setDate(today.getDate() + daysToMonday);
            dateFrom.setHours(0, 0, 0, 0);

            // End of week (Sunday) - 6 days after Monday
            dateTo = new Date(dateFrom);
            dateTo.setDate(dateFrom.getDate() + 6);
            dateTo.setHours(0, 0, 0, 0);
            break;

        case 'this-month':
            // First day of current calendar month (e.g., January 1)
            dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
            dateFrom.setHours(0, 0, 0, 0);

            // Last day of current calendar month (e.g., January 31)
            dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            dateTo.setHours(0, 0, 0, 0);
            break;

        case 'date-range':
            const fromInput = document.getElementById('dashboardDateFrom');
            const toInput = document.getElementById('dashboardDateTo');
            dateFrom = fromInput?.value ? new Date(fromInput.value) : new Date(today);
            dateTo = toInput?.value ? new Date(toInput.value) : new Date(today);
            dateFrom.setHours(0, 0, 0, 0);
            dateTo.setHours(0, 0, 0, 0);
            break;

        default:
            dateFrom = new Date(today);
            dateTo = new Date(today);
    }

    // Format dates as YYYY-MM-DD using local timezone (not UTC)
    // This prevents timezone offset issues where UTC conversion shifts the date
    return {
        from: formatDateLocal(dateFrom),
        to: formatDateLocal(dateTo)
    };
}

function updateDashboardSubtitle(dateFrom, dateTo, doctorId) {
    const subtitle = document.getElementById('dashboardSubtitle');
    if (!subtitle) return;

    const fromDate = new Date(dateFrom + 'T00:00:00');
    const toDate = new Date(dateTo + 'T00:00:00');

    let dateText = '';
    if (dateFrom === dateTo) {
        const formatted = fromDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        dateText = `on ${formatted}`;
    } else {
        const fromFormatted = fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const toFormatted = toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        dateText = `from ${fromFormatted} to ${toFormatted}`;
    }

    let doctorText = '';
    if (doctorId) {
        const doctorSelect = document.getElementById('dashboardDoctor');
        const selectedDoctor = doctorSelect?.options[doctorSelect.selectedIndex]?.text;
        if (selectedDoctor && selectedDoctor !== 'All Doctors') {
            doctorText = ` for ${selectedDoctor}`;
        }
    }

    subtitle.textContent = `Overview of appointments ${dateText}${doctorText}`;
}

function applyDashboardFilters() {
    const filterType = document.getElementById('dashboardFilterType').value;
    const dateRange = getDateRangeForFilter(filterType);
    const doctorId = document.getElementById('dashboardDoctor')?.value || '';

    // Update subtitle
    updateDashboardSubtitle(dateRange.from, dateRange.to, doctorId);

    // Load dashboard data with filters
    loadDashboardData(dateRange.from, dateRange.to, doctorId);
}

function populateDoctorFilter(doctorsList) {
    const doctorSelect = document.getElementById('filterDoctor');
    if (!doctorSelect) return;

    // Save current selection
    const currentValue = doctorSelect.value;

    // Clear and populate
    doctorSelect.innerHTML = '<option value="">All Doctors</option>';
    doctorsList.forEach(doctor => {
        const option = document.createElement('option');
        option.value = doctor.id;
        option.textContent = doctor.doctor_name;
        doctorSelect.appendChild(option);
    });

    // Restore selection if it still exists
    if (currentValue) {
        doctorSelect.value = currentValue;
    }
}

function applyFilters() {
    // Initialize date fields to today if empty
    const dateFromInput = document.getElementById('filterDateFrom');
    const dateToInput = document.getElementById('filterDateTo');

    if (!dateFromInput.value) {
        dateFromInput.value = formatDateLocal(new Date());
    }
    if (!dateToInput.value) {
        dateToInput.value = formatDateLocal(new Date());
    }

    // Reload dashboard data with filters
    loadDashboardData();
}

function resetFilters() {
    // Set default to today
    const today = formatDateLocal(new Date());

    document.getElementById('filterDateFrom').value = today;
    document.getElementById('filterDateTo').value = today;
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterDoctor').value = '';

    // Reload dashboard data
    loadDashboardData();
}

function updateDashboardTitle(filters) {
    const titleElement = document.getElementById('headerTitle');
    if (!titleElement || !filters) return;

    const dateFrom = filters.dateFrom || '';
    const dateTo = filters.dateTo || '';

    if (dateFrom && dateTo) {
        if (dateFrom === dateTo) {
            const date = new Date(dateFrom + 'T00:00:00');
            const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            titleElement.textContent = `Dashboard Overview - ${formattedDate}`;
        } else {
            const fromDate = new Date(dateFrom + 'T00:00:00');
            const toDate = new Date(dateTo + 'T00:00:00');
            const fromFormatted = fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const toFormatted = toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            titleElement.textContent = `Dashboard Overview - ${fromFormatted} to ${toFormatted}`;
        }
    } else {
        titleElement.textContent = 'Dashboard Overview';
    }
}

let doctorBarChart = null;
let statusPieChart = null;

async function loadDashboardData(dateFrom, dateTo, doctorId) {
    // Use provided dates or get from filter
    if (!dateFrom || !dateTo) {
        const filterType = document.getElementById('dashboardFilterType');
        if (filterType) {
            // Ensure filter has a value, default to 'today' if empty
            const selectedFilter = filterType.value || 'today';
            if (!filterType.value) {
                filterType.value = 'today';
            }
            const dateRange = getDateRangeForFilter(selectedFilter);
            dateFrom = dateRange.from;
            dateTo = dateRange.to;
        } else {
            // Default to today
            const today = formatDateLocal(new Date());
            dateFrom = dateFrom || today;
            dateTo = dateTo || today;
        }
    }

    // Get doctor ID from filter if not provided
    if (!doctorId) {
        const doctorSelect = document.getElementById('dashboardDoctor');
        doctorId = doctorSelect?.value || '';
    }

    // Update subtitle
    updateDashboardSubtitle(dateFrom, dateTo, doctorId);

    // Build query string
    const params = new URLSearchParams();
    params.append('date_from', dateFrom);
    params.append('date_to', dateTo);
    if (doctorId) {
        params.append('doctor_id', doctorId);
    }

    const url = API_BASE + 'dashboard.php?' + params.toString();

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            updateDashboardStats(data.data.stats);
            updateDashboardCharts(data.data.doctorBreakdown);
            renderHeatmap(data.data.heatmap);

            // Update current date and time
            if (data.data.currentDateTime) {
                updateCurrentDateTime(data.data.currentDateTime);
            }

            // Start date/time updater if not already started
            if (!window.dateTimeUpdaterStarted) {
                startDateTimeUpdater();
                window.dateTimeUpdaterStarted = true;
            }

            // Reinitialize icons to ensure filter icons are rendered
            setTimeout(() => lucide.createIcons(), 100);
        } else {
            showToast('Failed to load dashboard data', 'error');
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        showToast('Failed to load dashboard data', 'error');
    }
}

function updateDashboardStats(stats) {
    const total = stats.total || 0;
    const completed = stats.completed || 0;
    const cancelled = stats.cancelled || 0;
    const noShow = stats.noShow || 0;

    document.getElementById('totalAppointments').textContent = total;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('cancelledCount').textContent = cancelled;
    document.getElementById('noShowCount').textContent = noShow;

    // Calculate and display percentages
    const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const cancelledPct = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const noShowPct = total > 0 ? Math.round((noShow / total) * 100) : 0;

    document.getElementById('completedPercentage').textContent = `${completedPct}% of total`;
    document.getElementById('cancelledPercentage').textContent = `${cancelledPct}% of total`;
    document.getElementById('noShowPercentage').textContent = `${noShowPct}% of total`;
}

function updateCurrentDateTime(dateTimeData) {
    const datetimeDisplay = document.getElementById('datetimeDisplay');
    if (!datetimeDisplay) return;

    // Use formatted date/time from server if available
    if (dateTimeData.formatted) {
        datetimeDisplay.textContent = dateTimeData.formatted;
    } else {
        // Fallback: format client-side
        const date = new Date();
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        datetimeDisplay.textContent = date.toLocaleDateString('en-US', options);
    }
}

// Update date/time every second to keep it current
function startDateTimeUpdater() {
    const datetimeDisplay = document.getElementById('datetimeDisplay');
    if (!datetimeDisplay) return;

    function updateTime() {
        const now = new Date();
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        datetimeDisplay.textContent = now.toLocaleString('en-US', options);
    }

    // Update immediately
    updateTime();

    // Update every second
    setInterval(updateTime, 1000);
}

function updateDashboardCharts(doctorBreakdown) {
    // Doctor Bar Chart
    const doctorCtx = document.getElementById('doctorBarChart');
    if (doctorCtx) {
        if (doctorBarChart) {
            doctorBarChart.destroy();
        }

        const labels = doctorBreakdown.map(d => d.doctor_name);
        const data = doctorBreakdown.map(d => parseInt(d.count) || 0);

        // Determine if mobile
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 480;

        doctorBarChart = new Chart(doctorCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Appointments',
                    data: data,
                    backgroundColor: '#3b82f6',
                    borderColor: '#2563eb',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            boxWidth: isSmallMobile ? 10 : 12,
                            padding: isSmallMobile ? 8 : 15,
                            font: {
                                size: isSmallMobile ? 10 : isMobile ? 11 : 12
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: isSmallMobile ? 9 : isMobile ? 10 : 12
                            }
                        },
                        grid: {
                            display: !isSmallMobile
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: isSmallMobile ? 9 : isMobile ? 10 : 12
                            },
                            maxRotation: isSmallMobile ? 45 : 0,
                            minRotation: isSmallMobile ? 45 : 0
                        }
                    }
                }
            }
        });
    }

    // Status Pie Chart
    const statusCtx = document.getElementById('statusPieChart');
    if (statusCtx) {
        if (statusPieChart) {
            statusPieChart.destroy();
        }

        const total = parseInt(document.getElementById('totalAppointments').textContent) || 0;
        const completed = parseInt(document.getElementById('completedCount').textContent) || 0;
        const cancelled = parseInt(document.getElementById('cancelledCount').textContent) || 0;
        const noShow = parseInt(document.getElementById('noShowCount').textContent) || 0;
        const booked = total - completed - cancelled - noShow;

        // Determine if mobile
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 480;

        const statusData = {
            labels: ['Completed', 'Booked', 'Cancelled', 'No-Show'],
            datasets: [{
                data: [completed, booked, cancelled, noShow],
                backgroundColor: [
                    '#10b981', // green for completed
                    '#3b82f6', // blue for booked
                    '#ef4444', // red for cancelled
                    '#f59e0b'  // orange for no-show
                ],
                borderWidth: isSmallMobile ? 1 : 2,
                borderColor: '#ffffff'
            }]
        };

        statusPieChart = new Chart(statusCtx, {
            type: 'pie',
            data: statusData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            padding: isSmallMobile ? 8 : isMobile ? 12 : 15,
                            font: {
                                size: isSmallMobile ? 10 : isMobile ? 11 : 12
                            },
                            boxWidth: isSmallMobile ? 10 : 12,
                            generateLabels: function (chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                        // Shorten label on mobile
                                        const displayLabel = isSmallMobile ? label.split(' ')[0] : label;
                                        return {
                                            text: `${displayLabel} ${percentage}%`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor,
                                            lineWidth: data.datasets[0].borderWidth,
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

function renderHeatmap(heatmapData) {
    const container = document.getElementById('heatmapContainer');

    if (!container) {
        console.error('Heatmap container not found');
        return;
    }

    console.log('Rendering heatmap with data:', heatmapData);

    if (!heatmapData || !heatmapData.dates) {
        console.warn('Heatmap data missing dates');
        container.innerHTML = '<p class="text-center" style="color: #6b7280; padding: 2rem;">No heatmap data available</p>';
        return;
    }

    // Ensure timeSlots exists, use default if not
    if (!heatmapData.timeSlots || !Array.isArray(heatmapData.timeSlots) || heatmapData.timeSlots.length === 0) {
        console.warn('Heatmap timeSlots missing or empty, using defaults');
        heatmapData.timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '15:00'];
    }

    const dates = heatmapData.dates;
    const timeSlots = heatmapData.timeSlots;
    const utilization = heatmapData.utilization || {};

    // Format dates for display (e.g., "Nov 28", "Dec 3")
    function formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthNames[date.getMonth()] + ' ' + date.getDate();
    }

    // Helper to format time slot as range (e.g. "10:00" -> "10:00 - 11:00")
    function formatTimeSlotRange(timeStr) {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':').map(Number);
        const start = new Date();
        start.setHours(hours, minutes, 0, 0);

        const end = new Date(start);
        end.setHours(start.getHours() + 1);

        const formatTime = (date) => {
            return date.getHours().toString().padStart(2, '0') + ':' +
                date.getMinutes().toString().padStart(2, '0');
        };

        return `${formatTime(start)} - ${formatTime(end)}`;
    }

    // Build table HTML
    let html = '<div class="heatmap-wrapper"><table class="heatmap-table"><thead><tr><th style="width: 120px;">Time Slot</th>';

    // Add date headers
    dates.forEach(date => {
        html += `<th>${formatDate(date)}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Add rows for each time slot
    timeSlots.forEach(timeSlot => {
        html += '<tr class="heatmap-row">';
        html += `<td style="font-weight: 500; font-size: 0.8rem;">${formatTimeSlotRange(timeSlot)}</td>`;

        dates.forEach(date => {
            const cellData = utilization[date] && utilization[date][timeSlot] ? utilization[date][timeSlot] : { count: 0, appointments: [] };
            const count = cellData.count || 0;
            const isUtilized = count > 0;

            let tooltip = '';
            if (isUtilized) {
                tooltip = `${count} Appointment${count !== 1 ? 's' : ''}:\n`;
                if (cellData.appointments && cellData.appointments.length > 0) {
                    cellData.appointments.forEach(apt => {
                        tooltip += `- ${apt.patient_name} (${apt.doctor_name}) [${apt.status}]\n`;
                    });
                }
            } else {
                tooltip = `${formatDate(date)} ${timeSlot}: No appointments`;
            }

            html += `<td class="heatmap-cell ${isUtilized ? 'utilized' : ''}" data-tooltip="${tooltip.replace(/"/g, '&quot;')}">`;
            if (isUtilized) {
                html += count;
            }
            html += '</td>';
        });

        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    // Setup tooltip event listeners
    setupHeatmapTooltips();
}

function setupHeatmapTooltips() {
    const tooltip = document.getElementById('heatmapTooltip');
    const cells = document.querySelectorAll('.heatmap-cell[data-tooltip]');

    if (!tooltip) return;

    cells.forEach(cell => {
        // Desktop: hover events
        cell.addEventListener('mouseenter', function (e) {
            const tooltipText = this.getAttribute('data-tooltip');
            if (tooltipText && !tooltipText.includes('No appointments')) {
                tooltip.textContent = tooltipText;
                tooltip.style.display = 'block';
                positionTooltip(e);
            }
        });

        cell.addEventListener('mousemove', function (e) {
            if (tooltip.style.display === 'block') {
                positionTooltip(e);
            }
        });

        cell.addEventListener('mouseleave', function () {
            tooltip.style.display = 'none';
        });

        // Mobile: tap events
        cell.addEventListener('click', function (e) {
            e.stopPropagation();
            const tooltipText = this.getAttribute('data-tooltip');
            if (tooltipText && !tooltipText.includes('No appointments')) {
                tooltip.textContent = tooltipText;
                tooltip.style.display = 'block';

                // Position near the cell
                const rect = this.getBoundingClientRect();
                tooltip.style.left = rect.left + 'px';
                tooltip.style.top = (rect.bottom + 5) + 'px';
            }
        });
    });

    // Hide tooltip when clicking elsewhere
    document.addEventListener('click', function (e) {
        if (!e.target.classList.contains('heatmap-cell')) {
            tooltip.style.display = 'none';
        }
    });

    function positionTooltip(e) {
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = e.clientX + 10;
        let top = e.clientY + 10;

        // Prevent tooltip from going off-screen
        if (left + tooltipRect.width > window.innerWidth) {
            left = e.clientX - tooltipRect.width - 10;
        }
        if (top + tooltipRect.height > window.innerHeight) {
            top = e.clientY - tooltipRect.height - 10;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }
}

// ============= APPOINTMENTS =============

function handleAppointmentFilterChange() {
    const filterType = document.getElementById('appointmentFilterType').value;
    const dateRangeGroup = document.getElementById('appointmentDateRangeGroup');
    const dateRangeToGroup = document.getElementById('appointmentDateRangeToGroup');

    if (filterType === 'date-range') {
        dateRangeGroup.style.display = 'flex';
        dateRangeToGroup.style.display = 'flex';
    } else {
        dateRangeGroup.style.display = 'none';
        dateRangeToGroup.style.display = 'none';
    }

    applyAppointmentFilters();
}

function getAppointmentDateRange(filterType) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Create fresh date for today

    let dateFrom, dateTo;

    switch (filterType) {
        case 'today':
            // Use actual today's date
            dateFrom = new Date(today);
            dateTo = new Date(today);
            break;

        case 'this-week':
            // Calculate Monday (start of week)
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            let daysToMonday;

            if (dayOfWeek === 0) {
                // If today is Sunday, go back 6 days to get Monday
                daysToMonday = -6;
            } else {
                // For Monday (1) through Saturday (6), calculate days back to Monday
                daysToMonday = 1 - dayOfWeek; // Monday: 1-1=0, Tuesday: 1-2=-1, etc.
            }

            dateFrom = new Date(today);
            dateFrom.setDate(today.getDate() + daysToMonday);
            dateFrom.setHours(0, 0, 0, 0);

            // End of week (Sunday) - 6 days after Monday
            dateTo = new Date(dateFrom);
            dateTo.setDate(dateFrom.getDate() + 6);
            dateTo.setHours(0, 0, 0, 0);
            break;

        case 'this-month':
            // First day of current calendar month (e.g., January 1)
            dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
            dateFrom.setHours(0, 0, 0, 0);

            // Last day of current calendar month (e.g., January 31)
            dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            dateTo.setHours(0, 0, 0, 0);
            break;

        case 'date-range':
            const fromInput = document.getElementById('appointmentDateFrom');
            const toInput = document.getElementById('appointmentDateTo');
            dateFrom = fromInput?.value ? new Date(fromInput.value) : new Date(today);
            dateTo = toInput?.value ? new Date(toInput.value) : new Date(today);
            dateFrom.setHours(0, 0, 0, 0);
            dateTo.setHours(0, 0, 0, 0);
            break;

        default:
            dateFrom = new Date(today);
            dateTo = new Date(today);
    }

    // Format dates as YYYY-MM-DD using local timezone (not UTC)
    // This prevents timezone offset issues where UTC conversion shifts the date
    return {
        from: formatDateLocal(dateFrom),
        to: formatDateLocal(dateTo)
    };
}

async function loadAppointments() {
    // Get filter values
    const search = document.getElementById('searchPatient')?.value || '';
    const filterType = document.getElementById('appointmentFilterType')?.value || 'today';
    const doctor = document.getElementById('filterAppointmentDoctor')?.value || '';
    const status = document.getElementById('filterAppointmentStatus')?.value || '';
    const type = document.getElementById('filterAppointmentType')?.value || '';

    // Get date range based on filter type
    const dateRange = getAppointmentDateRange(filterType);

    // Build query string - use date_from and date_to for date range
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('date_from', dateRange.from);
    params.append('date_to', dateRange.to);
    if (doctor) params.append('doctor_id', doctor);
    if (status) params.append('status', status);
    if (type) params.append('type', type);

    const url = API_BASE + 'appointments.php?' + params.toString();

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            appointments = data.data.appointments || data.data;
            renderAppointments(appointments);

            // Update total count
            const totalCount = Array.isArray(appointments) ? appointments.length : 0;
            document.getElementById('appointmentsTotalCount').textContent = totalCount;

            // Populate doctors dropdown if available
            if (data.data.doctors) {
                populateAppointmentDoctorFilter(data.data.doctors);
            }
        } else {
            showToast('Failed to load appointments', 'error');
        }
    } catch (error) {
        console.error('Appointments error:', error);
        showToast('Failed to load appointments', 'error');
        document.getElementById('appointmentsTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center" style="color: #ef4444;">
                    Error loading appointments. Please refresh the page.
                </td>
            </tr>
        `;
    }
}

function applyAppointmentFilters() {
    loadAppointments();
}

function downloadAppointments() {
    // Get filter values
    const search = document.getElementById('searchPatient')?.value || '';
    const filterType = document.getElementById('appointmentFilterType')?.value || 'today';
    const doctor = document.getElementById('filterAppointmentDoctor')?.value || '';
    const status = document.getElementById('filterAppointmentStatus')?.value || '';

    // Get date range based on filter type
    const dateRange = getAppointmentDateRange(filterType);

    // Build query string
    const params = new URLSearchParams();
    params.append('action', 'export');
    if (search) params.append('search', search);
    params.append('date_from', dateRange.from);
    params.append('date_to', dateRange.to);
    if (doctor) params.append('doctor_id', doctor);
    if (status) params.append('status', status);

    // Trigger download
    const url = API_BASE + 'appointments.php?' + params.toString();
    window.location.href = url;
}

function populateAppointmentDoctorFilter(doctorsList) {
    const doctorSelect = document.getElementById('filterAppointmentDoctor');
    if (!doctorSelect) return;

    const currentValue = doctorSelect.value;
    doctorSelect.innerHTML = '<option value="">All Doctors</option>';

    doctorsList.forEach(doctor => {
        const option = document.createElement('option');
        option.value = doctor.id;
        option.textContent = doctor.doctor_name;
        doctorSelect.appendChild(option);
    });

    if (currentValue) {
        doctorSelect.value = currentValue;
    }
}

async function loadDoctorsForDashboard() {
    try {
        const response = await fetch(API_BASE + 'doctors.php');
        const data = await response.json();

        if (data.success && data.data) {
            populateDashboardDoctorFilter(data.data);
        }
    } catch (error) {
        console.error('Error loading doctors for dashboard filter:', error);
    }
}

function populateDashboardDoctorFilter(doctorsList) {
    const doctorSelect = document.getElementById('dashboardDoctor');
    if (!doctorSelect) return;

    const currentValue = doctorSelect.value;
    doctorSelect.innerHTML = '<option value="">All Doctors</option>';

    doctorsList.forEach(doctor => {
        const option = document.createElement('option');
        option.value = doctor.id;
        option.textContent = doctor.doctor_name;
        doctorSelect.appendChild(option);
    });

    if (currentValue) {
        doctorSelect.value = currentValue;
    }
}

function formatSlotTime(startTime, endTime) {
    // Convert time strings (HH:MM:SS or HH:MM) to slot format (HH:MM - HH:MM)
    const formatTime = (timeStr) => {
        return timeStr.substring(0, 5); // Get HH:MM from HH:MM:SS
    };

    const start = formatTime(startTime || '');
    const end = formatTime(endTime || '');

    if (start && end) {
        return `${start} - ${end}`;
    }

    // Fallback if times are missing
    return start || 'N/A';
}

function renderAppointments(appointmentsList) {
    if (!appointmentsList || appointmentsList.length === 0) {
        document.getElementById('appointmentsTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center empty-state">
                    <div style="padding: 2rem;">
                        <i data-lucide="calendar" style="width: 48px; height: 48px; color: #d1d5db; margin-bottom: 1rem;"></i>
                        <p style="color: #6b7280;">No appointments found</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        let html = '';
        appointmentsList.forEach(apt => {
            const statusClass = apt.appointment_status.toLowerCase().replace('_', '-');
            // Format date as M/D/YYYY
            const dateParts = apt.appointment_date.split('-');
            const formattedDate = `${parseInt(dateParts[1])}/${parseInt(dateParts[2])}/${dateParts[0]}`;

            // Format slot time as "09:00 - 12:00" using actual slot range
            const slotTime = formatSlotTime(apt.start_time || apt.slot_start_time, apt.end_time || apt.slot_end_time);

            html += `
                <tr>
                    <td style="font-weight: 500; color: #111827;">${formattedDate}</td>
                    <td style="font-weight: 600; color: #111827;">${slotTime}</td>
                    <td style="color: #374151;">${apt.doctor_name}</td>
                    <td style="font-weight: 500; color: #111827;">${apt.patient_name || 'N/A'}</td>
                    <td style="color: #6b7280; font-family: monospace;">${apt.whatsapp_number}</td>
                    <td>
                        <span class="status-badge" style="background-color: ${apt.is_followup ? '#e0f2fe' : '#f3f4f6'}; color: ${apt.is_followup ? '#0369a1' : '#374151'}; border: 1px solid ${apt.is_followup ? '#bae6fd' : '#e5e7eb'};">
                            ${apt.is_followup ? 'Follow-up' : 'Normal'}
                        </span>
                    </td>
                    <td><span class="status-badge status-${statusClass}">${apt.appointment_status.replace('_', '-')}</span></td>
                    <td>
                        <div class="action-buttons-icons">
                            ${apt.appointment_status === 'BOOKED' ? `
                                ${!apt.is_followup ? `
                                    <button class="action-icon action-icon-success" onclick="openConsultationModal(${apt.id})" title="Consultation & Follow-up">
                                        <i data-lucide="stethoscope"></i>
                                    </button>
                                ` : `
                                    <button class="action-icon action-icon-success" onclick="updateAppointmentStatus(${apt.id}, 'COMPLETED')" title="Mark as Completed">
                                        <i data-lucide="check"></i>
                                    </button>
                                `}
                                <button class="action-icon action-icon-warning" onclick="updateAppointmentStatus(${apt.id}, 'NO_SHOW')" title="Mark as No-Show">
                                    <i data-lucide="user-x"></i>
                                </button>
                                <button class="action-icon action-icon-danger" onclick="updateAppointmentStatus(${apt.id}, 'CANCELLED')" title="Cancel Appointment">
                                    <i data-lucide="x-circle"></i>
                                </button>
                            ` : ''}
                            ${apt.appointment_status === 'CANCELLED' ? `
                                <button class="action-icon action-icon-success" onclick="updateAppointmentStatus(${apt.id}, 'COMPLETED')" title="Mark as Completed">
                                    <i data-lucide="check-circle"></i>
                                </button>
                                <button class="action-icon action-icon-warning" onclick="updateAppointmentStatus(${apt.id}, 'NO_SHOW')" title="Mark as No-Show">
                                    <i data-lucide="user-x"></i>
                                </button>
                            ` : ''}
                            ${apt.appointment_status === 'NO_SHOW' ? `
                                <button class="action-icon action-icon-success" onclick="updateAppointmentStatus(${apt.id}, 'COMPLETED')" title="Mark as Completed">
                                    <i data-lucide="check-circle"></i>
                                </button>
                                <button class="action-icon action-icon-danger" onclick="updateAppointmentStatus(${apt.id}, 'CANCELLED')" title="Cancel Appointment">
                                    <i data-lucide="x-circle"></i>
                                </button>
                            ` : ''}
                            ${apt.appointment_status === 'COMPLETED' ? `
                                <button class="action-icon action-icon-warning" onclick="updateAppointmentStatus(${apt.id}, 'NO_SHOW')" title="Mark as No-Show">
                                    <i data-lucide="user-x"></i>
                                </button>
                                <button class="action-icon action-icon-danger" onclick="updateAppointmentStatus(${apt.id}, 'CANCELLED')" title="Cancel Appointment">
                                    <i data-lucide="x-circle"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });
        document.getElementById('appointmentsTableBody').innerHTML = html;
    }

    lucide.createIcons();
}

async function loadDoctorsForAppointments() {
    try {
        const response = await fetch(API_BASE + 'doctors.php');
        const data = await response.json();

        if (data.success && data.data) {
            populateAppointmentDoctorFilter(data.data);
        }
    } catch (error) {
        console.error('Error loading doctors for filter:', error);
    }
}

function viewAppointmentDetails(appointmentId) {
    const appointment = appointments.find(a => a.id == appointmentId);
    if (appointment) {
        const timeSlot = appointment.start_time && appointment.end_time
            ? `${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}`
            : (appointment.slot_start_time && appointment.slot_end_time
                ? `${formatTime(appointment.slot_start_time)} - ${formatTime(appointment.slot_end_time)}`
                : 'N/A');
        alert(`Appointment Details:\n\nPatient: ${appointment.patient_name}\nDoctor: ${appointment.doctor_name}\nDate: ${appointment.appointment_date}\nTime: ${timeSlot}\nStatus: ${appointment.appointment_status}\nWhatsApp: ${appointment.whatsapp_number}`);
    }
}

async function updateAppointmentStatus(appointmentId, status, notes = null) {
    try {
        const payload = { id: appointmentId, status: status };
        if (notes !== null) payload.notes = notes;

        const response = await fetch(API_BASE + 'appointments.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            const statusTextMap = {
                'COMPLETED': 'completed',
                'CANCELLED': 'cancelled',
                'NO_SHOW': 'no-show',
                'BOOKED': 'booked'
            };
            const statusText = statusTextMap[status] || status.toLowerCase();
            showToast(`Appointment marked as ${statusText}`, 'success');
            // Reload both appointments and dashboard
            await loadAppointments();
            await applyDashboardFilters();
        } else {
            showToast(data.message || 'Failed to update appointment', 'error');
        }
    } catch (error) {
        console.error('Update error:', error);
        showToast('Failed to update appointment', 'error');
    }
}

// ============= DOCTORS =============

async function loadDoctors() {
    try {
        const response = await fetch(API_BASE + 'doctors.php');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            doctors = data.data;
            renderDoctors(data.data);
        } else {
            const errorMsg = data.message || 'Failed to load doctors';
            console.error('Doctors API error:', errorMsg);
            showToast(errorMsg, 'error');
            const container = document.getElementById('doctorsCardContainer');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; color: #ef4444;">
                        <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: #ef4444; margin-bottom: 1rem;"></i>
                        <p>${errorMsg}</p>
                    </div>
                `;
                lucide.createIcons();
            }
        }
    } catch (error) {
        console.error('Doctors fetch error:', error);
        const errorMsg = error.message || 'Failed to load doctors. Please check your connection and try again.';
        showToast(errorMsg, 'error');
        const container = document.getElementById('doctorsCardContainer');
        if (container) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; color: #ef4444;">
                    <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: #ef4444; margin-bottom: 1rem;"></i>
                    <p>Error: ${errorMsg}</p>
                    <small style="font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem; display: block;">Please check browser console for details</small>
                </div>
            `;
            lucide.createIcons();
        }
    }
}

function renderDoctors(doctorsList) {
    const container = document.getElementById('doctorsCardContainer');
    if (!container) return;

    if (!doctorsList || doctorsList.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i data-lucide="user-x" style="width: 48px; height: 48px; color: #d1d5db; margin-bottom: 1rem;"></i>
                <p style="color: #6b7280; font-size: 0.875rem;">No doctors available</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    let html = '';
    doctorsList.forEach(doctor => {
        const practiceArea = doctor.practice_area || '';
        const specialization = doctor.specialization || 'General Medicine';
        const activeSlotsCount = parseInt(doctor.active_slots_count) || 0;
        const slotBadgeColor = activeSlotsCount > 0 ? '#10b981' : '#6b7280';
        const slotBadgeBg = activeSlotsCount > 0 ? '#d1fae5' : '#f3f4f6';

        html += `
            <div class="doctor-card-clickable" onclick="manageWeeklySchedule(${doctor.id})">
                <div class="doctor-card-content">
                    <div class="doctor-card-avatar-circle" style="overflow: hidden; padding: 0;">
                        <img src="assets/images/doctor_avatar.png" alt="Doctor" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div class="doctor-card-info">
                        <h3 class="doctor-card-name">${doctor.doctor_name}</h3>
                        <p class="doctor-card-specialty">${specialization}</p>
                        ${practiceArea ? `<p class="doctor-card-subspecialty">${practiceArea}</p>` : ''}
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.5rem;">
                            <span style="background:${slotBadgeBg}; color:${slotBadgeColor}; font-size:0.75rem; font-weight:600; padding:0.2rem 0.6rem; border-radius:999px; display:inline-flex; align-items:center; gap:0.3rem;">
                                <i data-lucide="clock" style="width:12px;height:12px;"></i>
                                ${activeSlotsCount} active slot${activeSlotsCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="doctor-card-footer" style="border-top:1px solid #f3f4f6; padding-top:0.875rem; margin-top:0.875rem; display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-size:0.8125rem; color:#3b82f6; font-weight:600; display:inline-flex; align-items:center; gap:0.375rem;">
                        <i data-lucide="calendar-check" style="width:14px;height:14px;"></i>
                        Manage Slots
                    </span>
                    <i data-lucide="chevron-right" class="doctor-card-chevron"></i>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;

    lucide.createIcons();
}

async function toggleDoctorStatus(id, isActive) {
    try {
        const response = await fetch(API_BASE + 'doctors.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_active: isActive })
        });

        const data = await response.json();

        if (data.success) {
            showToast(data.message || `Doctor ${isActive ? 'enabled' : 'disabled'}`, 'success');
            await loadDoctors();
        } else {
            showToast(data.message || 'Failed to update doctor', 'error');
            await loadDoctors(); // Reload to revert toggle state
        }
    } catch (error) {
        console.error('Update error:', error);
        showToast('Failed to update doctor', 'error');
        await loadDoctors(); // Reload to revert toggle state
    }
}

function editDoctor(id) {
    showToast('Edit doctor functionality coming soon', 'info');
    // TODO: Implement edit doctor modal/form
}

// ============= WEEKLY SCHEDULE MANAGEMENT =============

let currentDoctorId = null;
let currentDoctor = null;

async function manageWeeklySchedule(doctorId) {
    currentDoctorId = doctorId;

    // Load doctor details
    try {
        const response = await fetch(API_BASE + 'doctors.php');
        const data = await response.json();

        if (data.success) {
            currentDoctor = data.data.find(d => d.id == doctorId);
            if (currentDoctor) {
                displayDoctorProfile(currentDoctor);
                await loadWeeklySchedule(doctorId);

                // Navigate to weekly schedule page
                navigateToPage('weeklySchedule');
            } else {
                showToast('Doctor not found', 'error');
            }
        }
    } catch (error) {
        console.error('Error loading doctor:', error);
        showToast('Failed to load doctor details', 'error');
    }
}

function displayDoctorProfile(doctor) {
    document.getElementById('doctorProfileName').textContent = doctor.doctor_name;
    document.getElementById('doctorProfileSpecialty').textContent = doctor.specialization || 'N/A';
    document.getElementById('doctorProfilePractice').textContent = doctor.practice_area || 'N/A';

    lucide.createIcons();
}

async function loadWeeklySchedule(doctorId) {
    try {
        const response = await fetch(API_BASE + 'doctors.php?action=weekly_slots&doctor_id=' + doctorId);
        const data = await response.json();

        if (data.success) {
            renderWeeklySchedule(data.data || []);
        } else {
            showToast('Failed to load weekly schedule', 'error');
            renderWeeklySchedule([]);
        }
    } catch (error) {
        console.error('Error loading weekly schedule:', error);
        showToast('Failed to load weekly schedule', 'error');
        renderWeeklySchedule([]);
    }
}

function renderWeeklySchedule(slots) {
    const container = document.getElementById('weeklyScheduleContainer');
    const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    let html = '';

    daysOfWeek.forEach((day, index) => {
        const daySlots = slots.filter(slot => slot.day_of_week === day);
        const dayLabel = dayLabels[index];

        html += `
            <div class="schedule-day-card">
                <h4 class="schedule-day-title">${dayLabel}</h4>
                <div class="schedule-slots-list" id="slots-${day}">
        `;

        if (daySlots.length === 0) {
            html += `
                <div class="no-slots-message">
                    No slots scheduled
                </div>
            `;
        } else {
            daySlots.forEach(slot => {
                const startTime = formatTime(slot.start_time);
                const endTime = formatTime(slot.end_time);
                const isActive = slot.is_active == 1 || slot.is_active === true;
                const statusClass = isActive ? 'active' : 'inactive';

                html += `
                    <div class="slot-item">
                        <div class="slot-info">
                            <div class="slot-toggle">
                                <label class="toggle-switch">
                                    <input type="checkbox" ${isActive ? 'checked' : ''} 
                                           onchange="toggleWeeklySlot(${slot.id}, this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="slot-details">
                                <div class="slot-time">${startTime} - ${endTime}</div>
                                <div class="slot-capacity">
                                    <i data-lucide="users" style="width: 14px; height: 14px;"></i>
                                    Max Capacity: ${slot.max_capacity}
                                </div>
                            </div>
                            <span class="status-badge status-${statusClass}">${isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div class="slot-actions">
                            <button class="btn-icon" onclick="editWeeklySlot(${slot.id})" title="Edit">
                                <i data-lucide="edit"></i>
                            </button>
                            <button class="btn-icon btn-icon-danger" onclick="deleteWeeklySlot(${slot.id})" title="Delete">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    lucide.createIcons();
}

function formatTime(timeString) {
    // Convert "09:00:00" to "09:00"
    if (!timeString) return '';
    return timeString.substring(0, 5);
}

function navigateToPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });

    // Show target page
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Update header title
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
        if (pageName === 'weeklySchedule') {
            headerTitle.textContent = 'Weekly Schedule';
        } else if (pageName === 'doctors') {
            headerTitle.textContent = 'Doctor Schedule';
        }
    }

    // Toggle contextual header button
    updateHeaderButton(pageName);

    // Update navigation buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
    });

    // If navigating to weekly schedule, keep doctors nav active
    if (pageName !== 'weeklySchedule') {
        const navBtn = document.querySelector(`.nav-item[data-page="${pageName}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        }
    } else {
        const doctorsBtn = document.querySelector('.nav-item[data-page="doctors"]');
        if (doctorsBtn) {
            doctorsBtn.classList.add('active');
        }
    }

    // Close mobile menu on mobile devices
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
    }

    lucide.createIcons();
}

// ============= HEADER BUTTON MANAGEMENT =============

function updateHeaderButton(page) {
    const newApptBtn = document.getElementById('newAppointmentBtn');
    const doctorSlotsBtn = document.getElementById('doctorSlotsBtn');
    if (!newApptBtn || !doctorSlotsBtn) return;

    const isDoctorsPage = (page === 'doctors' || page === 'weeklySchedule');

    if (isDoctorsPage) {
        newApptBtn.style.display = 'none';
        // Only show Add Slot button when on the weekly schedule page (a doctor selected)
        doctorSlotsBtn.style.display = (page === 'weeklySchedule') ? '' : 'none';
    } else {
        newApptBtn.style.display = '';
        doctorSlotsBtn.style.display = 'none';
    }

    lucide.createIcons();
}

function openAddSlotModal() {
    document.getElementById('slotModalTitle').textContent = 'Add Slot';
    document.getElementById('slotForm').reset();
    document.getElementById('slotId').value = '';
    document.getElementById('slotDoctorId').value = currentDoctorId;
    document.getElementById('slotIsActive').checked = true;

    // Show Day of Week, Start Time, and End Time fields for adding
    document.getElementById('slotDayOfWeekGroup').style.display = 'block';
    document.getElementById('slotStartTimeGroup').style.display = 'block';
    document.getElementById('slotEndTimeGroup').style.display = 'block';

    // Make fields required for adding
    document.getElementById('slotDayOfWeek').required = true;
    document.getElementById('slotStartTime').required = true;
    document.getElementById('slotEndTime').required = true;

    document.getElementById('slotModal').style.display = 'flex';
}

function closeSlotModal() {
    document.getElementById('slotModal').style.display = 'none';
    document.getElementById('slotForm').reset();
}

function editWeeklySlot(slotId) {
    // Load slot details and populate form
    fetch(API_BASE + 'doctors.php?action=get_weekly_slot&id=' + slotId)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                const slot = data.data;
                document.getElementById('slotModalTitle').textContent = 'Edit Slot';
                document.getElementById('slotId').value = slot.id;
                document.getElementById('slotDoctorId').value = slot.doctor_id;

                // Hide Day of Week, Start Time, and End Time fields (not editable)
                document.getElementById('slotDayOfWeekGroup').style.display = 'none';
                document.getElementById('slotStartTimeGroup').style.display = 'none';
                document.getElementById('slotEndTimeGroup').style.display = 'none';

                // Remove required attribute for editing (these fields are hidden)
                document.getElementById('slotDayOfWeek').required = false;
                document.getElementById('slotStartTime').required = false;
                document.getElementById('slotEndTime').required = false;

                // Populate hidden values (for reference, not shown)
                document.getElementById('slotDayOfWeek').value = slot.day_of_week;
                document.getElementById('slotStartTime').value = slot.start_time.substring(0, 5);
                document.getElementById('slotEndTime').value = slot.end_time.substring(0, 5);

                // Populate editable fields
                document.getElementById('slotMaxCapacity').value = slot.max_capacity;
                document.getElementById('slotIsActive').checked = slot.is_active == 1 || slot.is_active === true;
                document.getElementById('slotModal').style.display = 'flex';
            } else {
                showToast('Failed to load slot details', 'error');
            }
        })
        .catch(error => {
            console.error('Error loading slot:', error);
            showToast('Failed to load slot details', 'error');
        });
}

async function saveSlot() {
    const form = document.getElementById('slotForm');
    const slotId = document.getElementById('slotId').value;
    const isEdit = slotId && slotId !== '';

    // For adding new slot, validate all fields
    if (!isEdit && !form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // For editing, only validate visible fields
    if (isEdit) {
        const maxCapacity = document.getElementById('slotMaxCapacity').value;
        if (!maxCapacity || maxCapacity < 1) {
            showToast('Max capacity is required and must be at least 1', 'error');
            return;
        }
    }

    const slotData = {
        id: slotId || null,
        doctor_id: parseInt(document.getElementById('slotDoctorId').value),
        max_capacity: parseInt(document.getElementById('slotMaxCapacity').value),
        is_active: document.getElementById('slotIsActive').checked
    };

    // Only include day_of_week, start_time, end_time when adding new slot
    if (!isEdit) {
        slotData.day_of_week = document.getElementById('slotDayOfWeek').value;
        slotData.start_time = document.getElementById('slotStartTime').value + ':00';
        slotData.end_time = document.getElementById('slotEndTime').value + ':00';

        // Validate time range for new slots
        if (slotData.start_time >= slotData.end_time) {
            showToast('End time must be after start time', 'error');
            return;
        }
    }

    try {
        const method = isEdit ? 'PUT' : 'POST';
        const url = API_BASE + 'doctors.php?action=weekly_slots';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slotData)
        });

        const data = await response.json();

        if (data.success) {
            let message = data.message || 'Slot saved successfully';
            if (data.warning) {
                message += '. ' + data.warning;
            }
            showToast(message, 'success');
            closeSlotModal();
            await loadWeeklySchedule(currentDoctorId);
        } else {
            showToast(data.message || 'Failed to save slot', 'error');
        }
    } catch (error) {
        console.error('Error saving slot:', error);
        showToast('Failed to save slot', 'error');
    }
}

async function toggleWeeklySlot(slotId, isActive) {
    try {
        const response = await fetch(API_BASE + 'doctors.php?action=toggle_weekly_slot', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: slotId, is_active: isActive })
        });

        const data = await response.json();

        if (data.success) {
            // Show warning if deactivating and there are BOOKED appointments
            if (!isActive && data.warning && data.appointment_details && data.appointment_details.length > 0) {
                // Build detailed warning message with appointment dates
                let warningMsg = data.warning + '\n\n';

                // Add appointment details
                const appointmentList = data.appointment_details.map(apt => {
                    const date = new Date(apt.date + 'T00:00:00'); // Ensure correct date parsing
                    const formattedDate = date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    return `• ${formattedDate}: ${apt.count} booked appointment${apt.count > 1 ? 's' : ''}`;
                }).join('\n');

                warningMsg += appointmentList + '\n\nThe slot has been marked inactive.';

                // Show warning alert (can be replaced with custom modal later)
                alert(warningMsg);

                // Also show success toast
                showToast(`Slot deactivated. Warning: ${data.total_appointments || data.appointment_details.reduce((sum, apt) => sum + apt.count, 0)} booked appointment(s) found.`, 'success');
            } else {
                showToast(`Slot ${isActive ? 'activated' : 'deactivated'}`, 'success');
            }

            await loadWeeklySchedule(currentDoctorId);
        } else {
            showToast(data.message || 'Failed to update slot', 'error');
            await loadWeeklySchedule(currentDoctorId); // Reload to revert
        }
    } catch (error) {
        console.error('Error toggling slot:', error);
        showToast('Failed to update slot', 'error');
        await loadWeeklySchedule(currentDoctorId); // Reload to revert
    }
}

async function deleteWeeklySlot(slotId) {
    if (!confirm('Are you sure you want to delete this slot?')) {
        return;
    }

    try {
        const response = await fetch(API_BASE + 'doctors.php?action=delete_weekly_slot', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: slotId })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Slot deleted successfully', 'success');
            await loadWeeklySchedule(currentDoctorId);
        } else {
            showToast(data.message || 'Failed to delete slot', 'error');
        }
    } catch (error) {
        console.error('Error deleting slot:', error);
        showToast('Failed to delete slot', 'error');
    }
}

// ============= UTILITY FUNCTIONS =============

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Handle Enter key on login
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const loginPage = document.getElementById('loginPage');
        if (loginPage && loginPage.style.display !== 'none') {
            handleLogin();
        }
    }
});

// ============================================================
//  NEW APPOINTMENT MODAL
// ============================================================

// --- State ---
let naPatientSearchTimer = null;
let naSelectedPatient = null;   // { id, patient_name, whatsapp_number }
let naIsNewPatientMode = false;

// --- Open / Close ---
function openNewAppointmentModal(followupData = null) {
    resetNewAppointmentForm();
    loadDoctorsForNewAppointment();

    // Set date min to today
    const dateInput = document.getElementById('naDateInput');
    if (dateInput) {
        const today = formatDateLocal(new Date());
        dateInput.min = today;
        dateInput.value = today;
    }

    // Auto-populate if follow-up data provided
    if (followupData) {
        // Set patient using official selection mechanism
        selectNaPatient(followupData.patient_id, followupData.patient_name, followupData.whatsapp_number);

        // Disable search input to prevent changes
        const patientSearchInput = document.getElementById('naPatientSearchInput');
        if (patientSearchInput) {
            patientSearchInput.disabled = true;
            patientSearchInput.parentElement.style.display = 'none';
        }

        // Hide "Add new patient" toggle and "Clear patient" button for follow-ups
        const toggleContainer = document.getElementById('naToggleNewPatientContainer');
        const clearBtn = document.getElementById('naClearPatientBtn');
        if (toggleContainer) toggleContainer.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';

        // Set doctor
        const doctorSelect = document.getElementById('naDoctorSelect');
        if (doctorSelect) {
            doctorSelect.value = followupData.doctor_id;
        }

        // Set date
        if (dateInput) {
            dateInput.value = followupData.expected_date;
        }

        // Set session ID
        const sessionIdEl = document.getElementById('naFollowupSessionId');
        if (sessionIdEl) sessionIdEl.value = followupData.session_id;

        // Load slots and show new appointment button
        loadSlotsForBooking();
    }

    document.getElementById('newAppointmentModal').style.display = 'flex';
    setTimeout(() => {
        lucide.createIcons();
        const searchInput = document.getElementById('naPatientSearchInput');
        if (searchInput && !followupData) searchInput.focus();
    }, 100);
}

function closeNewAppointmentModal() {
    document.getElementById('newAppointmentModal').style.display = 'none';
    resetNewAppointmentForm();
}

function handleNaOverlayClick(e) {
    if (e.target === document.getElementById('newAppointmentModal')) {
        closeNewAppointmentModal();
    }
}

function resetNewAppointmentForm() {
    naSelectedPatient = null;
    naIsNewPatientMode = false;

    // Patient search section
    const searchSection = document.getElementById('naPatientSearchSection');
    const newSection = document.getElementById('naNewPatientSection');
    if (searchSection) searchSection.style.display = 'block';
    if (newSection) newSection.style.display = 'none';

    const chip = document.getElementById('naSelectedPatientChip');
    if (chip) chip.style.display = 'none';

    // Show clear button and new patient toggle
    const clearBtn = document.getElementById('naClearPatientBtn');
    const toggleContainer = document.getElementById('naToggleNewPatientContainer');
    if (clearBtn) clearBtn.style.display = 'inline-block';
    if (toggleContainer) toggleContainer.style.display = 'block';

    const searchInput = document.getElementById('naPatientSearchInput');
    if (searchInput) {
        searchInput.disabled = false;
        searchInput.value = '';
        searchInput.parentElement.style.display = 'block';
    }

    const autocomplete = document.getElementById('naPatientAutocomplete');
    if (autocomplete) { autocomplete.style.display = 'none'; autocomplete.innerHTML = ''; }

    const patientId = document.getElementById('naPatientId');
    if (patientId) patientId.value = '';

    // New patient fields
    const nameEl = document.getElementById('naNewPatientName');
    const phoneEl = document.getElementById('naNewPatientPhone');
    if (nameEl) nameEl.value = '';
    if (phoneEl) phoneEl.value = '';

    // Schedule
    const doctorSelect = document.getElementById('naDoctorSelect');
    if (doctorSelect) doctorSelect.value = '';

    const slotSelect = document.getElementById('naSlotSelect');
    if (slotSelect) {
        slotSelect.innerHTML = '<option value="">Select doctor &amp; date first...</option>';
        slotSelect.disabled = true;
    }

    const slotHint = document.getElementById('naSlotHint');
    if (slotHint) slotHint.style.display = 'none';

    // Notes
    const notesEl = document.getElementById('naNotesInput');
    if (notesEl) notesEl.value = '';

    const sessionIdEl = document.getElementById('naFollowupSessionId');
    if (sessionIdEl) sessionIdEl.value = '';

    const patientSearchInput = document.getElementById('naPatientSearchInput');
    if (patientSearchInput) patientSearchInput.disabled = false;

    // Save button
    const saveBtn = document.getElementById('naSaveBtn');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i data-lucide="check"></i> Book Appointment'; }
}

// --- Load doctors for modal dropdown ---
async function loadDoctorsForNewAppointment() {
    try {
        const response = await fetch(API_BASE + 'doctors.php');
        const data = await response.json();
        const list = data.data || data.doctors || [];

        const doctorSelect = document.getElementById('naDoctorSelect');
        if (!doctorSelect) return;

        doctorSelect.innerHTML = '<option value="">Select doctor...</option>';
        list.forEach(d => {
            if (d.is_active == 1 || d.is_active === true) {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.doctor_name;
                doctorSelect.appendChild(opt);
            }
        });
    } catch (err) {
        console.error('Error loading doctors for booking modal:', err);
    }
}

// --- Patient Search (debounced) ---
function onNaPatientSearch(query) {
    clearTimeout(naPatientSearchTimer);
    const q = query.trim();

    if (q.length < 2) {
        hideNaAutocomplete();
        return;
    }

    naPatientSearchTimer = setTimeout(() => searchNaPatients(q), 280);
}

async function searchNaPatients(query) {
    try {
        const res = await fetch(API_BASE + 'patients.php?search=' + encodeURIComponent(query));
        const data = await res.json();
        renderNaAutocomplete(data.data || []);
    } catch (err) {
        console.error('Patient search error:', err);
        hideNaAutocomplete();
    }
}

function renderNaAutocomplete(patients) {
    const box = document.getElementById('naPatientAutocomplete');
    if (!box) return;

    if (patients.length === 0) {
        box.innerHTML = '<div class="na-autocomplete-empty">No patients found — try "Add new patient".</div>';
        box.style.display = 'block';
        return;
    }

    box.innerHTML = patients.map(p => `
        <div class="na-autocomplete-item" onclick="selectNaPatient(${p.id}, '${escapeJs(p.patient_name)}', '${escapeJs(p.whatsapp_number)}')">
            <i data-lucide="user"></i>
            <div>
                <div class="na-autocomplete-name">${escapeHtml(p.patient_name)}</div>
                <div class="na-autocomplete-phone">${escapeHtml(p.whatsapp_number)}</div>
            </div>
        </div>
    `).join('');
    box.style.display = 'block';
    lucide.createIcons();
}

function hideNaAutocomplete() {
    const box = document.getElementById('naPatientAutocomplete');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}

function selectNaPatient(id, name, phone) {
    naSelectedPatient = { id, patient_name: name, whatsapp_number: phone };

    document.getElementById('naPatientId').value = id;
    document.getElementById('naSelectedPatientLabel').textContent = `${name}  (${phone})`;
    document.getElementById('naSelectedPatientChip').style.display = 'inline-flex';
    document.getElementById('naPatientSearchInput').value = '';
    hideNaAutocomplete();
    lucide.createIcons();
}

function clearSelectedPatient() {
    naSelectedPatient = null;
    document.getElementById('naPatientId').value = '';
    document.getElementById('naSelectedPatientChip').style.display = 'none';
    document.getElementById('naPatientSearchInput').value = '';
    document.getElementById('naPatientSearchInput').focus();
    lucide.createIcons();
}

// --- Toggle new patient form ---
function toggleNewPatientForm() {
    naIsNewPatientMode = !naIsNewPatientMode;

    const searchSection = document.getElementById('naPatientSearchSection');
    const newSection = document.getElementById('naNewPatientSection');

    if (naIsNewPatientMode) {
        searchSection.style.display = 'none';
        newSection.style.display = 'block';
        // Clear any selected existing patient
        naSelectedPatient = null;
        document.getElementById('naPatientId').value = '';
        document.getElementById('naSelectedPatientChip').style.display = 'none';
        hideNaAutocomplete();
        setTimeout(() => document.getElementById('naNewPatientName').focus(), 50);
    } else {
        searchSection.style.display = 'block';
        newSection.style.display = 'none';
        // Clear new patient fields
        document.getElementById('naNewPatientName').value = '';
        document.getElementById('naNewPatientPhone').value = '';
    }
    lucide.createIcons();
}

// --- Load available slots ---
async function loadSlotsForBooking() {
    const doctorId = document.getElementById('naDoctorSelect').value;
    const date = document.getElementById('naDateInput').value;
    const slotSelect = document.getElementById('naSlotSelect');
    const slotHint = document.getElementById('naSlotHint');

    if (!doctorId || !date) {
        slotSelect.innerHTML = '<option value="">Select doctor &amp; date first...</option>';
        slotSelect.disabled = true;
        slotHint.style.display = 'none';
        return;
    }

    slotSelect.innerHTML = '<option value="">Loading slots...</option>';
    slotSelect.disabled = true;
    slotHint.style.display = 'none';

    try {
        const url = `${API_BASE}slots.php?doctor_id=${doctorId}&date=${date}&available_only=1`;
        const res = await fetch(url);
        const data = await res.json();
        const slots = data.data || [];

        if (slots.length === 0) {
            slotSelect.innerHTML = '<option value="">No available slots for this date</option>';
            slotHint.textContent = 'No open slots — all are full or none are scheduled.';
            slotHint.style.display = 'block';
            return;
        }

        slotSelect.innerHTML = '<option value="">Select a time slot...</option>';
        slots.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            const start = s.start_time.substring(0, 5);
            const end = s.end_time.substring(0, 5);
            const left = s.max_capacity - s.booked_count;
            opt.textContent = `${formatTimeTo12h(start)} – ${formatTimeTo12h(end)}  (${left} spot${left !== 1 ? 's' : ''} left)`;
            opt.dataset.slotId = s.id;
            slotSelect.appendChild(opt);
        });
        slotSelect.disabled = false;
    } catch (err) {
        console.error('Slot loading error:', err);
        slotSelect.innerHTML = '<option value="">Error loading slots</option>';
    }
}

// Helper: 24h → 12h format
function formatTimeTo12h(time24) {
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Helper: escape HTML to prevent XSS in rendered strings
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Helper: escape for inline JS string attrs
function escapeJs(str) {
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// --- Save appointment ---
async function saveNewAppointment() {
    const saveBtn = document.getElementById('naSaveBtn');

    // ---- 1. Resolve patient ID ----
    let patientId = parseInt(document.getElementById('naPatientId').value) || 0;

    if (naIsNewPatientMode) {
        // Create new patient first
        const nameVal = document.getElementById('naNewPatientName').value.trim();
        const phoneVal = document.getElementById('naNewPatientPhone').value.trim();

        if (!nameVal) { showToast('Please enter the patient name.', 'error'); return; }
        if (!phoneVal) { showToast('Please enter the WhatsApp number.', 'error'); return; }

        // Build normalized number
        const fullPhone = normalizePhone(phoneVal);

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Creating patient...';

            const res = await fetch(API_BASE + 'patients.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_name: nameVal, whatsapp_number: fullPhone })
            });
            const data = await res.json();

            if (!data.success) {
                showToast(data.message || 'Failed to create patient', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="check"></i> Book Appointment';
                lucide.createIcons();
                return;
            }

            patientId = data.data.id;

            if (data.existing) {
                showToast(`Existing patient found: ${data.data.patient_name}`, 'info');
            }
        } catch (err) {
            showToast('Error creating patient. Please try again.', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="check"></i> Book Appointment';
            lucide.createIcons();
            return;
        }
    }

    // ---- 2. Validate remaining fields ----
    if (!patientId) {
        showToast('Please select or add a patient.', 'error');
        return;
    }

    const doctorId = document.getElementById('naDoctorSelect').value;
    if (!doctorId) { showToast('Please select a doctor.', 'error'); return; }

    const date = document.getElementById('naDateInput').value;
    if (!date) { showToast('Please select a date.', 'error'); return; }

    const slotId = document.getElementById('naSlotSelect').value;
    if (!slotId) { showToast('Please select a time slot.', 'error'); return; }

    const notes = document.getElementById('naNotesInput').value.trim();

    // ---- 3. POST appointment ----
    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader"></i> Booking...';
        lucide.createIcons();

        const followupSessionId = document.getElementById('naFollowupSessionId')?.value || null;

        const res = await fetch(API_BASE + 'appointments.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_id: patientId,
                doctor_id: parseInt(doctorId),
                slot_id: parseInt(slotId),
                appointment_date: date,
                notes: notes,
                followup_session_id: followupSessionId
            })
        });
        const data = await res.json();

        if (data.success) {
            const waMsg = data.wa_sent
                ? 'Appointment booked! WhatsApp confirmation sent ✅'
                : 'Appointment booked! (WhatsApp not sent)';
            showToast(waMsg, 'success');
            closeNewAppointmentModal();

            // Refresh dashboard if on dashboard page
            const dashboardPage = document.getElementById('dashboardPage');
            if (dashboardPage && dashboardPage.classList.contains('active')) {
                applyDashboardFilters();
            }
            // Refresh appointments page if active
            const appointmentsPage = document.getElementById('appointmentsPage');
            if (appointmentsPage && appointmentsPage.classList.contains('active')) {
                handleAppointmentFilterChange();
            }
        } else {
            showToast(data.message || 'Failed to book appointment', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="check"></i> Book Appointment';
            lucide.createIcons();
        }
    } catch (err) {
        console.error('Appointment booking error:', err);
        showToast('Connection error. Please try again.', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="check"></i> Book Appointment';
        lucide.createIcons();
    }
}

// Close autocomplete when clicking outside patient search
document.addEventListener('click', function (e) {
    const searchWrapper = document.querySelector('.na-patient-search-wrapper');
    const autocomplete = document.getElementById('naPatientAutocomplete');
    if (searchWrapper && autocomplete && !searchWrapper.contains(e.target)) {
        hideNaAutocomplete();
    }
});

function bookFollowupSession(planId, sessionNum, patientId, doctorId, patientName, date, sessionId, whatsappNumber) {
    openNewAppointmentModal({
        plan_id: planId,
        session_number: sessionNum,
        patient_id: patientId,
        doctor_id: doctorId,
        patient_name: patientName,
        whatsapp_number: normalizePhone(whatsappNumber),
        expected_date: date,
        session_id: sessionId
    });
}

// ============= CONSULTATION & FOLLOW-UPS =============

function handleConsultationOverlayClick(e) {
    if (e.target.id === 'consultationModal') {
        closeConsultationModal();
    }
}

function openConsultationModal(appointmentId) {
    const appointment = appointments.find(a => a.id == appointmentId);
    if (!appointment) return;

    document.getElementById('consultationAppointmentId').value = appointment.id;
    document.getElementById('consultationPatientId').value = appointment.patient_id || '';
    document.getElementById('consultationDoctorId').value = appointment.doctor_id || '';
    document.getElementById('consultationPatientName').textContent = appointment.patient_name || 'Unknown';
    document.getElementById('consultationDoctorName').textContent = appointment.doctor_name || 'Unknown';

    // Reset form
    document.querySelector('input[name="needsFollowup"][value="no"]').checked = true;
    toggleFollowupFields(false);
    document.getElementById('followupInterval').value = 'weekly';
    document.getElementById('followupSessions').value = 1;
    document.getElementById('followupStartDate').value = formatDateLocal(new Date());
    document.getElementById('consultationNotes').value = '';
    document.getElementById('followupPlanName').value = '';

    // Fetch previous plan names for the datalist
    fetch(`${API_BASE}followups.php?action=get_plan_names`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const list = document.getElementById('planNamesList');
                if (list) {
                    list.innerHTML = data.data.map(name => `<option value="${name}">`).join('');
                }
            }
        }).catch(err => console.error('Error fetching plan names:', err));

    // Focus behavior to show all options regardless of current value
    const planNameInput = document.getElementById('followupPlanName');
    if (planNameInput && !planNameInput.dataset.listenerAdded) {
        planNameInput.addEventListener('mousedown', function() {
            // Save current value
            this.dataset.lastVal = this.value;
        });

        planNameInput.addEventListener('focus', function() {
            // Clear value to bypass datalist filtering
            this.value = '';
            // Small timeout to ensure browser is ready to show the picker
            setTimeout(() => {
                if (typeof this.showPicker === 'function') {
                    try { this.showPicker(); } catch(e) {}
                }
            }, 10);
        });

        planNameInput.addEventListener('blur', function() {
            // Restore value if nothing was selected/entered
            setTimeout(() => {
                if (this.value === '' && this.dataset.lastVal) {
                    this.value = this.dataset.lastVal;
                }
            }, 200); // Delay to allow datalist selection to register first
        });
        
        planNameInput.dataset.listenerAdded = 'true';
    }

    // Reset Presets UI
    document.getElementById('saveFollowupAsPreset').checked = false;
    document.getElementById('followupPresetName').value = '';
    document.getElementById('newPresetNameGroup').style.display = 'none';

    // Load presets for this doctor
    loadFollowupPresets(appointment.doctor_id);

    document.getElementById('followupPreviewBody').innerHTML = '<tr><td colspan="2" class="text-center" style="padding: 1rem; color: #6b7280;">Adjust settings above to preview sessions</td></tr>';

    document.getElementById('consultationModal').style.display = 'flex';
    lucide.createIcons();
}

function closeConsultationModal() {
    document.getElementById('consultationModal').style.display = 'none';
}

function togglePresetNameField() {
    const checked = document.getElementById('saveFollowupAsPreset').checked;
    document.getElementById('newPresetNameGroup').style.display = checked ? 'block' : 'none';
}

async function loadFollowupPresets(doctorId) {
    const presetGroup = document.getElementById('followupPresetGroup');
    const gallery = document.getElementById('presetGallery');
    const hiddenInput = document.getElementById('followupPresetSelect');

    try {
        const res = await fetch(`${API_BASE}followup_presets.php?doctor_id=${doctorId}`);
        const data = await res.json();

        if (data.success && data.data.length > 0) {
            let html = '';
            data.data.forEach(p => {
                const iconClass = `preset-icon-${p.interval_type.toLowerCase()}`;
                let iconName = 'calendar';
                if (p.interval_type === 'daily') iconName = 'clock';
                else if (p.interval_type === 'weekly') iconName = 'calendar-days';
                else if (p.interval_type === 'monthly') iconName = 'calendar-range';

                html += `
                    <div class="preset-option" onclick="selectGalleryPreset(this)" 
                         data-id="${p.id}" 
                         data-interval="${p.interval_type}" 
                         data-sessions="${p.total_sessions}">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <div class="preset-icon-wrapper ${iconClass}" style="width: 28px; height: 28px; border-radius: 8px;">
                                <i data-lucide="${iconName}" style="width: 16px; height: 16px;"></i>
                            </div>
                            <div class="preset-option-name" style="margin-bottom: 0;">${p.preset_name}</div>
                        </div>
                        <div class="preset-option-details" style="padding-left: 2.25rem;">${p.interval_type} • ${p.total_sessions} sessions</div>
                    </div>
                `;
            });
            gallery.innerHTML = html;
            presetGroup.style.display = 'block';
            hiddenInput.value = ''; // Reset selection
            lucide.createIcons();
        } else {
            presetGroup.style.display = 'none';
        }
    } catch (err) {
        console.error('Error loading presets:', err);
        presetGroup.style.display = 'none';
    }
}

function selectGalleryPreset(element) {
    // Remove selected class from all options
    document.querySelectorAll('.preset-option').forEach(opt => opt.classList.remove('selected'));
    
    // Add selected class to the clicked element
    element.classList.add('selected');
    
    // Update hidden input
    const hiddenInput = document.getElementById('followupPresetSelect');
    hiddenInput.value = element.dataset.id;
    
    // Update the form fields directly
    document.getElementById('followupInterval').value = element.dataset.interval;
    document.getElementById('followupSessions').value = element.dataset.sessions;
    
    generateFollowupPreview();
}

// --- Management Functions ---
async function openManagePresetsModal() {
    const modal = document.getElementById('managePresetsModal');
    const doctorSelect = document.getElementById('managePresetDoctorSelect');
    
    // Reset modal
    const gridContainer = document.getElementById('presetsManagementGrid');
    gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 4rem 2rem;">
            <div style="background: #f1f5f9; width: 64px; height: 64px; border-radius: 1.25rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                <i data-lucide="user-plus" style="width: 32px; height: 32px; color: #94a3b8;"></i>
            </div>
            <h4 style="margin: 0 0 0.5rem; color: #1e293b; font-size: 1.125rem;">No Doctor Selected</h4>
            <p style="margin: 0; font-size: 0.9375rem;">Choose a doctor above to manage their specialized care templates</p>
        </div>
    `;
    doctorSelect.value = '';
    document.getElementById('addPresetInlineBtn').style.display = 'none';
    hidePresetForm();

    // Populate doctor dropdown
    try {
        const res = await fetch(`${API_BASE}doctors.php`);
        const data = await res.json();
        if (data.success) {
            let html = '<option value="">Select doctor...</option>';
            data.data.forEach(d => {
                html += `<option value="${d.id}">${d.doctor_name}</option>`;
            });
            doctorSelect.innerHTML = html;
        }
    } catch (err) {
        console.error('Error loading doctors:', err);
    }

    modal.style.display = 'flex';
    lucide.createIcons();
}

function closeManagePresetsModal() {
    document.getElementById('managePresetsModal').style.display = 'none';
}

async function loadPresetsForManagement() {
    const doctorId = document.getElementById('managePresetDoctorSelect').value;
    const gridContainer = document.getElementById('presetsManagementGrid');
    const addBtn = document.getElementById('addPresetInlineBtn');
    
    if (!doctorId) {
        gridContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 4rem 2rem;">
                <div style="background: #f1f5f9; width: 64px; height: 64px; border-radius: 1.25rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                    <i data-lucide="user-plus" style="width: 32px; height: 32px; color: #94a3b8;"></i>
                </div>
                <h4 style="margin: 0 0 0.5rem; color: #1e293b; font-size: 1.125rem;">No Doctor Selected</h4>
                <p style="margin: 0; font-size: 0.9375rem;">Choose a doctor above to manage their specialized care templates</p>
            </div>
        `;
        addBtn.style.display = 'none';
        lucide.createIcons();
        return;
    }

    addBtn.style.display = 'block';
    gridContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 4rem;"><div class="spinner"></div></div>';

    try {
        const res = await fetch(`${API_BASE}followup_presets.php?doctor_id=${doctorId}`);
        const data = await res.json();
        
        if (data.success) {
            if (data.data.length === 0) {
                gridContainer.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 4rem 2rem;">
                        <div style="background: #eff6ff; width: 64px; height: 64px; border-radius: 1.25rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                            <i data-lucide="sparkles" style="width: 32px; height: 32px; color: #3b82f6;"></i>
                        </div>
                        <h4 style="margin: 0 0 0.5rem; color: #111827; font-size: 1.125rem;">Ready to Create?</h4>
                        <p style="margin: 0; font-size: 0.9375rem;">This doctor doesn't have any presets yet. Click "Create Template" to begin.</p>
                    </div>
                `;
            } else {
                let html = '';
                data.data.forEach(p => {
                    const iconClass = `preset-icon-${p.interval_type.toLowerCase()}`;
                    let iconName = 'calendar';
                    if (p.interval_type === 'daily') iconName = 'clock';
                    else if (p.interval_type === 'weekly') iconName = 'calendar-days';
                    else if (p.interval_type === 'monthly') iconName = 'calendar-range';

                    html += `
                        <div class="preset-card">
                            <div class="preset-card-header">
                                <div class="preset-icon-wrapper ${iconClass}">
                                    <i data-lucide="${iconName}"></i>
                                </div>
                                <div style="display: flex; gap: 0.25rem;">
                                    <!-- Use a simple edit button here or just keep the card actions below -->
                                </div>
                            </div>
                            <h4 class="preset-name">${p.preset_name}</h4>
                            <div class="preset-meta">
                                <span class="preset-badge">
                                    <i data-lucide="repeat" style="width: 12px; height: 12px;"></i>
                                    ${p.interval_type.charAt(0).toUpperCase() + p.interval_type.slice(1)}
                                </span>
                                <span class="preset-badge">
                                    <i data-lucide="layers" style="width: 12px; height: 12px;"></i>
                                    ${p.total_sessions} Sessions
                                </span>
                            </div>
                            <div class="preset-actions">
                                <button class="preset-btn preset-btn-edit" onclick='editPresetInline(${JSON.stringify(p)})'>
                                    <i data-lucide="edit-3"></i>
                                    Edit
                                </button>
                                <button class="preset-btn preset-btn-delete" onclick="deleteFollowupPreset(${p.id})">
                                    <i data-lucide="trash-2"></i>
                                    Delete
                                </button>
                            </div>
                        </div>
                    `;
                });
                gridContainer.innerHTML = html;
            }
            lucide.createIcons();
        }
    } catch (err) {
        console.error('Error loading presets:', err);
        gridContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 3rem;">Failed to load presets.</div>';
    }
}

// --- Inline CRUD Logic ---
function showPresetForm() {
    document.getElementById('presetInlineForm').style.display = 'block';
    document.getElementById('presetFormTitle').textContent = 'Add New Preset';
    document.getElementById('editPresetId').value = '';
    document.getElementById('inlinePresetName').value = '';
    document.getElementById('inlinePresetInterval').value = 'weekly';
    document.getElementById('inlinePresetSessions').value = '4';
    document.getElementById('addPresetInlineBtn').style.display = 'none';
}

function hidePresetForm() {
    document.getElementById('presetInlineForm').style.display = 'none';
    document.getElementById('addPresetInlineBtn').style.display = 'block';
}

function editPresetInline(p) {
    document.getElementById('presetInlineForm').style.display = 'block';
    document.getElementById('presetFormTitle').textContent = 'Edit Preset';
    document.getElementById('editPresetId').value = p.id;
    document.getElementById('inlinePresetName').value = p.preset_name;
    document.getElementById('inlinePresetInterval').value = p.interval_type;
    document.getElementById('inlinePresetSessions').value = p.total_sessions;
    document.getElementById('addPresetInlineBtn').style.display = 'none';
}

async function savePresetInline() {
    const id = document.getElementById('editPresetId').value;
    const doctorId = document.getElementById('managePresetDoctorSelect').value;
    const name = document.getElementById('inlinePresetName').value.trim();
    const interval = document.getElementById('inlinePresetInterval').value;
    const sessions = document.getElementById('inlinePresetSessions').value;

    if (!name || !sessions) {
        showToast('Please fill all required fields.', 'error');
        return;
    }

    const payload = {
        id: id ? parseInt(id) : undefined,
        doctor_id: parseInt(doctorId),
        preset_name: name,
        interval_type: interval,
        total_sessions: parseInt(sessions)
    };

    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(`${API_BASE}followup_presets.php`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast(id ? 'Preset updated!' : 'Preset added!');
            hidePresetForm();
            loadPresetsForManagement();
        } else {
            showToast(data.message || 'Operation failed', 'error');
        }
    } catch (err) {
        console.error('Error saving preset:', err);
        showToast('System error saving preset', 'error');
    }
}

// --- Rescheduling Logic ---
function openRescheduleModal(sessionId, currentDate) {
    document.getElementById('rescheduleSessionId').value = sessionId;
    document.getElementById('rescheduleDateInput').value = currentDate;
    document.getElementById('rescheduleModal').style.display = 'flex';
}

function closeRescheduleModal() {
    document.getElementById('rescheduleModal').style.display = 'none';
}

async function submitReschedule() {
    const id = document.getElementById('rescheduleSessionId').value;
    const newDate = document.getElementById('rescheduleDateInput').value;

    if (!newDate) {
        showToast('Please select a date', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}followup_sessions.php`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, expected_date: newDate })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Session rescheduled!');
            closeRescheduleModal();
            loadFollowupPlans();
        } else {
            showToast(data.message || 'Reschedule failed', 'error');
        }
    } catch (err) {
        console.error('Error rescheduling:', err);
        showToast('System error rescheduling', 'error');
    }
}

async function deleteFollowupPreset(id) {
    if (!confirm('Are you sure you want to delete this preset?')) return;

    try {
        const res = await fetch(`${API_BASE}followup_presets.php?id=${id}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('Preset deleted successfully');
            loadPresetsForManagement();
        } else {
            showToast(data.message || 'Failed to delete preset', 'error');
        }
    } catch (err) {
        console.error('Error deleting preset:', err);
        showToast('System error deleting preset', 'error');
    }
}


function toggleFollowupFields(show) {
    const section = document.getElementById('followupPlanSection');
    section.style.display = show ? 'block' : 'none';
    if (show) {
        generateFollowupPreview();
    }
}

function generateFollowupPreview() {
    const interval = document.getElementById('followupInterval').value;
    const totalSessions = parseInt(document.getElementById('followupSessions').value) || 1;
    const startDateStr = document.getElementById('followupStartDate').value;

    if (!startDateStr || totalSessions < 1 || totalSessions > 20) return;

    const startDate = new Date(startDateStr);
    let html = '';
    let currentData = new Date(startDate);

    for (let i = 1; i <= totalSessions; i++) {
        const formattedDate = formatDateLocal(currentData);
        const displayDate = currentData.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

        html += `<tr>
            <td style="padding: 0.5rem 1rem; font-weight: 500;">#${i}</td>
            <td style="padding: 0.5rem 1rem;">
                ${interval === 'custom'
                ? `<input type="date" class="na-input followup-custom-date" data-session="${i}" value="${formattedDate}">`
                : `<span class="followup-preview-date" data-date="${formattedDate}">${displayDate}</span>`
            }
            </td>
        </tr>`;

        // Increment date based on interval
        if (interval === 'daily') {
            currentData.setDate(currentData.getDate() + 1);
        } else if (interval === 'weekly') {
            currentData.setDate(currentData.getDate() + 7);
        } else if (interval === 'monthly') {
            currentData.setMonth(currentData.getMonth() + 1);
        } else if (interval === 'custom') {
            currentData.setDate(currentData.getDate() + 7); // Default to weekly increment for custom prepopulation
        }
    }

    document.getElementById('followupPreviewBody').innerHTML = html;
}

async function saveConsultation() {
    const appointmentId = document.getElementById('consultationAppointmentId').value;
    const needsFollowup = document.querySelector('input[name="needsFollowup"]:checked').value === 'yes';
    const consultationNotes = document.getElementById('consultationNotes').value.trim();

    if (!needsFollowup) {
        // Just complete the appointment
        await updateAppointmentStatus(appointmentId, 'COMPLETED', consultationNotes);
        closeConsultationModal();
        return;
    }

    // Follow-up plan needed
    const patientId = document.getElementById('consultationPatientId').value;
    const doctorId = document.getElementById('consultationDoctorId').value;
    const intervalType = document.getElementById('followupInterval').value;
    const totalSessions = document.getElementById('followupSessions').value;
    const planName = document.getElementById('followupPlanName').value.trim() || 'Follow-up Plan';

    // Preset logic
    const shouldSavePreset = document.getElementById('saveFollowupAsPreset').checked;
    const presetName = document.getElementById('followupPresetName').value.trim();

    if (shouldSavePreset && !presetName) {
        showToast('Please enter a name for the preset.', 'error');
        return;
    }

    // Collect dates
    let sessions = [];
    if (intervalType === 'custom') {
        const inputs = document.querySelectorAll('.followup-custom-date');
        inputs.forEach(input => sessions.push(input.value));
    } else {
        const spans = document.querySelectorAll('.followup-preview-date');
        spans.forEach(span => sessions.push(span.getAttribute('data-date')));
    }

    if (sessions.length === 0) {
        showToast('Error generating session dates', 'error');
        return;
    }

    const payload = {
        patient_id: patientId,
        doctor_id: doctorId,
        original_appointment_id: appointmentId,
        total_sessions: totalSessions,
        interval_type: intervalType,
        plan_name: planName,
        sessions: sessions,
        consultation_notes: consultationNotes
    };

    try {
        // 1. Save Preset if needed
        if (shouldSavePreset) {
            await fetch(API_BASE + 'followup_presets.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doctor_id: doctorId,
                    preset_name: presetName,
                    interval_type: intervalType,
                    total_sessions: totalSessions
                })
            });
        }

        // 2. Create Follow-up Plan
        const response = await fetch(API_BASE + 'followups.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            showToast('Consultation completed and Follow-up plan created!', 'success');
            closeConsultationModal();
            await loadAppointments();
            await applyDashboardFilters();
        } else {
            showToast(data.message || 'Failed to create follow-up plan', 'error');
        }
    } catch (error) {
        console.error('Follow-up error:', error);
        showToast('Connection error', 'error');
    }
}

// Follow-ups Page Logic
// Follow-ups Page Logic
let followupPlans = [];
let followupCurrentPage = 1;
let followupFilterStatus = 'ALL';

async function loadFollowupPlans() {
    try {
        const searchInput = document.getElementById('searchFollowups');
        const search = searchInput ? searchInput.value.toLowerCase() : '';

        // Build URL with status and pagination
        const params = new URLSearchParams();
        params.append('status', followupFilterStatus);
        params.append('page', followupCurrentPage);
        params.append('limit', 8);
        if (search) params.append('search', search);

        const response = await fetch(API_BASE + 'followups.php?' + params.toString());
        const data = await response.json();

        if (data.success) {
            followupPlans = data.data;
            renderFollowupCards(followupPlans);
            
            // Update counts in tiles
            if (data.counts) {
                document.getElementById('countAll').textContent = data.counts.all || 0;
                document.getElementById('countInProgress').textContent = data.counts.in_progress || 0;
                document.getElementById('countCompleted').textContent = data.counts.completed || 0;
            }

            // Render pagination
            if (data.pagination) {
                renderFollowupPagination(data.pagination);
            }
        } else {
            showToast('Failed to load follow-up plans', 'error');
        }
    } catch (error) {
        console.error('Follow-ups error:', error);
        const container = document.getElementById('followupsContainer');
        if (container) {
            container.innerHTML = '<div class="text-center" style="padding: 2rem; color: #ef4444; grid-column: 1 / -1;">Error loading follow-up plans.</div>';
        }
    }
}

function setFollowupFilter(status) {
    followupFilterStatus = status;
    followupCurrentPage = 1;

    // Update UI active state
    document.querySelectorAll('.followup-tile').forEach(tile => tile.classList.remove('active'));
    if (status === 'ALL') document.getElementById('tileAll').classList.add('active');
    if (status === 'IN_PROGRESS') document.getElementById('tileInProgress').classList.add('active');
    if (status === 'COMPLETED') document.getElementById('tileCompleted').classList.add('active');

    loadFollowupPlans();
}

function changeFollowupPage(page) {
    followupCurrentPage = page;
    loadFollowupPlans();
    
    // Scroll to top of plans
    document.getElementById('followupsPage').scrollIntoView({ behavior: 'smooth' });
}

function renderFollowupPagination(pagination) {
    const container = document.getElementById('followupsPagination');
    if (!container) return;

    const { total_pages, current_page } = pagination;
    if (total_pages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <button class="pagination-btn" ${current_page === 1 ? 'disabled' : ''} onclick="changeFollowupPage(${current_page - 1})">
            <i data-lucide="chevron-left"></i>
        </button>
    `;

    for (let i = 1; i <= total_pages; i++) {
        // Show all pages if total_pages is small, otherwise add ellipsis (skipping for simplicity now)
        html += `
            <button class="pagination-btn ${current_page === i ? 'active' : ''}" onclick="changeFollowupPage(${i})">
                ${i}
            </button>
        `;
    }

    html += `
        <button class="pagination-btn" ${current_page === total_pages ? 'disabled' : ''} onclick="changeFollowupPage(${current_page + 1})">
            <i data-lucide="chevron-right"></i>
        </button>
    `;

    container.innerHTML = html;
    lucide.createIcons();
}

function filterFollowupPlans() {
    // We now use server-side search by reloading the plans
    followupCurrentPage = 1;
    loadFollowupPlans();
}

function renderFollowupCards(plans) {
    const container = document.getElementById('followupsContainer');
    if (!container) return;

    if (!plans || plans.length === 0) {
        container.innerHTML = `<div class="text-center" style="padding: 2rem; color: #6b7280; grid-column: 1 / -1;">
            <i data-lucide="activity" style="width: 48px; height: 48px; color: #d1d5db; margin-bottom: 1rem;"></i>
            <p>No follow-up plans found</p>
        </div>`;
        lucide.createIcons();
        return;
    }

    let html = '';
    plans.forEach(plan => {
        const progress = plan.progress_percentage || 0;
        const isComplete = progress === 100;

        html += `<div class="followup-card">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <div style="font-size: 0.75rem; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.025em; margin-bottom: 0.25rem;">${plan.plan_name || 'Follow-up Plan'}</div>
                    <h3 style="font-size: 1.125rem; font-weight: 600; color: #111827; margin: 0;">${plan.patient_name}</h3>
                    <p style="color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem;">
                        <i data-lucide="user" style="width: 14px; height: 14px; vertical-align: text-bottom; margin-right: 0.25rem;"></i>
                        ${plan.doctor_name}
                    </p>
                </div>
                <span class="status-badge ${isComplete ? 'status-completed' : 'status-booked'}">
                    ${isComplete ? 'Completed' : 'In Progress'}
                </span>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; color: #374151; margin-bottom: 0.5rem;">
                    <span>Progress: ${plan.completed_sessions}/${plan.total_sessions} Sessions</span>
                    <span style="font-weight: 600;">${progress}%</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${progress}%; ${isComplete ? 'background-color: #10b981;' : 'background-color: #3b82f6;'}"></div>
                </div>
                <p style="color: #6b7280; font-size: 0.75rem; margin-top: 0.5rem;">Interval: <span style="text-transform: capitalize; font-weight:500;">${plan.interval_type}</span></p>
            </div>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 1rem; margin-top: 1rem;">
                <p style="font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.5rem;">Upcoming Sessions</p>
                <div style="max-height: 120px; overflow-y: auto; font-size: 0.875rem; color: #6b7280;">
                    <table style="width: 100%;">
                        <tbody>`;

        if (plan.sessions && plan.sessions.length > 0) {
            plan.sessions.forEach(s => {
                const dateTokens = (s.expected_date || '').split('-');
                const formatted = dateTokens.length === 3 ? `${dateTokens[1]}/${dateTokens[2]}/${dateTokens[0]}` : s.expected_date;
                const statusColor = s.status === 'COMPLETED' ? '#10b981' : (s.status === 'PENDING' ? '#6b7280' : (s.status === 'BOOKED' ? '#3b82f6' : '#f59e0b'));

                let actionHtml = s.status;
                if (s.status === 'PENDING') {
                    actionHtml = `
                        <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end;">
                            <button class="btn btn-icon" style="color: #6b7280; padding: 0;" title="Reschedule" onclick="openRescheduleModal(${s.id}, '${s.expected_date}')">
                                <i data-lucide="calendar-days" style="width: 14px; height: 14px;"></i>
                            </button>
                            <button class="btn btn-primary" style="padding: 0.125rem 0.5rem; font-size: 0.75rem;" onclick="bookFollowupSession(${plan.id}, ${s.session_number}, ${plan.patient_id}, ${plan.doctor_id}, '${plan.patient_name}', '${s.expected_date}', ${s.id}, '${plan.whatsapp_number}')">Book</button>
                        </div>
                    `;
                }

                html += `<tr>
                    <td style="padding: 0.25rem 0; width: 60px;">#${s.session_number}</td>
                    <td style="padding: 0.25rem 0;">${formatted}</td>
                    <td style="padding: 0.25rem 0; text-align: right; color: ${statusColor}; font-weight: 500; font-size: 0.75rem;">${actionHtml}</td>
                </tr>`;
            });
        } else {
            html += `<tr><td colspan="3">No session data available</td></tr>`;
        }

        html += `       </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
    lucide.createIcons();
}

function normalizePhone(phone) {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
        digits = '91' + digits;
    } else if (digits.startsWith('0') && digits.length === 11) {
        digits = '91' + digits.substring(1);
    }
    return digits;
}
