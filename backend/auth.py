import re
import os
import json
import time
import hmac
import base64
import sqlite3
import hashlib
import secrets
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

router = APIRouter(prefix="/auth", tags=["Authentication"])

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "users.db"
SECRET_PATH = BASE_DIR / ".auth_secret"
ITERATIONS = 310000
TOKEN_LIFETIME = 7 * 24 * 60 * 60


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)


initialize_database()


def get_secret():
    if SECRET_PATH.exists():
        return SECRET_PATH.read_bytes()

    secret = secrets.token_bytes(48)

    try:
        with SECRET_PATH.open("xb") as file:
            file.write(secret)
    except FileExistsError:
        return SECRET_PATH.read_bytes()

    return secret


AUTH_SECRET = get_secret()


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)

    result = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        ITERATIONS
    )

    return result.hex(), salt.hex()


def verify_password(password, stored_hash, salt):
    calculated, _ = hash_password(
        password,
        bytes.fromhex(salt)
    )

    return hmac.compare_digest(calculated, stored_hash)


def encode_part(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def decode_part(data):
    return base64.urlsafe_b64decode(
        data + "=" * (-len(data) % 4)
    )


def create_token(user):
    payload = json.dumps({
        "sub": user["id"],
        "email": user["email"],
        "exp": int(time.time()) + TOKEN_LIFETIME
    }).encode()

    encoded = encode_part(payload)

    signature = hmac.new(
        AUTH_SECRET,
        encoded.encode(),
        hashlib.sha256
    ).digest()

    return encoded + "." + encode_part(signature)


def verify_access_token(token):
    try:
        encoded, supplied = token.split(".", 1)

        expected = hmac.new(
            AUTH_SECRET,
            encoded.encode(),
            hashlib.sha256
        ).digest()

        if not hmac.compare_digest(
            expected,
            decode_part(supplied)
        ):
            raise ValueError("Invalid signature")

        payload = json.loads(decode_part(encoded))

        if int(payload["exp"]) < int(time.time()):
            raise ValueError("Session expired")

        return payload

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session. Please log in again."
        )


def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Please log in first."
        )

    payload = verify_access_token(
        authorization[len("Bearer "):]
    )

    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, name, email FROM users WHERE id = ?",
            (payload["sub"],)
        ).fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    return dict(user)


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(data: SignupRequest):
    name = data.name.strip()
    email = data.email.strip().lower()

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Enter a valid name.")

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=400, detail="Enter a valid email.")

    password_hash, salt = hash_password(data.password)

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (name, email, password_hash, salt)
                VALUES (?, ?, ?, ?)
                """,
                (name, email, password_hash, salt)
            )
            user_id = cursor.lastrowid

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists."
        )

    user = {"id": user_id, "name": name, "email": email}

    return {
        "status": "success",
        "message": "Account created successfully.",
        "token": create_token(user),
        "user": user
    }


@router.post("/login")
def login(data: LoginRequest):
    email = data.email.strip().lower()

    with get_connection() as connection:
        user = connection.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

    if not user or not verify_password(
        data.password,
        user["password_hash"],
        user["salt"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password."
        )

    public_user = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"]
    }

    return {
        "status": "success",
        "message": "Login successful.",
        "token": create_token(public_user),
        "user": public_user
    }


@router.get("/me")
def me(user=__import__("fastapi").Depends(get_current_user)):
    return {
        "status": "success",
        "user": user
    }
