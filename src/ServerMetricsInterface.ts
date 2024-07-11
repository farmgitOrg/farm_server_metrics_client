export
interface PartitionInterface {
    partition: string;
    size: string;
    used: string;
    available: string;
    use: string;
    mounted: string;
}

export
interface ServerMetricsInterface {
    client_id: string;
    host: string;
    os: string;
    cpu_usage: number;
    mem_usage: number;
    ping_delay: number;
    partition_info: PartitionInterface;
}

/*
    {
    host: 'ip-172-31-34-195',
    os: 'Debian GNU/Linux 12 (bookworm)',
    cpu_usage: 42.5,
    mem_usage: 56.122732730834855,
    ping_delay: 1.309,
    partition: {
        partition: '/dev/nvme0n1p1',
        size: '252G',
        used: '61G',
        available: '181G',
        use: '26%',
        mounted: '/'
}
*/
