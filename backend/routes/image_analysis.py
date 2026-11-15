
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends

from routes.auth import get_current_user
from services.image_analysis import analyze_medical_image

router = APIRouter(
    prefix="/api/image-analysis",
    tags=["Medical Image Analysis"]
)


@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    question: str = Form(""),
    symptoms: str = Form(""),
    current_user: dict = Depends(get_current_user),
):
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp"
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, PNG or WEBP image."
        )

    try:
        image_bytes = await file.read()

        if len(image_bytes) > 8 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Image must be 8 MB or smaller."
            )

        result = analyze_medical_image(
            image_bytes=image_bytes,
            question=question.strip(),
            symptoms=symptoms.strip()
            )

        return {
            "message": "Image processed successfully.",
            "filename": file.filename,
            "analysis": result,
            "disclaimer": (
                "Educational information only. "
                "This is not a medical diagnosis."
            )
        }

    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error)
        )

    except Exception as error:
        print("Image API Error:", str(error))
        raise HTTPException(
            status_code=500,
            detail="Unable to process this image."
        )

    finally:
        await file.close()
