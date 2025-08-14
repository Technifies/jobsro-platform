import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Typography,
  Link,
  IconButton,
  Divider,
  Stack,
  useTheme,
} from '@mui/material';
import {
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  Instagram as InstagramIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';

const Footer: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const footerLinks = {
    'For Job Seekers': [
      { label: 'Browse Jobs', path: '/jobs' },
      { label: 'Job Alerts', path: '/job-alerts' },
      { label: 'Resume Builder', path: '/resume-builder' },
      { label: 'Career Advice', path: '/career-advice' },
      { label: 'Salary Guide', path: '/salary-guide' },
    ],
    'For Employers': [
      { label: 'Post Jobs', path: '/employer/post-job' },
      { label: 'Search Resumes', path: '/employer/candidates' },
      { label: 'Employer Branding', path: '/employer-branding' },
      { label: 'Pricing', path: '/pricing' },
      { label: 'AI Matching', path: '/ai-matching' },
    ],
    'Company': [
      { label: 'About Us', path: '/about' },
      { label: 'Contact Us', path: '/contact' },
      { label: 'Careers', path: '/careers' },
      { label: 'Press', path: '/press' },
      { label: 'Investors', path: '/investors' },
    ],
    'Support': [
      { label: 'Help Center', path: '/help' },
      { label: 'Privacy Policy', path: '/privacy' },
      { label: 'Terms of Service', path: '/terms' },
      { label: 'Cookie Policy', path: '/cookies' },
      { label: 'Security', path: '/security' },
    ],
  };

  const socialLinks = [
    { icon: <FacebookIcon />, url: 'https://facebook.com/jobsro', label: 'Facebook' },
    { icon: <TwitterIcon />, url: 'https://twitter.com/jobsro', label: 'Twitter' },
    { icon: <LinkedInIcon />, url: 'https://linkedin.com/company/jobsro', label: 'LinkedIn' },
    { icon: <InstagramIcon />, url: 'https://instagram.com/jobsro', label: 'Instagram' },
  ];

  const contactInfo = [
    { icon: <EmailIcon />, text: 'support@jobsro.com', href: 'mailto:support@jobsro.com' },
    { icon: <PhoneIcon />, text: '+91 98765 43210', href: 'tel:+919876543210' },
    { icon: <LocationIcon />, text: 'Mumbai, India', href: null },
  ];

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'grey.900',
        color: 'grey.100',
        mt: 'auto',
        py: 6,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Company Info */}
          <Grid item xs={12} md={3}>
            <Typography
              variant="h5"
              fontWeight={700}
              color="primary.main"
              sx={{ mb: 2 }}
            >
              JobsRo
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: 'grey.300', lineHeight: 1.6 }}>
              India's leading AI-powered job portal connecting talented professionals 
              with their dream careers. Find jobs, hire talent, grow together.
            </Typography>
            
            {/* Social Media Links */}
            <Stack direction="row" spacing={1}>
              {socialLinks.map((social, index) => (
                <IconButton
                  key={index}
                  component="a"
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: 'grey.400',
                    '&:hover': {
                      color: 'primary.main',
                      bgcolor: 'rgba(37, 99, 235, 0.1)',
                    },
                  }}
                  aria-label={social.label}
                >
                  {social.icon}
                </IconButton>
              ))}
            </Stack>
          </Grid>

          {/* Footer Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <Grid item xs={6} sm={3} md={2} key={category}>
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ mb: 2, color: 'white' }}
              >
                {category}
              </Typography>
              <Stack spacing={1}>
                {links.map((link, index) => (
                  <Link
                    key={index}
                    component="button"
                    variant="body2"
                    onClick={() => navigate(link.path)}
                    sx={{
                      color: 'grey.300',
                      textAlign: 'left',
                      textDecoration: 'none',
                      '&:hover': {
                        color: 'primary.main',
                        textDecoration: 'underline',
                      },
                      cursor: 'pointer',
                      border: 'none',
                      background: 'none',
                      p: 0,
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </Stack>
            </Grid>
          ))}

          {/* Contact Info */}
          <Grid item xs={12} md={2}>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              sx={{ mb: 2, color: 'white' }}
            >
              Contact Us
            </Typography>
            <Stack spacing={2}>
              {contactInfo.map((contact, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: 'primary.main', fontSize: 20 }}>
                    {contact.icon}
                  </Box>
                  {contact.href ? (
                    <Link
                      href={contact.href}
                      variant="body2"
                      sx={{
                        color: 'grey.300',
                        textDecoration: 'none',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      {contact.text}
                    </Link>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'grey.300' }}>
                      {contact.text}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, bgcolor: 'grey.700' }} />

        {/* Bottom Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="body2" sx={{ color: 'grey.400' }}>
            © 2024 JobsRo. All rights reserved.
          </Typography>

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'center',
            }}
          >
            <Link
              onClick={() => navigate('/privacy')}
              variant="body2"
              sx={{
                color: 'grey.400',
                textDecoration: 'none',
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Privacy Policy
            </Link>
            <Typography variant="body2" sx={{ color: 'grey.600' }}>
              •
            </Typography>
            <Link
              onClick={() => navigate('/terms')}
              variant="body2"
              sx={{
                color: 'grey.400',
                textDecoration: 'none',
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Terms of Service
            </Link>
            <Typography variant="body2" sx={{ color: 'grey.600' }}>
              •
            </Typography>
            <Link
              onClick={() => navigate('/cookies')}
              variant="body2"
              sx={{
                color: 'grey.400',
                textDecoration: 'none',
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Cookies
            </Link>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ color: 'grey.400' }}>
              Made in India with
            </Typography>
            <Typography variant="body2" sx={{ color: 'red.400' }}>
              ❤️
            </Typography>
          </Box>
        </Box>

        {/* Back to Top */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <IconButton
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            sx={{
              color: 'grey.400',
              '&:hover': {
                color: 'primary.main',
                bgcolor: 'rgba(37, 99, 235, 0.1)',
              },
            }}
            aria-label="Back to top"
          >
            <Box
              component="span"
              sx={{
                fontSize: 24,
                transform: 'rotate(-90deg)',
              }}
            >
              ➤
            </Box>
          </IconButton>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;