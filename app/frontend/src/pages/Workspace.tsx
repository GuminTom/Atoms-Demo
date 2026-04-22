import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, client } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Send,
  Bot,
  Users,
  Plus,
  Play,
  FileCode,
  FolderTree,
  MessageSquare,
  Settings,
  Sparkles,
  User,
  Loader2,
  ChevronRight,
  Rocket,
  Trash2,
  X,
  Save,
  FilePlus,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  agent?: string;
  timestamp: Date;
}

interface FileItem {
  id: number;
  path: string;
  language?: string;
  content?: string;
}

interface SessionInfo {
  id: number;
  mode: string;
  status: string;
  messages_json: string;
  created_at?: string;
  updated_at?: string;
}

const agentColors: Record<string, string> = {
  Alex: 'text-violet-400',
  Emma: 'text-cyan-400',
  Bob: 'text-emerald-400',
  Mike: 'text-amber-400',
  David: 'text-rose-400',
  Sarah: 'text-pink-400',
};

const langMap: Record<string, string> = {
  tsx: 'typescript',
  ts: 'typescript',
  jsx: 'javascript',
  js: 'javascript',
  css: 'css',
  html: 'html',
  json: 'json',
  md: 'markdown',
  py: 'python',
};

function getLanguage(path: string): string {
  const ext = path.split('.').pop() || '';
  return langMap[ext] || ext;
}

function buildEntityQueryUrl(
  basePath: string,
  queryDict?: Record<string, unknown>,
  options?: { limit?: number; sort?: string; skip?: number }
): string {
  const params = new URLSearchParams();

  if (queryDict && Object.keys(queryDict).length > 0) {
    params.set('query', JSON.stringify(queryDict));
  }
  if (typeof options?.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (typeof options?.skip === 'number') {
    params.set('skip', String(options.skip));
  }
  if (options?.sort) {
    params.set('sort', options.sort);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export default function Workspace() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const [mode, setMode] = useState<'engineer' | 'team'>('engineer');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [appName, setAppName] = useState('New App');
  const [showNewApp, setShowNewApp] = useState(!appId);
  const [newAppName, setNewAppName] = useState('');
  const [newAppType, setNewAppType] = useState('react');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [activeFileContent, setActiveFileContent] = useState<string>('');
  const [editingFile, setEditingFile] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [rightTab, setRightTab] = useState('preview');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef<string>('');

  // Session persistence state
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (appId) {
      loadApp();
      loadFiles();
      loadSessions();
    }
  }, [appId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-save messages when they change (only when auto_save preference is enabled)
  useEffect(() => {
    if (prefs.auto_save && messages.length > 0 && appId && currentSession) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        persistMessages(messages);
      }, prefs.auto_save_delay);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [messages, appId, currentSession, prefs.auto_save, prefs.auto_save_delay]);

  const loadApp = async () => {
    try {
      const res = await api.get(`/api/v1/entities/apps/${appId!}`);
      if (res) {
        setAppName(res.name || 'Untitled');
        setMode((res.agent_mode as 'engineer' | 'team') || 'engineer');
      }
    } catch {
      // App not found
    }
  };

  const loadFiles = useCallback(async () => {
    if (!appId) return;
    try {
      const res = await api.get(
        buildEntityQueryUrl(
          '/api/v1/entities/app_files',
          { app_id: Number(appId) },
          { limit: 100, sort: 'path' }
        )
      );
      const items = res?.items || [];
      setFiles(items);
      if (items.length > 0 && !activeFile) {
        setActiveFile(items[0].path);
        setActiveFileContent(items[0].content || '');
      }
    } catch {
      setFiles([]);
    }
  }, [appId, activeFile]);

  const loadSessions = async () => {
    if (!appId) return;
    try {
      const res = await api.get(
        buildEntityQueryUrl(
          '/api/v1/entities/agent_sessions',
          { app_id: Number(appId) },
          { limit: 50, sort: '-id' }
        )
      );
      const items = res?.items || [];
      setSessions(items);
      // Load the most recent session
      if (items.length > 0) {
        const latest = items[0];
        setCurrentSession(latest);
        restoreMessages(latest);
      } else {
        // Create a new session
        await createNewSession();
      }
    } catch {
      // No sessions yet, create one
      await createNewSession();
    }
  };

  const createNewSession = async () => {
    if (!appId) return;
    try {
      const res = await api.post('/api/v1/entities/agent_sessions', {
        app_id: Number(appId),
        mode: mode,
        messages_json: JSON.stringify([]),
        status: 'active',
      });
      if (res) {
        setCurrentSession(res);
        setMessages([]);
        setSessions(prev => [res, ...prev]);
      }
    } catch {
      // Handle error
    }
  };

  const restoreMessages = (session: SessionInfo) => {
    try {
      if (session.messages_json) {
        const parsed = JSON.parse(session.messages_json);
        if (Array.isArray(parsed)) {
          const restored: Message[] = parsed.map((m: any, i: number) => ({
            id: m.id || `restored-${i}`,
            role: m.role || 'user',
            content: m.content || '',
            agent: m.agent,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          }));
          setMessages(restored);
        }
      }
    } catch {
      setMessages([]);
    }
  };

  const persistMessages = async (msgs: Message[]) => {
    if (!currentSession || !appId) return;
    setSaveStatus('saving');
    try {
      const serializable = msgs.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agent: m.agent,
        timestamp: m.timestamp.toISOString(),
      }));
      await api.put(`/api/v1/entities/agent_sessions/${currentSession.id}`, {
        messages_json: JSON.stringify(serializable),
        status: 'active',
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  const switchSession = async (session: SessionInfo) => {
    // Save current session first
    if (currentSession && messages.length > 0) {
      await persistMessages(messages);
    }
    setCurrentSession(session);
    restoreMessages(session);
  };

  const selectFile = async (path: string) => {
    const file = files.find(f => f.path === path);
    if (file) {
      setActiveFile(path);
      setActiveFileContent(file.content || '');
      setEditingFile(false);
    }
  };

  const createFile = async () => {
    if (!newFilePath.trim() || !appId) return;
    try {
      await api.post('/api/v1/entities/app_files', {
        app_id: Number(appId),
        path: newFilePath.trim(),
        content: '',
        language: getLanguage(newFilePath),
      });
      setShowNewFile(false);
      setNewFilePath('');
      await loadFiles();
      setActiveFile(newFilePath.trim());
      setActiveFileContent('');
    } catch {
      // Handle error
    }
  };

  const saveFile = async () => {
    if (!appId || !activeFile) return;
    const file = files.find(f => f.path === activeFile);
    if (!file) return;
    try {
      await api.put(`/api/v1/entities/app_files/${file.id}`, { content: activeFileContent });
      setEditingFile(false);
      await loadFiles();
    } catch {
      // Handle error
    }
  };

  const deleteFile = async (path: string) => {
    const file = files.find(f => f.path === path);
    if (!file || !appId) return;
    if (!confirm(`Delete ${path}?`)) return;
    try {
      await api.delete(`/api/v1/entities/app_files/${file.id}`);
      if (activeFile === path) {
        const remaining = files.filter(f => f.path !== path);
        if (remaining.length > 0) {
          setActiveFile(remaining[0].path);
          setActiveFileContent(remaining[0].content || '');
        } else {
          setActiveFile('');
          setActiveFileContent('');
        }
      }
      await loadFiles();
    } catch {
      // Handle error
    }
  };

  const createApp = async () => {
    if (!newAppName.trim()) return;
    try {
      const res = await api.post('/api/v1/entities/apps', {
        name: newAppName,
        type: newAppType,
        status: 'draft',
        agent_mode: mode,
        description: `A ${newAppType} application`,
      });
      if (res?.id) {
        navigate(`/workspace/${res.id}`, { replace: true });
        setShowNewApp(false);
        setAppName(newAppName);
      }
    } catch {
      // Handle error
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    const userContent = input;
    setInput('');
    setSending(true);
    streamingContentRef.current = '';

    const agentName = mode === 'team'
      ? ['Alex', 'Emma', 'Bob'][Math.floor(Math.random() * 3)]
      : 'Alex';

    const agentMsgId = (Date.now() + 1).toString();
    const agentMsg: Message = {
      id: agentMsgId,
      role: 'agent',
      content: '',
      agent: agentName,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, agentMsg]);

    try {
      const systemPrompt = mode === 'team'
        ? `You are ${agentName}, part of a multi-agent coding team. You collaborate with other agents (Mike the leader, Emma the PM, Bob the architect, Alex the engineer, David the data analyst, Sarah the SEO specialist). Help the user build their application. Be concise and actionable.`
        : `You are Alex, an expert engineer agent. Help the user build their application with clean, production-ready code. Be concise and actionable.`;

      const chatHistory = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }));

      await client.ai.gentxt({
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory,
          { role: 'user', content: userContent },
        ],
        model: 'deepseek-v3.2',
        stream: true,
        onChunk: (chunk: { content?: string }) => {
          if (chunk.content) {
            streamingContentRef.current += chunk.content;
            setMessages(prev =>
              prev.map(m =>
                m.id === agentMsgId
                  ? { ...m, content: streamingContentRef.current }
                  : m
              )
            );
          }
        },
        onComplete: () => {
          setSending(false);
        },
        onError: (error: { message?: string }) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === agentMsgId
                ? { ...m, content: m.content || `Error: ${error.message || 'Failed to get response'}` }
                : m
            )
          );
          setSending(false);
        },
        timeout: 60_000,
      });
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === agentMsgId
            ? { ...m, content: m.content || `Error: ${err?.message || 'Failed to get AI response'}` }
            : m
        )
      );
      setSending(false);
    }
  };

  const handleDeploy = async () => {
    if (!appId) return;
    try {
      await api.post('/api/v1/entities/deployments', {
        app_id: Number(appId),
        app_name: appName,
        status: 'pending',
      });
      navigate('/deployments');
    } catch {
      // Handle error
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (showNewApp) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Card className="bg-card border-border w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted -ml-2 mr-1"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Plus className="w-5 h-5 text-violet-400" />
              Create New App
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">App Name</label>
              <Input
                value={newAppName}
                onChange={e => setNewAppName(e.target.value)}
                placeholder="My Awesome App"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground/70 focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Project Type</label>
              <div className="grid grid-cols-3 gap-2">
                {['react', 'vue', 'static'].map(type => (
                  <button
                    key={type}
                    onClick={() => setNewAppType(type)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      newAppType === type
                        ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50'
                        : 'bg-muted text-muted-foreground border border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    {type === 'react' ? '⚛️ React' : type === 'vue' ? '💚 Vue' : '📄 Static'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Agent Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('engineer')}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    mode === 'engineer'
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50'
                      : 'bg-muted text-muted-foreground border border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <Bot className="w-4 h-4" /> Engineer
                </button>
                <button
                  onClick={() => setMode('team')}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    mode === 'team'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                      : 'bg-muted text-muted-foreground border border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <Users className="w-4 h-4" /> Team
                </button>
              </div>
            </div>
            <Button
              onClick={createApp}
              className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-medium rounded-xl"
              disabled={!newAppName.trim()}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create & Start Coding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel - File Tree */}
      <div className="w-56 border-r border-border flex flex-col bg-background">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-muted-foreground" />
            Files
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground/80"
            onClick={() => setShowNewFile(true)}
          >
            <FilePlus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* New file input */}
        {showNewFile && (
          <div className="p-2 border-b border-border flex gap-1">
            <Input
              value={newFilePath}
              onChange={e => setNewFilePath(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFile()}
              placeholder="src/NewFile.tsx"
              className="bg-muted border-border text-foreground text-xs h-7 placeholder:text-muted-foreground/70 focus:border-violet-500"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-emerald-400 hover:text-emerald-300 flex-shrink-0"
              onClick={createFile}
              disabled={!newFilePath.trim()}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground/80 flex-shrink-0"
              onClick={() => { setShowNewFile(false); setNewFilePath(''); }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {files.length === 0 ? (
              <div className="text-center py-6">
                <FileCode className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-muted-foreground/70 text-xs">No files yet</p>
                <p className="text-muted-foreground/50 text-[10px] mt-1">Click + to add a file</p>
              </div>
            ) : (
              files.map(file => (
                <div
                  key={file.id}
                  className={`group flex items-center gap-1 rounded text-xs font-mono transition-colors ${
                    activeFile === file.path
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-muted-foreground hover:text-foreground/80 hover:bg-muted/50'
                  }`}
                >
                  <button
                    onClick={() => selectFile(file.path)}
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left"
                  >
                    <FileCode className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{file.path}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFile(file.path); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground/70 hover:text-rose-400 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Session History at bottom */}
        {sessions.length > 1 && (
          <div className="border-t border-border p-2">
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1 px-1">Sessions</p>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {sessions.slice(0, 5).map(s => (
                <button
                  key={s.id}
                  onClick={() => switchSession(s)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                    currentSession?.id === s.id
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-muted-foreground hover:text-foreground/80 hover:bg-muted/50'
                  }`}
                >
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">
                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : `Session #${s.id}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Center - Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-background">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">{appName}</h2>
            <Badge
              variant="secondary"
              className={`text-[10px] ${
                mode === 'team'
                  ? 'bg-cyan-500/15 text-cyan-400'
                  : 'bg-violet-500/15 text-violet-400'
              }`}
            >
              {mode === 'team' ? (
                <><Users className="w-3 h-3 mr-1" /> Team</>
              ) : (
                <><Bot className="w-3 h-3 mr-1" /> Engineer</>
              )}
            </Badge>
            {/* Auto-save indicator */}
            {saveStatus === 'saving' && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground/80 text-xs"
              onClick={createNewSession}
              title="New session"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              New Chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground/80 text-xs"
              onClick={() => setMode(mode === 'engineer' ? 'team' : 'engineer')}
            >
              <Settings className="w-3.5 h-3.5 mr-1" />
              Switch Mode
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-500 hover:text-emerald-400 text-xs"
              onClick={handleDeploy}
            >
              <Rocket className="w-3.5 h-3.5 mr-1" />
              Deploy
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Start Building</h3>
              <p className="text-muted-foreground text-sm max-w-md mb-6">
                Describe what you want to build and the AI agent{mode === 'team' ? 's will collaborate' : ' will code it'} for you.
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-lg">
                {[
                  'Build a landing page with dark theme',
                  'Create a REST API with authentication',
                  'Make a real-time chat application',
                  'Design a dashboard with charts',
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(prompt)}
                    className="text-left px-3 py-2 rounded-lg bg-card border border-border text-muted-foreground text-xs hover:border-border hover:text-foreground/80 transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 inline mr-1 text-violet-500" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'agent' && (
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      mode === 'team' ? 'bg-cyan-500/15' : 'bg-violet-500/15'
                    }`}>
                      <Bot className={`w-4 h-4 ${agentColors[msg.agent || 'Alex'] || 'text-violet-400'}`} />
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-violet-600/20 text-violet-100 border border-violet-500/20'
                        : 'bg-muted text-foreground border border-border'
                    }`}
                  >
                    {msg.role === 'agent' && msg.agent && mode === 'team' && (
                      <p className={`text-[10px] font-semibold mb-1 ${agentColors[msg.agent] || 'text-violet-400'}`}>
                        {msg.agent}
                      </p>
                    )}
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content || '...'}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {sending && !messages[messages.length - 1]?.content && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="bg-muted border border-border rounded-2xl px-4 py-3">
                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-4 bg-background">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask the ${mode === 'team' ? 'team' : 'engineer'} agent...`}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground/70 focus:border-violet-500 rounded-xl"
              disabled={sending}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white rounded-xl px-4"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel - Preview / File Editor / Agent Status */}
      <div className="w-72 border-l border-border flex flex-col bg-background">
        <Tabs value={rightTab} onValueChange={setRightTab} className="flex-1 flex flex-col">
          <TabsList className="bg-card border-b border-border rounded-none h-10 w-full justify-start px-2">
            <TabsTrigger value="preview" className="text-xs data-[state=active]:bg-muted">
              <Play className="w-3 h-3 mr-1" /> Preview
            </TabsTrigger>
            <TabsTrigger value="editor" className="text-xs data-[state=active]:bg-muted">
              <FileCode className="w-3 h-3 mr-1" /> Editor
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-xs data-[state=active]:bg-muted">
              <MessageSquare className="w-3 h-3 mr-1" /> Agents
            </TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="flex-1 p-4 m-0">
            <div className="w-full aspect-[3/4] rounded-xl bg-card border border-border flex items-center justify-center">
              <div className="text-center">
                <Play className="w-8 h-8 text-muted-foreground/70 mx-auto mb-2" />
                <p className="text-muted-foreground/70 text-xs">Preview will appear here</p>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="editor" className="flex-1 p-4 m-0 overflow-auto">
            {activeFile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono text-violet-300 truncate">{activeFile}</p>
                  <div className="flex gap-1">
                    {editingFile ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-emerald-400 hover:text-emerald-300"
                          onClick={saveFile}
                        >
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground/80"
                          onClick={() => {
                            setEditingFile(false);
                            const file = files.find(f => f.path === activeFile);
                            setActiveFileContent(file?.content || '');
                          }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground/80"
                        onClick={() => setEditingFile(true)}
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {editingFile ? (
                  <textarea
                    value={activeFileContent}
                    onChange={e => setActiveFileContent(e.target.value)}
                    className="w-full h-[calc(100vh-200px)] bg-card border border-border rounded-lg p-3 font-mono text-foreground resize-none focus:outline-none focus:border-violet-500"
                    style={{ fontSize: prefs.font_size, tabSize: prefs.tab_size, whiteSpace: prefs.word_wrap ? 'pre-wrap' : 'pre' }}
                    spellCheck={false}
                  />
                ) : (
                  <pre className="w-full h-[calc(100vh-200px)] bg-card border border-border rounded-lg p-3 font-mono text-muted-foreground overflow-auto" style={{ fontSize: prefs.font_size, tabSize: prefs.tab_size, whiteSpace: prefs.word_wrap ? 'pre-wrap' : 'pre' }}>
                    {activeFileContent || '// Empty file'}
                  </pre>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileCode className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-muted-foreground/70 text-xs">Select a file to edit</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="agents" className="flex-1 p-4 m-0 overflow-auto">
            {mode === 'team' ? (
              <div className="space-y-3">
                {[
                  { name: 'Mike', role: 'Team Leader', color: 'text-amber-400', bg: 'bg-amber-500/15' },
                  { name: 'Emma', role: 'Product Manager', color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
                  { name: 'Bob', role: 'Architect', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
                  { name: 'Alex', role: 'Engineer', color: 'text-violet-400', bg: 'bg-violet-500/15' },
                  { name: 'David', role: 'Data Analyst', color: 'text-rose-400', bg: 'bg-rose-500/15' },
                  { name: 'Sarah', role: 'SEO Specialist', color: 'text-pink-400', bg: 'bg-pink-500/15' },
                ].map(agent => (
                  <div key={agent.name} className="flex items-center gap-3 p-2 rounded-lg bg-card border border-border">
                    <div className={`w-8 h-8 rounded-lg ${agent.bg} flex items-center justify-center`}>
                      <Bot className={`w-4 h-4 ${agent.color}`} />
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${agent.color}`}>{agent.name}</p>
                      <p className="text-[10px] text-muted-foreground">{agent.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/15 flex items-center justify-center mb-3">
                  <Bot className="w-7 h-7 text-violet-400" />
                </div>
                <p className="text-violet-400 font-semibold text-sm">Alex</p>
                <p className="text-muted-foreground text-xs">Engineer Agent</p>
                <p className="text-muted-foreground/70 text-xs mt-2 text-center px-4">
                  Single agent mode for focused coding tasks
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
