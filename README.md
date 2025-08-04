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

## 📊 Dashboard Screenshots

The Grafana dashboard provides comprehensive monitoring of your Kaspa node:

### Node Health & Performance

![Kaspa Node Health](https://drive.google.com/uc?export=view&id=18Tf3Sx3ZGIY0AVgQjrjyT6oeh6E33Mf4)
*Real-time node status, block information, and network connectivity*

### Network Analytics & DAG Metrics  

![Kaspa Network Metrics](https://drive.google.com/uc?export=view&id=1BM9alBLjMUHsw207y4bV4auKBwQYSyRv)
*Hashrate, difficulty, DAG tips, and mempool activity visualization*

### Key Features Shown

- ✅ Node sync status and health indicators
- 📈 Network hashrate and difficulty trends
- ⏱️ Block timing and DAG structure metrics
- 🌐 Peer connectivity and mempool activity
- 📊 Historical data with customizable time ranges

## 🚨 Prometheus Alerting Rules

Pre-configured alerting rules are included to monitor critical Kaspa node health metrics. These rules help ensure your node stays healthy and synchronized with the network.

### Alert Rules

| Alert | Condition | Duration | Severity | Description |
|-------|-----------|----------|----------|-------------|
| **Kaspa LargeSyncDistance** | Block age > 1 hour | 10 minutes | Critical | Node hasn't seen a new block for over 1 hour |
| **Kaspa NodeNotSynced** | `kaspa_is_synced == 0` | 10 minutes | Critical | Node is not synchronized with the network |

### Setup

1. **Copy the rules file:**

   ```bash
   sudo cp alerts/kaspa-rules.yml /etc/prometheus/rules/
   ```

2. **Update your `prometheus.yml`:**

   ```yaml
   rule_files:
     - "rules/kaspa-rules.yml"
   
   alerting:
     alertmanagers:
       - static_configs:
           - targets:
             - alertmanager:9093
   ```

3. **Reload Prometheus:**

   ```bash
   sudo systemctl reload prometheus
   ```

### Alert Details

- **LargeSyncDistance**: Triggers when your node falls behind the network by more than 1 hour, indicating potential connectivity or sync issues
- **NodeNotSynced**: Fires when the node reports it's not synchronized, often due to network problems or node restart

These alerts integrate with your existing Alertmanager setup and include links to troubleshooting documentation and the Grafana dashboard for quick diagnosis.

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

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Kaspa](https://kaspa.org/) - The fastest, open-source, decentralized & fully scalable Layer-1
- Prometheus & Grafana communities
- Contributors and testers

---

**Need help?** Open an issue or check the [troubleshooting guide](docs/TROUBLESHOOTING.md).
