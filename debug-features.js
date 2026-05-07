const { PMTiles } = require("pmtiles");
const fs = require("fs");

// Read one PMTiles file and extract features directly
async function inspectFeatures() {
  // Try simpler - just read the file bytes and parse
  const filePath = "public/data/Campos_(Reservas_01-01-2024).pmtiles";
  
  if (!fs.existsSync(filePath)) {
    console.log("File not found:", filePath);
    return;
  }

  // Read raw file
  const data = fs.readFileSync(filePath);
  console.log("File size:", data.length, "bytes");
  
  // Check if it's a valid PMTiles file (magic bytes should be "PMTiles" = 0x504D5469 6C657300)
  const magic = data.slice(0, 7).toString();
  console.log("Magic bytes:", magic);
  
  // Try to find layer names in metadata
  const textContent = data.toString("utf8", 0, Math.min(10000, data.length));
  const layerMatch = textContent.match(/layer[\s":]*([\w\s_]+)/gi);
  console.log("Layer references found:", layerMatch ? layerMatch.slice(0, 5) : "none");
  
  // Look for field names like "CLASIFICACION", "ubicacin", etc.
  const fieldPatterns = ["CLASIFICACION", "ubicacin", "CAMPO", "TIPO", "ubicación"];
  fieldPatterns.forEach(pattern => {
    if (textContent.includes(pattern)) {
      console.log(`✓ Found field: "${pattern}"`);
    }
  });
}

inspectFeatures().catch(console.error);
