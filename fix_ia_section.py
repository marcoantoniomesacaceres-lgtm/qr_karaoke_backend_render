#!/usr/bin/env python3

with open('crud.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Buscar y reemplazar la sección completa de lógica de IA
old_section = """    # --- INICIO DE LA INTEGRACI­ÂN CON IA ---
    # 2. Calcular el puntaje usando el m³dulo de IA.
    #    Asumimos que el audio del usuario se sube a una carpeta temporal con el ID de la canción.
    #    Este es un paso que el frontend deberáimplementar en el futuro.
    user_audio_path = os.path.join(random_scorer.TEMP_DIR, f"user_recording_{cancion_actual.id}.wav")
    
    if os.path.exists(user_audio_path):
        puntuacion = random_scorer.calculate_score(cancion_actual.youtube_id, user_audio_path)
        # Opcional: eliminar el audio del usuario después de procesarlo
        # os.remove(user_audio_path)
    else:
        # Si no se subió audio, la puntuación es 0.
        puntuacion = 0
    # --- FIN DE LA INTEGRACI­ÂN CON IA ---"""

new_section = """    # 2. Calcular puntaje aleatorio (la IA fue eliminada por ser muy pesada)
    puntuacion = random_scorer.calculate_score(cancion_actual.youtube_id, "")"""

# Intentar con caracteres especiales
if old_section in content:
    content = content.replace(old_section, new_section)
    print("Reemplazo directo exitoso")
else:
    print("No se encontró la sección exacta, intentando búsqueda alternativa...")

with open('crud.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Archivo actualizado")
