## Why

当前市场上缺乏一个集成了多智能体协作能力的 Vibe Coding 平台。用户需要一个能够通过自然语言与多个 AI Agent 协作，快速将创意转化为可运行应用的平台。MetaGPT 展示了多智能体协作的强大能力，而 Atoms 提供了优秀的用户界面设计参考。本项目旨在结合两者的优势，构建一个现代化、易用的多智能体 Vibe Coding 平台。

## What Changes

- 构建一个基于多智能体的 Vibe Coding 平台，支持工程师模式和团队模式
- 实现用户认证系统，支持注册、登录、账号配置
- 创建应用管理系统，支持创建、编辑、删除、发布应用
- 设计工作空间界面，参考 Atoms 的现代化布局
- 实现多智能体协作系统，参考 MetaGPT 的架构
- 提供应用部署和访问功能
- 实现项目持久化存储，包括对话记录、代码、配置、日志
- 提供统计信息功能，展示应用创建数量、发布数量、访问量、Tokens 消耗等

## Capabilities

### New Capabilities

- `user-auth`: 用户认证系统，包括注册、登录、登出、密码重置
- `user-profile`: 用户个人资料管理，包括用户名、密码、头像、平台背景色等
- `workspace-config`: 工作空间配置，包括 Github 账号绑定、Agent 默认模型配置
- `app-management`: 应用管理系统，支持创建、编辑、删除、查看应用列表
- `app-workspace`: 应用工作空间，提供可视化界面进行 Vibe Coding
- `agent-system`: 多智能体系统，支持工程师模式（单个 Agent）和团队模式（多个 Agent 协作）
- `app-deployment`: 应用部署系统，支持将应用发布到平台服务器
- `project-persistence`: 项目持久化存储，保存对话记录、代码、配置、日志等
- `statistics`: 统计信息系统，展示应用创建数量、发布数量、访问量、Tokens 消耗等
- `recents`: 最近应用列表，展示用户最近创建的应用

### Modified Capabilities

- 无现有能力需要修改

## Impact

- **前端**: 新增 React + TypeScript + Tailwind CSS 前端应用，参考 Atoms 设计布局
- **后端**: 新增 Golang + Hertz 后端服务，采用 DDD 架构，参考 MetaGPT 多智能体实现
- **API**: 新增基于 Protobuf 的 IDL 定义，前后端通过 gRPC 或 HTTP 通信
- **数据库**: 需要存储用户信息、应用数据、项目代码、对话记录、日志等
- **部署**: 需要支持应用的自动部署和访问
- **第三方服务**: 可能需要集成 Github API、大模型 API（如 OpenAI、Qwen 等）
