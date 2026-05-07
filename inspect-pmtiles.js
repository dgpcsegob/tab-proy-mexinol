const { PMTiles } = require("pmtiles");
const fs = require("fs");
const path = require("path");

const inspectPMTiles = async () => {
  const dataDir = "public/data";
  const files = [
    { name: "diputados", file: "diputados_lxvi_fracking_—_Diputados_LXVI_legislatura_con_fracking_potencial.pmtiles" },
    { name: "pozos", file: "pozos_fracking_actuales_—_Pozos_actuales_con_fracking.pmtiles" },
    { name: "provincias", file: "provincias_prospectivas_no_convencionales_—_Provincias_con_recursos_prospectivos_no_convencionales.pmtiles" },
    { name: "campos", file: "Campos_(Reservas_01-01-2024).pmtiles" },
    { name: "riesgo", file: "riesgo_hidrico_acuiferos_—_Riesgo_hídrico_por_acuífero.pmtiles" },
  ];

  for (const { name, file } of files) {
    const filepath = path.join(dataDir, file);
    if (!fs.existsSync(filepath)) {
      console.log(`❌ ${name}: File not found - ${filepath}`);
      continue;
    }

    try {
      // Convert to file:// URL
      const fileUrl = "file://" + path.resolve(filepath).replace(/\\/g, "/");
      const pmtiles = new PMTiles(fileUrl);
      // Get header to find layers
      console.log(`\n📊 ${name} (${file}):`);

      const header = await pmtiles.getHeader();
      console.log(`  Source: ${header.name}`);

      // Try to get metadata
      const metadata = await pmtiles.getMetadata();
      if (metadata && metadata.json) {
        const layers = metadata.json.tilestats?.layers || [];
        layers.forEach(layer => {
          console.log(`  Layer: ${layer.name}`);
          if (layer.attributes) {
            layer.attributes.slice(0, 5).forEach(attr => {
              console.log(`    - ${attr.attribute}: ${attr.type}`);
            });
          }
        });
      }
    } catch (e) {
      console.log(`⚠️  ${name}: Error reading - ${e.message}`);
    }
  }
};

inspectPMTiles().catch(console.error);
