
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine
from routes.auth import router as auth_router
from routes.image_analysis import router as image_analysis_router
from routes.reports import router as reports_router
from routes.chat import router as chat_router

app = FastAPI(
    title="Aarogya Assist API",
    description="AI-powered healthcare report intelligence platform",
    version="1.0.0"
)

allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def home():
    return {
        "message": "Welcome to Aarogya Assist API",
        "status": "running"
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "application": "Aarogya Assist"
    }

@app.get("/api/health/database")
def database_health_check():
    try:
        with engine.connect() as connection:
            database_type = engine.dialect.name

            if database_type == "postgresql":
                database_name = connection.execute(
                    text("SELECT current_database()")
                ).scalar()

                schema_name = "public"

            elif database_type == "mysql":
                database_name = connection.execute(
                    text("SELECT DATABASE()")
                ).scalar()

                schema_name = database_name

            else:
                raise ValueError(
                    f"Unsupported database: {database_type}"
                )

            required_tables = [
                "users",
                "medical_reports",
                "medical_parameters",
                "report_explanations",
                "conversations",
                "chat_messages"
            ]

            result = connection.execute(
                text("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = :schema_name
                """),
                {"schema_name": schema_name}
            )

            existing_tables = sorted(
                row[0] for row in result.fetchall()
                if row[0] in required_tables
            )

            missing_tables = sorted(
                set(required_tables) - set(existing_tables)
            )

            return {
                "database_status": "connected",
                "database_type": database_type,
                "database_name": database_name,
                "tables_found": len(existing_tables),
                "tables_expected": len(required_tables),
                "existing_tables": existing_tables,
                "missing_tables": missing_tables,
                "all_tables_ready": len(missing_tables) == 0
            }

    except Exception as error:
        print("Database health check failed:", str(error))

        return {
            "database_status": "error",
            "message": "Database connection failed",
            "error_type": type(error).__name__
        }
app.include_router(reports_router)
app.include_router(chat_router)
app.include_router(image_analysis_router)
app.include_router(auth_router)
