"""Generate sample / fixture PDFs for AttendWise (requires: pip install reportlab pillow)."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.pdfgen import canvas

OUT = os.path.join(os.path.dirname(__file__), '..', 'sample-data')
os.makedirs(OUT, exist_ok=True)
styles = getSampleStyleSheet()

def pct(a, t):
    return f"{a / t * 100:.2f}"

def table(data, widths=None):
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e0e7ff')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (3, 1), (-1, -1), 'CENTER'),
    ]))
    return t

SUBJECTS = [
    ('CS201', 'Data Structures', 52, 44),
    ('CS202', 'Operating Systems', 48, 30),
    ('MA203', 'Engineering Mathematics III', 55, 49),
    ('CS204', 'Database Management Systems', 46, 28),
    ('EC205', 'Digital Electronics', 40, 36),
    ('HS206', 'Professional Communication', 30, 17),
    ('CS207', 'Data Structures Lab', 24, 22),
]

# 1. Main sample: standard table with header, serial numbers, codes, summary row
doc = SimpleDocTemplate(os.path.join(OUT, 'sample-attendance.pdf'), pagesize=A4)
rows = [['Sr No', 'Code', 'Subject', 'Total Lectures', 'Lectures Attended', 'Lectures Absent', 'Attendance %']]
for i, (c, n, t, a) in enumerate(SUBJECTS, 1):
    rows.append([str(i), c, n, str(t), str(a), str(t - a), pct(a, t)])
ta = sum(s[2] for s in SUBJECTS); aa = sum(s[3] for s in SUBJECTS)
rows.append(['', '', 'Total', str(ta), str(aa), str(ta - aa), pct(aa, ta)])
doc.build([
    Paragraph('Sample College of Engineering', styles['Title']),
    Paragraph('Attendance Report - Semester 3 - Roll No 21045 - As on 24/10/2026', styles['Normal']),
    Spacer(1, 14),
    table(rows, [35, 50, 170, 60, 70, 60, 60]),
])

# 2. Fraction format, no percentage column, no serial numbers
doc = SimpleDocTemplate(os.path.join(OUT, 'fixture-fraction.pdf'), pagesize=A4)
rows = [['Course', 'Attended / Total']]
for c, n, t, a in SUBJECTS[:4]:
    rows.append([f'{n} ({c})', f'{a} / {t}'])
doc.build([Paragraph('Attendance Summary', styles['Title']), table(rows, [250, 120])])

# 3. Duplicated table (cumulative + monthly) across two pages
doc = SimpleDocTemplate(os.path.join(OUT, 'fixture-duplicates.pdf'), pagesize=A4)
head = ['Code', 'Subject', 'Total', 'Present', 'Absent', '%']
t1 = [head] + [[c, n, str(t), str(a), str(t - a), pct(a, t)] for c, n, t, a in SUBJECTS[:3]]
t2 = [head] + [[c, n, str(t // 4), str(a // 4), str(t // 4 - a // 4), pct(a // 4, t // 4)] for c, n, t, a in SUBJECTS[:1]]
t3 = [head] + [[c, n, str(t), str(a), str(t - a), pct(a, t)] for c, n, t, a in SUBJECTS[:1]]
doc.build([Paragraph('Cumulative', styles['Heading2']), table(t1), PageBreak(),
           Paragraph('Repeated copy', styles['Heading2']), table(t3), Spacer(1, 12),
           Paragraph('Last month', styles['Heading2']), table(t2)])

# 4. Scanned-style PDF: an image only, no text layer
try:
    from PIL import Image, ImageDraw
    img = Image.new('RGB', (600, 300), 'white')
    d = ImageDraw.Draw(img)
    d.text((20, 20), 'Scanned attendance sheet', fill='black')
    for i in range(5):
        d.line((20, 60 + i * 40, 580, 60 + i * 40), fill='black')
    img_path = os.path.join(OUT, '_scan.png'); img.save(img_path)
    c = canvas.Canvas(os.path.join(OUT, 'fixture-scanned.pdf'), pagesize=A4)
    c.drawImage(img_path, 40, 400, width=500, height=250)
    c.save(); os.remove(img_path)
except ImportError:
    c = canvas.Canvas(os.path.join(OUT, 'fixture-scanned.pdf'), pagesize=A4)
    c.rect(40, 400, 500, 250); c.save()

# 5. Text but no attendance table at all
doc = SimpleDocTemplate(os.path.join(OUT, 'fixture-no-table.pdf'), pagesize=A4)
doc.build([Paragraph('Library Rules', styles['Title']),
           Paragraph('Books may be borrowed for fourteen days. Late returns are charged at a daily rate. '
                     'Silence must be maintained in the reading room at all times.', styles['Normal'])])

# 6. Corrupted PDF (valid header, garbage body)
with open(os.path.join(OUT, 'fixture-corrupted.pdf'), 'wb') as f:
    f.write(b'%PDF-1.4\n1 0 obj << /Broken true >> endobj\nthis is not a real pdf body\n' * 3)

print('written to', os.path.abspath(OUT))
