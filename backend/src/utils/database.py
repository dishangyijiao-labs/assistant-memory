"""
数据库工具模块
"""

from flask_sqlalchemy import SQLAlchemy

# 初始化 SQLAlchemy
db = SQLAlchemy()

def init_database(app):
    """初始化数据库"""
    db.init_app(app)
    
    # 在应用上下文中创建所有表
    with app.app_context():
        try:
            db.create_all()
            print("数据库初始化成功")
        except Exception as e:
            print(f"数据库初始化失败: {e}")

def get_session():
    """获取数据库会话"""
    from flask import current_app
    if not current_app:
        raise Exception("No application context available")
    return db.session
