import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Trash2,
  Clock,
  Code2,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getSessions } from '@/services/api';

const Sessions = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTool, setFilterTool] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (error) {
      console.error('获取会话失败:', error);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCreateSession = () => {
    navigate('/sessions/new');
  };

  const handleDeleteSession = (sessionId: number) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (sessionToDelete) {
      try {
        // 这里添加删除会话的API调用
        await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟API调用
        setSessions(sessions.filter(session => session.id !== sessionToDelete));
        setDeleteDialogOpen(false);
        setSessionToDelete(null);
      } catch (error) {
        console.error('删除会话失败:', error);
      }
    }
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          session.tool_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTool = filterTool === 'all' || session.tool_name === filterTool;
    return matchesSearch && matchesTool;
  });

  // 获取所有使用的工具名称
  const tools = Array.from(new Set(sessions.map(session => session.tool_name)));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">会话历史</h1>
          <p className="text-muted-foreground">管理和查看您的 AI 工具会话</p>
        </div>
        <Button onClick={handleCreateSession}>
          <Plus size={18} className="mr-2" />
          新建会话
        </Button>
      </div>

      {/* 搜索和过滤栏 */}
      <Card>
        <CardHeader>
          <CardTitle>搜索和筛选</CardTitle>
          <CardDescription>查找您需要的会话</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  type="text"
                  placeholder="搜索会话名称或工具..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterTool} onValueChange={setFilterTool}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="筛选工具" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有工具</SelectItem>
                {tools.map(tool => (
                  <SelectItem key={tool} value={tool}>
                    {tool}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter size={18} className="mr-2" />
              高级筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 会话列表 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>会话列表</CardTitle>
            <Badge variant="outline">{filteredSessions.length} 个会话</Badge>
          </div>
          <CardDescription>
            显示所有匹配的会话
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {filteredSessions.length > 0 ? (
              <div className="space-y-4">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => navigate(`/sessions/${session.id}`)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        {session.tool_name === 'GitHub Copilot' && <Code2 size={24} className="text-purple-500" />}
                        {session.tool_name === 'Cursor' && <Terminal size={24} className="text-blue-500" />}
                        {session.tool_name === 'VS Code' && <Code size={24} className="text-green-500" />}
                        {session.tool_name === 'Cloud Code' && <Layout size={24} className="text-orange-500" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium truncate">{session.project_name || '未命名项目'}</h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{session.tool_name}</Badge>
                      <Badge variant="outline">{(session.messages || []).length} 条消息</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            操作
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/sessions/${session.id}`);
                          }}>
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            // 这里添加导出功能
                          }}>
                            <Download size={16} className="mr-2" />
                            导出
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 size={16} className="mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Clock size={48} className="mx-auto mb-4 opacity-50" />
                <p>未找到匹配的会话</p>
                <p className="text-sm">尝试调整搜索条件</p>
              </div>
            )}
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

export default Sessions;
