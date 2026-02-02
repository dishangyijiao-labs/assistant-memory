import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MessageSquare, 
  Download, 
  Share2, 
  Copy, 
  Clock, 
  Code2,
  Settings,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getSession, getSessionMessages, deleteSession } from '@/services/api';

const SessionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSessionData(parseInt(id));
    }
  }, [id]);

  const fetchSessionData = async (sessionId: number) => {
    try {
      const sessionData = await getSession(sessionId);
      setSession(sessionData);
      
      const messagesData = await getSessionMessages(sessionId);
      setMessages(messagesData);
    } catch (error) {
      console.error('获取会话数据失败:', error);
    }
  };

  const handleDeleteSession = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (id) {
      try {
        await deleteSession(parseInt(id));
        navigate('/sessions');
      } catch (error) {
        console.error('删除会话失败:', error);
      }
    }
  };

  const formatCodeSnippets = (message: any) => {
    // 简单的代码格式化，实际项目中应该使用更复杂的解析
    if (!message.code_snippets || message.code_snippets.length === 0) {
      return null;
    }
    
    return (
      <div className="mt-4 space-y-3">
        {message.code_snippets.map((snippet, index) => (
          <div key={index} className="rounded-lg overflow-hidden">
            {snippet.filename && (
              <div className="bg-muted px-3 py-2 text-sm font-medium">
                {snippet.filename}
              </div>
            )}
            <pre className="bg-background p-4 overflow-x-auto text-sm">
              <code className={`language-${snippet.language}`}>{snippet.code}</code>
            </pre>
          </div>
        ))}
      </div>
    );
  };

  if (!session) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Clock size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 导航栏 */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/sessions')}>
          <ArrowLeft size={18} className="mr-2" />
          返回会话列表
        </Button>
        <h1 className="text-2xl font-bold">会话详情</h1>
      </div>

      {/* 会话信息卡片 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{session.project_name || '未命名项目'}</CardTitle>
            <CardDescription>
              {new Date(session.created_at).toLocaleDateString()} · {session.tool_name}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{session.session_type}</Badge>
            <Badge variant="outline">{(session.messages || []).length} 条消息</Badge>
            <Badge variant="outline">{session.tool_version}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {session.tags && session.tags.map(tag => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            工作区路径: {session.workspace_path}
          </p>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-2">
        <Button variant="default">
          <Download size={18} className="mr-2" />
          导出会话
        </Button>
        <Button variant="outline">
          <Share2 size={18} className="mr-2" />
          分享会话
        </Button>
        <Button variant="outline">
          <Copy size={18} className="mr-2" />
          复制链接
        </Button>
        <Button variant="outline">
          <Settings size={18} className="mr-2" />
          编辑会话
        </Button>
        <Button variant="destructive" onClick={handleDeleteSession}>
          <Trash2 size={18} className="mr-2" />
          删除会话
        </Button>
      </div>

      {/* 消息列表 */}
      <Card>
        <CardHeader>
          <CardTitle>消息历史</CardTitle>
          <CardDescription>
            会话中的所有消息和回复
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-6">
              {messages.length > 0 ? (
                messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-4xl rounded-lg p-4 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <MessageSquare size={16} />
                        <span className="text-sm font-medium">
                          {message.role === 'user' ? '我' : session.tool_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </div>
                      {formatCodeSnippets(message)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock size={48} className="mx-auto mb-4 opacity-50" />
                  <p>暂无消息</p>
                  <p className="text-sm">开始对话吧！</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 删除对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除会话</DialogTitle>
            <DialogDescription>
              此操作无法撤销。删除后将无法恢复该会话及其所有消息。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDeleteSession}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SessionDetail;
