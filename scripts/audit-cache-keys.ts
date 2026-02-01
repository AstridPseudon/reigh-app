#!/usr/bin/env npx tsx
/**
 * Cache Key Audit Script
 *
 * Scans the codebase to capture all React Query usage:
 * - Query key definitions (useQuery, useMutation)
 * - Invalidation calls (invalidateQueries, setQueryData, refetchQueries, cancelQueries)
 *
 * Outputs a baseline JSON file for comparison after migration.
 *
 * Usage:
 *   npx tsx scripts/audit-cache-keys.ts
 *   npx tsx scripts/audit-cache-keys.ts --compare scripts/cache-audit-baseline.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '..', 'src');
const OUTPUT_FILE = path.join(__dirname, 'cache-audit-baseline.json');

interface QueryKeyUsage {
  file: string;
  line: number;
  type: 'query' | 'mutation' | 'invalidate' | 'setQueryData' | 'refetch' | 'cancel' | 'getQueryData';
  keyPattern: string;
  rawLine: string;
}

interface AuditResult {
  timestamp: string;
  totalFiles: number;
  filesWithQueryKeys: number;
  uniqueKeyPatterns: string[];
  usageByType: Record<string, number>;
  usageByFile: Record<string, QueryKeyUsage[]>;
  allUsages: QueryKeyUsage[];
}

// Patterns to match query key usage
const PATTERNS = [
  { regex: /useQuery\s*[<(]\s*\{[^}]*queryKey\s*:\s*(\[[^\]]+\])/g, type: 'query' as const },
  { regex: /useQuery\s*\(\s*(\[[^\]]+\])/g, type: 'query' as const },
  { regex: /useMutation\s*[<(]\s*\{[^}]*mutationKey\s*:\s*(\[[^\]]+\])/g, type: 'mutation' as const },
  { regex: /invalidateQueries\s*\(\s*\{[^}]*queryKey\s*:\s*(\[[^\]]+\])/g, type: 'invalidate' as const },
  { regex: /invalidateQueries\s*\(\s*(\[[^\]]+\])/g, type: 'invalidate' as const },
  { regex: /setQueryData\s*\(\s*(\[[^\]]+\])/g, type: 'setQueryData' as const },
  { regex: /refetchQueries\s*\(\s*\{[^}]*queryKey\s*:\s*(\[[^\]]+\])/g, type: 'refetch' as const },
  { regex: /refetchQueries\s*\(\s*(\[[^\]]+\])/g, type: 'refetch' as const },
  { regex: /cancelQueries\s*\(\s*\{[^}]*queryKey\s*:\s*(\[[^\]]+\])/g, type: 'cancel' as const },
  { regex: /cancelQueries\s*\(\s*(\[[^\]]+\])/g, type: 'cancel' as const },
  { regex: /getQueryData\s*[<(]\s*(\[[^\]]+\])/g, type: 'getQueryData' as const },
];

// Also match predicate-based invalidations
const PREDICATE_PATTERN = /invalidateQueries\s*\(\s*\{[^}]*predicate[^}]*queryKey\[0\]\s*===\s*['"]([^'"]+)['"]/g;

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          walk(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

function normalizeKeyPattern(key: string): string {
  // Normalize variable parts to placeholders for grouping
  return key
    .replace(/,\s+/g, ', ')  // Normalize spacing
    .replace(/['"]([^'"]+)['"]/g, "'$1'")  // Normalize quotes
    .replace(/\b[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}\b/gi, '<uuid>')  // UUIDs
    .replace(/\b(shotId|projectId|taskId|generationId|segmentId|pairId|resourceId)\b/g, '<$1>')
    .replace(/\$\{[^}]+\}/g, '<var>')  // Template literals
    .trim();
}

function extractBaseKey(keyPattern: string): string {
  // Extract just the first element of the array for grouping
  const match = keyPattern.match(/\[\s*['"]([^'"]+)['"]/);
  return match ? match[1] : keyPattern;
}

function auditFile(filePath: string): QueryKeyUsage[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  const usages: QueryKeyUsage[] = [];

  // Match standard patterns
  for (const { regex, type } of PATTERNS) {
    // Reset regex state
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      const rawLine = content.split('\n')[line - 1]?.trim() || '';
      usages.push({
        file: relativePath,
        line,
        type,
        keyPattern: normalizeKeyPattern(match[1]),
        rawLine: rawLine.substring(0, 120),
      });
    }
  }

  // Match predicate-based invalidations
  PREDICATE_PATTERN.lastIndex = 0;
  let predicateMatch;
  while ((predicateMatch = PREDICATE_PATTERN.exec(content)) !== null) {
    const line = getLineNumber(content, predicateMatch.index);
    const rawLine = content.split('\n')[line - 1]?.trim() || '';
    usages.push({
      file: relativePath,
      line,
      type: 'invalidate',
      keyPattern: `['${predicateMatch[1]}', ...] (predicate)`,
      rawLine: rawLine.substring(0, 120),
    });
  }

  return usages;
}

function runAudit(): AuditResult {
  const files = getAllTsFiles(SRC_DIR);
  const allUsages: QueryKeyUsage[] = [];
  const usageByFile: Record<string, QueryKeyUsage[]> = {};

  for (const file of files) {
    const usages = auditFile(file);
    if (usages.length > 0) {
      const relativePath = path.relative(path.join(__dirname, '..'), file);
      usageByFile[relativePath] = usages;
      allUsages.push(...usages);
    }
  }

  // Count by type
  const usageByType: Record<string, number> = {};
  for (const usage of allUsages) {
    usageByType[usage.type] = (usageByType[usage.type] || 0) + 1;
  }

  // Unique key patterns (base keys)
  const uniqueKeyPatterns = [...new Set(allUsages.map(u => extractBaseKey(u.keyPattern)))].sort();

  return {
    timestamp: new Date().toISOString(),
    totalFiles: files.length,
    filesWithQueryKeys: Object.keys(usageByFile).length,
    uniqueKeyPatterns,
    usageByType,
    usageByFile,
    allUsages,
  };
}

function compareAudits(baseline: AuditResult, current: AuditResult): void {
  console.log('\n=== COMPARISON REPORT ===\n');

  // Compare unique keys
  const baselineKeys = new Set(baseline.uniqueKeyPatterns);
  const currentKeys = new Set(current.uniqueKeyPatterns);

  const addedKeys = [...currentKeys].filter(k => !baselineKeys.has(k));
  const removedKeys = [...baselineKeys].filter(k => !currentKeys.has(k));

  if (addedKeys.length > 0) {
    console.log('⚠️  NEW keys added (not in baseline):');
    addedKeys.forEach(k => console.log(`   + ${k}`));
  }

  if (removedKeys.length > 0) {
    console.log('✅ Keys removed (were in baseline):');
    removedKeys.forEach(k => console.log(`   - ${k}`));
  }

  if (addedKeys.length === 0 && removedKeys.length === 0) {
    console.log('✅ Key patterns unchanged');
  }

  // Compare usage counts
  console.log('\n--- Usage Counts ---');
  console.log(`Baseline: ${baseline.allUsages.length} usages across ${baseline.filesWithQueryKeys} files`);
  console.log(`Current:  ${current.allUsages.length} usages across ${current.filesWithQueryKeys} files`);

  // Compare by type
  console.log('\n--- By Type ---');
  const allTypes = new Set([...Object.keys(baseline.usageByType), ...Object.keys(current.usageByType)]);
  for (const type of allTypes) {
    const baseCount = baseline.usageByType[type] || 0;
    const currCount = current.usageByType[type] || 0;
    const diff = currCount - baseCount;
    const diffStr = diff === 0 ? '' : diff > 0 ? ` (+${diff})` : ` (${diff})`;
    console.log(`  ${type}: ${baseCount} → ${currCount}${diffStr}`);
  }
}

function printSummary(result: AuditResult): void {
  console.log('\n=== CACHE KEY AUDIT REPORT ===\n');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Total TS/TSX files scanned: ${result.totalFiles}`);
  console.log(`Files with query key usage: ${result.filesWithQueryKeys}`);
  console.log(`Total query key usages: ${result.allUsages.length}`);

  console.log('\n--- Usage by Type ---');
  for (const [type, count] of Object.entries(result.usageByType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log(`\n--- Unique Base Keys (${result.uniqueKeyPatterns.length}) ---`);
  for (const key of result.uniqueKeyPatterns) {
    const count = result.allUsages.filter(u => extractBaseKey(u.keyPattern) === key).length;
    console.log(`  ${key}: ${count} usages`);
  }

  console.log('\n--- Top Files by Usage ---');
  const filesByUsage = Object.entries(result.usageByFile)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);
  for (const [file, usages] of filesByUsage) {
    console.log(`  ${file}: ${usages.length}`);
  }
}

// Main
const args = process.argv.slice(2);
const compareMode = args.includes('--compare');
const compareFile = compareMode ? args[args.indexOf('--compare') + 1] : null;

console.log('Scanning codebase for React Query usage...');
const result = runAudit();

if (compareMode && compareFile) {
  if (!fs.existsSync(compareFile)) {
    console.error(`Baseline file not found: ${compareFile}`);
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(compareFile, 'utf-8')) as AuditResult;
  compareAudits(baseline, result);
} else {
  printSummary(result);

  // Save baseline
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\n✅ Baseline saved to: ${OUTPUT_FILE}`);
}
