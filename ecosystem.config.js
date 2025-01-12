module.exports = {
    apps: [
        {
            name: `farm-server-metrics`,
            script: "ts-node",
            args: 'src/client_si.ts',
            log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
            env: {
                HTTP_URL: "https://xxx",
                CLIENT_ID: "test",
                DISK_DEVICES: ["/dev/nvme4n1p2", "/dev/nvme4n1p1"], // df -l, device or mount point, [] for all. eg. ["/dev/nvme4n1p2", "/dev/nvme4n1p1"], or ["/", "/data"]
                NET_DEVICES: ["bond"],        // ifconfig, [] for all. eg. ["bond"]
                SMAPLE_INTERVAL: 10,    // minutes
            }
        }
    ]
};
