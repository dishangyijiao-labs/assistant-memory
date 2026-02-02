import { useState } from 'react';
import { 
  Save, 
  Plus, 
  Trash2, 
  Github, 
  Terminal, 
  Code, 
  Layout, 
  Database, 
  Lock, 
  Cloud
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Settings = () => {
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'zh-CN',
    autoSave: true,
    notifications: true,
    cloudSync: false,
    dataPath: '',
    backupLocation: '',
    backupInterval: 'daily',
    maxStorage: '100MB',
    privacyLevel: 'medium'
  });

  const [apiKeys, setApiKeys] = useState({
    github: '',
    openai: '',
    google: '',
    other: ''
  });

  const [tools, setTools] = useState([
    { name: 'GitHub Copilot', connected: true, lastSync: '2分钟前' },
    { name: 'Cursor', connected: true, lastSync: '5分钟前' },
    { name: 'VS Code', connected: false, lastSync: null },
    { name: 'Cloud Code', connected: false, lastSync: null },
  ]);

  const handleSettingsChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApiKeyChange = (key: string, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = () => {
    console.log('保存设置:', settings);
    // 这里添加保存设置的API调用
    alert('设置已保存');
  };

  const handleSaveApiKeys = () => {
    console.log('保存API密钥:', apiKeys);
    // 这里添加保存API密钥的API调用
    alert('API密钥已保存');
  };

  const handleToolConnect = (index: number) => {
    const updatedTools = [...tools];
    updatedTools[index] = {
      ...updatedTools[index],
      connected: !updatedTools[index].connected,
      lastSync: updatedTools[index].connected ? null : '刚刚'
    };
    setTools(updatedTools);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">设置</h1>
        <p className="text-muted-foreground">管理您的应用程序设置和偏好</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        {/* 通用设置 */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>通用设置</CardTitle>
              <CardDescription>
                管理应用程序的基本配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">主题</Label>
                <Select value={settings.theme} onValueChange={(value) => handleSettingsChange('theme', value)}>
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">浅色</SelectItem>
                    <SelectItem value="dark">深色</SelectItem>
                    <SelectItem value="system">系统</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">语言</Label>
                <Select value={settings.language} onValueChange={(value) => handleSettingsChange('language', value)}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">简体中文</SelectItem>
                    <SelectItem value="zh-TW">繁体中文</SelectItem>
                    <SelectItem value="en-US">English</SelectItem>
                    <SelectItem value="ja-JP">日本語</SelectItem>
                    <SelectItem value="ko-KR">한국어</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="autoSave">自动保存</Label>
                <Switch
                  id="autoSave"
                  checked={settings.autoSave}
                  onCheckedChange={(checked) => handleSettingsChange('autoSave', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="notifications">通知</Label>
                <Switch
                  id="notifications"
                  checked={settings.notifications}
                  onCheckedChange={(checked) => handleSettingsChange('notifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="cloudSync">云同步</Label>
                <Switch
                  id="cloudSync"
                  checked={settings.cloudSync}
                  onCheckedChange={(checked) => handleSettingsChange('cloudSync', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataPath">数据存储路径</Label>
                <Input
                  id="dataPath"
                  value={settings.dataPath}
                  onChange={(e) => handleSettingsChange('dataPath', e.target.value)}
                  placeholder="/path/to/storage"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveSettings}>
            <Save size={18} className="mr-2" />
            保存设置
          </Button>
        </TabsContent>

        {/* API 设置 */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API 密钥</CardTitle>
              <CardDescription>
                管理您的 API 密钥以支持云同步和其他功能
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="github">GitHub API 密钥</Label>
                <Input
                  id="github"
                  type="password"
                  value={apiKeys.github}
                  onChange={(e) => handleApiKeyChange('github', e.target.value)}
                  placeholder="ghp_..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai">OpenAI API 密钥</Label>
                <Input
                  id="openai"
                  type="password"
                  value={apiKeys.openai}
                  onChange={(e) => handleApiKeyChange('openai', e.target.value)}
                  placeholder="sk-..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="google">Google API 密钥</Label>
                <Input
                  id="google"
                  type="password"
                  value={apiKeys.google}
                  onChange={(e) => handleApiKeyChange('google', e.target.value)}
                  placeholder="AIzaSy..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="other">其他 API 密钥</Label>
                <Input
                  id="other"
                  type="password"
                  value={apiKeys.other}
                  onChange={(e) => handleApiKeyChange('other', e.target.value)}
                  placeholder="输入 API 密钥"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveApiKeys}>
            <Save size={18} className="mr-2" />
            保存 API 密钥
          </Button>
        </TabsContent>

        {/* 工具管理 */}
        <TabsContent value="tools" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>工具管理</CardTitle>
              <CardDescription>
                管理您的 IDE 和 AI 工具连接
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tools.map((tool, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        {tool.name === 'GitHub Copilot' && <Github size={20} className="text-purple-500" />}
                        {tool.name === 'Cursor' && <Terminal size={20} className="text-blue-500" />}
                        {tool.name === 'VS Code' && <Code size={20} className="text-green-500" />}
                        {tool.name === 'Cloud Code' && <Layout size={20} className="text-orange-500" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">{tool.name}</h3>
                        {tool.lastSync && (
                          <p className="text-xs text-muted-foreground">
                            最后同步: {tool.lastSync}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={tool.connected ? 'default' : 'outline'}>
                        {tool.connected ? '已连接' : '未连接'}
                      </Badge>
                      <Button
                        variant={tool.connected ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleToolConnect(index)}
                      >
                        {tool.connected ? '断开' : '连接'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button variant="outline">
            <Plus size={18} className="mr-2" />
            添加工具
          </Button>
        </TabsContent>

        {/* 数据管理 */}
        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>数据管理</CardTitle>
              <CardDescription>
                管理您的数据存储和备份
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backupLocation">备份位置</Label>
                <Input
                  id="backupLocation"
                  value={settings.backupLocation}
                  onChange={(e) => handleSettingsChange('backupLocation', e.target.value)}
                  placeholder="/path/to/backup"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="backupInterval">备份频率</Label>
                <Select
                  value={settings.backupInterval}
                  onValueChange={(value) => handleSettingsChange('backupInterval', value)}
                >
                  <SelectTrigger id="backupInterval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">每小时</SelectItem>
                    <SelectItem value="daily">每日</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="monthly">每月</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxStorage">最大存储容量</Label>
                <Select
                  value={settings.maxStorage}
                  onValueChange={(value) => handleSettingsChange('maxStorage', value)}
                >
                  <SelectTrigger id="maxStorage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100MB">100 MB</SelectItem>
                    <SelectItem value="500MB">500 MB</SelectItem>
                    <SelectItem value="1GB">1 GB</SelectItem>
                    <SelectItem value="5GB">5 GB</SelectItem>
                    <SelectItem value="unlimited">无限制</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="privacyLevel">隐私级别</Label>
                <Select
                  value={settings.privacyLevel}
                  onValueChange={(value) => handleSettingsChange('privacyLevel', value)}
                >
                  <SelectTrigger id="privacyLevel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="strict">严格</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button>
              <Database size={18} className="mr-2" />
              备份数据
            </Button>
            <Button variant="outline">
              <Cloud size={18} className="mr-2" />
              同步到云端
            </Button>
            <Button variant="outline">
              <Download size={18} className="mr-2" />
              导出数据
            </Button>
            <Button variant="destructive">
              <Trash2 size={18} className="mr-2" />
              清除数据
            </Button>
          </div>
        </TabsContent>

        {/* 安全设置 */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>安全设置</CardTitle>
              <CardDescription>
                管理您的应用程序安全
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="encryptData">数据加密</Label>
                <Switch id="encryptData" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="autoLock">自动锁定</Label>
                <Switch id="autoLock" defaultChecked />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lockTimeout">锁定超时时间</Label>
                <Select defaultValue="5">
                  <SelectTrigger id="lockTimeout">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 分钟</SelectItem>
                    <SelectItem value="10">10 分钟</SelectItem>
                    <SelectItem value="30">30 分钟</SelectItem>
                    <SelectItem value="60">1 小时</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input id="password" type="password" placeholder="••••••••" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" />
              </div>
            </CardContent>
          </Card>

          <Button>
            <Lock size={18} className="mr-2" />
            更新密码
          </Button>
        </TabsContent>
      </Tabs>

      <TabsList>
        <TabsTrigger value="general">通用</TabsTrigger>
        <TabsTrigger value="api">API 密钥</TabsTrigger>
        <TabsTrigger value="tools">工具管理</TabsTrigger>
        <TabsTrigger value="data">数据管理</TabsTrigger>
        <TabsTrigger value="security">安全</TabsTrigger>
      </TabsList>
    </div>
  );
};

export default Settings;
