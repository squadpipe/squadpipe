from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TalentOS Resume & Intake NLP Engine"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"
    MAX_FILE_SIZE_MB: int = 15
    CORS_ORIGINS: str = ""

    def get_allowed_origins(self) -> list[str]:
        configured = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        if self.ENVIRONMENT.lower() == "production":
            return [o for o in configured if o != "*"]
        if configured:
            return configured
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5001",
            "http://localhost:5173",
        ]

    class Config:
        case_sensitive = True

settings = Settings()

