"""
会话管理 API 路由
"""

from flask import Blueprint, request, jsonify
from src.models import Session
from src.services.session_manager import SessionManager
from src.utils.database import db
from datetime import datetime

sessions_bp = Blueprint('sessions', __name__)
session_manager = SessionManager()

@sessions_bp.route('/', methods=['GET'])
def get_sessions():
    """获取所有会话"""
    try:
        # 支持筛选和分页
        tool_name = request.args.get('tool_name')
        project_name = request.args.get('project_name')
        session_type = request.args.get('session_type')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        
        sessions = session_manager.get_sessions(
            tool_name=tool_name,
            project_name=project_name,
            session_type=session_type,
            page=page,
            per_page=per_page
        )
        
        return jsonify({
            'sessions': [session.to_dict() for session in sessions.items],
            'total': sessions.total,
            'pages': sessions.pages,
            'page': sessions.page
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sessions_bp.route('/', methods=['POST'])
def create_session():
    """创建新会话"""
    try:
        data = request.get_json()
        session = session_manager.create_session(data)
        return jsonify(session.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@sessions_bp.route('/<int:id>', methods=['GET'])
def get_session(id):
    """获取单个会话"""
    try:
        session = session_manager.get_session(id)
        if not session:
            return jsonify({'error': '会话不存在'}), 404
        return jsonify(session.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@sessions_bp.route('/<int:id>', methods=['PUT'])
def update_session(id):
    """更新会话"""
    try:
        data = request.get_json()
        session = session_manager.update_session(id, data)
        if not session:
            return jsonify({'error': '会话不存在'}), 404
        return jsonify(session.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@sessions_bp.route('/<int:id>', methods=['DELETE'])
def delete_session(id):
    """删除会话"""
    try:
        success = session_manager.delete_session(id)
        if not success:
            return jsonify({'error': '会话不存在'}), 404
        return jsonify({'message': '会话删除成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sessions_bp.route('/<int:id>/statistics', methods=['GET'])
def get_session_statistics(id):
    """获取会话统计信息"""
    try:
        statistics = session_manager.get_session_statistics(id)
        if not statistics:
            return jsonify({'error': '会话不存在'}), 404
        return jsonify(statistics)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
