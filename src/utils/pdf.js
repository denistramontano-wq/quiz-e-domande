import { jsPDF } from "jspdf";

const MARGIN = 40;
const PADDING = 16;
const LINE_HEIGHT = 15;

const CORAL = [232, 98, 63];
const CORAL_DARK = [188, 74, 46];
const CREAM = [250, 244, 233];
const TEXT = [45, 40, 35];
const MUTED = [130, 122, 110];
const WHITE = [255, 255, 255];
const LIGHT_ON_CORAL = [252, 228, 218];

async function fetchImageAsDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Impossibile scaricare l'immagine");
  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const dims = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
  const format = blob.type.includes("png") ? "PNG" : "JPEG";
  return { dataUrl, format, ...dims };
}

/**
 * items: array of { questionText, answerText, photoUrl }
 */
export async function downloadResponsePdf({
  questionnaireTitle,
  respondentName,
  matricola,
  submittedAt,
  items,
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  const HEADER_HEIGHT = 118;
  let y = HEADER_HEIGHT + 34;
  let page = 1;

  function drawHeader() {
    doc.setFillColor(...CORAL);
    doc.rect(0, 0, pageWidth, HEADER_HEIGHT, "F");
    doc.setFillColor(...CORAL_DARK);
    doc.rect(0, HEADER_HEIGHT, pageWidth, 5, "F");

    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    const titleLines = doc.splitTextToSize(questionnaireTitle || "Questionario", contentWidth);
    doc.text(titleLines.slice(0, 2), MARGIN, 46);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...LIGHT_ON_CORAL);
    const infoY = 46 + Math.min(titleLines.length, 2) * 20 + 12;
    doc.text(
      `${respondentName}   •   Matricola ${matricola}   •   ${new Date(submittedAt).toLocaleString("it-IT")}`,
      MARGIN,
      infoY
    );
  }

  function drawContinuationHeader() {
    doc.setTextColor(...CORAL_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(questionnaireTitle || "Questionario", MARGIN, MARGIN);
    doc.setDrawColor(...CORAL);
    doc.setLineWidth(1.5);
    doc.line(MARGIN, MARGIN + 10, pageWidth - MARGIN, MARGIN + 10);
  }

  function newPage() {
    doc.addPage();
    page += 1;
    drawContinuationHeader();
    y = MARGIN + 34;
  }

  function ensureSpace(needed) {
    if (y + needed > pageHeight - 50) {
      newPage();
    }
  }

  drawHeader();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12.5);
    const qLines = doc.splitTextToSize(`${i + 1}. ${item.questionText}`, contentWidth - PADDING * 2);
    const qBlockHeight = qLines.length * LINE_HEIGHT;

    let answerLines = [];
    let imgMeta = null;
    if (item.photoUrl) {
      try {
        imgMeta = await fetchImageAsDataUrl(item.photoUrl);
      } catch {
        answerLines = doc.splitTextToSize(`Foto allegata: ${item.photoUrl}`, contentWidth - PADDING * 2);
      }
    } else {
      doc.setFontSize(11);
      answerLines = doc.splitTextToSize(item.answerText || "(nessuna risposta)", contentWidth - PADDING * 2);
    }

    let imgWidth = 0;
    let imgHeight = 0;
    if (imgMeta) {
      imgWidth = Math.min(contentWidth - PADDING * 2, 240);
      imgHeight = imgMeta.height * (imgWidth / imgMeta.width);
    }

    const answerBlockHeight = imgMeta ? imgHeight : answerLines.length * (LINE_HEIGHT - 1);
    const cardHeight = PADDING * 2 + qBlockHeight + 10 + answerBlockHeight;

    ensureSpace(cardHeight + 16);

    doc.setFillColor(...CREAM);
    doc.roundedRect(MARGIN, y, contentWidth, cardHeight, 10, 10, "F");

    let cursorY = y + PADDING + 11;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...TEXT);
    doc.text(qLines, MARGIN + PADDING, cursorY);
    cursorY += qBlockHeight + 10;

    if (imgMeta) {
      doc.addImage(imgMeta.dataUrl, imgMeta.format, MARGIN + PADDING, cursorY - 10, imgWidth, imgHeight);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...MUTED);
      doc.text(answerLines, MARGIN + PADDING, cursorY);
    }

    y += cardHeight + 16;
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Generato con Quiz e Domande", MARGIN, pageHeight - 24);
    doc.text(`Pagina ${p} di ${pageCount}`, pageWidth - MARGIN, pageHeight - 24, { align: "right" });
  }

  const safeTitle = (questionnaireTitle || "questionario").replace(/[^a-z0-9]+/gi, "_");
  const safeName = (respondentName || "utente").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`${safeTitle}_${safeName}.pdf`);
}
