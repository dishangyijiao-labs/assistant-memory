#!/usr/bin/env python3
"""
IDE-Memory 主应用程序入口
"""

import os
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

# 加载环境变量
load_dotenv()

# 初始化 Flask 应用
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URI', 'sqlite:///ide_memory.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 初始化扩展
db = SQLAlchemy(app)
CORS(app)

# 导入路由和模型
from src.api.sessions import sessions_bp
from src.api.messages import messages_bp
from src.api.tags import tags_bp
from src.api.imports import import_bp

# 注册蓝图
app.register_blueprint(sessions_bp, url_prefix='/api/sessions')
app.register_blueprint(messages_bp, url_prefix='/api')
app.register_blueprint(tags_bp, url_prefix='/api')
app.register_blueprint(import_bp, url_prefix='/api/import')

# 健康检查路由
@app.route('/health')
def health_check():
    return {
        'status': 'healthy',
        'version': '1.0.0',
        'timestamp': __import__('datetime').datetime.utcnow().isoformat()
    }

# 应用信息路由
@app.route('/info')
def app_info():
    return {
        'name': 'IDE-Memory',
        'version': '1.0.0',
        'description': 'IDE Memory - 记录和管理 IDE 中与 AI 聊天工具的会话内容',
        'features': [
            '记录 GitHub Copilot 聊天历史',
            '记录 Cursor 聊天历史',
            '记录 VS Code 中 AI 聊天历史',
            '记录 Cloud Code 聊天历史',
            '记录 CodeX 聊天历史',
            '记录 Gemini 聊天历史'
        ]
    }

if __name__ == '__main__':
    # 确保数据库表已创建
    with app.app_context():
        db.create_all()
    
    # 启动应用
    app.run(
        host=os.environ.get('HOST', '0.0.0.0'),
        port=int(os.environ.get('PORT', 5000)),
        debug=os.environ.get('DEBUG', 'True').lower() == 'true'
    )
