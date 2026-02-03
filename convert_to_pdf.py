#!/usr/bin/env python3
"""
Script para convertir el documento IMPLEMENTACION_REORDER_LAZY.md a PDF
"""

import os
import sys

# Intentar importar las librerías necesarias
try:
    from markdown2 import markdown
    from xhtml2pdf import pisa
except ImportError:
    print("Instalando dependencias requeridas...")
    os.system('pip install markdown2 xhtml2pdf pillow')
    from markdown2 import markdown
    from xhtml2pdf import pisa

# Rutas
script_dir = os.path.dirname(os.path.abspath(__file__))
md_file = os.path.join(script_dir, 'IMPLEMENTACION_REORDER_LAZY.md')
pdf_file = os.path.join(script_dir, 'IMPLEMENTACION_REORDER_LAZY.pdf')

# Leer el archivo markdown
print(f"Leyendo archivo: {md_file}")
with open(md_file, 'r', encoding='utf-8') as f:
    md_content = f.read()

# Convertir markdown a HTML
print("Convirtiendo Markdown a HTML...")
html_content = markdown(md_content, extras=['fenced-code-blocks', 'tables'])

# Crear HTML completo con estilos
html_doc = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: white;
            padding: 40px;
        }}
        
        h1 {{
            color: #1a1a1a;
            font-size: 28px;
            margin-bottom: 20px;
            border-bottom: 3px solid #FFD700;
            padding-bottom: 10px;
        }}
        
        h2 {{
            color: #2c3e50;
            font-size: 22px;
            margin-top: 30px;
            margin-bottom: 15px;
            border-left: 5px solid #2196F3;
            padding-left: 15px;
        }}
        
        h3 {{
            color: #34495e;
            font-size: 18px;
            margin-top: 20px;
            margin-bottom: 10px;
        }}
        
        h4 {{
            color: #555;
            font-size: 16px;
            margin-top: 15px;
            margin-bottom: 8px;
        }}
        
        p {{
            margin-bottom: 12px;
            text-align: justify;
        }}
        
        ul, ol {{
            margin-left: 30px;
            margin-bottom: 15px;
        }}
        
        li {{
            margin-bottom: 8px;
        }}
        
        code {{
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 3px;
            padding: 2px 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }}
        
        pre {{
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            margin: 15px 0;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.85em;
            line-height: 1.4;
        }}
        
        pre code {{
            background-color: transparent;
            border: none;
            padding: 0;
        }}
        
        blockquote {{
            border-left: 5px solid #FFD700;
            background-color: #fffef0;
            padding: 15px;
            margin: 15px 0;
            border-radius: 3px;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        
        table th {{
            background-color: #2196F3;
            color: white;
            padding: 12px;
            text-align: left;
        }}
        
        table td {{
            border-bottom: 1px solid #ddd;
            padding: 12px;
        }}
        
        table tr:nth-child(even) {{
            background-color: #f9f9f9;
        }}
        
        .page-break {{
            page-break-after: always;
        }}
        
        em {{
            color: #2c3e50;
            font-style: italic;
        }}
        
        strong {{
            color: #1a1a1a;
            font-weight: bold;
        }}
        
        hr {{
            border: none;
            border-top: 2px solid #FFD700;
            margin: 30px 0;
        }}
    </style>
</head>
<body>
{html_content}
</body>
</html>
"""

# Convertir HTML a PDF
print(f"Generando PDF: {pdf_file}")
with open(pdf_file, 'wb') as output_pdf:
    pisa.CreatePDF(html_doc, output_pdf)

print(f"\n✅ ¡PDF generado exitosamente!")
print(f"📄 Archivo: {pdf_file}")
print(f"📊 Tamaño: {os.path.getsize(pdf_file) / 1024:.2f} KB")
