/**
 * Generate sample label images for testing.
 * Run: node samples/generate-labels.js
 *
 * Creates three PNG files in /samples:
 *   sample-pass.png       — all fields match the CSV
 *   sample-wrong-abv.png  — ABV says 45% but CSV expects 40%
 *   sample-bad-warning.png — government warning uses title case instead of ALL CAPS
 */

const fs = require("fs");
const path = require("path");

// Minimal PNG generator — creates a text-based label image
// We use a simple SVG-to-PNG approach via data URI
function createLabelSVG({ brandName, classType, abv, netContents, warningHeading, warningBody, producer }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#f8f5f0" rx="8"/>
  <rect x="20" y="20" width="760" height="560" fill="none" stroke="#8b7355" stroke-width="2" rx="4"/>

  <!-- Brand Name -->
  <text x="400" y="90" text-anchor="middle" font-family="serif" font-size="42" font-weight="bold" fill="#1a1a1a">${brandName}</text>

  <!-- Class/Type -->
  <text x="400" y="135" text-anchor="middle" font-family="serif" font-size="22" fill="#444">${classType}</text>

  <!-- Divider -->
  <line x1="200" y1="160" x2="600" y2="160" stroke="#8b7355" stroke-width="1"/>

  <!-- ABV -->
  <text x="400" y="200" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="#1a1a1a">${abv}% ALC./VOL.</text>

  <!-- Net Contents -->
  <text x="400" y="240" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#555">${netContents}</text>

  <!-- Producer -->
  <text x="400" y="280" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#666">${producer}</text>

  <!-- Government Warning Box -->
  <rect x="60" y="320" width="680" height="220" fill="#fff" stroke="#999" stroke-width="1" rx="2"/>

  <!-- Warning Heading -->
  <text x="400" y="355" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="#000">${warningHeading}</text>

  <!-- Warning Body - split across lines -->
  <text x="80" y="385" font-family="sans-serif" font-size="12" fill="#333">
    <tspan x="80" dy="0">(1) According to the Surgeon General, women should not drink</tspan>
    <tspan x="80" dy="18">alcoholic beverages during pregnancy because of the risk of birth</tspan>
    <tspan x="80" dy="18">defects.</tspan>
    <tspan x="80" dy="24">(2) Consumption of alcoholic beverages impairs your ability to drive</tspan>
    <tspan x="80" dy="18">a car or operate machinery, and may cause health problems.</tspan>
  </text>
</svg>`;
}

const labels = [
  {
    filename: "sample-pass.png",
    description: "All fields match — should PASS",
    brandName: "Mountain Creek",
    classType: "American Single Malt Whiskey",
    abv: "45",
    netContents: "750 mL",
    warningHeading: "GOVERNMENT WARNING:",
    producer: "Produced by Mountain Creek Distillery, Louisville, KY 40202",
  },
  {
    filename: "sample-wrong-abv.png",
    description: "Label says 45% but CSV expects 40% — ABV should FAIL",
    brandName: "Mountain Creek",
    classType: "American Single Malt Whiskey",
    abv: "45",
    netContents: "750 mL",
    warningHeading: "GOVERNMENT WARNING:",
    producer: "Produced by Mountain Creek Distillery, Louisville, KY 40202",
  },
  {
    filename: "sample-bad-warning.png",
    description: "Warning heading uses title case — government warning should FAIL",
    brandName: "Mountain Creek",
    classType: "American Single Malt Whiskey",
    abv: "45",
    netContents: "750 mL",
    warningHeading: "Government Warning:",
    producer: "Produced by Mountain Creek Distillery, Louisville, KY 40202",
  },
];

const samplesDir = path.join(__dirname);

for (const label of labels) {
  const svg = createLabelSVG(label);
  // Save as SVG (can be uploaded directly — the app accepts image/*)
  const svgPath = path.join(samplesDir, label.filename.replace(".png", ".svg"));
  fs.writeFileSync(svgPath, svg);
  console.log(`Created: ${svgPath} — ${label.description}`);
}

// Update CSV to use .svg extensions
const csv = `filename,brand_name,class_type,abv,net_contents
sample-pass.svg,Mountain Creek,American Single Malt Whiskey,45,750 mL
sample-wrong-abv.svg,Mountain Creek,American Single Malt Whiskey,40,750 mL
sample-bad-warning.svg,Mountain Creek,American Single Malt Whiskey,45,750 mL
`;
fs.writeFileSync(path.join(samplesDir, "sample-batch.csv"), csv);
console.log("\nUpdated sample-batch.csv with .svg filenames");
console.log("\nDone! Upload these files to the app to test.");
