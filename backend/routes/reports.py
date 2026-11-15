from routes.auth import get_current_user
import logging

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db, insert_and_return_id

from services.ocr_service import extract_pdf_text
from services.medical_parser import extract_medical_parameters
from services.ai_explanation import generate_report_explanation


router = APIRouter(
    prefix="/api/reports",
    tags=["Medical Reports"]
)

logger = logging.getLogger(__name__)


# -----------------------------------------
# REQUEST MODELS
# -----------------------------------------

class ReferenceRange(BaseModel):
    minimum: float
    maximum: float


class MedicalParameter(BaseModel):
    test_name: str
    value: float
    unit: Optional[str] = None
    reference_range: Optional[ReferenceRange] = None
    status: str
    reported_flag: Optional[str] = None


class ExplanationRequest(BaseModel):
    medical_parameters: list[MedicalParameter]
    language: str = "English"
    report_id: Optional[int] = None


# -----------------------------------------
# UPLOAD AND SAVE MEDICAL REPORT
# -----------------------------------------

@router.post("/upload")
async def upload_medical_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user["user_id"]

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are currently supported."
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File size must not exceed 10 MB."
        )

    try:
        # Verify that the user exists
        user = db.execute(
            text("""
                SELECT user_id
                FROM users
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).fetchone()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found. Create the development demo user first."
            )

        # Extract PDF text
        result = extract_pdf_text(file_bytes)

        # Extract medical parameters
        medical_parameters = extract_medical_parameters(
            result["extracted_text"]
        )

        # Save report and parameters in one transaction
        report_id = insert_and_return_id(
            db,
            text("""
                INSERT INTO medical_reports
                (user_id, filename, report_type)
                VALUES (:user_id, :filename, :report_type)
                RETURNING report_id
            """),
            text("""
                INSERT INTO medical_reports
                (user_id, filename, report_type)
                VALUES (:user_id, :filename, :report_type)
            """),
            {
                "user_id": user_id,
                "filename": file.filename,
                "report_type": "CBC"
            }
        )

        for parameter in medical_parameters:

            reference_range = parameter.get("reference_range") or {}

            db.execute(
                text("""
                    INSERT INTO medical_parameters
                    (
                        report_id,
                        test_name,
                        value,
                        unit,
                        reference_min,
                        reference_max,
                        status,
                        reported_flag
                    )
                    VALUES (
                        :report_id,
                        :test_name,
                        :parameter_value,
                        :unit,
                        :reference_min,
                        :reference_max,
                        :status,
                        :reported_flag
                    )
                """),
                {
                    "report_id": report_id,
                    "test_name": parameter["test_name"],
                    "parameter_value": parameter["value"],
                    "unit": parameter.get("unit"),
                    "reference_min": reference_range.get("minimum"),
                    "reference_max": reference_range.get("maximum"),
                    "status": parameter["status"],
                    "reported_flag": parameter.get("reported_flag")
                }
            )

        db.commit()

        return {
            "message": "PDF processed and saved successfully",
            "report_id": report_id,
            "user_id": user_id,
            "filename": file.filename,
            **result,
            "medical_parameters": medical_parameters
        }

    except HTTPException:
        db.rollback()
        raise

    except ValueError:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail="Unable to process this PDF. Please upload a valid report."
        )

    except Exception:
        db.rollback()
        logger.exception("Unable to save medical report")
        raise HTTPException(
            status_code=500,
            detail="Unable to save the medical report. Please try again."
        )


# -----------------------------------------
# GENERATE AND SAVE AI EXPLANATION
# -----------------------------------------

@router.post("/explain")
def explain_medical_report(
    request: ExplanationRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if not request.medical_parameters:
        raise HTTPException(
            status_code=400,
            detail="No medical parameters were provided."
        )

    if len(request.medical_parameters) > 50:
        raise HTTPException(
            status_code=400,
            detail="Too many medical parameters."
        )

    supported_languages = [
        "English",
        "Hindi",
        "Telugu"
    ]

    if request.language not in supported_languages:
        raise HTTPException(
            status_code=400,
            detail="Unsupported language."
        )

    try:
        if request.report_id is not None:
            report = db.execute(
                text("""
                    SELECT report_id
                    FROM medical_reports
                    WHERE report_id = :report_id
                      AND user_id = :user_id
                """),
                {
                    "report_id": request.report_id,
                    "user_id": current_user["user_id"]
                }
            ).fetchone()

            if not report:
                raise HTTPException(
                    status_code=404,
                    detail="Medical report not found."
                )

        parameters = [
            item.model_dump()
            for item in request.medical_parameters
        ]

        explanation = generate_report_explanation(
            parameters,
            request.language
        )

        explanation_id = None

        # Save explanation when a report ID is supplied
        if request.report_id is not None:
            explanation_id = insert_and_return_id(
                db,
                text("""
                    INSERT INTO report_explanations
                    (report_id, language, explanation)
                    VALUES (:report_id, :language, :explanation)
                    RETURNING explanation_id
                """),
                text("""
                    INSERT INTO report_explanations
                    (report_id, language, explanation)
                    VALUES (:report_id, :language, :explanation)
                """),
                {
                    "report_id": request.report_id,
                    "language": request.language,
                    "explanation": explanation
                }
            )

            db.commit()

        return {
            "success": True,
            "language": request.language,
            "explanation": explanation,
            "explanation_id": explanation_id
        }

    except HTTPException:
        db.rollback()
        raise

    except ValueError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to generate the report explanation. Please try again."
        )

    except RuntimeError:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail="The AI explanation service is temporarily unavailable."
        )

    except Exception:
        db.rollback()
        logger.exception("Unable to process medical report explanation")
        raise HTTPException(
            status_code=500,
            detail="Unable to process the report explanation. Please try again."
        )

# -----------------------------------------
# HEALTH TIMELINE - REPORT HISTORY
# -----------------------------------------

@router.get("/history")
def get_report_history(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        user_id = current_user["user_id"]

        reports = db.execute(
            text("""
                SELECT
                    report_id,
                    filename,
                    report_type,
                    uploaded_at
                FROM medical_reports
                WHERE user_id = :user_id
                ORDER BY uploaded_at DESC
            """),
            {"user_id": user_id}
        ).mappings().all()

        return {
            "success": True,
            "total_reports": len(reports),
            "reports": [
                dict(report) for report in reports
            ]
        }

    except HTTPException:
        raise

    except Exception:
        logger.exception("Unable to load report history")
        raise HTTPException(
            status_code=500,
            detail="Unable to load report history. Please try again."
        )


# -----------------------------------------
# GET INDIVIDUAL REPORT DETAILS
# -----------------------------------------

@router.get("/{report_id:int}")
def get_report_details(
    report_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        report = db.execute(
            text("""
                SELECT
                    report_id,
                    user_id,
                    filename,
                    report_type,
                    uploaded_at
                FROM medical_reports
                WHERE report_id = :report_id
                  AND user_id = :user_id
            """),
            {
                "report_id": report_id,
                "user_id": current_user["user_id"]
            }
        ).mappings().first()

        if not report:
            raise HTTPException(
                status_code=404,
                detail="Medical report not found."
            )

        parameters = db.execute(
            text("""
                SELECT
                    parameter_id,
                    test_name,
                    value,
                    unit,
                    reference_min,
                    reference_max,
                    status,
                    reported_flag
                FROM medical_parameters
                WHERE report_id = :report_id
                ORDER BY parameter_id
            """),
            {"report_id": report_id}
        ).mappings().all()

        return {
            "success": True,
            "report": dict(report),
            "medical_parameters": [
                dict(parameter)
                for parameter in parameters
            ]
        }

    except HTTPException:
        raise

    except Exception:
        logger.exception("Unable to load medical report")
        raise HTTPException(
            status_code=500,
            detail="Unable to load the medical report. Please try again."
        )


# -----------------------------------------
# HEALTH TIMELINE - PARAMETER COMPARISON
# -----------------------------------------

@router.get("/compare")
def compare_medical_reports(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        user_id = current_user["user_id"]

        records = db.execute(
            text("""
                SELECT
                    mr.report_id,
                    mr.filename,
                    mr.uploaded_at,
                    mp.test_name,
                    mp.value,
                    mp.unit,
                    mp.reference_min,
                    mp.reference_max,
                    mp.status,
                    mp.reported_flag
                FROM medical_reports mr
                JOIN medical_parameters mp
                    ON mr.report_id = mp.report_id
                WHERE mr.user_id = :user_id
                ORDER BY mr.uploaded_at ASC, mp.test_name
            """),
            {"user_id": user_id}
        ).mappings().all()

        timeline = {}

        for record in records:
            test_name = record["test_name"]

            if test_name not in timeline:
                timeline[test_name] = []

            timeline[test_name].append({
                "report_id": record["report_id"],
                "filename": record["filename"],
                "uploaded_at": record["uploaded_at"],
                "value": record["value"],
                "unit": record["unit"],
                "reference_min": record["reference_min"],
                "reference_max": record["reference_max"],
                "status": record["status"],
                "reported_flag": record["reported_flag"]
            })

        return {
            "success": True,
            "user_id": user_id,
            "total_parameters": len(timeline),
            "timeline": timeline
        }

    except HTTPException:
        raise

    except Exception:
        logger.exception("Unable to compare medical reports")
        raise HTTPException(
            status_code=500,
            detail="Unable to compare reports. Please try again."
        )

@router.get("/timeline")
def get_health_timeline(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user["user_id"]

    rows = db.execute(
        text("""
            SELECT
                mp.test_name,
                mp.value,
                mp.unit,
                mp.reference_min,
                mp.reference_max,
                mp.status,
                mp.reported_flag,
                mr.report_id,
                mr.filename,
                mr.uploaded_at
            FROM medical_parameters mp
            INNER JOIN medical_reports mr
                ON mp.report_id = mr.report_id
            WHERE mr.user_id = :user_id
            ORDER BY mr.uploaded_at ASC, mp.test_name ASC
        """),
        {"user_id": user_id}
    ).mappings().all()

    timeline = {}

    for row in rows:
        test_name = row["test_name"]

        if test_name not in timeline:
            timeline[test_name] = []

        timeline[test_name].append({
            "value": float(row["value"]) if row["value"] is not None else None,
            "unit": row["unit"],
            "reference_min": float(row["reference_min"]) if row["reference_min"] is not None else None,
            "reference_max": float(row["reference_max"]) if row["reference_max"] is not None else None,
            "status": row["status"],
            "reported_flag": row["reported_flag"],
            "report_id": row["report_id"],
            "filename": row["filename"],
            "uploaded_at": row["uploaded_at"].isoformat() if row["uploaded_at"] else None
        })

    return {
        "timeline": timeline,
        "total_parameters": len(rows),
        "total_tests": len(timeline)
    }

