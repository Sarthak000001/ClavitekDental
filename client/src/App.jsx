import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

// Layout
import Sidebar from './components/Sidebar.jsx';
import NewAppointmentModal from './components/NewAppointmentModal.jsx';

// Pages
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import Doctors from './pages/Doctors.jsx';
import DoctorSlots from './pages/DoctorSlots.jsx';
import Appointments from './pages/Appointments.jsx';
import Followups from './pages/Followups.jsx';

// Layout wrapper that includes sidebar + header for authenticated pages
const DashboardLayout = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNewApptModal, setShowNewApptModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Derive page title from route
  const pageTitles = {
    '/dashboard': 'Dashboard',
    '/doctors': 'Doctors',
    '/appointments': 'Appointments',
    '/followups': 'Follow-ups',
  };

  const isDoctorsPage = location.pathname === '/doctors';
  const isDoctorSlotsPage = location.pathname.startsWith('/doctors/') && location.pathname.endsWith('/slots');

  let pageTitle = pageTitles[location.pathname] || 'Dashboard';
  if (isDoctorSlotsPage) pageTitle = 'Doctor Slots';

  const handleApptSuccess = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main content area offset by sidebar width on desktop */}
      <div className="lg:ml-64">
        {/* Top header */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setMobileMenuOpen(true)}
              >
                <span className="text-xl">☰</span>
              </button>
              <h2 className="text-lg font-bold text-gray-900">{pageTitle}</h2>
            </div>

            <div className="flex items-center gap-2">
              {/* Show "New Appointment" on non-doctor pages */}
              {!isDoctorsPage && !isDoctorSlotsPage && (
                <button
                  onClick={() => setShowNewApptModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2"
                >
                  <span>📅</span>
                  <span className="hidden sm:inline">New Appointment</span>
                </button>
              )}

              {/* On doctors list page: hide button */}
              {isDoctorsPage && (
                <span className="text-xs text-gray-400 hidden sm:block">Select a doctor to manage slots</span>
              )}

              {/* On doctor slots page: show "Add Slot" button */}
              {isDoctorSlotsPage && (
                <button
                  onClick={() => {
                    // Navigate to the add slot action; DoctorSlots page handles its own modal
                    // We emit a custom event or use state — simplest: pass via URL hash
                    window.dispatchEvent(new CustomEvent('open-add-slot-modal'));
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2"
                >
                  <span>🕐</span>
                  <span className="hidden sm:inline">Add Slot</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>

      {/* New Appointment Modal */}
      <NewAppointmentModal
        isOpen={showNewApptModal}
        onClose={() => setShowNewApptModal(false)}
        onSuccess={handleApptSuccess}
      />
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" />} />

        {/* Public Routes (no sidebar) */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes (with sidebar layout) */}
        <Route path="/dashboard" element={
          <DashboardLayout><Dashboard /></DashboardLayout>
        } />
        <Route path="/doctors" element={
          <DashboardLayout><Doctors /></DashboardLayout>
        } />
        <Route path="/doctors/:id/slots" element={
          <DashboardLayout><DoctorSlots /></DashboardLayout>
        } />
        <Route path="/appointments" element={
          <DashboardLayout><Appointments /></DashboardLayout>
        } />
        <Route path="/followups" element={
          <DashboardLayout><Followups /></DashboardLayout>
        } />

        {/* 404 */}
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-gray-300 mb-2">404</h2>
              <p className="text-gray-500">Page Not Found</p>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;
