import { useState } from 'react';
import { Search, Bell, Settings, Plus, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // 这里可以添加搜索逻辑
  };

  const handleCreateSession = () => {
    navigate('/sessions/new');
  };

  return (
    <header className="bg-background border-b border-border h-16 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold">IDE-Memory</h1>
      </div>
      
      <div className="flex-1 max-w-2xl mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            type="text"
            placeholder="搜索会话、消息或标签..."
            value={searchQuery}
            onChange={handleSearch}
            className="pl-10 pr-4 py-2"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" className="relative">
          <Bell size={16} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </Button>
        
        <Button variant="default" size="sm" onClick={handleCreateSession}>
          <Plus size={16} className="mr-2" />
          新会话
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://github.com/shadcn.png" alt="用户头像" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <span className="hidden md:inline">用户名</span>
              <MoreVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings size={16} className="mr-2" />
              设置
            </DropdownMenuItem>
            <DropdownMenuItem>
              帮助中心
            </DropdownMenuItem>
            <DropdownMenuItem>
              关于
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Navbar;
