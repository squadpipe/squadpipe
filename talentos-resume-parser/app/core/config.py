from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TalentOS Resume & Intake NLP Engine"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"
    MAX_FILE_SIZE_MB: int = 15

    class Config:
        case_sensitive = True

settings = Settings()

