#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para importar productos desde archivos XLSX o PDF
Versión mejorada y robusta para integración con backend Node.js
"""

import sys
import json
import os
import pandas as pd
import io
import re
from typing import List, Dict, Any
import traceback

# Configurar encoding para salida estándar (importante para Windows/Node.js)
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def limpiar_texto(texto: Any) -> str:
    """Limpia y normaliza texto"""
    if pd.isna(texto) or texto is None:
        return ""
    return str(texto).strip()

def parsear_numero(valor: Any) -> float:
    """Convierte un valor a número, manejando diferentes formatos"""
    if pd.isna(valor) or valor is None or valor == '':
        return 0.0
    
    if isinstance(valor, (int, float)):
        return float(valor)
        
    s_valor = str(valor).strip()
    # Eliminar símbolos de moneda y separadores de miles
    s_valor = s_valor.replace('$', '').replace('€', '').replace(',', '')
    
    try:
        return float(s_valor)
    except ValueError:
        return 0.0


# Formato "Reporte de inventario": líneas tipo "ARTICULO ... UDS CANTIDAD COSTO RD$ TOTAL"
# Ej: ACEITE EL GALLEGO DE SOBRE UNI UDS 8.00 15.00 RD$ 120.00  o  CHULETA LIB UDS 77.44 105.00 RD$ 8,131.20
_REPORTE_INVENTARIO_LINEA = re.compile(
    r'^(.+?)\s+(\d+[\.,]?\d*)\s+(\d+[\.,]?\d*)\s+RD\$?\s*([\d\s,\.]+)\s*$',
    re.IGNORECASE
)
# Versión greedy del nombre para no cortar en números intermedios (ej. "EL GALLO 8/1")
_REPORTE_INVENTARIO_LINEA_GREEDY = re.compile(
    r'^(.+)\s+(\d+[\.,]?\d*)\s+(\d+[\.,]?\d*)\s+RD\$?\s*([\d\s,\.]+)\s*$',
    re.IGNORECASE
)
_UNIDADES_SUFIJO = frozenset({'UDS', 'PAQ', 'LIB', 'UNI', 'UND', 'UNIDAD', 'UNIDADES', 'UNID'})
_HEADERS_SALTAR = frozenset({
    'articulo', 'unidad', 'cantidad', 'costo', 'total', 'observación', 'observacion',
    'nombre', 'descripcion', 'producto', 'item', 'codigo', 'subtotal'
})

# Patrón para extraer montos: "Etiqueta RD$ 1,234.56" o "Etiqueta $ 1,234.56"
_PATRON_MONTO = re.compile(
    r'(?:RD\$|[\$])\s*([\d\s,\.]+)',
    re.IGNORECASE
)


def _extraer_monto_linea(linea: str) -> float:
    """Extrae el primer monto (RD$ o $) de una línea."""
    m = _PATRON_MONTO.search(linea)
    if not m:
        return 0.0
    s = m.group(1).replace(' ', '').replace(',', '')
    try:
        return float(s)
    except ValueError:
        return 0.0


def _extraer_porcentaje_linea(linea: str) -> float:
    """Extrae un porcentaje de una línea (ej. '18.73 %' o '24.43 %')."""
    m = re.search(r'(\d+[\.,]?\d*)\s*%', linea)
    if not m:
        return 0.0
    s = m.group(1).replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return 0.0


def _extraer_balance_y_distribucion(texto_completo: str) -> Dict[str, Dict[str, Any]]:
    """
    Extrae Balance General y Distribución de Saldo del texto de un PDF
    (formato Infocolmados / reporte de inventario con Balance y Distribución).
    Retorna { 'balanceGeneral': {...}, 'distribucionSaldo': {...} } con los campos encontrados.
    """
    if not texto_completo or len(texto_completo.strip()) < 50:
        return {}
    texto_upper = texto_completo.upper()
    balance = {}
    distribucion = {}
    lineas = texto_completo.split('\n')

    # --- Balance General ---
    if 'BALANCE GENERAL' in texto_upper:
        for i, linea in enumerate(lineas):
            lin = linea.strip()
            lin_upper = lin.upper()
            if not lin:
                continue
            val = _extraer_monto_linea(lin)
            if 'EFECTIVO' in lin_upper and ('CAJA' in lin_upper or 'BANCO' in lin_upper):
                balance['efectivo_caja_banco'] = val
            elif 'COBRAR' in lin_upper or 'FIAO' in lin_upper:
                if 'cuentas_por_cobrar' not in balance:
                    balance['cuentas_por_cobrar'] = val
            elif 'INVENTARIO' in lin_upper and 'MERCANCIA' in lin_upper:
                balance['valor_inventario'] = val
            elif 'DEUDA' in lin_upper and 'NEGOCIO' in lin_upper:
                balance['deuda_a_negocio'] = val
            elif 'ACTIVOS FIJOS' in lin_upper:
                balance['activos_fijos'] = val
            elif 'TOTAL ACTIVOS' in lin_upper or 'TOTAL ACTIVOS' in lin:
                if val > 0:
                    balance['total_activos'] = val
            elif 'CORRIENTES' in lin_upper and 'TOTAL' in lin_upper:
                balance['total_corrientes'] = val
            elif 'TOTAL FIJOS' in lin_upper:
                balance['total_fijos'] = val
            elif 'POR PAGAR' in lin_upper or 'CTAS. POR PAGAR' in lin_upper or 'SUPLIDORES' in lin_upper:
                balance['cuentas_por_pagar'] = val
            elif 'TOTAL PASIVOS' in lin_upper and 'CAPITAL' not in lin_upper:
                balance['total_pasivos'] = val
            elif 'CAPITAL' in lin_upper and ('TRABAJO' in lin_upper or 'CONTABLE' in lin_upper):
                balance['capital_contable'] = val
            elif 'PASIVOS + CAPITAL' in lin_upper or 'PASIVOS Y CAPITAL' in lin_upper:
                balance['total_pasivos_mas_capital'] = val
            elif 'VENTAS' in lin_upper and ('MES' in lin_upper or 'DEL' in lin_upper or '$' in lin):
                balance['ventas_del_mes'] = val
            elif 'GASTOS' in lin_upper or 'PAGO DE INVENTARIO' in lin_upper:
                if val > 0 and 'gastos_generales' not in balance:
                    balance['gastos_generales'] = val
            elif 'UTILIDAD NETA' in lin_upper:
                balance['utilidad_neta'] = val
            elif 'UTILIDAD BRUTA' in lin_upper:
                balance['utilidad_bruta'] = val
            elif 'PORCIENTO NETO' in lin_upper or 'PORCENTAJE NETO' in lin_upper:
                balance['porcentaje_neto'] = val if val > 0 else _extraer_porcentaje_linea(lin)
            elif 'PORCIENTO BRUTO' in lin_upper or 'PORCENTAJE BRUTO' in lin_upper:
                balance['porcentaje_bruto'] = val if val > 0 else _extraer_porcentaje_linea(lin)
        # Deuda a negocio: a veces aparece como "EMILIO RD$" o nombre + RD$
        if 'deuda_a_negocio' not in balance:
            for linea in lineas:
                if re.search(r'RD\$?\s*[\d\s,\.]+', linea) and 'INVENTARIO' not in linea.upper() and 'COBRAR' not in linea.upper():
                    if 'EMILIO' in linea.upper() or 'ADEUDADA' in linea.upper() or 'CUENTA' in linea.upper():
                        v = _extraer_monto_linea(linea)
                        if v > 0:
                            balance['deuda_a_negocio'] = v
                            break

    # --- Distribución de Saldo (usar mismos datos que Balance cuando aplique) ---
    if 'DISTRIBUCION' in texto_upper and 'SALDO' in texto_upper:
        for i, linea in enumerate(lineas):
            lin = linea.strip()
            lin_upper = lin.upper()
            val = _extraer_monto_linea(lin)
            if 'EFECTIVO' in lin_upper or 'CAJA' in lin_upper:
                distribucion['efectivo_caja_banco'] = val or balance.get('efectivo_caja_banco', 0)
            elif 'INVENTARIO' in lin_upper:
                distribucion['inventario_mercancia'] = val or balance.get('valor_inventario', 0)
            elif 'ACTIVOS FIJOS' in lin_upper:
                distribucion['activos_fijos'] = val or balance.get('activos_fijos', 0)
            elif 'COBRAR' in lin_upper:
                distribucion['cuentas_por_cobrar'] = val or balance.get('cuentas_por_cobrar', 0)
            elif 'PAGAR' in lin_upper:
                distribucion['cuentas_por_pagar'] = val or balance.get('cuentas_por_pagar', 0)
            elif 'OTROS' in lin_upper:
                distribucion['otros'] = val
    else:
        # Si no hay sección Distribución, rellenar desde Balance para la vista
        if balance:
            distribucion['efectivo_caja_banco'] = balance.get('efectivo_caja_banco', 0)
            distribucion['inventario_mercancia'] = balance.get('valor_inventario', 0)
            distribucion['activos_fijos'] = balance.get('activos_fijos', 0)
            distribucion['cuentas_por_cobrar'] = balance.get('cuentas_por_cobrar', 0)
            distribucion['cuentas_por_pagar'] = balance.get('cuentas_por_pagar', 0)
            distribucion['otros'] = balance.get('otros', 0)
    if balance and 'cuentas_por_pagar' not in distribucion:
        distribucion['cuentas_por_pagar'] = balance.get('cuentas_por_pagar', 0)

    result = {}
    if balance:
        result['balanceGeneral'] = balance
    if distribucion:
        result['distribucionSaldo'] = distribucion
    return result


def _extraer_productos_desde_lineas_texto(lineas: List[str]) -> List[Dict[str, Any]]:
    """
    Extrae productos de líneas de texto en formato reporte de inventario:
    'Nombre Artículo [Unidad] CANTIDAD COSTO RD$ TOTAL'
    """
    productos = []
    for linea in lineas:
        linea_limpia = linea.strip()
        if not linea_limpia or len(linea_limpia) < 10:
            continue
        # Saltar cabeceras y metadatos
        if linea_limpia.lower().startswith('fecha :') or linea_limpia.lower().startswith('lineas ') or \
           linea_limpia.lower().startswith('total rd$') or linea_limpia.lower().startswith('contador ') or \
           'pag.' in linea_limpia.lower() or linea_limpia.lower().startswith('tel') or \
           linea_limpia.lower().startswith('inventario no:'):
            continue
        if linea_limpia.upper().startswith('ARTICULO UNIDAD CANTIDAD'):
            continue
        m = _REPORTE_INVENTARIO_LINEA_GREEDY.match(linea_limpia) or _REPORTE_INVENTARIO_LINEA.match(linea_limpia)
        if not m:
            continue
        nombre_raw, str_cant, str_costo, str_total = m.group(1).strip(), m.group(2), m.group(3), m.group(4)
        cantidad = parsear_numero(str_cant)
        costo = parsear_numero(str_costo)
        total = parsear_numero(str_total.replace(' ', '').replace(',', ''))
        if cantidad <= 0 or cantidad > 100000:
            cantidad = 1
        if costo < 0 or costo >= 1000000:
            continue
        # Limpiar nombre: quitar palabras de unidad al final (UDS, PAQ, LIB, etc.)
        partes = nombre_raw.split()
        while partes and partes[-1].upper() in _UNIDADES_SUFIJO:
            partes.pop()
        nombre = ' '.join(partes).strip() if partes else nombre_raw.strip()
        if not nombre or len(nombre) < 2:
            continue
        if nombre.lower() in _HEADERS_SALTAR:
            continue
        productos.append({
            'nombre': nombre,
            'codigoBarras': None,
            'cantidad': int(cantidad) if cantidad == int(cantidad) else int(round(cantidad)),
            'precio': costo,
            'categoria': 'General',
            'costoBase': costo
        })
    return productos

def procesar_excel(archivo_path: str) -> List[Dict[str, Any]]:
    """Procesa un archivo Excel y retorna una lista de diccionarios"""
    try:
        print(f"[DEBUG] Iniciando procesamiento Excel: {archivo_path}", file=sys.stderr)
        
        # Leer TODAS las hojas del Excel
        # sheet_name=None devuelve un dict {nombre_hoja: DataFrame}
        xls = pd.read_excel(archivo_path, sheet_name=None, dtype=str)
        
        all_productos = []
        
        print(f"[DEBUG] Excel leído. Hojas encontradas: {list(xls.keys())}", file=sys.stderr)
        
        for sheet_name, df in xls.items():
            print(f"[DEBUG] Procesando hoja: {sheet_name}. Filas: {len(df)}", file=sys.stderr)
            
            # Normalizar nombres de columnas (minusculas, sin acentos, sin espacios extra)
            df.columns = df.columns.astype(str).str.strip().str.lower()
            
            # Mapeo de posibles nombres de columnas - ENFOQUE: Nombre, Cantidad, Costo, Total, Código
            mapa_columnas = {
                'nombre': ['nombre', 'producto', 'descripción', 'descripcion', 'articulo', 'item', 'description'],
                'cantidad': ['cantidad', 'cant', 'qty', 'unidad', 'unidades', 'stock', 'existencia'],
                'costo': ['costo', 'costo unitario', 'precio unitario', 'valor unitario', 'precio', 'pvp', 'cost'],
                'total': ['total', 'valor total', 'importe', 'monto total'],
                'categoria': ['categoria', 'categoría', 'grupo', 'familia', 'departamento', 'category'],
                'codigo': ['codigo', 'código', 'barcode', 'sku', 'ref', 'referencia', 'id', 'cod', 'code']
            }
            
            # Identificar columnas
            columnas_encontradas = {}
            for campo_destino, posibles_nombres in mapa_columnas.items():
                for posible in posibles_nombres:
                    match = next((col for col in df.columns if posible in col), None)
                    if match:
                        columnas_encontradas[campo_destino] = match
                        break
            
            # Si no encontramos columna nombre en esta hoja, intentamos con la primera columna de texto
            # Pero si la hoja está vacía o no tiene estructura válida, la saltamos
            if 'nombre' not in columnas_encontradas:
                if len(df.columns) > 0:
                     # Heurística: la columna de nombre suele ser la que tiene strings más largos
                     # O simplemente la primera/segunda columna
                     columnas_encontradas['nombre'] = df.columns[0]
                else:
                    print(f"[DEBUG] Saltando hoja {sheet_name}: No se identificó columna nombre", file=sys.stderr)
                    continue

            for _, row in df.iterrows():
                nombre = limpiar_texto(row.get(columnas_encontradas.get('nombre')))
                
                # Saltar filas vacías o headers
                if not nombre or len(nombre) < 2:
                    continue
                
                # Filtrar headers comunes
                headers_comunes = ['nombre', 'descripcion', 'articulo', 'producto', 'item', 'cantidad', 'costo', 'precio', 'total', 'codigo', 'barcode']
                if nombre.lower().strip() in headers_comunes:
                    continue
                
                # Extraer cantidad (PRIORIDAD ALTA)
                cantidad = 1  # Valor por defecto
                if 'cantidad' in columnas_encontradas:
                    cantidad_val = parsear_numero(row.get(columnas_encontradas.get('cantidad')))
                    if cantidad_val > 0:
                        cantidad = int(cantidad_val) if cantidad_val <= 100000 else 1
                
                # Extraer costo unitario (PRIORIDAD ALTA)
                costo = 0
                if 'costo' in columnas_encontradas:
                    costo = parsear_numero(row.get(columnas_encontradas.get('costo')))
                
                # Si tenemos total pero no costo, calcular costo = total / cantidad
                if 'total' in columnas_encontradas and costo == 0 and cantidad > 0:
                    total_val = parsear_numero(row.get(columnas_encontradas.get('total')))
                    if total_val > 0:
                        costo = total_val / cantidad
                
                # Si tenemos total pero no cantidad, calcular cantidad = total / costo
                if 'total' in columnas_encontradas and cantidad == 1 and costo > 0:
                    total_val = parsear_numero(row.get(columnas_encontradas.get('total')))
                    if total_val > 0:
                        cantidad = int(total_val / costo) or 1
                
                # Si no encontramos costo, buscar en otras columnas numéricas
                if costo == 0:
                    for col in df.columns:
                        if col not in [columnas_encontradas.get('nombre'), columnas_encontradas.get('cantidad'), columnas_encontradas.get('total')]:
                            val = parsear_numero(row.get(col))
                            if val > 0 and val < 1000000:
                                costo = val
                                break
                
                # Extraer código de barras
                codigo_barras = None
                if 'codigo' in columnas_encontradas:
                    val_codigo = row.get(columnas_encontradas.get('codigo'))
                    if not pd.isna(val_codigo):
                        codigo_barras = str(val_codigo).strip()
                        if codigo_barras.lower() in ['nan', 'none', 'null', '']:
                             codigo_barras = None

                # Agregar producto si tenemos nombre válido
                if nombre and len(nombre) >= 2:
                    categoria = 'General'
                    if 'categoria' in columnas_encontradas:
                        cat_val = limpiar_texto(row.get(columnas_encontradas.get('categoria')))
                        if cat_val and len(cat_val) > 2:
                            categoria = cat_val

                    producto = {
                        'nombre': nombre,
                        'codigoBarras': codigo_barras,
                        'cantidad': cantidad,
                        'precio': costo if costo > 0 else 0,
                        'costoBase': costo if costo > 0 else 0,
                        'categoria': categoria,
                        'unidad': 'unidad'
                    }
                    all_productos.append(producto)
        
        print(f"[DEBUG] Total productos encontrados en todas las hojas: {len(all_productos)}", file=sys.stderr)
        return all_productos

    except Exception as e:
        print(f"[DEBUG] ERROR procesando Excel: {str(e)}", file=sys.stderr)
        import traceback
        print(f"[DEBUG] Traceback Excel: {traceback.format_exc()}", file=sys.stderr)
        return {'error': f'Error procesando Excel: {str(e)}'}

def procesar_pdf_con_gemini(archivo_path: str, api_key: str) -> List[Dict[str, Any]]:
    """
    Procesa un PDF usando Gemini AI para extraer productos con prompt estricto JSON
    """
    try:
        import pdfplumber
        import google.generativeai as genai
        
        # Extraer texto del PDF primero
        texto_completo = ""
        with pdfplumber.open(archivo_path) as pdf:
            for page in pdf.pages:
                texto_pagina = page.extract_text()
                if texto_pagina:
                    texto_completo += texto_pagina + "\n"
        
        if not texto_completo or len(texto_completo.strip()) < 10:
            return {'error': 'No se pudo extraer texto del PDF. El archivo podría estar escaneado o protegido.'}
        
        # Configurar Gemini
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-pro')
        
        # Prompt estricto para obtener solo JSON
        system_prompt = """Eres un asistente que extrae información de inventarios de documentos. 
Analiza el siguiente texto de un inventario y extrae todos los productos listados.

IMPORTANTE: Debes responder ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, sin explicaciones.

El formato de respuesta debe ser exactamente:
[
  {
    "nombre": "Nombre del producto",
    "codigoBarras": "código o SKU si está disponible",
    "cantidad": número,
    "precio": número
  }
]

Si no encuentras información completa para algún campo, usa valores por defecto:
- codigoBarras: "" (string vacío)
- cantidad: 1
- precio: 0

Responde SOLO con el array JSON, sin texto adicional."""
        
        prompt = f"{system_prompt}\n\nTexto del documento:\n{texto_completo[:8000]}"  # Limitar a 8000 chars
        
        # Llamar a Gemini
        response = model.generate_content(prompt)
        
        # Extraer JSON de la respuesta (puede venir con markdown code blocks)
        respuesta_texto = response.text.strip()
        
        # Eliminar markdown code blocks si existen
        if respuesta_texto.startswith('```'):
            # Remover ```json o ``` al inicio y ``` al final
            lineas = respuesta_texto.split('\n')
            lineas = [l for l in lineas if not l.strip().startswith('```')]
            respuesta_texto = '\n'.join(lineas)
        
        # Parsear JSON
        try:
            productos = json.loads(respuesta_texto)
            
            # Validar que sea una lista
            if not isinstance(productos, list):
                return {'error': 'La respuesta de la IA no es un array válido'}
            
            # Normalizar productos al formato esperado
            productos_normalizados = []
            for p in productos:
                producto_normalizado = {
                    'nombre': limpiar_texto(p.get('nombre', '')),
                    'codigoBarras': limpiar_texto(p.get('codigoBarras', '')),
                    'cantidad': int(parsear_numero(p.get('cantidad', 1))),
                    'precio': parsear_numero(p.get('precio', 0)),
                    'categoria': 'General',
                    'costoBase': parsear_numero(p.get('precio', 0))  # Mapear precio a costoBase
                }
                
                if producto_normalizado['nombre']:
                    productos_normalizados.append(producto_normalizado)
            
            if not productos_normalizados:
                return {'error': 'No se encontraron productos válidos en el documento'}
            
            return productos_normalizados
            
        except json.JSONDecodeError as e:
            return {'error': f'Error al parsear respuesta de la IA como JSON: {str(e)}. Respuesta recibida: {respuesta_texto[:200]}'}
        
    except ImportError as e:
        if 'google.generativeai' in str(e):
            return {'error': 'Librería google-generativeai no instalada. Instala con: pip install google-generativeai'}
        return {'error': f'Librería requerida no instalada: {str(e)}'}
    except Exception as e:
        return {'error': f'Error procesando PDF con Gemini: {str(e)}'}

def procesar_pdf(archivo_path: str, api_key: str = None) -> List[Dict[str, Any]]:
    """
    Procesamiento de PDF: Si hay API key, usa Gemini. Si no, usa extracción básica con pdfplumber.
    """
    # Si hay API key, usar Gemini
    if api_key and api_key.strip():
        resultado = procesar_pdf_con_gemini(archivo_path, api_key.strip())
        if isinstance(resultado, list):
            return resultado
        # Si falló Gemini, intentar método básico como fallback
        if 'error' in resultado:
            pass  # Continuar con método básico
    
    # Método básico con pdfplumber (fallback o cuando no hay API key)
    try:
        import pdfplumber
        import re
        productos = []
        
        print(f"[DEBUG] Iniciando procesamiento PDF básico: {archivo_path}", file=sys.stderr)
        with pdfplumber.open(archivo_path) as pdf:
            print(f"[DEBUG] PDF abierto. Total de páginas: {len(pdf.pages)}", file=sys.stderr)
            for page_num, page in enumerate(pdf.pages):
                print(f"[DEBUG] Procesando página {page_num + 1}", file=sys.stderr)
                productos_encontrados_texto = 0  # Inicializar contador para esta página ANTES de cualquier uso
                # ESTRATEGIA 1: Intentar extraer tablas
                tablas = page.extract_tables()
                print(f"[DEBUG] Página {page_num + 1}: {len(tablas) if tablas else 0} tablas encontradas", file=sys.stderr)
                
                if tablas:
                    for tabla in tablas:
                        if not tabla or len(tabla) < 2: continue
                        
                        header = [str(c).lower().strip() if c else '' for c in tabla[0]]
                        
                        # Buscar índices de columnas - ENFOQUE: Nombre, Cantidad, Costo, Total, Código
                        idx_nombre = -1
                        idx_costo = -1
                        idx_cantidad = -1
                        idx_total = -1
                        idx_codigo = -1
                        
                        for i, col in enumerate(header):
                            col_lower = col.lower()
                            # Prioridad 1: Nombre del producto
                            if 'nombre' in col_lower or 'descrip' in col_lower or 'articulo' in col_lower or 'producto' in col_lower or 'item' in col_lower:
                                if idx_nombre == -1:  # Tomar el primero que encuentre
                                    idx_nombre = i
                            # Prioridad 2: Código/Barcode
                            elif 'codigo' in col_lower or 'código' in col_lower or 'barcode' in col_lower or 'sku' in col_lower or 'ref' in col_lower:
                                if idx_codigo == -1:
                                    idx_codigo = i
                            # Prioridad 3: Cantidad
                            elif 'cantidad' in col_lower or 'cant' in col_lower or 'qty' in col_lower or 'unidad' in col_lower:
                                if idx_cantidad == -1:
                                    idx_cantidad = i
                            # Prioridad 4: Costo/Precio unitario
                            elif ('costo' in col_lower or 'precio' in col_lower or 'valor unitario' in col_lower) and 'total' not in col_lower:
                                if idx_costo == -1:
                                    idx_costo = i
                            # Prioridad 5: Total (si existe, puede ayudar a calcular cantidad o costo)
                            elif 'total' in col_lower and ('costo' not in col_lower and 'precio' not in col_lower):
                                if idx_total == -1:
                                    idx_total = i
                        
                        # Determinar inicio de datos (saltar header)
                        start_idx = 1 if (idx_nombre != -1 or idx_costo != -1) else 0
                        
                        for fila in tabla[start_idx:]:
                            if not fila: continue
                            
                            p_nombre = ""
                            p_precio = 0
                            p_cantidad = 1
                            p_codigo = None
                            
                            # Extraer nombre (OBLIGATORIO)
                            if idx_nombre != -1 and len(fila) > idx_nombre:
                                p_nombre = limpiar_texto(fila[idx_nombre])
                            elif len(fila) >= 2:
                                p_nombre = limpiar_texto(fila[1])
                            elif len(fila) >= 1:
                                p_nombre = limpiar_texto(fila[0])
                            
                            # Filtrar filas vacías o que sean headers
                            if not p_nombre or len(p_nombre) < 2:
                                continue
                            
                            # Filtrar si parece ser un header repetido
                            headers_comunes = ['nombre', 'descripcion', 'articulo', 'producto', 'item', 'codigo', 'cantidad', 'costo', 'precio', 'total', 'subtotal']
                            if p_nombre.lower().strip() in headers_comunes:
                                continue

                            # Extraer Código (si column detected)
                            if idx_codigo != -1 and len(fila) > idx_codigo:
                                raw_code = limpiar_texto(fila[idx_codigo])
                                if raw_code and len(raw_code) > 1 and raw_code.lower() not in ['none', 'null', 'nan']:
                                    p_codigo = raw_code

                            # Extraer cantidad (PRIORIDAD ALTA)
                            p_cantidad = 1  # Valor por defecto
                            if idx_cantidad != -1 and len(fila) > idx_cantidad:
                                p_cantidad = int(parsear_numero(fila[idx_cantidad])) or 1
                            else:
                                # Buscar cantidad en las primeras columnas numéricas
                                for i in range(min(3, len(fila))):
                                    val = parsear_numero(fila[i])
                                    if val > 0 and val <= 100000:  # Cantidad razonable
                                        p_cantidad = int(val)
                                        break

                            # Extraer costo unitario (PRIORIDAD ALTA)
                            p_costo = 0
                            if idx_costo != -1 and len(fila) > idx_costo:
                                p_costo = parsear_numero(fila[idx_costo])
                            else:
                                # Buscar costo en columnas numéricas (no total)
                                for i in range(len(fila)):
                                    if i == idx_total:  # Saltar columna de total
                                        continue
                                    val = parsear_numero(fila[i])
                                    if val > 0 and val < 1000000:  # Costo razonable
                                        p_costo = val
                                        break
                            
                            # Si tenemos total pero no costo, calcular costo = total / cantidad
                            if idx_total != -1 and len(fila) > idx_total and p_costo == 0 and p_cantidad > 0:
                                total_val = parsear_numero(fila[idx_total])
                                if total_val > 0:
                                    p_costo = total_val / p_cantidad
                            
                            # Si tenemos total pero no cantidad, calcular cantidad = total / costo
                            if idx_total != -1 and len(fila) > idx_total and p_cantidad == 1 and p_costo > 0:
                                total_val = parsear_numero(fila[idx_total])
                                if total_val > 0:
                                    p_cantidad = int(total_val / p_costo) or 1

                            # Validar que tengamos al menos nombre y costo
                            if p_costo <= 0:
                                # Intentar una última vez buscar cualquier número como costo
                                for cell in reversed(fila):
                                    val = parsear_numero(cell)
                                    if val > 0 and val < 1000000:
                                        p_costo = val
                                        break
                            
                            # Solo agregar si tenemos nombre válido
                            if len(p_nombre) >= 2:
                                productos.append({
                                    'nombre': p_nombre,
                                    'codigoBarras': p_codigo,
                                    'cantidad': p_cantidad,
                                    'precio': p_costo,  # Costo unitario
                                    'categoria': 'General',
                                    'unidad': 'unidad',
                                    'costoBase': p_costo
                                })
                                print(f"[DEBUG] Producto agregado desde tabla: {p_nombre[:30]}... (cod: {p_codigo}, costo: {p_costo})", file=sys.stderr)
                
                # ESTRATEGIA 2: Extraer de texto (formato "Reporte de inventario" o genérico)
                texto = page.extract_text()
                if texto:
                    lineas = texto.split('\n')
                    print(f"[DEBUG] Página {page_num + 1}: texto {len(texto)} caracteres, {len(lineas)} líneas", file=sys.stderr)
                    # 2a) Formato reporte inventario: "ARTICULO ... CANTIDAD COSTO RD$ TOTAL"
                    productos_reporte = _extraer_productos_desde_lineas_texto(lineas)
                    if productos_reporte:
                        productos.extend(productos_reporte)
                        productos_encontrados_texto += len(productos_reporte)
                        print(f"[DEBUG] Página {page_num + 1}: {len(productos_reporte)} productos desde formato reporte (RD$)", file=sys.stderr)
                    # 2b) Si no hubo productos con formato reporte, intentar patrón genérico (líneas con texto + números)
                    if not productos_reporte:
                        for linea in lineas:
                            linea_limpia = linea.strip()
                            if not linea_limpia or len(linea_limpia) < 3:
                                continue
                            
                            # Filtrar headers comunes
                            if linea_limpia.lower() in ['nombre', 'descripcion', 'articulo', 'producto', 'item', 'cantidad', 'costo', 'precio', 'total', 'subtotal']:
                                continue
                            
                            # Patrón mejorado: "Nombre Cantidad Costo" o "Nombre Costo" o "Nombre Cantidad Costo Total"
                            # Buscar múltiples números en la línea
                            numeros = re.findall(r'[\$]?\s*(\d+[\.,]?\d*)', linea_limpia)
                            
                            if len(numeros) >= 1:
                                # Separar nombre y números
                                # El nombre suele estar al inicio, antes del primer número
                                primer_numero_pos = linea_limpia.find(numeros[0])
                                nombre_match = linea_limpia[:primer_numero_pos].strip()
                                
                                # Limpiar nombre de caracteres especiales al final
                                nombre_match = re.sub(r'[:\|\-\s]+$', '', nombre_match).strip()
                                
                                if len(nombre_match) >= 3:
                                    # Convertir números encontrados
                                    numeros_float = []
                                    for num_str in numeros:
                                        try:
                                            num_val = float(num_str.replace(',', '.'))
                                            if num_val > 0:
                                                numeros_float.append(num_val)
                                        except:
                                            continue
                                    
                                    if numeros_float:
                                        cantidad = 1
                                        costo = 0
                                        
                                        if len(numeros_float) == 1:
                                            # Solo un número: asumir que es el costo
                                            costo = numeros_float[0]
                                        elif len(numeros_float) == 2:
                                            # Dos números: cantidad y costo
                                            cantidad = int(numeros_float[0]) if numeros_float[0] <= 100000 else 1
                                            costo = numeros_float[1]
                                        elif len(numeros_float) >= 3:
                                            # Tres o más números: cantidad, costo, total
                                            cantidad = int(numeros_float[0]) if numeros_float[0] <= 100000 else 1
                                            costo = numeros_float[1]
                                            # El tercer número podría ser total (verificar si coincide con cantidad * costo)
                                        
                                        # Validar costo razonable - PERMITIR productos sin costo también
                                        # Agregar producto si tiene nombre válido, incluso sin costo
                                        if len(nombre_match) >= 3:
                                            if costo >= 0 and costo < 1000000:
                                                productos.append({
                                                    'nombre': nombre_match,
                                                    'codigoBarras': None,
                                                    'cantidad': cantidad,
                                                    'precio': costo if costo > 0 else 0,
                                                    'categoria': 'General',
                                                    'costoBase': costo if costo > 0 else 0
                                                })
                                                productos_encontrados_texto += 1
                                                if costo > 0:
                                                    print(f"[DEBUG] Producto agregado desde texto: {nombre_match[:30]}... (cantidad: {cantidad}, costo: {costo})", file=sys.stderr)
                                                else:
                                                    print(f"[DEBUG] Producto sin costo agregado desde texto: {nombre_match[:30]}... (cantidad: {cantidad})", file=sys.stderr)
                                            else:
                                                # Agregar producto sin costo si el costo no es válido
                                                productos.append({
                                                    'nombre': nombre_match,
                                                    'codigoBarras': None,
                                                    'cantidad': cantidad,
                                                    'precio': 0,
                                                    'categoria': 'General',
                                                    'costoBase': 0
                                                })
                                                productos_encontrados_texto += 1
                                                print(f"[DEBUG] Producto sin costo agregado desde texto (costo inválido): {nombre_match[:30]}... (cantidad: {cantidad})", file=sys.stderr)
                    # Mostrar resumen de productos encontrados en texto para esta página (fuera del bloque if texto:)
                    if productos_encontrados_texto > 0:
                        print(f"[DEBUG] Página {page_num + 1}: {productos_encontrados_texto} productos encontrados desde texto", file=sys.stderr)
                    else:
                        print(f"[DEBUG] Página {page_num + 1}: No se encontraron productos en texto", file=sys.stderr)

        # Filtrar productos duplicados por nombre
        productos_unicos = []
        nombres_vistos = set()
        for producto in productos:
            nombre_normalizado = producto['nombre'].lower().strip()
            if nombre_normalizado and nombre_normalizado not in nombres_vistos:
                nombres_vistos.add(nombre_normalizado)
                productos_unicos.append(producto)

        print(f"[DEBUG] Total productos antes de deduplicar: {len(productos)}", file=sys.stderr)
        print(f"[DEBUG] Total productos únicos después de deduplicar: {len(productos_unicos)}", file=sys.stderr)
        if productos_unicos:
            print(f"[DEBUG] Primeros 3 productos únicos: {[p['nombre'][:30] for p in productos_unicos[:3]]}", file=sys.stderr)

        if not productos_unicos:
            # Antes de devolver error, intentar al menos extraer Balance General y Distribución de Saldo (PDF puede ser solo financiero)
            texto_completo_early = ''
            try:
                with pdfplumber.open(archivo_path) as pdf:
                    for page in pdf.pages:
                        t = page.extract_text()
                        if t:
                            texto_completo_early += t + '\n'
            except Exception:
                pass
            datos_fin_early = _extraer_balance_y_distribucion(texto_completo_early) if texto_completo_early else {}
            if datos_fin_early:
                print("[DEBUG] No hay productos pero se extrajeron Balance/Distribución; devolviendo solo datos financieros", file=sys.stderr)
                return {
                    'productos': [],
                    'balanceGeneral': datos_fin_early.get('balanceGeneral', {}),
                    'distribucionSaldo': datos_fin_early.get('distribucionSaldo', {})
                }
            print("[DEBUG] ERROR: No se encontraron productos válidos después del procesamiento", file=sys.stderr)
            print("[DEBUG] Intentando estrategia alternativa: buscar cualquier línea con texto y números", file=sys.stderr)
            # Última estrategia: buscar cualquier línea que tenga texto seguido de números
            try:
                with pdfplumber.open(archivo_path) as pdf:
                    for page_num, page in enumerate(pdf.pages):
                        texto = page.extract_text()
                        if texto:
                            lineas = texto.split('\n')
                            for linea in lineas:
                                linea_limpia = linea.strip()
                                if len(linea_limpia) < 5:
                                    continue
                                # Buscar líneas con al menos 3 palabras y un número
                                palabras = linea_limpia.split()
                                if len(palabras) >= 2:
                                    # Buscar si hay algún número en la línea
                                    tiene_numero = any(re.search(r'\d', p) for p in palabras)
                                    if tiene_numero:
                                        # Intentar extraer nombre (primeras palabras) y número (último o cualquier número en la línea)
                                        nombre_candidato = ' '.join(palabras[:-1])[:50]  # Primeras palabras como nombre
                                        # Buscar números en todas las palabras, no solo la última
                                        numeros_en_linea = []
                                        for palabra in palabras:
                                            val = parsear_numero(palabra)
                                            if val > 0:
                                                numeros_en_linea.append(val)
                                        
                                        if len(nombre_candidato) >= 3:
                                            # Si hay números, usar el último como costo
                                            # Si no hay números, agregar el producto sin costo
                                            ultimo_valor = numeros_en_linea[-1] if numeros_en_linea else 0
                                            cantidad_alt = int(numeros_en_linea[0]) if len(numeros_en_linea) > 1 and numeros_en_linea[0] <= 100000 else 1
                                            
                                            # Verificar que no sea un duplicado
                                            nombre_normalizado_alt = nombre_candidato.lower().strip()
                                            if nombre_normalizado_alt not in nombres_vistos:
                                                nombres_vistos.add(nombre_normalizado_alt)
                                                productos_unicos.append({
                                                    'nombre': nombre_candidato,
                                                    'codigoBarras': None,
                                                    'cantidad': cantidad_alt,
                                                    'precio': ultimo_valor,
                                                    'categoria': 'General',
                                                    'costoBase': ultimo_valor
                                                })
                                                if ultimo_valor > 0:
                                                    print(f"[DEBUG] Producto encontrado con estrategia alternativa: {nombre_candidato[:30]}... (cantidad: {cantidad_alt}, costo: {ultimo_valor})", file=sys.stderr)
                                                else:
                                                    print(f"[DEBUG] Producto sin costo encontrado con estrategia alternativa: {nombre_candidato[:30]}... (cantidad: {cantidad_alt})", file=sys.stderr)
            except Exception as e:
                print(f"[DEBUG] Error en estrategia alternativa: {str(e)}", file=sys.stderr)
        
        if not productos_unicos:
            print("[DEBUG] ERROR FINAL: No se encontraron productos válidos con ninguna estrategia", file=sys.stderr)
            print("[DEBUG] Información del PDF:", file=sys.stderr)
            try:
                with pdfplumber.open(archivo_path) as pdf:
                    print(f"[DEBUG] - Total páginas: {len(pdf.pages)}", file=sys.stderr)
                    for i, page in enumerate(pdf.pages[:3]):  # Solo primeras 3 páginas
                        texto = page.extract_text()
                        if texto:
                            print(f"[DEBUG] - Página {i+1}: {len(texto)} caracteres, primeras 200 chars: {texto[:200]}", file=sys.stderr)
                        tablas = page.extract_tables()
                        print(f"[DEBUG] - Página {i+1}: {len(tablas) if tablas else 0} tablas", file=sys.stderr)
            except Exception as e:
                print(f"[DEBUG] Error obteniendo info del PDF: {str(e)}", file=sys.stderr)
            return {'error': 'No se pudieron extraer productos del PDF. El PDF podría no contener tablas o formato reconocible. Intenta usar una API Key de Gemini para PDFs complejos.'}

        # Fase 2: extraer Balance General y Distribución de Saldo si el PDF los contiene
        texto_completo_pdf = ''
        try:
            with pdfplumber.open(archivo_path) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        texto_completo_pdf += t + '\n'
        except Exception:
            pass
        datos_financieros = _extraer_balance_y_distribucion(texto_completo_pdf) if texto_completo_pdf else {}
        if datos_financieros:
            print(f"[DEBUG] Balance/Distribución extraídos del PDF", file=sys.stderr)
            # Si el PDF parece solo financiero (sin listado de artículos), no devolver productos falsos
            claves_balance = ('EFECTIVO', 'TOTAL ACTIVOS', 'INVENTARIO DE MERCANCIA', 'CAPITAL', 'UTILIDAD', 'VENTAS', 'PORCIENTO', 'COBRAR', 'PAGAR', 'PASIVOS')
            nombres_sospechosos = sum(
                1 for p in productos_unicos
                if any(k in p['nombre'].upper().replace('.', '') for k in claves_balance)
                or 'RD$' in p['nombre'] or '$$' in p['nombre']
            )
            if nombres_sospechosos >= 3 or (datos_financieros and len(productos_unicos) <= 40 and nombres_sospechosos >= 1):
                print(f"[DEBUG] PDF detectado como solo Balance/Distribución; no se devuelven productos falsos", file=sys.stderr)
                return {
                    'productos': [],
                    'balanceGeneral': datos_financieros.get('balanceGeneral', {}),
                    'distribucionSaldo': datos_financieros.get('distribucionSaldo', {})
                }
            return {
                'productos': productos_unicos,
                'balanceGeneral': datos_financieros.get('balanceGeneral', {}),
                'distribucionSaldo': datos_financieros.get('distribucionSaldo', {})
            }
        return productos_unicos

    except ImportError:
        return {'error': 'Librería pdfplumber no instalada en el servidor'}
    except Exception as e:
        return {'error': f'Error procesando PDF: {str(e)}'}

def main():
    """Función principal de entrada"""
    if len(sys.argv) < 3:
        print(json.dumps({'exito': False, 'mensaje': 'Argumentos insuficientes'}))
        sys.exit(1)
        
    tipo = sys.argv[1].lower()
    archivo = sys.argv[2]
    api_key = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Validar archivo
    if not os.path.exists(archivo):
        print(json.dumps({'exito': False, 'mensaje': f'Archivo no encontrado: {archivo}'}))
        sys.exit(1)
        
    resultado = []
    
    try:
        if tipo in ['xlsx', 'xls']:
            resultado = procesar_excel(archivo)
        elif tipo == 'pdf':
            resultado = procesar_pdf(archivo, api_key)
        else:
            resultado = {'error': 'Formato no soportado. Use XLSX, XLS o PDF'}
            
        # Verificar si el resultado es un dict de error
        if isinstance(resultado, dict) and 'error' in resultado:
            # Imprimir JSON de error
            print(json.dumps({'exito': False, 'mensaje': resultado['error']}))
        else:
            # Resultado puede ser lista (solo productos) o dict (productos + balanceGeneral + distribucionSaldo)
            productos_lista = resultado.get('productos', resultado) if isinstance(resultado, dict) else resultado
            if not isinstance(productos_lista, list):
                print(json.dumps({'exito': False, 'mensaje': 'Formato de respuesta inválido'}))
                sys.exit(1)
            salida = {'exito': True, 'productos': productos_lista}
            if isinstance(resultado, dict):
                if resultado.get('balanceGeneral'):
                    salida['balanceGeneral'] = resultado['balanceGeneral']
                if resultado.get('distribucionSaldo'):
                    salida['distribucionSaldo'] = resultado['distribucionSaldo']
            print(json.dumps(salida, ensure_ascii=False))
            
    except Exception as e:
        # Capturar cualquier error no controlado
        tb = traceback.format_exc()
        print(json.dumps({'exito': False, 'mensaje': f'Error interno: {str(e)}', 'trace': tb}))
        sys.exit(1)

if __name__ == '__main__':
    main()
