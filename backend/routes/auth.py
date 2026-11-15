
from datetime import datetime, timedelta, timezone
import os

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
TOKEN_EXPIRE_MINUTES = int(
    os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
)

if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing from .env")


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


def create_access_token(user_id: int):
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expire
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired login session.",
        headers={"WWW-Authenticate": "Bearer"}
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = int(payload.get("sub"))

    except (jwt.InvalidTokenError, TypeError, ValueError):
        raise credentials_error

    user = db.execute(
        text("""
            SELECT user_id, full_name, email, created_at
            FROM users
            WHERE user_id = :user_id
        """),
        {"user_id": user_id}
    ).mappings().first()

    if not user:
        raise credentials_error

    return dict(user)


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    full_name = request.full_name.strip()
    email = str(request.email).strip().lower()

    if len(full_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid full name."
        )

    existing_user = db.execute(
        text("SELECT user_id FROM users WHERE email = :email"),
        {"email": email}
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists."
        )

    hashed_password = password_hash.hash(request.password)

    try:
        db.execute(
            text("""
                INSERT INTO users
                (full_name, email, password_hash)
                VALUES
                (:full_name, :email, :password_hash)
            """),
            {
                "full_name": full_name,
                "email": email,
                "password_hash": hashed_password
            }
        )

        user_id = db.execute(
            text("""
                SELECT user_id FROM users
                WHERE email = :email
            """),
            {"email": email}
        ).scalar_one()

        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to create your account. Please try again."
        )

    return {
        "message": "Registration successful. You can now log in.",
        "user": {
            "user_id": user_id,
            "full_name": full_name,
            "email": email
        }
    }


@router.post("/login")
def login_user(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    email = str(request.email).strip().lower()

    user = db.execute(
        text("""
            SELECT user_id, full_name, email, password_hash
            FROM users
            WHERE email = :email
        """),
        {"email": email}
    ).mappings().first()

    if not user or not password_hash.verify(
        request.password,
        user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password."
        )

    access_token = create_access_token(user["user_id"])

    return {
        "message": "Login successful.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "full_name": user["full_name"],
            "email": user["email"]
        }
    }


@router.get("/me")
def get_my_profile(
    current_user: dict = Depends(get_current_user)
):
    return {
        "user": current_user
    }
@router.put("/profile")
def update_profile(
    request: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    full_name = request.full_name.strip()
    email = str(request.email).strip().lower()

    if len(full_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid name."
        )

    existing = db.execute(
        text("""
            SELECT user_id FROM users
            WHERE email = :email AND user_id != :user_id
        """),
        {
            "email": email,
            "user_id": current_user["user_id"]
        }
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="This email is already registered."
        )

    db.execute(
        text("""
            UPDATE users
            SET full_name = :full_name, email = :email
            WHERE user_id = :user_id
        """),
        {
            "full_name": full_name,
            "email": email,
            "user_id": current_user["user_id"]
        }
    )

    db.commit()

    return {
        "message": "Profile updated successfully.",
        "user": {
            "user_id": current_user["user_id"],
            "full_name": full_name,
            "email": email
        }
    }


@router.put("/change-password")
def change_password(
    request: PasswordUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.execute(
        text("""
            SELECT password_hash FROM users
            WHERE user_id = :user_id
        """),
        {"user_id": current_user["user_id"]}
    ).mappings().first()

    if not user or not password_hash.verify(
        request.current_password,
        user["password_hash"]
    ):
        raise HTTPException(
            status_code=400,
            detail="Your current password is incorrect."
        )

    new_hash = password_hash.hash(request.new_password)

    db.execute(
        text("""
            UPDATE users
            SET password_hash = :password_hash
            WHERE user_id = :user_id
        """),
        {
            "password_hash": new_hash,
            "user_id": current_user["user_id"]
        }
    )

    db.commit()

    return {"message": "Password changed successfully."}
