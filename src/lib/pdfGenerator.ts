import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface GeneratePdfOptions {
  title: string;
  department?: string;
  category?: string;
  academicYear?: string;
  publishedDate?: string;
  actionRequiredDate?: string;
  contentRaw?: string;
}

/**
 * Sanitizes input text so it only contains characters encodable by standard PDF WinAnsi font
 */
function sanitizeForPdf(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]/gu, '') // strip emojis & variation selectors
    .replace(/[•●]/g, ' - ') // replace unicode bullets with standard hyphen
    .replace(/[–—]/g, '-') // replace en/em-dashes with hyphen
    .replace(/[“”]/g, '"') // replace curly quotes
    .replace(/[‘’]/g, "'") // replace curly apostrophes
    .replace(/₹/g, 'Rs. ') // replace rupee symbol with Rs.
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // keep ASCII printable + newlines/tabs
    .replace(/\t/g, '    '); // replace tabs with spaces
}

/**
 * Wraps text into lines that fit within a maximum width for a given font and font size.
 */
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const resultLines: string[] = [];
  const rawParagraphs = text.split('\n');

  for (const para of rawParagraphs) {
    if (!para.trim()) {
      resultLines.push('');
      continue;
    }

    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          resultLines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}

/**
 * Generates a clean, official college PDF and returns it as a data URL: `data:application/pdf;base64,...`
 */
export async function generatePdfDataUrl(options: GeneratePdfOptions): Promise<string> {
  const title = sanitizeForPdf(options.title || 'Official Document');
  const department = sanitizeForPdf(options.department || 'General Academic');
  const category = sanitizeForPdf(options.category || 'Circular');
  const academicYear = sanitizeForPdf(options.academicYear || '2026-2027');
  const publishedDate = sanitizeForPdf(options.publishedDate || new Date().toISOString().split('T')[0]);
  const actionRequiredDate = options.actionRequiredDate ? sanitizeForPdf(options.actionRequiredDate) : undefined;
  const contentRaw = sanitizeForPdf(options.contentRaw || '');

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const margin = 45;
  const contentWidth = pageWidth - margin * 2;

  let currentPage = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = (page: any, isFirstPage: boolean) => {
    // Top banner bar
    page.drawRectangle({
      x: margin,
      y: pageHeight - margin - 8,
      width: contentWidth,
      height: 4,
      color: rgb(0.0, 0.21, 0.15), // Deep emerald
    });

    page.drawText('CAMPUSIQ  •  OFFICIAL INSTITUTIONAL RECORD', {
      x: margin,
      y: pageHeight - margin - 22,
      size: 9,
      font: fontBold,
      color: rgb(0.0, 0.45, 0.35),
    });

    if (!isFirstPage) {
      page.drawText(`${title} (cont.)`, {
        x: margin,
        y: pageHeight - margin - 36,
        size: 9,
        font: fontOblique,
        color: rgb(0.4, 0.45, 0.45),
      });

      page.drawLine({
        start: { x: margin, y: pageHeight - margin - 44 },
        end: { x: pageWidth - margin, y: pageHeight - margin - 44 },
        thickness: 0.75,
        color: rgb(0.8, 0.85, 0.83),
      });
    }
  };

  const drawFooter = (page: any, pageNum: number, totalPages?: number) => {
    page.drawLine({
      start: { x: margin, y: margin + 18 },
      end: { x: pageWidth - margin, y: margin + 18 },
      thickness: 0.5,
      color: rgb(0.8, 0.85, 0.83),
    });

    page.drawText('Verified Official Document  •  Issued by Academic Affairs & Examination Directorate', {
      x: margin,
      y: margin + 6,
      size: 8,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.5),
    });

    const pageStr = totalPages ? `Page ${pageNum} of ${totalPages}` : `Page ${pageNum}`;
    const pageStrWidth = fontRegular.widthOfTextAtSize(pageStr, 8);
    page.drawText(pageStr, {
      x: pageWidth - margin - pageStrWidth,
      y: margin + 6,
      size: 8,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.5),
    });
  };

  // Draw header on first page
  drawHeader(currentPage, true);
  y = pageHeight - margin - 45;

  // Department name
  currentPage.drawText(department.toUpperCase(), {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.25),
  });
  y -= 22;

  // Document Title (wrapped if long)
  const titleLines = wrapText(title, contentWidth, fontBold, 16);
  for (const line of titleLines) {
    currentPage.drawText(line, {
      x: margin,
      y,
      size: 16,
      font: fontBold,
      color: rgb(0.04, 0.11, 0.19),
    });
    y -= 20;
  }
  y -= 4;

  // Metadata badges box
  const metaBoxHeight = 32;
  currentPage.drawRectangle({
    x: margin,
    y: y - metaBoxHeight + 10,
    width: contentWidth,
    height: metaBoxHeight,
    color: rgb(0.95, 0.97, 0.96),
    borderColor: rgb(0.75, 0.82, 0.78),
    borderWidth: 0.75,
  });

  const metaItems = [
    `Category: ${category}`,
    `Academic Year: ${academicYear}`,
    `Date: ${publishedDate}`,
    ...(actionRequiredDate ? [`Deadline: ${actionRequiredDate}`] : []),
  ];

  let metaX = margin + 12;
  for (const item of metaItems) {
    currentPage.drawText(item, {
      x: metaX,
      y: y - metaBoxHeight + 20,
      size: 8.5,
      font: fontBold,
      color: rgb(0.1, 0.25, 0.2),
    });
    metaX += fontBold.widthOfTextAtSize(item, 8.5) + 20;
    if (metaX > pageWidth - margin - 40) break;
  }
  y -= (metaBoxHeight + 16);

  // Content Body
  const cleanBodyText = contentRaw.trim() || `${title}\n\nOfficial document for ${department}.`;
  const bodyLines = wrapText(cleanBodyText, contentWidth, fontRegular, 10);
  const lineHeight = 14;

  for (const line of bodyLines) {
    if (y < margin + 45) {
      // Need a new page
      currentPage = doc.addPage([pageWidth, pageHeight]);
      drawHeader(currentPage, false);
      y = pageHeight - margin - 55;
    }

    if (line === '') {
      y -= lineHeight * 0.75;
      continue;
    }

    // Distinguish bullet points or section headers
    const isSectionHeader = /^[A-Z0-9\s\.\-]{3,}:?$|^Day|^Time Table|^Notice|^Master Time Table/i.test(line) && line.length < 50;
    const fontToUse = isSectionHeader ? fontBold : fontRegular;
    const colorToUse = isSectionHeader ? rgb(0.04, 0.11, 0.19) : rgb(0.15, 0.18, 0.2);

    currentPage.drawText(line, {
      x: margin,
      y,
      size: 10,
      font: fontToUse,
      color: colorToUse,
    });

    y -= lineHeight;
  }

  // Draw footers on all pages
  const totalPages = doc.getPageCount();
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    drawFooter(pages[i], i + 1, totalPages);
  }

  const pdfBytes = await doc.save();
  const base64 = Buffer.from(pdfBytes).toString('base64');
  return `data:application/pdf;base64,${base64}`;
}
