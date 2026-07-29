# API 接口规范

## 基础规范

- **Base URL**: `/api/v1`
- **认证**: Bearer Token (JWT)
- **格式**: JSON
- **分页**: `?page=1&page_size=20`，响应包含 `total`, `page`, `page_size`
- **错误格式**: `{"detail": "error message", "code": "ERROR_CODE"}`

## 接口总览

### 项目管理

```
POST   /api/v1/projects                    # 接入新项目
GET    /api/v1/projects                    # 项目列表
GET    /api/v1/projects/{id}               # 项目详情
PUT    /api/v1/projects/{id}               # 更新项目配置
DELETE /api/v1/projects/{id}               # 删除项目
POST   /api/v1/projects/{id}/analyze       # 触发重新分析
GET    /api/v1/projects/{id}/status        # 分析进度（SSE）
GET    /api/v1/projects/{id}/snapshots     # 项目快照历史
```

### 开发者画像

```
GET    /api/v1/developers                  # 开发者列表
GET    /api/v1/developers/{id}             # 开发者详情
GET    /api/v1/developers/{id}/skills      # 能力向量
GET    /api/v1/developers/{id}/skills/history  # 能力变化历史
GET    /api/v1/developers/{id}/projects    # 参与的项目
GET    /api/v1/developers/{id}/growth      # 成长曲线数据
GET    /api/v1/developers/{id}/collaborators  # 协作网络
```

### 团队分析

```
GET    /api/v1/teams                       # 团队列表
GET    /api/v1/teams/{id}                  # 团队详情
GET    /api/v1/teams/{id}/capabilities     # 团队能力快照
GET    /api/v1/teams/{id}/capabilities/history  # 能力变化
GET    /api/v1/teams/{id}/risks            # 风险指标
GET    /api/v1/teams/{id}/members          # 成员列表
GET    /api/v1/teams/{id}/network          # 协作关系图
```

### 组织架构

```
GET    /api/v1/departments                 # 部门树
POST   /api/v1/departments                 # 创建部门
PUT    /api/v1/departments/{id}            # 更新部门
DELETE /api/v1/departments/{id}            # 删除部门
POST   /api/v1/departments/sync-gitlab     # 从 GitLab 同步
```

### 身份匹配

```
GET    /api/v1/identity-mappings           # 映射列表
POST   /api/v1/identity-mappings           # 创建映射
PUT    /api/v1/identity-mappings/{id}      # 确认/修正映射
GET    /api/v1/identity-mappings/unmatched # 未匹配的 Git 身份
POST   /api/v1/identity-mappings/auto-match  # 触发自动匹配
```

### 代码图谱

```
GET    /api/v1/code-graph/{project_id}/nodes    # 节点列表
GET    /api/v1/code-graph/{project_id}/edges    # 边列表
GET    /api/v1/code-graph/{project_id}/graph    # 完整图谱
GET    /api/v1/code-graph/{project_id}/modules  # 模块列表
GET    /api/v1/code-graph/{project_id}/search   # 语义搜索
```

### 评估报告

```
GET    /api/v1/assessments/project/{id}    # 项目评估报告
GET    /api/v1/assessments/developer/{id}  # 开发者评估报告
GET    /api/v1/assessments/team/{id}       # 团队评估报告
GET    /api/v1/assessments/dashboard       # Dashboard 聚合数据
```

### 系统设置

```
GET    /api/v1/settings                    # 系统配置
PUT    /api/v1/settings                    # 更新配置
POST   /api/v1/settings/test-connection    # 测试 GitLab 连接
```

## 核心接口详细设计

### POST /api/v1/projects — 接入新项目

**请求体：**

```json
{
  "gitlab_url": "https://gitlab.company.com/team/project-x",
  "access_token": "glpat-xxxxxxxxxxxx",
  "analysis_scope": {
    "branches": ["main", "develop"],
    "time_range_months": 6
  },
  "auto_discover_org": true
}
```

**响应体：**

```json
{
  "id": "uuid",
  "name": "project-x",
  "status": "analyzing",
  "gitlab_project_id": 12345,
  "discovered_info": {
    "languages": {"python": 65, "typescript": 35},
    "contributor_count": 23,
    "commit_count_6m": 1847,
    "estimated_analysis_time_minutes": 15
  },
  "analysis_progress": {
    "stage": "cloning",
    "percentage": 5,
    "message": "正在克隆仓库..."
  }
}
```

### GET /api/v1/projects/{id}/status — 分析进度 (SSE)

**SSE 事件流：**

```
event: progress
data: {"stage": "git_analysis", "percentage": 35, "message": "正在分析 Git 历史..."}

event: progress
data: {"stage": "code_quality", "percentage": 55, "message": "正在运行代码质量分析..."}

event: progress
data: {"stage": "ai_review", "percentage": 75, "message": "AI 正在审查关键模块..."}

event: progress
data: {"stage": "model_inference", "percentage": 90, "message": "正在计算能力模型..."}

event: complete
data: {"project_id": "uuid", "report_url": "/api/v1/assessments/project/uuid"}

event: error
data: {"error": "GitLab connection failed", "code": "GITLAB_ERROR"}
```

### GET /api/v1/developers/{id}/skills — 能力向量

```json
{
  "person_id": "uuid",
  "person_name": "张三",
  "period": "2024-01-W4",
  "skills": {
    "code_quality": 82.5,
    "architecture": 75.0,
    "stability": 88.3,
    "efficiency": 71.2,
    "collaboration": 69.8,
    "security_aware": 73.1,
    "growth_velocity": 12.4
  },
  "composite_score": 77.1,
  "highlights": [
    "稳定性高于团队平均 15 分",
    "协作能力为当前短板",
    "成长速度为正，呈上升趋势"
  ],
  "team_average": {
    "code_quality": 74.2,
    "architecture": 70.1,
    "stability": 73.0,
    "efficiency": 72.5,
    "collaboration": 71.3,
    "security_aware": 68.9
  }
}
```

### GET /api/v1/assessments/dashboard — Dashboard 聚合

```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "api-service",
      "health_score": 78,
      "health_trend": "stable",
      "quality_score": 82,
      "security_score": 71,
      "tech_debt_score": 65,
      "risk_flags": ["技术债务连续4周增长"]
    }
  ],
  "teams": [
    {
      "id": "uuid",
      "name": "后端组",
      "member_count": 12,
      "avg_composite_score": 74.5,
      "bus_factor": 2,
      "risk_level": "medium"
    }
  ],
  "alerts": [
    {
      "type": "bus_factor",
      "severity": "high",
      "message": "api-service 的 Bus Factor 降至 2",
      "target_type": "project",
      "target_id": "uuid"
    },
    {
      "type": "tech_debt",
      "severity": "medium",
      "message": "user-service 技术债务连续 4 周增长",
      "target_type": "project",
      "target_id": "uuid"
    }
  ]
}
```
