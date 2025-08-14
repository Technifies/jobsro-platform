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
  Alert,
  IconButton,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Work as WorkIcon,
  Bookmark as BookmarkIcon,
  Notifications as NotificationsIcon,
  Edit as EditIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

import { AppDispatch, RootState } from '../../store/store';
import { getMyApplications, getSavedJobs, getFeaturedJobs } from '../../store/slices/jobSlice';
import { getProfile, calculateProfileCompletion } from '../../store/slices/profileSlice';
import { setCurrentPage, setBreadcrumbs } from '../../store/slices/uiSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const JobSeekerDashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { user } = useSelector((state: RootState) => state.auth);
  const { applications, savedJobs, featuredJobs } = useSelector((state: RootState) => state.jobs);
  const { profile, profileCompletionScore, missingFields } = useSelector((state: RootState) => state.profile);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dispatch(setCurrentPage('dashboard'));
    dispatch(setBreadcrumbs([{ label: 'Dashboard', current: true }]));

    const fetchData = async () => {
      try {
        await Promise.all([
          dispatch(getProfile()).unwrap(),
          dispatch(getMyApplications({ limit: 5 })).unwrap(),
          dispatch(getSavedJobs({ limit: 5 })).unwrap(),
          dispatch(getFeaturedJobs()).unwrap(),
        ]);
        dispatch(calculateProfileCompletion());
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dispatch]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading your dashboard..." />;
  }

  const getApplicationStatusColor = (status: string) => {
    switch (status) {
      case 'applied': return 'info';
      case 'viewed': return 'default';
      case 'shortlisted': return 'success';
      case 'interviewed': return 'warning';
      case 'hired': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const quickActions = [
    {
      title: 'Search Jobs',
      description: 'Find your next opportunity',
      icon: <WorkIcon />,
      color: 'primary',
      action: () => navigate('/jobs'),
    },
    {
      title: 'Update Profile',
      description: 'Keep your profile current',
      icon: <PersonIcon />,
      color: 'secondary',
      action: () => navigate('/profile'),
    },
    {
      title: 'My Applications',
      description: 'Track your applications',
      icon: <TrendingUpIcon />,
      color: 'info',
      action: () => navigate('/applications'),
    },
    {
      title: 'Saved Jobs',
      description: 'Review saved positions',
      icon: <BookmarkIcon />,
      color: 'warning',
      action: () => navigate('/saved-jobs'),
    },
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard - JobsRo</title>
        <meta name="description" content="Your personal job search dashboard. Track applications, discover new opportunities, and manage your career journey." />
      </Helmet>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Welcome Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            Welcome back, {user?.first_name}! 👋
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's what's happening with your job search
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Profile Completion Card */}
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>
                    Profile Completion
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => navigate('/profile')}
                  >
                    Edit Profile
                  </Button>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Profile Strength
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {profileCompletionScore}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={profileCompletionScore}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        bgcolor: profileCompletionScore > 80 ? 'success.main' : 
                                profileCompletionScore > 60 ? 'warning.main' : 'error.main',
                      },
                    }}
                  />
                </Box>

                {missingFields.length > 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      Complete your profile to get better job matches
                    </Typography>
                    <Typography variant="body2">
                      Missing: {missingFields.join(', ')}
                    </Typography>
                  </Alert>
                )}

                {profileCompletionScore >= 90 && (
                  <Alert severity="success">
                    <Typography variant="body2">
                      🎉 Great job! Your profile is nearly complete and optimized for recruiters.
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Profile Summary */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar
                    src={user?.profile_image}
                    alt={user?.first_name}
                    sx={{ width: 64, height: 64, mr: 2 }}
                  >
                    {user?.first_name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      {user?.first_name} {user?.last_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {profile?.headline || 'Add a professional headline'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      📍 {profile?.current_location || 'Add location'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {profile?.skills?.slice(0, 3).map((skill: string) => (
                    <Chip
                      key={skill}
                      label={skill}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                  {profile?.skills?.length > 3 && (
                    <Chip
                      label={`+${profile.skills.length - 3} more`}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
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

          {/* Recent Applications */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>
                    Recent Applications
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/applications')}
                  >
                    View All
                  </Button>
                </Box>

                {applications.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <WorkIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No applications yet. Start applying to jobs!
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      sx={{ mt: 2 }}
                      onClick={() => navigate('/jobs')}
                    >
                      Browse Jobs
                    </Button>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {applications.slice(0, 5).map((application, index) => (
                      <React.Fragment key={application.id}>
                        <ListItem
                          sx={{
                            px: 0,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'grey.50' },
                          }}
                          onClick={() => navigate(`/applications/${application.id}`)}
                        >
                          <ListItemIcon>
                            <Avatar
                              src={application.company_logo}
                              alt={application.company_name}
                              sx={{ width: 32, height: 32 }}
                            >
                              {application.company_name?.[0]}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={application.job_title}
                            secondary={application.company_name}
                          />
                          <Chip
                            label={application.status}
                            size="small"
                            color={getApplicationStatusColor(application.status) as any}
                          />
                        </ListItem>
                        {index < applications.slice(0, 5).length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Saved Jobs */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>
                    Saved Jobs
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/saved-jobs')}
                  >
                    View All
                  </Button>
                </Box>

                {savedJobs.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <BookmarkIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No saved jobs yet. Save interesting positions!
                    </Typography>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {savedJobs.slice(0, 5).map((savedJob, index) => (
                      <React.Fragment key={savedJob.id}>
                        <ListItem
                          sx={{
                            px: 0,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'grey.50' },
                          }}
                          onClick={() => navigate(`/jobs/${savedJob.job.slug}`)}
                        >
                          <ListItemIcon>
                            <Avatar
                              src={savedJob.job.company_logo}
                              alt={savedJob.job.company_name}
                              sx={{ width: 32, height: 32 }}
                            >
                              {savedJob.job.company_name?.[0]}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={savedJob.job.title}
                            secondary={savedJob.job.company_name}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(savedJob.created_at).toLocaleDateString()}
                          </Typography>
                        </ListItem>
                        {index < savedJobs.slice(0, 5).length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Recommended Jobs */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" fontWeight={600}>
                    Recommended for You
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/jobs')}
                  >
                    View All Jobs
                  </Button>
                </Box>

                <Grid container spacing={2}>
                  {featuredJobs.slice(0, 4).map((job) => (
                    <Grid item xs={12} sm={6} md={3} key={job.id}>
                      <Paper
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: (theme) => theme.shadows[4],
                          },
                        }}
                        onClick={() => navigate(`/jobs/${job.slug}`)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar
                            src={job.company_logo}
                            alt={job.company_name}
                            sx={{ width: 40, height: 40, mr: 1 }}
                          >
                            {job.company_name?.[0]}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="subtitle2" noWrap>
                              {job.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {job.company_name}
                            </Typography>
                          </Box>
                        </Box>

                        <Chip
                          label={job.location}
                          size="small"
                          variant="outlined"
                          sx={{ mb: 1 }}
                        />

                        {job.salary_disclosed && job.salary_min && (
                          <Typography variant="body2" color="success.main" fontWeight={600}>
                            ₹{job.salary_min.toLocaleString()} - ₹{job.salary_max?.toLocaleString()}
                          </Typography>
                        )}
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
};

export default JobSeekerDashboard;