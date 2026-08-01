"""RAG：代码 chunk 向量化（sentence-transformers）+ Qdrant 语义检索

embedding 用 all-MiniLM-L6-v2（轻量 384 维，~80MB，代码英文场景够用）。
每个项目一个 Qdrant collection，分析时索引代码 chunk，搜索时语义检索。
"""
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

_qdrant = None
_embedder = None


def get_qdrant() -> QdrantClient:
    global _qdrant
    if _qdrant is None:
        _qdrant = QdrantClient(url="http://127.0.0.1:6333")
    return _qdrant


def get_embedder():
    global _embedder
    if _embedder is None:
        import os

        os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")  # 国内镜像
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer("all-MiniLM-L6-v2")  # 384 维
    return _embedder


def _col(project_id: str) -> str:
    return f"code_{project_id.replace('-', '_')}"


def index_code_chunks(project_id: str, chunks: list[dict]) -> int:
    """chunks: [{path, content}] -> embedding + upsert Qdrant。返回索引数。"""
    try:
        qd = get_qdrant()
        emb = get_embedder()
        col = _col(project_id)
        cols = [c.name for c in qd.get_collections().collections]
        if col not in cols:
            qd.create_collection(col, vectors_config=VectorParams(size=384, distance=Distance.COSINE))
        texts = [c["content"][:2000] for c in chunks]
        vectors = emb.encode(texts).tolist()
        points = [
            PointStruct(id=i, vector=vectors[i], payload={"path": chunks[i]["path"], "content": chunks[i]["content"][:2000]})
            for i in range(len(chunks))
        ]
        qd.upsert(col, points=points)
        return len(points)
    except Exception as e:
        print(f"RAG index 跳过: {e}")
        return 0


def search_code(project_id: str, query: str, limit: int = 5) -> list[dict]:
    """语义检索代码 chunk"""
    try:
        qd = get_qdrant()
        emb = get_embedder()
        col = _col(project_id)
        qv = emb.encode(query).tolist()
        res = qd.query_points(col, query=qv, limit=limit)
        return [
            {"path": h.payload.get("path"), "content": h.payload.get("content", ""), "score": round(h.score, 3)}
            for h in res.points
        ]
    except Exception:
        return []
