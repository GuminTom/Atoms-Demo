import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
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

/**
 * Parse the agent's markdown response for fenced code blocks that
 * represent generated project files, and return them as
 * `{ path, content }` pairs. We accept several popular conventions so
 * we can be forgiving about how the model formats its output:
 *
 *   1. Path on the fence line:          ```tsx src/App.tsx
 *   2. Path in a comment on line 1:     // File: src/App.tsx
 *                                       # file: app/main.py
 *                                       /* path: src/lib/x.ts *\/
 *                                       <!-- path: index.html -->
 *   3. Path in a markdown header just
 *      above the fence:                 **src/App.tsx**
 *                                       `src/App.tsx`
 *
 * A code block without any path hint is ignored (it's likely a usage
 * snippet, not a file). Paths starting with `/`, containing `..`, or
 * not containing a `/` or a `.` are rejected as sanity checks.
 */
interface ParsedCodeFile {
  path: string;
  content: string;
  language: string;
}

function parseCodeFilesFromMarkdown(md: string): ParsedCodeFile[] {
  const results: ParsedCodeFile[] = [];
  if (!md) return results;

  // Regex for fenced code blocks. Capture the optional info string on
  // the opening fence (e.g. "tsx src/App.tsx") and the body.
  const fenceRe = /```([^\n]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let lastIndex = 0;
  while ((m = fenceRe.exec(md)) !== null) {
    const info = (m[1] || '').trim();
    let body = m[2] || '';
    const before = md.slice(lastIndex, m.index);
    lastIndex = fenceRe.lastIndex;

    // 1) Try to pull the path off the info string.
    //    Format: "<lang> <path>" — the first token is the language,
    //    anything after is treated as the path hint.
    let lang = '';
    let path = '';
    if (info) {
      const parts = info.split(/\s+/);
      lang = parts[0] || '';
      if (parts.length > 1) {
        path = parts.slice(1).join(' ').replace(/^["'`]|["'`]$/g, '').trim();
      }
    }

    // 2) Try first-line comment inside the body.
    if (!path) {
      const firstLine = body.split('\n', 1)[0] || '';
      const commentPathRe =
        /^\s*(?:\/\/|#|<!--|\/\*)\s*(?:file|path|filename)\s*[:=]\s*([^\s*->]+)\s*(?:\*\/|-->)?\s*$/i;
      const fm = firstLine.match(commentPathRe);
      if (fm) {
        path = fm[1].trim();
        // Strip that comment line from the body so the saved file is clean.
        body = body.slice(firstLine.length).replace(/^\n/, '');
      }
    }

    // 3) Try the last non-empty line just above the fence, which may be
    //    a markdown caption like `**src/App.tsx**` or inline code.
    if (!path) {
      const preLines = before.trimEnd().split('\n');
      for (let i = preLines.length - 1; i >= 0 && i >= preLines.length - 3; i--) {
        const line = preLines[i].trim();
        if (!line) continue;
        const cap = line.match(/[`*_]*([\w./\-+]+\.[\w]+)[`*_]*$/);
        if (cap && cap[1].includes('.')) {
          path = cap[1];
        }
        break;
      }
    }

    // Sanity checks on the path.
    if (!path) continue;
    if (path.startsWith('/')) path = path.replace(/^\/+/, '');
    if (!path || path.includes('..') || path.length > 200) continue;
    if (!path.includes('/') && !path.includes('.')) continue;

    // Drop the trailing newline that commonly sits right before the
    // closing fence, but keep any intentional trailing blank lines
    // inside the file beyond that one.
    if (body.endsWith('\n')) body = body.slice(0, -1);

    results.push({ path, content: body, language: lang || getLanguage(path) });
  }

  // Deduplicate by path — keep the LAST occurrence so a later block can
  // intentionally override an earlier one in the same reply.
  const byPath = new Map<string, ParsedCodeFile>();
  for (const f of results) byPath.set(f.path, f);
  return Array.from(byPath.values());
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
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [activeFileContent, setActiveFileContent] = useState<string>('');
  const [editingFile, setEditingFile] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [rightTab, setRightTab] = useState('preview');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef<string>('');
  // Keep an up-to-date ref of messages so that async handlers (unmount,
  // session switch, tab close) can always persist the freshest content
  // instead of operating on a stale closure snapshot.
  const messagesRef = useRef<Message[]>([]);
  // rAF-batched flush scheduler: streaming chunks arrive faster than the
  // browser can paint. We coalesce updates into one paint per frame for
  // smooth progressive rendering without dropping characters.
  const streamRafRef = useRef<number | null>(null);
  // True while the agent is actively streaming a response. Used to skip
  // the debounced auto-save so we don't overwrite the session with a
  // half-complete message, and also to prevent duplicate saves.
  const streamingRef = useRef<boolean>(false);

  // Session persistence state
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const currentSessionRef = useRef<SessionInfo | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync with state for use in async handlers.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

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

  // Auto-save messages when they change (only when auto_save preference is
  // enabled). Skip saving while the agent is actively streaming — the
  // stream loop will explicitly persist a final snapshot when it
  // finishes, which avoids thrashing the DB with partial content.
  useEffect(() => {
    if (
      prefs.auto_save &&
      messages.length > 0 &&
      appId &&
      currentSession &&
      !streamingRef.current
    ) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        persistMessages(messages);
      }, prefs.auto_save_delay);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [messages, appId, currentSession, prefs.auto_save, prefs.auto_save_delay]);

  // Safety net: persist on tab close / refresh / navigation away so the
  // user never loses the last turn, even if the debounce hasn't fired.
  useEffect(() => {
    const flushNow = () => {
      const sess = currentSessionRef.current;
      const msgs = messagesRef.current;
      if (!sess || !appId || msgs.length === 0) return;
      try {
        const serializable = msgs.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          agent: m.agent,
          timestamp: m.timestamp.toISOString(),
        }));
        const token = localStorage.getItem('auth_token');
        const payload = JSON.stringify({
          messages_json: JSON.stringify(serializable),
          status: 'active',
        });
        // sendBeacon survives page unload; falls back to fetch+keepalive
        // for browsers/headers that don't support Beacon with auth.
        if (token) {
          fetch(`/api/v1/entities/agent_sessions/${sess.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: payload,
            keepalive: true,
            credentials: 'include',
          }).catch(() => {});
        }
      } catch {
        // Ignore — best effort only.
      }
    };
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('pagehide', flushNow);
    return () => {
      window.removeEventListener('beforeunload', flushNow);
      window.removeEventListener('pagehide', flushNow);
      // Also persist on component unmount (e.g. route change).
      flushNow();
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
    };
    // We intentionally do not include messages/currentSession: the refs
    // give us the latest values and we don't want to re-register the
    // listeners on every keystroke.
  }, [appId]);

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

  // Track auto-save of generated code files so users get feedback in the
  // top bar and we can gracefully recover on errors.
  const [codegenStatus, setCodegenStatus] = useState<{
    state: 'idle' | 'saving' | 'saved' | 'error';
    created: number;
    updated: number;
    message?: string;
  }>({ state: 'idle', created: 0, updated: 0 });

  /**
   * Persist parsed code files into the app_files table. For each file:
   *   - If a file with the same path already exists, PUT its content.
   *   - Otherwise, POST a new entity row.
   * Then refresh the left-hand file tree so the user sees the result.
   */
  const saveGeneratedFiles = useCallback(
    async (generated: ParsedCodeFile[]) => {
      if (!appId || generated.length === 0) return;
      setCodegenStatus({ state: 'saving', created: 0, updated: 0 });

      // Snapshot the current path->id map once so we don't hammer the
      // backend with lookups; use the freshest version via a GET.
      let existing: FileItem[] = [];
      try {
        const res = await api.get(
          buildEntityQueryUrl(
            '/api/v1/entities/app_files',
            { app_id: Number(appId) },
            { limit: 500, sort: 'path' }
          )
        );
        existing = res?.items || [];
      } catch {
        existing = files;
      }
      const byPath = new Map(existing.map(f => [f.path, f] as const));

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const gen of generated) {
        try {
          const prev = byPath.get(gen.path);
          if (prev) {
            await api.put(`/api/v1/entities/app_files/${prev.id}`, {
              content: gen.content,
              language: gen.language,
            });
            updated += 1;
          } else {
            await api.post('/api/v1/entities/app_files', {
              app_id: Number(appId),
              path: gen.path,
              content: gen.content,
              language: gen.language,
            });
            created += 1;
          }
        } catch (err: any) {
          errors.push(`${gen.path}: ${err?.message || 'save failed'}`);
        }
      }

      await loadFiles();

      if (errors.length > 0) {
        setCodegenStatus({
          state: 'error',
          created,
          updated,
          message: errors[0],
        });
      } else {
        setCodegenStatus({ state: 'saved', created, updated });
        setTimeout(
          () => setCodegenStatus({ state: 'idle', created: 0, updated: 0 }),
          4000
        );
      }
    },
    [appId, files, loadFiles]
  );

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

  const persistMessages = async (
    msgs: Message[],
    sessionOverride?: SessionInfo | null
  ) => {
    const sess = sessionOverride ?? currentSessionRef.current ?? currentSession;
    if (!sess || !appId) return;
    setSaveStatus('saving');
    try {
      const serializable = msgs.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agent: m.agent,
        timestamp: m.timestamp.toISOString(),
      }));
      await api.put(`/api/v1/entities/agent_sessions/${sess.id}`, {
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
    // Save current session first using the ref so we capture the freshest
    // messages, even if the latest streaming chunk just landed.
    const prevSession = currentSessionRef.current;
    const prevMessages = messagesRef.current;
    if (prevSession && prevMessages.length > 0 && prevSession.id !== session.id) {
      await persistMessages(prevMessages, prevSession);
    }
    setCurrentSession(session);
    restoreMessages(session);
  };

  const deleteSession = async (session: SessionInfo) => {
    if (!appId) return;
    if (!confirm(`Delete this session permanently? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/v1/entities/agent_sessions/${session.id}`);
      // Remove from local list.
      const remaining = sessions.filter(s => s.id !== session.id);
      setSessions(remaining);
      // If the deleted session is the current one, switch to the most
      // recent remaining session, or start a fresh one if none remain.
      if (currentSessionRef.current?.id === session.id) {
        if (remaining.length > 0) {
          setCurrentSession(remaining[0]);
          restoreMessages(remaining[0]);
        } else {
          // Clear state and create a new empty session.
          setCurrentSession(null);
          setMessages([]);
          await createNewSession();
        }
      }
    } catch {
      // Handle error silently; user will see the session still present.
    }
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

  const [createError, setCreateError] = useState<string>('');
  const [creatingApp, setCreatingApp] = useState(false);

  const createApp = async () => {
    if (!newAppName.trim() || creatingApp) return;
    setCreateError('');
    setCreatingApp(true);
    try {
      const res = await api.post('/api/v1/entities/apps', {
        name: newAppName,
        status: 'draft',
        agent_mode: mode,
        description: `An app created with ${mode} mode`,
      });
      if (res?.id) {
        setShowNewApp(false);
        setAppName(newAppName);
        navigate(`/workspace/${res.id}`, { replace: true });
      } else {
        setCreateError('Server returned an empty response. Please try again.');
      }
    } catch (err: any) {
      const status = err?.status;
      if (status === 401) {
        setCreateError('Your session has expired. Please sign in again.');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setCreateError(err?.message || 'Failed to create app. Please try again.');
      }
    } finally {
      setCreatingApp(false);
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
    streamingRef.current = true;

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
      // Instruct the model to emit every code file as a fenced block
      // whose info string is "<language> <path>". This is the cheapest
      // reliable convention we can parse client-side without a tool-call
      // protocol, and it keeps the visual appearance in the chat clean.
      const codeGenRules = [
        '',
        'IMPORTANT — Code output protocol:',
        '- When you produce a file for the project, wrap it in a fenced code block whose first line is `\\`\\`\\`<language> <relative/path>`, e.g. `\\`\\`\\`tsx src/App.tsx` or `\\`\\`\\`python app/main.py`.',
        '- Use frontend/ and backend/ (or src/, app/) prefixes to make the target layer explicit when the project is full-stack.',
        '- Always include the COMPLETE file content inside the block — never use ellipses or "// ... unchanged" placeholders. The content in the block will be saved verbatim as the final file.',
        '- One file per code block. If you need to update multiple files, emit multiple blocks in sequence.',
        '- Short inline snippets for illustration only (no path) are still allowed — they will not be saved.',
      ].join('\n');

      const systemPrompt =
        (mode === 'team'
          ? `You are ${agentName}, part of a multi-agent coding team. You collaborate with other agents (Mike the leader, Emma the PM, Bob the architect, Alex the engineer, David the data analyst, Sarah the SEO specialist). Help the user build their application. Be concise and actionable.`
          : `You are Alex, an expert engineer agent. Help the user build their application with clean, production-ready code. Be concise and actionable.`) +
        codeGenRules;

      const chatHistory = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }));

      // Use native fetch with SSE streaming instead of web-sdk client.ai.gentxt.
      // The SDK's internal AbortController can abort without a clear reason
      // when its session context is not in sync with our local-auth users
      // (especially newly registered accounts), which previously caused
      // "signal is aborted without reason" errors here.
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Helper: call the gentxt endpoint. We isolate this into a helper so
      // we can transparently retry on transient upstream failures such as
      // Cloudflare 524 (origin timeout) that sometimes occur on the first
      // request after a cold start on the deployed environment.
      const callGentxt = async (): Promise<Response> =>
        fetch('/api/v1/aihub/gentxt', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              ...chatHistory,
              { role: 'user', content: userContent },
            ],
            model: 'deepseek-v3.2',
            stream: true,
          }),
        });

      let response = await callGentxt();

      // Friendly error extraction. Cloudflare returns an HTML page (with
      // status 524 / 502 / 503) when the origin times out or is
      // unavailable; surfacing raw HTML to the user is confusing, so we
      // detect it and present a concise human-readable message instead,
      // and transparently retry once for a likely-recoverable timeout.
      const isTransientUpstream = (status: number) =>
        status === 502 || status === 503 || status === 504 || status === 524;

      if (!response.ok && isTransientUpstream(response.status)) {
        // Drain the error body before retrying so the connection is released.
        await response.text().catch(() => '');
        response = await callGentxt();
      }

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => '');
        let errDetail = `Request failed with status ${response.status}`;

        // Cloudflare / nginx error pages come back as HTML — don't dump
        // them into the chat. Translate the status into a friendly hint.
        const looksLikeHtml = /^\s*<(!doctype|html)/i.test(errText);
        if (looksLikeHtml || !errText) {
          if (response.status === 524) {
            errDetail =
              'The AI service took too long to respond (upstream timeout). Please try again in a moment.';
          } else if (response.status === 502 || response.status === 503 || response.status === 504) {
            errDetail =
              'The AI service is temporarily unavailable. Please try again in a moment.';
          } else if (response.status === 401) {
            errDetail = 'Your session has expired. Please sign in again.';
          } else {
            errDetail = `AI service error (status ${response.status}). Please try again.`;
          }
        } else {
          try {
            const parsed = JSON.parse(errText);
            errDetail = parsed?.detail || parsed?.message || errDetail;
          } catch {
            // Non-HTML, non-JSON text — show the first 200 chars only.
            errDetail = errText.slice(0, 200);
          }
        }
        throw new Error(errDetail);
      }

      // Parse SSE stream.
      // Per the SSE spec, events are separated by a blank line, which can
      // be encoded as either "\n\n" (LF) or "\r\n\r\n" (CRLF). The backend
      // here uses CRLF, so we normalize CRLF to LF first and then split on
      // "\n\n". Without this normalization the parser would never find an
      // event boundary and nothing would render on screen.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Coalesce many small SSE chunks into a single React render per
      // animation frame. This makes streaming feel smooth (characters
      // appear progressively instead of arriving in large UI-batched
      // bursts) without dropping any content.
      const flushToUI = () => {
        streamRafRef.current = null;
        const snapshot = streamingContentRef.current;
        setMessages(prev =>
          prev.map(m =>
            m.id === agentMsgId ? { ...m, content: snapshot } : m
          )
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Normalize CRLF -> LF for consistent boundary splitting.
        buffer = buffer.replace(/\r\n/g, '\n');

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        let gotContent = false;
        for (const part of parts) {
          const lines = part.split('\n');
          // An SSE "data:" payload can span multiple lines; join them.
          const dataLines: string[] = [];
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            dataLines.push(line.slice(5).replace(/^ /, ''));
          }
          if (dataLines.length === 0) continue;
          const data = dataLines.join('\n').trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed?.content) {
              streamingContentRef.current += parsed.content;
              gotContent = true;
            }
          } catch {
            // Ignore malformed chunks (e.g. heartbeats).
          }
        }

        if (gotContent && streamRafRef.current == null) {
          streamRafRef.current = requestAnimationFrame(flushToUI);
        }
      }

      // Final flush to ensure the last chunk is rendered.
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      flushToUI();

      streamingRef.current = false;
      setSending(false);

      // Persist the completed exchange immediately so it can never be
      // lost to a tab-close or navigation before the debounce fires.
      const finalMsgs = messagesRef.current.map(m =>
        m.id === agentMsgId
          ? { ...m, content: streamingContentRef.current }
          : m
      );
      messagesRef.current = finalMsgs;
      persistMessages(finalMsgs);

      // Parse the agent's reply for generated code files and upsert
      // them into the app_files table. This is what actually turns the
      // chat into "vibe coding" rather than just a text conversation.
      try {
        const generated = parseCodeFilesFromMarkdown(streamingContentRef.current);
        if (generated.length > 0) {
          await saveGeneratedFiles(generated);
        }
      } catch (genErr) {
        // Non-fatal — the chat message is already saved, the user can
        // simply ask the agent to regenerate or copy files manually.
        console.error('Failed to save generated files:', genErr);
      }
    } catch (err: any) {
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      setMessages(prev =>
        prev.map(m =>
          m.id === agentMsgId
            ? { ...m, content: m.content || `Error: ${err?.message || 'Failed to get AI response'}` }
            : m
        )
      );
      streamingRef.current = false;
      setSending(false);
      // Still try to persist whatever partial content exists so the user
      // sees an error trail instead of a blank turn after reload.
      persistMessages(messagesRef.current);
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
            {createError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {createError}
              </div>
            )}
            <Button
              onClick={createApp}
              className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-medium rounded-xl"
              disabled={!newAppName.trim() || creatingApp}
            >
              {creatingApp ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create & Start Coding
                </>
              )}
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
        {sessions.length > 0 && (
          <div className="border-t border-border p-2">
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1 px-1">Sessions</p>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {sessions.slice(0, 8).map(s => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-1 rounded text-xs transition-colors ${
                    currentSession?.id === s.id
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-muted-foreground hover:text-foreground/80 hover:bg-muted/50'
                  }`}
                >
                  <button
                    onClick={() => switchSession(s)}
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left min-w-0"
                    title={s.created_at ? new Date(s.created_at).toLocaleString() : `Session #${s.id}`}
                  >
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : `Session #${s.id}`}
                    </span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground/70 hover:text-rose-400 transition-all flex-shrink-0"
                    title="Delete session permanently"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted -ml-2"
              onClick={() => navigate('/')}
              title="Back to home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
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
            {/* Codegen indicator — shows when files parsed from the AI
                response are being written to the app_files store. */}
            {codegenStatus.state === 'saving' && (
              <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Writing files…
              </span>
            )}
            {codegenStatus.state === 'saved' && (codegenStatus.created + codegenStatus.updated) > 0 && (
              <span className="text-[10px] text-cyan-400 flex items-center gap-1" title="Files auto-generated from the chat">
                <FileCode className="w-3 h-3" />
                {codegenStatus.created > 0 && `+${codegenStatus.created} new`}
                {codegenStatus.created > 0 && codegenStatus.updated > 0 && ' · '}
                {codegenStatus.updated > 0 && `${codegenStatus.updated} updated`}
              </span>
            )}
            {codegenStatus.state === 'error' && (
              <span className="text-[10px] text-rose-400 flex items-center gap-1" title={codegenStatus.message}>
                <X className="w-3 h-3" /> File save error
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
