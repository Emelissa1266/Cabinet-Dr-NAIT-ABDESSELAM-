from io import BytesIO

from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, Spacer

from config.pdf_layout import document, page_furniture, styles, text

from .models import WorkLeave


def render_work_leave_pdf(leave):
    stream = BytesIO()
    theme = styles()
    pdf = document(stream, "Certificat médical d'arrêt de travail")

    def p(value, style="body"):
        return Paragraph(text(value), theme[style])

    story = [p("CERTIFICAT MÉDICAL D'ARRÊT DE TRAVAIL", "title")]
    patient_name = (
        leave.patient_name_snapshot or f"{leave.patient.first_name} {leave.patient.last_name}"
    )
    if leave.status == WorkLeave.Status.DRAFT:
        story += [
            p("BROUILLON - NON VALIDE", "heading"),
            p("Projet de document : aucune attestation médicale n'est émise."),
            p(f"Patient : {patient_name}"),
            p(
                f"Période envisagée : du {leave.start_date:%d/%m/%Y} au {leave.end_date:%d/%m/%Y} inclus ({leave.duration_days} jours calendaires)."
            ),
        ]
    else:
        if leave.status == WorkLeave.Status.CANCELLED:
            story.append(p("ANNULÉ - DOCUMENT NON VALIDE", "heading"))
        story += [Spacer(1, 6 * mm), p(leave.certificate_text_snapshot)]
    birth = (
        leave.patient_birth_date_snapshot
        if leave.status != WorkLeave.Status.DRAFT
        else leave.patient.date_of_birth
    )
    if birth:
        story.append(p(f"Date de naissance : {birth:%d/%m/%Y}"))
    if leave.previous_leave_id:
        story.append(
            p(
                f"Prolongation de l'arrêt {leave.previous_leave.certificate_number}, du {leave.previous_leave.start_date:%d/%m/%Y} au {leave.previous_leave.end_date:%d/%m/%Y}."
            )
        )
    story += [
        Spacer(1, 8 * mm),
        p(f"Date de délivrance : {leave.issued_date:%d/%m/%Y}"),
        p(f"Référence : {leave.certificate_number}"),
    ]
    story.append(
        KeepTogether([Spacer(1, 12 * mm), p("Signature et cachet du médecin"), Spacer(1, 28 * mm)])
    )
    furniture = page_furniture(leave.certificate_number)
    pdf.build(story, onFirstPage=furniture, onLaterPages=furniture)
    return stream.getvalue()
