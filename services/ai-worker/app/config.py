from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://oku:oku@localhost:5432/oku"
    r2_endpoint: str = "http://localhost:9000"
    r2_access_key_id: str = "minioadmin"
    r2_secret_access_key: str = "minioadmin"
    r2_bucket: str = "oku-media"
    r2_public_base_url: str = "http://localhost:9000/oku-media"
    r2_force_path_style: bool = True
    gemini_api_key: str = ""
    # LiteLLM model id for page extraction, used when no model has been saved in
    # the admin (the saved one wins). Google no longer serves 2.5 Flash to new
    # keys. 3.8 Flash transcribes equally well but was overloaded when this was
    # chosen (most calls failed with 503); 3.6 Flash answered in seconds.
    llm_model: str = "gemini/gemini-3.6-flash"
    # How much the model reasons before answering: "minimal", "low", "medium",
    # "high", or empty for the model's default. Reasoning is billed as output.
    llm_reasoning_effort: str = "low"
    # Tries per page before the page is marked failed (rate limits, outages, unusable output).
    llm_max_attempts: int = 5
    llm_timeout_sec: float = 180.0
    # Longest side, in pixels, of the page image sent to the model. Scans rarely
    # hold more detail than this; larger images only cost more.
    llm_image_max_side: int = 2000
    # Pages of one job extracted at the same time.
    ingest_page_concurrency: int = 2
    worker_poll_interval_sec: float = 2.0
    mock_llm: bool = False


settings = Settings()
