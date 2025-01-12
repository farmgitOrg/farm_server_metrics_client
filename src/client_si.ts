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

  return {
    timestamp: new Date().toISOString(),
    cpuUsage: Math.round(cpuUsage.currentLoad),
    avgCpuUsage: Math.round(cpuUsage.avgLoad),
    memoryUsage: Math.round((memoryUsage.active / memoryUsage.total) * 100),
    diskUsage: diskUsage
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
    networkIO: networkIO
        .filter(net => 
            ENV_NET_DEVICES.length === 0 ||
            ENV_NET_DEVICES.includes(net.iface)
        )
        .map(net => ({
        iface: net.iface,
        rxMBytes: Math.round(net.rx_bytes/1024/1024),
        txMBytes: Math.round(net.tx_bytes/1024/1024),
        rxMBytesPerSec: Math.round(((net.rx_bytes/1024/1024 - (pre_data?.networkIO.find((d: any) => d.iface === net.iface)?.rxMBytes || net.rx_bytes/1024/1024) ))/(ENV_SAMPLE_INTERVAL_SEC)),
        txMBytesPerSec: Math.round(((net.tx_bytes/1024/1024 - (pre_data?.networkIO.find((d: any) => d.iface === net.iface)?.txMBytes || net.tx_bytes/1024/1024) ))/(ENV_SAMPLE_INTERVAL_SEC)),
        })),
    gpuUsage
  };
}

let prev_data:any = null;
async function main() {
    while (true) {
        let data = await collectStatus(prev_data);
        prev_data = data;
        console.log(data);

        try {
            const response = await axios.post(ENV_HTTP_URL, {
                client_id: ENV_CLIENT_ID,
                data: data
            });
            console.log(response.data);
        } catch (error) {
            console.error('Failed to post data:', error);
        }
        await sleep(ENV_SAMPLE_INTERVAL_SEC*1000);
    }
}


main();
