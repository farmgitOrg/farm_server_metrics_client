module.exports = {
    apps: [
        {
            name: `farm-server-metrics`,
            script: "ts-node",
            args: 'src/client.ts',
            log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
            env: {
                HTTP_URL: "https://xxx",
                CLIENT_ID: ""
            }
        }
    ]
};
