"""
消息管理 API 路由
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, current_user
from src.models.message import Message
from src.services.message_manager import MessageManager
from src.utils.database import db
from datetime import datetime

messages_bp = Blueprint('messages', __name__)
message_manager = MessageManager()

@messages_bp.route('/sessions/<int:session_id>/messages', methods=['GET'])
@jwt_required(optional=True)
def get_messages(session_id):
    """获取会话的所有消息"""
    try:
        messages = message_manager.get_messages(session_id)
        return jsonify([message.to_dict() for message in messages])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/sessions/<int:session_id>/messages', methods=['POST'])
@jwt_required(optional=True)
def create_message(session_id):
    """创建消息"""
    try:
        data = request.get_json()
        data['session_id'] = session_id
        message = message_manager.create_message(data)
        return jsonify(message.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@messages_bp.route('/messages/<int:id>', methods=['GET'])
@jwt_required(optional=True)
def get_message(id):
    """获取单个消息"""
    try:
        message = message_manager.get_message(id)
        if not message:
            return jsonify({'error': '消息不存在'}), 404
        return jsonify(message.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@messages_bp.route('/messages/<int:id>', methods=['PUT'])
@jwt_required(optional=True)
def update_message(id):
    """更新消息"""
    try:
        data = request.get_json()
        message = message_manager.update_message(id, data)
        if not message:
            return jsonify({'error': '消息不存在'}), 404
        return jsonify(message.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@messages_bp.route('/messages/<int:id>', methods=['DELETE'])
@jwt_required(optional=True)
def delete_message(id):
    """删除消息"""
    try:
        success = message_manager.delete_message(id)
        if not success:
            return jsonify({'error': '消息不存在'}), 404
        return jsonify({'message': '消息删除成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/sessions/<int:session_id>/messages/count', methods=['GET'])
@jwt_required(optional=True)
def get_message_count(session_id):
    """获取会话的消息数量"""
    try:
        count = message_manager.get_message_count(session_id)
        return jsonify({'count': count})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
