import hashlib
import uuid
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

ALLOWED_DOCUMENT_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png"}
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png"}
MIME_EXTENSIONS = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}
BLOCKED_EXTENSIONS = {".exe", ".bat", ".cmd", ".ps1", ".js", ".html", ".htm", ".sh"}
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def sanitize_filename(filename: str) -> str:
    cleaned = Path(filename or "upload").name.replace("\x00", "")
    cleaned = "".join(char for char in cleaned if char.isprintable())
    return cleaned or "upload"


def generated_storage_key(kind: str, filename: str) -> str:
    extension = Path(sanitize_filename(filename)).suffix.lower()
    return f"secure/{kind}/{uuid.uuid4().hex}{extension}"


def detect_mime_type(file_obj) -> str:
    position = file_obj.tell()
    header = file_obj.read(16)
    file_obj.seek(position)
    if header.startswith(b"%PDF-"):
        return "application/pdf"
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header.startswith(PNG_SIGNATURE):
        return "image/png"
    return "application/octet-stream"


def calculate_sha256(file_obj) -> str:
    position = file_obj.tell()
    file_obj.seek(0)
    digest = hashlib.sha256()
    for chunk in iter(lambda: file_obj.read(1024 * 1024), b""):
        digest.update(chunk)
    file_obj.seek(position)
    return digest.hexdigest()


def validate_extension(filename: str, mime_type: str):
    extension = Path(sanitize_filename(filename)).suffix.lower()
    if extension in BLOCKED_EXTENSIONS:
        raise ValidationError("This file extension is not allowed.")
    if extension != MIME_EXTENSIONS.get(mime_type) and not (mime_type == "image/jpeg" and extension == ".jpeg"):
        raise ValidationError("File extension does not match detected content type.")


def validate_uploaded_file(file_obj, *, allowed_mime_types: set[str], max_size: int) -> tuple[str, str, int]:
    if file_obj.size > max_size:
        raise ValidationError("Uploaded file exceeds the configured size limit.")
    mime_type = detect_mime_type(file_obj)
    if mime_type not in allowed_mime_types:
        raise ValidationError("Unsupported or unsafe file type.")
    validate_extension(file_obj.name, mime_type)
    checksum = calculate_sha256(file_obj)
    return mime_type, checksum, file_obj.size


def validate_image_file(file_obj, *, max_size: int) -> tuple[str, str, int, int, int]:
    mime_type, checksum, file_size = validate_uploaded_file(
        file_obj,
        allowed_mime_types=ALLOWED_IMAGE_MIME_TYPES,
        max_size=max_size,
    )
    position = file_obj.tell()
    file_obj.seek(0)
    try:
        image = Image.open(BytesIO(file_obj.read()))
        image.verify()
        width, height = image.size
    except (UnidentifiedImageError, OSError) as error:
        raise ValidationError("Uploaded image is corrupted or invalid.") from error
    finally:
        file_obj.seek(position)
    return mime_type, checksum, file_size, width, height


def document_max_size() -> int:
    return settings.DOCUMENT_MAX_UPLOAD_SIZE


def clinical_photo_max_size() -> int:
    return settings.CLINICAL_PHOTO_MAX_UPLOAD_SIZE
