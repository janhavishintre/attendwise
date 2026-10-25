# AttendWise

Upload your college attendance PDF and see exactly how many lectures you need to attend to reach your target (default 75%). Everything runs in the browser: the PDF is never uploaded.

## Run it locally (VS Code)

1. Install Node.js 18+ from https://nodejs.org
2. Open this folder in VS Code (`File > Open Folder`), then open the terminal (`Ctrl+``).
3. Run:

```bash
npm install
npm run dev
```

4. Open the printed address (usually http://localhost:5173).

Other commands: `npm test` (all tests), `npm run build` (production build in `dist/`), `npm run preview`.

Try it without your own PDF: click **Try sample data**, or upload `sample-data/sample-attendance.pdf`.

## Project structure

```
attendwise/
├─ index.html, vite.config.js, tailwind.config.js, postcss.config.js, package.json
├─ sample-data/            sample-attendance.pdf + test fixtures (scanned, corrupted, duplicates, ...)
├─ scripts/make_sample_pdfs.py   regenerates the PDFs (pip install reportlab pillow)
└─ src/
   ├─ main.jsx, App.jsx, index.css
   ├─ components/
   │  ├─ Sidebar, Header, OverviewCards, Dashboard, AttendanceTable, SubjectCard
   │  ├─ AttendanceProgress, AttendanceChart, SubjectDetail, status
   │  ├─ PDFUploader, ExtractedDataReview, AttendanceSimulator
   │  └─ AttendanceSettings, PrintReport
   ├─ utils/
   │  ├─ attendanceCalculator.js   all maths (pure, no React)
   │  ├─ pdfParser.js              pdfjs extraction + row interpretation
   │  ├─ storage.js                validated localStorage
   │  └─ exporters.js              CSV export
   └─ data/sampleData.js
```

## The 75% calculation

With `A` attended, `T` conducted and target `P`:

- Required lectures: `max(0, ceil((P*T - A) / (1 - P)))` - the total grows with every lecture attended, so this is not "75% of T minus A".
- Lectures you can still miss: `floor((A - P*T) / P)`.
- Overall attendance is `sum(A) / sum(T)`, never an average of percentages.

The code does these with exact integer arithmetic (the target is scaled to hundredths of a percent), so floating point error cannot make the answer off by one. Example: 30 of 50 (60%) needs **30** more lectures, giving 60/80 = 75%. The tests brute-force every case up to 60 lectures to prove the result is the smallest number that works.

## How PDF parsing works

1. `pdfjs-dist` extracts text items with their x/y positions (in a web worker, locally).
2. Items on the same baseline are grouped into lines, and wide gaps split lines into table cells.
3. Each line's trailing numbers are interpreted by searching for the reading that is internally consistent: `attended/total` matches the printed percentage, and `total = attended + absent`. If a table header is recognised, its column order is used, but only if the numbers agree with it.
4. Subject code and name are taken from the text before the numbers (serial numbers are dropped, numbers inside names like "Mathematics 3" are kept).
5. Summary rows ("Total", "Overall") are left out and listed separately. Repeated subjects are excluded until you tick "Include", so nothing is double counted silently.
6. Whatever could not be cross-checked is highlighted. You always review and edit the table before anything is calculated.

## Limitations

- **Scanned PDFs / photos** are detected and explained, but OCR is not built in. Running OCR in the browser means downloading language data from a CDN, which conflicts with the "nothing leaves your device" goal. The alternatives offered are re-downloading a text-based PDF or entering subjects manually.
- PDF table layouts vary a lot. The parser is designed to flag uncertainty rather than guess, but an unusual layout may need manual correction.
- Results are projections. Your college's official records and rules (condonation, medical leave, how lectures are counted) take priority.
