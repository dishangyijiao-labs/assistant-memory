"""
IDE-Memory 数据模型
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from src.utils.database import db

class Session(db.Model):
    """会话模型"""
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), unique=True, nullable=False)
    tool_name = db.Column(db.String(100), nullable=False)
    tool_version = db.Column(db.String(50), nullable=True)
    session_type = db.Column(db.String(50), nullable=True)
    project_name = db.Column(db.String(200), nullable=True)
    workspace_path = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    tags = db.relationship('SessionTag', backref='session', lazy=True)
    messages = db.relationship('Message', backref='session', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f"<Session {self.session_id}>"
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'tool_name': self.tool_name,
            'tool_version': self.tool_version,
            'session_type': self.session_type,
            'project_name': self.project_name,
            'workspace_path': self.workspace_path,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'tags': [tag.tag_name for tag in self.tags],
            'messages_count': len(self.messages)
        }

class Message(db.Model):
    """消息模型"""
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('session.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    code_snippets = db.relationship('CodeSnippet', backref='message', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f"<Message {self.id}>"
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'role': self.role,
            'content': self.content,
            'timestamp': self.timestamp.isoformat(),
            'code_snippets': [snippet.to_dict() for snippet in self.code_snippets]
        }

class CodeSnippet(db.Model):
    """代码片段模型"""
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('message.id'), nullable=False)
    filename = db.Column(db.String(300), nullable=True)
    language = db.Column(db.String(50), nullable=True)
    code = db.Column(db.Text, nullable=False)
    line_range = db.Column(db.String(50), nullable=True)
    
    def __repr__(self):
        return f"<CodeSnippet {self.id}>"
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'message_id': self.message_id,
            'filename': self.filename,
            'language': self.language,
            'code': self.code,
            'line_range': self.line_range
        }

class SessionTag(db.Model):
    """会话标签模型"""
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('session.id'), nullable=False)
    tag_name = db.Column(db.String(50), nullable=False)
    
    __table_args__ = (db.UniqueConstraint('session_id', 'tag_name', name='_session_tag_uc'),)
    
    def __repr__(self):
        return f"<SessionTag {self.tag_name}>"
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'tag_name': self.tag_name
        }

class ImportTask(db.Model):
    """导入任务模型"""
    id = db.Column(db.Integer, primary_key=True)
    tool_name = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, processing, completed, failed
    progress = db.Column(db.Integer, default=0)
    sessions_count = db.Column(db.Integer, default=0)
    errors = db.relationship('ImportError', backref='task', lazy=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    def __repr__(self):
        return f"<ImportTask {self.id}>"
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'tool_name': self.tool_name,
            'status': self.status,
            'progress': self.progress,
            'sessions_count': self.sessions_count,
            'errors_count': len(self.errors),
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

class ImportError(db.Model):
    """导入错误模型"""
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('import_task.id'), nullable=False)
    error_type = db.Column(db.String(100), nullable=False)
    message = db.Column(db.Text, nullable=False)
    details = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<ImportError {self.id}>"
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'task_id': self.task_id,
            'error_type': self.error_type,
            'message': self.message,
            'details': self.details,
            'created_at': self.created_at.isoformat()
        }
