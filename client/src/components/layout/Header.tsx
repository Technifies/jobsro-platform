import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Badge,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountIcon,
  Dashboard as DashboardIcon,
  Work as WorkIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Home as HomeIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

import { AppDispatch, RootState } from '../../store/store';
import { logoutUser } from '../../store/slices/authSlice';
import { setMobileMenuOpen, selectUnreadNotifications } from '../../store/slices/uiSlice';

const Header: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { mobileMenuOpen } = useSelector((state: RootState) => state.ui);
  const unreadNotifications = useSelector(selectUnreadNotifications);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchorEl(event.currentTarget);
  };

  const handleNotificationMenuClose = () => {
    setNotificationAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logoutUser());
    handleProfileMenuClose();
    navigate('/');
  };

  const handleMobileMenuToggle = () => {
    dispatch(setMobileMenuOpen(!mobileMenuOpen));
  };

  const getDashboardPath = () => {
    switch (user?.role) {
      case 'job_seeker':
        return '/dashboard';
      case 'employer':
        return '/employer';
      case 'recruiter':
        return '/recruiter';
      case 'admin':
        return '/admin';
      default:
        return '/';
    }
  };

  const navigationItems = [
    { label: 'Home', path: '/', icon: <HomeIcon /> },
    { label: 'Jobs', path: '/jobs', icon: <SearchIcon /> },
    { label: 'Companies', path: '/companies', icon: <BusinessIcon /> },
  ];

  const userMenuItems = [
    {
      label: 'Dashboard',
      path: getDashboardPath(),
      icon: <DashboardIcon />,
      show: isAuthenticated,
    },
    {
      label: 'Profile',
      path: '/profile',
      icon: <PersonIcon />,
      show: isAuthenticated && user?.role === 'job_seeker',
    },
    {
      label: 'Applications',
      path: '/applications',
      icon: <WorkIcon />,
      show: isAuthenticated && user?.role === 'job_seeker',
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: <SettingsIcon />,
      show: isAuthenticated,
    },
  ];

  return (
    <>
      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
          {/* Logo */}
          <Typography
            variant="h5"
            component="div"
            sx={{
              flexGrow: { xs: 1, md: 0 },
              fontWeight: 700,
              color: 'primary.main',
              cursor: 'pointer',
              mr: { md: 4 },
            }}
            onClick={() => navigate('/')}
          >
            JobsRo
          </Typography>

          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
              {navigationItems.map((item) => (
                <Button
                  key={item.path}
                  color="inherit"
                  onClick={() => navigate(item.path)}
                  sx={{
                    color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                    fontWeight: location.pathname === item.path ? 600 : 400,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          )}

          {/* Right side actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <IconButton
                  color="inherit"
                  onClick={handleNotificationMenuOpen}
                  sx={{ color: 'text.primary' }}
                >
                  <Badge badgeContent={unreadNotifications.length} color="error">
                    <NotificationsIcon />
                  </Badge>
                </IconButton>

                {/* Profile Menu */}
                <IconButton
                  onClick={handleProfileMenuOpen}
                  sx={{ p: 0, ml: 1 }}
                >
                  <Avatar
                    src={user?.profile_image}
                    alt={user?.first_name}
                    sx={{ width: 32, height: 32 }}
                  >
                    {user?.first_name?.[0]?.toUpperCase()}
                  </Avatar>
                </IconButton>
              </>
            ) : (
              <>
                {!isMobile && (
                  <>
                    <Button
                      color="inherit"
                      onClick={() => navigate('/login')}
                      sx={{ color: 'text.primary' }}
                    >
                      Sign In
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => navigate('/register')}
                      sx={{ ml: 1 }}
                    >
                      Sign Up
                    </Button>
                  </>
                )}
              </>
            )}

            {/* Mobile menu button */}
            {isMobile && (
              <IconButton
                color="inherit"
                onClick={handleMobileMenuToggle}
                sx={{ color: 'text.primary' }}
              >
                <MenuIcon />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            minWidth: 200,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* User info */}
        <MenuItem disabled>
          <Box>
            <Typography variant="subtitle2" fontWeight={600}>
              {user?.first_name} {user?.last_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
        </MenuItem>
        <Divider />

        {/* Menu items */}
        {userMenuItems
          .filter(item => item.show)
          .map((item) => (
            <MenuItem
              key={item.path}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </MenuItem>
          ))}

        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </MenuItem>
      </Menu>

      {/* Notifications Menu */}
      <Menu
        anchorEl={notificationAnchorEl}
        open={Boolean(notificationAnchorEl)}
        onClose={handleNotificationMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            minWidth: 300,
            maxWidth: 400,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2" fontWeight={600}>
            Notifications ({unreadNotifications.length})
          </Typography>
        </MenuItem>
        <Divider />

        {unreadNotifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No new notifications
            </Typography>
          </MenuItem>
        ) : (
          unreadNotifications.slice(0, 5).map((notification) => (
            <MenuItem key={notification.id} onClick={handleNotificationMenuClose}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                  {notification.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {notification.message}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}

        {unreadNotifications.length > 5 && (
          <>
            <Divider />
            <MenuItem onClick={() => navigate('/notifications')}>
              <Typography variant="body2" color="primary.main">
                View all notifications
              </Typography>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={handleMobileMenuToggle}
        PaperProps={{
          sx: { width: 280 }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={600} color="primary.main">
            JobsRo
          </Typography>
        </Box>
        <Divider />

        <List>
          {/* Navigation items */}
          {navigationItems.map((item) => (
            <ListItem
              button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                handleMobileMenuToggle();
              }}
              selected={location.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItem>
          ))}

          <Divider sx={{ my: 1 }} />

          {isAuthenticated ? (
            <>
              {/* User info */}
              <ListItem>
                <ListItemIcon>
                  <Avatar
                    src={user?.profile_image}
                    alt={user?.first_name}
                    sx={{ width: 32, height: 32 }}
                  >
                    {user?.first_name?.[0]?.toUpperCase()}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={`${user?.first_name} ${user?.last_name}`}
                  secondary={user?.email}
                />
              </ListItem>

              <Divider sx={{ my: 1 }} />

              {/* User menu items */}
              {userMenuItems
                .filter(item => item.show)
                .map((item) => (
                  <ListItem
                    button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      handleMobileMenuToggle();
                    }}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItem>
                ))}

              <ListItem button onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItem>
            </>
          ) : (
            <>
              <ListItem
                button
                onClick={() => {
                  navigate('/login');
                  handleMobileMenuToggle();
                }}
              >
                <ListItemIcon>
                  <AccountIcon />
                </ListItemIcon>
                <ListItemText primary="Sign In" />
              </ListItem>

              <ListItem
                button
                onClick={() => {
                  navigate('/register');
                  handleMobileMenuToggle();
                }}
              >
                <ListItemIcon>
                  <PersonIcon />
                </ListItemIcon>
                <ListItemText primary="Sign Up" />
              </ListItem>
            </>
          )}
        </List>
      </Drawer>
    </>
  );
};

export default Header;