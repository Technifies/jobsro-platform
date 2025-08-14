import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Card, 
  CardContent, 
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress
} from '@mui/material';
import {
  People as PeopleIcon,
  Work as WorkIcon,
  Assignment as AssignmentIcon,
  Payment as PaymentIcon,
  VideoCall as VideoCallIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { adminAPI } from '../../services/api';

interface DashboardStats {
  users: {
    total_users: number;
    active_users: number;
    job_seekers: number;
    employers: number;
    new_users_week: number;
  };
  jobs: {
    total_jobs: number;
    active_jobs: number;
    filled_jobs: number;
    new_jobs_week: number;
    avg_salary: number;
  };
  applications: {
    total_applications: number;
    pending_applications: number;
    hired_applications: number;
    new_applications_week: number;
  };
  payments: {
    total_transactions: number;
    total_revenue: number;
    successful_payments: number;
    failed_payments: number;
  };
  interviews: {
    total_interviews: number;
    scheduled_interviews: number;
    completed_interviews: number;
    avg_rating: number;
  };
  recent_activity: Array<{
    type: string;
    description: string;
    created_at: string;
  }>;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getDashboard(period);
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const StatCard: React.FC<{
    title: string;
    value: number | string;
    subtitle?: string;
    icon: React.ReactNode;
    color: string;
    trend?: number;
  }> = ({ title, value, subtitle, icon, color, trend }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" component="div" color={color}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
            <Typography variant="h6" color="textSecondary">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
            {trend !== undefined && (
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingUpIcon 
                  fontSize="small" 
                  color={trend >= 0 ? "success" : "error"} 
                />
                <Typography 
                  variant="body2" 
                  color={trend >= 0 ? "success.main" : "error.main"}
                  ml={0.5}
                >
                  {trend >= 0 ? '+' : ''}{trend}% this week
                </Typography>
              </Box>
            )}
          </Box>
          <Box color={color}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Admin Dashboard
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Admin Dashboard
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Admin Dashboard
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Period</InputLabel>
          <Select
            value={period}
            label="Period"
            onChange={(e) => setPeriod(e.target.value)}
          >
            <MenuItem value="7d">Last 7 days</MenuItem>
            <MenuItem value="30d">Last 30 days</MenuItem>
            <MenuItem value="90d">Last 90 days</MenuItem>
            <MenuItem value="1y">Last year</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Overview Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Users"
            value={stats.users.total_users}
            subtitle={`${stats.users.active_users} active`}
            icon={<PeopleIcon fontSize="large" />}
            color="primary.main"
            trend={((stats.users.new_users_week / stats.users.total_users) * 100)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Jobs"
            value={stats.jobs.total_jobs}
            subtitle={`${stats.jobs.active_jobs} active`}
            icon={<WorkIcon fontSize="large" />}
            color="success.main"
            trend={((stats.jobs.new_jobs_week / stats.jobs.total_jobs) * 100)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Applications"
            value={stats.applications.total_applications}
            subtitle={`${stats.applications.pending_applications} pending`}
            icon={<AssignmentIcon fontSize="large" />}
            color="info.main"
            trend={((stats.applications.new_applications_week / stats.applications.total_applications) * 100)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Revenue"
            value={`₹${Math.round(stats.payments.total_revenue).toLocaleString()}`}
            subtitle={`${stats.payments.successful_payments} transactions`}
            icon={<PaymentIcon fontSize="large" />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Interviews"
            value={stats.interviews.total_interviews}
            subtitle={`${stats.interviews.scheduled_interviews} scheduled`}
            icon={<VideoCallIcon fontSize="large" />}
            color="secondary.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* User Breakdown */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              User Distribution
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2">Job Seekers</Typography>
                <Typography variant="body2">{stats.users.job_seekers}</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(stats.users.job_seekers / stats.users.total_users) * 100}
                sx={{ mb: 2 }}
              />
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2">Employers</Typography>
                <Typography variant="body2">{stats.users.employers}</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(stats.users.employers / stats.users.total_users) * 100}
                color="secondary"
                sx={{ mb: 2 }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Job Performance */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Job Performance
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2">Fill Rate</Typography>
                <Typography variant="body2">
                  {Math.round((stats.jobs.filled_jobs / stats.jobs.total_jobs) * 100)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(stats.jobs.filled_jobs / stats.jobs.total_jobs) * 100}
                color="success"
                sx={{ mb: 2 }}
              />
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2">Average Salary</Typography>
                <Typography variant="body2">
                  ₹{Math.round(stats.jobs.avg_salary || 0).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity (Last 24 hours)
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.recent_activity.map((activity, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Chip 
                          label={activity.type} 
                          size="small"
                          color={
                            activity.type === 'user' ? 'primary' :
                            activity.type === 'job' ? 'success' :
                            'info'
                          }
                        />
                      </TableCell>
                      <TableCell>{activity.description}</TableCell>
                      <TableCell>
                        {new Date(activity.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;