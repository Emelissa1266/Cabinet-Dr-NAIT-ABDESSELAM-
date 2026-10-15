"""Private prescription PDF; medical content is never altered by rendering."""

from io import BytesIO

from django.utils import timezone
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, Spacer, Table, TableStyle

from config.pdf_layout import BORDER, SURFACE, WIDTH, document, page_furniture, styles
from config.pdf_layout import text as _text


def render_prescription_pdf(prescription):
    theme = styles()
    normal, heading, title = theme["body"], theme["heading"], theme["title"]
    stream = BytesIO()
    pdf = document(stream, "Ordonnance médicale")
    patient = prescription.patient
    date = timezone.localtime(prescription.prescribed_at).strftime("%d/%m/%Y")
    story = []
    story.append(Paragraph("ORDONNANCE MÉDICALE", title))
    labels = {"DRAFT": "BROUILLON", "CANCELLED": "ANNULÉE", "COMPLETED": "Terminée"}
    if prescription.status in labels:
        story.append(Paragraph(labels[prescription.status], heading))
    patient_info = [
        Paragraph(
            f"<b>Patient :</b> {_text(patient.first_name)} {_text(patient.last_name)}", normal
        ),
        Paragraph(f"<b>Date de prescription :</b> {date}", normal),
        Paragraph(f"<b>Référence :</b> Ordonnance #{prescription.pk}", normal),
        Paragraph(
            f"<b>Prescripteur :</b> {_text(prescription.doctor.get_full_name() or prescription.doctor.username)}",
            normal,
        ),
    ]
    if patient.date_of_birth:
        patient_info.append(
            Paragraph(f"<b>Date de naissance :</b> {patient.date_of_birth:%d/%m/%Y}", normal)
        )
    card = Table([[patient_info]], colWidths=[WIDTH])
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
    story.extend([card, Spacer(1, 6 * mm)])
    for index, item in enumerate(prescription.items.all(), 1):
        block = []
        block.append(Paragraph(f"{index}. {_text(item.medication_name)}", heading))
        fields = [
            ("Dosage / posologie", item.dosage),
            ("Fréquence", item.frequency),
            ("Voie d'administration", item.route),
            ("Durée", item.duration),
            ("Quantité", item.quantity),
            ("Instructions", item.instructions),
        ]
        if item.start_date:
            fields.append(("Début du traitement", f"{item.start_date:%d/%m/%Y}"))
        if item.end_date:
            fields.append(("Fin du traitement", f"{item.end_date:%d/%m/%Y}"))
        for label, value in fields:
            if value is not None and value != "":
                block.append(Paragraph(f"<b>{label} :</b> {_text(value)}", normal))
        story.append(KeepTogether(block))
    for label, value in (
        ("Instructions générales", prescription.general_instructions),
        ("Notes médicales", prescription.notes),
    ):
        if value:
            story.extend([Paragraph(label, heading), Paragraph(_text(value), normal)])
    story.append(
        KeepTogether(
            [
                Spacer(1, 8 * mm),
                Paragraph("Signature et cachet du médecin", normal),
                Spacer(1, 20 * mm),
            ]
        )
    )

    furniture = page_furniture(f"Ordonnance #{prescription.pk}")
    pdf.build(story, onFirstPage=furniture, onLaterPages=furniture)
    return stream.getvalue()
