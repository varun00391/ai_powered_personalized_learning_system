from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "LearnOS AI API"
    database_url: str = "postgresql+asyncpg://learnos:learnos@localhost:5432/learnos"
    jwt_secret: str = "change-me-in-production-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"


settings = Settings()
