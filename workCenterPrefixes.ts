import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from 'url';

// Get the directory path for ES modules  
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reads data/machine_matrix.csv, extracts the alphabetical prefix before the
 * first dash (e.g. "TUMBLE" from "TUMBLE-001") and returns a unique list.
 */
export function getWorkCenterPrefixes(): string[] {
  const csvPath = path.resolve(__dirname, "../../data/machine_matrix.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn("⚠️  machine_matrix.csv not found:", csvPath);
    return [];
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const records = parse(raw, { columns: true, skip_empty_lines: true });
  const prefixes = new Set<string>();

  records.forEach((row: any) => {
    const code: string = (row.machineCode ?? "").toString().trim().toUpperCase();
    const match = code.match(/^([A-Z\s]+?)-\d+/);
    if (match) prefixes.add(match[1].trim());
  });

  return Array.from(prefixes);
}