import { exec } from 'child_process';
import { PartitionInterface, ServerMetricsInterface } from './ServerMetricsInterface';
import puppeteer from 'puppeteer';

import * as dotenv from "dotenv";
dotenv.config();

const loginUrl = 'https://console.chainstack.com/user/account#login';
const targetUrl = 'https://console.chainstack.com/user/settings/billing';
const username = process.env.CHAINSTACK_USERNAME!
const password = process.env.CHAINSTACK_PASSWORD!

async function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

async function get_server_info(): Promise<ServerMetricsInterface|undefined> {

    // const browser = await puppeteer.launch({ headless: true });
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // 访问登录页面
        await page.goto(loginUrl, { waitUntil: "networkidle2" });
        await new Promise(resolve => setTimeout(resolve, 5000));
        // 输入用户名和密码
        await page.waitForSelector('#email');
        await page.type('#email', username); // 根据实际的表单字段 ID 或选择器进行调整
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.keyboard.press('Tab');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.waitForSelector('#password');
        await page.type('#password', password); // 根据实际的表单字段 ID 或选择器进行调整

        // 提交表单
        await page.click('#submit'); // 根据实际的按钮选择器进行调整
        console.log("submit form done");
        await page.waitForNavigation({ waitUntil: 'networkidle2' })
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 访问目标页面
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        console.log("goto target page done");

        // 等待元素加载
        await page.waitForSelector('#request-units-included', { timeout: 30000 });//#request-units-used
        console.log("wait for element done");

        await page.screenshot({ path: 'debug_chainstack.png', fullPage: true });
        console.log("screenshot done");

        let includedUnits: any = await page.$eval('#request-units-included', (element:any) => element.textContent?.trim());
        let usedUnits: any = await page.$eval('#request-units-used', (element:any) => element.textContent?.trim());

        // 打印获取到的数值
        console.log('已使用请求单位:', usedUnits);
        console.log('总请求单位:', includedUnits);
        includedUnits = parseInt(includedUnits.replace(/,/g, ''), 10)
        usedUnits = parseInt(usedUnits.replace(/,/g, ''), 10)
        const ratio = usedUnits / (includedUnits??1) * 100;
        console.log("includedUnits:", includedUnits, " usedUnits:", usedUnits);
        console.log('ratio:', ratio);

        return {
            client_id: 'Z_chainstack',
            host: "Z_chainstack",
            os: "Z_chainstack",
            cpu_usage: ratio,
            mem_usage: ratio,
            ping_delay: 0,
            partition_info: {
                partition: '/',
                size: `${includedUnits}G`,
                used: `${usedUnits}G`,
                available: `${includedUnits - usedUnits}G`,
                use: `${ratio}%`,
                mounted: '/'
            }
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


