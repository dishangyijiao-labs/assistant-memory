import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login, register, getUserProfile } from '@/services/api';

interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { username: string; password: string }) => Promise<boolean>;
  register: (userData: { username: string; email: string; password: string }) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查用户认证状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          const response = await getUserProfile();
          if (response.success) {
            setUser(response.data);
          } else {
            localStorage.removeItem('authToken');
          }
        }
      } catch (error) {
        console.error('认证检查失败:', error);
        localStorage.removeItem('authToken');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async (credentials: { username: string; password: string }): Promise<boolean> => {
    try {
      const response = await login(credentials);
      if (response.success) {
        setUser(response.data);
        localStorage.setItem('authToken', response.tokens.access_token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('登录失败:', error);
      return false;
    }
  };

  const handleRegister = async (userData: { username: string; email: string; password: string }): Promise<boolean> => {
    try {
      const response = await register(userData);
      if (response.success) {
        setUser(response.data);
        localStorage.setItem('authToken', response.tokens.access_token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('注册失败:', error);
      return false;
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
