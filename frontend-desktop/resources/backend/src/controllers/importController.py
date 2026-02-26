# backend-sqlite/src/controllers/importController.py
from fastapi import APIRouter, UploadFile, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import pandas as pd
import io
import logging
from typing import List
from ..database import get_db
from .. import models, schemas

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/api/import/productos")
async def importar_productos(file: UploadFile, db: Session = Depends(get_db)):
    try:
        # Leer el archivo
        contents = await file.read()
        
        # Determinar el tipo de archivo
        if file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(contents))
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Formato de archivo no soportado")
        
        # Validar columnas mínimas requeridas
        required_columns = ['nombre', 'categoria', 'precio']
        for col in required_columns:
            if col not in df.columns:
                # Intentar mapear columnas similares
                matching_cols = [c for c in df.columns if col in str(c).lower()]
                if matching_cols:
                    df.rename(columns={matching_cols[0]: col}, inplace=True)
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Columna requerida no encontrada: {col}"
                    )
        
        # Convertir a formato de salida
        productos = df.to_dict('records')
        productos_creados = []
        
        # Validar y guardar cada producto
        for producto_data in productos:
            try:
                # Validar y limpiar datos
                if 'precio' in producto_data:
                    try:
                        producto_data['precio'] = float(producto_data['precio'])
                    except (ValueError, TypeError):
                        producto_data['precio'] = 0.0
                
                # Asegurar que los campos requeridos tengan valores por defecto
                producto_data['activo'] = producto_data.get('activo', True)
                producto_data['stock'] = int(producto_data.get('stock', 0))
                
                # Verificar si el producto ya existe
                db_producto = db.query(models.Producto).filter(
                    models.Producto.nombre == str(producto_data['nombre'])
                ).first()
                
                if db_producto:
                    # Actualizar producto existente
                    for key, value in producto_data.items():
                        if hasattr(db_producto, key):
                            setattr(db_producto, key, value)
                else:
                    # Crear nuevo producto
                    db_producto = models.Producto(**{
                        'nombre': str(producto_data['nombre']),
                        'categoria': str(producto_data['categoria']),
                        'precio': float(producto_data['precio']),
                        'stock': int(producto_data.get('stock', 0)),
                        'descripcion': str(producto_data.get('descripcion', '')),
                        'codigo_barras': str(producto_data.get('codigo_barras', '')) if producto_data.get('codigo_barras') else None,
                        'activo': bool(producto_data.get('activo', True))
                    })
                    db.add(db_producto)
                
                db.commit()
                db.refresh(db_producto)
                productos_creados.append(db_producto)
                
            except Exception as e:
                db.rollback()
                logger.error(f"Error al procesar producto {producto_data.get('nombre')}: {str(e)}")
                continue
        
        return {
            "success": True,
            "message": f"Se importaron {len(productos_creados)} productos correctamente",
            "data": [{
                "id": p.id,
                "nombre": p.nombre,
                "categoria": p.categoria,
                "precio": p.precio,
                "stock": p.stock
            } for p in productos_creados]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al procesar archivo: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error al procesar el archivo: {str(e)}"
        )