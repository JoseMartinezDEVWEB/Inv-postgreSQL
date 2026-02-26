# backend-sqlite/src/models.py
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from .database import Base
from datetime import datetime

class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True, nullable=False)
    descripcion = Column(String, nullable=True)
    categoria = Column(String, index=True)
    precio = Column(Float, nullable=False)
    costo = Column(Float, nullable=True)
    stock = Column(Integer, default=0)
    codigo_barras = Column(String, unique=True, nullable=True)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Producto {self.nombre}>"