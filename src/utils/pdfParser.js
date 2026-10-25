/**
 * PDF attendance parsing.
 *
 * Pipeline (all client-side, nothing is uploaded):
 *   1. extractLinesFromData  - pdfjs-dist -> text items with x/y positions
 *                              -> visual lines (items sharing a baseline).
 *   2. parseAttendanceLines  - pure function: lines of text -> subject rows.
 *
 * Step 2 is deliberately separate and pure so it can be unit tested without a
 * PDF or a browser.
 *
 * Row interpretation does not blindly trust column positions. For each text
 * line it takes the trailing run of numbers, then searches for the assignment
 * of (total, attended, [missed], [percentage]) that is internally consistent
 * (attended/total matches the printed percentage, total = attended + missed).
 * Anything that could not be cross-checked is flagged for the user to verify.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class PdfParseError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'PdfParseError';
    this.code = code;
    Object.assign(this, extra);
  }
}

/* ------------------------------------------------------------------ */
/* Step 1: text extraction                                             */
/* ------------------------------------------------------------------ */

let pdfjsPromise = null;

/** Lazily load pdfjs-dist and its worker (browser / Vite only). */
export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })().catch((err) => {
      pdfjsPromise = null;
      throw err;
    });
  }
  return pdfjsPromise;
}

const LINE_TOLERANCE = 3; // points: items within this vertical distance share a line
const CELL_GAP = 8; // points: a horizontal gap larger than this starts a new table cell

/** Group positioned text items into visual lines. */
export function groupItemsIntoLines(items) {
  const positioned = items
    .filter((it) => typeof it.str === 'string' && it.str.trim() !== '' && Array.isArray(it.transform))
    .map((it) => ({
      text: it.str,
      x: it.transform[4],
      y: it.transform[5],
      width: it.width || 0,
    }));

  // Top of the page first (PDF y grows upwards).
  positioned.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows = [];
  for (const item of positioned) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= LINE_TOLERANCE);
    if (row) {
      row.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      const cells = [];
      let current = null;
      let prevEnd = null;
      for (const it of sorted) {
        const gap = prevEnd === null ? Infinity : it.x - prevEnd;
        if (current === null || gap > CELL_GAP) {
          current = { text: it.text.trim() };
          cells.push(current);
        } else {
          current.text += (gap > 1 ? ' ' : '') + it.text.trim();
        }
        prevEnd = it.x + it.width;
      }
      return cells.map((c) => c.text.replace(/\s+/g, ' ').trim()).filter(Boolean);
    })
    .filter((cells) => cells.length > 0);
}

/**
 * Extract visual lines from raw PDF bytes.
 * `pdfjs` is injectable so tests can pass the Node build of pdfjs-dist.
 * Returns an array of { page, cells: string[] }.
 */
export async function extractLinesFromData(data, pdfjs) {
  const lib = pdfjs || (await loadPdfjs());
  let doc;
  try {
    const task = lib.getDocument({ data, useSystemFonts: true });
    doc = await task.promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      throw new PdfParseError('PASSWORD', 'This PDF is password protected. Remove the password and upload it again.');
    }
    if (err?.name === 'InvalidPDFException' || err?.name === 'FormatError' || err?.name === 'MissingPDFException') {
      throw new PdfParseError('INVALID_PDF', 'This file could not be read as a PDF. It may be corrupted or not a real PDF.');
    }
    throw new PdfParseError('INVALID_PDF', `The PDF could not be opened (${err?.message || 'unknown error'}).`);
  }

  const lines = [];
  let pagesWithText = 0;
  try {
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const pageLines = groupItemsIntoLines(content.items);
      if (pageLines.length > 0) pagesWithText += 1;
      for (const cells of pageLines) lines.push({ page: pageNo, cells });
    }
  } catch (err) {
    throw new PdfParseError('INVALID_PDF', `The PDF could not be read completely (${err?.message || 'unknown error'}).`);
  } finally {
    doc.destroy?.();
  }

  const characters = lines.reduce((n, l) => n + l.cells.join('').replace(/\s/g, '').length, 0);
  if (characters < 30) {
    throw new PdfParseError(
      'SCANNED',
      'No selectable text was found in this PDF. It looks like a scanned image, which needs OCR (text recognition) before it can be read. ' +
        'Try downloading the attendance report again from your college portal as a PDF (not a photo or scan), or enter the figures manually.',
    );
  }
  return { lines, pageCount: doc.numPages, pagesWithText };
}

/** Browser entry point: validate a File object and parse it. */
export async function parseAttendancePdf(file, pdfjs) {
  if (!file) throw new PdfParseError('NO_FILE', 'No file was selected.');
  const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (!looksLikePdf) {
    throw new PdfParseError('NOT_PDF', 'Only PDF files are supported. Please choose a .pdf attendance report.');
  }
  if (file.size === 0) throw new PdfParseError('INVALID_PDF', 'This file is empty.');
  if (file.size > MAX_FILE_BYTES) {
    throw new PdfParseError('TOO_LARGE', 'This file is larger than 25 MB, which is unusual for an attendance report.');
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // %PDF- header check (allow a little leading junk, as the spec does).
  const head = String.fromCharCode(...bytes.slice(0, 1024));
  if (!head.includes('%PDF-')) {
    throw new PdfParseError('INVALID_PDF', 'This file does not have a valid PDF header. It may be corrupted or renamed from another format.');
  }

  const { lines, pageCount } = await extractLinesFromData(bytes, pdfjs);
  const result = parseAttendanceLines(lines);
  return { ...result, pageCount, fileName: file.name };
}

/* ------------------------------------------------------------------ */
/* Step 2: interpreting lines                                          */
/* ------------------------------------------------------------------ */

const NUMBER_RE = /^\d+(\.\d+)?%?$/;
const FRACTION_RE = /^(\d+)\/(\d+)$/;
const CODE_RE = /^(?=(?:\D*\d){2,})(?=.*[A-Za-z])[A-Za-z0-9][A-Za-z0-9\-_.]{2,14}$/;
const SUMMARY_NAME_RE = /^(grand\s+)?(total|overall|aggregate|average|avg|cumulative|summary|sub\s*-?\s*total)\b/i;
const METADATA_RE =
  /^(roll|sr\.?\s*no|s\.?\s*no|semester|sem\b|batch|year|page|date|class|division|div\b|student|enrol|prn|branch|academic|report|printed|generated|name\b|id\b|reg|section|programme|program\b|department|dept|month|period|from|till|as\s+on|as\s+of)/i;

const HEADER_KEYS = [
  ['pct', /(%|percent|perc\b|percentage|attendance\s*pct)/i],
  ['missed', /(absent|missed|absence|leave|bunk)/i],
  ['attended', /(attend|present|attd)/i],
  ['total', /(total|conducted|held|delivered|no\.?\s*of\s*(lectures|classes)|lectures|classes)/i],
];

/** Does this line look like a table header? Returns the ordered numeric column keys, or null. */
function detectHeader(cells) {
  const keys = [];
  for (const cell of cells) {
    const found = HEADER_KEYS.find(([, re]) => re.test(cell));
    if (found) keys.push(found[0]);
  }
  const distinct = new Set(keys);
  const hasCore = distinct.has('attended') || distinct.has('total');
  // Needs at least two different numeric columns to be useful as a mapping.
  if (hasCore && distinct.size >= 2 && keys.length === distinct.size) return keys;
  return null;
}

function toToken(raw) {
  const clean = raw.replace(/,/g, '');
  const m = clean.match(NUMBER_RE);
  if (!m) return null;
  const hasPercentSign = clean.endsWith('%');
  const num = Number(clean.replace('%', ''));
  const isDecimal = m[1] !== undefined;
  return { raw, value: num, isPct: hasPercentSign || isDecimal, isInt: !hasPercentSign && !isDecimal };
}

/** Split a line into [prefix tokens, trailing numeric tokens]. */
function splitLine(cells) {
  const text = cells
    .join(' ')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1/$2')
    .replace(/(\d)\s+%/g, '$1%');
  const words = text.split(/\s+/).filter(Boolean);

  const numeric = [];
  let end = words.length;
  while (end > 0) {
    const w = words[end - 1];
    const frac = w.match(FRACTION_RE);
    if (frac) {
      const a = toToken(frac[1]);
      const b = toToken(frac[2]);
      numeric.unshift({ ...a, fromFraction: true }, { ...b, fromFraction: true });
      end -= 1;
      continue;
    }
    const tok = toToken(w);
    if (!tok) break;
    numeric.unshift(tok);
    end -= 1;
  }
  return { prefix: words.slice(0, end), numeric };
}

/**
 * Choose the most self-consistent reading of a run of numbers.
 * `order` is the header-derived column order when available.
 */
export function interpretNumbers(numeric, order = null) {
  // 1. Trust the header order when it fits the row and is internally consistent.
  if (order && numeric.length >= order.length) {
    const used = numeric.slice(numeric.length - order.length);
    const assigned = {};
    order.forEach((key, i) => {
      assigned[key] = used[i];
    });
    const a = assigned.attended?.value;
    const t = assigned.total?.value;
    const consistent = checkConsistency(assigned);
    if (consistent.ok) {
      return {
        attended: a ?? (t !== undefined && assigned.missed ? t - assigned.missed.value : null),
        total: t ?? (a !== undefined && assigned.missed ? a + assigned.missed.value : null),
        reportedPct: assigned.pct?.value ?? null,
        reportedMissed: assigned.missed?.value ?? null,
        used: used.length,
        confidence: consistent.corroborated ? 'high' : 'medium',
        flags: consistent.corroborated ? [] : ['Taken from the table header order but not cross-checked against a percentage - please verify.'],
        fieldFlags: consistent.corroborated ? {} : { attended: true, total: true },
      };
    }
  }

  // 2. Search for the most consistent assignment among the trailing numbers.
  const maxK = Math.min(numeric.length, 7);
  let best = null;
  for (let k = maxK; k >= 2; k -= 1) {
    const tail = numeric.slice(numeric.length - k);
    const candidate = bestAssignment(tail);
    if (!candidate) continue;
    const score = candidate.score - 0.5 * (k - candidate.explained);
    if (!best || score > best.score + 1e-9) best = { ...candidate, k, score };
  }
  if (!best) return null;

  const flags = [];
  const fieldFlags = {};
  let confidence = 'high';
  if (best.corroboration === 0) {
    confidence = 'low';
    flags.push('Could not tell which number is the total and which is attended - please verify.');
    fieldFlags.attended = true;
    fieldFlags.total = true;
  }
  return {
    attended: best.attended,
    total: best.total,
    reportedPct: best.pct,
    reportedMissed: best.missed,
    used: best.k,
    confidence,
    flags,
    fieldFlags,
  };
}

function checkConsistency(assigned) {
  const a = assigned.attended?.value;
  const t = assigned.total?.value;
  const m = assigned.missed?.value;
  const p = assigned.pct?.value;
  const ints = [assigned.attended, assigned.total, assigned.missed].filter(Boolean).every((x) => x.isInt || Number.isInteger(x.value));
  if (!ints) return { ok: false };
  if (a !== undefined && t !== undefined && a > t) return { ok: false };
  let corroborated = false;
  if (a !== undefined && t !== undefined && m !== undefined) {
    if (a + m !== t) return { ok: false };
    corroborated = true;
  }
  if (p !== undefined && a !== undefined && t !== undefined && t > 0) {
    if (Math.abs((a / t) * 100 - p) > 1.01) return { ok: false };
    corroborated = true;
  }
  if (a === undefined && t === undefined) return { ok: false };
  return { ok: true, corroborated };
}

function bestAssignment(tail) {
  let best = null;
  const n = tail.length;
  for (let ti = 0; ti < n; ti += 1) {
    for (let ai = 0; ai < n; ai += 1) {
      if (ti === ai) continue;
      const T = tail[ti];
      const A = tail[ai];
      if (!T.isInt || !A.isInt || A.value > T.value || T.value > 3000) continue;

      let corroboration = 0;
      let pct = null;
      let missed = null;
      const usedIdx = new Set([ti, ai]);

      for (let pi = 0; pi < n; pi += 1) {
        if (usedIdx.has(pi)) continue;
        const P = tail[pi];
        if (P.value > 100 || T.value === 0) continue;
        if (Math.abs((A.value / T.value) * 100 - P.value) <= 1.01) {
          corroboration += P.isPct ? 4 : 3;
          pct = P.value;
          usedIdx.add(pi);
          break;
        }
      }
      for (let mi = 0; mi < n; mi += 1) {
        if (usedIdx.has(mi)) continue;
        const M = tail[mi];
        if (M.isInt && M.value === T.value - A.value) {
          corroboration += 3;
          missed = M.value;
          usedIdx.add(mi);
          break;
        }
      }

      // Weak tie-breakers only: prefer adjacent pairs and (total, attended) / (attended, total) order.
      const tiebreak = (Math.abs(ti - ai) === 1 ? 0.2 : 0) + (ti < ai ? 0.05 : 0);
      const score = corroboration + tiebreak;
      const candidate = {
        total: T.value,
        attended: A.value,
        pct,
        missed,
        score,
        corroboration,
        explained: usedIdx.size,
      };
      if (!best || candidate.score > best.score + 1e-9) best = candidate;
    }
  }
  return best;
}

function extractCode(prefix) {
  let words = [...prefix];
  // Leading serial number: "1", "1." or "01"
  if (words.length > 1 && /^\d{1,3}\.?$/.test(words[0])) words = words.slice(1);

  let code = '';
  if (words.length === 1 && CODE_RE.test(words[0])) {
    return { code: words[0], name: '' };
  }
  if (words.length > 1 && CODE_RE.test(words[0])) {
    code = words[0];
    words = words.slice(1);
  } else if (words.length > 1 && CODE_RE.test(words[words.length - 1])) {
    code = words[words.length - 1];
    words = words.slice(0, -1);
  } else {
    const joined = words.join(' ');
    const paren = joined.match(/\(([A-Za-z0-9\-_ ]{3,14})\)\s*$/);
    if (paren && /\d/.test(paren[1]) && /[A-Za-z]/.test(paren[1])) {
      code = paren[1].trim();
      words = joined.slice(0, paren.index).trim().split(/\s+/).filter(Boolean);
    }
  }
  const name = words.join(' ').replace(/^[\s\-–:.|]+|[\s\-–:.|]+$/g, '').trim();
  return { code, name };
}

let rowCounter = 0;
const newId = () => {
  rowCounter += 1;
  return `row-${Date.now().toString(36)}-${rowCounter}`;
};

const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Extract student and session metadata from report headers.
 */
export function extractStudentMetadata(lines) {
  const meta = {
    name: '',
    studentNumber: '',
    rollNo: '',
    session: '',
    program: '',
    duration: '',
  };

  const fullText = lines
    .map((l) => (Array.isArray(l.cells) ? l.cells.join(' ') : String(l)))
    .join('\n');

  const nameMatch = fullText.match(/Student\s+Name\s*[:\s]\s*([^\n\r]+)/i);
  if (nameMatch) meta.name = nameMatch[1].trim();

  const numMatch = fullText.match(/Student\s+Number\s*[:\s]\s*([0-9]+)/i);
  if (numMatch) meta.studentNumber = numMatch[1].trim();

  const rollMatch = fullText.match(/Roll\s*No\.?\s*[:\s]\s*([A-Za-z0-9]+)/i);
  if (rollMatch) meta.rollNo = rollMatch[1].trim();

  const sessionMatch = fullText.match(/Academic\s+Year\s*&\s*Academic\s+Session\s*[:\s]\s*([^\n\r]+)/i);
  if (sessionMatch) meta.session = sessionMatch[1].trim();

  const progMatch = fullText.match(/Program(?:me)?\s+Name\s*[:\s]\s*([^\n\r]+)/i);
  if (progMatch) meta.program = progMatch[1].trim();

  const durMatch = fullText.match(/Attendance\s+Report\s+Duration\s*[:\s]+(?:From\s+)?([^\n\r]+)/i);
  if (durMatch) meta.duration = durMatch[1].trim();

  return meta.name || meta.rollNo || meta.studentNumber ? meta : null;
}

/**
 * Identify the attendance report format.
 * Returns: 'DETAILED_LOG' | 'COURSE_SUMMARY' | 'GENERIC_SUMMARY'
 */
export function identifyReportType(lines) {
  let detailedScore = 0;
  let summaryScore = 0;

  for (const line of lines) {
    const text = line.cells.join(' ').replace(/\s+/g, ' ').trim();

    if (/(?:start\s*time|end\s*time)/i.test(text)) detailedScore += 4;
    if (/\bP\s*-\s*Present\s*:\s*A\s*-\s*Absent/i.test(text)) detailedScore += 5;
    if (
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i.test(text) &&
      /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)\b/i.test(text) &&
      /\b(P|A|AG|L|NU)$/i.test(text)
    ) {
      detailedScore += 3;
    }

    if (/lecture\s*type/i.test(text)) summaryScore += 4;
    if (/lecture\s*conducted/i.test(text)) summaryScore += 4;
    if (/lecture\s*attended/i.test(text)) summaryScore += 4;
    if (/(?:status\s*not\s*updated|not\s*updated)/i.test(text)) summaryScore += 3;
    if (/\b(?:Theory|Practical|Tutorial)\s+\d+\s+\d+\s+\d+(?:\.\d+)?(?:\s+\d+)?$/i.test(text)) {
      summaryScore += 3;
    }
  }

  if (detailedScore >= 4 && detailedScore >= summaryScore) return 'DETAILED_LOG';
  if (summaryScore >= 4) return 'COURSE_SUMMARY';
  return 'GENERIC_SUMMARY';
}

/**
 * Standardize and clean course name and identify Theory/Practical/Tutorial type.
 */
export function cleanCourseNameAndType(rawName) {
  let s = rawName.trim();
  let type = '';

  // Strip leading serial numbers if present, e.g. "1 " or "1. "
  s = s.replace(/^\s*\d+\.?\s+/, '');

  // 1. Detect Practical/Lab indicators:
  // e.g. "Database Management System LabP- I1-2", "Web Programming LaboratoryP- I1-2", "P- I1-2"
  if (/(?:Lab(?:oratory)?P|P)\s*-\s*[A-Za-z0-9-]+/i.test(s)) {
    type = 'Practical';
    s = s.replace(/(?:Lab(?:oratory)?P|P)\s*-\s*[A-Za-z0-9-]+/i, '');
    if (!/\bLab(?:oratory)?\b/i.test(s)) {
      s += ' Laboratory';
    }
  } else if (/(?:TutorialU|U)\s*-\s*[A-Za-z0-9-]+/i.test(s)) {
    type = 'Tutorial';
    s = s.replace(/(?:TutorialU|U)\s*-\s*[A-Za-z0-9-]+/i, '');
  } else if (/T\s*-\s*[A-Za-z0-9-]+/i.test(s)) {
    type = 'Theory';
    s = s.replace(/T\s*-\s*[A-Za-z0-9-]+/i, '');
  } else if (/\bT\s+Div(?:ision)?\s*\d+/i.test(s)) {
    type = 'Theory';
    s = s.replace(/\s*T\s+Div(?:ision)?\s*\d+/i, '');
  }

  // Generic division/batch suffixes:
  s = s.replace(/\s+(?:Div(?:ision)?\s*\d+|Honors\s*\d+|Batch\s*[A-Za-z0-9]+)\b/i, '');
  s = s.replace(/\s*-\s*[A-Za-z0-9-]+$/, '');

  // Expansions:
  s = s.replace(/\bFoundatn\b/i, 'Foundations');
  s = s.replace(/\bEco\b/i, 'Ecosystem');
  s = s.replace(/\bLab\b(?!\w)/i, 'Laboratory');

  // Fallback type inference:
  if (!type) {
    if (/\b(?:Laboratory|Lab|Practical)\b/i.test(s)) {
      type = 'Practical';
    } else if (/\bTutorial\b/i.test(s)) {
      type = 'Tutorial';
    } else {
      type = 'Theory';
    }
  }

  s = s.replace(/[\s\-–:,]+$/g, '').trim();
  const displayName = type ? `${s} (${type})` : s;
  return { cleanName: s, type, displayName };
}

/**
 * Parse Detailed Session-wise Attendance Log (PDF 1 format).
 * Aggregates lecture records per subject component and tracks Not Updated (NU).
 */
export function parseDetailedLog(lines, student = null) {
  const rawText = lines.map((l) => l.cells.join('  ')).join('\n');
  const groups = new Map();
  const skipped = [];
  const warnings = [];
  let recordCount = 0;

  const STATUS_RE = /^(P|A|AG|L|NU)$/i;
  const TIME_RE = /^\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?$/i;
  const DATE_RE = /^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})|(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4})$/i;

  const ROW_RE =
    /^(?:(\d+)\s+)?(.+?)\s+((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})|(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}))\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s+(P|A|AG|L|NU)$/i;

  for (const line of lines) {
    const text = line.cells.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    if (METADATA_RE.test(text) && !DATE_RE.test(text)) continue;
    if (/^(Attendance Report|Above data is viewed|PS: This is a system-generated|Page \d+ of \d+|P - Present|AG:)/i.test(text)) {
      continue;
    }
    if (/^(Sr\s*No|Course Name|Start Time|End Time)/i.test(text)) continue;

    let courseRaw = null;
    let status = null;

    const cells = line.cells;
    if (cells.length >= 4 && STATUS_RE.test(cells[cells.length - 1])) {
      status = cells[cells.length - 1].toUpperCase();
      if (TIME_RE.test(cells[cells.length - 2]) && TIME_RE.test(cells[cells.length - 3])) {
        let nameCells = cells.slice(0, cells.length - 4);
        if (nameCells.length > 1 && /^\d+$/.test(nameCells[0])) {
          nameCells = nameCells.slice(1);
        }
        courseRaw = nameCells.join(' ').trim();
      }
    }

    if (!courseRaw || !status) {
      const match = text.match(ROW_RE);
      if (match) {
        courseRaw = match[2].trim();
        status = match[6].toUpperCase();
      }
    }

    if (!courseRaw || !status) continue;

    const { cleanName, type, displayName } = cleanCourseNameAndType(courseRaw);
    const key = displayName.toLowerCase();

    if (!groups.has(key)) {
      groups.set(key, {
        displayName,
        cleanName,
        type,
        attended: 0,
        conducted: 0,
        missed: 0,
        notUpdated: 0,
        totalRecords: 0,
        firstPage: line.page,
      });
    }

    const g = groups.get(key);
    g.totalRecords += 1;
    recordCount += 1;

    // P = Present, AG = Attendance Granted, L = Late Admission
    if (status === 'P' || status === 'AG' || status === 'L') {
      g.attended += 1;
      g.conducted += 1;
    } else if (status === 'A') {
      g.conducted += 1;
      g.missed += 1;
    } else if (status === 'NU') {
      g.notUpdated += 1;
    }
  }

  const subjects = [];
  for (const g of groups.values()) {
    const flags = [];
    if (g.notUpdated > 0) {
      flags.push(`${g.notUpdated} lecture${g.notUpdated > 1 ? 's are' : ' is'} not updated yet.`);
    }
    if (g.conducted === 0 && g.notUpdated > 0) {
      flags.push('No conducted lectures recorded yet; all sessions pending update.');
    }

    subjects.push({
      id: newId(),
      code: '',
      name: g.displayName,
      attended: g.attended,
      total: g.conducted,
      notUpdated: g.notUpdated,
      lectureType: g.type,
      included: true,
      confidence: 'high',
      flags,
      fieldFlags: {},
      page: g.firstPage,
      rawLine: `${g.displayName}: ${g.attended}/${g.conducted} attended (${g.notUpdated} NU)`,
    });
  }

  if (subjects.length === 0) {
    throw new PdfParseError(
      'NO_TABLE',
      'Text was found, but no detailed attendance entries could be recognised.',
      { rawText },
    );
  }

  warnings.push(`Detailed Session Log: aggregated ${recordCount} lecture records across ${subjects.length} subjects.`);
  const totalNu = subjects.reduce((sum, s) => sum + (s.notUpdated || 0), 0);
  if (totalNu > 0) {
    warnings.push(`${totalNu} lecture${totalNu > 1 ? 's have' : ' has'} status not updated.`);
  }

  return {
    subjects,
    skipped,
    warnings,
    rawText,
    headerFound: true,
    reportType: 'detailed',
    student,
  };
}

/**
 * Parse Course-wise Summary Attendance Report (PDF 2 format).
 * Directly reads Course Name, Lecture Type, Conducted, Attended, %, and status not updated.
 */
export function parseCourseSummary(lines, student = null) {
  const rawText = lines.map((l) => l.cells.join('  ')).join('\n');
  const subjects = [];
  const skipped = [];
  const warnings = [];

  const SUMMARY_ROW_RE =
    /^(?:(\d+)\s+)?(.+?)\s+(Theory|Practical|Tutorial|Lab)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?%?)\s*(\d+)?$/i;

  let pendingName = '';

  for (const line of lines) {
    const text = line.cells.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    if (METADATA_RE.test(text) && !/Theory|Practical|Tutorial/i.test(text)) continue;
    if (/^(Attendance Report|Above data is viewed|PS: This is a system-generated|Page \d+ of \d+|P - Present|AG:)/i.test(text)) {
      continue;
    }
    if (/^(Sr\.?\s*No|Course Name|Lecture Type|Lecture Conducted)/i.test(text)) continue;

    let courseName = null;
    let lectureType = null;
    let conducted = null;
    let attended = null;
    let pct = null;
    let notUpdated = 0;

    const cells = line.cells;
    if (cells.length >= 6) {
      const typeIdx = cells.findIndex((c) => /^(Theory|Practical|Tutorial|Lab)$/i.test(c));
      if (typeIdx > 0 && typeIdx + 3 < cells.length) {
        lectureType = cells[typeIdx];
        let nameCells = cells.slice(0, typeIdx);
        if (nameCells.length > 1 && /^\d+$/.test(nameCells[0])) {
          nameCells = nameCells.slice(1);
        }
        courseName = nameCells.join(' ').trim();
        conducted = Number(cells[typeIdx + 1]);
        attended = Number(cells[typeIdx + 2]);
        pct = Number(cells[typeIdx + 3].replace('%', ''));
        if (typeIdx + 4 < cells.length) {
          notUpdated = Number(cells[typeIdx + 4]) || 0;
        }
      }
    }

    if (!courseName || !lectureType) {
      const match = text.match(SUMMARY_ROW_RE);
      if (match) {
        courseName = match[2].trim();
        lectureType = match[3];
        conducted = Number(match[4]);
        attended = Number(match[5]);
        pct = Number(match[6].replace('%', ''));
        notUpdated = match[7] ? Number(match[7]) : 0;
      }
    }

    if (!courseName || !lectureType) {
      if (!METADATA_RE.test(text) && text.length < 80 && !/\d{2,}/.test(text)) {
        pendingName = (pendingName ? pendingName + ' ' : '') + text;
      }
      continue;
    }

    if (pendingName) {
      courseName = `${pendingName} ${courseName}`.trim();
      pendingName = '';
    }

    let cleanName = courseName.replace(/^\s*\d+\.?\s+/, '').trim();
    cleanName = cleanName.replace(/\bFoundatn\b/i, 'Foundations');
    cleanName = cleanName.replace(/\bEco\b/i, 'Ecosystem');
    cleanName = cleanName.replace(/\bLab\b(?!\w)/i, 'Laboratory');
    cleanName = cleanName.replace(/[\s\-–:,]+$/g, '').trim();

    const normType = lectureType.charAt(0).toUpperCase() + lectureType.slice(1).toLowerCase();
    const displayName = `${cleanName} (${normType})`;

    const flags = [];
    const fieldFlags = {};
    let confidence = 'high';

    if (notUpdated > 0) {
      flags.push(`${notUpdated} lecture${notUpdated > 1 ? 's are' : ' is'} not updated yet.`);
    }

    if (attended > conducted) {
      flags.push('Attended is greater than conducted - please verify.');
      fieldFlags.attended = true;
      fieldFlags.total = true;
      confidence = 'low';
    } else if (conducted > 0 && pct !== null) {
      const calcPct = (attended / conducted) * 100;
      if (Math.abs(calcPct - pct) > 1.01) {
        flags.push(`The PDF shows ${pct}% but attended/conducted gives ${calcPct.toFixed(2)}% - please check.`);
        fieldFlags.attended = true;
        fieldFlags.total = true;
        confidence = 'medium';
      }
    }

    subjects.push({
      id: newId(),
      code: '',
      name: displayName,
      attended,
      total: conducted,
      notUpdated,
      lectureType: normType,
      included: true,
      confidence,
      flags,
      fieldFlags,
      page: line.page,
      rawLine: text,
    });
  }

  if (subjects.length === 0) {
    throw new PdfParseError(
      'NO_TABLE',
      'Text was found, but no course summary rows could be recognised.',
      { rawText },
    );
  }

  warnings.push(`Course Summary Report: found ${subjects.length} course components.`);
  const totalNu = subjects.reduce((sum, s) => sum + (s.notUpdated || 0), 0);
  if (totalNu > 0) {
    warnings.push(`${totalNu} lecture${totalNu > 1 ? 's have' : ' has'} status not updated.`);
  }

  return {
    subjects,
    skipped,
    warnings,
    rawText,
    headerFound: true,
    reportType: 'summary',
    student,
  };
}

/**
 * Fallback generic summary parser for standard university reports.
 */
export function parseGenericSummary(lines) {
  const rawText = lines.map((l) => l.cells.join('  ')).join('\n');
  const subjects = [];
  const skipped = [];
  const warnings = [];

  let order = null;
  let headerFound = false;
  let pendingText = null;

  for (const line of lines) {
    const header = detectHeader(line.cells);
    if (header) {
      order = header;
      headerFound = true;
      pendingText = null;
      continue;
    }

    const { prefix, numeric } = splitLine(line.cells);
    if (numeric.length < 2) {
      // A plain-text line directly above a numbers row may be a wrapped subject name.
      const text = prefix.join(' ');
      pendingText = text && !METADATA_RE.test(text) && text.length < 80 ? text : null;
      continue;
    }

    const interpreted = interpretNumbers(numeric, order);
    if (!interpreted) {
      pendingText = null;
      continue;
    }

    const prefixTokens = prefix.concat(numeric.slice(0, numeric.length - interpreted.used).map((n) => n.raw));
    let { code, name } = extractCode(prefixTokens);
    const rawLine = line.cells.join('  ');

    if (METADATA_RE.test(name) && !code) {
      pendingText = null;
      continue;
    }
    if (SUMMARY_NAME_RE.test(name)) {
      skipped.push({
        name,
        attended: interpreted.attended,
        total: interpreted.total,
        page: line.page,
        reason: 'Looks like a summary / total row. It was left out so lectures are not counted twice.',
        rawLine,
      });
      pendingText = null;
      continue;
    }

    const flags = [...interpreted.flags];
    const fieldFlags = { ...interpreted.fieldFlags };
    let confidence = interpreted.confidence;

    if (!name && pendingText) {
      name = pendingText;
    }
    if (!name) {
      flags.push('Subject name could not be read - please type it in.');
      fieldFlags.name = true;
      confidence = 'low';
    }

    if (interpreted.attended > interpreted.total) {
      flags.push('Attended is greater than total - please check these values.');
      fieldFlags.attended = true;
      fieldFlags.total = true;
      confidence = 'low';
    }
    if (interpreted.reportedPct !== null && interpreted.total > 0) {
      const computed = (interpreted.attended / interpreted.total) * 100;
      if (Math.abs(computed - interpreted.reportedPct) > 1.01) {
        flags.push(
          `The PDF shows ${interpreted.reportedPct}% but attended/total gives ${computed.toFixed(2)}% - please check.`,
        );
        fieldFlags.attended = true;
        fieldFlags.total = true;
        if (confidence === 'high') confidence = 'medium';
      }
    }

    subjects.push({
      id: newId(),
      code,
      name,
      attended: interpreted.attended,
      total: interpreted.total,
      included: true,
      confidence,
      flags,
      fieldFlags,
      page: line.page,
      rawLine,
    });
    pendingText = null;
  }

  // Duplicate detection: later copies are excluded until the user confirms them.
  const seen = new Map();
  subjects.forEach((s, index) => {
    const key = normKey(s.code) || normKey(s.name);
    if (!key) return;
    if (!seen.has(key)) {
      seen.set(key, index);
      return;
    }
    const first = subjects[seen.get(key)];
    const identical = first.attended === s.attended && first.total === s.total;
    s.included = false;
    s.confidence = s.confidence === 'high' ? 'medium' : s.confidence;
    s.flags.push(
      identical
        ? 'Exact duplicate of an earlier row. Excluded so it is not counted twice - tick "Include" if it is a separate subject.'
        : 'Same subject appears again with different numbers (another table, month or theory/practical split?). Excluded until you confirm - tick "Include" if it should be counted.',
    );
    s.duplicateOf = first.id;
  });

  if (subjects.length === 0) {
    throw new PdfParseError(
      'NO_TABLE',
      'Text was found, but no attendance rows could be recognised. The report may use an unfamiliar layout. ' +
        'You can add your subjects manually instead (the text that was read is shown below to help).',
      { rawText },
    );
  }

  if (!headerFound) {
    warnings.push('No table header was recognised, so numbers were matched by checking that they add up. Please review every row.');
  }
  if (skipped.length > 0) {
    warnings.push(`${skipped.length} summary/total row${skipped.length > 1 ? 's were' : ' was'} left out to avoid double counting.`);
  }
  if (subjects.some((s) => s.duplicateOf)) {
    warnings.push('Some rows look like duplicates and are excluded until you confirm them.');
  }
  if (subjects.length > 20) {
    warnings.push(`${subjects.length} rows were found, which is more than a typical semester. Delete any that are not subjects.`);
  }

  return { subjects, skipped, warnings, rawText, headerFound };
}

/**
 * Top-level entry point to convert extracted lines into subject rows.
 * Automatically identifies report format and extracts metadata.
 */
export function parseAttendanceLines(lines) {
  const student = extractStudentMetadata(lines);
  const reportType = identifyReportType(lines);

  if (reportType === 'DETAILED_LOG') {
    try {
      return parseDetailedLog(lines, student);
    } catch (err) {
      if (err.code !== 'NO_TABLE') throw err;
      // Fallback to generic summary if detailed table returned no rows
    }
  }

  if (reportType === 'COURSE_SUMMARY') {
    try {
      return parseCourseSummary(lines, student);
    } catch (err) {
      if (err.code !== 'NO_TABLE') throw err;
      // Fallback to generic summary
    }
  }

  const result = parseGenericSummary(lines);
  return { ...result, reportType: 'generic', student };
}
