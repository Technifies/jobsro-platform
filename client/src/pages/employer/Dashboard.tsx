import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Work as WorkIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  ArrowForward as ArrowForwardIcon,
  Business as BusinessIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

import { AppDispatch, RootState } from '../../store/store';
import { setCurrentPage, setBreadcrumbs } from '../../store/slices/uiSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const EmployerDashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { user } = useSelector((state: RootState) => state.auth);
  
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    dispatch(setCurrentPage('employer-dashboard'));
    dispatch(setBreadcrumbs([{ label: 'Employer Dashboard', current: true }]));

    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  }, [dispatch]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading your employer dashboard..." />;
  }

  const stats = [
    { icon: <WorkIcon />, label: 'Active Jobs', value: '12', color: 'primary' },
    { icon: <PeopleIcon />, label: 'Applications', value: '156', color: 'success' },
    { icon: <TrendingUpIcon />, label: 'Views', value: '2,340', color: 'info' },
    { icon: <BusinessIcon />, label: 'Shortlisted', value: '23', color: 'warning' },
  ];

  const recentJobs = [
    {
      id: '1',
      title: 'Senior React Developer',
      applications: 24,
      views: 340,
      status: 'active',
      posted: '2 days ago',
    },
    {
      id: '2',
      title: 'Product Manager',
      applications: 18,
      views: 280,
      status: 'active',
      posted: '5 days ago',
    },
    {
      id: '3',
      title: 'UX Designer',
      applications: 31,
      views: 420,
      status: 'active',
      posted: '1 week ago',
    },
  ];

  const quickActions = [
    {
      title: 'Post New Job',
      description: 'Create a job posting',
      icon: <AddIcon />,
      color: 'primary',
      action: () => navigate('/employer/post-job'),
    },
    {
      title: 'View Applications',
      description: 'Review candidate applications',
      icon: <PeopleIcon />,
      color: 'success',
      action: () => navigate('/employer/candidates'),
    },
    {
      title: 'Manage Jobs',
      description: 'Edit or pause job postings',
      icon: <WorkIcon />,
      color: 'info',
      action: () => navigate('/employer/jobs'),
    },
    {
      title: 'Analytics',
      description: 'View hiring analytics',
      icon: <AnalyticsIcon />,
      color: 'warning',
      action: () => navigate('/employer/analytics'),
    },
  ];

  return (
    <>
      <Helmet>
        <title>Employer Dashboard - JobsRo</title>
        <meta name="description" content="Manage your job postings, review applications, and find the best talent for your company." />
      </Helmet>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Welcome Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            Welcome back, {user?.first_name}! 👋
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's an overview of your hiring activity
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Stats Cards */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              {stats.map((stat, index) => (
                <Grid item xs={6} sm={3} key={index}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Avatar
                        sx={{
                          bgcolor: `${stat.color}.main`,
                          width: 48,
                          height: 48,
                          mx: 'auto',
                          mb: 1,
                        }}
                      >
                        {stat.icon}
                      </Avatar>
                      <Typography variant="h4" fontWeight={700}>
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stat.label}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              {quickActions.map((action, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: (theme) => theme.shadows[4],
                      },
                    }}
                    onClick={action.action}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      <Avatar
                        sx={{
                          bgcolor: `${action.color}.main`,
                          width: 48,
                          height: 48,
                          mx: 'auto',
                          mb: 1,
                        }}
                      >
                        {action.icon}
                      </Avatar>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {action.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {action.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Recent Jobs */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>
                    Recent Job Postings
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/employer/jobs')}
                  >
                    View All
                  </Button>
                </Box>

                <List sx={{ p: 0 }}>
                  {recentJobs.map((job, index) => (
                    <React.Fragment key={job.id}>
                      <ListItem
                        sx={{
                          px: 0,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'grey.50' },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {job.title}
                              </Typography>
                              <Chip
                                label={job.status}
                                size="small"
                                color="success"
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                {job.applications} applications
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {job.views} views
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Posted {job.posted}
                              </Typography>
                            </Box>
                          }
                        />
                        <IconButton size="small">
                          <MoreVertIcon />
                        </IconButton>
                      </ListItem>
                      {index < recentJobs.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Company Profile Card */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Company Profile
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar
                    sx={{ width: 64, height: 64, mr: 2 }}
                    variant="rounded"
                  >
                    C
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Your Company
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Technology • Mumbai
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ mb: 2 }}>
                  Complete your company profile to attract better candidates.
                </Typography>

                <LinearProgress
                  variant="determinate"
                  value={75}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'grey.200',
                    mb: 1,
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  Profile 75% complete
                </Typography>

                <Button
                  variant="outlined"
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/employer/company')}
                >
                  Complete Profile
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Activity */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Recent Activity
                </Typography>
                
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <AnalyticsIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Activity tracking will be available soon
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
};

export default EmployerDashboard;