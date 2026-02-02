import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[600px] flex flex-col items-center justify-center text-center p-6">
      <div className="mb-8">
        <h1 className="text-9xl font-bold text-primary/10">404</h1>
      </div>
      
      <h2 className="text-3xl font-semibold mb-4">页面未找到</h2>
      
      <p className="text-muted-foreground max-w-md mb-8">
        抱歉，您访问的页面不存在或已被移动。
      </p>
      
      <div className="flex flex-wrap justify-center gap-4">
        <Button onClick={() => navigate('/')}>
          <Home size={18} className="mr-2" />
          返回首页
        </Button>
        
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} className="mr-2" />
          上一页
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
