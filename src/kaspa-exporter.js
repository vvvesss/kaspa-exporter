#!/usr/bin/env node

/**
 * Reliable Kaspa Prometheus Exporter with Enhanced Metrics
 * Only uses proven working RPC methods for stability
 */

const http = require('http');
const url = require('url');
const net = require('net');
const crypto = require('crypto');

const config = {
    port: process.env.PORT || 9110,
    kaspaHost: process.env.KASPA_HOST || 'localhost',
    kaspaGrpcPort: process.env.KASPA_GRPC_PORT || 16110,
    kaspaJsonRpcPort: process.env.KASPA_JSON_RPC_PORT || 18110,
    cacheSeconds: process.env.CACHE_SECONDS || 30
};

let metricsCache = null;
let lastFetchTime = null;

// Simple WebSocket client implementation
class SimpleWebSocketClient {
    constructor(url) {
        this.url = url;
        this.socket = null;
        this.connected = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                const urlParts = new URL(this.url);
                const port = urlParts.port || 80;

                this.socket = net.createConnection(port, urlParts.hostname);

                this.socket.on('connect', () => {
                    const key = crypto.randomBytes(16).toString('base64');
                    const handshake =
                        `GET ${urlParts.pathname || '/'} HTTP/1.1\r\n` +
                        `Host: ${urlParts.hostname}:${port}\r\n` +
                        `Upgrade: websocket\r\n` +
                        `Connection: Upgrade\r\n` +
                        `Sec-WebSocket-Key: ${key}\r\n` +
                        `Sec-WebSocket-Version: 13\r\n` +
                        `\r\n`;

                    this.socket.write(handshake);
                });

                this.socket.on('data', (data) => {
                    if (!this.connected) {
                        const response = data.toString();
                        if (response.includes('101 Switching Protocols')) {
                            this.connected = true;
                            console.log('✓ WebSocket connected');
                            resolve();
                        } else {
                            reject(new Error('WebSocket handshake failed'));
                        }
                    } else {
                        this.handleFrame(data);
                    }
                });

                this.socket.on('error', reject);
                this.socket.on('close', () => { this.connected = false; });

            } catch (error) {
                reject(error);
            }
        });
    }

    sendMessage(message) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            const payload = JSON.stringify(message);
            const frame = this.createMaskedFrame(payload);

            this.responseHandler = (data) => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(new Error(`Invalid JSON: ${data}`));
                }
            };

            this.socket.write(frame);

            setTimeout(() => {
                if (this.responseHandler) {
                    this.responseHandler = null;
                    reject(new Error('Timeout'));
                }
            }, 3000); // Shorter timeout
        });
    }

    createMaskedFrame(payload) {
        const payloadBuffer = Buffer.from(payload, 'utf8');
        const payloadLength = payloadBuffer.length;

        let frame = Buffer.alloc(2);
        frame[0] = 0x81;
        frame[1] = payloadLength | 0x80;

        const mask = crypto.randomBytes(4);
        frame = Buffer.concat([frame, mask]);

        const maskedPayload = Buffer.alloc(payloadLength);
        for (let i = 0; i < payloadLength; i++) {
            maskedPayload[i] = payloadBuffer[i] ^ mask[i % 4];
        }

        return Buffer.concat([frame, maskedPayload]);
    }

    handleFrame(data) {
        if (data.length < 2) return;

        let payloadLength = data[1] & 0x7F;
        let offset = 2;

        if (payloadLength === 126) {
            payloadLength = data.readUInt16BE(offset);
            offset += 2;
        }

        if (data.length >= offset + payloadLength) {
            const payload = data.slice(offset, offset + payloadLength).toString('utf8');

            if (this.responseHandler) {
                this.responseHandler(payload);
                this.responseHandler = null;
            }
        }
    }

    close() {
        if (this.socket) {
            this.socket.end();
            this.connected = false;
        }
    }
}

function testConnection(host, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);

        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });

        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });

        socket.connect(port, host);
    });
}

async function fetchKaspaData() {
    console.log('Fetching Kaspa data via WebSocket...');

    const wsUrl = `ws://${config.kaspaHost}:${config.kaspaJsonRpcPort}`;
    const client = new SimpleWebSocketClient(wsUrl);

    try {
        await client.connect();

        // Only use the methods we know work well
        const workingMethods = [
            { id: 1, method: "getInfo", params: {} },
            { id: 2, method: "getBlockDagInfo", params: {} },
            { id: 3, method: "getConnectedPeerInfo", params: {} }
        ];

        let combinedData = {};

        for (const message of workingMethods) {
            try {
                console.log(`Calling: ${message.method}`);
                const response = await client.sendMessage(message);

                if (response && (response.result || response.params)) {
                    const data = response.result || response.params;

                    if (message.method === 'getInfo') {
                        Object.assign(combinedData, data);
                        console.log('✓ Got getInfo data');
                    }
                    else if (message.method === 'getBlockDagInfo') {
                        Object.assign(combinedData, data);
                        console.log('✓ Got getBlockDagInfo data');
                    }
                    else if (message.method === 'getConnectedPeerInfo') {
                        combinedData.peerInfo = data.peerInfo || data;
                        console.log('✓ Got peer info data');
                    }
                }
            } catch (error) {
                console.log(`${message.method} failed: ${error.message}`);
                continue;
            }
        }

        client.close();
        return combinedData;

    } catch (error) {
        console.error('WebSocket error:', error.message);
        if (client) client.close();
        return null;
    }
}

function processKaspaData(kaspaData) {
    const metrics = {};

    if (kaspaData) {
        // Basic block metrics
        if (typeof kaspaData.blockCount === 'number') {
            metrics.kaspa_latest_block_number = kaspaData.blockCount;
        }

        if (typeof kaspaData.headerCount === 'number') {
            metrics.kaspa_header_count = kaspaData.headerCount;
        }

        // Virtual DAA Score - KEY KASPA METRIC
        if (typeof kaspaData.virtualDaaScore === 'number') {
            metrics.kaspa_virtual_daa_score = kaspaData.virtualDaaScore;
        }

        // Network difficulty and estimated hashrate
        if (typeof kaspaData.difficulty === 'number') {
            metrics.kaspa_difficulty = kaspaData.difficulty;
            metrics.kaspa_network_hashrate = kaspaData.difficulty; // Approximate hashrate
        }

        // Sync status
        if (typeof kaspaData.isSynced === 'boolean') {
            metrics.kaspa_is_synced = kaspaData.isSynced ? 1 : 0;
        }

        // DAG structure metrics
        if (Array.isArray(kaspaData.tipHashes)) {
            metrics.kaspa_tip_count = kaspaData.tipHashes.length;
        }

        // Block timing
        if (typeof kaspaData.pastMedianTime === 'number') {
            const timestamp = kaspaData.pastMedianTime > 1000000000000
                ? Math.floor(kaspaData.pastMedianTime / 1000)
                : kaspaData.pastMedianTime;
            metrics.kaspa_latest_block_timestamp = timestamp;

            // Time since last block
            const currentTime = Math.floor(Date.now() / 1000);
            metrics.kaspa_block_time_seconds = currentTime - timestamp;
        }

        // Mempool
        if (typeof kaspaData.mempoolSize === 'number') {
            metrics.kaspa_mempool_size = kaspaData.mempoolSize;
            metrics.kaspa_mempool_transactions = kaspaData.mempoolSize; // Treat as transaction count
        }

        // Peer information
        if (kaspaData.peerInfo && Array.isArray(kaspaData.peerInfo)) {
            metrics.kaspa_peer_count = kaspaData.peerInfo.length;

            // Count connected peers
            const connectedPeers = kaspaData.peerInfo.filter(peer =>
                peer.is_connected !== false
            ).length;
            metrics.kaspa_connected_peer_count = connectedPeers;
        }

        // UTXO index status
        if (typeof kaspaData.isUtxoIndexed === 'boolean') {
            metrics.kaspa_utxo_index_enabled = kaspaData.isUtxoIndexed ? 1 : 0;
        }

        // Network type
        if (kaspaData.network) {
            metrics.kaspa_network_mainnet = kaspaData.network === 'mainnet' ? 1 : 0;
        }

        // Server version
        if (kaspaData.serverVersion) {
            const versionMatch = kaspaData.serverVersion.match(/(\d+)\.(\d+)\.(\d+)/);
            if (versionMatch) {
                metrics.kaspa_server_version_major = parseInt(versionMatch[1]);
                metrics.kaspa_server_version_minor = parseInt(versionMatch[2]);
                metrics.kaspa_server_version_patch = parseInt(versionMatch[3]);
            }
        }

        // Additional features
        if (typeof kaspaData.hasNotifyCommand === 'boolean') {
            metrics.kaspa_notify_enabled = kaspaData.hasNotifyCommand ? 1 : 0;
        }
    }

    return metrics;
}

async function fetchMetrics() {
    const now = Date.now();

    if (metricsCache && lastFetchTime && (now - lastFetchTime) < config.cacheSeconds * 1000) {
        console.log('Using cached metrics');
        return metricsCache;
    }

    console.log('Fetching fresh metrics...');

    const metrics = {
        kaspa_node_current_timestamp: Math.floor(Date.now() / 1000),
        kaspa_exporter_last_scrape_timestamp: Math.floor(Date.now() / 1000)
    };

    try {
        const [grpcConnected, jsonRpcConnected] = await Promise.all([
            testConnection(config.kaspaHost, config.kaspaGrpcPort),
            testConnection(config.kaspaHost, config.kaspaJsonRpcPort)
        ]);

        metrics.kaspa_grpc_port_accessible = grpcConnected ? 1 : 0;
        metrics.kaspa_json_rpc_port_accessible = jsonRpcConnected ? 1 : 0;
        metrics.kaspa_node_responsive = (grpcConnected || jsonRpcConnected) ? 1 : 0;

        if (jsonRpcConnected) {
            const kaspaData = await fetchKaspaData();
            const blockMetrics = processKaspaData(kaspaData);
            Object.assign(metrics, blockMetrics);
        }

        // Set defaults
        if (!metrics.kaspa_latest_block_number) {
            metrics.kaspa_latest_block_number = 0;
        }
        if (!metrics.kaspa_latest_block_timestamp) {
            metrics.kaspa_latest_block_timestamp = Math.floor(Date.now() / 1000);
        }

        metrics.kaspa_exporter_up = metrics.kaspa_node_responsive;

    } catch (error) {
        console.error('Error fetching metrics:', error.message);
        metrics.kaspa_exporter_up = 0;
        metrics.kaspa_latest_block_number = -1;
        metrics.kaspa_latest_block_timestamp = -1;
    }

    metricsCache = metrics;
    lastFetchTime = now;

    return metrics;
}

function formatPrometheusMetrics(metrics) {
    const lines = [];

    Object.entries(metrics).forEach(([name, value]) => {
        if (typeof value === 'number') {
            lines.push(`# HELP ${name} Kaspa ${name.replace(/^kaspa_/, '').replace(/_/g, ' ')}`);
            lines.push(`# TYPE ${name} gauge`);
            lines.push(`${name} ${value}`);
            lines.push('');
        }
    });

    return lines.join('\n');
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    try {
        if (parsedUrl.pathname === '/metrics') {
            const metrics = await fetchMetrics();
            const formatted = formatPrometheusMetrics(metrics);

            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(formatted);

        } else if (parsedUrl.pathname === '/health') {
            const healthData = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                config: {
                    kaspaHost: config.kaspaHost,
                    kaspaGrpcPort: config.kaspaGrpcPort,
                    kaspaJsonRpcPort: config.kaspaJsonRpcPort
                }
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(healthData, null, 2));

        } else if (parsedUrl.pathname === '/') {
            const html = `
                <html>
                <head><title>Kaspa Prometheus Exporter</title></head>
                <body>
                    <h1>Kaspa Prometheus Exporter (Reliable)</h1>
                    <p><a href="/metrics">Metrics</a> | <a href="/health">Health</a></p>
                    <h2>Enhanced Metrics Available:</h2>
                    <ul>
                        <li><strong>kaspa_virtual_daa_score</strong> - Virtual DAA score</li>
                        <li><strong>kaspa_network_hashrate</strong> - Estimated hashrate</li>
                        <li><strong>kaspa_block_time_seconds</strong> - Time since last block</li>
                        <li><strong>kaspa_peer_count</strong> - Connected peers</li>
                        <li><strong>kaspa_mempool_transactions</strong> - Pending transactions</li>
                        <li><strong>kaspa_utxo_index_enabled</strong> - UTXO index status</li>
                        <li>And more core metrics...</li>
                    </ul>
                </body>
                </html>
            `;

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);

        } else {
            res.writeHead(404);
            res.end('Not Found');
        }

    } catch (error) {
        console.error('Request error:', error);
        res.writeHead(500);
        res.end('Internal Server Error');
    }
});

server.listen(config.port, '0.0.0.0', () => {
    console.log(`Reliable Kaspa Prometheus Exporter listening on port ${config.port}`);
    console.log(`Enhanced metrics: virtual_daa_score, network_hashrate, block_time_seconds, peer_count`);
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});
