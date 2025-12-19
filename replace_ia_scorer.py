#!/usr/bin/env python3
import re

# Leer archivo
with open('crud.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Reemplazar ia_scorer con random_scorer
content = content.replace('import ia_scorer', 'import random_scorer')
content = content.replace('ia_scorer.TEMP_DIR', 'random_scorer.TEMP_DIR')
content = content.replace('ia_scorer.calculate_score', 'random_scorer.calculate_score')

# Simplificar la lógica del puntaje - usar regex para mayor precisión
pattern = r"user_audio_path = os\.path\.join\(random_scorer\.TEMP_DIR, f\"user_recording_\{cancion_actual\.id\}\.wav\"\)\s+if os\.path\.exists\(user_audio_path\):\s+puntuacion = random_scorer\.calculate_score\(cancion_actual\.youtube_id, user_audio_path\)\s+# Opcional: eliminar el audio del usuario después de procesarlo\s+# os\.remove\(user_audio_path\)\s+else:\s+# Si no se subió audio, la puntuación es 0\.\s+puntuacion = 0"

replacement = "# Calcular puntaje aleatorio (la IA fue eliminada por ser muy pesada)\n    puntuacion = random_scorer.calculate_score(cancion_actual.youtube_id, \"\")"

content = re.sub(pattern, replacement, content)

# Guardar archivo
with open('crud.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ crud.py actualizado correctamente")
