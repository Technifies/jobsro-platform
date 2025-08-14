import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const LoginPage: React.FC = () => {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h4" fontWeight={600} gutterBottom>
          Login
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Login page will be implemented in the next phase
        </Typography>
      </Box>
    </Container>
  );
};

export default LoginPage;