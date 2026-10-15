"""Shared A4 typography, identity and page furniture for private PDFs."""

from pathlib import Path
from xml.sax.saxutils import escape

import reportlab
from PIL import Image as PillowImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate

from . import pdf_branding as brand

LOGO_PATH = Path(__file__).resolve().parents[1] / "apps/billing/static/billing/dr-nait-logo.jpg"
TEAL = colors.HexColor("#087f76")
INK = colors.HexColor("#263339")
MUTED = colors.HexColor("#647279")
SURFACE = colors.HexColor("#eef6f5")
BORDER = colors.HexColor("#dbe7e5")
MARGIN = 20 * mm
WIDTH = A4[0] - 2 * MARGIN


def text(value):
    return escape(str(value)).replace("\n", "<br/>")


def styles():
    fonts = Path(reportlab.__file__).parent / "fonts"
    for name, filename in (("Cabinet", "Vera.ttf"), ("CabinetBold", "VeraBd.ttf")):
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(name, str(fonts / filename)))
    pdfmetrics.registerFontFamily("Cabinet", normal="Cabinet", bold="CabinetBold")
    normal = ParagraphStyle(
        "Body",
        fontName="Cabinet",
        fontSize=10,
        leading=14,
        spaceAfter=4,
        textColor=INK,
        splitLongWords=True,
    )
    return {
        "body": normal,
        "amount": ParagraphStyle(
            "Amount", parent=normal, alignment=TA_RIGHT, fontSize=8.5, leading=13
        ),
        "total": ParagraphStyle(
            "Total", parent=normal, fontName="CabinetBold", fontSize=12, leading=17, textColor=TEAL
        ),
        "total_amount": ParagraphStyle(
            "TotalAmount",
            parent=normal,
            fontName="CabinetBold",
            fontSize=12,
            leading=17,
            textColor=TEAL,
            alignment=TA_RIGHT,
        ),
        "heading": ParagraphStyle(
            "Heading",
            parent=normal,
            fontName="CabinetBold",
            fontSize=11,
            leading=16,
            spaceBefore=10,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "title": ParagraphStyle(
            "Title",
            parent=normal,
            fontName="CabinetBold",
            fontSize=20,
            leading=26,
            alignment=TA_CENTER,
            textColor=TEAL,
            spaceAfter=18,
        ),
        "muted": ParagraphStyle("Muted", parent=normal, fontSize=8, leading=11, textColor=MUTED),
    }


def document(stream, title):
    return SimpleDocTemplate(
        stream,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=49 * mm,
        bottomMargin=29 * mm,
        title=title,
        author=brand.NAME,
        invariant=1,
    )


def page_furniture(reference):
    def draw(canvas, doc):
        canvas.saveState()
        if LOGO_PATH.is_file():
            with PillowImage.open(LOGO_PATH) as logo:
                width, height = logo.size
            scale = min(112 / width, 75 / height)
            canvas.drawImage(
                str(LOGO_PATH),
                MARGIN,
                A4[1] - 36 * mm,
                width=width * scale,
                height=height * scale,
                preserveAspectRatio=True,
            )
        right = A4[0] - MARGIN
        canvas.setFillColor(INK)
        canvas.setFont("CabinetBold", 13)
        canvas.drawRightString(right, A4[1] - 21 * mm, brand.NAME)
        canvas.setFont("Cabinet", 9.5)
        canvas.drawRightString(right, A4[1] - 28 * mm, brand.SPECIALTY)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(right, A4[1] - 35 * mm, f"Téléphone : {brand.PHONE}")
        canvas.setStrokeColor(TEAL)
        canvas.setLineWidth(0.7)
        canvas.line(MARGIN, A4[1] - 41 * mm, right, A4[1] - 41 * mm)
        canvas.line(MARGIN, 23 * mm, right, 23 * mm)
        canvas.setFont("Cabinet", 8)
        canvas.drawString(MARGIN, 17 * mm, f"{brand.NAME} - {brand.SPECIALTY}")
        canvas.drawString(MARGIN, 12 * mm, f"Tél. : {brand.PHONE}")
        canvas.drawRightString(right, 12 * mm, f"{reference} - Page {doc.page}")
        canvas.restoreState()

    return draw


def paragraph(value, style):
    return Paragraph(text(value), style)
