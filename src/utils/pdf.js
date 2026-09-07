import { jsPDF } from "jspdf";

const MARGIN = 40;
const LINE_HEIGHT = 16;

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
 * items: array of { questionText, typeLabel, answerText, photoUrl }
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

  let y = MARGIN;

  function ensureSpace(needed) {
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function writeParagraph(text, { size = 11, style = "normal", gapAfter = 8 } = {}) {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text || "", contentWidth);
    const needed = lines.length * LINE_HEIGHT + gapAfter;
    ensureSpace(needed);
    doc.text(lines, MARGIN, y + LINE_HEIGHT - 4);
    y += lines.length * LINE_HEIGHT + gapAfter;
  }

  writeParagraph(questionnaireTitle, { size: 18, style: "bold", gapAfter: 14 });
  writeParagraph(`Nome e cognome: ${respondentName}`, { size: 11, gapAfter: 2 });
  writeParagraph(`Matricola: ${matricola}`, { size: 11, gapAfter: 2 });
  writeParagraph(`Inviato il: ${new Date(submittedAt).toLocaleString("it-IT")}`, {
    size: 11,
    gapAfter: 14,
  });

  ensureSpace(4);
  doc.setDrawColor(200);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 18;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    writeParagraph(`${i + 1}. ${item.questionText}`, { size: 12, style: "bold", gapAfter: 4 });

    if (item.photoUrl) {
      try {
        const img = await fetchImageAsDataUrl(item.photoUrl);
        const maxImgWidth = Math.min(contentWidth, 260);
        const scale = maxImgWidth / img.width;
        const imgWidth = maxImgWidth;
        const imgHeight = img.height * scale;
        ensureSpace(imgHeight + 12);
        doc.addImage(img.dataUrl, img.format, MARGIN, y, imgWidth, imgHeight);
        y += imgHeight + 14;
      } catch {
        writeParagraph(`Foto allegata: ${item.photoUrl}`, { size: 10, gapAfter: 14 });
      }
    } else {
      writeParagraph(item.answerText || "(nessuna risposta)", { size: 11, gapAfter: 14 });
    }
  }

  const safeTitle = (questionnaireTitle || "questionario").replace(/[^a-z0-9]+/gi, "_");
  const safeName = (respondentName || "utente").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`${safeTitle}_${safeName}.pdf`);
}
