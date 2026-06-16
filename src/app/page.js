'use client';
import { useState } from 'react';

export default function Home() {
  const [brandName, setBrandName] = useState('');
  const [classType, setClassType] = useState('');
  const [abv, setAbv] = useState('');
  const [netContents, setNetContents] = useState('');
  const [image, setImage] = useState(null);
  
  // New state to hold our compliance report details
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResults(null);

    const formData = new FormData();
    formData.append('brandName', brandName);
    formData.append('classType', classType);
    formData.append('abv', abv);
    formData.append('netContents', netContents);
    formData.append('image', image);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Error verifying label:", error);
      alert("Verification system pipeline encountered a structural failure.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to render high-contrast accessibility badges for pass/fail metrics
  const renderBadge = (status) => {
    if (status === 'pass') {
      return <span className="bg-emerald-100 text-emerald-900 font-bold px-2.5 py-1 rounded-md text-xs border border-emerald-300">✓ MATCH</span>;
    }
    return <span className="bg-rose-100 text-rose-900 font-bold px-2.5 py-1 rounded-md text-xs border border-rose-300">✗ MISMATCH</span>;
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Block */}
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">TTB Label Verification Pilot</h1>
          <p className="text-slate-600 mt-1">Federal Compliance Automation Dashboard — Infrastructure Prototype</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Column 1: The Input Form */}
          <section aria-label="Submission Form">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
              <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-2">1. Application Registry Records</h2>
              
              <div className="space-y-4">
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="brandName" className="font-semibold text-sm text-slate-700">Brand Name</label>
                  <input
                    id="brandName"
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g., STONE'S THROW"
                    className="border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="classType" className="font-semibold text-sm text-slate-700">Class / Type Designation</label>
                  <input
                    id="classType"
                    type="text"
                    value={classType}
                    onChange={(e) => setClassType(e.target.value)}
                    placeholder="e.g., Kentucky Straight Bourbon Whiskey"
                    className="border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-1.5">
                    <label htmlFor="abv" className="font-semibold text-sm text-slate-700">Alcohol Content (ABV %)</label>
                    <input
                      id="abv"
                      type="text"
                      value={abv}
                      onChange={(e) => setAbv(e.target.value)}
                      placeholder="e.g., 45"
                      className="border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50"
                      required
                    />
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label htmlFor="netContents" className="font-semibold text-sm text-slate-700">Net Contents</label>
                    <input
                      id="netContents"
                      type="text"
                      value={netContents}
                      onChange={(e) => setNetContents(e.target.value)}
                      placeholder="e.g., 750 mL"
                      className="border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">2. Physical Label Medium</h2>
                <label htmlFor="labelImage" className="font-semibold text-sm text-slate-700 block">Upload High-Resolution Label Image</label>
                <input
                  id="labelImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files[0])}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-slate-400 text-white font-bold py-3 px-4 rounded-lg shadow transition focus:ring-4 focus:ring-blue-200 focus:outline-none text-center"
              >
                {loading ? 'Executing Machine Analysis...' : 'Verify COLA Compliance'}
              </button>
            </form>
          </section>

          {/* Column 2: Live Results Monitoring Station */}
          <section aria-label="Compliance Results Station" className="space-y-6">
            {!results && !loading && (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center h-full flex flex-col justify-center items-center bg-slate-100 text-slate-500">
                <p className="text-base font-medium">Awaiting input execution matrix.</p>
                <p className="text-xs mt-1">Submit application records and label file to populate audit ledger.</p>
              </div>
            )}

            {loading && (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center h-full flex flex-col justify-center items-center space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
                <p className="font-semibold text-slate-700">Parsing Image Optical Assets via Vision LLM...</p>
              </div>
            )}

            {results && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* Master Status Block */}
                <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
                  Object.values(results.verificationMatrix).every(item => item.status === 'pass')
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div>
                    <h3 className="text-lg font-bold">
                      {Object.values(results.verificationMatrix).every(item => item.status === 'pass')
                        ? 'COMPLIANCE AUDIT PASSED'
                        : 'COMPLIANCE AUDIT FAILURE'}
                    </h3>
                    <p className="text-xs opacity-90">Image Processing Confidence: {results.imageQuality.confidence.toUpperCase()}</p>
                  </div>
                  <span className={`text-2xl font-black px-4 py-1.5 rounded-lg ${
                    Object.values(results.verificationMatrix).every(item => item.status === 'pass')
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}>
                    {Object.values(results.verificationMatrix).every(item => item.status === 'pass') ? 'PASS' : 'FAIL'}
                  </span>
                </div>

                {/* Field-by-Field Discrepancy Ledger Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-slate-700">Field Discrepancy Ledger</h3>
                  </div>
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-200 text-slate-700">
                        <th className="p-4 tracking-wide w-1/4">Target Field</th>
                        <th className="p-4 tracking-wide w-1/4">Expected (User)</th>
                        <th className="p-4 tracking-wide w-1/4">Observed (Label)</th>
                        <th className="p-4 text-right tracking-wide w-1/4 min-w-[120px]">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-3 font-semibold text-slate-700">Brand Name</td>
                        <td className="p-3 text-slate-600">{results.verificationMatrix.brandName.expected}</td>
                        <td className="p-3 text-slate-900 font-medium">{results.verificationMatrix.brandName.observed}</td>
                        <td className="p-3 text-right">{renderBadge(results.verificationMatrix.brandName.status)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-700">Class/Type</td>
                        <td className="p-3 text-slate-600">{results.verificationMatrix.classType.expected}</td>
                        <td className="p-3 text-slate-900 font-medium">{results.verificationMatrix.classType.observed}</td>
                        <td className="p-3 text-right">{renderBadge(results.verificationMatrix.classType.status)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-700">Alcohol % (ABV)</td>
                        <td className="p-3 text-slate-600">{results.verificationMatrix.abv.expected}%</td>
                        <td className="p-3 text-slate-900 font-medium">{results.verificationMatrix.abv.observed}</td>
                        <td className="p-3 text-right">{renderBadge(results.verificationMatrix.abv.status)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-700">Net Contents</td>
                        <td className="p-3 text-slate-600">{results.verificationMatrix.netContents.expected}</td>
                        <td className="p-3 text-slate-900 font-medium">{results.verificationMatrix.netContents.observed}</td>
                        <td className="p-3 text-right">{renderBadge(results.verificationMatrix.netContents.status)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Statutory Regulatory Check Block */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-sm uppercase tracking-wider text-slate-700">27 CFR Part 16 Health Warning Audit</h4>
                    {renderBadge(results.verificationMatrix.governmentWarning.status)}
                  </div>
                  {results.verificationMatrix.governmentWarning.status === 'fail' ? (
                    <div className="p-3 bg-rose-50 text-rose-900 text-xs rounded-lg font-medium border border-rose-200">
                      🚨 {results.verificationMatrix.governmentWarning.notes}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-800 bg-emerald-50 p-3 rounded-lg border border-emerald-100 font-medium">
                      ✓ Statutory warning banner header matches regulatory casing constraints perfectly.
                    </p>
                  )}
                </div>

              </div>
            )}
          </section>

        </div>
      </div>
    </main>
  );
}