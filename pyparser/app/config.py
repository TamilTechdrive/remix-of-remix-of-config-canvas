"""Environment-driven configuration."""
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8800"))
    security_enabled: bool = os.getenv("SECURITY_ENABLED", "false").lower() == "true"
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")

    shards_dir: str = os.getenv("SHARDS_DIR", "./data/shards")
    batch_size: int = int(os.getenv("BATCH_SIZE", "1000"))

    db_dialect: str = os.getenv("DB_DIALECT", "mysql").lower()  # mysql | mssql | none
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: int = int(os.getenv("DB_PORT", "3306"))
    db_name: str = os.getenv("DB_NAME", "cf_parser")
    db_user: str = os.getenv("DB_USER", "root")
    db_password: str = os.getenv("DB_PASSWORD", "")
    db_driver: str = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")

    def db_url(self) -> str | None:
        if self.db_dialect == "mysql":
            return (
                f"mysql+pymysql://{self.db_user}:{self.db_password}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
            )
        if self.db_dialect == "mssql":
            from urllib.parse import quote_plus
            params = quote_plus(
                f"DRIVER={{{self.db_driver}}};SERVER={self.db_host},{self.db_port};"
                f"DATABASE={self.db_name};UID={self.db_user};PWD={self.db_password}"
            )
            return f"mssql+pyodbc:///?odbc_connect={params}"
        return None


settings = Settings()
os.makedirs(settings.shards_dir, exist_ok=True)
