#!/bin/bash

# IDE-Memory 后端启动脚本

# 设置变量
VENV_PATH="venv"
PYTHON="python3"
PIP="$PYTHON -m pip"

# 检查虚拟环境是否存在
if [ ! -d "$VENV_PATH" ]; then
    echo "创建虚拟环境..."
    $PYTHON -m venv $VENV_PATH
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source $VENV_PATH/bin/activate

# 检查依赖是否已安装
if [ ! -f "$VENV_PATH/installed" ]; then
    echo "安装依赖..."
    $PIP install -r requirements.txt
    touch $VENV_PATH/installed
fi

# 初始化数据库
echo "初始化数据库..."
$PYTHON -c "from src.utils.database import db; db.create_all(); print('Database initialized')"

# 启动应用
echo "启动 IDE-Memory 后端..."
$PYTHON src/main.py
