module.exports = {
    apps: [
        {
            name: `farm-server-metrics`,
            script: "ts-node",
            args: 'src/client.ts',
            env: {
                HTTP_URL: "https://xxx",
                CLIENT_ID: ""
            }
        }
    ]
};
