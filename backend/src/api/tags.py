"""
标签管理 - 处理会话标签的增删查
"""

from flask import Blueprint, request, jsonify
from src.models import SessionTag
from src.utils.database import db

tags_bp = Blueprint('tags', __name__)

@tags_bp.route('/sessions/<int:session_id>/tags', methods=['GET'])
def get_session_tags(session_id):
    """获取会话的标签列表"""
    try:
        tags = SessionTag.query.filter_by(session_id=session_id).all()
        return jsonify({
            'success': True,
            'data': [tag.to_dict() for tag in tags]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@tags_bp.route('/sessions/<int:session_id>/tags', methods=['POST'])
def create_session_tag(session_id):
    """为会话添加标签"""
    try:
        data = request.get_json()
        
        if 'tag_name' not in data:
            return jsonify({'success': False, 'error': '标签名称不能为空'}), 400
        
        tag_name = data['tag_name'].strip()
        
        # 检查标签是否已存在
        existing_tag = SessionTag.query.filter_by(session_id=session_id, tag_name=tag_name).first()
        if existing_tag:
            return jsonify({'success': False, 'error': '标签已存在'}), 409
        
        tag = SessionTag(
            session_id=session_id,
            tag_name=tag_name
        )
        db.session.add(tag)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': tag.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@tags_bp.route('/tags/<int:tag_id>', methods=['DELETE'])
def delete_session_tag(tag_id):
    """删除会话标签"""
    try:
        tag = SessionTag.query.get(tag_id)
        if not tag:
            return jsonify({'success': False, 'error': '标签不存在'}), 404
        
        db.session.delete(tag)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@tags_bp.route('/tags', methods=['GET'])
def get_all_tags():
    """获取所有标签列表（去重）"""
    try:
        tags = db.session.query(SessionTag.tag_name).distinct().all()
        return jsonify({
            'success': True,
            'data': [tag.tag_name for tag in tags]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
