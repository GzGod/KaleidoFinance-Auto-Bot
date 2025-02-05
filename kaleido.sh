#!/bin/bash

# 克隆仓库
git clone https://github.com/Gzgod/KaleidoFinance-Auto-Bot.git

# 切换到克隆的目录
cd KaleidoFinance-Auto-Bot

# 安装npm依赖
npm install

# 提示用户输入钱包地址并添加到wallets.txt
echo "请输入您的钱包地址 (以0x开头):"
read wallet_address

# 检查钱包地址是否有效（简单检查是否以0x开头）
if [[ $wallet_address =~ ^0x ]]; then
    echo $wallet_address >> wallets.txt
    echo "钱包地址已添加到wallets.txt"
else
    echo "错误: 钱包地址必须以0x开头。脚本已终止。"
    exit 1
fi

# 运行启动脚本
npm run start
