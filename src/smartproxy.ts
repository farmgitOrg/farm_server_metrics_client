import { exec } from 'child_process';
import { PartitionInterface, ServerMetricsInterface } from './ServerMetricsInterface';
import puppeteer from 'puppeteer';
// import puppeteer from 'puppeteer-extra';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// puppeteer.use(StealthPlugin());

import * as dotenv from "dotenv";
dotenv.config();

const tag = 'Z_smartproxy';
const loginUrl = 'https://dashboard.smartproxy.com/login';
const username = process.env.SMARTPROXY_USERNAME!
const password = process.env.SMARTPROXY_PASSWORD!

async function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

async function get_server_info(): Promise<ServerMetricsInterface|undefined> {

    const browser = await puppeteer.launch({
        headless: true,
        //args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

    // 监听浏览器中的 console 事件
    page.on('console', msg => {
        for (let i = 0; i < msg.args().length; ++i)
            console.log(`${i}: ${msg.args()[i]}`);
    });

    try {
        // 访问登录页面
        await page.goto(loginUrl, { waitUntil: "networkidle2" });
        await new Promise(resolve => setTimeout(resolve, 5000));
        // 输入用户名和密码

        await page.waitForSelector('#email');
        await page.type('#email', username, { delay: 100 });
        await page.type('#password', password, { delay: 100 });

        let selector = '#root > div > div.css-jbfx24.e1t2z1mw0 > div > div > div > div > div > div.css-1djwvw7 > div.css-169ngqy > form > div.css-16g1rm.e1t2z1mw0 > button'
        const button = await page.$(selector);
        button?.click();
    
        // 等待导航到登录后的页面
        await page.waitForNavigation();
        await new Promise(resolve => setTimeout(resolve, 5000));

        selector = '#regular-container > div.css-jbfx24.e1t2z1mw0 > div.css-gkyqc1 > nav > div.css-t4bttc.e1t2z1mw0 > div.css-1shzh9i.e1t2z1mw0 > div.css-19nhamx.eejyiav0 > div'
        const changeteam = await page.$(selector)
        
        changeteam?.click();
        await new Promise(resolve => setTimeout(resolve, 5000));

        selector = '#sp-popover-portal > div > div.css-ttgn3d.e1v01nwg0 > div > div:nth-child(3) > div > p'
        const gmail = await page.$(selector)
        gmail?.click();
        await new Promise(resolve => setTimeout(resolve, 5000));

        selector = '#root > div > div.css-1age63q > aside > div > div > div.css-irm92l.e17kt26d5 > div.css-dps9f6.e1t2z1mw0 > nav:nth-child(1) > ol > div > li > a > div > div.css-k8sa7m.e17kt26d19'
        const subscription = await page.$(selector)
        subscription?.click();

        // selector = '#main-content-container > div > div > div > div > div > div.css-19suhek.e1t2z1mw0 > div > div > div:nth-child(1) > div.css-1jedih6.e1t2z1mw0 > div.css-jbfx24.e1t2z1mw0 > div > p.css-gxj8xo.embmatf0'
        // await page.waitForSelector(selector);
        // console.log("wait selector done");

        // 等待元素加载
        await page.waitForSelector('.css-38vo43.embmatf0'); // 确保选择器正确

        // 提取 2.77 的值
        const usedGB = await page.$eval('.css-gxj8xo.embmatf0', el => {
            // console.log(el.textContent);
            return el.textContent?.trim().split(' ')[0]
        });
        
        console.log("------")
        // 提取 8 的值
        const totalGB = await page.$eval('strong', el => {
            // console.log(el.textContent);
            return el.textContent?.trim().replace('GB', '').trim()
        });
    
        const usedValue = parseFloat(usedGB!);
        const totalValue = parseFloat(totalGB!);
        console.log('GB Used:', usedValue);
        console.log('Total GB:', totalValue);

        const ratio = usedValue / (totalValue??1) * 100;
        console.log('ratio:', ratio);

        await page.goto('https://dashboard.smartproxy.com/billing?tab=wallet')
        await new Promise(resolve => setTimeout(resolve, 3000));
        selector = '.css-37qkp6.embmatf0'
        await page.waitForSelector(selector); // 确保选择器正确
        const balance = await page.$eval(selector, el => {
            // console.log(el.textContent);
            return el.textContent?.trim()
        });
        console.log('Balance:', balance);

        return {
            client_id: tag,
            host: tag,
            os: tag,
            cpu_usage: ratio,
            mem_usage: ratio,
            ping_delay: 0,
            partition_info: {
                partition: '/',
                size: `${totalValue}G`,
                used: `${usedValue}G`,
                available: `${totalValue - usedValue}G`,
                use: `${ratio}%`,
                mounted: '/'
            },
            msg:`balance: ${balance}`
        }
    } catch (error) {
        console.error('出错了:', error);
    } finally {
        // 关闭浏览器
        await browser.close();
    }
}

const http_url = process.env.HTTP_URL || 'http://localhost:3000';
// post the server info to the specified https server
async function post_server_info(server_info: any){
    const url = http_url;
    console.log('post to:', url);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(server_info)
    });
    const data = await response.json();
    console.log(data);
}

async function main(){
    console.log("start")
    while (true) {
        try{
            const server_info = await get_server_info();
            console.log(server_info);

            await post_server_info(server_info);

        } catch (error) {
            console.error(error);
        } finally {
            await sleep(60*60*1000); // 60 minutes
        }
    }
}

main();
