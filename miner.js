import axios from 'axios';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { displayBanner } from './banner.js';

class KaleidoMiningBot {
    constructor(wallet, botIndex) {
        this.wallet = wallet;
        this.botIndex = botIndex;
        this.currentEarnings = { total: 0, pending: 0, paid: 0 };
        this.miningState = {
            isActive: false,
            worker: "quantum-rig-1",
            pool: "quantum-1",
            startTime: null
        };
        this.referralBonus = 0;
        this.stats = {
            hashrate: 75.5,
            shares: { accepted: 0, rejected: 0 },
            efficiency: 1.4,
            powerUsage: 120
        };
        this.sessionFile = `session_${wallet}.json`;
        
        this.api = axios.create({
            baseURL: 'https://kaleidofinance.xyz/api/testnet',
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://kaleidofinance.xyz/testnet',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
            }
        });
    }

    async loadSession() {
        try {
            const data = await fs.readFile(this.sessionFile, 'utf8');
            const session = JSON.parse(data);
            this.miningState.startTime = session.startTime;
            this.currentEarnings = session.earnings;
            this.referralBonus = session.referralBonus;
            console.log(chalk.green(`[钱包 ${this.botIndex}] 成功加载前一个会话`));
            return true;
        } catch (error) {
            return false;
        }
    }

    async saveSession() {
        const sessionData = {
            startTime: this.miningState.startTime,
            earnings: this.currentEarnings,
            referralBonus: this.referralBonus
        };
        
        try {
            await fs.writeFile(this.sessionFile, JSON.stringify(sessionData, null, 2));
        } catch (error) {
            console.error(chalk.red(`[钱包 ${this.botIndex}] 保存会话失败:`, error.message));
        }
    }

    async initialize() {
        try {
            // 1. 检查注册状态
            const regResponse = await this.retryRequest(
                () => this.api.get(`/check-registration?wallet=${this.wallet}`),
                "注册检查"
            );

            if (!regResponse.data.isRegistered) {
                throw new Error('钱包未注册');
            }

            // 2. 尝试加载前一个会话
            const hasSession = await this.loadSession();
            
            if (!hasSession) {
                // 仅在没有前一个会话时初始化新值
                this.referralBonus = regResponse.data.userData.referralBonus;
                this.currentEarnings = {
                    total: regResponse.data.userData.referralBonus || 0,
                    pending: 0,
                    paid: 0
                };
                this.miningState.startTime = Date.now();
            }

            // 3. 启动挖矿会话
            this.miningState.isActive = true;
            
            console.log(chalk.green(`[钱包 ${this.botIndex}] 挖矿${hasSession ? '恢复' : '初始化'}成功`));
            await this.startMiningLoop();

        } catch (error) {
            console.error(chalk.red(`[钱包 ${this.botIndex}] 初始化失败:`), error.message);
        }
    }

    async retryRequest(requestFn, operationName, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                return await requestFn();
            } catch (error) {
                if (i === retries - 1) throw error;
                console.log(chalk.yellow(`[${operationName}] 重试中 (${i + 1}/${retries})...`));
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }

    calculateEarnings() {
        const timeElapsed = (Date.now() - this.miningState.startTime) / 1000;
        return (this.stats.hashrate * timeElapsed * 0.0001) * (1 + this.referralBonus);
    }

    async updateBalance(finalUpdate = false) {
        try {
            const newEarnings = this.calculateEarnings();
            const payload = {
                wallet: this.wallet,
                earnings: {
                    total: this.currentEarnings.total + newEarnings,
                    pending: finalUpdate ? 0 : newEarnings,
                    paid: finalUpdate ? this.currentEarnings.paid + newEarnings : this.currentEarnings.paid
                }
            };

            const response = await this.retryRequest(
                () => this.api.post('/update-balance', payload),
                "余额更新"
            );

            if (response.data.success) {
                this.currentEarnings = {
                    total: response.data.balance,
                    pending: finalUpdate ? 0 : newEarnings,
                    paid: finalUpdate ? this.currentEarnings.paid + newEarnings : this.currentEarnings.paid
                };
                
                await this.saveSession();
                this.logStatus(finalUpdate);
            }
        } catch (error) {
            console.error(chalk.red(`[钱包 ${this.botIndex}] 更新失败:`), error.message);
        }
    }

    logStatus(final = false) {
        const statusType = final ? "最终状态" : "挖矿状态";
        const uptime = ((Date.now() - this.miningState.startTime) / 1000).toFixed(0);
        
        console.log(chalk.yellow(`
        === [钱包 ${this.botIndex}] ${statusType} ===
        钱包: ${this.wallet}
        上机时间: ${uptime}s | 活跃: ${this.miningState.isActive}
        哈希率: ${this.stats.hashrate} MH/s
        总计: ${chalk.cyan(this.currentEarnings.total.toFixed(8))} KLDO
        待定: ${chalk.yellow(this.currentEarnings.pending.toFixed(8))} KLDO
        已支付: ${chalk.green(this.currentEarnings.paid.toFixed(8))} KLDO
        推荐奖金: ${chalk.magenta(`+${(this.referralBonus * 100).toFixed(1)}%`)}
        `));
    }

    async startMiningLoop() {
        while (this.miningState.isActive) {
            await this.updateBalance();
            await new Promise(resolve => setTimeout(resolve, 30000)); // 每30秒更新一次
        }
    }

    async stop() {
        this.miningState.isActive = false;
        await this.updateBalance(true);
        await this.saveSession();
        return this.currentEarnings.paid;
    }
}

export class MiningCoordinator {
    static instance = null;
    
    constructor() {
        // Singleton pattern to prevent multiple instances
        if (MiningCoordinator.instance) {
            return MiningCoordinator.instance;
        }
        MiningCoordinator.instance = this;
        
        this.bots = [];
        this.totalPaid = 0;
        this.isRunning = false;
    }

    async loadWallets() {
        try {
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const data = await readFile(join(__dirname, 'wallets.txt'), 'utf8');
            return data.split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('0x'));
        } catch (error) {
            console.error('加载钱包时出错:', error.message);
            return [];
        }
    }

    async start() {
        // Prevent multiple starts
        if (this.isRunning) {
            console.log(chalk.yellow('挖矿协调器已经在运行'));
            return;
        }
        
        this.isRunning = true;
        displayBanner();
        const wallets = await this.loadWallets();
        
        if (wallets.length === 0) {
            console.log(chalk.red('在 wallets.txt 中未找到有效的钱包'));
            return;
        }

        console.log(chalk.blue(`加载了 ${wallets.length} 个钱包\n`));

        // Initialize all bots
        this.bots = wallets.map((wallet, index) => {
            const bot = new KaleidoMiningBot(wallet, index + 1);
            bot.initialize();
            return bot;
        });

        // Handle shutdown
        process.on('SIGINT', async () => {
            console.log(chalk.yellow('\n正在关闭矿工...'));
            this.totalPaid = (await Promise.all(this.bots.map(bot => bot.stop())))
                .reduce((sum, paid) => sum + paid, 0);
            
            console.log(chalk.green(`
            === 最终总结 ===
            总钱包数: ${this.bots.length}
            总已支付: ${this.totalPaid.toFixed(8)} KLDO
            `));
            process.exit();
        });
    }
}
