import { NavLink } from 'react-router-dom';
import { 
  Home, 
  History, 
  Settings, 
  Github, 
  Terminal, 
  Code, 
  Layout 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const Sidebar = () => {
  const menuItems = [
    { path: '/', icon: Home, label: '首页' },
    { path: '/sessions', icon: History, label: '会话历史' },
    { path: '/settings', icon: Settings, label: '设置' },
  ];

  const tools = [
    { name: 'GitHub Copilot', icon: Github, color: 'text-purple-500' },
    { name: 'Cursor', icon: Terminal, color: 'text-blue-500' },
    { name: 'VS Code', icon: Code, color: 'text-green-500' },
    { name: 'Cloud Code', icon: Layout, color: 'text-orange-500' },
  ];

  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col h-full">
      <div className="p-6">
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">功能</h2>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">连接的工具</h2>
          <div className="space-y-2">
            {tools.map((tool) => (
              <Button
                key={tool.name}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => console.log(`Connect to ${tool.name}`)}
              >
                <tool.icon className={tool.color} size={18} />
                <span className="ml-2 text-sm">{tool.name}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto p-6">
        <div className="bg-muted rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">IDE-Memory</h3>
          <p className="text-xs text-muted-foreground">
            版本 1.0.0
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
