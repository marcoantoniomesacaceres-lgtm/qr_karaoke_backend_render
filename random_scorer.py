import random
import logging

logger = logging.getLogger(__name__)

# Directorio temporal para audio (mantenido para compatibilidad)
TEMP_DIR = "temp_audio"

def calculate_score(original_youtube_id: str, user_audio_path: str) -> int:
    """
    Calcula un puntaje aleatorio entre 80 y 100 para el usuario.
    Reemplaza la IA pesada con un sistema más ligero.
    
    Args:
        original_youtube_id: ID del video de YouTube (no se usa en este sistema)
        user_audio_path: Ruta al archivo de audio del usuario (no se valida)
    
    Returns:
        Un número aleatorio entre 80 y 100
    """
    score = random.randint(80, 100)
    logger.info(f"Puntaje aleatorio calculado: {score}")
    return score
