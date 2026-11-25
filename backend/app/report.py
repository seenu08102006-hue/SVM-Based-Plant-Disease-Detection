"""PDF report generation with ReportLab."""
from __future__ import annotations

import io
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (Image, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

GREEN, DARK = colors.HexColor("#15803d"), colors.HexColor("#14532d")


def build_pdf(pred, image_path: Path) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                            bottomMargin=16 * mm, title="Plant Disease Report")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], textColor=DARK, fontSize=22, alignment=0)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=GREEN, spaceBefore=12)
    body = ss["BodyText"]
    muted = ParagraphStyle("muted", parent=body, textColor=colors.grey)

    story = [Paragraph("Plant Disease Detection Report", h1),
             Paragraph(f"AI Plant Doctor (Support Vector Machine) &middot; {pred.created_at:%Y-%m-%d %H:%M} UTC"
                       f" &middot; ID {pred.id[:8]}", muted), Spacer(1, 8)]
    if image_path.exists():
        img = Image(str(image_path))
        ratio = img.imageHeight / img.imageWidth
        img.drawWidth, img.drawHeight = 70 * mm, 70 * mm * ratio
        if img.drawHeight > 80 * mm:
            img.drawHeight, img.drawWidth = 80 * mm, 80 * mm / ratio
        img.hAlign = "LEFT"
        story += [img, Spacer(1, 8)]

    t = Table([["Crop", pred.plant], ["Disease detected", pred.disease], ["Health status", pred.status],
               ["Confidence", f"{pred.confidence * 100:.1f}%"]], colWidths=[42 * mm, 120 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#dcfce7")),
                           ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#bbf7d0")),
                           ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("PADDING", (0, 0), (-1, -1), 6)]))
    story.append(t)
    verdict = getattr(pred, "verdict", None) or "confident"
    if pred.crop_hint:
        story.append(Paragraph(f"Crop selected by the user: <b>{escape(pred.crop_hint)}</b>", muted))
    for note in (pred.notes or []):
        colour = "#b91c1c" if verdict == "unrecognised" else "#92400e"
        story.append(Spacer(1, 4))
        story.append(Paragraph(f'<font color="{colour}">{escape(note)}</font>', body))

    def bullets(title, items):
        story.append(Paragraph(title, h2))
        story.append(ListFlowable([ListItem(Paragraph(escape(i), body)) for i in items],
                                  bulletType="bullet", leftIndent=14))

    story += [Paragraph("About this condition", h2), Paragraph(escape(pred.description), body)]
    bullets("Recommended treatment", pred.treatment)
    bullets("Prevention steps", pred.prevention)
    if pred.top_predictions and len(pred.top_predictions) > 1:
        story.append(Paragraph("Other possibilities considered", h2))
        story.append(Paragraph(escape("; ".join(f"{p['plant']} - {p['disease']} ({p['confidence']:.1f}%)"
                                                for p in pred.top_predictions[1:])), body))
    story += [Spacer(1, 14), Paragraph(
        "Disclaimer: this automated result comes from a Support Vector Machine trained on PlantVillage lab images. "
        "Use it as guidance only and confirm with a local agronomist before applying any chemical treatment.",
        ParagraphStyle("d", parent=muted, fontSize=8))]
    doc.build(story)
    return buf.getvalue()
