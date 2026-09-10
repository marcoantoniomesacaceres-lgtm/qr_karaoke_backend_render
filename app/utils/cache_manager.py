"""
Cache Manager - Sistema de caché en JSON para canciones y cuentas de mesas
Mantiene datos únicamente en JSON (no se usan más las tablas en BD)
Canciones se almacenan en un índice global centralizado
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import threading
from app.timezone_utils import now_bogota

class CacheManager: # Define la clase central encargada de gestionar los datos en memoria y archivos JSON
    """Gestor centralizado de caché para canciones, mesas, cuentas, consumos y song_credits""" # Docstring descriptivo de la clase
    
    def __init__(self, cache_dir: str = "cache"): # Constructor: se ejecuta al crear la instancia 'cache_manager' al final del archivo
        self.cache_dir = Path(cache_dir) # Convierte el nombre del directorio en un objeto Path (conecta con el sistema de archivos)
        self.cache_dir.mkdir(exist_ok=True) # Crea la carpeta 'cache/' si no existe (conecta con el SO)
        
        # Caché en memoria - Índice GLOBAL de canciones
        self.songs_index: Dict[int, Dict[str, Any]] = {}  # Diccionario principal: almacena todas las canciones cargadas {id: datos}
        self.next_song_id = 1  # Contador para asignar IDs únicos a nuevas canciones que se agreguen
        
        # Caché por usuario (referencias a IDs globales)
        self.user_songs: Dict[int, List[int]] = {}  # {usuario_id: [lista_de_ids_de_canciones]} mapea qué canciones pertenecen a quién
        
        # Caché en memoria de mesas
        self.mesas_data: Dict[int, Dict[str, Any]] = {}  # Almacena la configuración de las mesas (nombre, QR, estado_activo)
        self.next_mesa_id = 1 # Contador para generar IDs automáticos para nuevas mesas
        
        # Caché en memoria de cuentas de mesas
        self.mesas_cache: Dict[int, Dict[str, Any]] = {}  # Almacena el estado financiero de cada mesa (consumos, pagos, saldo)
        
        # Caché en memoria de consumos
        self.consumos_data: Dict[int, Dict[str, Any]] = {}  # Registro de cada producto pedido {consumo_id: datos_consumo}
        self.next_consumo_id = 1 # Contador para asignar IDs a los registros de consumo
        
        # Caché en memoria de song_credits
        self.song_credits_data: Dict[int, List[Dict[str, Any]]] = {}  # Créditos disponibles para pedir canciones {usuario_id: [creditos]}
        
        # Caché en memoria de usuarios (sesión por mesa)
        self.usuarios_data: Dict[int, Dict[str, Any]] = {}  # {usuario_id: datos_usuario}
        self.next_usuario_id = 1  # Contador de IDs para usuarios de sesión
        
        # Lock para evitar race conditions
        self.lock = threading.RLock() # Cerrojo para que múltiples hilos no corrompan los datos al escribir (conecta con threading)
        
        # Cargar caché existente
        self._load_cache() # Ejecuta la carga inicial de todos los archivos JSON (conecta con todos los métodos _load_...)
    
    # ========================================================================
    # FUNCIONES DE CACHÉ GLOBAL DE CANCIONES
    # ========================================================================
    
    def _get_global_songs_file(self) -> Path: # Método interno para definir la ruta del archivo maestro de canciones
        """Obtiene la ruta del archivo global de canciones""" # Docstring de utilidad
        return self.cache_dir / "canciones_global.json" # Retorna la ruta completa al archivo 'cache/canciones_global.json'
    
    def _get_user_songs_file(self, usuario_id: int) -> Path: # Método interno para definir la ruta de canciones por usuario
        """Obtiene la ruta del índice de canciones de un usuario""" # Docstring de utilidad
        return self.cache_dir / f"user_songs_{usuario_id}.json" # Retorna ruta tipo 'cache/user_songs_123.json'
    
    def _load_global_songs(self) -> None: # Carga el índice maestro de canciones al iniciar el servidor
        """Carga el índice global de canciones desde JSON""" # Docstring explicativo
        cache_file = self._get_global_songs_file() # Llama a _get_global_songs_file() para saber qué archivo abrir
        if cache_file.exists(): # Verifica si el archivo JSON ya existe en el disco
            try: # Bloque de seguridad para manejar errores de lectura o JSON corrupto
                with open(cache_file, 'r', encoding='utf-8') as f: # Abre el archivo global en modo lectura (UTF-8)
                    data = json.load(f) # Decodifica el contenido JSON a un diccionario de Python
                    self.songs_index = data.get("canciones", {}) # Extrae el diccionario de canciones y lo sube a memoria
                    # Convertir claves a int
                    self.songs_index = {int(k): v for k, v in self.songs_index.items()} # Asegura que los IDs sean enteros (JSON los cambia a string)
                    self.next_song_id = data.get("next_id", max(self.songs_index.keys()) + 1 if self.songs_index else 1) # Sincroniza el contador de IDs
            except Exception as e: # Captura cualquier error durante la carga
                print(f"Error cargando caché global de canciones: {e}") # Informa el error en consola
                self.songs_index = {} # Inicializa vacío si hay error
                self.next_song_id = 1 # Reinicia ID si hay error
        else: # Si el archivo no existe
            self.songs_index = {} # Crea estructura vacía
            self.next_song_id = 1 # Empieza en ID 1
    
    def _save_global_songs(self) -> None: # Guarda los cambios de canciones de memoria al disco duro (JSON)
        """Guarda el índice global de canciones a JSON""" # Docstring explicativo
        cache_file = self._get_global_songs_file() # Conecta con _get_global_songs_file() para la ruta
        try: # Bloque de seguridad para la escritura
            # Convertir claves a string para JSON
            data = { # Estructura el diccionario para el archivo
                "canciones": {str(k): v for k, v in self.songs_index.items()}, # JSON solo acepta strings como llaves
                "next_id": self.next_song_id # Guarda el último ID usado para no repetirlo
            }
            with open(cache_file, 'w', encoding='utf-8') as f: # Abre/Crea el archivo en modo escritura
                json.dump(data, f, indent=2, ensure_ascii=False, default=str) # Escribe el JSON formateado (indented)
        except Exception as e: # Captura errores (ej: disco lleno, permisos)
            print(f"Error guardando caché global de canciones: {e}") # Informa el fallo
    
    def _load_user_songs(self, usuario_id: int) -> None: # Carga qué canciones ha pedido un usuario específico
        """Carga el índice de canciones de un usuario""" # Docstring explicativo
        cache_file = self._get_user_songs_file(usuario_id) # Conecta con _get_user_songs_file(id)
        if cache_file.exists(): # Si el usuario ya tiene canciones registradas
            try: # Seguridad
                with open(cache_file, 'r', encoding='utf-8') as f: # Abre archivo de usuario
                    data = json.load(f) # Lee los IDs de sus canciones
                    self.user_songs[usuario_id] = data.get("song_ids", []) # Guarda la lista de IDs en memoria
            except Exception as e: # Fallo en lectura
                print(f"Error cargando canciones de usuario {usuario_id}: {e}") # Log de error
                self.user_songs[usuario_id] = [] # Reset local
        else: # Si es un usuario nuevo o sin historial
            self.user_songs[usuario_id] = [] # Lista vacía en memoria
    
    def _save_user_songs(self, usuario_id: int) -> None: # Persiste la relación Usuario <-> Canciones en JSON
        """Guarda el índice de canciones de un usuario""" # Docstring explicativo
        if usuario_id not in self.user_songs: # Si el usuario no está en memoria, no hay nada que guardar
            return # Sale del método
        
        cache_file = self._get_user_songs_file(usuario_id) # Conecta con _get_user_songs_file(id) para la ruta
        try: # Seguridad
            data = {"song_ids": self.user_songs[usuario_id]} # Prepara el diccionario con la lista de IDs
            with open(cache_file, 'w', encoding='utf-8') as f: # Escribe el archivo del usuario
                json.dump(data, f, indent=2, ensure_ascii=False, default=str) # Guarda el JSON
        except Exception as e: # Fallo de escritura
            print(f"Error guardando canciones de usuario {usuario_id}: {e}") # Log de error
    
    def add_song_to_cache(self, usuario_id: int, cancion: Dict[str, Any]) -> int: # Punto de entrada principal para guardar una canción nueva
        """Agrega una canción al caché global y la asocia a un usuario. Retorna el song_id.""" # Docstring formal
        with self.lock: # Utiliza el lock para evitar que dos canciones reciban el mismo ID al mismo tiempo
            # Generar ID si no existe
            if "id" not in cancion or cancion["id"] is None: # Si la canción no trae ID propio
                cancion["id"] = self.next_song_id # Le asigna el siguiente ID disponible
                self.next_song_id += 1 # Incrementa el contador global de IDs (next_song_id)
            
            song_id = cancion["id"] # Captura el ID para usarlo de referencia
            
            # Asegurar timestamps
            if "created_at" not in cancion: # Si no tiene fecha de creación
                cancion["created_at"] = now_bogota().isoformat() # Le asigna la hora de Bogotá actual (conecta con timezone_utils)
            
            # Guardar en índice global
            self.songs_index[song_id] = cancion # Inserta la canción en el diccionario maestro songs_index
            
            # Agregar a índice de usuario
            if usuario_id not in self.user_songs: # Si el usuario no tenía canciones previas en memoria
                self.user_songs[usuario_id] = [] # Crea su lista de IDs
            
            if song_id not in self.user_songs[usuario_id]: # Evita duplicados en la lista del usuario
                self.user_songs[usuario_id].append(song_id) # Agrega el ID de la canción a la lista del usuario
            
            # Persistir
            self._save_global_songs() # Conecta con _save_global_songs() para escribir al disco maestro
            self._save_user_songs(usuario_id) # Conecta con _save_user_songs(id) para el disco del usuario
            
            return song_id # Retorna el ID generado/usado al invocador (conecta con canciones.py)
    
    def get_song_by_id(self, cancion_id: int) -> Optional[Dict[str, Any]]: # Busca una canción por su identificador numérico
        """Obtiene una canción por su ID en el índice global""" # Docstring explicativo
        with self.lock: # Bloquea el acceso para evitar lecturas inconsistentes (conecta con self.lock)
            return self.songs_index.get(int(cancion_id)) # Busca en el diccionario maestro y retorna los datos o None (conecta con self.songs_index)
    
    def get_songs_by_user(self, usuario_id: int) -> List[Dict[str, Any]]: # Recupera todas las canciones pedidas por un usuario
        """Obtiene todas las canciones de un usuario""" # Docstring descriptivo
        with self.lock: # Protección de concurrencia
            if usuario_id not in self.user_songs: # Si el usuario no está en el índice de memoria actualmente
                self._load_user_songs(usuario_id) # Intenta cargar sus datos del disco (conecta con _load_user_songs)
            
            song_ids = self.user_songs[usuario_id] # Obtiene la lista de IDs de canciones del usuario (conecta con self.user_songs)
            return [self.songs_index[sid] for sid in song_ids if sid in self.songs_index] # Retorna los datos completos desde el índice global
    
    def get_songs_by_estado(self, estado: str, local_id: Optional[int] = None) -> List[Dict[str, Any]]: # Filtra canciones por su estado y local_id opcional
        """Obtiene todas las canciones con un estado específico, opcionalmente filtradas por local_id"""
        with self.lock:
            songs = [s for s in self.songs_index.values() if s.get("estado") == estado]
            if local_id is not None:
                return [s for s in songs if s.get("local_id") == local_id or s.get("local_id") is None]
            return songs
    
    def get_song_by_youtube_id(self, youtube_id: str, valid_states: List[str] = None, local_id: Optional[int] = None) -> Optional[Dict[str, Any]]: # Busca una canción por el ID de YouTube
        """Obtiene una canción por su youtube_id (puede filtrar por estados y local_id)""" # Docstring explicativo
        with self.lock: # Bloqueo de hilos
            for song in self.songs_index.values(): # Itera sobre todas las canciones en memoria
                if song.get("youtube_id") == youtube_id: # Si el ID de YouTube coincide
                    if local_id is not None and song.get("local_id") is not None and song.get("local_id") != local_id:
                        continue
                    if valid_states is None or song.get("estado") in valid_states: # Y el estado es uno de los permitidos
                        return song # Retorna los datos de la canción encontrada
            return None # Retorna nada si no hay coincidencias
    
    def update_song_in_cache(self, cancion_id: int, updates: Dict[str, Any]) -> bool: # Modifica datos de una canción (ej: cambiar estado)
        """Actualiza una canción en el caché global""" # Docstring de utilidad
        with self.lock: # Bloquea escritura concurrente
            if cancion_id in self.songs_index: # Si la canción existe en el índice maestro
                self.songs_index[cancion_id].update(updates) # Reemplaza/Agrega los campos nuevos al diccionario de la canción
                self._save_global_songs() # Persiste el cambio al archivo JSON global (conecta con _save_global_songs)
                return True # Éxito
            return False # No encontrada
    
    def delete_song_from_cache(self, cancion_id: int, usuario_id: int = None) -> bool: # Elimina una canción de todo el sistema
        """Elimina una canción del caché global""" # Docstring descriptivo
        with self.lock: # Bloqueo de hilos
            if cancion_id in self.songs_index: # Si existe en el catálogo maestro
                del self.songs_index[cancion_id] # La borra del diccionario global
                self._save_global_songs() # Actualiza el archivo JSON global (conecta con _save_global_songs)
                
                # Remover de índices de usuario
                if usuario_id is not None and usuario_id in self.user_songs: # Si sabemos quién la pidió
                    if cancion_id in self.user_songs[usuario_id]: # Si está en su histórico
                        self.user_songs[usuario_id].remove(cancion_id) # La quita de su lista
                        self._save_user_songs(usuario_id) # Actualiza el JSON del usuario (conecta con _save_user_songs)
                else: # Si no sabemos el usuario, buscamos en todos
                    # Buscar en todos los usuarios
                    for uid, song_ids in self.user_songs.items(): # Itera sobre cada usuario en memoria
                        if cancion_id in song_ids: # Si el usuario tiene esta canción
                            song_ids.remove(cancion_id) # La elimina
                            self._save_user_songs(uid) # Guarda el JSON actualizado del usuario
                
                return True # Eliminado correctamente
            return False # No existía
    
    def get_all_songs(self, local_id: Optional[int] = None) -> List[Dict[str, Any]]: # Obtiene el catálogo completo cargado en memoria
        """Obtiene todas las canciones, opcionalmente filtradas por local_id"""
        with self.lock: # Protección de lectura
            songs = list(self.songs_index.values())
            if local_id is not None:
                return [s for s in songs if s.get("local_id") == local_id or s.get("local_id") is None]
            return songs
    
    def clear_all_songs(self) -> None: # Borrado total de canciones (limpieza total)
        """Limpia todas las canciones del caché""" # Docstring explicativo
        with self.lock: # Bloqueo total
            self.songs_index = {} # Vacía el catálogo global en memoria
            self.user_songs = {} # Vacía el registro de usuarios en memoria
            self.next_song_id = 1 # Reinicia el contador de IDs a 1
            self._save_global_songs() # Crea un JSON global vacío (conecta con _save_global_songs)
            # Limpiar archivos de usuarios
            for user_file in self.cache_dir.glob("user_songs_*.json"): # Busca todos los archivos JSON de usuarios
                user_file.unlink() # Borra físicamente cada archivo del disco (conecta con SO/Pathlib)
    
    # ========================================================================
    # FUNCIONES DE CACHÉ DE CUENTAS (MESAS)
    # ========================================================================
    
    def _get_mesa_cache_file(self, mesa_id: int) -> Path: # Define dónde se guarda la cuenta financiera de una mesa
        """Obtiene la ruta del archivo de caché de cuenta de mesa""" # Docstring de utilidad
        return self.cache_dir / f"mesa_cuenta_{mesa_id}.json" # Ruta tipo 'cache/mesa_cuenta_1.json'
    
    def _load_mesa_cache(self, mesa_id: int) -> None: # Carga consumos y pagos de una mesa específica
        """Carga caché de cuenta de mesa desde JSON""" # Docstring explicativo
        cache_file = self._get_mesa_cache_file(mesa_id) # Conecta con _get_mesa_cache_file(id)
        if cache_file.exists(): # Si la mesa ya tiene una cuenta abierta
            try: # Seguridad
                with open(cache_file, 'r', encoding='utf-8') as f: # Lee el archivo
                    self.mesas_cache[mesa_id] = json.load(f) # Sube la cuenta a memoria (conecta con self.mesas_cache)
            except Exception as e: # Error de JSON
                print(f"Error cargando caché de mesa {mesa_id}: {e}") # Log de error
                self.mesas_cache[mesa_id] = self._create_empty_mesa_cache(mesa_id) # Crea cuenta vacía si falla (conecta con _create_empty_mesa_cache)
        else: # Si es la primera vez que se interactúa con la mesa
            self.mesas_cache[mesa_id] = self._create_empty_mesa_cache(mesa_id) # Inicializa cuenta nueva (conecta con _create_empty_mesa_cache)
    
    def _create_empty_mesa_cache(self, mesa_id: int) -> Dict[str, Any]: # Define la estructura básica de una cuenta nueva
        """Crea una estructura vacía de caché para mesa""" # Docstring de estructura
        return { # Retorna diccionario con valores iniciales
            "mesa_id": mesa_id, # ID de la mesa
            "created_at": now_bogota().isoformat(), # Fecha de apertura (conecta con timezone_utils)
            "consumos": [], # Lista de productos pedidos vacía
            "pagos": [], # Lista de pagos realizados vacía
            "total_consumido": 0.0, # Suma de precios de productos
            "total_pagado": 0.0, # Suma de dinero abonado
            "saldo": 0.0 # Diferencia pendiente de pago
        }
    
    def _save_mesa_cache(self, mesa_id: int) -> None: # Guarda el balance financiero de una mesa en JSON
        """Guarda caché de cuenta de mesa a JSON""" # Docstring descriptivo
        if mesa_id not in self.mesas_cache: # Si no hay cuenta en memoria
            return # No hace nada
        
        cache_file = self._get_mesa_cache_file(mesa_id) # Conecta con _get_mesa_cache_file(id) para la ruta
        try: # Seguridad
            with open(cache_file, 'w', encoding='utf-8') as f: # Escribe el archivo
                json.dump(self.mesas_cache[mesa_id], f, indent=2, ensure_ascii=False, default=str) # Persiste los datos (conecta con JSON)
        except Exception as e: # Fallo de escritura
            print(f"Error guardando caché de mesa {mesa_id}: {e}") # Log de error
    
    def add_consumo_to_mesa_cache(self, mesa_id: int, consumo: Dict[str, Any]) -> None: # Registra un nuevo gasto en la mesa
        """Agrega un consumo al caché de la mesa""" # Docstring de acción
        with self.lock: # Bloqueo para cálculos matemáticos precisos
            if mesa_id not in self.mesas_cache: # Si la cuenta no está cargada
                self._load_mesa_cache(mesa_id) # La carga del disco (conecta con _load_mesa_cache)
            
            self.mesas_cache[mesa_id]["consumos"].append(consumo) # Añade el producto a la lista (conecta con self.mesas_cache)
            
            # Actualizar total consumido
            try: # Protege de valores mal formateados
                valor_total = float(consumo.get("valor_total", 0)) # Obtiene el precio del producto
                self.mesas_cache[mesa_id]["total_consumido"] += valor_total # Suma al acumulado de la mesa
                self.mesas_cache[mesa_id]["saldo"] = ( # Recalcula el saldo pendiente
                    self.mesas_cache[mesa_id]["total_consumido"] - 
                    self.mesas_cache[mesa_id]["total_pagado"]
                )
            except (ValueError, TypeError): # Error en los datos numéricos
                pass # Ignora el cálculo pero guarda el registro
            
            self._save_mesa_cache(mesa_id) # Guarda la cuenta actualizada en el disco (conecta con _save_mesa_cache)
    
    def add_pago_to_mesa_cache(self, mesa_id: int, pago: Dict[str, Any]) -> None: # Registra un abono de dinero en la mesa
        """Agrega un pago al caché de la mesa""" # Docstring descriptivo
        with self.lock: # Bloqueo de hilos
            if mesa_id not in self.mesas_cache: # Si la cuenta no está en memoria
                self._load_mesa_cache(mesa_id) # Conecta con _load_mesa_cache
            
            self.mesas_cache[mesa_id]["pagos"].append(pago) # Añade el registro del pago (conecta con self.mesas_cache)
            
            # Actualizar total pagado
            try: # Protege cálculos
                monto = float(pago.get("monto", 0)) # Valor del dinero entregado
                self.mesas_cache[mesa_id]["total_pagado"] += monto # Suma al total abonado por la mesa
                self.mesas_cache[mesa_id]["saldo"] = ( # Actualiza saldo pendiente
                    self.mesas_cache[mesa_id]["total_consumido"] - 
                    self.mesas_cache[mesa_id]["total_pagado"]
                )
            except (ValueError, TypeError): # Datos mal formados
                pass # No actualiza saldo pero el pago queda en la lista
            
            self._save_mesa_cache(mesa_id) # Persiste cambios (conecta con _save_mesa_cache)
    
    def get_mesa_cuenta_from_cache(self, mesa_id: int) -> Dict[str, Any]: # Obtiene el resumen financiero de una mesa
        """Obtiene la información de cuenta de una mesa desde caché""" # Docstring descriptivo
        with self.lock: # Protección de lectura
            if mesa_id not in self.mesas_cache: # Si no está cargada
                self._load_mesa_cache(mesa_id) # Carga del disco (conecta con _load_mesa_cache)
            
            return self.mesas_cache[mesa_id].copy() # Retorna una COPIA de los datos para que no se modifiquen accidentalmente fuera (conecta con self.mesas_cache)
    
    def clear_mesa_cache(self, mesa_id: int) -> None: # Borra la cuenta de una mesa (usado al cerrar la cuenta/después de pagar todo)
        """Limpia el caché de una mesa""" # Docstring explicativo
        with self.lock: # Bloqueo total
            if mesa_id in self.mesas_cache: # Si está en memoria
                del self.mesas_cache[mesa_id] # Borra del diccionario (conecta con self.mesas_cache)
            
            cache_file = self._get_mesa_cache_file(mesa_id) # Busca la ruta del archivo (conecta con _get_mesa_cache_file)
            if cache_file.exists(): # Si el archivo existe en disco
                cache_file.unlink() # Borra el archivo físico del disco (conecta con pathlib.Path.unlink)
    
    # ========================================================================
    # FUNCIONES DE CACHÉ DE REVISIÓN DE COLA (Sincronización WebSocket)
    # ========================================================================
    
    def _get_queue_revision_cache_file(self) -> Path: # Define dónde se guarda el número de versión de la cola
        """Obtiene la ruta del archivo de caché de revisión de cola""" # Docstring descriptivo
        return self.cache_dir / "queue_revision.json" # Retorna 'cache/queue_revision.json'
    
    def _load_queue_revision_cache(self) -> Dict[str, Any]: # Lee la versión actual de la cola desde el disco
        """Carga caché de revisión de cola desde JSON""" # Docstring de utilidad
        cache_file = self._get_queue_revision_cache_file() # Conecta con _get_queue_revision_cache_file
        if cache_file.exists(): # Si existe el archivo
            try: # Seguridad
                with open(cache_file, 'r', encoding='utf-8') as f: # Abre el archivo
                    return json.load(f) # Retorna el diccionario con la revisión
            except Exception as e: # Error lectura
                print(f"Error cargando caché de revisión de cola: {e}") # Log error
        
        return {"revision": 0, "updated_at": now_bogota().isoformat()} # Retorna valor por defecto (conecta con timezone_utils)
    
    def _save_queue_revision_cache(self, data: Dict[str, Any]) -> None: # Guarda el nuevo número de versión al disco
        """Guarda caché de revisión de cola a JSON""" # Docstring de utilidad
        cache_file = self._get_queue_revision_cache_file() # Conecta con _get_queue_revision_cache_file para ruta
        try: # Seguridad
            with open(cache_file, 'w', encoding='utf-8') as f: # Escribe archivo
                json.dump(data, f, indent=2, ensure_ascii=False, default=str) # Persiste la versión (conecta con JSON)
        except Exception as e: # Error escritura
            print(f"Error guardando caché de revisión de cola: {e}") # Log error
    
    def get_queue_revision(self) -> int: # Consulta qué versión tiene la cola actualmente
        """Obtiene la revisión actual de la cola desde caché""" # Docstring explicativo
        with self.lock: # Bloqueo concurrente
            data = self._load_queue_revision_cache() # Carga del disco (conecta con _load_queue_revision_cache)
            return int(data.get("revision", 0)) # Retorna el número entero de revisión
    
    def increment_queue_revision(self) -> int: # Aumenta la versión (se llama cada vez que la cola cambia: agregar/quitar canción)
        """Incrementa la revisión de la cola y retorna el nuevo valor""" # Docstring de acción
        with self.lock: # Bloqueo estricto
            data = self._load_queue_revision_cache() # Lee versión actual (conecta con _load_queue_revision_cache)
            new_revision = int(data.get("revision", 0)) + 1 # Suma 1 a la versión
            data["revision"] = new_revision # Actualiza diccionario
            data["updated_at"] = now_bogota().isoformat() # Actualiza fecha de cambio (conecta con timezone_utils)
            self._save_queue_revision_cache(data) # Guarda al disco (conecta con _save_queue_revision_cache)
            return new_revision # Retorna el nuevo número para que el frontend sepa que debe refrescar
    
    def set_queue_revision(self, revision: int) -> None: # Fuerza una versión específica de la cola
        """Establece la revisión de la cola a un valor específico""" # Docstring descriptivo
        with self.lock: # Bloqueo hilos
            data = self._load_queue_revision_cache() # Conecta con _load_queue_revision_cache
            data["revision"] = revision # Asigna valor manual
            data["updated_at"] = now_bogota().isoformat() # Registra hora
            self._save_queue_revision_cache(data) # Persiste (conecta con _save_queue_revision_cache)
    
    def _load_cache(self) -> None: # Método maestro que coordina la carga de TODOS los archivos JSON al iniciar
        """Carga todos los caché existentes al iniciar""" # Docstring de arquitectura
        # Cargar caché global de canciones
        self._load_global_songs() # Carga catálogo maestro (conecta con _load_global_songs)
        
        # Cargar todos los caché de usuario
        for user_file in self.cache_dir.glob("user_songs_*.json"): # Busca todos los archivos de usuarios
            try: # Seguridad para archivos corruptos
                usuario_id = int(user_file.stem.split('_')[-1]) # Extrae el ID del nombre del archivo 'user_songs_123' -> 123
                self._load_user_songs(usuario_id) # Carga la lista de canciones de ese usuario (conecta con _load_user_songs)
            except Exception as e: # Error de parsing o lectura
                print(f"Error cargando {user_file}: {e}") # Log del problema
        
        # Cargar caché de mesas
        for mesa_file in self.cache_dir.glob("mesa_cuenta_*.json"): # Busca archivos de cuentas financieras por mesa
            try: # Seguridad
                mesa_id = int(mesa_file.stem.split('_')[-1]) # Extrae ID de mesa del nombre del archivo
                self._load_mesa_cache(mesa_id) # Carga balance y consumos de la mesa (conecta con _load_mesa_cache)
            except Exception as e: # Error
                print(f"Error cargando {mesa_file}: {e}") # Log
        
        # Cargar caché de mesas completas
        self._load_mesas_data() # Carga nombres y estados de las mesas (conecta con _load_mesas_data)
        
        # Cargar caché de consumos
        self._load_consumos_data() # Carga registro histórico de productos pedidos (conecta con _load_consumos_data)
        
        # Cargar caché de song_credits
        self._load_song_credits_data() # Carga créditos de canciones por usuario (conecta con _load_song_credits_data)
        
        # Cargar caché de usuarios (sesión)
        self._load_usuarios_data()  # Carga usuarios de sesión por mesa

    # ========================================================================
    # FUNCIONES DE CACHÉ DE MESAS (Lista General)
    # ========================================================================
    
    def _get_mesas_file(self) -> Path: # Define dónde se guarda la lista de mesas físicas habilitadas
        """Obtiene la ruta del archivo de mesas""" # Docstring de utilidad
        return self.cache_dir / "mesas.json" # Retorna 'cache/mesas.json'
    
    def _load_mesas_data(self) -> None: # Carga la configuración de todas las mesas del local
        """Carga el índice de mesas desde JSON""" # Docstring explicativo
        cache_file = self._get_mesas_file() # Conecta con _get_mesas_file() para ruta
        if cache_file.exists(): # Si el local ya tiene mesas configuradas
            try: # Seguridad
                with open(cache_file, 'r', encoding='utf-8') as f: # Lee el archivo
                    data = json.load(f) # Decodifica JSON
                    self.mesas_data = data.get("mesas", {}) # Sube diccionario de mesas a memoria
                    self.mesas_data = {int(k): v for k, v in self.mesas_data.items()} # Asegura llaves como enteros
                    self.next_mesa_id = data.get("next_id", max(self.mesas_data.keys()) + 1 if self.mesas_data else 1) # Sincroniza ID de mesa
            except Exception as e: # Fallo
                print(f"Error cargando caché de mesas: {e}") # Log
                self.mesas_data = {} # Reset memoria
                self.next_mesa_id = 1 # Reset contador
        else: # Si no existe el archivo
            self.mesas_data = {} # Inicializa vacío
            self.next_mesa_id = 1 # Empieza en 1
    
    def _save_mesas_data(self) -> None: # Persiste la configuración de mesas al disco
        """Guarda el índice de mesas a JSON""" # Docstring descriptivo
        cache_file = self._get_mesas_file() # Conecta con _get_mesas_file
        try: # Seguridad hilos y escritura
            data = { # Estructura JSON
                "mesas": {str(k): v for k, v in self.mesas_data.items()}, # IDs como strings para JSON
                "next_id": self.next_mesa_id # Guarda para recordar el siguiente ID disponible
            }
            with open(cache_file, 'w', encoding='utf-8') as f: # Escribe archivo
                json.dump(data, f, indent=2, ensure_ascii=False, default=str) # Guarda configuración
        except Exception as e: # Fallo de escritura
            print(f"Error guardando caché de mesas: {e}") # Log error
    
    def create_mesa_in_cache(self, nombre: str, qr_code: str, local_id: Optional[int] = None, session_id: Optional[str] = None) -> int: # Crea físicamente una mesa nueva en el sistema
        """Crea una mesa en caché y retorna el mesa_id""" # Docstring descriptivo
        with self.lock: # Bloqueo hilos
            import re # Importa expresiones regulares para extraer números
            import uuid
            
            # Intentar extraer el ID lógico de la mesa desde el qr_code o el nombre
            mesa_id = None # Inicializa variable
            match_qr = re.search(r'karaoke-mesa-(\d+)', qr_code, re.IGNORECASE) # Busca número en el QR (ej: 'karaoke-mesa-5' -> 5)
            if match_qr: # Si encontró el patrón
                mesa_id = int(match_qr.group(1)) # Convierte el texto '5' a número 5
            else: # Si no está en el QR
                match_name = re.search(r'Mesa\s+(\d+)', nombre, re.IGNORECASE) # Busca en el nombre (ej: 'Mesa 10' -> 10)
                if match_name: # Si encontró patrón
                    mesa_id = int(match_name.group(1)) # Convierte a número
            
            # Si no pudimos extraer el ID o si ese ID ya está en uso de forma excepcional
            if mesa_id is None or mesa_id in self.mesas_data: # Si falló la extracción o el ID ya existe
                # Asegurar de no chocar con ningún ID existente al usar el next_mesa_id
                while self.next_mesa_id in self.mesas_data: # Mientras el ID siguiente esté ocupado
                    self.next_mesa_id += 1 # Sigue buscando el próximo número libre
                mesa_id = self.next_mesa_id # Asigna el ID libre encontrado
                self.next_mesa_id += 1 # Incrementa para la siguiente mesa
            
            # Actualizar el next_mesa_id global si nuestro ID actual es más alto
            if mesa_id >= self.next_mesa_id: # Si creamos una mesa con ID 20 pero el contador iba en 10
                self.next_mesa_id = mesa_id + 1 # Salta el contador a 21 para evitar duplicados futuros
            
            # PARCHE DE SEGURIDAD: Asegurar que la cuenta de la mesa empiece en 0 absoluto
            # Esto borra cualquier archivo JSON residual si el ID fue usado anteriormente
            self.clear_mesa_cache(mesa_id)
            
            generated_session_id = session_id or uuid.uuid4().hex[:8]
            
            self.mesas_data[mesa_id] = { # Crea el objeto mesa en el catálogo de memoria
                "id": mesa_id, # Su ID único
                "nombre": nombre, # Nombre visual
                "qr_code": qr_code, # Código QR único
                "local_id": local_id, # ID del local asignado
                "session_id": generated_session_id, # ID único de sesión activa
                "is_active": True, # Estado habilitado por defecto
                "created_at": now_bogota().isoformat() # Fecha de creación (Bogotá)
            }
            
            self._save_mesas_data() # Persiste el cambio al disco (conecta con _save_mesas_data)
            return mesa_id # Retorna el ID de la mesa creada (conecta con mesas.py)
    
    def get_mesa_by_id(self, mesa_id: int) -> Optional[Dict[str, Any]]: # Consulta datos de una mesa por su ID
        """Obtiene una mesa por su ID""" # Docstring simple
        with self.lock: # Protección de lectura
            return self.mesas_data.get(mesa_id) # Retorna los datos o None si no existe (conecta con self.mesas_data)
    
    def get_mesa_by_qr(self, qr_code: str) -> Optional[Dict[str, Any]]: # Busca una mesa escaneando su QR
        """Obtiene una mesa por su código QR""" # Docstring descriptivo
        with self.lock: # Bloqueo hilos
            for mesa in self.mesas_data.values(): # Itera por todas las mesas habilitadas
                if mesa.get("qr_code") == qr_code: # Compara el código QR
                    return mesa # Retorna la coincidencia
            return None # No encontrada
    
    def get_all_mesas(self) -> List[Dict[str, Any]]: # Lista de todas las mesas para el administrador
        """Obtiene todas las mesas""" # Docstring descriptivo
        with self.lock: # Protección lectura
            return list(self.mesas_data.values()) # Retorna lista plana de mesas
    
    def update_mesa_in_cache(self, mesa_id: int, updates: Dict[str, Any]) -> bool: # Cambia nombre o estado de una mesa
        """Actualiza los datos de una mesa""" # Docstring de utilidad
        with self.lock: # Bloqueo escritura
            if mesa_id in self.mesas_data: # Si la mesa existe
                self.mesas_data[mesa_id].update(updates) # Fusiona los cambios con los datos actuales
                self._save_mesas_data() # Persiste al disco (conecta con _save_mesas_data)
                return True # Éxito
            return False # Falló (no existía)
    
    def delete_mesa_from_cache(self, mesa_id: int) -> bool: # Borra una mesa del sistema
        """Elimina una mesa del caché""" # Docstring descriptivo
        with self.lock: # Bloqueo total
            if mesa_id in self.mesas_data: # Si existe en el catálogo
                del self.mesas_data[mesa_id] # Borra del diccionario maestro de mesas
                self._save_mesas_data() # Actualiza el archivo JSON (conecta con _save_mesas_data)
                self.clear_mesa_cache(mesa_id) # Borra su cuenta financiera asociada (conecta con clear_mesa_cache)
                self.clear_usuarios_de_mesa(mesa_id)  # Borra los usuarios de sesión de esta mesa
                self._clear_consumos_de_mesa_locked(mesa_id) # Borra los consumos activos de esta sesión
                return True # Eliminado
            return False # No existía
    
    # ========================================================================
    # FUNCIONES DE CACHÉ DE CONSUMOS (Historial de Pedidos)
    # ========================================================================
    
    def _get_consumos_file(self) -> Path: # Define dónde se guarda el registro histórico de consumos
        """Obtiene la ruta del archivo de consumos""" # Docstring de ruta
        return self.cache_dir / "consumos.json" # Retorna 'cache/consumos.json'
    
    def _load_consumos_data(self) -> None: # Carga el historial de consumos al iniciar el servidor
        """Carga el índice de consumos desde JSON""" # Docstring explicativo
        cache_file = self._get_consumos_file() # Conecta con _get_consumos_file() por ruta
        if cache_file.exists(): # Si hay historial
            try: # Seguridad
                with open(cache_file, 'r', encoding='utf-8') as f: # Abre el archivo
                    data = json.load(f) # Decodifica JSON
                    self.consumos_data = data.get("consumos", {}) # Sube diccionario de consumos a memoria
                    self.consumos_data = {int(k): v for k, v in self.consumos_data.items()} # Asegura llaves como enteros
                    self.next_consumo_id = data.get("next_id", max(self.consumos_data.keys()) + 1 if self.consumos_data else 1) # Sincroniza contador de consumos
            except Exception as e: # Error
                print(f"Error cargando caché de consumos: {e}") # Log error
                self.consumos_data = {} # Reset
                self.next_consumo_id = 1 # Reset contador
        else: # Archivo no existe
            self.consumos_data = {} # Inicializa vacío
            self.next_consumo_id = 1 # Empieza en 1
    
    def _save_consumos_data(self) -> None: # Persiste el historial completo de consumos al disco
        """Guarda el índice de consumos a JSON""" # Docstring descriptivo
        cache_file = self._get_consumos_file() # Conecta con _get_consumos_file por ruta
        try: # Seguridad hilos y escritura
            data = { # Diccionario para JSON
                "consumos": {str(k): v for k, v in self.consumos_data.items()}, # IDs como strings para compatibilidad JSON
                "next_id": self.next_consumo_id # Guarda para recordar el siguiente ID de consumo
            }
            with open(cache_file, 'w', encoding='utf-8') as f: # Escribe archivo
                json.dump(data, f, indent=2, ensure_ascii=False, default=str) # Guarda historial de ventas
        except Exception as e: # Error
            print(f"Error guardando caché de consumos: {e}") # Log error
    
    def create_consumo_in_cache(self, consumo_data: Dict[str, Any]) -> int: # Registra una venta nueva
        """Crea un consumo en caché y retorna el consumo_id""" # Docstring descriptivo
        with self.lock: # Bloqueo hilos
            consumo_id = self.next_consumo_id # Asigna el contador actual
            self.next_consumo_id += 1 # Prepara el siguiente ID
            
            consumo_data["id"] = consumo_id # Inserta el ID en los datos del pedido
            if "created_at" not in consumo_data: # Si no tiene fecha
                consumo_data["created_at"] = now_bogota().isoformat() # Asigna fecha actual (conecta con timezone_utils)
            
            self.consumos_data[consumo_id] = consumo_data # Guarda en el registro global de memoria
            
            # Agregar a caché de mesa también
            if "mesa_id" in consumo_data: # Si vinculamos el consumo a una mesa
                self.add_consumo_to_mesa_cache(consumo_data["mesa_id"], consumo_data) # Actualiza balance financiero de la mesa (conecta con add_consumo_to_mesa_cache)
            
            self._save_consumos_data() # Persiste registro global (conecta con _save_consumos_data)
            return consumo_id # Retorna ID del pedido (conecta con consumos.py)
    
    def get_consumo_by_id(self, consumo_id: int) -> Optional[Dict[str, Any]]: # Busca un pedido por ID
        """Obtiene un consumo por su ID""" # Docstring simple
        with self.lock: # Protección lectura
            return self.consumos_data.get(consumo_id) # Retorna datos o None
    
    def get_consumos_by_mesa(self, mesa_id: int) -> List[Dict[str, Any]]: # Filtra historial por mesa
        """Obtiene todos los consumos de una mesa""" # Docstring descriptivo
        with self.lock: # Bloqueo
            target_id = int(mesa_id)
            return [c for c in self.consumos_data.values() if int(c.get("mesa_id", 0)) == target_id] # Filtra en memoria
    
    def get_consumos_by_usuario(self, usuario_id: int) -> List[Dict[str, Any]]: # Filtra historial por cliente
        """Obtiene todos los consumos de un usuario""" # Docstring descriptivo
        with self.lock: # Bloqueo
            target_id = int(usuario_id)
            return [c for c in self.consumos_data.values() if int(c.get("usuario_id", 0)) == target_id] # Filtra en memoria
    
    def get_all_consumos(self) -> List[Dict[str, Any]]: # Obtiene TODOS los pedidos para reportes
        """Obtiene todos los consumos""" # Docstring descriptivo
        with self.lock: # Protección lectura
            return list(self.consumos_data.values()) # Retorna lista completa
    
    def update_consumo_in_cache(self, consumo_id: int, updates: Dict[str, Any]) -> bool: # Cambia estado de un pedido (ej: 'pagado')
        """Actualiza un consumo en caché""" # Docstring de utilidad
        with self.lock: # Bloqueo escritura
            if consumo_id in self.consumos_data: # Si existe
                self.consumos_data[consumo_id].update(updates) # Aplica cambios
                self._save_consumos_data() # Persiste (conecta con _save_consumos_data)
                return True # Éxito
            return False # No encontrado
    
    def delete_consumo_from_cache(self, consumo_id: int) -> bool: # Borra rastro de un pedido
        """Elimina un consumo del caché""" # Docstring descriptivo
        with self.lock: # Bloqueo
            if consumo_id in self.consumos_data: # Si existe
                del self.consumos_data[consumo_id] # Borra de la memoria global
                self._save_consumos_data() # Guarda cambios al disco (conecta con _save_consumos_data)
                return True # Eliminado
            return False # No encontrado

    def clear_consumos_de_mesa(self, mesa_id: int) -> int:
        """Elimina todos los consumos asociados a una mesa en caché."""
        with self.lock:
            return self._clear_consumos_de_mesa_locked(mesa_id)

    def _clear_consumos_de_mesa_locked(self, mesa_id: int) -> int:
        target_id = int(mesa_id)
        to_del = [cid for cid, c in self.consumos_data.items() if int(c.get("mesa_id", 0)) == target_id]
        for cid in to_del:
            del self.consumos_data[cid]
        if to_del:
            self._save_consumos_data()
        return len(to_del)
    
    # ========================================================================
    # FUNCIONES DE CACHÉ DE SONG CREDITS (Fichas para pedir canciones)
    # ========================================================================
    
    def _get_song_credits_file(self, usuario_id: int) -> Path: # Define dónde se guardan los créditos comprados por un usuario
        """Obtiene la ruta del archivo de song_credits de un usuario""" # Docstring descriptivo
        return self.cache_dir / f"song_credits_{usuario_id}.json" # Retorna 'cache/song_credits_123.json'
    
    def _load_song_credits_data(self) -> None: # Carga los créditos de todos los usuarios al iniciar servidor
        """Carga los song_credits desde JSON""" # Docstring explicativo
        for credits_file in self.cache_dir.glob("song_credits_*.json"): # Busca archivos de créditos en la carpeta caché
            try: # Seguridad para archivos individuales
                usuario_id = int(credits_file.stem.split('_')[-1]) # Extrae ID del usuario del nombre del archivo
                with open(credits_file, 'r', encoding='utf-8') as f: # Abre el archivo
                    data = json.load(f) # Decodifica créditos
                    self.song_credits_data[usuario_id] = data.get("credits", []) # Sube créditos a memoria (conecta con self.song_credits_data)
            except Exception as e: # Error
                print(f"Error cargando song_credits de usuario {usuario_id}: {e}") # Log error
                self.song_credits_data[usuario_id] = [] # Inicializa vacío en caso de fallo
    
    def _save_song_credits_data(self, usuario_id: int) -> None: # Persiste los créditos de un usuario al disco
        """Guarda los song_credits de un usuario a JSON""" # Docstring descriptivo
        if usuario_id not in self.song_credits_data: # Si no hay datos en memoria
            return # No hace nada
        
        cache_file = self._get_song_credits_file(usuario_id) # Conecta con _get_song_credits_file(id)
        try: # Seguridad de escritura
            data = {"credits": self.song_credits_data[usuario_id]} # Prepara estructura JSON
            with open(cache_file, 'w', encoding='utf-8') as f: # Escribe archivo
                json.dump(data, f, indent=2, ensure_ascii=False, default=str) # Persiste créditos
        except Exception as e: # Error
            print(f"Error guardando song_credits de usuario {usuario_id}: {e}") # Log error
    
    def add_song_credits(self, usuario_id: int, credits_value: int, metodo: str = "producto") -> None: # Otorga "fichas" para cantar a un usuario
        """Agrega créditos de canción a un usuario""" # Docstring de acción
        with self.lock: # Bloqueo hilos
            if usuario_id not in self.song_credits_data: # Si el usuario no tiene registro de créditos
                self.song_credits_data[usuario_id] = [] # Inicializa su lista vacía
            
            credit_record = { # Crea el registro del crédito
                "id": len(self.song_credits_data[usuario_id]) + 1, # ID secuencial local
                "credits_value": credits_value, # Cuántas canciones puede pedir (usualmente 1)
                "created_at": now_bogota().isoformat(), # Fecha de compra/regalo (conecta con timezone_utils)
                "expires_at": None, # Fecha de vencimiento (opcional)
                "consumed_at": None, # Fecha de uso (vacío al crear)
                "metodo": metodo # Origen del crédito (ej: 'producto', 'admin')
            }
            
            self.song_credits_data[usuario_id].append(credit_record) # Agrega al historial del usuario
            self._save_song_credits_data(usuario_id) # Persiste al disco (conecta con _save_song_credits_data)
    
    def get_song_credits(self, usuario_id: int) -> List[Dict[str, Any]]: # Consulta historial de créditos
        """Obtiene todos los song_credits de un usuario""" # Docstring simple
        with self.lock: # Protección lectura
            if usuario_id not in self.song_credits_data: # Si no existe
                return [] # Retorna lista vacía
            return self.song_credits_data[usuario_id] # Retorna historial
    
    def get_active_song_credits(self, usuario_id: int) -> int: # Cuenta cuántas canciones TIENE DISPONIBLES el usuario para pedir
        """Obtiene los créditos activos (no consumidos) de un usuario""" # Docstring de lógica
        with self.lock: # Bloqueo hilos
            if usuario_id not in self.song_credits_data: # Sin registro
                return 0 # 0 créditos
            
            total = 0 # Acumulador
            for credit in self.song_credits_data[usuario_id]: # Recorre historial
                if credit.get("consumed_at") is None and credit.get("expires_at") is None: # Si no se ha usado ni ha vencido
                    total += credit.get("credits_value", 0) # Suma al total disponible
            return total # Retorna saldo de créditos
    
    def consume_song_credits(self, usuario_id: int, song_id: int) -> bool: # Gasta un crédito cuando el usuario pide una canción
        """Marca un crédito como consumido""" # Docstring descriptivo
        with self.lock: # Bloqueo total
            if usuario_id not in self.song_credits_data: # Sin saldo
                return False # Error
            
            # Encontrar el primer crédito no consumido
            for credit in self.song_credits_data[usuario_id]: # Itera historial
                if credit.get("consumed_at") is None: # Si encuentra uno libre
                    credit["consumed_at"] = now_bogota().isoformat() # Registra la hora de uso (conecta con timezone_utils)
                    credit["consumed_by_song_id"] = song_id # Lo vincula a la canción pedida
                    self._save_song_credits_data(usuario_id) # Persiste el gasto al disco (conecta con _save_song_credits_data)
                    return True # Crédito gastado con éxito
            
            return False # No tenía créditos libres
    
    def clear_song_credits(self, usuario_id: int) -> None: # Borra el historial de créditos de un usuario
        """Limpia todos los song_credits de un usuario""" # Docstring explicativo
        with self.lock: # Bloqueo total
            if usuario_id in self.song_credits_data: # Si está en memoria
                del self.song_credits_data[usuario_id] # Borra de la memoria global
            
            cache_file = self._get_song_credits_file(usuario_id) # Ruta del archivo (conecta con _get_song_credits_file)
            if cache_file.exists(): # Si existe archivo
                cache_file.unlink() # Borra el archivo físico (conecta con pathlib)
    
    # ========================================================================
    # FUNCIONES DE CACHÉ DE USUARIOS DE SESIÓN (Por mesa, efímeros)
    # ========================================================================

    def _get_usuarios_file(self) -> Path:
        """Obtiene la ruta del archivo de usuarios de sesión."""
        return self.cache_dir / "usuarios.json"

    def _load_usuarios_data(self) -> None:
        """Carga el índice de usuarios desde JSON."""
        cache_file = self._get_usuarios_file()
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.usuarios_data = data.get("usuarios", {})
                    self.usuarios_data = {int(k): v for k, v in self.usuarios_data.items()}
                    self.next_usuario_id = data.get("next_id", max(self.usuarios_data.keys()) + 1 if self.usuarios_data else 1)
            except Exception as e:
                print(f"Error cargando caché de usuarios: {e}")
                self.usuarios_data = {}
                self.next_usuario_id = 1
        else:
            self.usuarios_data = {}
            self.next_usuario_id = 1

    def _save_usuarios_data(self) -> None:
        """Guarda el índice de usuarios a JSON."""
        cache_file = self._get_usuarios_file()
        try:
            data = {
                "usuarios": {str(k): v for k, v in self.usuarios_data.items()},
                "next_id": self.next_usuario_id
            }
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            print(f"Error guardando caché de usuarios: {e}")

    def create_usuario_en_cache(self, usuario_data: dict) -> int:
        """Crea un usuario de sesión en caché y retorna su usuario_id."""
        with self.lock:
            usuario_id = self.next_usuario_id
            self.next_usuario_id += 1
            usuario_data["id"] = usuario_id
            if "created_at" not in usuario_data:
                usuario_data["created_at"] = now_bogota().isoformat()
            if "last_active" not in usuario_data:
                usuario_data["last_active"] = now_bogota().isoformat()
            self.usuarios_data[usuario_id] = usuario_data
            self._save_usuarios_data()
            return usuario_id

    def get_usuario_by_id_from_cache(self, usuario_id: int) -> Optional[Dict[str, Any]]:
        """Obtiene un usuario por ID desde caché."""
        with self.lock:
            return self.usuarios_data.get(int(usuario_id))

    def get_usuario_by_nick_from_cache(self, nick: str) -> Optional[Dict[str, Any]]:
        """Obtiene un usuario por su nick (case-insensitive) desde caché."""
        with self.lock:
            nick_lower = nick.lower()
            for u in self.usuarios_data.values():
                if u.get("nick", "").lower() == nick_lower:
                    return u
            return None

    def get_usuarios_by_mesa_from_cache(self, mesa_id: int) -> List[Dict[str, Any]]:
        """Obtiene todos los usuarios activos de una mesa desde caché."""
        with self.lock:
            return [u for u in self.usuarios_data.values() if u.get("mesa_id") == mesa_id]

    def update_usuario_en_cache(self, usuario_id: int, updates: dict) -> bool:
        """Actualiza datos de un usuario en caché."""
        with self.lock:
            uid = int(usuario_id)
            if uid in self.usuarios_data:
                self.usuarios_data[uid].update(updates)
                self._save_usuarios_data()
                return True
            return False

    def delete_usuario_from_cache(self, usuario_id: int) -> Optional[Dict[str, Any]]:
        """Elimina un usuario del caché y retorna sus datos."""
        with self.lock:
            uid = int(usuario_id)
            if uid in self.usuarios_data:
                u = self.usuarios_data.pop(uid)
                self._save_usuarios_data()
                return u
            return None

    def clear_usuarios_de_mesa(self, mesa_id: int) -> None:
        """Elimina todos los usuarios de sesión de una mesa."""
        with self.lock:
            ids_to_remove = [uid for uid, u in self.usuarios_data.items() if u.get("mesa_id") == mesa_id]
            for uid in ids_to_remove:
                del self.usuarios_data[uid]
            if ids_to_remove:
                self._save_usuarios_data()

    def get_all_usuarios_from_cache(self) -> List[Dict[str, Any]]:
        """Obtiene todos los usuarios de sesión activos."""
        with self.lock:
            return list(self.usuarios_data.values())

    # ========================================================================
    # ALIAS PARA COMPATIBILIDAD (Garantizan que el código viejo siga funcionando)
    # ========================================================================
    
    def create_mesa(self, mesa_data: dict) -> int: # Redirige llamados viejos a la nueva función de mesas
        """Alias para create_mesa_in_cache""" # Docstring descriptivo
        return self.create_mesa_in_cache(
            nombre=mesa_data.get("nombre"),
            qr_code=mesa_data.get("qr_code"),
            local_id=mesa_data.get("local_id"),
            session_id=mesa_data.get("session_id")
        ) # Conecta con create_mesa_in_cache
    
    def update_mesa(self, mesa_id: int, updates: dict) -> bool: # Redirige actualizaciones de mesa
        """Alias para update_mesa_in_cache""" # Docstring simple
        return self.update_mesa_in_cache(mesa_id, updates) # Conecta con update_mesa_in_cache
    
    def add_song(self, cancion_data: dict) -> int: # Redirige adición de canciones
        """Alias para add_song_to_cache""" # Docstring simple
        usuario_id = cancion_data.get("usuario_id", 0) # Extrae el usuario
        return self.add_song_to_cache(usuario_id, cancion_data) # Conecta con add_song_to_cache
    
    def update_song(self, cancion_id: int, updates: dict) -> bool: # Redirige actualizaciones de canciones
        """Alias para update_song_in_cache""" # Docstring simple
        return self.update_song_in_cache(cancion_id, updates) # Conecta con update_song_in_cache
    
    def add_consumo(self, consumo_data: dict) -> int: # Redirige adición de consumos (Legacy)
        """Alias para add_consumo_to_mesa_cache - retorna consumo_id""" # Docstring descriptivo
        mesa_id = consumo_data.get("mesa_id") # Extrae mesa
        if mesa_id: # Si tiene mesa
            self.add_consumo_to_mesa_cache(mesa_id, consumo_data) # Conecta con add_consumo_to_mesa_cache
            # Generar ID para el consumo (Simula comportamiento antiguo)
            if not hasattr(self, '_consumo_id_counter'): # Si no existe el contador local
                self._consumo_id_counter = 1 # Inicia en 1
            consumo_id = self._consumo_id_counter # Asigna ID
            self._consumo_id_counter += 1 # Incrementa
            consumo_data["id"] = consumo_id # Inserta ID
            return consumo_id # Retorna ID simulado
        return None # Falló
    
    def clear_all(self) -> None:
        """Limpia absolutamente todo el caché (Sistema completo)"""
        with self.lock:
            # 1. Limpiar canciones
            self.clear_all_songs()
            
            # 2. Limpiar mesas
            for mesa_file in self.cache_dir.glob("mesa_cuenta_*.json"):
                try:
                    mesa_file.unlink()
                except:
                    pass
            
            self.mesas_data = {}
            self.mesas_cache = {}
            self.next_mesa_id = 1
            self._save_mesas_data() # Guarda mesas.json vacío
            
            # 3. Limpiar consumos
            self.consumos_data = {}
            self.next_consumo_id = 1
            self._save_consumos_data() # Guarda consumos.json vacío
            
            # 4. Limpiar créditos de canciones
            self.song_credits_data = {}
            for credits_file in self.cache_dir.glob("song_credits_*.json"):
                try:
                    credits_file.unlink()
                except:
                    pass

            # 5. Limpiar usuarios de sesión
            self.usuarios_data = {}
            self.next_usuario_id = 1
            self._save_usuarios_data()
            
            # 6. Sincronización
            self.set_queue_revision(1)
            print("CACHE REINICIADO COMPLETAMENTE.")

# Instancia global del cache manager para ser usada en todo el proyecto
cache_manager = CacheManager() # Se importa en outros archivos como: from cache_manager import cache_manager
