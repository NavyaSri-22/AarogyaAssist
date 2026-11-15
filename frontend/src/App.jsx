
import ProfileSettings from "./ProfileSettings";
import { useAuth } from "./AuthContext";
import Login from "./Login";
import Register from "./Register";
import ImageAnalysis from "./ImageAnalysis";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState } from "react";
import ChatAssistant from "./ChatAssistant";
import HealthSummary from "./HealthSummary";
import { apiFetch } from "./api";

import {
  Activity,
  ArrowUpRight,
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileHeart,
  FilePlus2,
  FileText,
  HeartPulse,
  Home,
  Languages,
  LogOut,
  Menu,
  MessageCircle,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

import "./App.css";

const navigation = [
  { label: "Overview", icon: Home },
  { label: "Smart Reports", icon: FileHeart },
  { label: "Health Timeline", icon: Activity },
  { label: "AI Assistant", icon: Bot },
  { label: "Image Analysis", icon: ScanLine },
  { label: "Health Summary", icon: ClipboardList },
];

function ReportResults({
  uploadedReport,
  explanation,
  explanationLoading,
  explanationError,
  onGenerateExplanation,
  language,
  setLanguage,
}) {
  const parameters = uploadedReport?.medical_parameters || [];

  return (
    <section className="panel report-results">
      <div className="panel-title-row">
        <div>
          <div className="section-eyebrow">
            SMART REPORT ANALYSIS
          </div>
          <h3>Medical Report Results</h3>
          <p>{uploadedReport.filename}</p>
        </div>
        <FileHeart size={23} />
      </div>

      <div className="report-success">
        <ShieldCheck size={18} />
        PDF processed successfully
      </div>

      <p className="report-summary">
        Extracted {parameters.length} medical parameters from{" "}
        {uploadedReport.total_pages} page(s).
      </p>

      {parameters.length > 0 ? (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Reference range</th>
                <th>Status</th>
                <th>Lab flag</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((item, index) => (
                <tr key={`${item.test_name}-${index}`}>
                  <td>{item.test_name}</td>
                  <td>
                    {item.value} {item.unit || ""}
                  </td>
                  <td>
                    {item.reference_range
                      ? `${item.reference_range.minimum} - ${item.reference_range.maximum}`
                      : "Not available"}
                  </td>
                  <td>{item.status || "Not available"}</td>
                  <td>{item.reported_flag || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="report-message">
          No recognized medical parameters were found.
        </p>
      )}

      {uploadedReport.requires_ocr && (
        <p className="report-message">
          This PDF appears to require OCR. Scanned-document
          extraction is not available yet.
        </p>
      )}

      {/* AI EXPLANATION CONTROLS */}
      <div className="ai-explanation-section">
        <div className="ai-explanation-heading">
          <div>
            <div className="section-eyebrow">
              POWERED BY GROQ AI
            </div>
            <h3>Understand your report with AI</h3>
            <p>
              Get educational explanations of your extracted
              medical parameters.
            </p>
          </div>
          <div className="ai-explanation-icon">
            <Bot size={24} />
          </div>
        </div>

        <div className="ai-explanation-controls">
          <label htmlFor="explanation-language">
            Explanation language
          </label>

          <select
            id="explanation-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            disabled={explanationLoading}
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
            <option value="Telugu">Telugu</option>
          </select>

          <button
            className="primary-button"
            onClick={onGenerateExplanation}
            disabled={explanationLoading || parameters.length === 0}
          >
            <Sparkles size={17} />
            {explanationLoading
              ? "Generating explanation..."
              : explanation
                ? "Regenerate explanation"
                : "Generate AI Explanation"}
          </button>
        </div>

        {explanationLoading && (
          <div className="ai-loading">
            <div className="ai-loading-spinner" />
            <span>
              Aarogya Assist is preparing your explanation.
              Please wait...
            </span>
          </div>
        )}

        {explanationError && (
          <div className="report-error">
            {explanationError}
          </div>
        )}

        {explanation && !explanationLoading && (
          <div className="ai-explanation-output">
            <div className="ai-output-title">
              <Sparkles size={18} />
              AI-generated report explanation
            </div>
            <div className="ai-output-text">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {explanation}
                </ReactMarkdown>
              </div>
          </div>
        )}
      </div>

      <p className="medical-disclaimer">
        Educational information only. AI-generated explanations
        may contain errors and are not a diagnosis or substitute
        for professional medical advice. Always verify results
        with the original laboratory report and a qualified
        healthcare professional.
      </p>
    </section>
  );
}

function HealthTimeline() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [timeline, setTimeline] = useState({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTimeline = async () => {
      setLoading(true);
      setError("");

      try {
        const [historyResponse, comparisonResponse] =
          await Promise.all([
            apiFetch("/api/reports/history", {}, token),
            apiFetch("/api/reports/compare", {}, token)
          ]);

        const historyData = await historyResponse.json();
        const comparisonData = await comparisonResponse.json();

        if (!historyResponse.ok) {
          throw new Error(
            historyData.detail || "Unable to load report history."
          );
        }

        if (!comparisonResponse.ok) {
          throw new Error(
            comparisonData.detail || "Unable to load health timeline."
          );
        }

        setReports(historyData.reports || []);
        setTimeline(comparisonData.timeline || {});

        if (historyData.reports?.length > 0) {
          await loadReport(historyData.reports[0].report_id);
        }
      } catch (err) {
        setError(err.message || "Unable to connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    loadTimeline();
  }, []);

  const loadReport = async (reportId) => {
    setDetailLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/reports/${reportId}`,
        {},
        token
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load report details."
        );
      }

      setSelectedReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "Date unavailable";

    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const measurements = Object.entries(timeline);

  return (
    <section className="smart-reports-page">

      <div className="welcome-section">
        <div>
          <div className="welcome-label">
            <Activity size={15} />
            YOUR HEALTH JOURNEY
          </div>

          <h1>
            Health <span>Timeline.</span>
          </h1>

          <p>
            Explore your previous medical reports and track
            recorded laboratory measurements over time.
          </p>
        </div>

        <div className="welcome-illustration">
          <div className="illustration-circle">
            <Activity size={55} strokeWidth={1.3} />
          </div>
        </div>
      </div>

      {loading && (
        <section className="panel">
          <p className="report-message">
            Loading your health records...
          </p>
        </section>
      )}

      {error && (
        <div className="report-error">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon blue">
                  <FileText size={21} />
                </div>
                <span className="stat-caption">REPORTS</span>
              </div>
              <h2>{reports.length}</h2>
              <p>Reports stored</p>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon purple">
                  <Activity size={21} />
                </div>
                <span className="stat-caption">MEASUREMENTS</span>
              </div>
              <h2>{measurements.length}</h2>
              <p>Unique test parameters</p>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon green">
                  <ShieldCheck size={21} />
                </div>
                <span className="stat-caption">RECORDS</span>
              </div>
              <h2>
                {selectedReport?.medical_parameters?.length || 0}
              </h2>
              <p>Selected report results</p>
            </div>
          </section>
          

          <section className="panel">
            <div className="panel-title-row">
              <div>
                <div className="section-eyebrow">
                  YOUR MEDICAL HISTORY
                </div>
                <h3>Previous Reports</h3>
                <p>Select a report to view its measurements.</p>
              </div>
              <CalendarDays size={23} />
            </div>

            {reports.length === 0 ? (
              <div className="empty-state">
                <FileHeart size={28} />
                <strong>No reports available</strong>
                <p>Upload your first medical report to begin.</p>
              </div>
            ) : (
              <div className="report-history-list">
                {reports.map((report) => (
                  <button
                    key={report.report_id}
                    className="quick-action"
                    onClick={() => loadReport(report.report_id)}
                  >
                    <div className="quick-icon blue">
                      <FileHeart size={20} />
                    </div>

                    <span>
                      <strong>{report.report_type} Report</strong>
                      <small>{report.filename}</small>
                      <small>{formatDate(report.uploaded_at)}</small>
                    </span>

                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            )}
          </section>

          {detailLoading && (
            <section className="panel">
              <p className="report-message">
                Loading report details...
              </p>
            </section>
          )}

          {selectedReport && !detailLoading && (
            <section className="panel report-results">
              <div className="panel-title-row">
                <div>
                  <div className="section-eyebrow">
                    SELECTED MEDICAL REPORT
                  </div>
                  <h3>Report Details</h3>
                  <p>{selectedReport.report.filename}</p>
                  <p>
                    Uploaded:{" "}
                    {formatDate(selectedReport.report.uploaded_at)}
                  </p>
                </div>

                <FileHeart size={23} />
              </div>

              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Value</th>
                      <th>Reference Range</th>
                      <th>Status</th>
                      <th>Lab Flag</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedReport.medical_parameters.map((item) => (
                      <tr key={item.parameter_id}>
                        <td>{item.test_name}</td>
                        <td>
                          {item.value} {item.unit || ""}
                        </td>
                        <td>
                          {item.reference_min !== null &&
                          item.reference_max !== null
                            ? `${item.reference_min} - ${item.reference_max}`
                            : "Not available"}
                        </td>
                        <td>{item.status}</td>
                        <td>{item.reported_flag || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-title-row">
              <div>
                <div className="section-eyebrow">
                  LONGITUDINAL HEALTH DATA
                </div>
                <h3>Parameter Comparison</h3>
                <p>
                  Recorded measurements grouped by medical test.
                </p>
              </div>
              <Activity size={23} />
            </div>

            {measurements.length === 0 ? (
              <p className="report-message">
                No parameter history is available yet.
              </p>
            ) : (
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Recorded Value</th>
                      <th>Reference Range</th>
                      <th>Report Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {measurements.map(([testName, entries]) =>
                      entries.map((entry, index) => (
                        <tr
                          key={`${testName}-${entry.report_id}-${index}`}
                        >
                          <td>{testName}</td>
                          <td>
                            {entry.value} {entry.unit || ""}
                          </td>
                          <td>
                            {entry.reference_min !== null &&
                            entry.reference_max !== null
                              ? `${entry.reference_min} - ${entry.reference_max}`
                              : "Not available"}
                          </td>
                          <td>{formatDate(entry.uploaded_at)}</td>
                          <td>
                            {entry.status}
                            {entry.reported_flag
                              ? ` (${entry.reported_flag})`
                              : ""}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <p className="medical-disclaimer">
              Historical measurements are provided for informational
              purposes. Differences between reports should be reviewed
              with a qualified healthcare professional.
            </p>
          </section>
        </>
      )}
    </section>
  );
}


function DashboardApp() {
  const { user, logout, token } = useAuth();
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedReport, setUploadedReport] = useState(null);

  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [language, setLanguage] = useState("English");
  const [explanation, setExplanation] = useState("");
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState("");

  const fileInputRef = useRef(null);
  // Live dashboard statistics from MySQL-backed APIs
const [dashboardReports, setDashboardReports] = useState(0);
const [dashboardParameters, setDashboardParameters] = useState(0);
const [dashboardRecords, setDashboardRecords] = useState(0);
const [dashboardLoading, setDashboardLoading] = useState(true);
const [dashboardError, setDashboardError] = useState("");

const loadDashboardStats = async () => {
  setDashboardLoading(true);
  setDashboardError("");

  try {
    const [historyResponse, comparisonResponse] = await Promise.all([
      apiFetch("/api/reports/history", {}, token),
      apiFetch("/api/reports/compare", {}, token)
    ]);

    const historyData = await historyResponse.json();
    const comparisonData = await comparisonResponse.json();

    if (!historyResponse.ok) {
      throw new Error(historyData.detail || "Could not load reports.");
    }

    if (!comparisonResponse.ok) {
      throw new Error(comparisonData.detail || "Could not load measurements.");
    }

    const timeline = comparisonData.timeline || {};

    setDashboardReports((historyData.reports || []).length);
    setDashboardParameters(Object.keys(timeline).length);

    const totalRecords = Object.values(timeline).reduce(
      (total, entries) => total + entries.length,
      0
    );

    setDashboardRecords(totalRecords);

  } catch (error) {
    setDashboardError(error.message || "Unable to load dashboard statistics.");
  } finally {
    setDashboardLoading(false);
  }
};

useEffect(() => {
  loadDashboardStats();
}, []);

  const openUpload = () => {
    fileInputRef.current?.click();
  };

  // PDF upload and extraction
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploadError("");
    setUploadedReport(null);
    setExplanation("");
    setExplanationError("");
    setSelectedFile(file.name);

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size must not exceed 10 MB.");
      event.target.value = "";
      return;
    }

    setLoading(true);
    setActivePage("Smart Reports");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch(
        "/api/reports/upload",
        {
          method: "POST",
          body: formData,
        },
        token
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to process the medical report."
        );
      }

      setUploadedReport(data);
      await loadDashboardStats();
    } catch (error) {
      setUploadError(
        error.message || "Could not connect to the backend."
      );
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  // Generate AI explanation using Groq
  const handleGenerateExplanation = async () => {
    if (!uploadedReport?.medical_parameters?.length) {
      setExplanationError(
        "Please upload a report containing recognized medical parameters."
      );
      return;
    }

    setExplanationLoading(true);
    setExplanationError("");
    setExplanation("");

    try {
      const response = await apiFetch(
        "/api/reports/explain",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            language,
            medical_parameters: uploadedReport.medical_parameters,
            report_id: uploadedReport.report_id,
          }),
        },
        token
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to generate AI explanation."
        );
      }

      setExplanation(data.explanation || "");
    } catch (error) {
      setExplanationError(
        error.message || "Could not connect to the AI service."
      );
    } finally {
      setExplanationLoading(false);
    }
  };

  return (
    <div className="app-shell">

      {/* SIDEBAR */}
      <aside
        className={`sidebar ${
          sidebarOpen ? "" : "sidebar-closed"
        }`}
      >
        <div className="brand">
          <div className="brand-icon">
            <HeartPulse size={25} />
          </div>

          {sidebarOpen && (
            <div className="brand-name">
              <h2>Aarogya Assist</h2>
              <span>YOUR SAFE AI COMPANION</span>
            </div>
          )}

          <button
            className="icon-button mobile-menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>

        <div className="workspace-label">
          {sidebarOpen && "WORKSPACE"}
        </div>
       

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`nav-item ${
                  activePage === item.label ? "active" : ""
                }`}
                onClick={() => setActivePage(item.label)}
                title={item.label}
              >
                <Icon size={19} strokeWidth={1.8} />
                {sidebarOpen && <span>{item.label}</span>}

                {activePage === item.label && (
                  <span className="active-indicator" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={21} />

            {sidebarOpen && (
              <div>
                <strong>Privacy matters</strong>
                <p>Your health information deserves care.</p>
              </div>
            )}
          </div>

          <button
            className={`nav-item ${
              activePage === "Settings" ? "active" : ""
            }`}
            onClick={() => setActivePage("Settings")}
          >
            <Settings size={19} />
            {sidebarOpen && <span>Settings</span>}
          </button>
          <div className="workspace-account">
            <button
            type="button"
            className="profile"
            onClick={() => setWorkspaceOpen(!workspaceOpen)}
            aria-expanded={workspaceOpen}
            >
              <div className="avatar">
                {(user?.full_name || "U").charAt(0).toUpperCase()}
                </div>
                {sidebarOpen && (
                  <div className="workspace-user-details">
                    <h3>{user?.full_name || "My Workspace"}</h3>
                    <p>{user?.email || "Personal account"}</p>
                    </div>
                  )}
                  {sidebarOpen && (
                    <ChevronDown
                    size={16}
                    style={{
                      transform: workspaceOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease"
                    }}
                    />
                    )}
                    </button>
                    {workspaceOpen && sidebarOpen && (
                      <div className="workspace-menu">
                        <button
                        type="button"
                        onClick={() => {
                          setActivePage("Settings");
                          setWorkspaceOpen(false);
                        }}
                        >
                          <Settings size={17} />
                          Profile Settings
                          </button>
                          <button
                          type="button"
                          onClick={() => {
                            setWorkspaceOpen(false);
                            logout();
                          }}
                          >
                            <LogOut size={17} />
                            Logout
                            </button>
                            </div>
                          )}
                          </div>
                        </div>
                       </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation"
            >
              <Menu size={21} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={15} />
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="language-control">
              <Languages size={17} />

              <select aria-label="Choose language" defaultValue="English">
                <option>English</option>
                <option>Hindi</option>
                <option>Telugu</option>
              </select>
            </div>

            <button
              className="icon-button notification-button"
              aria-label="Notifications"
            >
              <Bell size={19} />
              <span className="notification-dot" />
            </button>

            <div className="top-avatar">N</div>
          </div>
        </header>

        <div className="page-container">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            hidden
            onChange={handleFileChange}
          />

          {/* OVERVIEW */}
          {activePage === "Overview" ? (
            <>
              <section className="welcome-section">
                <div>
                  <div className="welcome-label">
                    <Sparkles size={15} />
                    YOUR PERSONAL HEALTH WORKSPACE
                  </div>

                  <h1>
                    Your health, <span>clearly understood.</span>
                  </h1>

                  <p>
                    Understand your medical reports, explore health
                    insights and make more informed healthcare decisions.
                  </p>
                </div>

                <div className="welcome-illustration">
                  <div className="illustration-circle">
                    <HeartPulse size={57} strokeWidth={1.3} />
                    <span className="orbit orbit-one" />
                    <span className="orbit orbit-two" />
                  </div>

                  <div className="floating-check">
                    <ShieldCheck size={21} />
                  </div>
                </div>
              </section>

              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon blue">
                      <FileText size={21} />
                    </div>
                    <span className="stat-caption">YOUR DOCUMENTS</span>
                  </div>
                  <h2>{dashboardLoading ? "..." : dashboardReports}</h2>
                  <p>Reports uploaded</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon purple">
                      <Activity size={21} />
                    </div>
                    <span className="stat-caption">HEALTH HISTORY</span>
                  </div>
                  <h2>
                    {dashboardLoading ? "..." : dashboardParameters}
                  </h2>
                  <p>Unique test parameters</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon green">
                      <ClipboardList size={21} />
                    </div>
                    <span className="stat-caption">YOUR RECORDS</span>
                  </div>
                  <h2>{dashboardLoading ? "..." : dashboardRecords}</h2>
<p>Total recorded measurements</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon orange">
                      <MessageCircle size={21} />
                    </div>
                    <span className="stat-caption">AI ASSISTANT</span>
                  </div>
                  <h2>24/7</h2>
                  <p>Educational assistance</p>
                </div>
              </section>
              {dashboardError && (
  <p className="report-error">{dashboardError}</p>
)}
              

              <section className="dashboard-grid">
                <div className="panel upload-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-eyebrow">GET STARTED</div>
                      <h3>Understand your medical reports</h3>
                      <p>
                        Upload a report to extract and understand its
                        medical information.
                      </p>
                    </div>

                    <div className="panel-heading-icon">
                      <FileHeart size={23} />
                    </div>
                  </div>

                  <button
                    className="upload-dropzone"
                    onClick={openUpload}
                  >
                    <div className="upload-icon">
                      <Upload size={25} />
                    </div>

                    <strong>Upload your medical report</strong>
                    <span>Click to browse PDF files</span>
                    <small>Maximum file size: 10 MB</small>

                    {selectedFile && (
                      <div className="selected-file">
                        <FileText size={16} />
                        {selectedFile}
                      </div>
                    )}
                  </button>

                  <div className="upload-footer">
                    <ShieldCheck size={16} />
                    Your reports should only be processed with your consent.
                  </div>
                </div>

                <div className="panel assistant-panel">
                  <div className="assistant-heading">
                    <div className="assistant-icon">
                      <Bot size={24} />
                    </div>
                    <span className="online-status">AI ASSISTANT</span>
                  </div>

                  <h3>Have a health question?</h3>
                  <p>
                    Get educational explanations about healthcare topics
                    in simple language.
                  </p>

                  <button
                    className="primary-button"
                    onClick={() => setActivePage("AI Assistant")}
                  >
                    Explore AI Assistant
                    <ArrowUpRight size={17} />
                  </button>

                  <div className="assistant-decoration">
                    <Sparkles size={16} />
                    English · Hindi · Telugu
                  </div>
                </div>
              </section>

              <section className="bottom-grid">
                <div className="panel activity-panel">
                  <div className="panel-title-row">
                    <div>
                      <h3>Recent activity</h3>
                      <p>Your latest workspace updates</p>
                    </div>
                    <CalendarDays size={21} />
                  </div>

                  <div className="empty-state">
                    <div className="empty-icon">
                      <ClipboardList size={26} />
                    </div>

                    <strong>
                      {uploadedReport
                        ? "Report processed successfully"
                        : "No activity yet"}
                    </strong>

                    <p>
                      {uploadedReport
                        ? "Your medical report is available in Smart Reports."
                        : "Your uploaded reports and generated summaries will appear here."}
                    </p>

                    {uploadedReport && (
                      <button
                        className="primary-button"
                        onClick={() => setActivePage("Smart Reports")}
                      >
                        View report
                        <ArrowUpRight size={17} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="panel quick-panel">
                  <h3>Explore Aarogya Assist</h3>
                  <p>Choose what you would like to do next.</p>

                  <button className="quick-action" onClick={openUpload}>
                    <div className="quick-icon blue">
                      <FilePlus2 size={19} />
                    </div>
                    <span>
                      <strong>Analyze a report</strong>
                      <small>Extract medical information</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>

                  <button
                    className="quick-action"
                    onClick={() => setActivePage("Health Timeline")}
                  >
                    <div className="quick-icon purple">
                      <Activity size={19} />
                    </div>
                    <span>
                      <strong>View health timeline</strong>
                      <small>Explore your health history</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>

                  <button
                    className="quick-action"
                    onClick={() => setActivePage("AI Assistant")}
                  >
                    <div className="quick-icon green">
                      <Bot size={19} />
                    </div>
                    <span>
                      <strong>Talk to AI assistant</strong>
                      <small>Ask a healthcare question</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </section>
            </>

          ) : activePage === "Smart Reports" ? (

            /* SMART REPORTS */
            <section className="smart-reports-page">
              <div className="welcome-section">
                <div>
                  <div className="welcome-label">
                    <Sparkles size={15} />
                    MEDICAL REPORT INTELLIGENCE
                  </div>

                  <h1>
                    Smart <span>Reports.</span>
                  </h1>

                  <p>
                    Extract medical parameters and understand
                    the information in your laboratory reports.
                  </p>
                </div>

                <div className="welcome-illustration">
                  <div className="illustration-circle">
                    <FileHeart size={55} strokeWidth={1.3} />
                  </div>
                </div>
              </div>

              <section className="panel upload-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-eyebrow">REPORT UPLOAD</div>
                    <h3>Upload a medical report</h3>
                    <p>
                      Select a PDF report to extract its medical
                      information.
                    </p>
                  </div>

                  <div className="panel-heading-icon">
                    <Upload size={23} />
                  </div>
                </div>

                <button
                  className="upload-dropzone"
                  onClick={openUpload}
                  disabled={loading}
                >
                  <div className="upload-icon">
                    <Upload size={25} />
                  </div>

                  <strong>
                    {loading
                      ? "Processing your report..."
                      : "Upload another medical report"}
                  </strong>

                  <span>Click to browse PDF files</span>
                  <small>Maximum file size: 10 MB</small>
                </button>

                {selectedFile && (
                  <div className="selected-file">
                    <FileText size={16} />
                    {selectedFile}
                  </div>
                )}

                {loading && (
                  <p className="report-message">
                    Processing your medical report. Please wait...
                  </p>
                )}

                {uploadError && (
                  <p className="report-error">{uploadError}</p>
                )}
              </section>

              {uploadedReport && (
                <ReportResults
                  uploadedReport={uploadedReport}
                  explanation={explanation}
                  explanationLoading={explanationLoading}
                  explanationError={explanationError}
                  onGenerateExplanation={handleGenerateExplanation}
                  language={language}
                  setLanguage={setLanguage}
                />
              )}

              {!loading && !uploadError && !uploadedReport && (
                <section className="panel report-results">
                  <div className="empty-state">
                    <div className="empty-icon">
                      <FileHeart size={26} />
                    </div>
                    <strong>No report uploaded yet</strong>
                    <p>
                      Upload a PDF medical report to see the
                      extracted parameters here.
                    </p>
                  </div>
                </section>
              )}
            </section>

        ) : activePage === "AI Assistant" ? (
        <ChatAssistant />
        ) : activePage === "Health Summary" ? (
        <HealthSummary />
        ) : activePage === "Image Analysis" ? (
        <ImageAnalysis />
        ) : activePage === "Settings" ? (
        <ProfileSettings />
        ) : activePage === "Health Timeline" ? (
        <HealthTimeline />
        ) : (
        <div>Page not found</div>
        )}
    
          <footer className="footer">
            <span>© 2026 Aarogya Assist</span>
            <span>
              <ShieldCheck size={14} />
              Educational healthcare support only
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function App() {
  const { token, authLoading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (authLoading) {
    return <div className="auth-page" aria-live="polite">Loading your workspace...</div>;
  }

  if (!token) {
    return showRegister ? (
      <Register
        onRegistered={() => setShowRegister(false)}
        onLoginClick={() => setShowRegister(false)}
      />
    ) : (
      <Login
        onRegisterClick={() => setShowRegister(true)}
      />
    );
  }

  return <DashboardApp />;
}

export default App;
