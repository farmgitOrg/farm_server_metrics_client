import { exec } from 'child_process';
import { PartitionInterface, ServerMetricsInterface } from './ServerMetricsInterface';
import * as dotenv from "dotenv";
dotenv.config();

async function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}
function convertToG(size: string): number {
    const units = size.slice(-1);
    const value = parseFloat(size.slice(0, -1));

    switch (units.toUpperCase()) {
        case 'K':
            return value / (1024 * 1024);
        case 'M':
            return value / 1024;
        case 'G':
            return value;
        case 'T':
            return value * 1024;
        default:
            return value;
    }
}

// 在linux系统上，获取存储空间最大的分区的信息
async function get_partition_with_max_capacity():Promise<PartitionInterface>{
    return new Promise((resolve, reject) => {
        exec('df -h', (err: any, stdout: any, stderr: any) => {
            if (err) {
                console.error(err);
                return;
            }
            const lines = stdout.split('\n');
            const partitions = lines.slice(1, -1).map((line: any) => {
                const [partition, size, used, available, use, mounted] = line.split(/\s+/);
                return {
                    partition,
                    size: convertToG(size),
                    used: convertToG(used),
                    available: convertToG(available),
                    use,
                    mounted
                };
            });
            // console.log(partitions);
            const maxPartition = partitions.reduce((max: any, current: any) => {
                if (parseInt(current.size) > parseInt(max.size)) {
                    return current;
                }
                return max;
            }, { size: '0' });

            resolve(maxPartition);
        });
    });
}
// 在linux系统上，获取cpu的使用率
async function get_cpu_usage():Promise<number>{
    return new Promise((resolve, reject) => {
        exec('top -b -n 1 | grep Cpu', (err: any, stdout: any, stderr: any) => {
            if (err) {
                console.error(err);
                return;
            }
            // console.log("stdout", stdout.split(/\s+/));
            //top 命令的输出是这样的: %Cpu(s):  0.0 us,  0.0 sy,  0.0 ni,100.0 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st 
            //剥离出各个数值
            const str = stdout.split(':')[1].trim(); // Remove the "%Cpu(s):" part

            let [us, sy, ni, id, wa, hi, si, st] = str.split(',').map((s:string) => s.trim().split(' ')[0]);
            const usage = 100 - parseFloat(id);
            // console.log(usage);
            resolve(usage);
        });
    });
}

//在linux系统上，获取内存的使用率
async function get_memory_usage():Promise<number>{
    return new Promise((resolve, reject) => {
        exec('free -m', (err: any, stdout: any, stderr: any) => {
            if (err) {
                console.error(err);
                return;
            }
            const lines = stdout.split('\n');
            const [_, total, used, free, shared, buff_cache, available] = lines[1].split(/\s+/);

            const usage = parseFloat(used) / parseFloat(total) * 100;
            resolve(usage);
        });
    });
}


//在linux系统上，往google发送一个ping包，返回网络平均延时
async function get_network_delay():Promise<number>{
    return new Promise((resolve, reject) => {
        exec('ping -c 4 www.google.com', (err: any, stdout: any, stderr: any) => {
            if (err) {
                console.error(err);
                return;
            }
            const lines = stdout.split('\n');
            // console.log(lines);
            const str = lines[lines.length - 2];
            let rtt_avg = str.split('=')[1].trim().split('/')[1];
            // console.log(rtt_avg);
            resolve(parseFloat(rtt_avg));
        });
    });
}

async function get_host_name():Promise<string>{
    return new Promise((resolve, reject) => {
        exec('hostname', (err: any, stdout: any, stderr: any) => {
            if (err) {
                console.error(err);
                return;
            }
            resolve(stdout.trim());
        });
    });
}
async function get_host_ip():Promise<string>{
    return new Promise((resolve, reject) => {
        exec('hostname -I', (err: any, stdout: any, stderr: any) => {
            if (err) {
                console.error(err);
                return;
            }
            resolve(stdout.trim());
        });
    });
}
async function get_host_os():Promise<string>{
    return new Promise((resolve, reject) => {
        exec('cat /etc/os-release', (err: any, stdout: any, stderr: any) => {
            if (err) {
                console.error(err);
                return;
            }
            const lines = stdout.split('\n');
            const os = lines.find((line: any) => line.startsWith('PRETTY_NAME='));
            resolve(os.split('=')[1].replace(/"/g, ''));
        });
    });
}

async function get_server_info():Promise<ServerMetricsInterface>{
    const ping_delay = await get_network_delay();
    const partition = await get_partition_with_max_capacity();

    //计算下面for循环 cpu_usage, memory_usage的平均值
    let cpus = 0.0
    let memorys = 0.0
    const runcnt = 10
    for (let i = 0; i < runcnt; i++) {
        const cpu_usage = await get_cpu_usage();
        const memory_usage = await get_memory_usage();
        cpus += cpu_usage;
        memorys += memory_usage;
        await sleep(1000)
    }
    const cpu_usage = cpus / runcnt
    const memory_usage = memorys / runcnt

    const host_os = await get_host_os();
    const host_name = await get_host_name();
    // const host_ip = await get_host_ip();
    const host = `${host_name}`;

    // console.log(partition);
    // console.log(memory_usage);
    // console.log(cpu_usage);
    // console.log(ping_delay);

    return {
        client_id: process.env.CLIENT_ID || '',
        host: host,
        os: host_os,
        cpu_usage: cpu_usage,
        mem_usage: memory_usage,
        ping_delay: ping_delay,
        partition_info: partition
    }
}

const port = process.env.HTTP_PORT || 3000;
// post the server info to the specified https server
async function post_server_info(server_info: any){
    const url = `http://localhost:${port}`;
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
    while (true) {
        const server_info = await get_server_info();
        console.log(server_info);

        post_server_info(server_info);

        await sleep(10*60*1000); // 10 minutes
    }
}

main();


