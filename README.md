# IDE-Memory

**IDE Memory - 记录和管理 IDE 中与 AI 聊天工具的会话内容**

一个用于统一管理和记录 IDE 中与 AI 聊天工具会话内容的应用程序。支持记录和管理 GitHub Copilot、Cursor、VS Code、Cloud Code、CodeX 和 Gemini 等 AI 聊天工具的聊天历史和会话信息。

## 功能特性

### 支持的 AI 工具
- ✅ GitHub Copilot Chat
- ✅ Cursor AI
- ✅ VS Code 内置 AI（如 GitHub Copilot）
- ✅ Cloud Code AI（Google Cloud）
- ✅ CodeX（OpenAI）
- ✅ Google Gemini（AI 编程助手）

### 核心功能
- 📝 记录完整的聊天会话（包括提问、回答、代码示例）
- 🔍 支持会话的搜索和分类
- 💾 导出会话（JSON、Markdown、HTML 格式）
- 🏷️ 会话标签和分类管理
- 📊 数据分析和可视化
- 🔄 跨设备数据同步
- 🛡️ 本地存储确保数据安全

## 技术架构

### 后端技术栈
- **语言**: Python 3.8+
- **Web 框架**: Flask
- **数据库**: SQLite
- **ORM**: SQLAlchemy
- **API 设计**: RESTful API
- **身份认证**: JWT

### 前端技术栈
- **框架**: React
- **UI 组件库**: shadcn/ui + Tailwind CSS
- **状态管理**: Context API
- **构建工具**: Vite
- **图表/可视化**: Recharts

### 系统集成
- **VS Code 扩展**: TypeScript + VS Code API
- **Cursor 集成**: 监听 Cursor 的聊天历史存储

## 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- SQLite 3.x
- Git

### 安装和运行

```bash
# 1. 克隆仓库
git clone https://github.com/dishangyijiao/IDE-Memory.git
cd IDE-Memory

# 2. 安装依赖
npm run install:backend  # 安装后端依赖
npm run install:frontend  # 安装前端依赖

# 3. 初始化数据库
npm run init:db

# 4. 启动开发服务器
npm run dev  # 同时启动前后端
# 或
npm run dev:backend  # 单独启动后端
npm run dev:frontend  # 单独启动前端

# 5. 访问应用程序
# 后端: http://localhost:5000
# 前端: http://localhost:5173
```

### 生产环境部署

```bash
# 1. 构建前端
npm run build:frontend

# 2. 启动生产服务器
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 src.main:app
```

## 使用说明

### 1. 基本操作

1. **创建会话**: 在应用程序中点击"创建会话"按钮，选择 AI 工具和项目信息
2. **记录聊天**: 使用 VS Code 或 Cursor 与 AI 工具聊天，系统会自动记录会话
3. **搜索会话**: 使用搜索框搜索会话内容、项目名称或工具名称
4. **导出会话**: 点击会话卡片上的导出按钮，选择导出格式（JSON、Markdown、HTML）

### 2. 高级功能

1. **标签管理**: 为会话添加标签，便于分类和查找
2. **数据分析**: 查看会话统计信息和趋势分析
3. **数据导入**: 导入已有的聊天历史数据
4. **配置管理**: 配置 AI 工具的存储路径和其他设置

## 项目结构

```
IDE-Memory/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── api/            # API 路由和控制器
│   │   ├── models/         # 数据模型
│   │   ├── services/       # 业务逻辑服务
│   │   ├── integrations/   # IDE/AI 工具集成
│   │   └── utils/          # 工具函数
│   ├── tests/              # 测试文件
│   └── requirements.txt    # Python 依赖
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API 服务
│   │   └── utils/         # 工具函数
│   ├── public/
│   └── package.json       # 前端依赖
├── vscode-extension/      # VS Code 扩展
├── cursor-integration/    # Cursor 集成
└── docs/                  # 项目文档
```

## API 文档

### 基础接口

- **获取所有会话**: `GET /api/sessions`
- **创建会话**: `POST /api/sessions`
- **获取会话详情**: `GET /api/sessions/<id>`
- **更新会话**: `PUT /api/sessions/<id>`
- **删除会话**: `DELETE /api/sessions/<id>`

- **获取会话的消息**: `GET /api/sessions/<id>/messages`
- **创建消息**: `POST /api/sessions/<id>/messages`
- **获取消息详情**: `GET /api/messages/<id>`
- **更新消息**: `PUT /api/messages/<id>`
- **删除消息**: `DELETE /api/messages/<id>`

## 贡献指南

### 开发流程

1. 克隆仓库
2. 创建分支：`git checkout -b feature/your-feature`
3. 开发功能
4. 提交代码：`git commit -m "feat: 添加新功能"`
5. 推送到远程仓库
6. 创建 Pull Request

### 代码规范

- 使用 Python 的 PEP 8 规范
- 使用 JavaScript/TypeScript 的 ESLint 规范
- 提交信息使用语义化提交规范

## 许可证

MIT License - 详见 LICENSE 文件

## 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues: [提交问题](https://github.com/dishangyijiao/IDE-Memory/issues)
- 邮箱: [dishangyijiao@example.com](mailto:dishangyijiao@example.com)

## 致谢

感谢以下项目提供的灵感和参考：

- Cursor View (saharmor/cursor-view)
- Copilot History Keeper (merijnwip/copilot-history-keeper)
- Copilot History Viewer (keithwongg/copilot-history-viewer)

---

**IDE-Memory** - 让 AI 聊天历史不再丢失！
