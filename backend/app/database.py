from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, DateTime, Float, String, Text, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from .config import DATABASE_URL

_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_utcnow, index=True)
    image_file: Mapped[str] = mapped_column(String(128))
    original_name: Mapped[str] = mapped_column(String(255), default="")
    class_name: Mapped[str] = mapped_column(String(128))
    plant: Mapped[str] = mapped_column(String(64))
    disease: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16))
    confidence: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text)
    prevention: Mapped[list] = mapped_column(JSON)
    treatment: Mapped[list] = mapped_column(JSON)
    top_predictions: Mapped[list] = mapped_column(JSON)
    verdict: Mapped[str | None] = mapped_column(String(16), nullable=True)      # confident / uncertain / unrecognised
    notes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    crop_hint: Mapped[str | None] = mapped_column(String(64), nullable=True)    # crop chosen by the user, if any

    def to_dict(self) -> dict:
        verdict = self.verdict or "confident"
        return {
            "verdict": verdict, "notes": self.notes or [], "crop_hint": self.crop_hint,
            "low_confidence": verdict != "confident",
            "id": self.id, "created_at": self.created_at.isoformat() + "Z",
            "image_url": f"/uploads/{self.image_file}", "original_name": self.original_name,
            "class_name": self.class_name, "plant": self.plant, "disease": self.disease, "status": self.status,
            "confidence": f"{self.confidence * 100:.1f}%", "confidence_value": round(self.confidence * 100, 2),
            "description": self.description, "prevention": self.prevention, "treatment": self.treatment,
            "top_predictions": self.top_predictions, "report_url": f"/report/{self.id}",
        }


def init_db() -> None:
    Base.metadata.create_all(engine)
    # tiny migration: add columns introduced after the table was first created
    existing = {c["name"] for c in inspect(engine).get_columns("predictions")}
    with engine.begin() as conn:
        for col in Prediction.__table__.columns:
            if col.name not in existing:
                conn.execute(text(f"ALTER TABLE predictions ADD COLUMN {col.name} {col.type.compile(engine.dialect)}"))
