"""
会话管理服务
"""

from src.models import Session
from src.utils.database import db

class SessionManager:
    """会话管理类"""
    
    def get_sessions(self, tool_name=None, project_name=None, session_type=None, page=1, per_page=10):
        """获取会话列表"""
        query = Session.query
        
        if tool_name:
            query = query.filter(Session.tool_name == tool_name)
            
        if project_name:
            query = query.filter(Session.project_name.contains(project_name))
            
        if session_type:
            query = query.filter(Session.session_type == session_type)
            
        # 分页查询
        offset = (page - 1) * per_page
        sessions = query.order_by(Session.created_at.desc()).offset(offset).limit(per_page).all()
        
        return sessions
        
    def get_session(self, session_id):
        """获取单个会话"""
        return Session.query.get(session_id)
        
    def create_session(self, data):
        """创建会话"""
        session = Session(
            session_id=data.get('session_id'),
            tool_name=data.get('tool_name'),
            tool_version=data.get('tool_version'),
            session_type=data.get('session_type'),
            project_name=data.get('project_name'),
            workspace_path=data.get('workspace_path')
        )
        
        db.session.add(session)
        db.session.commit()
        
        return session
        
    def update_session(self, session_id, data):
        """更新会话"""
        session = self.get_session(session_id)
        if not session:
            return None
            
        session.tool_name = data.get('tool_name', session.tool_name)
        session.tool_version = data.get('tool_version', session.tool_version)
        session.session_type = data.get('session_type', session.session_type)
        session.project_name = data.get('project_name', session.project_name)
        session.workspace_path = data.get('workspace_path', session.workspace_path)
        
        db.session.commit()
        
        return session
        
    def delete_session(self, session_id):
        """删除会话"""
        session = self.get_session(session_id)
        if not session:
            return False
            
        db.session.delete(session)
        db.session.commit()
        
        return True
        
    def get_session_statistics(self, session_id):
        """获取会话统计信息"""
        session = self.get_session(session_id)
        if not session:
            return None
            
        return {
            'id': session.id,
            'tool_name': session.tool_name,
            'messages_count': len(session.messages),
            'created_at': session.created_at.isoformat(),
            'updated_at': session.updated_at.isoformat()
        }
