"""Invoice presentation only; all amounts come from the billing model."""

from contextlib import suppress
from decimal import Decimal
from io import BytesIO

from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, Spacer, Table, TableStyle

from config.pdf_layout import (
    BORDER,
    SURFACE,
    TEAL,
    WIDTH,
    document,
    page_furniture,
    styles,
    text,
)

from .models import Invoice

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


def render_invoice_pdf(invoice: Invoice) -> bytes:
    theme = styles()
    normal = theme["body"]
    stream = BytesIO()
    pdf = document(stream, "Facture patient")
    reference = invoice.invoice_number or "Brouillon"

    def p(value, style=normal):
        return Paragraph(text(value), style)

    story = [p("FACTURE", theme["title"])]
    metadata = [
        p(f"Patient : {invoice.patient.first_name} {invoice.patient.last_name}"),
        p(f"Numéro : {reference}"),
        p(f"Date d'émission : {invoice.issue_date:%d/%m/%Y}"),
        p(f"Statut : {STATUS_LABELS.get(invoice.status, invoice.get_status_display())}"),
    ]
    if invoice.due_date:
        metadata.append(p(f"Échéance : {invoice.due_date:%d/%m/%Y}"))
    card = Table([[metadata]], colWidths=[WIDTH])
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.extend([card, Spacer(1, 8 * mm)])
    rows = [
        [
            p(label, theme["muted"])
            for label in ("Désignation", "Quantité", "Prix unitaire", "Montant")
        ]
    ]
    for item in invoice.items.all():
        description = text(item.description)
        if item.discount_amount:
            description += f"<br/><font size='8'>Remise : {text(format_dzd(item.discount_amount, invoice.currency))}</font>"
        rows.append(
            [
                Paragraph(description, normal),
                p(f"{item.quantity:.2f}".replace(".", ","), theme["amount"]),
                p(format_dzd(item.unit_price, invoice.currency), theme["amount"]),
                p(format_dzd(item.net_amount, invoice.currency), theme["amount"]),
            ]
        )
    table = Table(
        rows,
        colWidths=[WIDTH * 0.43, WIDTH * 0.12, WIDTH * 0.225, WIDTH * 0.225],
        repeatRows=1,
        splitByRow=1,
        splitInRow=1,
        hAlign="CENTER",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [None, SURFACE]),
                ("LINEBELOW", (0, 0), (-1, 0), 0.7, TEAL),
                ("LINEBELOW", (0, 1), (-1, -1), 0.3, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([table, Spacer(1, 8 * mm)])
    # subtotal is already net of line discounts; do not subtract them twice.
    totals = [("Sous-total (prestations nettes)", invoice.subtotal)]
    if invoice.item_discount_total:
        totals.append(("Remises sur prestations (déjà déduites)", invoice.item_discount_total))
    if invoice.discount_amount:
        totals.append(("Remise facture", invoice.discount_amount))
    totals += [
        ("Total", invoice.total),
        ("Montant payé", invoice.paid_amount),
        ("Reste à payer", invoice.remaining_amount),
    ]
    summary = Table(
        [
            [
                p(label, theme["total"] if label == "Total" else normal),
                p(
                    format_dzd(value, invoice.currency),
                    theme["total_amount"] if label == "Total" else theme["amount"],
                ),
            ]
            for label, value in totals
        ],
        colWidths=[WIDTH * 0.65, WIDTH * 0.35],
    )
    total_row = len(totals) - 3
    summary.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("BACKGROUND", (0, total_row), (-1, total_row), SURFACE),
                ("LINEABOVE", (0, total_row), (-1, total_row), 0.7, TEAL),
                ("LINEBELOW", (0, -1), (-1, -1), 0.7, TEAL),
            ]
        )
    )
    settlement = [summary]
    allocations = (
        invoice.allocations.filter(payment__status="COMPLETED")
        .select_related("payment", "payment__receipt")
        .order_by("payment__paid_at", "created_at")
    )
    if allocations.exists():
        settlement.append(p("Règlements", theme["heading"]))
    for allocation in allocations:
        payment = allocation.payment
        lines = [
            payment.payment_number or "Paiement",
            timezone.localtime(payment.paid_at).strftime("%d/%m/%Y"),
            format_dzd(allocation.amount, invoice.currency),
        ]
        with suppress(ObjectDoesNotExist):
            lines.append(f"Reçu {payment.receipt.receipt_number}")
        settlement.append(p(" | ".join(lines)))
    story.append(KeepTogether(settlement))
    if invoice.notes:
        story.extend([p("Mentions et notes", theme["heading"]), p(invoice.notes)])
    furniture = page_furniture(reference)
    pdf.build(story, onFirstPage=furniture, onLaterPages=furniture)
    return stream.getvalue()
