import { exec } from 'child_process';
import { PartitionInterface, ServerMetricsInterface } from './ServerMetricsInterface';
import puppeteer from 'puppeteer';


import * as dotenv from "dotenv";
dotenv.config();

const loginUrl = 'https://www.quicknode.com/login';
// const targetUrl = 'https://console.chainstack.com/user/settings/billing';
const username = process.env.QUICKNODE_USERNAME!
const password = process.env.QUICKNODE_PASSWORD!


async function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

async function get_server_info(): Promise<ServerMetricsInterface|undefined> {

    ///usr/bin/google-chrome
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-javascript'],
        ignoreHTTPSErrors: true, // 忽略 HTTPS 错误
    });

    const page = await browser.newPage();

    try {

        // 获取浏览器的 User-Agent
        const userAgent = await browser.userAgent();
        console.log('浏览器 User-Agent:', userAgent);

        // await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        // await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
        
        // 设置 Referer
        const referer = process.env.DEBIAN_QUICKNODE_REFERER!;
        await page.setExtraHTTPHeaders({
            'Referer': referer
        });

        // 设置 Cookies
        const cookies = [
            {
                name: 'cf_clearance',
                value: process.env.DEBIAN_QUICKNODE_CF_CLEARANCE!,
                domain: '.quicknode.com',
                path: '/',
                // expires: 'Sat, 12-Jul-25 01:54:28 GMT',
                httpOnly: true,
                secure: true,
                sameSite: 'None'
            }
        ];
        console.log("#####3");

        await page.setCookie(...cookies as any);
        console.log("#####4");

        // 访问登录页面
        await page.goto(loginUrl, { waitUntil: "networkidle2" });
        await new Promise(resolve => setTimeout(resolve, 5000));
        // 输入用户名和密码

        // 等待输入框加载
        await page.waitForSelector('input[name="email"]');

        // 定位输入框并输入文本
        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.type('input[name="email"]', username, { delay: 500 });

        await new Promise(resolve => setTimeout(resolve, 2000));

        await page.type('input[name="password"]', password, { delay: 500 });

        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.click('button.login.login-submit');

        await page.waitForNavigation({ waitUntil: 'networkidle2' })
        console.log("##@@##, wait done");
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log("##@@##, wait done 2");

        await page.screenshot({ path: 'debug_quicknode.png', fullPage: true });
        console.log("screenshot done");

        // 获取元素的文本内容
        const textContent = await page.$eval('.Text_text__2tXmb.text-standard.text-sm', (element:any) => element.textContent);

       // 使用正则表达式匹配带小数点的数字
       //<div class="mt-2 Text_text__2tXmb text-standard text-sm"><span class="text-purple-700 dark:text-purple-200">230.5 M</span> / 500.9 M API credits used</div> 
       const regex = /(\d+\.?\d*)\s*M \/ (\d+\.?\d*)\s*M API credits used/;
       const matches = textContent!.match(regex);

       let includedUnits: any;
       let usedUnits: any;

       if (matches && matches!.length === 3) {
           const usedCredits = matches![1]; // 第一个匹配项是第一个数字 230.5
           const totalCredits = matches![2]; // 第二个匹配项是第二个数字 500.9
           console.log('Used credits:', usedCredits);
           console.log('Total credits:', totalCredits);
           includedUnits = totalCredits;
           usedUnits = usedCredits;
       } else {
           console.error('未找到匹配的数据');
       }

        // 打印获取到的数值
        console.log('已使用请求单位:', usedUnits);
        console.log('总请求单位:', includedUnits);
        includedUnits = parseInt(includedUnits.replace(/,/g, ''), 10)
        usedUnits = parseInt(usedUnits.replace(/,/g, ''), 10)
        const ratio = usedUnits / (includedUnits??1) * 100;
        console.log("includedUnits:", includedUnits, " usedUnits:", usedUnits);
        console.log('ratio:', ratio);

        return {
            client_id: 'Z_quicknode',
            host: "Z_quicknode",
            os: "Z_quicknode",
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
