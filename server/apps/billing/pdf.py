from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from textwrap import wrap

from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from PIL import Image

from .models import MONEY_ZERO, Invoice

PAGE_WIDTH = 595.28
PAGE_HEIGHT = 841.89
MARGIN = 48.0
FOOTER_Y = 46.0
CONTENT_BOTTOM = 92.0

TEXT = (0.13, 0.17, 0.18)
MUTED = (0.42, 0.47, 0.55)
TEAL = (0.02, 0.48, 0.44)
TEAL_LIGHT = (0.89, 0.96, 0.95)
SURFACE = (0.96, 0.97, 0.98)
BORDER = (0.86, 0.89, 0.90)
WHITE = (1.0, 1.0, 1.0)

LOGO_PATH = Path(__file__).resolve().parent / "static" / "billing" / "dr-nait-logo.jpg"

STATUS_LABELS = {
    Invoice.Status.DRAFT: "Brouillon",
    Invoice.Status.ISSUED: "Émise",
    Invoice.Status.PARTIALLY_PAID: "Partiellement payée",
    Invoice.Status.PAID: "Payée",
    Invoice.Status.CANCELLED: "Annulée",
}


def format_dzd(value: Decimal, currency: str = "DZD") -> str:
    quantized = value.quantize(Decimal("0.01"))
    major, minor = f"{quantized:.2f}".split(".")
    sign = ""
    if major.startswith("-"):
        sign = "-"
        major = major[1:]
    groups = []
    while major:
        groups.append(major[-3:])
        major = major[:-3]
    grouped = " ".join(reversed(groups)) or "0"
    return f"{sign}{grouped},{minor} {currency}"


def _date(value) -> str:
    if not value:
        return "Non renseignée"
    return value.strftime("%d/%m/%Y")


def _pdf_string(value: object) -> str:
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _width(text: object, size: float, bold: bool = False) -> float:
    factor = 0.56 if bold else 0.52
    total = 0.0
    for char in str(text):
        if char == " ":
            total += size * 0.28
        elif char in "ilI.,:;!|":
            total += size * 0.26
        elif char in "MW@#":
            total += size * 0.82
        else:
            total += size * factor
    return total


def _wrap_text(text: object, width: float, size: float) -> list[str]:
    normalized = " ".join(str(text).split())
    if not normalized:
        return [""]
    max_chars = max(12, int(width / (size * 0.49)))
    return wrap(normalized, width=max_chars, break_long_words=False) or [normalized]


def _rgb(color: tuple[float, float, float]) -> str:
    return f"{color[0]:.3f} {color[1]:.3f} {color[2]:.3f}"


def _line_width(value: float) -> str:
    return f"{value:.2f} w"


@dataclass
class _Logo:
    data: bytes
    width: int
    height: int


@dataclass
class _Page:
    operations: list[str] = field(default_factory=list)


class _InvoicePdfBuilder:
    def __init__(self, invoice: Invoice):
        self.invoice = invoice
        self.invoice_number = invoice.invoice_number or "Brouillon"
        self.logo = self._load_logo()
        self.pages: list[_Page] = []
        self.page = _Page()
        self.y = PAGE_HEIGHT - MARGIN

    def render(self) -> bytes:
        self._draw_first_page_header()
        self._draw_information()
        self._draw_table_title()
        self._draw_table_header()
        self._draw_items()
        self._draw_summary_area()
        self._finish_page()
        return self._serialize()

    def _load_logo(self) -> _Logo | None:
        if not LOGO_PATH.exists():
            return None
        with Image.open(LOGO_PATH) as image:
            width, height = image.size
        return _Logo(LOGO_PATH.read_bytes(), width, height)

    def _finish_page(self) -> None:
        if self.page.operations:
            self.pages.append(self.page)

    def _new_page(self) -> None:
        self._finish_page()
        self.page = _Page()
        self.y = PAGE_HEIGHT - MARGIN
        self._draw_continuation_header()
        self._draw_table_header()

    def _op(self, operation: str) -> None:
        self.page.operations.append(operation)

    def _fill_rect(
        self,
        x: float,
        y: float,
        width: float,
        height: float,
        color: tuple[float, float, float],
    ) -> None:
        self._op(f"{_rgb(color)} rg {x:.2f} {y:.2f} {width:.2f} {height:.2f} re f")

    def _stroke_rect(
        self,
        x: float,
        y: float,
        width: float,
        height: float,
        color: tuple[float, float, float] = BORDER,
        line_width: float = 0.8,
    ) -> None:
        self._op(
            f"{_line_width(line_width)} {_rgb(color)} RG "
            f"{x:.2f} {y:.2f} {width:.2f} {height:.2f} re S"
        )

    def _line(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        color: tuple[float, float, float] = BORDER,
        line_width: float = 0.8,
    ) -> None:
        self._op(
            f"{_line_width(line_width)} {_rgb(color)} RG "
            f"{x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S"
        )

    def _text(
        self,
        x: float,
        y: float,
        text: object,
        size: float = 10.0,
        color: tuple[float, float, float] = TEXT,
        bold: bool = False,
    ) -> None:
        font = "F2" if bold else "F1"
        self._op(
            f"BT /{font} {size:.2f} Tf {_rgb(color)} rg "
            f"1 0 0 1 {x:.2f} {y:.2f} Tm ({_pdf_string(text)}) Tj ET"
        )

    def _text_right(
        self,
        right: float,
        y: float,
        text: object,
        size: float = 10.0,
        color: tuple[float, float, float] = TEXT,
        bold: bool = False,
    ) -> None:
        self._text(right - _width(text, size, bold), y, text, size, color, bold)

    def _image(self, x: float, y: float, width: float, height: float) -> None:
        if not self.logo:
            return
        self._op(f"q {width:.2f} 0 0 {height:.2f} {x:.2f} {y:.2f} cm /Logo Do Q")

    def _status_label(self) -> str:
        return STATUS_LABELS.get(self.invoice.status, self.invoice.get_status_display())

    def _draw_first_page_header(self) -> None:
        self._fill_rect(0, PAGE_HEIGHT - 6, PAGE_WIDTH, 6, TEAL)
        if self.logo:
            logo_width = 152.0
            logo_height = logo_width * self.logo.height / self.logo.width
            self._image(MARGIN, PAGE_HEIGHT - MARGIN - logo_height + 8, logo_width, logo_height)
        else:
            self._text(MARGIN, PAGE_HEIGHT - 92, "Cabinet Dr Nait Abdesselam Gaya", 16, TEXT, True)
            self._text(MARGIN, PAGE_HEIGHT - 112, "Chirurgie plastique et esthétique", 10, MUTED)

        right = PAGE_WIDTH - MARGIN
        self._text_right(right, PAGE_HEIGHT - 82, "FACTURE", 28, TEXT, True)
        self._text_right(right, PAGE_HEIGHT - 108, self.invoice_number, 13, MUTED)
        badge = self._status_label()
        badge_width = max(92.0, _width(badge, 10.0, True) + 28)
        badge_x = right - badge_width
        self._fill_rect(badge_x, PAGE_HEIGHT - 142, badge_width, 28, TEAL_LIGHT)
        self._stroke_rect(badge_x, PAGE_HEIGHT - 142, badge_width, 28, (0.78, 0.90, 0.88), 0.5)
        self._text_right(right - 14, PAGE_HEIGHT - 132, badge, 10, TEAL, True)
        self._line(MARGIN, PAGE_HEIGHT - 206, right, PAGE_HEIGHT - 206, TEAL, 1.0)
        self.y = PAGE_HEIGHT - 238

    def _draw_continuation_header(self) -> None:
        self._text(MARGIN, self.y, "FACTURE", 15, TEXT, True)
        self._text(MARGIN + 78, self.y, self.invoice_number, 11, MUTED)
        self._text_right(PAGE_WIDTH - MARGIN, self.y, self._status_label(), 10, TEAL, True)
        self._line(MARGIN, self.y - 15, PAGE_WIDTH - MARGIN, self.y - 15, TEAL, 0.8)
        self.y -= 45

    def _draw_information(self) -> None:
        card_height = 86.0
        card_y = self.y - card_height
        right = PAGE_WIDTH - MARGIN
        patient_name = f"{self.invoice.patient.first_name} {self.invoice.patient.last_name}".strip() or "Patient"
        self._fill_rect(MARGIN, card_y, right - MARGIN, card_height, SURFACE)
        self._stroke_rect(MARGIN, card_y, right - MARGIN, card_height, BORDER, 0.5)
        self._text(MARGIN + 18, card_y + card_height - 30, "FACTURÉ À", 9, MUTED, True)
        self._text(MARGIN + 18, card_y + card_height - 58, patient_name, 14, TEXT, True)

        info_x = MARGIN + 305
        value_right = right - 18
        self._text(info_x, card_y + card_height - 30, "INFORMATIONS", 9, MUTED, True)
        rows = [
            ("Date", _date(self.invoice.issue_date)),
            ("Échéance", _date(self.invoice.due_date)),
            ("Numéro", self.invoice_number),
        ]
        row_y = card_y + card_height - 49
        for label, value in rows:
            self._text(info_x, row_y, label, 9, MUTED)
            self._text_right(value_right, row_y, value, 9, TEXT, label == "Statut")
            row_y -= 16
        self.y = card_y - 44

    def _draw_table_title(self) -> None:
        self._text(MARGIN, self.y, "Prestations", 17, TEXT, True)
        self.y -= 34

    def _draw_table_header(self) -> None:
        header_height = 28.0
        self._fill_rect(MARGIN, self.y - header_height + 8, PAGE_WIDTH - 2 * MARGIN, header_height, TEAL_LIGHT)
        self._stroke_rect(MARGIN, self.y - header_height + 8, PAGE_WIDTH - 2 * MARGIN, header_height, (0.78, 0.90, 0.88), 0.5)
        self._text(MARGIN + 12, self.y - 10, "DESCRIPTION", 8.5, TEAL, True)
        self._text_right(292, self.y - 10, "QTÉ", 8.5, TEAL, True)
        self._text_right(390, self.y - 10, "PRIX UNIT.", 8.5, TEAL, True)
        self._text_right(456, self.y - 10, "REMISE", 8.5, TEAL, True)
        self._text_right(PAGE_WIDTH - MARGIN - 12, self.y - 10, "TOTAL", 8.5, TEAL, True)
        self.y -= 36

    def _draw_items(self) -> None:
        for item in self.invoice.items.all():
            description_lines = _wrap_text(item.description, 190, 10)
            row_height = max(32.0, 16.0 + len(description_lines) * 13.0)
            if self.y - row_height < CONTENT_BOTTOM:
                self._new_page()
            baseline = self.y - 14
            for offset, line in enumerate(description_lines):
                self._text(MARGIN + 12, baseline - (offset * 13), line, 9.5, TEXT)
            self._text_right(292, baseline, f"{item.quantity:.2f}".replace(".", ","), 9.0, TEXT)
            self._text_right(390, baseline, format_dzd(item.unit_price, self.invoice.currency), 9.0, TEXT)
            self._text_right(456, baseline, format_dzd(item.discount_amount, self.invoice.currency), 9.0, TEXT)
            self._text_right(
                PAGE_WIDTH - MARGIN - 12,
                baseline,
                format_dzd(item.net_amount, self.invoice.currency),
                9.0,
                TEXT,
            )
            self._line(MARGIN, self.y - row_height + 4, PAGE_WIDTH - MARGIN, self.y - row_height + 4, BORDER, 0.5)
            self.y -= row_height

    def _draw_summary_area(self) -> None:
        payments = list(
            self.invoice.allocations.filter(payment__status="COMPLETED")
            .select_related("payment", "payment__receipt")
            .order_by("payment__paid_at", "created_at")
        )
        payment_height = 0 if not payments else 44 + (len(payments) * 42)
        summary_height = 152
        needed = max(payment_height, summary_height) + 28
        if self.y - needed < CONTENT_BOTTOM:
            self._finish_page()
            self.page = _Page()
            self.y = PAGE_HEIGHT - MARGIN
            self._draw_continuation_header()

        start_y = self.y - 28
        if payments:
            self._text(MARGIN, start_y, "Paiements", 15, TEXT, True)
            pay_y = start_y - 34
            for allocation in payments:
                payment = allocation.payment
                self._fill_rect(MARGIN, pay_y - 22, 235, 34, SURFACE)
                self._text(MARGIN + 12, pay_y, payment.payment_number or "Paiement", 10, TEXT, True)
                self._text(MARGIN + 12, pay_y - 15, timezone.localtime(payment.paid_at).strftime("%d/%m/%Y"), 9, MUTED)
                self._text_right(MARGIN + 220, pay_y - 10, format_dzd(allocation.amount, self.invoice.currency), 10, TEAL, True)
                try:
                    receipt_number = payment.receipt.receipt_number
                except ObjectDoesNotExist:
                    receipt_number = ""
                if receipt_number:
                    self._text(MARGIN + 12, pay_y - 30, f"Reçu {receipt_number}", 8, MUTED)
                pay_y -= 42

        self._draw_totals(start_y)
        self.y = start_y - max(payment_height, summary_height) - 20

    def _draw_totals(self, start_y: float) -> None:
        x = 338.0
        value_right = PAGE_WIDTH - MARGIN
        row_y = start_y
        rows = [
            ("Sous-total", format_dzd(self.invoice.subtotal, self.invoice.currency), False),
            ("Remise", format_dzd(self.invoice.discount_total, self.invoice.currency), False),
        ]
        for label, value, bold in rows:
            self._text(x, row_y, label, 11, MUTED)
            self._text_right(value_right, row_y, value, 11, TEXT, bold)
            row_y -= 28
        self._line(x, row_y + 11, value_right, row_y + 11, BORDER, 0.6)
        self._text(x, row_y, "Total", 12, TEXT, True)
        self._text_right(value_right, row_y, format_dzd(self.invoice.total, self.invoice.currency), 12, TEXT, True)
        row_y -= 30
        self._text(x, row_y, "Déjà payé", 11, MUTED)
        self._text_right(value_right, row_y, format_dzd(self.invoice.paid_amount, self.invoice.currency), 11, TEXT)
        row_y -= 54

        self._fill_rect(x, row_y - 18, value_right - x, 48, TEAL_LIGHT)
        self._stroke_rect(x, row_y - 18, value_right - x, 48, (0.78, 0.90, 0.88), 0.5)
        if self.invoice.remaining_amount > MONEY_ZERO:
            self._text(x + 14, row_y + 10, "SOLDE À PAYER", 9, TEAL, True)
            self._text_right(
                value_right - 14,
                row_y - 6,
                format_dzd(self.invoice.remaining_amount, self.invoice.currency),
                18,
                TEAL,
                True,
            )
        else:
            self._text(x + 14, row_y, "FACTURE PAYÉE", 12, TEAL, True)

    def _footer_ops(self, page_number: int, page_count: int) -> list[str]:
        page = _Page()
        original = self.page
        self.page = page
        self._line(MARGIN, FOOTER_Y + 18, PAGE_WIDTH - MARGIN, FOOTER_Y + 18, BORDER, 0.6)
        self._text(MARGIN, FOOTER_Y, "Cabinet Dr Nait Abdesselam Gaya", 9, MUTED)
        self._text_right(
            PAGE_WIDTH - MARGIN,
            FOOTER_Y,
            f"{self.invoice_number} - {page_number} / {page_count}",
            9,
            MUTED,
        )
        self.page = original
        return page.operations

    def _serialize(self) -> bytes:
        page_count = len(self.pages)
        streams = [
            "\n".join(page.operations + self._footer_ops(index, page_count)).encode("cp1252", "replace")
            for index, page in enumerate(self.pages, start=1)
        ]

        objects: list[bytes] = []
        page_refs: list[int] = []
        image_object_number = 5 if self.logo else None
        next_object = 6 if self.logo else 5
        for _ in streams:
            page_refs.append(next_object)
            next_object += 2

        objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
        kids = " ".join(f"{number} 0 R" for number in page_refs)
        objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {page_count} >>".encode("ascii"))
        objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
        objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
        if self.logo and image_object_number:
            objects.append(
                (
                    f"<< /Type /XObject /Subtype /Image /Width {self.logo.width} /Height {self.logo.height} "
                    f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode "
                    f"/Length {len(self.logo.data)} >>\nstream\n"
                ).encode("ascii")
                + self.logo.data
                + b"\nendstream"
            )

        content_object_number = (6 if self.logo else 5) + 1
        for stream in streams:
            resources = "/Font << /F1 3 0 R /F2 4 0 R >>"
            if image_object_number:
                resources += f" /XObject << /Logo {image_object_number} 0 R >>"
            objects.append(
                (
                    f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH:.2f} {PAGE_HEIGHT:.2f}] "
                    f"/Resources << {resources} >> /Contents {content_object_number} 0 R >>"
                ).encode("ascii")
            )
            objects.append(b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream")
            content_object_number += 2

        pdf = bytearray(b"%PDF-1.4\n")
        offsets = [0]
        for number, obj in enumerate(objects, start=1):
            offsets.append(len(pdf))
            pdf.extend(f"{number} 0 obj\n".encode("ascii"))
            pdf.extend(obj)
            pdf.extend(b"\nendobj\n")
        xref_offset = len(pdf)
        pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        pdf.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
        pdf.extend(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
                f"startxref\n{xref_offset}\n%%EOF\n"
            ).encode("ascii")
        )
        return bytes(pdf)


def render_invoice_pdf(invoice: Invoice) -> bytes:
    return _InvoicePdfBuilder(invoice).render()
