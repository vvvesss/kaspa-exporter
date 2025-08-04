# Kaspa Prometheus Exporter & Grafana Dashboard

A reliable Prometheus exporter for Kaspa blockchain nodes with a comprehensive Grafana dashboard for monitoring and visualization.

## 🚀 Features

### Prometheus Exporter
- **Reliable Connection** - Custom WebSocket client with robust error handling
- **Comprehensive Metrics** - 20+ blockchain and node health metrics
- **Port Monitoring** - gRPC and JSON-RPC port accessibility checks
- **Smart Caching** - Configurable metrics caching to reduce node load
- **Production Ready** - Systemd service configuration included

### Grafana Dashboard
- **Real-time Monitoring** - Live blockchain metrics and health indicators
- **Network Analytics** - Hashrate, difficulty, and DAG structure visualization
- **Performance Tracking** - Block timing, mempool activity, and peer connections
- **Alert-Ready** - Pre-configured thresholds for critical metrics

## 📋 Metrics Exported

| Metric | Description |
|--------|-------------|
| `kaspa_virtual_daa_score` | Virtual DAA score (key Kaspa metric) |
| `kaspa_network_hashrate` | Estimated network hashrate |
| `kaspa_latest_block_number` | Latest block height |
| `kaspa_block_time_seconds` | Time since last block |
| `kaspa_tip_count` | DAG tips count |
| `kaspa_peer_count` | Connected peers |
| `kaspa_mempool_transactions` | Pending transactions |
| `kaspa_is_synced` | Node sync status (0/1) |
| `kaspa_grpc_port_accessible` | gRPC port accessibility (0/1) |
| `kaspa_json_rpc_port_accessible` | JSON-RPC port accessibility (0/1) |

[View all metrics →](docs/METRICS.md)

## 🛠️ Installation

### 1. Install the Exporter

```bash
# Create user
sudo useradd -r -s /bin/false kaspa-exporter

# Install exporter
sudo mkdir -p /opt/kaspa-exporter
sudo cp kaspa-reliable-exporter.js /opt/kaspa-exporter/
sudo chown -R kaspa-exporter:kaspa-exporter /opt/kaspa-exporter

# Install systemd service
sudo cp kaspa-exporter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kaspa-exporter
sudo systemctl start kaspa-exporter
```

### 2. Configure Prometheus

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'kaspa'
    static_configs:
      - targets: ['localhost:9110']
    scrape_interval: 30s
```

### 3. Import Grafana Dashboard

1. Copy the dashboard JSON from `grafana/kaspa-dashboard.json`
2. Import into Grafana (Dashboard → Import)
3. Configure your Prometheus datasource
4. Set job/instance variables

## ⚙️ Configuration

### Environment Variables

```bash
PORT=9110                    # Exporter port
KASPA_HOST=localhost         # Kaspa node host
KASPA_JSON_RPC_PORT=18110   # Kaspa JSON-RPC port
KASPA_GRPC_PORT=16110       # Kaspa gRPC port
CACHE_SECONDS=30            # Metrics cache duration
```

### Kaspa Node Requirements

Ensure your Kaspa node is running with JSON-RPC enabled:

```bash
kaspad --json-rpc-server=0.0.0.0:18110
```

## 📊 Dashboard Preview

The dashboard includes:

- **Node Health** - Status indicators and sync information
- **Network Metrics** - Hashrate, difficulty, and DAG visualization  
- **Performance** - Block timing and network activity
- **System Info** - Version, connectivity, and configuration

## 🔧 Troubleshooting

### Exporter Issues
```bash
# Check service status
systemctl status kaspa-exporter

# View logs
journalctl -u kaspa-exporter -f

# Test metrics endpoint
curl http://localhost:9110/metrics
```

### Common Problems

1. **No metrics showing**
   - Verify Kaspa node is running and accessible
   - Check JSON-RPC port (18110) is open
   - Confirm Prometheus is scraping the exporter

2. **Connection failures**
   - Ensure `KASPA_HOST` and `KASPA_JSON_RPC_PORT` are correct
   - Check firewall rules
   - Test connection: `telnet localhost 18110`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with your Kaspa node
5. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Kaspa](https://kaspa.org/) - The fastest, open-source, decentralized & fully scalable Layer-1
- Prometheus & Grafana communities
- Contributors and testers

---

**Need help?** Open an issue or check the [troubleshooting guide](docs/TROUBLESHOOTING.md).
