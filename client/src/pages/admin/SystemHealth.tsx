import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Cloud as CloudIcon,
  Security as SecurityIcon,
  Database as DatabaseIcon,
  Api as ApiIcon
} from '@mui/icons-material';
import { adminAPI } from '../../services/api/adminAPI';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'warning';
  timestamp: string;
  checks: {
    database: 'ok' | 'error' | 'warning';
    tables: 'ok' | 'error' | 'warning';
    recent_activity: 'ok' | 'error' | 'warning';
    [key: string]: 'ok' | 'error' | 'warning';
  };
  metrics?: {
    uptime: number;
    memory_usage: number;
    cpu_usage: number;
    active_connections: number;
    response_times: {
      avg: number;
      p95: number;
    };
  };
}

const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchHealthData();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchHealthData, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getSystemHealth();
      setHealth(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch system health');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
      case 'healthy':
        return <CheckIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
      case 'unhealthy':
        return <ErrorIcon color="error" />;
      default:
        return <WarningIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const healthChecks = [
    { key: 'database', label: 'Database Connection', icon: <DatabaseIcon /> },
    { key: 'tables', label: 'Table Integrity', icon: <StorageIcon /> },
    { key: 'recent_activity', label: 'System Activity', icon: <ApiIcon /> },
    { key: 'email_service', label: 'Email Service', icon: <CloudIcon /> },
    { key: 'sms_service', label: 'SMS Service', icon: <CloudIcon /> },
    { key: 'payment_gateway', label: 'Payment Gateway', icon: <SecurityIcon /> },
    { key: 'ai_service', label: 'AI Services', icon: <ApiIcon /> }
  ];

  if (loading && !health) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          System Health
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error && !health) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          System Health
        </Typography>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchHealthData}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          System Health
        </Typography>
        <Box>
          <Tooltip title={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}>
            <Button
              variant={autoRefresh ? "contained" : "outlined"}
              onClick={() => setAutoRefresh(!autoRefresh)}
              sx={{ mr: 1 }}
            >
              Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
          </Tooltip>
          <Tooltip title="Refresh now">
            <IconButton onClick={fetchHealthData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {health && (
        <>
          {/* Overall Status */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box mb={2}>
                    {getStatusIcon(health.status)}
                  </Box>
                  <Typography variant="h5" gutterBottom>
                    System Status
                  </Typography>
                  <Chip
                    label={health.status.toUpperCase()}
                    color={getStatusColor(health.status)}
                    size="large"
                  />
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    Last checked: {new Date(health.timestamp).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {health.metrics && (
              <>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center" mb={2}>
                        <SpeedIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Performance</Typography>
                      </Box>
                      <Box mb={1}>
                        <Typography variant="body2" color="textSecondary">
                          Uptime: {formatUptime(health.metrics.uptime)}
                        </Typography>
                      </Box>
                      <Box mb={1}>
                        <Typography variant="body2" color="textSecondary">
                          Avg Response: {health.metrics.response_times.avg}ms
                        </Typography>
                      </Box>
                      <Box mb={1}>
                        <Typography variant="body2" color="textSecondary">
                          P95 Response: {health.metrics.response_times.p95}ms
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center" mb={2}>
                        <MemoryIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Resources</Typography>
                      </Box>
                      <Box mb={2}>
                        <Typography variant="body2" gutterBottom>
                          Memory Usage: {health.metrics.memory_usage}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={health.metrics.memory_usage}
                          color={health.metrics.memory_usage > 80 ? "error" : "primary"}
                        />
                      </Box>
                      <Box mb={2}>
                        <Typography variant="body2" gutterBottom>
                          CPU Usage: {health.metrics.cpu_usage}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={health.metrics.cpu_usage}
                          color={health.metrics.cpu_usage > 80 ? "error" : "primary"}
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        Active Connections: {health.metrics.active_connections}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>

          {/* Health Checks */}
          <Paper sx={{ mb: 3 }}>
            <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Health Checks</Typography>
              <Button variant="outlined" onClick={() => setDetailsOpen(true)}>
                View Details
              </Button>
            </Box>
            <Divider />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Service</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {healthChecks.map((check) => {
                    const status = health.checks[check.key] || 'unknown';
                    return (
                      <TableRow key={check.key}>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            {check.icon}
                            <Typography sx={{ ml: 1 }}>
                              {check.label}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            {getStatusIcon(status)}
                            <Chip
                              label={status.toUpperCase()}
                              color={getStatusColor(status)}
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          {status === 'ok' && 'Service is functioning normally'}
                          {status === 'warning' && 'Service has minor issues'}
                          {status === 'error' && 'Service is experiencing problems'}
                          {status === 'unknown' && 'Status could not be determined'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Alerts */}
          {health.status !== 'healthy' && (
            <Alert 
              severity={health.status === 'warning' ? 'warning' : 'error'}
              sx={{ mb: 2 }}
            >
              <Typography variant="h6" gutterBottom>
                System Issues Detected
              </Typography>
              {Object.entries(health.checks).map(([key, status]) => (
                status !== 'ok' && (
                  <Typography key={key} variant="body2">
                    • {key.replace('_', ' ').toUpperCase()}: {status}
                  </Typography>
                )
              ))}
            </Alert>
          )}
        </>
      )}

      {/* Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>System Health Details</DialogTitle>
        <DialogContent>
          {health && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Raw Health Data
              </Typography>
              <pre style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '16px', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '0.875rem'
              }}>
                {JSON.stringify(health, null, 2)}
              </pre>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SystemHealth;