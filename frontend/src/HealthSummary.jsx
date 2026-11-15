
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { apiFetch } from "./api";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileHeart,
  FlaskConical,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import "./HealthSummary.css";

function formatDate(date) {
  if (!date) return "Date unavailable";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function HealthSummary() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [timeline, setTimeline] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = async () => {
    setLoading(true);
    setError("");

    try {
      const [historyResponse, comparisonResponse] =
        await Promise.all([
          apiFetch("/api/reports/history", {}, token),
          apiFetch("/api/reports/compare", {}, token),
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
          comparisonData.detail || "Unable to load health measurements."
        );
      }

      setReports(historyData.reports || []);
      setTimeline(comparisonData.timeline || {});
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const measurements = useMemo(() => {
    return Object.entries(timeline).flatMap(
      ([testName, entries]) =>
        (entries || []).map((entry) => ({
          ...entry,
          test_name: testName,
        }))
    );
  }, [timeline]);

  const latestMeasurements = useMemo(() => {
    const grouped = {};

    measurements.forEach((item) => {
      if (!grouped[item.test_name]) {
        grouped[item.test_name] = [];
      }

      grouped[item.test_name].push(item);
    });

    return Object.entries(grouped).map(([name, entries]) => {
      const sorted = [...entries].sort(
        (a, b) =>
          new Date(b.uploaded_at || 0) -
          new Date(a.uploaded_at || 0)
      );

      return {
        name,
        latest: sorted[0],
        previous: sorted[1] || null,
        count: sorted.length,
      };
    });
  }, [measurements]);

  const outsideRange = latestMeasurements.filter(
    (item) =>
      String(item.latest.status || "").toLowerCase() ===
      "outside range"
  );

  const latestReport = reports[0] || null;

  return (
    <section className="health-summary-page">
      <div className="health-summary-header">
        <div>
          <div className="welcome-label">
            <Activity size={15} />
            YOUR HEALTH AT A GLANCE
          </div>

          <h1>
            Health <span>Summary.</span>
          </h1>

          <p>
            A consolidated overview of the information
            extracted from your uploaded medical reports.
          </p>
        </div>

        <button
          className="summary-refresh-button"
          onClick={loadSummary}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loading && (
        <section className="panel summary-state">
          Loading your health summary...
        </section>
      )}

      {error && (
        <div className="summary-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="summary-stats">
            <div className="summary-stat-card">
              <div className="summary-stat-icon blue">
                <FileHeart size={22} />
              </div>
              <span>UPLOADED REPORTS</span>
              <h2>{reports.length}</h2>
              <p>Reports stored in your account</p>
            </div>

            <div className="summary-stat-card">
              <div className="summary-stat-icon purple">
                <FlaskConical size={22} />
              </div>
              <span>UNIQUE PARAMETERS</span>
              <h2>{latestMeasurements.length}</h2>
              <p>Different tests identified</p>
            </div>

            <div className="summary-stat-card">
              <div className="summary-stat-icon orange">
                <TrendingUp size={22} />
              </div>
              <span>RECORDED MEASUREMENTS</span>
              <h2>{measurements.length}</h2>
              <p>Total values across reports</p>
            </div>

            <div className="summary-stat-card">
              <div className="summary-stat-icon red">
                <AlertTriangle size={22} />
              </div>
              <span>OUTSIDE LAB RANGE</span>
              <h2>{outsideRange.length}</h2>
              <p>Latest values marked outside range</p>
            </div>
          </div>

          <section className="panel summary-latest-report">
            <div className="summary-section-heading">
              <div>
                <div className="section-eyebrow">
                  MOST RECENT RECORD
                </div>
                <h3>Latest medical report</h3>
              </div>
              <CalendarDays size={22} />
            </div>

            {latestReport ? (
              <div className="latest-report-details">
                <div className="latest-report-icon">
                  <FileHeart size={25} />
                </div>

                <div>
                  <strong>{latestReport.filename}</strong>
                  <p>
                    Uploaded: {formatDate(latestReport.uploaded_at)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="summary-empty">
                No medical reports have been uploaded yet.
              </p>
            )}
          </section>

          <section className="panel summary-parameters">
            <div className="summary-section-heading">
              <div>
                <div className="section-eyebrow">
                  LATEST AVAILABLE VALUES
                </div>
                <h3>Medical parameter overview</h3>
                <p>
                  The latest recorded value for each identified test.
                </p>
              </div>
              <FlaskConical size={23} />
            </div>

            {latestMeasurements.length === 0 ? (
              <p className="summary-empty">
                No medical measurements are available yet.
                Upload a report to build your summary.
              </p>
            ) : (
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Latest value</th>
                      <th>Reference range</th>
                      <th>Status</th>
                      <th>Report date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {latestMeasurements.map((item) => (
                      <tr key={item.name}>
                        <td>{item.name}</td>

                        <td>
                          {item.latest.value}{" "}
                          {item.latest.unit || ""}
                        </td>

                        <td>
                          {item.latest.reference_min != null &&
                          item.latest.reference_max != null
                            ? `${item.latest.reference_min} - ${item.latest.reference_max}`
                            : "Not available"}
                        </td>

                        <td>
                          <span
                            className={`summary-status ${
                              String(item.latest.status || "")
                                .toLowerCase() === "outside range"
                                ? "status-outside"
                                : "status-normal"
                            }`}
                          >
                            {item.latest.status || "Not available"}
                          </span>
                        </td>

                        <td>
                          {formatDate(item.latest.uploaded_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel summary-attention">
            <div className="summary-section-heading">
              <div>
                <div className="section-eyebrow">
                  LABORATORY FLAGS
                </div>
                <h3>Results marked outside range</h3>
                <p>
                  Based on the status recorded in your latest reports.
                </p>
              </div>
              <AlertTriangle size={23} />
            </div>

            {outsideRange.length === 0 ? (
              <div className="summary-no-flags">
                <CheckCircle2 size={21} />
                <span>
                  No latest measurements are currently marked
                  outside range in the available records.
                </span>
              </div>
            ) : (
              <div className="summary-flag-list">
                {outsideRange.map((item) => (
                  <div className="summary-flag-item" key={item.name}>
                    <div>
                      <strong>{item.name}</strong>
                      <p>
                        {item.latest.value} {item.latest.unit || ""}
                        {" · "}
                        Reference:{" "}
                        {item.latest.reference_min ?? "—"} –{" "}
                        {item.latest.reference_max ?? "—"}
                      </p>
                    </div>

                    <span>
                      {item.latest.reported_flag || "Outside range"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="medical-disclaimer">
            This summary organizes extracted laboratory information.
            It is not a diagnosis or a measure of overall health.
            Reference ranges vary between laboratories. Please
            discuss results with a qualified healthcare professional.
          </p>
        </>
      )}
    </section>
  );
}

export default HealthSummary;
