import { jsPDF } from "jspdf";
import { CARLITO_REGULAR_BASE64, CARLITO_BOLD_BASE64 } from "../fonts/carlito.js";

const MARGIN = 36;
const PADDING = 12;
const LINE_HEIGHT = 13;
const HEADER_HEIGHT = 96;
const CARD_RADIUS = 8;

const BADGE_R = 9;
const INDENT = BADGE_R * 2 + 8; // spazio riservato al numero prima del testo

const OPTION_ROW_H = 19;
const OPTION_NOTE_H = 10;
const OPEN_LINE_H = 19;
const PHOTO_BOX_H = 38;
const PHOTO_AREA_H = PHOTO_BOX_H + 12;

const CORAL = [232, 98, 63];
const CORAL_DARK = [188, 74, 46];
const CREAM = [250, 244, 233];
const TEXT = [45, 40, 35];
const MUTED = [130, 122, 110];
const WHITE = [255, 255, 255];
const LIGHT_ON_CORAL = [252, 228, 218];

function useCarlito(doc) {
  // Il VFS/i font sono per-istanza: vanno registrati su ogni nuovo documento.
  doc.addFileToVFS("Carlito-Regular.ttf", CARLITO_REGULAR_BASE64);
  doc.addFont("Carlito-Regular.ttf", "Carlito", "normal");
  doc.addFileToVFS("Carlito-Bold.ttf", CARLITO_BOLD_BASE64);
  doc.addFont("Carlito-Bold.ttf", "Carlito", "bold");
  doc.setFont("Carlito", "normal");
}

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

function drawIndexBadge(doc, cx, cy, number) {
  doc.setFillColor(...CORAL);
  doc.circle(cx, cy, BADGE_R, "F");
  doc.setFont("Carlito", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...WHITE);
  const label = String(number);
  const textW = doc.getTextWidth(label);
  doc.text(label, cx - textW / 2, cy + 3);
}

function drawHeaderBand(doc, { pageWidth, contentWidth, title, subtitleLines }) {
  doc.setFillColor(...CORAL);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, "F");
  doc.setFillColor(...CORAL_DARK);
  doc.rect(0, HEADER_HEIGHT, pageWidth, 4, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("Carlito", "bold");
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(title || "Questionario", contentWidth).slice(0, 2);
  doc.text(titleLines, MARGIN, 32);

  doc.setFont("Carlito", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...LIGHT_ON_CORAL);
  let infoY = 32 + titleLines.length * 17 + 10;
  subtitleLines.forEach((line) => {
    doc.text(line, MARGIN, infoY);
    infoY += 13;
  });

  return HEADER_HEIGHT + 4;
}

function makePaginator(doc, { pageWidth, pageHeight, title, startY }) {
  const state = { y: startY, page: 1 };

  function drawContinuationHeader() {
    doc.setTextColor(...CORAL_DARK);
    doc.setFont("Carlito", "bold");
    doc.setFontSize(10.5);
    doc.text(title || "Questionario", MARGIN, MARGIN);
    doc.setDrawColor(...CORAL);
    doc.setLineWidth(1.2);
    doc.line(MARGIN, MARGIN + 8, pageWidth - MARGIN, MARGIN + 8);
  }

  function newPage() {
    doc.addPage();
    state.page += 1;
    drawContinuationHeader();
    state.y = MARGIN + 26;
  }

  function ensureSpace(needed) {
    if (state.y + needed > pageHeight - 44) {
      newPage();
    }
  }

  return { state, ensureSpace };
}

function drawFooters(doc, pageWidth, pageHeight) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("Carlito", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Generato con Quiz e Domande", MARGIN, pageHeight - 20);
    doc.text(`Pagina ${p} di ${pageCount}`, pageWidth - MARGIN, pageHeight - 20, { align: "right" });
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
  useCarlito(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const textWidth = contentWidth - PADDING * 2 - INDENT;

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
    startY: headerBottom + 22,
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    doc.setFont("Carlito", "bold");
    doc.setFontSize(10.5);
    const qLines = doc.splitTextToSize(item.questionText, textWidth);
    const qBlockHeight = qLines.length * LINE_HEIGHT;

    let answerLines = [];
    let imgMeta = null;
    if (item.photoUrl) {
      try {
        imgMeta = await fetchImageAsDataUrl(item.photoUrl);
      } catch {
        doc.setFontSize(9.5);
        answerLines = doc.splitTextToSize(`Foto allegata: ${item.photoUrl}`, textWidth);
      }
    } else {
      doc.setFont("Carlito", "normal");
      doc.setFontSize(9.5);
      answerLines = doc.splitTextToSize(item.answerText || "(nessuna risposta)", textWidth);
    }

    let imgWidth = 0;
    let imgHeight = 0;
    if (imgMeta) {
      imgWidth = Math.min(textWidth, 200);
      imgHeight = imgMeta.height * (imgWidth / imgMeta.width);
    }

    const answerBlockHeight = imgMeta ? imgHeight : answerLines.length * (LINE_HEIGHT - 1);
    const cardHeight = PADDING * 2 + Math.max(qBlockHeight, BADGE_R * 2) + 8 + answerBlockHeight;

    paginator.ensureSpace(cardHeight + 12);
    const y = paginator.state.y;

    doc.setFillColor(...CREAM);
    doc.roundedRect(MARGIN, y, contentWidth, cardHeight, CARD_RADIUS, CARD_RADIUS, "F");
    drawIndexBadge(doc, MARGIN + PADDING + BADGE_R, y + PADDING + BADGE_R, i + 1);

    let cursorY = y + PADDING + 9;
    doc.setFont("Carlito", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...TEXT);
    doc.text(qLines, MARGIN + PADDING + INDENT, cursorY);
    cursorY += qBlockHeight + 8;

    if (imgMeta) {
      doc.addImage(imgMeta.dataUrl, imgMeta.format, MARGIN + PADDING + INDENT, cursorY - 8, imgWidth, imgHeight);
    } else {
      doc.setFont("Carlito", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...MUTED);
      doc.text(answerLines, MARGIN + PADDING + INDENT, cursorY);
    }

    paginator.state.y = y + cardHeight + 12;
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
  useCarlito(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const textWidth = contentWidth - PADDING * 2 - INDENT;

  const subtitleLines = [];
  if (description) {
    doc.setFont("Carlito", "normal");
    doc.setFontSize(9.5);
    subtitleLines.push(...doc.splitTextToSize(description, contentWidth).slice(0, 2));
  }
  subtitleLines.push("Nome e cognome: __________________________   Matricola: _________");

  const headerBottom = drawHeaderBand(doc, { pageWidth, contentWidth, title, subtitleLines });
  const paginator = makePaginator(doc, { pageWidth, pageHeight, title, startY: headerBottom + 22 });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    doc.setFont("Carlito", "bold");
    doc.setFontSize(10.5);
    const reorderHint = q.type === "reorder" ? "  (scrivi l'ordine nelle caselle)" : "";
    const qLines = doc.splitTextToSize(
      `${q.text}${q.required ? "" : "  (facoltativa)"}${reorderHint}`,
      textWidth
    );
    const qBlockHeight = qLines.length * LINE_HEIGHT;

    const contentX = MARGIN + PADDING + INDENT;
    const contentW = contentWidth - PADDING - INDENT;

    let optionRows = [];
    let answerAreaHeight;
    if (q.type === "open") {
      answerAreaHeight = 3 * OPEN_LINE_H;
    } else if (q.type === "true_false") {
      optionRows = [{ label: "Vero" }, { label: "Falso" }].map((o) => ({ ...o, lines: [o.label] }));
      answerAreaHeight = optionRows.length * OPTION_ROW_H;
    } else if (q.type === "single_choice" || q.type === "multiple_choice" || q.type === "reorder") {
      const isReorderType = q.type === "reorder";
      const availLabelWidth = contentW - (isReorderType ? 26 : 16);
      doc.setFont("Carlito", "normal");
      doc.setFontSize(9.5);
      optionRows = (q.question_options || []).map((o) => ({
        label: o.text,
        lines: doc.splitTextToSize(o.text || "", availLabelWidth),
        note: o.note,
      }));
      answerAreaHeight = optionRows.reduce(
        (sum, o) => sum + OPTION_ROW_H + Math.max(0, o.lines.length - 1) * LINE_HEIGHT + (o.note ? OPTION_NOTE_H : 0),
        0
      );
    } else if (q.type === "photo") {
      answerAreaHeight = PHOTO_AREA_H;
    } else {
      answerAreaHeight = OPTION_ROW_H;
    }

    const cardHeight = PADDING * 2 + Math.max(qBlockHeight, BADGE_R * 2) + 10 + answerAreaHeight;
    paginator.ensureSpace(cardHeight + 12);
    const y = paginator.state.y;

    doc.setFillColor(...CREAM);
    doc.roundedRect(MARGIN, y, contentWidth, cardHeight, CARD_RADIUS, CARD_RADIUS, "F");
    drawIndexBadge(doc, MARGIN + PADDING + BADGE_R, y + PADDING + BADGE_R, i + 1);

    let cursorY = y + PADDING + 9;
    doc.setFont("Carlito", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...TEXT);
    doc.text(qLines, MARGIN + PADDING + INDENT, cursorY);
    cursorY += qBlockHeight + 10;

    if (q.type === "open") {
      doc.setDrawColor(...MUTED);
      doc.setLineWidth(0.6);
      for (let l = 0; l < 3; l++) {
        doc.line(contentX, cursorY, MARGIN + contentWidth - PADDING, cursorY);
        cursorY += OPEN_LINE_H;
      }
    } else if (q.type === "photo") {
      doc.setDrawColor(...MUTED);
      doc.setLineWidth(0.8);
      doc.roundedRect(contentX, cursorY, contentW, PHOTO_BOX_H, 6, 6, "S");
      doc.setFont("Carlito", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text("Spazio per allegare la foto", contentX + 8, cursorY + PHOTO_BOX_H / 2 + 3);
    } else {
      const isSingle = q.type === "single_choice";
      const isReorder = q.type === "reorder";
      optionRows.forEach((o) => {
        const boxX = contentX;
        const boxY = cursorY - 8;
        doc.setDrawColor(...MUTED);
        doc.setLineWidth(0.8);
        if (isReorder) {
          doc.rect(boxX, boxY, 18, 12, "S");
        } else if (isSingle) {
          doc.circle(boxX + 4.5, boxY + 4.5, 4.5, "S");
        } else {
          doc.rect(boxX, boxY, 9, 9, "S");
        }
        doc.setFont("Carlito", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...TEXT);
        const lines = o.lines || [o.label];
        doc.text(lines, boxX + (isReorder ? 26 : 16), cursorY);
        cursorY += OPTION_ROW_H + Math.max(0, lines.length - 1) * LINE_HEIGHT;
        if (o.note) {
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          doc.text(o.note, boxX + 16, cursorY - 9);
          cursorY += OPTION_NOTE_H;
        }
      });
    }

    paginator.state.y = y + cardHeight + 12;
  }

  drawFooters(doc, pageWidth, pageHeight);

  const safeTitle = (title || "questionario").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`${safeTitle}_vuoto.pdf`);
}

/**
 * questions: array di { type, text, required, correct_boolean, correct_answer_text,
 *   question_options: [{ text, note, is_correct, order_index }] } (opzioni gia' ordinate)
 */
export async function downloadAnswerKeyPdf({ title, description, questions }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  useCarlito(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const textWidth = contentWidth - PADDING * 2 - INDENT;

  const subtitleLines = [];
  if (description) {
    doc.setFont("Carlito", "normal");
    doc.setFontSize(9.5);
    subtitleLines.push(...doc.splitTextToSize(description, contentWidth).slice(0, 2));
  }
  subtitleLines.push("Chiave delle risposte — solo per l'amministratore");

  const headerBottom = drawHeaderBand(doc, { pageWidth, contentWidth, title, subtitleLines });
  const paginator = makePaginator(doc, { pageWidth, pageHeight, title, startY: headerBottom + 22 });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const options = q.question_options || [];

    doc.setFont("Carlito", "bold");
    doc.setFontSize(10.5);
    const qLines = doc.splitTextToSize(q.text, textWidth);
    const qBlockHeight = qLines.length * LINE_HEIGHT;

    const contentX = MARGIN + PADDING + INDENT;
    const contentW = contentWidth - PADDING - INDENT;

    let optionRows = [];
    let answerLines = [];
    let answerAreaHeight;

    if (q.type === "open") {
      doc.setFontSize(9.5);
      answerLines = doc.splitTextToSize(
        q.correct_answer_text || "(nessuna risposta di riferimento impostata)",
        textWidth
      );
      answerAreaHeight = answerLines.length * (LINE_HEIGHT - 1);
    } else if (q.type === "true_false") {
      const availLabelWidth = contentW - 16;
      doc.setFont("Carlito", "normal");
      doc.setFontSize(8);
      optionRows = [
        { label: "Vero", correct: q.correct_boolean === true, note: null },
        {
          label: "Falso",
          correct: q.correct_boolean === false,
          note: q.correct_boolean === false ? q.false_explanation : null,
        },
      ].map((o) => ({
        ...o,
        lines: [o.label],
        noteLines: o.note ? doc.splitTextToSize(o.note, availLabelWidth) : [],
      }));
      answerAreaHeight = optionRows.reduce(
        (sum, o) => sum + OPTION_ROW_H + (o.note ? OPTION_NOTE_H * o.noteLines.length : 0),
        0
      );
      if (q.correct_boolean !== true && q.correct_boolean !== false) {
        doc.setFontSize(9.5);
        answerLines = doc.splitTextToSize("(nessuna risposta corretta impostata)", textWidth);
        answerAreaHeight = answerLines.length * (LINE_HEIGHT - 1);
        optionRows = [];
      }
    } else if (q.type === "single_choice" || q.type === "multiple_choice") {
      const availLabelWidth = contentW - 16;
      doc.setFontSize(9.5);
      optionRows = options.map((o) => {
        // Il font usato per calcolare l'a-capo deve coincidere con quello di
        // disegno (le opzioni corrette sono in grassetto e piu' larghe).
        doc.setFont("Carlito", o.is_correct ? "bold" : "normal");
        const labelLines = doc.splitTextToSize(o.text || "", availLabelWidth);
        doc.setFont("Carlito", "normal");
        doc.setFontSize(8);
        const noteLines = o.note ? doc.splitTextToSize(o.note, availLabelWidth) : [];
        doc.setFontSize(9.5);
        return {
          label: o.text,
          lines: labelLines,
          note: o.note,
          noteLines,
          correct: o.is_correct,
        };
      });
      answerAreaHeight = optionRows.reduce(
        (sum, o) =>
          sum + OPTION_ROW_H + Math.max(0, o.lines.length - 1) * LINE_HEIGHT + (o.note ? OPTION_NOTE_H * o.noteLines.length : 0),
        0
      );
      if (!options.some((o) => o.is_correct)) {
        doc.setFontSize(9.5);
        answerLines = doc.splitTextToSize("(nessuna risposta corretta impostata)", textWidth);
        answerAreaHeight = answerLines.length * (LINE_HEIGHT - 1);
        optionRows = [];
      }
    } else if (q.type === "reorder") {
      const availLabelWidth = contentW - 18;
      doc.setFont("Carlito", "normal");
      doc.setFontSize(9.5);
      optionRows = options.map((o, idx) => ({
        label: o.text,
        lines: doc.splitTextToSize(o.text || "", availLabelWidth),
        order: idx + 1,
      }));
      answerAreaHeight = optionRows.reduce(
        (sum, o) => sum + OPTION_ROW_H + Math.max(0, o.lines.length - 1) * LINE_HEIGHT,
        0
      );
    } else if (q.type === "photo") {
      doc.setFontSize(9.5);
      answerLines = doc.splitTextToSize("Nessuna risposta esatta applicabile (domanda con foto).", textWidth);
      answerAreaHeight = answerLines.length * (LINE_HEIGHT - 1);
    } else {
      answerAreaHeight = OPTION_ROW_H;
    }

    const cardHeight = PADDING * 2 + Math.max(qBlockHeight, BADGE_R * 2) + 10 + answerAreaHeight;
    paginator.ensureSpace(cardHeight + 12);
    const y = paginator.state.y;

    doc.setFillColor(...CREAM);
    doc.roundedRect(MARGIN, y, contentWidth, cardHeight, CARD_RADIUS, CARD_RADIUS, "F");
    drawIndexBadge(doc, MARGIN + PADDING + BADGE_R, y + PADDING + BADGE_R, i + 1);

    let cursorY = y + PADDING + 9;
    doc.setFont("Carlito", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...TEXT);
    doc.text(qLines, MARGIN + PADDING + INDENT, cursorY);
    cursorY += qBlockHeight + 10;

    if (optionRows.length === 0) {
      doc.setFont("Carlito", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...MUTED);
      doc.text(answerLines, contentX, cursorY);
    } else if (q.type === "reorder") {
      optionRows.forEach((o) => {
        doc.setFillColor(...CORAL);
        doc.circle(contentX + 5, cursorY - 8 + 4.5, 5.5, "F");
        doc.setFont("Carlito", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...WHITE);
        const numLabel = String(o.order);
        const numW = doc.getTextWidth(numLabel);
        doc.text(numLabel, contentX + 5 - numW / 2, cursorY - 8 + 4.5 + 2.6);
        doc.setFont("Carlito", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...TEXT);
        const lines = o.lines || [o.label];
        doc.text(lines, contentX + 18, cursorY);
        cursorY += OPTION_ROW_H + Math.max(0, lines.length - 1) * LINE_HEIGHT;
      });
    } else {
      const isSingle = q.type === "single_choice" || q.type === "true_false";
      optionRows.forEach((o) => {
        const boxX = contentX;
        const boxY = cursorY - 8;
        if (o.correct) {
          doc.setFillColor(...CORAL);
          if (isSingle) {
            doc.circle(boxX + 4.5, boxY + 4.5, 4.5, "F");
          } else {
            doc.roundedRect(boxX, boxY, 9, 9, 2, 2, "F");
          }
        } else {
          doc.setDrawColor(...MUTED);
          doc.setLineWidth(0.8);
          if (isSingle) {
            doc.circle(boxX + 4.5, boxY + 4.5, 4.5, "S");
          } else {
            doc.rect(boxX, boxY, 9, 9, "S");
          }
        }
        doc.setFont("Carlito", o.correct ? "bold" : "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...(o.correct ? TEXT : MUTED));
        const lines = o.lines || [o.label];
        doc.text(lines, boxX + 16, cursorY);
        cursorY += OPTION_ROW_H + Math.max(0, lines.length - 1) * LINE_HEIGHT;
        if (o.note) {
          doc.setFont("Carlito", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          const noteLines = o.noteLines && o.noteLines.length > 0 ? o.noteLines : [o.note];
          doc.text(noteLines, boxX + 16, cursorY - 9);
          cursorY += OPTION_NOTE_H * noteLines.length;
        }
      });
    }

    paginator.state.y = y + cardHeight + 12;
  }

  drawFooters(doc, pageWidth, pageHeight);

  const safeTitle = (title || "questionario").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`${safeTitle}_chiave_risposte.pdf`);
}
