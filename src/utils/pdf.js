import { jsPDF } from "jspdf";

const MARGIN = 40;
const PADDING = 16;
const LINE_HEIGHT = 15;
const HEADER_HEIGHT = 118;

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

function drawHeaderBand(doc, { pageWidth, contentWidth, title, subtitleLines }) {
  doc.setFillColor(...CORAL);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, "F");
  doc.setFillColor(...CORAL_DARK);
  doc.rect(0, HEADER_HEIGHT, pageWidth, 5, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(title || "Questionario", contentWidth).slice(0, 2);
  doc.text(titleLines, MARGIN, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...LIGHT_ON_CORAL);
  let infoY = 46 + titleLines.length * 20 + 12;
  subtitleLines.forEach((line) => {
    doc.text(line, MARGIN, infoY);
    infoY += 16;
  });

  return HEADER_HEIGHT + 5;
}

function makePaginator(doc, { pageWidth, pageHeight, title, startY }) {
  const state = { y: startY, page: 1 };

  function drawContinuationHeader() {
    doc.setTextColor(...CORAL_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title || "Questionario", MARGIN, MARGIN);
    doc.setDrawColor(...CORAL);
    doc.setLineWidth(1.5);
    doc.line(MARGIN, MARGIN + 10, pageWidth - MARGIN, MARGIN + 10);
  }

  function newPage() {
    doc.addPage();
    state.page += 1;
    drawContinuationHeader();
    state.y = MARGIN + 34;
  }

  function ensureSpace(needed) {
    if (state.y + needed > pageHeight - 50) {
      newPage();
    }
  }

  return { state, ensureSpace };
}

function drawFooters(doc, pageWidth, pageHeight) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Generato con Quiz e Domande", MARGIN, pageHeight - 24);
    doc.text(`Pagina ${p} di ${pageCount}`, pageWidth - MARGIN, pageHeight - 24, { align: "right" });
  }
}

/**
 * items: array di { questionText, answerText, photoUrl }
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

  const subtitleLine = `${respondentName}   •   Matricola ${matricola}   •   ${new Date(submittedAt).toLocaleString("it-IT")}`;
  const headerBottom = drawHeaderBand(doc, {
    pageWidth,
    contentWidth,
    title: questionnaireTitle,
    subtitleLines: [subtitleLine],
  });
  const paginator = makePaginator(doc, {
    pageWidth,
    pageHeight,
    title: questionnaireTitle,
    startY: headerBottom + 29,
  });

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

    paginator.ensureSpace(cardHeight + 16);
    const y = paginator.state.y;

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

    paginator.state.y = y + cardHeight + 16;
  }

  drawFooters(doc, pageWidth, pageHeight);

  const safeTitle = (questionnaireTitle || "questionario").replace(/[^a-z0-9]+/gi, "_");
  const safeName = (respondentName || "utente").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`${safeTitle}_${safeName}.pdf`);
}

/**
 * questions: array di { type, text, required, question_options: [{ text, note }] }
 */
export async function downloadBlankQuestionnairePdf({ title, description, questions }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  const subtitleLines = [];
  if (description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    subtitleLines.push(...doc.splitTextToSize(description, contentWidth).slice(0, 2));
  }
  subtitleLines.push("Nome e cognome: __________________________   Matricola: _________");

  const headerBottom = drawHeaderBand(doc, { pageWidth, contentWidth, title, subtitleLines });
  const paginator = makePaginator(doc, { pageWidth, pageHeight, title, startY: headerBottom + 29 });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    const reorderHint = q.type === "reorder" ? "  (scrivi l'ordine nelle caselle)" : "";
    const qLines = doc.splitTextToSize(
      `${i + 1}. ${q.text}${q.required ? "" : "  (facoltativa)"}${reorderHint}`,
      contentWidth - PADDING * 2
    );
    const qBlockHeight = qLines.length * LINE_HEIGHT;

    let optionRows = [];
    let answerAreaHeight;
    if (q.type === "open") {
      answerAreaHeight = 3 * 22;
    } else if (q.type === "true_false") {
      optionRows = [{ label: "Vero" }, { label: "Falso" }];
      answerAreaHeight = optionRows.length * 22;
    } else if (q.type === "single_choice" || q.type === "multiple_choice" || q.type === "reorder") {
      optionRows = (q.question_options || []).map((o) => ({ label: o.text, note: o.note }));
      answerAreaHeight = optionRows.reduce((sum, o) => sum + 22 + (o.note ? 12 : 0), 0);
    } else if (q.type === "photo") {
      answerAreaHeight = 60;
    } else {
      answerAreaHeight = 22;
    }

    const cardHeight = PADDING * 2 + qBlockHeight + 14 + answerAreaHeight;
    paginator.ensureSpace(cardHeight + 16);
    const y = paginator.state.y;

    doc.setFillColor(...CREAM);
    doc.roundedRect(MARGIN, y, contentWidth, cardHeight, 10, 10, "F");

    let cursorY = y + PADDING + 11;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...TEXT);
    doc.text(qLines, MARGIN + PADDING, cursorY);
    cursorY += qBlockHeight + 14;

    if (q.type === "open") {
      doc.setDrawColor(...MUTED);
      doc.setLineWidth(0.75);
      for (let l = 0; l < 3; l++) {
        doc.line(MARGIN + PADDING, cursorY, MARGIN + contentWidth - PADDING, cursorY);
        cursorY += 22;
      }
    } else if (q.type === "photo") {
      doc.setDrawColor(...MUTED);
      doc.setLineWidth(1);
      doc.roundedRect(MARGIN + PADDING, cursorY, contentWidth - PADDING * 2, 46, 6, 6, "S");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      doc.text("Spazio per allegare la foto", MARGIN + PADDING + 10, cursorY + 27);
    } else {
      const isSingle = q.type === "single_choice";
      const isReorder = q.type === "reorder";
      optionRows.forEach((o) => {
        const boxX = MARGIN + PADDING;
        const boxY = cursorY - 9;
        doc.setDrawColor(...MUTED);
        doc.setLineWidth(1);
        if (isReorder) {
          doc.rect(boxX, boxY, 20, 14, "S");
        } else if (isSingle) {
          doc.circle(boxX + 5, boxY + 5, 5, "S");
        } else {
          doc.rect(boxX, boxY, 10, 10, "S");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(...TEXT);
        doc.text(o.label, boxX + (isReorder ? 30 : 18), cursorY);
        cursorY += 22;
        if (o.note) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(9);
          doc.setTextColor(...MUTED);
          doc.text(o.note, boxX + 18, cursorY - 10);
          cursorY += 12;
        }
      });
    }

    paginator.state.y = y + cardHeight + 16;
  }

  drawFooters(doc, pageWidth, pageHeight);

  const safeTitle = (title || "questionario").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`${safeTitle}_vuoto.pdf`);
}
