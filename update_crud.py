#!/usr/bin/env python3
"""Reemplaza referencias a ia_scorer con random_scorer en crud.py"""

with open('crud.py', 'rb') as f:
    contenido_bytes = f.read()

# Decodificar
contenido = contenido_bytes.decode('utf-8')

# Reemplazos simples que ya se hicieron
contenido = contenido.replace('import ia_scorer', 'import random_scorer')
contenido = contenido.replace('ia_scorer.', 'random_scorer.')

# Comentar/Descomentizar sección de comentarios
lineas = contenido.split('\n')
nueva_lineas = []
skip_until_fin = False

for i, linea in enumerate(lineas):
    # Si encontramos la sección de inicio de IA, empezamos a procesar
    if '# --- INICIO DE LA INTEGRACI' in linea and 'IA' in linea:
        # Buscar la siguiente línea con user_audio_path
        if i + 3 < len(lineas) and 'user_audio_path' in lineas[i+3]:
            # Saltar comentarios y agregar solo lo esencial
            nueva_lineas.append('    # 2. Calcular puntaje aleatorio (la IA fue eliminada por ser muy pesada)')
            nueva_lineas.append('    puntuacion = random_scorer.calculate_score(cancion_actual.youtube_id, "")')
            skip_until_fin = True
            continue
    
    # Si estamos saltando, buscar el fin
    if skip_until_fin:
        if '# --- FIN DE LA INTEGRACI' in linea and 'IA' in linea:
            skip_until_fin = False
            continue
        else:
            continue
    
    nueva_lineas.append(linea)

contenido_actualizado = '\n'.join(nueva_lineas)

with open('crud.py', 'wb') as f:
    f.write(contenido_actualizado.encode('utf-8'))

print("✓ crud.py actualizado correctamente - ia_scorer reemplazado con random_scorer")
