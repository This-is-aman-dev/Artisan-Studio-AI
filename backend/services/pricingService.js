import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import xlsx from "xlsx";
const { readFile, utils, writeFile } = xlsx;
import PricingBenchmark from "../models/PricingBenchmark.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard regional skilled artisan hourly rates (INR/hr)
const CATEGORY_HOURLY_RATES = {
  "textile & embroidery": 95,
  "carpets, rugs & home textiles": 100,
  "hand-printed products": 90,
  "pottery & terracotta": 85,
  "wooden products": 110,
  "cane, bamboo & natural fibre": 85,
  "metal crafts": 125,
  "handmade jewellery": 130,
  "bags & fashion accessories": 90,
  "traditional paintings & artwork": 120,
  "decorative & religious products": 95,
  "toys, dolls & puppets": 85,
  "handmade paper & stationery": 80,
  "regional / tribal craft products": 100,
  "everyday handmade products": 85,
  default: 85,
};

const calculateTextSimilarity = (str1 = "", str2 = "") => {
  const words1 = (str1 || "").toLowerCase().split(/[\s,/]+/).filter(Boolean);
  const words2 = (str2 || "").toLowerCase().split(/[\s,/]+/).filter(Boolean);
  if (!words1.length || !words2.length) return 0;
  const common = words1.filter((w) => words2.includes(w));
  return (2 * common.length) / (words1.length + words2.length);
};

export const pricingService = {
  /**
   * Check if a category exists in the loaded benchmark dataset
   */
  async doesCategoryExist(categoryName) {
    if (!categoryName) return false;
    const count = await PricingBenchmark.countDocuments({
      category: new RegExp(`^${categoryName.trim()}$`, "i"),
    });
    return count > 0;
  },

  /**
   * Search dataset matching against 200 real benchmarks
   */
  async findSimilarBenchmarks({ title, category, material, craftSpecialty, location }) {
    const query = [];
    if (category) query.push({ category: new RegExp(category.trim(), "i") });
    if (craftSpecialty) query.push({ craftSpecialty: new RegExp(craftSpecialty.trim(), "i") });
    if (title) query.push({ productName: new RegExp(title.trim().split(" ")[0], "i") });

    const candidates = await PricingBenchmark.find(query.length ? { $or: query } : {}).limit(35);
    if (!candidates.length) return [];

    const scored = candidates.map((item) => {
      let score = 0;

      // 1. Title Similarity (35%)
      score += calculateTextSimilarity(title, item.productName) * 0.35;

      // 2. Category match (30%)
      if (category && item.category.toLowerCase() === category.trim().toLowerCase()) {
        score += 0.3;
      }

      // 3. Material match (20%)
      if (material && item.material && calculateTextSimilarity(material, item.material) > 0.1) {
        score += 0.2;
      }

      // 4. Regional location match (15%)
      if (location && item.location && item.location.toLowerCase().includes(location.toLowerCase())) {
        score += 0.15;
      }

      return { item, score };
    });

    return scored
      .filter((s) => s.score >= 0.25)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.item);
  },

  /**
   * VERIFICATION ENGINE:
   * Compares the artisan's input costs, hours, and materials against dataset bounds
   * Allowing a 20% margin of error.
   */
  verifyDataGenuineness({ rawCost, hours, material, benchmark }) {
    if (!benchmark) {
      return { isGenuine: true, categoryFound: false, warnings: [] };
    }

    const warnings = [];
    const TOLERANCE_MARGIN = 0.20; // 20% tolerance margin

    // 1. Check Raw Material Cost against [minRawCost, maxRawCost] with ±20% margin
    const minAllowedCost = Math.max(10, Math.round(benchmark.minRawCost * (1 - TOLERANCE_MARGIN)));
    const maxAllowedCost = Math.round(benchmark.maxRawCost * (1 + TOLERANCE_MARGIN));

    if (rawCost < minAllowedCost) {
      warnings.push(
        `Material cost (₹${rawCost}) is unusually low for "${benchmark.productName}". Typical baseline is ₹${benchmark.minRawCost}–₹${benchmark.maxRawCost}.`
      );
    } else if (rawCost > maxAllowedCost) {
      warnings.push(
        `Material cost (₹${rawCost}) exceeds standard bounds (₹${benchmark.minRawCost}–₹${benchmark.maxRawCost} + 20% margin) for "${benchmark.productName}".`
      );
    }

    // 2. Check Labor Hours against [minHours, maxHours] with ±20% margin
    const minAllowedHours = Math.max(0.5, Math.round(benchmark.minHours * (1 - TOLERANCE_MARGIN) * 10) / 10);
    const maxAllowedHours = Math.round(benchmark.maxHours * (1 + TOLERANCE_MARGIN) * 10) / 10;

    if (hours < minAllowedHours) {
      warnings.push(
        `Labor hours (${hours} hrs) is lower than benchmark minimum (${benchmark.minHours}–${benchmark.maxHours} hrs).`
      );
    } else if (hours > maxAllowedHours) {
      warnings.push(
        `Labor hours (${hours} hrs) is unusually high for "${benchmark.productName}" (expected: ${benchmark.minHours}–${benchmark.maxHours} hrs).`
      );
    }

    // 3. Check Material Match
    let materialSimilarity = 0;
    if (material && benchmark.material) {
      materialSimilarity = calculateTextSimilarity(material, benchmark.material);
      if (materialSimilarity === 0) {
        warnings.push(
          `Material "${material}" differs from standard materials for this craft: "${benchmark.material}".`
        );
      }
    }

    const isGenuine = warnings.length === 0;

    return {
      isGenuine,
      categoryFound: true,
      matchedBenchmark: benchmark.productName,
      expectedBounds: {
        costRange: `₹${minAllowedCost} – ₹${maxAllowedCost}`,
        hoursRange: `${minAllowedHours} – ${maxAllowedHours} hrs`,
        expectedMaterials: benchmark.material,
      },
      warnings,
    };
  },

  /**
   * Generates fair pricing calculation based on cost and matching benchmarks
   */
  async generateFairPricing({ title, category, material, craftSpecialty, location, rawMaterialCost, laborHours }) {
    const rawCost = Math.max(0, Number(rawMaterialCost) || 0);
    const hours = Math.max(0, Number(laborHours) || 0);

    const categoryExists = await this.doesCategoryExist(category);
    const matches = await this.findSimilarBenchmarks({ title, category, material, craftSpecialty, location });
    const bestMatch = matches.length > 0 ? matches[0] : null;

    // Run genuineness audit if matched
    const genuineness = this.verifyDataGenuineness({
      rawCost,
      hours,
      material,
      benchmark: bestMatch,
    });

    const catKey = category?.toLowerCase() || "";
    let hourlyRate = CATEGORY_HOURLY_RATES[catKey] || CATEGORY_HOURLY_RATES.default;
    let benchmarkFairPrice = null;

    if (matches.length > 0) {
      const prices = matches.map((m) => m.fairPrice).sort((a, b) => a - b);
      const mid = Math.floor(prices.length / 2);
      benchmarkFairPrice = prices.length % 2 !== 0 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);

      const totalRates = matches.reduce((sum, m) => sum + (m.hourlyRate || 85), 0);
      hourlyRate = Math.round(totalRates / matches.length);
    }

    const laborCost = Math.round(hours * hourlyRate);
    const packagingAndOverhead = Math.round((rawCost + laborCost) * 0.05);
    const totalProductionCost = rawCost + laborCost + packagingAndOverhead;

    const floorPrice = Math.round(totalProductionCost * 1.1);

    let fairPrice;
    if (benchmarkFairPrice && benchmarkFairPrice >= floorPrice) {
      const costBasedFair = totalProductionCost * 1.35;
      fairPrice = Math.round(costBasedFair * 0.5 + benchmarkFairPrice * 0.5);
    } else {
      fairPrice = Math.round(totalProductionCost * 1.35);
    }

    const premiumPrice = Math.round(fairPrice * 1.25);

    return {
      rawCost,
      hours,
      hourlyRate,
      laborCost,
      packagingAndOverhead,
      totalProductionCost,
      categoryExists,
      datasetMatched: matches.length > 0,
      matchedBenchmarkName: bestMatch?.productName || null,
      genuineness,
      pricing: {
        floorPrice,
        recommendedPrice: fairPrice,
        exhibitionPrice: premiumPrice,
      },
    };
  },

  validateSellerPrice(sellerPrice, pricingRange) {
    const price = Number(sellerPrice);
    const { floorPrice, recommendedPrice, exhibitionPrice } = pricingRange;

    if (!price || isNaN(price)) {
      return { status: "INVALID", message: "Please enter a valid price." };
    }

    if (price < floorPrice) {
      const diffPercent = Math.round(((floorPrice - price) / floorPrice) * 100);
      return {
        status: "UNDERPRICED",
        diffPercent,
        message: `Your price of ₹${price} is ${diffPercent}% below the sustainable floor (₹${floorPrice}). You risk losing money on materials and basic labor.`,
        suggested: recommendedPrice,
        floorPrice,
      };
    }

    if (price > exhibitionPrice) {
      const diffPercent = Math.round(((price - exhibitionPrice) / exhibitionPrice) * 100);
      return {
        status: "OVERPRICED",
        diffPercent,
        message: `Your price of ₹${price} is ${diffPercent}% above standard exhibition rates (₹${exhibitionPrice}). It may take longer to sell.`,
        suggested: recommendedPrice,
        exhibitionPrice,
      };
    }

    return {
      status: "WITHIN_RANGE",
      diffPercent: 0,
      message: `₹${price} is within the verified fair trade range (₹${floorPrice} – ₹${exhibitionPrice}).`,
      suggested: price,
    };
  },

  /**
   * Ingests 200 craft benchmarks from Excel into MongoDB
   */
  async seedFromExcel() {
    const excelPath = path.resolve(__dirname, "../Artisan_Dataset_Cleaned.xlsx");

    if (!fs.existsSync(excelPath)) {
      console.log(`Notice: ${excelPath} not found. Skipping Excel ingestion.`);
      return;
    }

    const currentCount = await PricingBenchmark.countDocuments();
    if (currentCount >= 100) {
      console.log(`Database already has ${currentCount} benchmarks loaded. Skipping Excel re-import.`);
      return;
    }

    console.log("Ingesting Artisan_Dataset_Cleaned.xlsx into MongoDB...");
    const workbook = readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const rawRows = utils.sheet_to_json(workbook.Sheets[sheetName]);

    const docsToInsert = rawRows.map((row) => {
      const cat = (row["Category"] || "Handicrafts").trim();
      const catKey = cat.toLowerCase();
      const hourlyRate = CATEGORY_HOURLY_RATES[catKey] || CATEGORY_HOURLY_RATES.default;

      const avgHours = Number(row["avg_hours"]) || 4;
      const avgMakingCost = Number(row["avg_making_cost_inr"]) || 200;

      const laborCost = Math.round(avgHours * hourlyRate);
      const overhead = Math.round((avgMakingCost + laborCost) * 0.05);
      const productionCost = avgMakingCost + laborCost + overhead;

      const floorPrice = Math.round(productionCost * 1.1);
      const fairPrice = Math.round(productionCost * 1.35);
      const premiumPrice = Math.round(fairPrice * 1.25);

      return {
        productName: row["Product/Item Name"] || "Handmade Item",
        category: cat,
        craftSpecialty: cat,
        material: row["Material Used (General)"] || "Handcrafted Material",
        dimensions: row["Avg Dimensions"] || "",
        location: row["State"] || "India",
        minHours: Number(row["min_hours"]) || avgHours,
        maxHours: Number(row["max_hours"]) || avgHours,
        laborHours: avgHours,
        minRawCost: Number(row["min_making_cost_inr"]) || avgMakingCost,
        maxRawCost: Number(row["max_making_cost_inr"]) || avgMakingCost,
        rawMaterialCost: avgMakingCost,
        hourlyRate,
        productionCost,
        floorPrice,
        fairPrice,
        premiumPrice,
        verified: true,
      };
    });

    await PricingBenchmark.deleteMany({});
    await PricingBenchmark.insertMany(docsToInsert);
    console.log(`Successfully ingested ${docsToInsert.length} craft benchmarks from Excel into MongoDB!`);
  },

  /**
   * Appends newly published verified listings to New_Artisan_Contributions.xlsx
   * (Triggered ONLY if category is new)
   */
  async appendToNewDataExcel(benchmarkData) {
    try {
      const exportPath = path.resolve(__dirname, "../New_Artisan_Contributions.xlsx");
      let rows = [];

      if (fs.existsSync(exportPath)) {
        try {
          const workbook = readFile(exportPath);
          const firstSheet = workbook.SheetNames[0];
          rows = utils.sheet_to_json(workbook.Sheets[firstSheet]) || [];
        } catch (readErr) {
          console.warn("Could not read existing contributions file, starting fresh:", readErr.message);
          rows = [];
        }
      }

      const newRow = {
        "Entry Date": new Date().toISOString().split("T")[0],
        "Category": benchmarkData.category || "Handicrafts",
        "Product/Item Name": benchmarkData.productName || "Handmade Item",
        "Material Used (General)": benchmarkData.material || "Handcrafted Material",
        "State": benchmarkData.location || "India",
        "Labor Hours": benchmarkData.laborHours || 0,
        "Hourly Rate (INR)": benchmarkData.hourlyRate || 85,
        "Raw Material Cost (INR)": benchmarkData.rawMaterialCost || 0,
        "Production Cost (INR)": benchmarkData.productionCost || 0,
        "Floor Price (INR)": benchmarkData.floorPrice || 0,
        "Fair / Recommended Price (INR)": benchmarkData.fairPrice || 0,
        "Exhibition Price (INR)": benchmarkData.premiumPrice || 0,
        "Artisan ID": benchmarkData.artisanId || "Anonymous",
      };

      rows.push(newRow);

      const newSheet = utils.json_to_sheet(rows);
      const newWorkbook = utils.book_new();
      utils.book_append_sheet(newWorkbook, newSheet, "New Contributions");

      writeFile(newWorkbook, exportPath);
      console.log(`[NEW CATEGORY EXPORTED] Appended "${benchmarkData.productName}" (Category: "${benchmarkData.category}") to New_Artisan_Contributions.xlsx`);
    } catch (err) {
      console.error("Failed to append to New_Artisan_Contributions.xlsx:", err.message);
    }
  },
};