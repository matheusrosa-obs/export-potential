/**
 * Generates lib/country-coords.json — ISO-3 alpha → [lon, lat] centroids.
 * Uses the LARGEST polygon in a MultiPolygon to avoid overseas territories
 * pulling the centroid off the mainland (e.g. France, USA, Netherlands).
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";
import * as turf from "@turf/turf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Numeric ISO 3166-1 → ISO-3 alpha mapping
const numericToAlpha3 = {
  4:"AFG",8:"ALB",12:"DZA",24:"AGO",32:"ARG",36:"AUS",40:"AUT",50:"BGD",
  56:"BEL",64:"BTN",68:"BOL",76:"BRA",100:"BGR",104:"MMR",116:"KHM",120:"CMR",
  124:"CAN",152:"CHL",156:"CHN",170:"COL",180:"COD",188:"CRI",191:"HRV",192:"CUB",
  196:"CYP",203:"CZE",208:"DNK",214:"DOM",218:"ECU",818:"EGY",222:"SLV",
  231:"ETH",246:"FIN",250:"FRA",266:"GAB",288:"GHA",300:"GRC",320:"GTM",
  324:"GIN",340:"HND",348:"HUN",356:"IND",360:"IDN",364:"IRN",368:"IRQ",
  372:"IRL",376:"ISR",380:"ITA",388:"JAM",392:"JPN",400:"JOR",398:"KAZ",
  404:"KEN",408:"PRK",410:"KOR",414:"KWT",418:"LAO",422:"LBN",434:"LBY",
  440:"LTU",442:"LUX",458:"MYS",484:"MEX",504:"MAR",508:"MOZ",516:"NAM",
  524:"NPL",528:"NLD",540:"NCL",554:"NZL",558:"NIC",566:"NGA",578:"NOR",
  586:"PAK",591:"PAN",598:"PNG",600:"PRY",604:"PER",608:"PHL",616:"POL",
  620:"PRT",630:"PRI",634:"QAT",642:"ROU",643:"RUS",682:"SAU",686:"SEN",
  694:"SLE",703:"SVK",705:"SVN",706:"SOM",710:"ZAF",724:"ESP",144:"LKA",
  729:"SDN",752:"SWE",756:"CHE",760:"SYR",764:"THA",800:"UGA",804:"UKR",
  784:"ARE",826:"GBR",840:"USA",858:"URY",860:"UZB",862:"VEN",704:"VNM",
  887:"YEM",894:"ZMB",716:"ZWE",51:"ARM",31:"AZE",112:"BLR",
  204:"BEN",44:"BHS",84:"BLZ",96:"BRN",854:"BFA",108:"BDI",
  132:"CPV",140:"CAF",148:"TCD",174:"COM",178:"COG",384:"CIV",
  262:"DJI",232:"ERI",233:"EST",266:"GAB",270:"GMB",268:"GEO",
  276:"DEU",324:"GIN",624:"GNB",328:"GUY",332:"HTI",352:"ISL",
  450:"MDG",454:"MWI",466:"MLI",478:"MRT",480:"MUS",496:"MNG",
  499:"MNE",562:"NER",275:"PSE",646:"RWA",678:"STP",740:"SUR",
  748:"SWZ",762:"TJK",768:"TGO",788:"TUN",792:"TUR",795:"TKM",887:"YEM",
};

const atlasPath = path.join(__dirname, "../node_modules/world-atlas/countries-110m.json");
const raw = await fs.readFile(atlasPath, "utf-8");
const topo = JSON.parse(raw);
const geojson = feature(topo, topo.objects.countries);

/** Returns centroid of the largest polygon (by area) in a feature. */
function bestCentroid(f) {
  const geom = f.geometry;
  if (geom.type === "Polygon") {
    return turf.centroid(f).geometry.coordinates;
  }
  // MultiPolygon: pick the largest sub-polygon by area
  let best = null;
  let maxArea = -1;
  for (const polyCoords of geom.coordinates) {
    const poly = turf.polygon(polyCoords);
    const a = turf.area(poly);
    if (a > maxArea) { maxArea = a; best = poly; }
  }
  return best ? turf.centroid(best).geometry.coordinates : null;
}

const result = {};
for (const f of geojson.features) {
  const numId = parseInt(f.id, 10);
  const iso3 = numericToAlpha3[numId];
  if (!iso3) continue;
  const c = bestCentroid(f);
  if (c) result[iso3] = c;
}

// Countries not in world-atlas (small islands, territories, special codes)
Object.assign(result, {
  // Well-known countries missing from atlas
  SGP:[103.82,1.35], HKG:[114.17,22.32], TWN:[120.97,23.70], MLT:[14.38,35.94],
  ISL:[-19.02,64.96], ARE:[53.85,23.42], QAT:[51.18,25.35], BHR:[50.55,26.07],
  MDV:[73.22,3.20], MUS:[57.55,-20.25], OMN:[57.66,21.47],
  // Caribbean
  ABW:[-69.97,12.52], AIA:[-63.05,18.22], ATG:[-61.80,17.10],
  BES:[-68.27,12.17], BLM:[-62.85,17.90], BRB:[-59.55,13.19],
  CUW:[-68.99,12.17], CYM:[-80.89,19.31], DMA:[-61.37,15.42],
  GRD:[-61.68,12.12], KNA:[-62.82,17.35], LCA:[-60.98,13.91],
  MSR:[-62.19,16.74], SXM:[-63.04,18.04], TCA:[-71.80,21.82],
  TTO:[-61.22,10.65], VCT:[-61.20,13.26], VGB:[-64.64,18.43],
  // Pacific
  ASM:[-170.69,-14.27], COK:[-159.78,-21.24], FJI:[178.06,-17.71],
  FSM:[158.26,6.89], GUM:[144.79,13.44], KIR:[-168.73,1.87],
  MHL:[171.18,7.10], MNP:[145.67,15.10], NFK:[167.95,-29.04],
  NIU:[-169.87,-19.05], NRU:[166.93,-0.53], PLW:[134.58,7.51],
  PYF:[-149.41,-17.68], SLB:[160.16,-9.64], TKL:[-171.81,-9.17],
  TON:[-175.20,-21.18], TUV:[179.20,-7.47], VUT:[167.95,-15.38],
  WLF:[-178.12,-13.79], WSM:[-172.45,-13.76],
  // Europe
  AND:[1.52,42.51], BIH:[17.68,44.15], GIB:[-5.35,36.14],
  LVA:[24.75,56.88], MDA:[28.37,47.41], MKD:[21.74,41.61],
  SMR:[12.46,43.94], SRB:[21.01,44.02],
  // Africa
  BWA:[24.68,-22.33], GNQ:[10.27,1.65], LBR:[-9.43,6.43],
  LSO:[28.23,-29.61], SHN:[-5.72,-15.97], SSD:[31.30,6.88],
  SYC:[55.49,-4.63], TZA:[34.89,-6.37],
  // Asia / other
  S19:[120.97,23.70], // Taiwan (código não-oficial)
  KGZ:[74.77,41.20], MAC:[113.54,22.19], GRL:[-41.43,71.71],
  COM:[43.33,-11.70], CPV:[-24.01,15.12], FLK:[-59.52,-51.73],
  STP:[6.61,0.19], TLS:[125.73,-8.87],
  ATF:[69.23,-49.28], BMU:[-64.79,32.31], CCK:[96.83,-12.16],
  CXR:[105.69,-10.49], IOT:[72.42,-7.35], PCN:[-128.32,-24.36],
  SPM:[-56.34,46.89],
  // Override: force known-correct mainland centroids
  // (turf may still pick wrong polygon for some edge cases)
  FRA:[ 2.21, 46.23], // mainland France, not French Guiana
  USA:[-98.58, 39.83], // continental US
  NLD:[ 5.30, 52.13], // Netherlands mainland
  NOR:[ 8.47, 60.47], // Norway mainland
  PRT:[ -8.22, 39.40], // Portugal mainland
  NZL:[172.00,-41.00], // South Island centroid area
  RUS:[ 96.00, 60.00], // Siberia/central Russia
  CAN:[-96.00, 60.00], // central Canada
});

const outPath = path.join(__dirname, "../lib/country-coords.json");
await fs.writeFile(outPath, JSON.stringify(result, null, 2));
console.log(`Wrote ${Object.keys(result).length} country centroids to lib/country-coords.json`);
