import axios from 'axios';
import si from 'systeminformation';
/*
HTTP_URL: "https://xxx",
CLIENT_ID: "test",
DISK_DEVICES: ["/dev/nvme4n1p2", "/dev/nvme4n1p1"],       // df -l, eg. ["/dev/nvme4n1p2", "/dev/nvme4n1p1"]
NET_DEVICES: ["bond"],        // ifconfig, eg. ["bond"]
SMAPLE_INTERVAL: 10,    // minutes
*/
const ENV_HTTP_URL = process.env.HTTP_URL!
const ENV_CLIENT_ID = process.env.CLIENT_ID!
const ENV_DISK_DEVICES = process.env.DISK_DEVICES? process.env.DISK_DEVICES.split(',').map((device: string) => device.trim()):[]
const ENV_NET_DEVICES = process.env.NET_DEVICES? process.env.NET_DEVICES.split(',').map((device: string) => device.trim()):[]
const ENV_SAMPLE_INTERVAL_SEC = process.env.SAMPLE_INTERVAL?Number(process.env.SAMPLE_INTERVAL)*60 : 1*60

console.log('ENV_HTTP_URL:', ENV_HTTP_URL);
console.log('ENV_CLIENT_ID:', ENV_CLIENT_ID);
console.log('ENV_DISK_DEVICES:', ENV_DISK_DEVICES);
console.log('ENV_NET_DEVICES:', ENV_NET_DEVICES);
console.log('ENV_SAMPLE_INTERVAL_SEC:', ENV_SAMPLE_INTERVAL_SEC);

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 采集状态数据
async function collectStatus(pre_data:any): Promise<any> {
  const cpuUsage = await si.currentLoad();
  const memoryUsage = await si.mem();
  const diskUsage = await si.fsSize();
  const osInfo = await si.osInfo();
//   console.log(diskUsage)
  const networkIO = await si.networkStats();
  let gpuUsage:any[] = [];

  try {
    const graphics = await si.graphics();
    // console.log(graphics);
    const targets = graphics.controllers.filter(    //we only care about NVIDIA H100 and H200
        (controller: any) =>
            controller.vendor.toUpperCase().includes("NVIDIA") &&
            (controller.name.toUpperCase().includes("H100") ||
            controller.name.toUpperCase().includes("H200"))
    );
    gpuUsage = targets.map((target: any) => ({
        name: target.name,
        memUsage: Math.round(target.memoryUsed / target.memoryTotal * 100),
    }));
  } catch (error) {
    console.log("No GPU detected or failed to fetch GPU data.");
  }

  const host_os = osInfo.distro;
  const host_name = osInfo.hostname;

  return {
    timestamp: new Date().toISOString(),
    client_id: ENV_CLIENT_ID,
    host_os: host_os,
    host_name: host_name,
    cpu_usage: Math.round(cpuUsage.currentLoad),
    avg_cpu_usage: Math.round(cpuUsage.avgLoad),
    mem_usage: Math.round((memoryUsage.active / memoryUsage.total) * 100),
    disk_usage: diskUsage
        .filter(disk => 
            ENV_DISK_DEVICES.length === 0 ||
            (ENV_DISK_DEVICES.includes(disk.fs) || ENV_DISK_DEVICES.includes(disk.mount))
        )
        .map(disk => ({
            fs: disk.fs,
            mount: disk.mount,
            usedPercent: Math.round(disk.use)
            })
        ),
    network_usage: networkIO
        .filter(net => 
            ENV_NET_DEVICES.length === 0 ||
            ENV_NET_DEVICES.includes(net.iface)
        )
        .map(net => ({
        iface: net.iface,
        rxMBytes: Math.round(net.rx_bytes/1024/1024),
        txMBytes: Math.round(net.tx_bytes/1024/1024),
        rxMBytesPerSec: Math.round(
            (net.rx_bytes/1024/1024 - (pre_data?.network_usage.find((d: any) => d.iface === net.iface)?.rxMBytes || net.rx_bytes/1024/1024) )
            /(ENV_SAMPLE_INTERVAL_SEC)
        ),
        txMBytesPerSec: Math.round(
            (net.tx_bytes/1024/1024 - (pre_data?.network_usage.find((d: any) => d.iface === net.iface)?.txMBytes || net.tx_bytes/1024/1024) )
            /(ENV_SAMPLE_INTERVAL_SEC)
        ),
        })),
    gpu_usage: gpuUsage
  };
}

async function post_server_info(server_info: any){
    try{
        const url = ENV_HTTP_URL;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(server_info)
        });
        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error('Failed to post data:', error);
    }
}

let prev_data:any = null;
async function main() {
    while (true) {
        let data = await collectStatus(prev_data);
        prev_data = data;
        console.log(data);

        await post_server_info(data);
        await sleep(ENV_SAMPLE_INTERVAL_SEC*1000);
    }
}


main();
