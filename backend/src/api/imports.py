"""
导入模块 - 处理不同 IDE 和 AI 工具的会话导入
"""

from flask import Blueprint, request, jsonify
from src.models import ImportTask, ImportError, Session, Message, CodeSnippet
from src.utils.database import db
import os
import json
import datetime
import traceback

import_bp = Blueprint('import', __name__)

@import_bp.route('/github-copilot', methods=['POST'])
def import_github_copilot():
    """导入 GitHub Copilot 会话"""
    try:
        # 检查是否有上传的文件
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': '未找到上传的文件'}), 400
        
        file = request.files['file']
        
        # 检查文件类型
        if not file.filename.endswith('.json'):
            return jsonify({'success': False, 'error': '只支持 JSON 文件'}), 400
        
        # 读取文件内容
        file_content = file.read()
        data = json.loads(file_content)
        
        # 创建导入任务
        task = ImportTask(
            tool_name='GitHub Copilot',
            status='processing',
            sessions_count=0
        )
        db.session.add(task)
        db.session.commit()
        
        # 处理数据
        processed_sessions = 0
        errors = []
        
        # 这里需要根据实际的 GitHub Copilot 数据格式进行处理
        if 'sessions' in data:
            for session_data in data['sessions']:
                try:
                    # 创建会话
                    session = Session(
                        session_id=session_data.get('id', f'github-copilot-{processed_sessions}'),
                        tool_name='GitHub Copilot',
                        tool_version=session_data.get('version', 'unknown'),
                        session_type=session_data.get('type', 'chat'),
                        project_name=session_data.get('project_name', '未知项目'),
                        workspace_path=session_data.get('workspace_path', '')
                    )
                    db.session.add(session)
                    db.session.flush()
                    
                    # 创建消息
                    if 'messages' in session_data:
                        for msg_data in session_data['messages']:
                            message = Message(
                                session_id=session.id,
                                role=msg_data.get('role', 'user'),
                                content=msg_data.get('content', ''),
                                timestamp=datetime.datetime.fromisoformat(msg_data.get('timestamp'))
                            )
                            db.session.add(message)
                            db.session.flush()
                            
                            # 创建代码片段
                            if 'code_snippets' in msg_data:
                                for snippet_data in msg_data['code_snippets']:
                                    snippet = CodeSnippet(
                                        message_id=message.id,
                                        filename=snippet_data.get('filename'),
                                        language=snippet_data.get('language'),
                                        code=snippet_data.get('code'),
                                        line_range=snippet_data.get('line_range')
                                    )
                                    db.session.add(snippet)
                    
                    processed_sessions += 1
                except Exception as e:
                    errors.append({
                        'error_type': type(e).__name__,
                        'message': str(e),
                        'details': traceback.format_exc()
                    })
        
        # 更新任务状态
        task.status = 'completed'
        task.progress = 100
        task.sessions_count = processed_sessions
        task.completed_at = datetime.datetime.utcnow()
        
        # 记录错误
        for error in errors:
            import_error = ImportError(
                task_id=task.id,
                error_type=error['error_type'],
                message=error['message'],
                details=error['details']
            )
            db.session.add(import_error)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'task_id': task.id,
            'sessions_count': processed_sessions,
            'errors_count': len(errors)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e),
            'details': traceback.format_exc()
        }), 500

@import_bp.route('/cursor', methods=['POST'])
def import_cursor():
    """导入 Cursor 会话"""
    try:
        # 检查是否有上传的文件
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': '未找到上传的文件'}), 400
        
        file = request.files['file']
        
        # 检查文件类型
        if not file.filename.endswith('.json'):
            return jsonify({'success': False, 'error': '只支持 JSON 文件'}), 400
        
        # 读取文件内容
        file_content = file.read()
        data = json.loads(file_content)
        
        # 创建导入任务
        task = ImportTask(
            tool_name='Cursor',
            status='processing',
            sessions_count=0
        )
        db.session.add(task)
        db.session.commit()
        
        # 处理数据
        processed_sessions = 0
        errors = []
        
        # 这里需要根据实际的 Cursor 数据格式进行处理
        if 'conversations' in data:
            for conversation_data in data['conversations']:
                try:
                    # 创建会话
                    session = Session(
                        session_id=conversation_data.get('id', f'cursor-{processed_sessions}'),
                        tool_name='Cursor',
                        tool_version=conversation_data.get('version', 'unknown'),
                        session_type=conversation_data.get('type', 'chat'),
                        project_name=conversation_data.get('project_name', '未知项目'),
                        workspace_path=conversation_data.get('workspace_path', '')
                    )
                    db.session.add(session)
                    db.session.flush()
                    
                    # 创建消息
                    if 'messages' in conversation_data:
                        for msg_data in conversation_data['messages']:
                            message = Message(
                                session_id=session.id,
                                role=msg_data.get('role', 'user'),
                                content=msg_data.get('content', ''),
                                timestamp=datetime.datetime.fromisoformat(msg_data.get('timestamp'))
                            )
                            db.session.add(message)
                            db.session.flush()
                            
                            # 创建代码片段
                            if 'code_snippets' in msg_data:
                                for snippet_data in msg_data['code_snippets']:
                                    snippet = CodeSnippet(
                                        message_id=message.id,
                                        filename=snippet_data.get('filename'),
                                        language=snippet_data.get('language'),
                                        code=snippet_data.get('code'),
                                        line_range=snippet_data.get('line_range')
                                    )
                                    db.session.add(snippet)
                    
                    processed_sessions += 1
                except Exception as e:
                    errors.append({
                        'error_type': type(e).__name__,
                        'message': str(e),
                        'details': traceback.format_exc()
                    })
        
        # 更新任务状态
        task.status = 'completed'
        task.progress = 100
        task.sessions_count = processed_sessions
        task.completed_at = datetime.datetime.utcnow()
        
        # 记录错误
        for error in errors:
            import_error = ImportError(
                task_id=task.id,
                error_type=error['error_type'],
                message=error['message'],
                details=error['details']
            )
            db.session.add(import_error)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'task_id': task.id,
            'sessions_count': processed_sessions,
            'errors_count': len(errors)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e),
            'details': traceback.format_exc()
        }), 500

@import_bp.route('/vs-code', methods=['POST'])
def import_vs_code():
    """导入 VS Code AI 会话"""
    # 实现 VS Code AI 聊天历史导入
    pass

@import_bp.route('/cloud-code', methods=['POST'])
def import_cloud_code():
    """导入 Cloud Code 会话"""
    # 实现 Cloud Code 聊天历史导入
    pass

@import_bp.route('/codex', methods=['POST'])
def import_codex():
    """导入 CodeX 会话"""
    # 实现 CodeX 聊天历史导入
    pass

@import_bp.route('/gemini', methods=['POST'])
def import_gemini():
    """导入 Gemini 会话"""
    # 实现 Gemini 聊天历史导入
    pass

@import_bp.route('/tasks', methods=['GET'])
def get_import_tasks():
    """获取导入任务列表"""
    try:
        tasks = ImportTask.query.all()
        return jsonify({
            'success': True,
            'data': [task.to_dict() for task in tasks]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@import_bp.route('/tasks/<int:task_id>', methods=['GET'])
def get_import_task(task_id):
    """获取导入任务详情"""
    try:
        task = ImportTask.query.get(task_id)
        if not task:
            return jsonify({'success': False, 'error': '任务不存在'}), 404
        
        return jsonify({
            'success': True,
            'data': task.to_dict(),
            'errors': [error.to_dict() for error in task.errors]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
