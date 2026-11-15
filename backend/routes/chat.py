
import os
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text
from groq import Groq

from database import get_db, insert_and_return_id
from routes.auth import get_current_user

load_dotenv()

router = APIRouter(prefix="/api/chat", tags=["AI Assistant"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

EMERGENCY_PHRASES = [
    "chest pain",
    "difficulty breathing",
    "can't breathe",
    "cannot breathe",
    "shortness of breath",
    "unconscious",
    "not responding",
    "severe bleeding",
    "heavy bleeding",
    "face drooping",
    "sudden weakness",
    "stroke symptoms",
    "seizure",
    "suicidal",
    "suicide",
    "గుండె నొప్పి",
    "శ్వాస తీసుకోవడం కష్టం",
    "सांस लेने में कठिनाई",
    "सीने में दर्द",
    "बेहोश",
]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: Literal["English", "Hindi", "Telugu"] = "English"
    history: list[ChatMessage] = Field(default_factory=list)
    conversation_id: Optional[int] = None


class NewConversationRequest(BaseModel):
    title: str = Field(default="New Conversation", max_length=255)
    language: Literal["English", "Hindi", "Telugu"] = "English"


def check_conversation(db: Session, conversation_id: int, user_id: int):
    result = db.execute(
        text("""
            SELECT conversation_id
            FROM conversations
            WHERE conversation_id = :conversation_id
              AND user_id = :user_id
        """),
        {
            "conversation_id": conversation_id,
            "user_id": user_id,
        },
    ).mappings().first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    return result



def create_conversation(
    db: Session,
    title: str,
    language: str,
    user_id: int,
):
    try:
        parameters = {
            "user_id": user_id,
            "title": title[:255] or "New Conversation",
            "language": language,
        }

        conversation_id = insert_and_return_id(
            db,
            text("""
                INSERT INTO conversations (user_id, title, language)
                VALUES (:user_id, :title, :language)
                RETURNING conversation_id
            """),
            text("""
                INSERT INTO conversations (user_id, title, language)
                VALUES (:user_id, :title, :language)
            """),
            parameters,
        )

        db.commit()
        return conversation_id

    except Exception:
        db.rollback()
        raise


def save_message(
    db: Session,
    conversation_id: int,
    role: str,
    content: str,
    emergency_detected: bool = False,
):
    db.execute(
        text("""
            INSERT INTO chat_messages
            (conversation_id, role, content, emergency_detected)
            VALUES
            (:conversation_id, :role, :content, :emergency_detected)
        """),
        {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "emergency_detected": emergency_detected,
        },
    )
    db.commit()


@router.post("/new")
async def new_conversation(
    request: NewConversationRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation_id = create_conversation(
        db,
        request.title,
        request.language,
        current_user["user_id"],
    )

    return {
        "message": "Conversation created successfully.",
        "conversation_id": conversation_id,
        "title": request.title,
        "language": request.language,
    }


@router.get("/history")
async def get_chat_history(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user["user_id"]

    rows = db.execute(
        text("""
            SELECT
                c.conversation_id,
                c.title,
                c.language,
                c.created_at,
                c.updated_at,
                COUNT(m.message_id) AS message_count
            FROM conversations c
            LEFT JOIN chat_messages m
                ON c.conversation_id = m.conversation_id
            WHERE c.user_id = :user_id
            GROUP BY
                c.conversation_id,
                c.title,
                c.language,
                c.created_at,
                c.updated_at
            ORDER BY c.updated_at DESC
        """),
        {"user_id": user_id},
    ).mappings().all()

    return {
        "conversations": [dict(row) for row in rows]
    }


@router.get("/conversation/{conversation_id}")
async def get_conversation(
    conversation_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_conversation(db, conversation_id, current_user["user_id"])

    conversation = db.execute(
        text("""
            SELECT conversation_id, title, language, created_at, updated_at
            FROM conversations
            WHERE conversation_id = :conversation_id
        """),
        {"conversation_id": conversation_id},
    ).mappings().first()

    messages = db.execute(
        text("""
            SELECT message_id, role, content, emergency_detected, created_at
            FROM chat_messages
            WHERE conversation_id = :conversation_id
            ORDER BY message_id ASC
        """),
        {"conversation_id": conversation_id},
    ).mappings().all()

    return {
        "conversation": dict(conversation),
        "messages": [dict(row) for row in messages],
    }


@router.delete("/conversation/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user["user_id"]
    check_conversation(db, conversation_id, user_id)

    db.execute(
        text("""
            DELETE FROM conversations
            WHERE conversation_id = :conversation_id
              AND user_id = :user_id
        """),
        {
            "conversation_id": conversation_id,
            "user_id": user_id,
        },
    )

    db.commit()

    return {
        "message": "Conversation deleted successfully.",
        "conversation_id": conversation_id,
    }


@router.post("/message")
async def chat_message(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_message = request.message.strip()
    user_id = current_user["user_id"]

    if not user_message:
        raise HTTPException(
            status_code=400,
            detail="Please enter a message.",
        )

    # Create a new conversation automatically if one was not supplied.
    if request.conversation_id is None:
        conversation_id = create_conversation(
            db,
            user_message[:60],
            request.language,
            user_id,
        )
    else:
        check_conversation(db, request.conversation_id, user_id)
        conversation_id = request.conversation_id

    # Save the user's message.
    save_message(
        db,
        conversation_id,
        "user",
        user_message,
    )

    message_lower = user_message.lower()
    emergency_detected = any(
        phrase in message_lower for phrase in EMERGENCY_PHRASES
    )

    if emergency_detected:
        emergency_responses = {
            "English": (
                "Your message may describe a medical emergency. "
                "Please seek immediate medical attention or contact "
                "local emergency services now. Do not wait for an "
                "online response. In India, call 112 for emergency assistance."
            ),
            "Hindi": (
                "आपके संदेश में मेडिकल इमरजेंसी के संकेत हो सकते हैं। "
                "कृपया तुरंत चिकित्सा सहायता लें या स्थानीय आपातकालीन "
                "सेवाओं से संपर्क करें। भारत में आपातकालीन सहायता के लिए 112 पर कॉल करें।"
            ),
            "Telugu": (
                "మీ సందేశంలో అత్యవసర వైద్య పరిస్థితి సూచనలు ఉండవచ్చు. "
                "దయచేసి వెంటనే వైద్య సహాయం పొందండి లేదా అత్యవసర సేవలను "
                "సంప్రదించండి. భారతదేశంలో అత్యవసర సహాయం కోసం 112కు కాల్ చేయండి."
            ),
        }

        reply = emergency_responses[request.language]

        save_message(
            db,
            conversation_id,
            "assistant",
            reply,
            emergency_detected=True,
        )

        return {
            "reply": reply,
            "emergency_detected": True,
            "language": request.language,
            "conversation_id": conversation_id,
        }

    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Groq API key is not configured on the server.",
        )

    try:
        client = Groq(api_key=GROQ_API_KEY)

        system_prompt = f"""
You are Aarogya Assist, a responsible AI health education assistant.
Respond in {request.language}.

Your responsibilities:
1. Explain general health topics in simple, friendly language.
2. Help users understand symptoms without diagnosing them.
3. Explain medical terminology in everyday language.
4. Encourage users to consult qualified healthcare professionals.
5. Ask relevant follow-up questions when information is unclear.
6. Be respectful, calm and supportive.
7. Never prescribe medicines or recommend medication dosages.
8. Never claim certainty about a medical condition.
9. Never invent medical facts or test results.
10. If a user describes a potentially serious situation,
    recommend urgent professional medical assessment.

Important:
- You are not a doctor.
- Your answers are educational, not medical diagnoses.
- Do not tell users to ignore serious symptoms.
- Do not replace emergency services or professional care.
- Use clear Markdown headings and compact lists.
- Avoid unnecessary blank lines.
"""

        messages = [
            {"role": "system", "content": system_prompt}
        ]

        # Use recent conversation context supplied by the frontend.
        for item in request.history[-12:]:
            messages.append({
                "role": item.role,
                "content": item.content,
            })

        messages.append({
            "role": "user",
            "content": user_message,
        })

        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.4,
            max_completion_tokens=1200,
        )

        reply = completion.choices[0].message.content

        if not reply:
            raise RuntimeError("The AI returned an empty response.")

        # Save the assistant's reply.
        save_message(
            db,
            conversation_id,
            "assistant",
            reply,
        )

        return {
            "reply": reply,
            "emergency_detected": False,
            "language": request.language,
            "conversation_id": conversation_id,
        }

    except HTTPException:
        raise
    except Exception as error:
        print("AI Chat Error:", str(error))
        raise HTTPException(
            status_code=502,
            detail="The AI assistant is temporarily unavailable. Please try again.",
        )
