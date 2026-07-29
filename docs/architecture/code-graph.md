# 代码图谱生成方案

## 概述

参考 [DeepWiki-Open](https://github.com/AsyncFuncAI/deepwiki-open) 的理念，为接入的项目自动生成**模块级代码文档和关系图谱**。

目标：让任何人快速理解一个陌生项目的架构和代码关系。

## 架构

```
源代码仓库
    │
    ├──► tree-sitter AST 解析 ──► 提取模块/类/函数结构
    │
    ├──► Import 分析 ──► 提取模块间依赖关系
    │
    ├──► Call Graph 分析 ──► 提取函数调用关系
    │
    ├──► LLM 文档生成 ──► 为每个模块生成自然语言描述
    │
    ├──► Embedding ──► 存入 Qdrant（支持语义搜索）
    │
    └──► 输出：
         ├── modules/{name}.md（模块文档页面）
         ├── 可视化关系图（前端 ECharts/Force Graph）
         └── 语义搜索接口
```

## 模块级文档结构

每个模块自动生成一份 Markdown 文档：

```markdown
# Module: auth_service

## 概述
[LLM 生成的模块描述：职责、核心功能、设计思路]

## 关键类/函数
| 名称 | 类型 | 职责 | 复杂度 |
|------|------|------|--------|
| AuthService | class | 认证服务主类 | 12 |
| validate_token() | function | JWT Token 验证 | 8 |
| refresh_session() | function | 会话刷新 | 5 |

## 依赖关系
### 依赖的模块
- `database` — 数据持久层
- `config` — 配置管理

### 被依赖的模块
- `api.routes.auth` — 认证 API 路由
- `middleware.auth` — 认证中间件

## 调用关系图
[可视化的调用关系]

## 核心流程
[LLM 生成的核心业务流程描述]
```

## tree-sitter 解析策略

```python
import tree_sitter
from tree_sitter import Language, Parser

class CodeGraphBuilder:
    """使用 tree-sitter 构建代码图谱"""

    SUPPORTED_LANGUAGES = {
        "python": "tree-sitter-python",
        "javascript": "tree-sitter-javascript",
        "typescript": "tree-sitter-typescript",
        "go": "tree-sitter-go",
        "java": "tree-sitter-java",
        "rust": "tree-sitter-rust",
    }

    def build_graph(self, project_path: str) -> CodeGraph:
        """构建完整的代码图谱"""
        nodes = []
        edges = []

        for file_path in self._walk_source_files(project_path):
            lang = self._detect_language(file_path)
            if lang not in self.SUPPORTED_LANGUAGES:
                continue

            parser = self._get_parser(lang)
            with open(file_path, "rb") as f:
                source = f.read()

            tree = parser.parse(source)
            file_nodes, file_edges = self._extract_structure(tree, file_path, source)
            nodes.extend(file_nodes)
            edges.extend(file_edges)

        # 跨文件 import 分析
        import_edges = self._analyze_imports(nodes, project_path)
        edges.extend(import_edges)

        return CodeGraph(nodes=nodes, edges=edges)

    def _extract_structure(self, tree, file_path, source):
        """从 AST 中提取模块/类/函数节点"""
        nodes = []
        edges = []

        root = tree.root_node
        module_name = self._path_to_module(file_path)

        # 创建模块节点
        module_node = GraphNode(
            type="module",
            name=module_name,
            file_path=file_path,
            line_start=0,
            line_end=root.end_point[0],
        )
        nodes.append(module_node)

        # 遍历提取类和函数
        for child in root.children:
            if child.type in ("class_definition", "class_declaration"):
                class_node = self._extract_class(child, module_name, file_path, source)
                nodes.append(class_node)
                edges.append(GraphEdge(module_node.id, class_node.id, "contains"))

            elif child.type in ("function_definition", "function_declaration",
                               "method_definition"):
                func_node = self._extract_function(child, module_name, file_path, source)
                nodes.append(func_node)
                edges.append(GraphEdge(module_node.id, func_node.id, "contains"))

        return nodes, edges

    def _analyze_imports(self, nodes, project_path):
        """分析跨文件的 import 依赖"""
        edges = []
        modules = {n.name: n for n in nodes if n.type == "module"}

        for node in nodes:
            if node.type == "module":
                imports = self._extract_imports(node.file_path)
                for imp in imports:
                    target_module = self._resolve_import(imp, modules)
                    if target_module:
                        edges.append(GraphEdge(
                            source=node.id,
                            target=target_module.id,
                            type="import"
                        ))

        return edges
```

## LLM 文档生成

```python
class ModuleDocGenerator:
    """使用 LLM 为每个模块生成文档"""

    PROMPT_TEMPLATE = """
你是一个代码文档专家。请根据以下模块的代码结构信息，生成一份清晰的模块文档。

## 模块信息
- 模块名: {module_name}
- 文件路径: {file_path}
- 语言: {language}

## 代码结构
{structure_summary}

## 关键类和函数
{classes_and_functions}

## 依赖关系
- 依赖: {dependencies}
- 被依赖: {dependents}

## 要求
1. 用一段话概述这个模块的职责和设计思路
2. 列出关键类/函数及其职责（表格形式）
3. 描述核心业务流程
4. 指出需要注意的设计决策或技术债务
5. 语言：中文
"""

    async def generate_doc(self, module_node: GraphNode, graph: CodeGraph) -> str:
        """为单个模块生成文档"""
        # 收集模块上下文
        children = graph.get_children(module_node.id)
        deps = graph.get_dependencies(module_node.id)
        dependents = graph.get_dependents(module_node.id)

        prompt = self.PROMPT_TEMPLATE.format(
            module_name=module_node.name,
            file_path=module_node.file_path,
            language=module_node.language,
            structure_summary=self._summarize_structure(children),
            classes_and_functions=self._format_children(children),
            dependencies=", ".join(d.name for d in deps),
            dependents=", ".join(d.name for d in dependents),
        )

        response = await self.llm_client.chat(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )

        return response.content
```

## Qdrant 向量存储

```python
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance

class CodeVectorStore:
    """代码图谱的向量存储，支持语义搜索"""

    COLLECTION_NAME = "code_graph"

    def __init__(self, qdrant_url: str, api_key: str):
        self.client = QdrantClient(url=qdrant_url, api_key=api_key)

    def setup_collection(self):
        """初始化向量集合"""
        self.client.create_collection(
            collection_name=self.COLLECTION_NAME,
            vectors_config=VectorParams(
                size=1536,  # text-embedding-3-small 维度
                distance=Distance.COSINE
            )
        )

    async def index_module(self, module_doc: str, module_node: GraphNode):
        """将模块文档向量化并存入 Qdrant"""
        embedding = await self.embedder.embed(module_doc)

        self.client.upsert(
            collection_name=self.COLLECTION_NAME,
            points=[PointStruct(
                id=module_node.id,
                vector=embedding,
                payload={
                    "name": module_node.name,
                    "file_path": module_node.file_path,
                    "type": module_node.type,
                    "doc_preview": module_doc[:500],
                }
            )]
        )

    def search(self, query: str, top_k: int = 10) -> list:
        """语义搜索代码模块"""
        query_vector = self.embedder.embed_sync(query)
        results = self.client.search(
            collection_name=self.COLLECTION_NAME,
            query_vector=query_vector,
            limit=top_k
        )
        return [
            SearchResult(
                name=r.payload["name"],
                file_path=r.payload["file_path"],
                score=r.score,
                doc_preview=r.payload["doc_preview"],
            )
            for r in results
        ]
```

## 前端可视化

### 关系图谱（Force-directed Graph）

使用 ECharts Graph 或 D3.js force layout：

```
         ┌─────────┐
         │  auth    │
         │ service  │──── depends ────┐
         └────┬────┘                  │
              │                       ▼
         contains                ┌─────────┐
              │                  │database  │
              ▼                  │  module  │
    ┌──────────────┐             └─────────┘
    │ AuthService  │
    │  class       │──── calls ────► validate_token()
    └──────────────┘
```

### 文档浏览页面（类 DeepWiki）

```
┌─────────────────────────────────────────────────────────┐
│  📁 Project: api-service                                │
│                                                         │
│  ┌── 目录树 ──┐  ┌── 模块文档 ─────────────────────┐    │
│  │            │  │                                  │    │
│  │ 📁 src/    │  │  # auth_service                  │    │
│  │  ├─ auth/  │  │                                  │    │
│  │  ├─ api/   │  │  认证服务模块，负责用户身份验证    │    │
│  │  ├─ db/    │  │  和会话管理...                    │    │
│  │  └─ utils/ │  │                                  │    │
│  │            │  │  ## 关键类/函数                   │    │
│  │ 📁 tests/  │  │  | 名称 | 职责 | 复杂度 |         │    │
│  │            │  │  |---|---|---|                    │    │
│  │ 📄 README  │  │  ...                             │    │
│  │            │  │                                  │    │
│  └────────────┘  │  ## 调用关系图                    │    │
│                  │  [可视化图谱]                      │    │
│                  └──────────────────────────────────┘    │
│                                                         │
│  🔍 语义搜索: [搜索代码模块...           ]               │
└─────────────────────────────────────────────────────────┘
```
