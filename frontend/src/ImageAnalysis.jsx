
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Image as ImageIcon,
  Upload,
  ScanLine,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import "./ImageAnalysis.css";

const API_URL = "http://localhost:8000";

function ImageAnalysis() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [disclaimer, setDisclaimer] = useState("");

  const [symptoms, setSymptoms] = useState({
    duration: "",
    sensation: "",
    spreading: "",
    exposure: "",
    additional: ""
  });

  const updateSymptom = (key, value) => {
    setSymptoms((previous) => ({
      ...previous,
      [key]: value
    }));
  };

  const handleImageChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    setError("");
    setAnalysis("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Please upload a JPG, PNG, or WEBP image.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > 8 * 1024 * 1024) {
      setError("Image size must be less than 8 MB.");
      event.target.value = "";
      return;
    }

    setImage(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const analyzeImage = async (event) => {
    event.preventDefault();

    if (!image) {
      setError("Please select an image first.");
      return;
    }

    setLoading(true);
    setError("");
    setAnalysis("");

    const formData = new FormData();

    formData.append("file", image);
    formData.append("question", question);

    const symptomInformation = Object.entries(symptoms)
      .filter(([, value]) => value.trim() !== "")
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    formData.append("symptoms", symptomInformation);

    try {
      const response = await fetch(
        `${API_URL}/api/image-analysis/analyze`,
        {
          method: "POST",
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to analyze the image."
        );
      }

      setAnalysis(
        typeof data.analysis === "string"
          ? data.analysis
          : JSON.stringify(data.analysis, null, 2)
      );

      setDisclaimer(
        data.disclaimer ||
        "This AI-generated information is educational and does not replace professional medical advice."
      );
    } catch (err) {
      setError(
        err.message ||
        "Unable to connect to the image analysis service."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setImage(null);
    setPreview("");
    setQuestion("");
    setAnalysis("");
    setError("");
    setDisclaimer("");

    setSymptoms({
      duration: "",
      sensation: "",
      spreading: "",
      exposure: "",
      additional: ""
    });
  };

  return (
    <div className="image-analysis-page">

      <div className="image-analysis-header">
        <div>
          <div className="image-analysis-eyebrow">
            <Sparkles size={15} />
            AI-POWERED VISUAL INSIGHTS
          </div>

          <h1>Medical Image Analysis</h1>

          <p>
            Upload an image to receive educational information
            about visible features and possible explanations.
          </p>
        </div>

        <div className="image-header-icon">
          <ScanLine size={32} />
        </div>
      </div>

      <div className="image-analysis-grid">

        <div className="image-upload-card">

          <div className="image-card-heading">
            <div className="image-card-icon">
              <ImageIcon size={20} />
            </div>

            <div>
              <h2>Upload your image</h2>
              <p>Choose a clear image for analysis.</p>
            </div>
          </div>

          <label className="image-upload-area">
            {preview ? (
              <img
                src={preview}
                alt="Selected medical image"
                className="image-preview"
              />
            ) : (
              <>
                <div className="image-upload-icon">
                  <Upload size={30} />
                </div>

                <h3>Click to upload an image</h3>

                <p>JPG, PNG or WEBP</p>

                <span>Maximum file size: 8 MB</span>
              </>
            )}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              hidden
              disabled={loading}
            />
          </label>

          {image && (
            <div className="selected-image-info">
              <span>{image.name}</span>
              <button
                type="button"
                onClick={resetAnalysis}
                disabled={loading}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <form onSubmit={analyzeImage}>

            <div className="image-form-section">
              <h3>Tell us about your symptoms</h3>

              <p>
                These optional answers help provide more relevant
                educational information.
              </p>

              <label>1. How long have you noticed this?</label>

              <select
                value={symptoms.duration}
                onChange={(e) =>
                  updateSymptom("duration", e.target.value)
                }
                disabled={loading}
              >
                <option value="">Select duration</option>
                <option>Less than 24 hours</option>
                <option>1–3 days</option>
                <option>4–7 days</option>
                <option>More than a week</option>
                <option>Several weeks or longer</option>
              </select>

              <label>2. What do you feel in the affected area?</label>

              <select
                value={symptoms.sensation}
                onChange={(e) =>
                  updateSymptom("sensation", e.target.value)
                }
                disabled={loading}
              >
                <option value="">Select an option</option>
                <option>Itching</option>
                <option>Burning or stinging</option>
                <option>Pain or tenderness</option>
                <option>Swelling</option>
                <option>No discomfort</option>
                <option>More than one of these</option>
                <option>Not sure</option>
              </select>

              <label>3. Is the affected area spreading?</label>

              <select
                value={symptoms.spreading}
                onChange={(e) =>
                  updateSymptom("spreading", e.target.value)
                }
                disabled={loading}
              >
                <option value="">Select an option</option>
                <option>Yes, it is spreading</option>
                <option>No, it is staying in one place</option>
                <option>It comes and goes</option>
                <option>Not sure</option>
              </select>

              <label>4. Any recent exposure to something new?</label>

              <select
                value={symptoms.exposure}
                onChange={(e) =>
                  updateSymptom("exposure", e.target.value)
                }
                disabled={loading}
              >
                <option value="">Select an option</option>
                <option>New skincare or cosmetic product</option>
                <option>New soap or detergent</option>
                <option>New medicine</option>
                <option>New food</option>
                <option>Insect bite or plant exposure</option>
                <option>No known new exposure</option>
                <option>Not sure</option>
              </select>

              <label>
                5. Anything else you'd like to tell us? (Optional)
              </label>

              <textarea
                rows={3}
                maxLength={1000}
                value={symptoms.additional}
                onChange={(e) =>
                  updateSymptom("additional", e.target.value)
                }
                placeholder="Describe any other symptoms..."
                disabled={loading}
              />
            </div>

            <div className="image-question-section">
              <label htmlFor="image-question">
                What would you like to know? (Optional)
              </label>

              <textarea
                id="image-question"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="For example: What visible changes can you identify?"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="image-error">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="image-analyze-button"
              disabled={!image || loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="image-spin" />
                  Analyzing image...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Analyze Image
                </>
              )}
            </button>

          </form>
        </div>

        <div className="image-result-card">

          <div className="image-card-heading">
            <div className="image-card-icon">
              <ScanLine size={20} />
            </div>

            <div>
              <h2>Analysis Results</h2>
              <p>AI-generated educational insights</p>
            </div>
          </div>

          {!analysis && !loading && (
            <div className="image-empty-result">
              <div className="image-empty-icon">
                <Sparkles size={30} />
              </div>

              <h3>Your results will appear here</h3>

              <p>
                Upload an image and select Analyze Image
                to view the results.
              </p>
            </div>
          )}

          {loading && (
            <div className="image-loading">
              <RefreshCw size={30} className="image-spin" />
              <h3>Analyzing your image</h3>
              <p>Please wait while the AI processes your image.</p>
            </div>
          )}

          {analysis && (
            <div className="image-analysis-result">

              <div className="image-result-success">
                <ShieldCheck size={19} />
                Analysis completed
              </div>

              <div className="image-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {analysis}
                </ReactMarkdown>
              </div>

              {disclaimer && (
                <div className="image-disclaimer">
                  <AlertCircle size={18} />
                  <p>{disclaimer}</p>
                </div>
              )}

              <button
                type="button"
                className="image-reset-button"
                onClick={resetAnalysis}
              >
                <RefreshCw size={16} />
                Analyze another image
              </button>

            </div>
          )}

        </div>

      </div>

      <div className="image-safety-note">
        <ShieldCheck size={19} />
        <p>
          <strong>Your health matters.</strong> This tool provides
          educational information only. It cannot diagnose medical
          conditions or replace an examination by a qualified
          healthcare professional. Seek urgent medical care for
          severe symptoms or rapidly worsening conditions.
        </p>
      </div>

    </div>
  );
}

export default ImageAnalysis;
