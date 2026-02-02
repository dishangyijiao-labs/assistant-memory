import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  Code2, 
  MessageSquare, 
  TrendingUp, 
  Calendar, 
  Clock,
  Plus,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Stat, StatArrow, StatGroup, StatHelpText, StatLabel, StatNumber } from '@/components/ui/stat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getSessions } from '@/services/api';

const Home = () => {
  const navigate = useNavigate();
  const [recentSessions, setRecentSessions] = useState([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalMessages: 0,
    activeTools: 0,
    avgMessagesPerSession: 0
  });

  useEffect(() => {
    // 获取会话数据
    const fetchData = async () => {
      try {
        const data = await getSessions();
        setRecentSessions(data.slice(0, 5));
        setStats({
          totalSessions: data.length,
          totalMessages: data.reduce((sum, session) => sum + (session.messages || []).length, 0),
          activeTools: new Set(data.map(session => session.tool_name)).size,
          avgMessagesPerSession: data.length > 0 ? Math.round(data.reduce((sum, session) => sum + (session.messages || []).length, 0) / data.length) : 0
        });
      } catch (error) {
        console.error('获取数据失败:', error);
      }
    };

    fetchData();
  }, []);

  const handleCreateSession = () => {
    navigate('/sessions/new');
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">欢迎使用 IDE-Memory</h1>
          <p className="text-muted-foreground">统一管理您的 AI 聊天历史和会话内容</p>
        </div>
        <Button onClick={handleCreateSession}>
          <Plus size={18} className="mr-2" />
          新建会话
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总会话数</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Stat>
              <StatNumber className="text-2xl">{stats.totalSessions}</StatNumber>
              <StatHelpText>所有 AI 工具的会话总数</StatHelpText>
            </Stat>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总消息数</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Stat>
              <StatNumber className="text-2xl">{stats.totalMessages}</StatNumber>
              <StatHelpText>所有会话中的消息总数</StatHelpText>
            </Stat>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">活跃工具数</CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Stat>
              <StatNumber className="text-2xl">{stats.activeTools}</StatNumber>
              <StatHelpText>正在使用的 AI 工具数量</StatHelpText>
            </Stat>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">平均消息数</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Stat>
              <StatNumber className="text-2xl">{stats.avgMessagesPerSession}</StatNumber>
              <StatHelpText>每个会话的平均消息数</StatHelpText>
            </Stat>
          </CardContent>
        </Card>
      </div>

      {/* 最近会话和数据可视化 */}
      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近会话</CardTitle>
            <CardDescription>您最近使用的 AI 工具会话</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {recentSessions.length > 0 ? (
                <div className="space-y-4">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center space-x-3 p-3 rounded-lg bg-muted cursor-pointer hover:bg-accent"
                      onClick={() => navigate(`/sessions/${session.id}`)}
                    >
                      <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        {session.tool_name === 'GitHub Copilot' && <Code2 size={20} className="text-purple-500" />}
                        {session.tool_name === 'Cursor' && <Terminal size={20} className="text-blue-500" />}
                        {session.tool_name === 'VS Code' && <Code size={20} className="text-green-500" />}
                        {session.tool_name === 'Cloud Code' && <Layout size={20} className="text-orange-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{session.project_name || '未命名项目'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(session.messages || []).length} 条消息
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock size={48} className="mx-auto mb-4 opacity-50" />
                  <p>暂无会话记录</p>
                  <p className="text-sm">开始使用 AI 工具进行会话</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>会话趋势</CardTitle>
            <CardDescription>最近 7 天的会话活动</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <BarChart3 size={48} className="text-muted-foreground opacity-50" />
              <span className="ml-2 text-muted-foreground">图表加载中...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;
