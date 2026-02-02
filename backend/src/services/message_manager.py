"""
消息管理服务
"""

from src.models import Message
from src.utils.database import db

class MessageManager:
    """消息管理类"""
    
    def get_messages(self, session_id):
        """获取会话的所有消息"""
        return Message.query.filter_by(session_id=session_id).order_by(Message.timestamp).all()
        
    def get_message(self, message_id):
        """获取单个消息"""
        return Message.query.get(message_id)
        
    def create_message(self, data):
        """创建消息"""
        message = Message(
            session_id=data.get('session_id'),
            role=data.get('role'),
            content=data.get('content')
        )
        
        db.session.add(message)
        db.session.commit()
        
        return message
        
    def update_message(self, message_id, data):
        """更新消息"""
        message = self.get_message(message_id)
        if not message:
            return None
            
        message.role = data.get('role', message.role)
        message.content = data.get('content', message.content)
        
        db.session.commit()
        
        return message
        
    def delete_message(self, message_id):
        """删除消息"""
        message = self.get_message(message_id)
        if not message:
            return False
            
        db.session.delete(message)
        db.session.commit()
        
        return True
        
    def get_message_count(self, session_id):
        """获取会话的消息数量"""
        return Message.query.filter_by(session_id=session_id).count()
