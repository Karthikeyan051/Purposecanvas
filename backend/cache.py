"""
PurposeCanvas — RAG Vector Cache
Uses Ollama nomic-embed-text for embeddings + Supabase pgvector for storage.
Falls back to in-memory exact match if Supabase unavailable.
"""
import hashlib
import logging
import os
import time
from typing import Optional

log = logging.getLogger(__name__)

# ─── In-memory fallback cache ──────────────────────────────────────────────
_MEM_CACHE: dict[str, dict] = {}


# ─── Embedding ──────────────────────────────────────────────────────────────
def _get_embedding(text: str) -> list[float] | None:
    """Get text embedding from Ollama nomic-embed-text (local, no internet)."""
    from .config import settings
    if not settings.ENABLE_VECTOR_EMBED:
        return None
    try:
        import ollama
        resp = ollama.embed(model=settings.OLLAMA_EMBED_MODEL, input=text)
        # resp.embeddings is list of list[float]
        return resp.embeddings[0] if resp.embeddings else None
    except Exception as e:
        log.warning(f"[EMBED] Failed to generate embedding: {e}")
        return None


# ─── Supabase client ─────────────────────────────────────────────────────────
def _get_supabase():
    from .config import settings
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return None
    try:
        from supabase import create_client
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        log.warning(f"[SUPABASE] Client init failed: {e}")
        return None


# ─── Cache Key ────────────────────────────────────────────────────────────────
def make_key(intent_key: str) -> str:
    return hashlib.md5(intent_key.lower().strip().encode()).hexdigest()[:16]


# ─── Lookup ──────────────────────────────────────────────────────────────────
def lookup(intent_key: str) -> Optional[dict]:
    """
    1. Try Supabase vector similarity search (semantic RAG)
    2. Try Supabase exact key match
    3. Try in-memory exact match
    """
    from .config import settings
    key = make_key(intent_key)

    # 1. Try semantic vector search in Supabase
    if settings.ENABLE_VECTOR_EMBED:
        embedding = _get_embedding(intent_key)
        if embedding:
            result = _supabase_vector_search(embedding, settings.CACHE_THRESHOLD)
            if result:
                log.info(f"[CACHE] Vector HIT for '{intent_key}' (similarity={result.get('similarity', 0):.3f})")
                return result

    # 2. Try exact key lookup in Supabase
    sb = _get_supabase()
    if sb:
        try:
            resp = sb.table("vector_cache").select("*").eq("key", key).limit(1).execute()
            if resp.data:
                log.info(f"[CACHE] Exact HIT in Supabase for '{intent_key}'")
                return resp.data[0]
        except Exception as e:
            log.warning(f"[CACHE] Supabase lookup failed: {e}")

    # 3. In-memory fallback
    if key in _MEM_CACHE:
        log.info(f"[CACHE] Memory HIT for '{intent_key}'")
        return _MEM_CACHE[key]

    log.info(f"[CACHE] MISS for '{intent_key}'")
    return None


def _supabase_vector_search(embedding: list[float], threshold: float) -> Optional[dict]:
    """Call the match_vectors RPC function in Supabase."""
    sb = _get_supabase()
    if not sb:
        return None
    try:
        resp = sb.rpc("match_vectors", {
            "query_embedding": embedding,
            "match_threshold": threshold,
        }).execute()
        if resp.data:
            return resp.data[0]
    except Exception as e:
        log.warning(f"[CACHE] Vector search failed: {e}")
    return None


# ─── Store ───────────────────────────────────────────────────────────────────
def store(intent_key: str, image_path: str, image_url: str, intent_type: str = "") -> None:
    """
    Store in:
    1. Supabase (with embedding if vector mode enabled)
    2. In-memory fallback
    """
    from .config import settings
    key = make_key(intent_key)

    # In-memory always
    _MEM_CACHE[key] = {
        "key": key,
        "image_path": image_path,
        "image_url": image_url,
        "intent_type": intent_type,
    }

    # Supabase store
    sb = _get_supabase()
    if sb:
        try:
            record: dict = {
                "key": key,
                "image_path": image_path,
                "image_url": image_url,
                "intent_type": intent_type,
            }
            if settings.ENABLE_VECTOR_EMBED:
                embedding = _get_embedding(intent_key)
                if embedding:
                    record["embedding"] = embedding
                    log.info(f"[CACHE] Stored with vector embedding ({len(embedding)} dims)")

            sb.table("vector_cache").upsert(record).execute()
            log.info(f"[CACHE] Stored in Supabase: key={key}")
        except Exception as e:
            log.warning(f"[CACHE] Supabase store failed: {e}")

def count() -> int:
    """Return total number of rows in Supabase cache."""
    sb = _get_supabase()
    if sb:
        try:
            resp = sb.table("vector_cache").select("id", count="exact").execute()
            return resp.count if resp.count else 0
        except Exception:
            pass
    return len(_MEM_CACHE)


def count() -> int:
    """Return total number of rows in Supabase cache."""
    sb = _get_supabase()
    if sb:
        try:
            resp = sb.table("vector_cache").select("id", count="exact").execute()
            return resp.count if resp.count else 0
        except Exception:
            pass
    return len(_MEM_CACHE)

