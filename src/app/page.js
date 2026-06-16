"use client";
import { useState } from "react";

export default function Home() {
  const [mode, setMode] = useState("single");

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Skip nav for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-blue-800 text-white px-4 py-2 rounded font-semibold"
      >
        Skip to main content
      </a>

      {/* Government-style header bar */}
      <header className="bg-[#1a2e5a] text-white">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <p className="text-xs tracking-wider uppercase opacity-80 mb-1">
            Alcohol and Tobacco Tax and Trade Bureau
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Label Verification Tool
          </h1>
        </div>
      </header>

      {/* Mode tabs */}
      <nav className="bg-slate-100 border-b border-slate-300">
        <div className="max-w-5xl mx-auto px-6 flex gap-0">
          <button
            onClick={() => setMode("single")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              mode === "single"
                ? "border-blue-700 text-blue-800 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            Single Label
          </button>
          <button
            onClick={() => setMode("batch")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              mode === "batch"
                ? "border-blue-700 text-blue-800 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            Batch Upload
          </button>
        </div>
      </nav>

      <main id="main-content" className="max-w-5xl mx-auto px-6 py-8">
        {mode === "single" ? <SingleMode /> : <BatchMode />}
      </main>

      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-5xl mx-auto px-6 py-4 text-xs text-slate-500">
          Prototype for evaluation purposes. Label analysis powered by AI
          vision — results should be reviewed by a compliance agent.
        </div>
      </footer>
    </div>
  );
}

/* ─── Badge Component ──────────────────────────────────────────── */
function Badge({ status }) {
  if (status === "pass") {
    return (
      <span className="inline-flex items-center gap-1 bg-green-100 text-green-900 font-bold px-2.5 py-1 rounded text-xs border border-green-300">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        Match
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-red-100 text-red-900 font-bold px-2.5 py-1 rounded text-xs border border-red-300">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      Mismatch
    </span>
  );
}

/* ─── Image Quality Banner ─────────────────────────────────────── */
function ImageQualityBanner({ quality, unreadable }) {
  if (unreadable) {
    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-red-900 text-sm">Image could not be read</h3>
        <p className="text-red-800 text-sm mt-1">
          The uploaded image was too blurry, dark, or obstructed for analysis.
          {quality?.issues?.length > 0 && (
            <> Issues detected: {quality.issues.join(", ")}.</>
          )}
        </p>
        <p className="text-red-700 text-xs mt-2">
          Please upload a well-lit, straight-on photo of the full label and try again.
        </p>
      </div>
    );
  }

  if (!quality) return null;

  const conf = (quality.confidence || "unknown").toLowerCase();
  const hasIssues = quality.issues && quality.issues.length > 0;

  if (conf === "high" && !hasIssues) return null;

  const bgColor = conf === "low" ? "bg-amber-50 border-amber-300" : "bg-blue-50 border-blue-200";
  const textColor = conf === "low" ? "text-amber-900" : "text-blue-900";

  return (
    <div className={`${bgColor} border rounded-lg p-3 mb-6`}>
      <p className={`text-sm font-semibold ${textColor}`}>
        Image confidence: {conf.toUpperCase()}
      </p>
      {hasIssues && (
        <p className={`text-xs ${textColor} mt-1 opacity-80`}>
          Notes: {quality.issues.join(", ")}. Results may be less accurate.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SINGLE MODE
   ═══════════════════════════════════════════════════════════════════ */
function SingleMode() {
  const [brandName, setBrandName] = useState("");
  const [classType, setClassType] = useState("");
  const [abv, setAbv] = useState("");
  const [netContents, setNetContents] = useState("");
  const [image, setImage] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResults(null);
    setError(null);

    const formData = new FormData();
    formData.append("brandName", brandName);
    formData.append("classType", classType);
    formData.append("abv", abv);
    formData.append("netContents", netContents);
    formData.append("image", image);

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResults(data);
      }
    } catch {
      setError("Could not reach the verification server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const allPass =
    results &&
    !results.unreadable &&
    Object.values(results.verificationMatrix).every((item) => item.status === "pass");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Left: Form (2 of 5 cols) */}
      <section className="lg:col-span-2" aria-label="Application data form">
        <form
          onSubmit={handleSubmit}
          className="bg-slate-50 rounded-lg border border-slate-200 p-6 space-y-5"
        >
          <h2 className="text-lg font-bold text-slate-800">
            Application Data
          </h2>
          <p className="text-sm text-slate-600 -mt-3">
            Enter the values from the COLA application, then upload the label image.
          </p>

          <FormField
            id="brandName"
            label="Brand Name"
            value={brandName}
            onChange={setBrandName}
            placeholder="e.g., Stone's Throw"
          />
          <FormField
            id="classType"
            label="Class / Type"
            value={classType}
            onChange={setClassType}
            placeholder="e.g., Kentucky Straight Bourbon Whiskey"
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="abv"
              label="ABV %"
              value={abv}
              onChange={setAbv}
              placeholder="e.g., 45"
            />
            <FormField
              id="netContents"
              label="Net Contents"
              value={netContents}
              onChange={setNetContents}
              placeholder="e.g., 750 mL"
            />
          </div>

          <div className="pt-3 border-t border-slate-200">
            <label
              htmlFor="labelImage"
              className="block font-semibold text-sm text-slate-700 mb-2"
            >
              Label Image
            </label>
            <input
              id="labelImage"
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border file:border-slate-300 file:text-sm file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50 cursor-pointer"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Upload a clear, well-lit photo of the full label.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a2e5a] hover:bg-[#15254a] disabled:bg-slate-400 text-white font-bold py-3 px-4 rounded-lg transition focus:ring-4 focus:ring-blue-200 focus:outline-none"
          >
            {loading ? "Analyzing..." : "Verify Label"}
          </button>
        </form>
      </section>

      {/* Right: Results (3 of 5 cols) */}
      <section className="lg:col-span-3" aria-label="Verification results" aria-live="polite">
        {!results && !loading && !error && (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-12 text-center flex flex-col justify-center items-center min-h-[300px] text-slate-400">
            <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-base font-medium">No results yet</p>
            <p className="text-sm mt-1">Fill in the form and upload a label to begin verification.</p>
          </div>
        )}

        {loading && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center flex flex-col justify-center items-center min-h-[300px] space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-700"></div>
            <p className="font-semibold text-slate-700">Reading label with AI vision...</p>
            <p className="text-sm text-slate-500">This usually takes 3–8 seconds.</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-red-900">Verification Error</h3>
            <p className="text-sm text-red-800 mt-2">{error}</p>
            <p className="text-xs text-red-700 mt-3">
              Try a different image or double-check the form values above.
            </p>
          </div>
        )}

        {results && (
          <div className="space-y-5">
            {/* Image quality warnings */}
            <ImageQualityBanner quality={results.imageQuality} unreadable={results.unreadable} />

            {/* Overall verdict */}
            {!results.unreadable && (
              <div
                className={`p-4 rounded-lg border-2 flex items-center justify-between ${
                  allPass
                    ? "bg-green-50 border-green-300"
                    : "bg-red-50 border-red-300"
                }`}
              >
                <div>
                  <h3 className="text-lg font-bold">
                    {allPass ? "All Checks Passed" : "Issues Found"}
                  </h3>
                  <p className="text-xs opacity-80 mt-0.5">
                    Confidence: {(results.imageQuality?.confidence || "unknown").toUpperCase()}
                  </p>
                </div>
                <span
                  className={`text-xl font-black px-5 py-2 rounded ${
                    allPass ? "bg-green-700 text-white" : "bg-red-700 text-white"
                  }`}
                >
                  {allPass ? "PASS" : "FAIL"}
                </span>
              </div>
            )}

            {/* Field comparison table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                    <th className="p-3">Field</th>
                    <th className="p-3">Application</th>
                    <th className="p-3">Label (AI-read)</th>
                    <th className="p-3 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ["Brand Name", "brandName"],
                    ["Class / Type", "classType"],
                    ["ABV", "abv"],
                    ["Net Contents", "netContents"],
                  ].map(([label, key]) => (
                    <tr key={key}>
                      <td className="p-3 font-semibold text-slate-700">{label}</td>
                      <td className="p-3 text-slate-600">
                        {results.verificationMatrix[key].expected}
                        {key === "abv" ? "%" : ""}
                      </td>
                      <td className="p-3 text-slate-900">{results.verificationMatrix[key].observed}</td>
                      <td className="p-3 text-right">
                        <Badge status={results.verificationMatrix[key].status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Government warning */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-slate-700">
                  Government Warning (27 CFR Part 16)
                </h4>
                <Badge status={results.verificationMatrix.governmentWarning.status} />
              </div>

              {results.verificationMatrix.governmentWarning.status === "fail" ? (
                <div className="p-3 bg-red-50 text-red-900 text-sm rounded border border-red-200">
                  {results.verificationMatrix.governmentWarning.notes}
                </div>
              ) : (
                <p className="text-sm text-green-800 bg-green-50 p-3 rounded border border-green-100">
                  Warning text, capitalization, and formatting all meet regulatory requirements.
                </p>
              )}

              {results.verificationMatrix.governmentWarning.observedText && (
                <details className="text-sm text-slate-600">
                  <summary className="cursor-pointer font-semibold text-slate-700 text-xs">
                    View extracted warning text
                  </summary>
                  <p className="mt-2 p-3 bg-slate-50 rounded border border-slate-200 text-xs whitespace-pre-wrap leading-relaxed">
                    {results.verificationMatrix.governmentWarning.observedText}
                  </p>
                </details>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BATCH MODE
   ═══════════════════════════════════════════════════════════════════ */
function BatchMode() {
  const [csvFile, setCsvFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResults(null);
    setError(null);

    const formData = new FormData();
    formData.append("csv", csvFile);
    for (const img of imageFiles) {
      formData.append("images", img);
    }

    try {
      const response = await fetch("/api/verify/batch", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResults(data);
      }
    } catch {
      setError("Could not reach the verification server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Upload form */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-50 rounded-lg border border-slate-200 p-6 max-w-2xl"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-1">
          Batch Verification
        </h2>
        <p className="text-sm text-slate-600 mb-5">
          Upload a CSV with application data and the corresponding label images.
          The CSV filename column must match the uploaded image filenames.
        </p>

        <div className="space-y-5">
          <div>
            <label htmlFor="csvFile" className="block font-semibold text-sm text-slate-700 mb-2">
              Application Data (CSV)
            </label>
            <input
              id="csvFile"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvFile(e.target.files[0])}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border file:border-slate-300 file:text-sm file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50 cursor-pointer"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Required columns: <code className="bg-slate-200 px-1 rounded">filename</code>, <code className="bg-slate-200 px-1 rounded">brand_name</code>, <code className="bg-slate-200 px-1 rounded">class_type</code>, <code className="bg-slate-200 px-1 rounded">abv</code>, <code className="bg-slate-200 px-1 rounded">net_contents</code>
            </p>
          </div>

          <div>
            <label htmlFor="batchImages" className="block font-semibold text-sm text-slate-700 mb-2">
              Label Images
            </label>
            <input
              id="batchImages"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImageFiles(Array.from(e.target.files))}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border file:border-slate-300 file:text-sm file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50 cursor-pointer"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Select all label images. Filenames must match the CSV.
              {imageFiles.length > 0 && (
                <span className="font-semibold text-slate-700">
                  {" "}{imageFiles.length} file{imageFiles.length !== 1 ? "s" : ""} selected.
                </span>
              )}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-[#1a2e5a] hover:bg-[#15254a] disabled:bg-slate-400 text-white font-bold py-3 px-6 rounded-lg transition focus:ring-4 focus:ring-blue-200 focus:outline-none"
          >
            {loading
              ? `Processing ${csvFile ? "" : ""}labels...`
              : "Verify All Labels"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-700 mx-auto"></div>
          <p className="font-semibold text-slate-700">Processing batch...</p>
          <p className="text-sm text-slate-500">
            Each label takes ~3–8 seconds. Larger batches may take a few minutes.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl">
          <h3 className="font-bold text-red-900">Batch Error</h3>
          <p className="text-sm text-red-800 mt-1">{error}</p>
        </div>
      )}

      {results && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard label="Total" value={results.summary.total} color="slate" />
            <SummaryCard label="Passed" value={results.summary.passed} color="green" />
            <SummaryCard label="Failed" value={results.summary.failed} color="red" />
            <SummaryCard label="Errors" value={results.summary.errors} color="amber" />
          </div>

          {results.unmatchedFiles?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <span className="font-bold">Unmatched CSV rows:</span>{" "}
              {results.unmatchedFiles.join(", ")} — no image file found for these filenames.
            </div>
          )}

          {/* Results table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
                  <th className="p-3">File</th>
                  <th className="p-3">Brand</th>
                  <th className="p-3">Class/Type</th>
                  <th className="p-3">ABV</th>
                  <th className="p-3">Net Contents</th>
                  <th className="p-3">Warning</th>
                  <th className="p-3 text-right">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.results.map((r, i) => (
                  <BatchRow
                    key={i}
                    result={r}
                    expanded={expandedRow === i}
                    onToggle={() => setExpandedRow(expandedRow === i ? null : i)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Batch Summary Card ───────────────────────────────────────── */
function SummaryCard({ label, value, color }) {
  const colors = {
    slate: "bg-slate-50 border-slate-200 text-slate-900",
    green: "bg-green-50 border-green-200 text-green-900",
    red: "bg-red-50 border-red-200 text-red-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
  };
  return (
    <div className={`rounded-lg border p-4 text-center ${colors[color]}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}

/* ─── Batch Row ────────────────────────────────────────────────── */
function BatchRow({ result, expanded, onToggle }) {
  if (result.status === "error") {
    return (
      <tr className="bg-amber-50">
        <td className="p-3 font-medium">{result.filename}</td>
        <td colSpan={5} className="p-3 text-amber-800 text-xs">{result.error}</td>
        <td className="p-3 text-right">
          <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded text-xs border border-amber-300">
            Error
          </span>
        </td>
      </tr>
    );
  }

  const f = result.fields;
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
        title="Click to expand details"
      >
        <td className="p-3 font-medium text-blue-800 underline decoration-dotted">{result.filename}</td>
        <td className="p-3"><MiniStatus status={f.brandName.status} /></td>
        <td className="p-3"><MiniStatus status={f.classType.status} /></td>
        <td className="p-3"><MiniStatus status={f.abv.status} /></td>
        <td className="p-3"><MiniStatus status={f.netContents.status} /></td>
        <td className="p-3"><MiniStatus status={f.governmentWarning.status} /></td>
        <td className="p-3 text-right">
          <span
            className={`font-bold px-2.5 py-1 rounded text-xs border ${
              result.status === "pass"
                ? "bg-green-100 text-green-900 border-green-300"
                : "bg-red-100 text-red-900 border-red-300"
            }`}
          >
            {result.status === "pass" ? "PASS" : "FAIL"}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <DetailPair label="Brand (app)" value={f.brandName.expected} />
              <DetailPair label="Brand (label)" value={f.brandName.observed} />
              <DetailPair label="Class/Type (app)" value={f.classType.expected} />
              <DetailPair label="Class/Type (label)" value={f.classType.observed} />
              <DetailPair label="ABV (app)" value={`${f.abv.expected}%`} />
              <DetailPair label="ABV (label)" value={f.abv.observed} />
              <DetailPair label="Net Contents (app)" value={f.netContents.expected} />
              <DetailPair label="Net Contents (label)" value={f.netContents.observed} />
            </div>
            {f.governmentWarning.status === "fail" && (
              <p className="mt-3 text-xs text-red-800 bg-red-50 p-2 rounded border border-red-200">
                {f.governmentWarning.notes}
              </p>
            )}
            {f.governmentWarning.observedText && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer font-semibold text-slate-700">
                  View extracted warning text
                </summary>
                <p className="mt-1 p-2 bg-white rounded border border-slate-200 whitespace-pre-wrap">
                  {f.governmentWarning.observedText}
                </p>
              </details>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Tiny helpers ─────────────────────────────────────────────── */
function MiniStatus({ status }) {
  return status === "pass" ? (
    <span className="text-green-700 font-bold" title="Match">&#10003;</span>
  ) : (
    <span className="text-red-700 font-bold" title="Mismatch">&#10007;</span>
  );
}

function DetailPair({ label, value }) {
  return (
    <div>
      <span className="font-semibold text-slate-500">{label}:</span>{" "}
      <span className="text-slate-900">{value}</span>
    </div>
  );
}

function FormField({ id, label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col space-y-1.5">
      <label htmlFor={id} className="font-semibold text-sm text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white text-base"
        required
      />
    </div>
  );
}
