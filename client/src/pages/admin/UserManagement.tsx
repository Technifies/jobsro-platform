import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  Avatar,
  Tooltip,
  Menu,
  MenuProps
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  Check as CheckIcon,
  MoreVert as MoreVertIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Work as WorkIcon
} from '@mui/icons-material';
import { adminAPI } from '../../services/api';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_login_at: string;
  additional_info?: string;
  activity_stats?: {
    jobs_posted: number;
    applications: number;
    total_payments: number;
  };
}

interface UserFilters {
  role: string;
  status: string;
  search: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserFilters>({
    role: '',
    status: '',
    search: ''
  });

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuUserId, setMenuUserId] = useState<number | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage, filters]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...(filters.role && { role: filters.role }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search })
      };

      const response = await adminAPI.getUsers(params);
      setUsers(response.data.users);
      setTotalUsers(response.data.pagination.total);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = async (userId: number) => {
    try {
      const response = await adminAPI.getUserDetails(userId);
      setSelectedUser(response.data.user);
      setViewDialogOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch user details');
    }
  };

  const handleStatusChange = async () => {
    if (!selectedUser || !newStatus) return;

    try {
      await adminAPI.updateUserStatus(selectedUser.id, {
        status: newStatus,
        reason: statusReason
      });
      
      setStatusDialogOpen(false);
      setSelectedUser(null);
      setNewStatus('');
      setStatusReason('');
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'suspended': return 'warning';
      case 'banned': return 'error';
      case 'inactive': return 'default';
      default: return 'default';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'employer': return 'primary';
      case 'job_seeker': return 'info';
      default: return 'default';
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, userId: number) => {
    setAnchorEl(event.currentTarget);
    setMenuUserId(userId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuUserId(null);
  };

  const openStatusDialog = (user: User, status: string) => {
    setSelectedUser(user);
    setNewStatus(status);
    setStatusDialogOpen(true);
    handleMenuClose();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search users"
              placeholder="Email, name..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={filters.role}
                label="Role"
                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              >
                <MenuItem value="">All Roles</MenuItem>
                <MenuItem value="job_seeker">Job Seeker</MenuItem>
                <MenuItem value="employer">Employer</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                label="Status"
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
                <MenuItem value="banned">Banned</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setFilters({ role: '', status: '', search: '' })}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Users Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Additional Info</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ mr: 2 }}>
                        {user.first_name[0]}{user.last_name[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {user.first_name} {user.last_name}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={user.role.replace('_', ' ')} 
                      color={getRoleColor(user.role)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={user.status} 
                      color={getStatusColor(user.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {user.additional_info || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {user.last_login_at 
                      ? new Date(user.last_login_at).toLocaleDateString()
                      : 'Never'
                    }
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton onClick={() => handleViewUser(user.id)}>
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="More Actions">
                      <IconButton onClick={(e) => handleMenuOpen(e, user.id)}>
                        <MoreVertIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalUsers}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          const user = users.find(u => u.id === menuUserId);
          if (user) openStatusDialog(user, 'active');
        }}>
          <CheckIcon sx={{ mr: 1 }} />
          Activate
        </MenuItem>
        <MenuItem onClick={() => {
          const user = users.find(u => u.id === menuUserId);
          if (user) openStatusDialog(user, 'suspended');
        }}>
          <BlockIcon sx={{ mr: 1 }} />
          Suspend
        </MenuItem>
        <MenuItem onClick={() => {
          const user = users.find(u => u.id === menuUserId);
          if (user) openStatusDialog(user, 'banned');
        }}>
          <BlockIcon sx={{ mr: 1 }} />
          Ban
        </MenuItem>
      </Menu>

      {/* User Details Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>User Details</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Personal Information
                    </Typography>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Avatar sx={{ mr: 2, width: 56, height: 56 }}>
                        {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="h6">
                          {selectedUser.first_name} {selectedUser.last_name}
                        </Typography>
                        <Chip 
                          label={selectedUser.role.replace('_', ' ')} 
                          color={getRoleColor(selectedUser.role)}
                          size="small"
                        />
                      </Box>
                    </Box>
                    
                    <Box display="flex" alignItems="center" mb={1}>
                      <EmailIcon sx={{ mr: 1 }} color="action" />
                      <Typography>{selectedUser.email}</Typography>
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="body2" color="textSecondary">
                        Status: <Chip 
                          label={selectedUser.status} 
                          color={getStatusColor(selectedUser.status)}
                          size="small"
                        />
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="textSecondary">
                      Joined: {new Date(selectedUser.created_at).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Last Login: {selectedUser.last_login_at 
                        ? new Date(selectedUser.last_login_at).toLocaleDateString()
                        : 'Never'
                      }
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {selectedUser.activity_stats && (
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Activity Statistics
                      </Typography>
                      <Box mb={1}>
                        <Typography variant="body2">
                          Jobs Posted: {selectedUser.activity_stats.jobs_posted}
                        </Typography>
                      </Box>
                      <Box mb={1}>
                        <Typography variant="body2">
                          Applications: {selectedUser.activity_stats.applications}
                        </Typography>
                      </Box>
                      <Box mb={1}>
                        <Typography variant="body2">
                          Total Payments: ₹{selectedUser.activity_stats.total_payments.toLocaleString()}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {selectedUser.profile_data && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Profile Data
                      </Typography>
                      <pre>{JSON.stringify(selectedUser.profile_data, null, 2)}</pre>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog 
        open={statusDialogOpen} 
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change User Status</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <>
              <Typography gutterBottom>
                Change status for: {selectedUser.first_name} {selectedUser.last_name}
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>New Status</InputLabel>
                <Select
                  value={newStatus}
                  label="New Status"
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                  <MenuItem value="banned">Banned</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason (optional)"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleStatusChange} 
            variant="contained"
            disabled={!newStatus}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;