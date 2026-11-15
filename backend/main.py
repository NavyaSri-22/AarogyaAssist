from routes.auth import router as auth_router
from routes.image_analysis import router as image_analysis_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.reports import router as reports_router
from routes.chat import router as chat_router
app = FastAPI(
    title="Aarogya Assist API",
    description="AI-powered healthcare report intelligence platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
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


app.include_router(reports_router)
app.include_router(chat_router)
app.include_router(image_analysis_router)
app.include_router(auth_router)