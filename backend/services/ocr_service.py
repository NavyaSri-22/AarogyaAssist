
import os
import re
from io import BytesIO

import fitz
import cv2
import numpy as np
import pytesseract

from PIL import Image


# Tesseract installation path
TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

if os.path.exists(TESSERACT_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH


# Medical terms used to evaluate OCR quality
MEDICAL_TERMS = [
    "hemoglobin", "haemoglobin",
    "rbc count", "wbc count",
    "packed cell volume", "pcv",
    "mean corpuscular volume", "mcv",
    "mch", "mchc", "rdw",
    "neutrophils", "lymphocytes",
    "eosinophils", "monocytes",
    "basophils", "platelet count"
]


def medical_quality_score(text):
    if not text:
        return 0

    lower = text.lower()

    term_score = sum(
        10 for term in MEDICAL_TERMS
        if term in lower
    )

    row_score = 0

    for line in lower.splitlines():
        has_test_name = any(
            term in line for term in MEDICAL_TERMS
        )

        has_number = bool(re.search(r"\d", line))

        if has_test_name and has_number:
            row_score += 8

    words = re.findall(r"[a-z]{2,}", lower)
    word_score = min(len(words), 100)

    return term_score + row_score + word_score


def has_structured_medical_rows(text):
    if not text:
        return False

    valid_rows = 0

    for line in text.splitlines():
        lower_line = line.lower()

        has_test_name = any(
            term in lower_line
            for term in MEDICAL_TERMS
        )

        has_number = bool(
            re.search(r"\d", line)
        )

        if has_test_name and has_number:
            valid_rows += 1

    return valid_rows >= 5


def create_image_variants(image):
    image_array = np.array(image.convert("RGB"))

    gray = cv2.cvtColor(
        image_array,
        cv2.COLOR_RGB2GRAY
    )

    height, width = gray.shape

    # Upscale the scanned page
    enlarged = cv2.resize(
        gray,
        (width * 2, height * 2),
        interpolation=cv2.INTER_CUBIC
    )

    # Mild noise removal
    denoised = cv2.fastNlMeansDenoising(
        enlarged,
        None,
        8,
        7,
        21
    )

    # Improve contrast
    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    enhanced = clahe.apply(denoised)

    # Otsu thresholding
    _, otsu = cv2.threshold(
        enhanced,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    # Adaptive thresholding
    adaptive = cv2.adaptiveThreshold(
        enhanced,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        10
    )

    return [
        Image.fromarray(enlarged),
        Image.fromarray(denoised),
        Image.fromarray(enhanced),
        Image.fromarray(otsu),
        Image.fromarray(adaptive)
    ]


def run_multiple_ocr(image):
    best_text = ""
    best_score = -1

    configurations = [
        "--oem 3 --psm 6",
        "--oem 3 --psm 4",
        "--oem 3 --psm 11"
    ]

    variants = create_image_variants(image)

    for variant in variants:
        for config in configurations:

            text = pytesseract.image_to_string(
                variant,
                lang="eng",
                config=config
            ).strip()

            score = medical_quality_score(text)

            if score > best_score:
                best_score = score
                best_text = text

    return best_text


def extract_pdf_text(file_bytes: bytes):
    try:
        document = fitz.open(
            stream=file_bytes,
            filetype="pdf"
        )

        extracted_pages = []
        ocr_pages = []

        for page_number, page in enumerate(
            document,
            start=1
        ):

            # Extract selectable PDF text
            native_text = page.get_text("text").strip()

            # Check whether native text has structured result rows
            if has_structured_medical_rows(native_text):

                final_text = native_text

            else:
                # Render PDF page at high resolution
                pixmap = page.get_pixmap(
                    matrix=fitz.Matrix(3, 3),
                    alpha=False
                )

                image = Image.open(
                    BytesIO(pixmap.tobytes("png"))
                ).convert("RGB")

                # Run multiple OCR configurations
                ocr_text = run_multiple_ocr(image)

                ocr_score = medical_quality_score(
                    ocr_text
                )

                if ocr_text and ocr_score > 0:
                    final_text = ocr_text
                    ocr_pages.append(page_number)

                else:
                    final_text = native_text

            if final_text:
                extracted_pages.append({
                    "page": page_number,
                    "text": final_text
                })

        total_pages = len(document)
        document.close()

        full_text = "\n\n".join(
            item["text"]
            for item in extracted_pages
        )

        return {
            "success": True,
            "total_pages": total_pages,
            "pages_with_text": len(extracted_pages),
            "pages": extracted_pages,
            "extracted_text": full_text,
            "requires_ocr": not bool(full_text.strip()),
            "ocr_used": bool(ocr_pages),
            "ocr_pages": ocr_pages
        }

    except Exception as error:
        raise ValueError(
            f"Unable to process PDF: {str(error)}"
        )
