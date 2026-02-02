import axios from 'axios';

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API 错误:', error);
    return Promise.reject(error);
  }
);

// 会话管理 API
export const getSessions = async () => {
  const response = await api.get('/sessions');
  return response.data;
};

export const getSession = async (id: number) => {
  const response = await api.get(`/sessions/${id}`);
  return response.data;
};

export const createSession = async (sessionData: any) => {
  const response = await api.post('/sessions', sessionData);
  return response.data;
};

export const updateSession = async (id: number, sessionData: any) => {
  const response = await api.put(`/sessions/${id}`, sessionData);
  return response.data;
};

export const deleteSession = async (id: number) => {
  const response = await api.delete(`/sessions/${id}`);
  return response.data;
};

// 消息管理 API
export const getSessionMessages = async (sessionId: number) => {
  const response = await api.get(`/sessions/${sessionId}/messages`);
  return response.data;
};

export const getMessage = async (id: number) => {
  const response = await api.get(`/messages/${id}`);
  return response.data;
};

export const createMessage = async (messageData: any) => {
  const response = await api.post(`/sessions/${messageData.session_id}/messages`, messageData);
  return response.data;
};

export const updateMessage = async (id: number, messageData: any) => {
  const response = await api.put(`/messages/${id}`, messageData);
  return response.data;
};

export const deleteMessage = async (id: number) => {
  const response = await api.delete(`/messages/${id}`);
  return response.data;
};

// 标签管理 API
export const getSessionTags = async (sessionId: number) => {
  const response = await api.get(`/sessions/${sessionId}/tags`);
  return response.data;
};

export const createTag = async (sessionId: number, tagData: any) => {
  const response = await api.post(`/sessions/${sessionId}/tags`, tagData);
  return response.data;
};

export const deleteTag = async (id: number) => {
  const response = await api.delete(`/tags/${id}`);
  return response.data;
};

// 导入管理 API
export const importGithubCopilot = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/import/github-copilot', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const importCursor = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/import/cursor', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const importVSCode = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/import/vs-code', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const importCloudCode = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/import/cloud-code', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const importCodeX = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/import/codex', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const importGemini = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/import/gemini', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getImportTasks = async () => {
  const response = await api.get('/import/tasks');
  return response.data;
};

export const getImportTask = async (id: number) => {
  const response = await api.get(`/import/tasks/${id}`);
  return response.data;
};

export default api;
