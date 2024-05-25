module.exports = {
    apps: [
        {
            name: `farm-server-metrics`,
            script: "ts-node",
            args: 'src/index.ts',
            env: {
                HTTP_SERVER: "xxxxx",
                CLIENT_ID: ""
            }
        }
    ]
};
