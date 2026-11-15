
import os
import base64
from io import BytesIO

from dotenv import load_dotenv
from groq import Groq
from PIL import Image, UnidentifiedImageError

load_dotenv()

VISION_MODEL = "qwen/qwen3.8-27b"
MAX_IMAGE_SIZE = 8 * 1024 * 1024

ALLOWED_FORMATS = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


def analyze_medical_image(
    image_bytes: bytes,
    question: str = "",
    symptoms: str = ""
):

    if not image_bytes:
        raise ValueError("The uploaded image is empty.")

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise ValueError("Image size must be 8 MB or less.")

    try:
        image = Image.open(BytesIO(image_bytes))
        image.verify()

        image = Image.open(BytesIO(image_bytes))
        image_format = image.format

    except (UnidentifiedImageError, OSError):
        raise ValueError("Please upload a valid JPG, PNG or WEBP image.")

    if image_format not in ALLOWED_FORMATS:
        raise ValueError("Only JPG, PNG and WEBP images are supported.")

    mime_type = ALLOWED_FORMATS[image_format]

    encoded_image = base64.b64encode(image_bytes).decode("utf-8")

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError("Groq API key is not configured.")

    client = Groq(api_key=api_key)

    prompt = f"""
You are Aarogya Assist, an AI-powered health education assistant.

User's question:
{question or "Please examine this image and explain possible health-related concerns."}

Additional information provided by the user:
{symptoms or "No additional symptom information provided."}

Use the user's answers as context, but do not assume that
the answers establish a particular medical condition.
Clearly separate user-reported symptoms from visible image findings.
If important information is missing, explain what remains uncertain.
YOUR TASK:
Do not simply describe the image. Provide relevant educational
information about possible health-related explanations.

For skin images, consider relevant possibilities such as:
- Allergic contact dermatitis
- Irritant contact dermatitis
- Eczema
- Skin irritation
- Acne or folliculitis
- Fungal skin conditions
- Rosacea
- Other relevant inflammatory skin conditions

Only mention possibilities reasonably relevant to visible features.
Do not list unrelated diseases.

MEDICAL SAFETY:
1. Never claim an image confirms a disease or allergy.
2. Explain why a possibility may be relevant.
3. Clearly distinguish possibilities from confirmed diagnoses.
4. Do not invent symptoms or medical history.
5. Do not give diagnostic probabilities or confidence percentages.
6. Do not prescribe medicines, creams or dosages.
7. Ask about duration, itching, pain, spreading and possible exposures.
8. Mention relevant warning signs.
9. Recommend professional examination when appropriate.
10. Do not interpret diagnostic scans as a replacement for a specialist.
11. If the image is unclear, explain the limitation.
12. If the image is unrelated to healthcare, explain this politely.

RESPONSE FORMAT:

## 1. Image Overview
Describe the relevant visible findings.

## 2. Possible Health-Related Explanations
Explain the most relevant possible causes and why they may be relevant.
Mention that similar appearances can have different causes.

## 3. Allergy or Irritation Considerations
Explain whether an allergic or irritant reaction is a possibility,
when relevant.

## 4. Important Questions
Ask about duration, itching, burning, pain, spreading and
recent exposure to skincare products or other substances.

## 5. General Next Steps
Provide safe, non-prescriptive suggestions and explain when
to consult a dermatologist.

## 6. Warning Signs
Mention relevant symptoms requiring urgent medical attention.

## 7. Disclaimer
Explain that image-based information is educational
and cannot establish a diagnosis.

STYLE:
- Friendly, clear and simple language.
- Specific rather than generic.
- Avoid unnecessary repetition.
- Do not frighten the user or provide false reassurance.
"""

    try:
        completion = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": (
                                    f"data:{mime_type};base64,"
                                    f"{encoded_image}"
                                )
                            },
                        },
                    ],
                }
            ],
            temperature=0.2,
            max_completion_tokens=1200,
        )

        result = completion.choices[0].message.content

        if not result:
            raise RuntimeError("The AI returned an empty response.")

        return result

    except Exception as error:
        print("Image Analysis Error:", str(error))
        raise RuntimeError(
            "Image analysis is temporarily unavailable. Please try again."
        )
