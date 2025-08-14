import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  Paper,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  LocationOn as LocationIcon,
  TrendingUp as TrendingIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  WorkOutline as WorkIcon,
  ArrowForward as ArrowForwardIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

import { AppDispatch, RootState } from '../../store/store';
import { getFeaturedJobs, setSearchFilters, searchJobs } from '../../store/slices/jobSlice';
import { setCurrentPage } from '../../store/slices/uiSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const HomePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  
  const { featuredJobs, searchLoading } = useSelector((state: RootState) => state.jobs);
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [searchKeywords, setSearchKeywords] = React.useState('');
  const [searchLocation, setSearchLocation] = React.useState('');

  useEffect(() => {
    dispatch(setCurrentPage('home'));
    dispatch(getFeaturedJobs());
  }, [dispatch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const filters = {
      keywords: searchKeywords.trim() || undefined,
      location: searchLocation.trim() || undefined,
      page: 1,
      limit: 20,
    };

    dispatch(setSearchFilters(filters));
    dispatch(searchJobs(filters));
    navigate('/jobs');
  };

  const popularSearches = [
    'React Developer',
    'Data Scientist', 
    'Product Manager',
    'UI/UX Designer',
    'Full Stack Developer',
    'DevOps Engineer'
  ];

  const stats = [
    { icon: <WorkIcon />, value: '10,000+', label: 'Active Jobs' },
    { icon: <BusinessIcon />, value: '500+', label: 'Companies' },
    { icon: <PeopleIcon />, value: '50,000+', label: 'Job Seekers' },
    { icon: <TrendingIcon />, value: '95%', label: 'Success Rate' },
  ];

  return (
    <>
      <Helmet>
        <title>JobsRo - Find Your Dream Job in India</title>
        <meta name="description" content="Discover thousands of job opportunities in India. AI-powered job matching, video interviews, and career growth. Join JobsRo today!" />
        <meta name="keywords" content="jobs, careers, employment, India, job search, hiring, recruitment" />
      </Helmet>

      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  fontWeight: 700,
                  mb: 2,
                  lineHeight: 1.2,
                }}
              >
                Find Your Dream Job with{' '}
                <Box component="span" sx={{ color: '#fbbf24' }}>
                  AI Power
                </Box>
              </Typography>
              
              <Typography
                variant="h5"
                sx={{
                  mb: 4,
                  opacity: 0.9,
                  fontWeight: 400,
                  fontSize: { xs: '1.1rem', md: '1.25rem' },
                }}
              >
                Join thousands of professionals finding their perfect career match.
                AI-powered recommendations, video interviews, and instant applications.
              </Typography>

              {!isAuthenticated && (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="large"
                    sx={{
                      bgcolor: 'white',
                      color: 'primary.main',
                      '&:hover': { bgcolor: 'grey.100' },
                      px: 4,
                      py: 1.5,
                    }}
                    onClick={() => navigate('/register?role=job_seeker')}
                  >
                    Find Jobs
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    sx={{
                      borderColor: 'white',
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                      px: 4,
                      py: 1.5,
                    }}
                    onClick={() => navigate('/register?role=employer')}
                  >
                    Hire Talent
                  </Button>
                </Box>
              )}

              {isAuthenticated && (
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Welcome back, {user?.first_name}! 👋
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ textAlign: 'center' }}>
                <img
                  src="/hero-illustration.svg"
                  alt="Job Search Illustration"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Search Section */}
      <Container maxWidth="lg" sx={{ mt: -4, position: 'relative', zIndex: 1 }}>
        <Paper
          elevation={8}
          sx={{
            p: 4,
            borderRadius: 3,
            background: 'white',
          }}
        >
          <Typography variant="h4" textAlign="center" mb={3} fontWeight={600}>
            Search Jobs
          </Typography>
          
          <Box component="form" onSubmit={handleSearch}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  placeholder="Job title, keywords, or company"
                  value={searchKeywords}
                  onChange={(e) => setSearchKeywords(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: 56,
                    },
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  placeholder="Location"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: 56,
                    },
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={2}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={searchLoading}
                  sx={{ height: 56 }}
                  endIcon={<ArrowForwardIcon />}
                >
                  Search
                </Button>
              </Grid>
            </Grid>
          </Box>

          {/* Popular Searches */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Popular searches:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {popularSearches.map((search) => (
                <Chip
                  key={search}
                  label={search}
                  variant="outlined"
                  clickable
                  onClick={() => {
                    setSearchKeywords(search);
                    dispatch(setSearchFilters({ keywords: search }));
                    navigate('/jobs');
                  }}
                  sx={{ '&:hover': { bgcolor: 'primary.50' } }}
                />
              ))}
            </Box>
          </Box>
        </Paper>
      </Container>

      {/* Stats Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Grid container spacing={4}>
          {stats.map((stat, index) => (
            <Grid item xs={6} md={3} key={index}>
              <Card
                sx={{
                  textAlign: 'center',
                  p: 3,
                  height: '100%',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)' },
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    width: 56,
                    height: 56,
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  {stat.icon}
                </Avatar>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Featured Jobs */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" fontWeight={600}>
            Featured Jobs
          </Typography>
          <Button
            variant="outlined"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/jobs')}
          >
            View All Jobs
          </Button>
        </Box>

        {featuredJobs.length === 0 ? (
          <LoadingSpinner message="Loading featured jobs..." />
        ) : (
          <Grid container spacing={3}>
            {featuredJobs.slice(0, 6).map((job) => (
              <Grid item xs={12} md={6} key={job.id}>
                <Card
                  className="job-card"
                  sx={{ 
                    p: 3,
                    cursor: 'pointer',
                    height: '100%',
                  }}
                  onClick={() => navigate(`/jobs/${job.slug}`)}
                >
                  <CardContent sx={{ p: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                      <Avatar
                        src={job.company_logo}
                        alt={job.company_name}
                        sx={{ width: 48, height: 48 }}
                      >
                        {job.company_name?.[0]}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {job.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {job.company_name}
                          {job.company_verified && (
                            <StarIcon 
                              sx={{ 
                                fontSize: 16, 
                                color: 'warning.main', 
                                ml: 0.5, 
                                verticalAlign: 'middle' 
                              }} 
                            />
                          )}
                        </Typography>
                      </Box>
                      {job.is_featured && (
                        <Chip
                          label="Featured"
                          size="small"
                          color="primary"
                          variant="filled"
                        />
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Chip
                        icon={<LocationIcon />}
                        label={job.location}
                        variant="outlined"
                        size="small"
                      />
                      <Chip
                        label={job.employment_type?.replace('_', ' ')}
                        variant="outlined"
                        size="small"
                      />
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {job.description}
                    </Typography>

                    {job.salary_disclosed && job.salary_min && (
                      <Typography
                        variant="body2"
                        color="success.main"
                        fontWeight={600}
                        sx={{ mt: 1 }}
                      >
                        ₹{job.salary_min?.toLocaleString()} - ₹{job.salary_max?.toLocaleString()}/year
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Call to Action */}
      <Box
        sx={{
          bgcolor: 'grey.50',
          py: 8,
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h3" fontWeight={600} mb={2}>
            Ready to Start Your Career Journey?
          </Typography>
          <Typography variant="h6" color="text.secondary" mb={4}>
            Join thousands of professionals who found their dream jobs through JobsRo.
          </Typography>
          
          {!isAuthenticated ? (
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/register?role=job_seeker')}
                sx={{ px: 4 }}
              >
                Get Started as Job Seeker
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/register?role=employer')}
                sx={{ px: 4 }}
              >
                Post Jobs as Employer
              </Button>
            </Box>
          ) : (
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate(user?.role === 'job_seeker' ? '/dashboard' : '/employer')}
              sx={{ px: 4 }}
            >
              Go to Dashboard
            </Button>
          )}
        </Container>
      </Box>
    </>
  );
};

export default HomePage;