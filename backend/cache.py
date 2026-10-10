"""
PurposeCanvas — Semantic Cache (RAG layer)
ChromaDB persistent store + all-MiniLM-L6-v2 embeddings.
Hit if cosine similarity >= CACHE_THRESHOLD (default 0.88).
"""
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .config import settings

logger = logging.getLogger(__name__)

# ── Cache result ──────────────────────────────────────────────────────────────

@dataclass
class CacheHit:
    image_path: str
    image_url: str
    similarity: float
    original_key: str


# ── Lazy-init globals ─────────────────────────────────────────────────────────

_collection = None
_embedder = None


def _get_collection():
    global _collection, _embedder
    if _collection is None:
        import chromadb
        from sentence_transformers import SentenceTransformer

        client = chromadb.PersistentClient(path=settings.CHROMA_PATH)
        _collection = client.get_or_create_collection(
            name="image_cache",
            metadata={"hnsw:space": "cosine"},
        )
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info(f"ChromaDB loaded. Collection has {_collection.count()} items.")
    return _collection, _embedder


# ── Public API ────────────────────────────────────────────────────────────────

def lookup(key: str) -> Optional[CacheHit]:
    """Search cache by intent key. Returns CacheHit if similarity >= threshold."""
    collection, embedder = _get_collection()

    if collection.count() == 0:
        return None

    embedding = embedder.encode(key).tolist()

    results = collection.query(
        query_embeddings=[embedding],
        n_results=1,
        include=["metadatas", "distances"],
    )

    if not results["ids"][0]:
        return None

    # ChromaDB cosine distance: 0=identical, 2=opposite
    # Convert to similarity: 1 - (distance / 2)
    distance = results["distances"][0][0]
    similarity = 1.0 - (distance / 2.0)

    if similarity >= settings.CACHE_THRESHOLD:
        meta = results["metadatas"][0][0]
        logger.info(f"Cache HIT: key='{key}' similarity={similarity:.3f}")
        return CacheHit(
            image_path=meta["image_path"],
            image_url=meta["image_url"],
            similarity=similarity,
            original_key=results["ids"][0][0],
        )

    logger.info(f"Cache MISS: key='{key}' best_similarity={similarity:.3f} < {settings.CACHE_THRESHOLD}")
    return None


def store(key: str, image_path: str, image_url: str, metadata: dict = None):
    """Store a generated image in the cache."""
    collection, embedder = _get_collection()
    embedding = embedder.encode(key).tolist()

    meta = {
        "image_path": image_path,
        "image_url": image_url,
        "key": key,
    }
    if metadata:
        meta.update(metadata)

    collection.upsert(
        ids=[key],
        embeddings=[embedding],
        metadatas=[meta],
    )
    logger.info(f"Cache STORED: key='{key}'")


def count() -> int:
    """Return number of items in cache."""
    collection, _ = _get_collection()
    return collection.count()
