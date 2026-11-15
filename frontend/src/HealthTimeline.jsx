
import React, { useEffect, useState } from "react";
import { Activity, TrendingUp, TrendingDown, Minus, RefreshCw, FileHeart } from "lucide-react";
import { useAuth } from "./AuthContext";
import { apiFetch } from "./api";
import "./HealthTimeline.css";

function formatDate(value) {
  if (!value) return "Date unavailable";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getStatus(item) {
  const status = String(item.status || "").toLowerCase();

  if (status.includes("outside") || status.includes("high") || status.includes("low")) {
    return "outside";
  }

  if (status.includes("normal") || status.includes("within")) {
    return "normal";
  }

  return "unknown";
}

function TrendIndicator({ values }) {
  const numericValues = values
    .map((item) => item.value)
    .filter((value) => value !== null && Number.isFinite(value));

  if (numericValues.length < 2) {
    return <span className="timeline-trend neutral"><Minus size={15} /> Not enough data</span>;
  }

  const first = numericValues[0];
  const last = numericValues[numericValues.length - 1];

  if (last > first) {
    return <span className="timeline-trend up"><TrendingUp size={15} /> Increased</span>;
  }

  if (last < first) {
    return <span className="timeline-trend down"><TrendingDown size={15} /> Decreased</span>;
  }

  return <span className="timeline-trend neutral"><Minus size={15} /> Unchanged</span>;
}

export default function HealthTimeline() {
  const { token } = useAuth();

  const [timeline, setTimeline] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      setLoading(true);
      setError("");

      try {
        const response = await apiFetch("/api/reports/timeline", {}, token);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Unable to load your health timeline.");
        }

        if (!cancelled) {
          setTimeline(data.timeline || {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to connect to the server.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (token) {
      loadTimeline();
    } else {
      setError("Please sign in to view your health timeline.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  const tests = Object.entries(timeline);

  const totalRecords = tests.reduce(
    (total, [, entries]) => total + entries.length,
    0
  );

  const flaggedRecords = tests.reduce(
    (total, [, entries]) =>
      total + entries.filter((item) => getStatus(item) === "outside").length,
    0
  );

  return (
    <div className="health-timeline-page">
      <div className="timeline-header">
        <div>
          <span className="timeline-eyebrow">YOUR PERSONAL HEALTH HISTORY</span>
          <h1>Health Timeline</h1>
          <p>Track your recorded medical test results across uploaded reports.</p>
        </div>

        <div className="timeline-header-icon">
          <Activity size={28} />
        </div>
      </div>

      {loading && (
        <div className="timeline-state">
          <RefreshCw className="timeline-spin" size={27} />
          <h3>Loading your health timeline...</h3>
        </div>
      )}

      {!loading && error && (
        <div className="timeline-error">
          <p>{error}</p>
          <p>Check that you are signed in and the backend is running.</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="timeline-stat-grid">
            <div className="timeline-stat-card">
              <FileHeart size={21} />
              <span>Recorded measurements</span>
              <strong>{totalRecords}</strong>
            </div>

            <div className="timeline-stat-card">
              <Activity size={21} />
              <span>Unique test parameters</span>
              <strong>{tests.length}</strong>
            </div>

            <div className="timeline-stat-card">
              <TrendingUp size={21} />
              <span>Outside-range records</span>
              <strong>{flaggedRecords}</strong>
            </div>
          </div>

          {tests.length === 0 ? (
            <div className="timeline-empty">
              <div><Activity size={30} /></div>
              <h2>Your health timeline is empty</h2>
              <p>
                Upload your first medical report in Smart Reports.
                Its extracted test results will appear here.
              </p>
            </div>
          ) : (
            <div className="timeline-test-list">
              {tests.map(([testName, entries]) => {
                const orderedEntries = [...entries].sort(
                  (a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at)
                );

                const latest = orderedEntries[orderedEntries.length - 1];

                return (
                  <section className="timeline-test-card" key={testName}>
                    <div className="timeline-test-heading">
                      <div>
                        <h2>{testName}</h2>
                        <p>{entries.length} recorded measurement(s)</p>
                      </div>
                      <TrendIndicator values={orderedEntries} />
                    </div>

                    <div className="timeline-latest-value">
                      <span>Latest recorded value</span>
                      <strong>
                        {latest.value ?? "Not available"} {latest.unit || ""}
                      </strong>
                      <small>{formatDate(latest.uploaded_at)}</small>
                    </div>

                    <div className="timeline-records">
                      {orderedEntries.map((item, index) => {
                        const status = getStatus(item);

                        return (
                          <div className="timeline-record" key={`${item.report_id}-${index}`}>
                            <div className="timeline-record-dot" />

                            <div className="timeline-record-content">
                              <div className="timeline-record-top">
                                <strong>{formatDate(item.uploaded_at)}</strong>
                                <span className={`timeline-status ${status}`}>
                                  {status === "outside"
                                    ? "Outside range"
                                    : status === "normal"
                                    ? "Within range"
                                    : "Status unavailable"}
                                </span>
                              </div>

                              <p>
                                Value: <strong>{item.value ?? "N/A"} {item.unit || ""}</strong>
                              </p>

                              {item.reference_min !== null || item.reference_max !== null ? (
                                <small>
                                  Reference range: {item.reference_min ?? "—"} to {item.reference_max ?? "—"} {item.unit || ""}
                                </small>
                              ) : (
                                <small>Reference range not available</small>
                              )}

                              {item.reported_flag && (
                                <small>Lab flag: {item.reported_flag}</small>
                              )}

                              {item.filename && (
                                <small>Source: {item.filename}</small>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="timeline-disclaimer">
        These records display extracted report values and the laboratory's
        recorded reference information. Changes alone do not establish a
        medical diagnosis. Discuss results with a qualified healthcare professional.
      </div>
    </div>
  );
}
