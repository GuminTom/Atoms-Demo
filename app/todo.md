# Multi-Agent Vibe Coding Platform - Development Plan

## Design Guidelines

### Design References
- **Replit.com**: Dark IDE theme, sidebar navigation, collaborative coding
- **Vercel v0.dev**: Clean modern UI, AI-first interface, card-based layouts
- **Cursor.sh**: Agent-centric coding, dark mode, minimal chrome
- **Style**: Dark Mode + Glassmorphism + Neon Accents + Developer-First

### Color Palette
- Primary BG: #09090B (Zinc-950 - deep dark)
- Secondary BG: #18181B (Zinc-900 - cards/panels)
- Tertiary BG: #27272A (Zinc-800 - hover/active states)
- Accent Primary: #8B5CF6 (Violet-500 - primary actions)
- Accent Secondary: #06B6D4 (Cyan-500 - secondary/info)
- Accent Success: #10B981 (Emerald-500 - success/deploy)
- Accent Warning: #F59E0B (Amber-500 - warnings)
- Accent Error: #EF4444 (Red-500 - errors/delete)
- Text Primary: #FAFAFA (Zinc-50)
- Text Secondary: #A1A1AA (Zinc-400)
- Border: #3F3F46 (Zinc-700)

### Typography
- Heading1: Inter font-weight 700 (32px)
- Heading2: Inter font-weight 600 (24px)
- Heading3: Inter font-weight 600 (18px)
- Body: Inter font-weight 400 (14px)
- Code: JetBrains Mono font-weight 400 (13px)

### Key Component Styles
- **Buttons**: Violet gradient for primary, ghost for secondary, rounded-lg
- **Cards**: Dark zinc-900 bg, zinc-800 border, rounded-xl, hover:lift
- **Sidebar**: Zinc-950 bg, zinc-800 active indicator, icon+label
- **Chat bubbles**: User = violet-tinted, Agent = zinc-800, rounded-2xl
- **Code blocks**: Zinc-950 bg, JetBrains Mono, syntax highlighting

### Layout
- Sidebar navigation (collapsible)
- Main content area with top bar
- Responsive: sidebar collapses to icons on mobile

## Database Tables

1. **apps** - User applications (id, user_id, name, description, type, status, agent_mode, thumbnail, created_at, updated_at)
2. **deployments** - App deployments (id, user_id, app_id, status, url, version, environment, logs, created_at)
3. **agent_sessions** - Agent conversation sessions (id, user_id, app_id, mode, messages_json, status, created_at, updated_at)
4. **app_files** - Project file structure (id, app_id, path, content, language, created_at, updated_at)
5. **statistics** - Usage statistics (id, user_id, app_id, metric_type, metric_value, recorded_at)

## Development Tasks

1. Create database tables via BackendManager
2. Generate images for the platform
3. Build shared layout: Sidebar + TopBar + AuthProvider
4. Build Dashboard page (app grid, recent activity, quick actions)
5. Build App Workspace page (chat interface, mode toggle, file tree)
6. Build Profile page (user info, settings)
7. Build Statistics page (charts, metrics overview)
8. Build Deployment page (deploy flow, status, logs)
9. Wire up all routes in App.tsx
10. Lint, build, and verify