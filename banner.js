// banner.js
import chalk from 'chalk';

export function displayBanner() {
    console.log(chalk.cyan(`
        "╔═╗╔═╦╗─╔╦═══╦═══╦═══╦═══╗",
        "╚╗╚╝╔╣║─║║╔══╣╔═╗║╔═╗║╔═╗║",
        "─╚╗╔╝║║─║║╚══╣║─╚╣║─║║║─║║",
        "─╔╝╚╗║║─║║╔══╣║╔═╣╚═╝║║─║║",
        "╔╝╔╗╚╣╚═╝║╚══╣╚╩═║╔═╗║╚═╝║",
        "╚═╝╚═╩═══╩═══╩═══╩╝─╚╩═══╝",
        "我的gihub：github.com/Gzgod",
        "我的推特：推特雪糕战神@Hy78516012 "  
                   ${chalk.yellow('KALEIDO AUTO - BOT')}                
     📢  ${chalk.blue('Telegram Channel: https://t.me/xuegaozs')}
    `));
}
