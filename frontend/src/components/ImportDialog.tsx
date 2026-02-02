import { useState } from 'react';
import { 
  X, 
  Upload, 
  FileJson, 
  Github, 
  Terminal, 
  Code, 
  Layout,
  Brain,
  Cloud
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ open, onOpenChange }) => {
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const tools = [
    { id: 'github-copilot', name: 'GitHub Copilot', icon: Github, color: 'text-purple-500' },
    { id: 'cursor', name: 'Cursor', icon: Terminal, color: 'text-blue-500' },
    { id: 'vs-code', name: 'VS Code', icon: Code, color: 'text-green-500' },
    { id: 'cloud-code', name: 'Cloud Code', icon: Layout, color: 'text-orange-500' },
    { id: 'codex', name: 'CodeX', icon: Brain, color: 'text-pink-500' },
    { id: 'gemini', name: 'Gemini', icon: Cloud, color: 'text-yellow-500' }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
    } else if (selectedFile) {
      alert('请选择有效的 JSON 文件');
    }
  };

  const handleImport = async () => {
    if (!selectedTool || !file) {
      alert('请选择工具和文件');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      // 模拟上传过程
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 300);

      // 根据选择的工具调用相应的 API
      let response;
      switch (selectedTool) {
        case 'github-copilot':
          response = await importGithubCopilot(file);
          break;
        case 'cursor':
          response = await importCursor(file);
          break;
        case 'vs-code':
          response = await importVSCode(file);
          break;
        case 'cloud-code':
          response = await importCloudCode(file);
          break;
        case 'codex':
          response = await importCodeX(file);
          break;
        case 'gemini':
          response = await importGemini(file);
          break;
        default:
          throw new Error('不支持的工具');
      }

      setUploadResult(response);

    } catch (error) {
      setUploadResult({
        success: false,
        error: '导入失败，请稍后重试'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedTool('');
    setFile(null);
    setUploadProgress(0);
    setUploadResult(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导入会话历史</DialogTitle>
          <DialogDescription>
            从您的 AI 工具中导入会话历史记录
          </DialogDescription>
        </DialogHeader>
        
        {!uploadResult ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tool">选择工具</Label>
              <Select value={selectedTool} onValueChange={setSelectedTool}>
                <SelectTrigger id="tool">
                  <SelectValue placeholder="选择您要导入的工具" />
                </SelectTrigger>
                <SelectContent>
                  {tools.map(tool => (
                    <SelectItem key={tool.id} value={tool.id}>
                      <div className="flex items-center space-x-2">
                        <tool.icon className={tool.color} size={16} />
                        <span>{tool.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">上传文件</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="file"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {file && (
                  <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                    <X size={16} />
                  </Button>
                )}
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  已选择: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {isUploading && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  正在导入... {uploadProgress}%
                </p>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {uploadResult.success ? (
              <div className="space-y-2">
                <div className="text-green-600 font-medium">
                  导入成功！
                </div>
                <div className="text-sm text-muted-foreground">
                  成功导入 {uploadResult.sessions_count} 个会话
                </div>
                {uploadResult.errors_count > 0 && (
                  <div className="text-sm text-red-600">
                    {uploadResult.errors_count} 个会话导入失败
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-red-600 font-medium">
                  导入失败
                </div>
                <div className="text-sm text-muted-foreground">
                  {uploadResult.error}
                </div>
                {uploadResult.details && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {uploadResult.details}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!uploadResult ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                取消
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!selectedTool || !file || isUploading}
              >
                {isUploading ? (
                  <span className="animate-pulse">导入中...</span>
                ) : (
                  <>
                    <Upload size={18} className="mr-2" />
                    导入
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {uploadResult.success ? (
                <>
                  <Button variant="outline" onClick={resetForm}>
                    继续导入
                  </Button>
                  <Button onClick={() => handleOpenChange(false)}>
                    完成
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={resetForm}>
                    重试
                  </Button>
                  <Button onClick={() => handleOpenChange(false)}>
                    取消
                  </Button>
                </>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDialog;
